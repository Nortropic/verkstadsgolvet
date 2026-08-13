import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigSchema, TaskSchema, type FactoryConfig, type Finding, type RoleResult, type RunState, type TaskSpec } from './schemas';
import { repoRoot, readJson, nowId, slug } from './util';
import { originMain, createWorktree, changedFiles, commitCandidate, clean } from './git';
import { ClaudeRoleFailure, runRole, WRITE_ROLES, type RoleName } from './claude';
import { assertOwnerAuthorPublicationGuard, laneForAuthorityClass, resolveAuthorityClass, type AuthorityClass, type AuthoritySelection } from './authority';
import { assertDeclaredScope, formatScopeViolations, validateExactScope } from './scope';
import { acquireClaim, ownerToken, releaseClaim } from './claims';
import { runGates } from './gates';
import { saveState, loadState } from './state';
import { Telemetry } from './telemetry';
import { captureVisualEvidence } from './visual-review';
import { publish } from './publication';
import { builderRemediationFindings, reviewDisposition } from './review-policy';

function mergeAdvisories(current: Finding[], next: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of [...current, ...next]) {
    const key = `${f.id}\u0000${f.severity}\u0000${f.file ?? ''}\u0000${f.line ?? ''}\u0000${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(f);
  }
  return out;
}

/** Recoverable write-role sessions: the ordinary `builder` and the owner-author write role. */
export function recoverableBuilderSession(error: unknown): string | null {
  return error instanceof ClaudeRoleFailure && WRITE_ROLES.includes(error.role) ? error.sessionId : null;
}

/** The single failure subtype that a builder may continue from without operator involvement. */
export const BUILDER_CONTINUATION_SUBTYPE = 'error_max_turns';

/** Stable prefix of the persisted blocked reason written when the continuation budget is spent. */
export const BUILDER_CONTINUATION_BUDGET_BLOCK_PREFIX = 'builder continuation budget exhausted after ';

export function builderContinuationBudgetBlockedReason(sessionId: string, used: number): string {
  return `${BUILDER_CONTINUATION_BUDGET_BLOCK_PREFIX}${used} automatic continuation${used === 1 ? '' : 's'}; builder session ${sessionId} is retained and can continue only if maxBuilderContinuationResumes is raised above ${used}`;
}

/**
 * True only for a builder `error_max_turns` failure that still carries a usable session identity.
 *
 * Every other Claude failure — any other subtype, any other role, or a lost builder session —
 * stays an ordinary immediate blocker.
 */
export function isBuilderContinuationFailure(error: unknown): error is ClaudeRoleFailure {
  return error instanceof ClaudeRoleFailure
    && WRITE_ROLES.includes(error.role)
    && error.subtype === BUILDER_CONTINUATION_SUBTYPE
    && typeof error.sessionId === 'string'
    && error.sessionId.length > 0;
}

/** Continuations left under the CURRENT config; a raised limit re-opens an exhausted run. */
export function builderContinuationsRemaining(config: FactoryConfig, state: RunState): number {
  return Math.max(0, config.maxBuilderContinuationResumes - state.builderContinuationResumesUsed);
}

/**
 * Resume gate for a run blocked purely because the continuation budget ran out.
 *
 * Fails closed while the configured limit still sits at or below the persisted used count, and
 * re-opens the SAME persisted builder session once an operator raises the configured limit.
 */
export function builderContinuationResumeBlocked(config: FactoryConfig, state: RunState): boolean {
  return state.phase === 'BLOCKED'
    && !!state.blockedReason?.startsWith(BUILDER_CONTINUATION_BUDGET_BLOCK_PREFIX)
    && builderContinuationsRemaining(config, state) === 0;
}

export type BuilderSegmentResult = { sessionId: string; result: RoleResult };

/** Production-used seam: one bounded Claude builder segment, resumed from `resume` when present. */
export type BuilderContinuationDeps = {
  runBuilderSegment: (args: { prompt: string; resume: string | null; round: number }) => Promise<BuilderSegmentResult>;
  persist: (state: RunState) => void;
  emit: (event: string, fields: Record<string, unknown>) => void;
};

/**
 * Runs the builder for one remediation round as a sequence of bounded Claude segments.
 *
 * `error_max_turns` is not a builder defect, it is an exhausted segment. Rather than handing the
 * run to an operator, this composes the next bounded segment on the EXACT same builder session,
 * same worktree, same round, same prompt and same remediation findings. A continuation never
 * touches `state.attempt`, `maxRemediationRounds` or `ownerRemediationExtensionRounds`, never
 * creates a candidate and never runs gates or reviewers between segments; the returned success
 * re-enters the ordinary gates/candidate/reviewer path unchanged.
 *
 * The persisted counter is incremented and saved BEFORE the next segment starts, so a crash mid
 * segment can never make the budget look cheaper than it was. When the budget is spent the loop
 * fails closed WITHOUT invoking another model segment, retaining the session identity.
 */
export async function runBuilderWithContinuation(args: {
  state: RunState;
  config: FactoryConfig;
  round: number;
  prompt: string;
  deps: BuilderContinuationDeps;
}): Promise<BuilderSegmentResult> {
  const { state, config, round, prompt, deps } = args;
  for (;;) {
    try {
      const b = await deps.runBuilderSegment({ prompt, resume: state.sessions.builder, round });
      return b;
    } catch (error) {
      const recovered = recoverableBuilderSession(error);
      if (recovered) {
        // A different session id means the transcript we intended to continue is gone: blocker.
        if (state.sessions.builder && state.sessions.builder !== recovered) throw new Error(`builder session identity changed: ${state.sessions.builder} -> ${recovered}`);
        state.sessions.builder = recovered; deps.persist(state);
        const failure = error as ClaudeRoleFailure;
        deps.emit('builder.session_preserved_after_error', { session_id: recovered, subtype: failure.subtype, num_turns: failure.numTurns, round });
      }
      if (!isBuilderContinuationFailure(error) || !recovered) throw error;

      if (builderContinuationsRemaining(config, state) === 0) {
        deps.emit('builder.continuation_budget_exhausted', { session_id: recovered, round, continuations_used: state.builderContinuationResumesUsed, max_continuations: config.maxBuilderContinuationResumes });
        throw new Error(builderContinuationBudgetBlockedReason(recovered, state.builderContinuationResumesUsed));
      }
      // Persist the spent continuation BEFORE the next segment is started.
      state.builderContinuationResumesUsed += 1; deps.persist(state);
      deps.emit('builder.continuation_started', { session_id: recovered, round, subtype: error.subtype, num_turns: error.numTurns, continuations_used: state.builderContinuationResumesUsed, max_continuations: config.maxBuilderContinuationResumes });
    }
  }
}

export function nextRoundAfterRemediation(round: number): number { return round + 1; }

export function allowedMaxRound(config: FactoryConfig, state: RunState): number {
  return config.maxRemediationRounds + state.ownerRemediationExtensionRounds;
}

export function extendRemediationState(state: RunState, config: FactoryConfig, rounds: number): RunState {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3) throw new Error('owner remediation extension must be 1..3 rounds');
  if (state.phase !== 'BLOCKED' || !state.blockedReason?.startsWith('remediation budget exhausted after ')) {
    throw new Error('owner remediation extension requires a remediation-budget BLOCKED run');
  }
  if (state.ownerRemediationExtensionRounds + rounds > 10) throw new Error('owner remediation extension exceeds state maximum');
  const currentMax = allowedMaxRound(config, state);
  const nextAttempt = state.attempt <= currentMax ? currentMax + 1 : state.attempt;
  return { ...state, attempt: nextAttempt, ownerRemediationExtensionRounds: state.ownerRemediationExtensionRounds + rounds };
}

/**
 * Pure successful-completion transition.
 *
 * A terminal success must not carry stale blocking metadata from an earlier BLOCKED
 * state, so `blockedReason` is cleared here and only here. Every other field is
 * preserved and the input prestate is never mutated.
 */
export function completeRunState(state: RunState): RunState {
  return { ...state, phase: 'DONE', findings: [], blockedReason: null };
}

export function loadConfig(repo: string): FactoryConfig {
  const local = path.join(repo, '.claude-loop.json');
  const example = path.join(repo, '.claude-loop.example.json');
  return ConfigSchema.parse(readJson(fs.existsSync(local) ? local : example));
}
export function loadTask(file: string): TaskSpec { return TaskSchema.parse(readJson(path.resolve(file))); }

function basePrompt(task: TaskSpec): string {
  return `Task ${task.id}: ${task.title}\n\n${task.description}\n\nAllowed write: ${task.allowedWrite.join(', ')}\nDenied write: ${task.deniedWrite.join(', ')}\nRequired gates: ${task.gates.map((g) => JSON.stringify(g)).join(' ; ')}`;
}

/**
 * The supervisor's explicit owner-author selection for one invocation.
 *
 * Composed ONLY of operator-controlled inputs: the `--owner-author` CLI flag and the git-ignored,
 * operator-local `.claude-loop.json`. Nothing a model writes reaches this function.
 */
export function supervisorAuthoritySelection(config: FactoryConfig, cliSelected: readonly string[] = []): AuthoritySelection {
  return { selectedTaskIds: [...new Set([...config.ownerAuthor.selectedTaskIds, ...cliSelected])] };
}

export async function startRun(taskFile: string, cliOwnerAuthorTaskIds: readonly string[] = []): Promise<RunState> {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const task = loadTask(taskFile);
  const authorityClass = resolveAuthorityClass({
    taskId: task.id,
    declared: task.authorityClass,
    selection: supervisorAuthoritySelection(config, cliOwnerAuthorTaskIds),
    source: `task file ${path.basename(taskFile)}`,
  });
  return await startRunFromTask({ repo, config, task, authorityClass });
}

/**
 * Starts one run from an already-resolved task and authority class.
 *
 * Shared by `claude:run` and the autopilot scheduler so both go through exactly the same worktree
 * lifecycle, the same declared-scope guard and the same publication guard. The authority class is
 * an input here: this function never resolves, upgrades or infers it.
 */
export async function startRunFromTask(args: {
  repo?: string;
  config?: FactoryConfig;
  task: TaskSpec;
  authorityClass: AuthorityClass;
}): Promise<RunState> {
  const repo = args.repo ?? repoRoot();
  const config = args.config ?? loadConfig(repo);
  const task = args.task;
  const authorityClass = args.authorityClass;
  if (task.visualReview && !task.visual) throw new Error('visualReview=true requires task.visual');
  assertDeclaredScope({ taskId: task.id, allowedWrite: task.allowedWrite, lane: laneForAuthorityClass(authorityClass) });
  assertOwnerAuthorPublicationGuard({ authorityClass, autoMerge: config.publish.autoMerge });
  if (!clean(repo)) throw new Error('launch checkout must be clean');
  const main = originMain(repo);
  const baseSha = task.baseSha ?? main;
  if (task.baseSha && task.baseSha !== main) throw new Error(`explicit task base is not current origin/main`);
  const runId = `${slug(task.id)}-${nowId()}`;
  const wtRoot = path.join(os.homedir(), 'nortropic', 'worktrees', 'claude-factory');
  const { worktree, branch } = createWorktree(repo, wtRoot, task.id, runId, baseSha);
  let state: RunState = { version: 1, runId, task, authorityClass, baseSha, branch, worktree, phase: 'ARCHITECT', attempt: 0, candidateSha: null, sessions: { architect: null, builder: null, reviewer: null, visualReviewer: null }, ownerRemediationExtensionRounds: 0, builderContinuationResumesUsed: 0, findings: [], advisoryFindings: [], prUrl: null, blockedReason: null };
  saveState(repo, state);
  return await execute(repo, config, state);
}

export async function resumeRun(runId: string): Promise<RunState> {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const state = loadState(repo, runId);
  if (!fs.existsSync(state.worktree)) throw new Error(`recorded worktree missing: ${state.worktree}`);
  // Fail before any Claude segment while the continuation budget is still spent under the
  // CURRENT config; raising maxBuilderContinuationResumes re-opens the same persisted session.
  if (builderContinuationResumeBlocked(config, state)) {
    throw new Error(`builder continuation budget exhausted (${state.builderContinuationResumesUsed}/${config.maxBuilderContinuationResumes}); raise maxBuilderContinuationResumes above ${state.builderContinuationResumesUsed} before resume`);
  }
  const maxRound = allowedMaxRound(config, state);
  const legacyExhausted = state.ownerRemediationExtensionRounds === 0 && state.attempt === config.maxRemediationRounds;
  if (state.phase === 'BLOCKED' && state.blockedReason?.startsWith('remediation budget exhausted after ') && (legacyExhausted || state.attempt > maxRound)) {
    throw new Error('remediation budget exhausted; explicit owner extend-remediation is required before resume');
  }

  // A RUN claim, held for the duration of this resume. A fresh run gets a brand new run id and
  // cannot collide, but two operators can resume the SAME recorded run in the same worktree; that
  // would put two model sessions on one candidate. The claim makes it exactly one, and an
  // abandoned resume becomes recoverable through the ordinary stale-claim path.
  const claim = acquireClaim({ repo, scope: 'run', key: runId, owner: ownerToken('resume'), nowMs: Date.now(), ttlSeconds: config.autopilot.claimTtlSeconds, runId });
  if (!claim.ok) {
    throw new Error(`run ${runId} is already claimed by ${claim.current?.owner ?? 'another supervisor'} (${claim.reason}); recover the stale claim with npm run claude:autopilot-recover before resuming`);
  }
  try {
    return await execute(repo, config, state);
  } finally {
    releaseClaim({ repo, claim: claim.claim, nowMs: Date.now(), note: 'released after resume' });
  }
}

export function extendRemediationBudget(runId: string, rounds: number): RunState {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const state = loadState(repo, runId);
  const next = extendRemediationState(state, config, rounds);
  saveState(repo, next);
  new Telemetry(repo, runId).emit('owner.remediation_extension', {
    rounds,
    total_extension_rounds: next.ownerRemediationExtensionRounds,
    next_round: next.attempt,
  });
  return next;
}

async function execute(repo: string, config: FactoryConfig, state: RunState): Promise<RunState> {
  const t = new Telemetry(repo, state.runId);
  // The lane is derived from the PERSISTED effective authority class, never from task file data
  // that could have changed since the run started.
  const lane = laneForAuthorityClass(state.authorityClass);
  const writeRole: RoleName = lane === 'owner-author' ? 'owner-author' : 'builder';
  try {
    assertOwnerAuthorPublicationGuard({ authorityClass: state.authorityClass, autoMerge: config.publish.autoMerge });
    assertDeclaredScope({ taskId: state.task.id, allowedWrite: state.task.allowedWrite, lane });
    if (!state.sessions.architect) {
      t.emit('architect.started', { task: state.task.id });
      const a = await runRole({ role: 'architect', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nPlan this implementation. Do not edit files.`, model: config.models.architect });
      state.sessions.architect = a.sessionId; state.phase = 'BUILD'; saveState(repo, state);
      t.emit('architect.completed', { session_id: a.sessionId, outcome: a.result.outcome });
      if (a.result.outcome !== 'READY') throw new Error(`architect not READY outcome=${a.result.outcome}: ${a.result.summary}`);
    }

    const maxRound = allowedMaxRound(config, state);
    for (let round = state.attempt; round <= maxRound; round++) {
      state.attempt = round; state.phase = round === 0 ? 'BUILD' : 'REMEDIATE'; saveState(repo, state);
      t.emit(round === 0 ? 'builder.started' : 'builder.remediation_started', { task: state.task.id, round, role: writeRole, authority_class: state.authorityClass });
      const supervisorGateHandoff = `If a required task gate is blocked inside the Claude sandbox by network or permission limits, do not bypass it and do not spend turns trying to prove the environment failure. Record the limitation and return READY when implementation is complete; the supervisor executes task.gates mechanically outside the model sandbox.`;
      const prompt = round === 0
        ? `${basePrompt(state.task)}\n\nImplement the task now in this worktree. You are not allowed to publish. Run useful local checks.\n\n${supervisorGateHandoff}`
        : `${basePrompt(state.task)}\n\nRemediate these independent findings, then rerun relevant checks:\n${JSON.stringify(state.findings, null, 2)}\n\n${supervisorGateHandoff}`;
      const b = await runBuilderWithContinuation({
        state,
        config,
        round,
        prompt,
        deps: {
          // maxTurns per segment stays the claude.ts default: this composes bounded segments.
          runBuilderSegment: (seg) => runRole({ role: writeRole, cwd: state.worktree, prompt: seg.prompt, resume: seg.resume, model: config.models.builder }),
          persist: (s) => saveState(repo, s),
          emit: (event, fields) => t.emit(event, fields),
        },
      });
      state.sessions.builder = b.sessionId; saveState(repo, state);
      t.emit('builder.completed', { session_id: b.sessionId, outcome: b.result.outcome, round });
      if (b.result.outcome === 'BLOCKED') throw new Error(`builder blocked: ${b.result.summary}`);
      const builderRemediation = builderRemediationFindings(b.result);
      if (builderRemediation) {
        state.findings = builderRemediation; state.attempt = nextRoundAfterRemediation(round); saveState(repo, state);
        t.emit('builder.self_remediation_requested', { round, findings: builderRemediation });
        continue;
      }

      // POST-WRITE EXACT SCOPE VALIDATION. Measured from Git after the model stopped writing, over
      // the union of tracked and untracked changes, against the exact lane rules. A single file
      // outside the exact scope blocks the run before any gate, candidate or reviewer.
      const files = changedFiles(state.worktree, state.candidateSha ?? state.baseSha);
      const violations = validateExactScope({ files, allowedWrite: state.task.allowedWrite, deniedWrite: state.task.deniedWrite, lane });
      if (violations.length) {
        t.emit('scope.violation', { round, lane, authority_class: state.authorityClass, violations });
        throw new Error(`allowed-write violation: ${formatScopeViolations(violations)}`);
      }
      const gates = await runGates(state.task.gates, state.worktree);
      t.emit(gates.ok ? 'gates.passed' : 'gates.failed', { round, failures: gates.failures.length });
      if (!gates.ok) {
        state.findings = gates.failures.map((g, i) => ({ id: `gate-${i+1}`, severity: 'major' as const, message: `${g.command.join(' ')} failed\n${g.output}` }));
        state.attempt = nextRoundAfterRemediation(round); saveState(repo, state);
        continue;
      }
      const changedNow = changedFiles(state.worktree, state.candidateSha ?? state.baseSha);
      if (changedNow.length) {
        // Each round appends a NEW immutable candidate commit; nothing is ever amended or reset.
        state.candidateSha = commitCandidate(state.worktree, state.task.id, round);
        t.emit('candidate.created', { candidate_sha: state.candidateSha, round });
      } else if (!state.candidateSha) throw new Error('builder produced no candidate changes');

      // Cumulative candidate scope: the whole candidate against the frozen base, not just this
      // round's delta, so an out-of-scope file from an earlier round cannot survive into review.
      const candidateViolations = validateExactScope({ files: changedFiles(state.worktree, state.baseSha), allowedWrite: state.task.allowedWrite, deniedWrite: state.task.deniedWrite, lane });
      if (candidateViolations.length) {
        t.emit('scope.violation', { round, lane, stage: 'candidate', violations: candidateViolations });
        throw new Error(`candidate allowed-write violation: ${formatScopeViolations(candidateViolations)}`);
      }

      state.phase = 'REVIEW'; state.findings = []; saveState(repo, state);
      t.emit('review.started', { candidate_sha: state.candidateSha, round });
      const reviewerScope = `Only blocker/major/minor findings may demand a change in the CURRENT task and must map to its stated exit/negative criteria or a current correctness, regression or security defect that is actionable within allowedWrite. Future-slice risks, optional hardening, portability outside the supported environment, reminders for later slices, and inability to execute supervisor-owned gates are severity note only. The supervisor has already executed task.gates mechanically; inability to rerun them in reviewer plan mode is not a gate failure.`;
      const r = await runRole({ role: 'reviewer', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nIndependently review candidate ${state.candidateSha} against base ${state.baseSha}. Inspect git diff and tests. Do not edit.\n\n${reviewerScope}`, model: config.models.reviewer });
      state.sessions.reviewer = r.sessionId;
      const rd = reviewDisposition(r.result, 'reviewer');
      state.advisoryFindings = mergeAdvisories(state.advisoryFindings, rd.advisories);
      state.findings = rd.actionable; saveState(repo, state);
      t.emit(rd.action === 'REMEDIATE' ? 'review.findings' : rd.advisories.length ? 'review.passed_with_advisories' : 'review.passed', { session_id: r.sessionId, outcome: r.result.outcome, findings: r.result.findings.length, actionable: rd.actionable, advisories: rd.advisories, round });
      if (rd.action === 'BLOCK') throw new Error(`reviewer blocked: ${r.result.summary}`);
      if (rd.action === 'REMEDIATE') { state.attempt = nextRoundAfterRemediation(round); saveState(repo, state); continue; }

      if (state.task.visualReview) {
        state.phase = 'VISUAL_REVIEW'; saveState(repo, state); t.emit('visual.started', { round });
        const outDir = path.join(state.worktree, '.claude-loop', 'evidence', state.runId, `round-${round}`);
        const capture = await captureVisualEvidence(state.task, state.worktree, outDir);
        try {
          const promptV = `${basePrompt(state.task)}\n\nReview these screenshots and the candidate read-only. Files:\n${capture.files.join('\n')}`;
          const v = await runRole({ role: 'visual-reviewer', cwd: state.worktree, prompt: promptV, model: config.models.visualReviewer });
          state.sessions.visualReviewer = v.sessionId;
          const vd = reviewDisposition(v.result, 'visual-reviewer');
          state.advisoryFindings = mergeAdvisories(state.advisoryFindings, vd.advisories);
          state.findings = vd.actionable; saveState(repo, state);
          t.emit(vd.action === 'REMEDIATE' ? 'visual.findings' : vd.advisories.length ? 'visual.passed_with_advisories' : 'visual.passed', { session_id: v.sessionId, outcome: v.result.outcome, findings: v.result.findings.length, actionable: vd.actionable, advisories: vd.advisories, round });
          if (vd.action === 'BLOCK') throw new Error(`visual reviewer blocked: ${v.result.summary}`);
          if (vd.action === 'REMEDIATE') { state.attempt = nextRoundAfterRemediation(round); saveState(repo, state); continue; }
        } finally { capture.stop(); }
      }

      const finalGates = await runGates(state.task.gates, state.worktree);
      if (!finalGates.ok) { state.findings = finalGates.failures.map((g,i) => ({ id:`final-gate-${i+1}`, severity:'major' as const, message:`${g.command.join(' ')} failed\n${g.output}` })); state.attempt = nextRoundAfterRemediation(round); saveState(repo,state); continue; }
      if (!clean(state.worktree)) throw new Error('worktree dirty after final candidate/gates');

      if (config.publish.enabled) {
        state.phase = 'PUBLISH'; saveState(repo, state); t.emit('publication.started', { candidate_sha: state.candidateSha });
        const p = publish({ repo, worktree: state.worktree, branch: state.branch, baseSha: state.baseSha, candidateSha: state.candidateSha!, taskId: state.task.id, autoMerge: config.publish.autoMerge, mergeMethod: config.publish.mergeMethod });
        state.prUrl = p.prUrl; t.emit(p.mergedMain ? 'publication.completed' : 'pr.created', { pr: p.prUrl, main: p.mergedMain ?? null, merge_method: config.publish.mergeMethod, merge_sha: p.mergeSha ?? null });
      }
      const completed = completeRunState(state);
      saveState(repo, completed); t.emit('run.completed', { task: completed.task.id, candidate_sha: completed.candidateSha, pr: completed.prUrl, advisory_findings: completed.advisoryFindings });
      return completed;
    }
    throw new Error(`remediation budget exhausted after ${maxRound + 1} rounds`);
  } catch (e) {
    state.phase = 'BLOCKED'; state.blockedReason = e instanceof Error ? e.message : String(e); saveState(repo, state); t.emit('run.blocked', { reason: state.blockedReason });
    throw e;
  }
}
