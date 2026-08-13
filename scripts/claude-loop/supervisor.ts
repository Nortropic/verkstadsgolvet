import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigSchema, TaskSchema, type FactoryConfig, type Finding, type ProgressRecord, type RoleResult, type RunState, type TaskSpec } from './schemas';
import { repoRoot, readJson, nowId, slug, mainCheckout, git, gitRun } from './util';
import { originMain, createWorktree, changedFiles, commitCandidate, clean, candidateTree } from './git';
import { ClaudeRoleFailure, runRole, WRITE_ROLES, type RoleName } from './claude';
import { assertOwnerAuthorPublicationGuard, laneForAuthorityClass, resolveAuthorityClass, type AuthorityClass, type AuthoritySelection } from './authority';
import { assertDeclaredScope, assertNoForbiddenWorktreeFiles, formatScopeViolations, validateExactScope } from './scope';
import { ClaimLostError, acquireClaim, ownerToken, releaseClaim, startClaimHeartbeat } from './claims';
import { runGates } from './gates';
import { saveState, loadState } from './state';
import { Telemetry } from './telemetry';
import { captureVisualEvidence } from './visual-review';
import { publish, type PublishArgs, type PublishResult } from './publication';
import { builderRemediationFindings, reviewDisposition } from './review-policy';
import {
  ABSOLUTE_BACKSTOP_BLOCK_PREFIX,
  ABSOLUTE_ROUND_BACKSTOP,
  absoluteBackstopBlockedReason,
  absoluteBackstopReached,
  classifyProgress,
  endsWithOwnerExtension,
  findingFiles,
  findingSetFingerprint,
  gateFailureSetFingerprint,
  isAbsoluteBackstopBlockedReason,
  isLegacyBudgetBlockedReason,
  isNoProgressBlockedReason,
  isOwnerExtendableBlockedReason,
  isRelevantChange,
  ownerExtensionRecord,
} from './progress';

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

/**
 * The RETIRED fixed round bound.
 *
 * `maxRemediationRounds` remains in `ConfigSchema` because operator configuration files carry it,
 * and this helper remains because the legacy resume/extension arithmetic for run states persisted
 * before the circuit breaker is defined in terms of it. It no longer bounds a progressing loop:
 * a run that keeps making progress continues past it with no operator extension at all.
 */
export function allowedMaxRound(config: FactoryConfig, state: RunState): number {
  return config.maxRemediationRounds + state.ownerRemediationExtensionRounds;
}

/**
 * Owner re-open of a blocked run.
 *
 * Accepts BOTH the retired fixed-budget prefix (runs persisted before the breaker must stay
 * extendable) and the no-progress breaker prefix. The absolute backstop is never extendable.
 *
 * The extension appends an explicit `owner-extension` marker to the append-only history, which is
 * what gives the re-opened run a genuine fresh chance instead of re-deriving the same stale verdict
 * from the same stale evidence. `state.attempt` is never reset, history is never truncated, and no
 * permission, lane or scope is widened by any of this.
 */
export function extendRemediationState(state: RunState, config: FactoryConfig, rounds: number): RunState {
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 3) throw new Error('owner remediation extension must be 1..3 rounds');
  if (isAbsoluteBackstopBlockedReason(state.blockedReason)) {
    throw new Error(`${ABSOLUTE_BACKSTOP_BLOCK_PREFIX}run ${state.runId} is terminally blocked and is never extendable; start a fresh sequential run`);
  }
  if (state.phase !== 'BLOCKED' || !isOwnerExtendableBlockedReason(state.blockedReason)) {
    throw new Error('owner remediation extension requires a remediation-budget BLOCKED run or a no-progress circuit-breaker BLOCKED run');
  }
  if (absoluteBackstopReached(state.attempt)) {
    throw new Error(`${ABSOLUTE_BACKSTOP_BLOCK_PREFIX}run ${state.runId} is at the frozen ${ABSOLUTE_ROUND_BACKSTOP}-round backstop and is never extendable; start a fresh sequential run`);
  }
  if (state.ownerRemediationExtensionRounds + rounds > 10) throw new Error('owner remediation extension exceeds state maximum');
  // Legacy budget arithmetic is preserved EXACTLY for legacy blocked runs. A breaker-blocked run
  // keeps the round it reached: the attempt counter only ever moves forward.
  const currentMax = allowedMaxRound(config, state);
  const nextAttempt = isLegacyBudgetBlockedReason(state.blockedReason) && state.attempt <= currentMax ? currentMax + 1 : state.attempt;
  return {
    ...state,
    attempt: nextAttempt,
    ownerRemediationExtensionRounds: state.ownerRemediationExtensionRounds + rounds,
    progressHistory: [...state.progressHistory, ownerExtensionRecord({ round: nextAttempt, rounds })],
  };
}

/**
 * Pure resume guard for a run stopped by the circuit breaker.
 *
 * Returns the refusal message, or `null` when the resume may proceed. A breaker-blocked run needs a
 * PRIOR owner extension exactly as a legacy budget-blocked run does; a restart on its own never
 * manufactures fresh retry entitlement, because the entitlement is a persisted append-only marker
 * rather than an in-memory counter. The backstop is terminal and no marker re-opens it.
 */
export function circuitBreakerResumeRefusal(state: RunState): string | null {
  if (state.phase !== 'BLOCKED') return null;
  if (isAbsoluteBackstopBlockedReason(state.blockedReason)) {
    return `run ${state.runId} reached the frozen ${ABSOLUTE_ROUND_BACKSTOP}-round absolute backstop; it is terminally blocked and not extendable, so the only escape is a fresh sequential run`;
  }
  if (isNoProgressBlockedReason(state.blockedReason) && !endsWithOwnerExtension(state.progressHistory)) {
    return `run ${state.runId} is blocked by the no-progress circuit breaker; explicit owner extend-remediation is required before resume`;
  }
  return null;
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

/**
 * Loads the supervisor's configuration from the OPERATOR's checkout, never from a run worktree.
 *
 * `ownerAuthor.selectedTaskIds` in this file is one of the only two ways into the owner-author lane,
 * so where it is read from is a real question. `repoRoot()` resolves from `cwd`, and a supervisor
 * step legitimately runs with `cwd` inside a candidate worktree (mechanical gates do), so reading
 * the config relative to `cwd` would let a file inside the candidate tree — including the
 * git-ignored `.claude-loop.json`, which no diff and no changed-file set can show — decide the lane.
 * Resolving from the Git common directory makes the operator's checkout the only source.
 */
export function loadConfig(repo: string): FactoryConfig {
  const root = mainCheckout(repo);
  const local = path.join(root, '.claude-loop.json');
  if (fs.existsSync(local)) return ConfigSchema.parse(readJson(local));

  // Shipped defaults. The operator checkout is preferred, but this file is tracked, so a run root
  // copy is an acceptable fallback when the main checkout is unreadable — WITH the owner-author
  // selection forced empty. Shipped defaults are documentation, never an authority grant, so a
  // tracked example inside a candidate tree can never select the owner-author lane even when it is
  // the copy that gets read. Only the operator-local `.claude-loop.json` above, or the explicit
  // `--owner-author` CLI flag, can do that.
  for (const candidateRoot of [root, repo]) {
    const example = path.join(candidateRoot, '.claude-loop.example.json');
    if (!fs.existsSync(example)) continue;
    const shipped = ConfigSchema.parse(readJson(example));
    return { ...shipped, ownerAuthor: { selectedTaskIds: [] } };
  }
  throw new Error(`no Claude Factory configuration found: neither ${local} nor a .claude-loop.example.json under ${root} or ${repo}`);
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
/**
 * Fail-closed liveness checkpoint for whoever holds the claim covering this run.
 *
 * The supervisor calls it at every phase transition and every state persistence. It refreshes the
 * claim and THROWS when the claim was taken over, so a supervisor that lost its claim stops instead
 * of continuing to write into a run another supervisor now owns.
 */
export type RunHeartbeat = () => void;

/**
 * The supervisor's effectful seams, so the loop itself can be exercised deterministically.
 *
 * Production always uses `productionRunDeps`. Tests inject scripted role results and gate outcomes
 * against DISPOSABLE Git repositories, which is what makes the circuit-breaker regressions
 * hermetic. Nothing here is an authority seam: lane resolution, scope validation, claims, candidate
 * lineage and the publication guards are unchanged and are not injectable.
 */
export type RunDeps = {
  runRole: (args: { role: RoleName; prompt: string; cwd: string; resume?: string | null; maxTurns?: number; model?: string }) => Promise<{ sessionId: string; result: RoleResult }>;
  runGates: (commands: string[][], cwd: string) => Promise<{ ok: boolean; failures: Array<{ command: string[]; output: string }> }>;
  captureVisualEvidence: (task: TaskSpec, cwd: string, outDir: string) => Promise<{ files: string[]; stop: () => void }>;
  publish: (args: PublishArgs) => PublishResult;
  /** Where run worktrees are created. Production uses the operator's worktree root. */
  worktreeRoot?: string;
};

export const productionRunDeps: RunDeps = { runRole, runGates, captureVisualEvidence, publish };

/**
 * The exact content identity of the worktree as a stage judged it.
 *
 * `write-tree` hashes the index and creates NO commit and moves NO ref, so this is a read of
 * content rather than a mutation of history. It gives the breaker an exact answer to "did anything
 * at all change between these two gate runs", which a changed-file name list cannot give.
 */
function worktreeTreeSha(worktree: string): string {
  gitRun(worktree, ['add', '--all']);
  return git(worktree, 'write-tree');
}

export async function startRunFromTask(args: {
  repo?: string;
  config?: FactoryConfig;
  task: TaskSpec;
  authorityClass: AuthorityClass;
  heartbeat?: RunHeartbeat;
  deps?: RunDeps;
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
  const deps = args.deps ?? productionRunDeps;
  const runId = `${slug(task.id)}-${nowId()}`;
  const wtRoot = deps.worktreeRoot ?? path.join(os.homedir(), 'nortropic', 'worktrees', 'claude-factory');
  const { worktree, branch } = createWorktree(repo, wtRoot, task.id, runId, baseSha);
  // The frozen base is the first entry of the append-only progress history, so a later candidate
  // that undoes the whole run back to the base tree is recognised as oscillation rather than work.
  const baseRecord: ProgressRecord = { round: 0, source: 'builder', kind: 'base', candidateSha: baseSha, candidateTree: candidateTree(worktree), fingerprint: '', files: [], relevantChange: false, detail: 'frozen base' };
  let state: RunState = { version: 1, runId, task, authorityClass, baseSha, branch, worktree, phase: 'ARCHITECT', attempt: 0, candidateSha: null, sessions: { architect: null, builder: null, reviewer: null, visualReviewer: null }, ownerRemediationExtensionRounds: 0, builderContinuationResumesUsed: 0, progressHistory: [baseRecord], findings: [], advisoryFindings: [], prUrl: null, blockedReason: null };
  saveState(repo, state);
  return await execute(repo, config, state, args.heartbeat, deps);
}

export async function resumeRun(runId: string, cliOwnerAuthorTaskIds: readonly string[] = []): Promise<RunState> {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const state = loadState(repo, runId);
  if (!fs.existsSync(state.worktree)) throw new Error(`recorded worktree missing: ${state.worktree}`);

  // The persisted authority class is DATA, exactly like the class declared in a task file, and it
  // lives under the Git common directory where no changed-file set can observe a mutation. So the
  // resume re-applies the same guard as a fresh run instead of trusting the field: entering the
  // owner-author lane always requires an explicit supervisor selection in THIS invocation.
  state.authorityClass = resolveAuthorityClass({
    taskId: state.task.id,
    declared: state.authorityClass,
    selection: supervisorAuthoritySelection(config, cliOwnerAuthorTaskIds),
    source: `persisted run state ${runId}`,
  });
  saveState(repo, state);
  // Fail before any Claude segment while the continuation budget is still spent under the
  // CURRENT config; raising maxBuilderContinuationResumes re-opens the same persisted session.
  if (builderContinuationResumeBlocked(config, state)) {
    throw new Error(`builder continuation budget exhausted (${state.builderContinuationResumesUsed}/${config.maxBuilderContinuationResumes}); raise maxBuilderContinuationResumes above ${state.builderContinuationResumesUsed} before resume`);
  }
  // A run stopped by the circuit breaker is re-opened by an owner extension, never by a restart:
  // the entitlement is the persisted append-only marker, so repeating `resume` changes nothing.
  const breakerRefusal = circuitBreakerResumeRefusal(state);
  if (breakerRefusal) throw new Error(breakerRefusal);
  // Legacy fixed-budget blocked runs keep their EXACT previous resume semantics and message.
  const maxRound = allowedMaxRound(config, state);
  const legacyExhausted = state.ownerRemediationExtensionRounds === 0 && state.attempt === config.maxRemediationRounds;
  if (state.phase === 'BLOCKED' && isLegacyBudgetBlockedReason(state.blockedReason) && (legacyExhausted || state.attempt > maxRound)) {
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
  // The claim is kept ALIVE for the whole resume. Without this the claim would only carry its
  // acquisition time, so a resume outliving claimTtlSeconds would look abandoned and a second
  // resume could take it over — two write sessions in one worktree on one candidate.
  const heartbeat = startClaimHeartbeat({ repo, claim: claim.claim, ttlSeconds: config.autopilot.claimTtlSeconds });
  try {
    return await execute(repo, config, state, heartbeat.checkpoint);
  } finally {
    heartbeat.stop();
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
    progress_history: next.progressHistory.length,
  });
  return next;
}

export async function execute(repo: string, config: FactoryConfig, state: RunState, heartbeat?: RunHeartbeat, runDeps: RunDeps = productionRunDeps): Promise<RunState> {
  // Shadowed deliberately: the production wiring below is byte-for-byte the same call it always
  // was, and the seam only decides WHICH implementation those exact call sites reach.
  const { runRole, runGates, captureVisualEvidence, publish } = runDeps;
  const t = new Telemetry(repo, state.runId);
  // The lane is derived from the PERSISTED effective authority class, never from task file data
  // that could have changed since the run started.
  const lane = laneForAuthorityClass(state.authorityClass);
  const writeRole: RoleName = lane === 'owner-author' ? 'owner-author' : 'builder';

  /**
   * The single persistence point of the run.
   *
   * The claim covering this run is refreshed BEFORE every state write, and a lost claim throws
   * instead of writing: a supervisor that was taken over must not keep editing a run another
   * supervisor now owns. It is also what keeps a long run's claim from going stale mid-flight,
   * because every phase, round, session and finding update is a beat.
   */
  const persistRunState = (s: RunState): void => {
    heartbeat?.();
    saveState(repo, s);
  };

  /**
   * The single circuit-breaker point of the run.
   *
   * The verdict is computed from the PERSISTED history plus the record about to be appended, the
   * record is appended and persisted whether or not it blocks (evidence is never withheld from the
   * audit trail), and a BLOCK then throws so the run fails closed before the next remediation round
   * can start. History is append-only here and nowhere else rewrites it.
   */
  const recordProgress = (record: ProgressRecord): void => {
    const verdict = classifyProgress(state.progressHistory, record);
    state.progressHistory = [...state.progressHistory, record];
    persistRunState(state);
    t.emit('progress.recorded', { round: record.round, source: record.source, kind: record.kind, fingerprint: record.fingerprint, files: record.files, relevant_change: record.relevantChange, candidate_sha: record.candidateSha, candidate_tree: record.candidateTree, verdict: verdict.verdict });
    if (verdict.verdict === 'BLOCK') {
      t.emit('circuit_breaker.blocked', { rule: verdict.rule, round: record.round, source: record.source, fingerprint: record.fingerprint, reason: verdict.reason });
      throw new Error(verdict.reason);
    }
  };

  try {
    assertOwnerAuthorPublicationGuard({ authorityClass: state.authorityClass, autoMerge: config.publish.autoMerge });
    assertDeclaredScope({ taskId: state.task.id, allowedWrite: state.task.allowedWrite, lane });
    if (!state.sessions.architect) {
      t.emit('architect.started', { task: state.task.id });
      const a = await runRole({ role: 'architect', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nPlan this implementation. Do not edit files.`, model: config.models.architect });
      state.sessions.architect = a.sessionId; state.phase = 'BUILD'; persistRunState(state);
      t.emit('architect.completed', { session_id: a.sessionId, outcome: a.result.outcome });
      if (a.result.outcome !== 'READY') throw new Error(`architect not READY outcome=${a.result.outcome}: ${a.result.summary}`);
    }

    // NO fixed round bound. The loop continues for as long as every completed round is PROGRESS;
    // the progress-aware circuit breaker below is what stops it, and the frozen absolute backstop
    // is the terminal defense against pathological always-different churn.
    for (let round = state.attempt; ; round++) {
      if (absoluteBackstopReached(round)) {
        t.emit('circuit_breaker.blocked', { rule: 'absolute-backstop', round, backstop: ABSOLUTE_ROUND_BACKSTOP });
        throw new Error(absoluteBackstopBlockedReason({ runId: state.runId, round }));
      }
      // What THIS round was asked to fix, captured before the write role can change it.
      const remediating = state.findings.map((f) => ({ ...f }));
      const remediatingFingerprint = findingSetFingerprint(remediating);
      const remediatingFiles = findingFiles(remediating);
      const roundBase = state.candidateSha ?? state.baseSha;
      state.attempt = round; state.phase = round === 0 ? 'BUILD' : 'REMEDIATE'; persistRunState(state);
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
          persist: (s) => persistRunState(s),
          emit: (event, fields) => t.emit(event, fields),
        },
      });
      state.sessions.builder = b.sessionId; persistRunState(state);
      t.emit('builder.completed', { session_id: b.sessionId, outcome: b.result.outcome, round });
      if (b.result.outcome === 'BLOCKED') throw new Error(`builder blocked: ${b.result.summary}`);
      const builderRemediation = builderRemediationFindings(b.result);
      if (builderRemediation) {
        state.findings = builderRemediation; state.attempt = nextRoundAfterRemediation(round); persistRunState(state);
        t.emit('builder.self_remediation_requested', { round, findings: builderRemediation });
        recordProgress({
          round,
          source: 'builder',
          kind: 'findings',
          candidateSha: state.candidateSha,
          candidateTree: worktreeTreeSha(state.worktree),
          fingerprint: findingSetFingerprint(builderRemediation),
          files: findingFiles(builderRemediation),
          relevantChange: isRelevantChange({ findingFiles: remediatingFiles, changedFiles: changedFiles(state.worktree, roundBase) }),
          detail: 'write role requested its own remediation',
        });
        continue;
      }

      // POST-WRITE EXACT SCOPE VALIDATION. Measured from Git after the model stopped writing, over
      // the union of tracked and untracked changes, against the exact lane rules. A single file
      // outside the exact scope blocks the run before any gate, candidate or reviewer.
      // Existence check first: the operator-local configuration is git-ignored, so it is invisible
      // to the changed-file set below and could otherwise plant an owner-author lane selection that
      // no mechanical control, diff or reviewer would ever see.
      assertNoForbiddenWorktreeFiles(state.worktree);
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
        state.attempt = nextRoundAfterRemediation(round); persistRunState(state);
        // A gate failure is fingerprinted from the exact argv and the first output line, and judged
        // against the exact content the gate ran on, so "the same failure on the same tree" is a
        // mechanical fact rather than an impression.
        recordProgress({
          round,
          source: 'gates',
          kind: 'findings',
          candidateSha: state.candidateSha,
          candidateTree: worktreeTreeSha(state.worktree),
          fingerprint: gateFailureSetFingerprint(gates.failures),
          files: [],
          relevantChange: isRelevantChange({ findingFiles: remediatingFiles, changedFiles: files }),
          detail: gates.failures.map((g) => g.command.join(' ')).join(' ; '),
        });
        continue;
      }
      const changedNow = changedFiles(state.worktree, state.candidateSha ?? state.baseSha);
      if (changedNow.length) {
        // Each round appends a NEW immutable candidate commit; nothing is ever amended or reset.
        state.candidateSha = commitCandidate(state.worktree, state.task.id, round);
        t.emit('candidate.created', { candidate_sha: state.candidateSha, round });
        recordProgress({
          round,
          source: 'builder',
          kind: 'candidate',
          candidateSha: state.candidateSha,
          candidateTree: candidateTree(state.worktree),
          fingerprint: remediatingFingerprint,
          files: remediatingFiles,
          relevantChange: isRelevantChange({ findingFiles: remediatingFiles, changedFiles: changedNow }),
          detail: `candidate round ${round}`,
        });
      } else if (!state.candidateSha) throw new Error('builder produced no candidate changes');
      else if (remediating.length) {
        // READY without a single change while findings were pending. The FIRST one is recorded and
        // the unchanged candidate still goes to a fresh independent review, because an independent
        // reviewer may legitimately withdraw its own finding; a second consecutive one blocks.
        recordProgress({
          round,
          source: 'builder',
          kind: 'no-change-ready',
          candidateSha: state.candidateSha,
          candidateTree: candidateTree(state.worktree),
          fingerprint: remediatingFingerprint,
          files: remediatingFiles,
          relevantChange: false,
          detail: 'write role reported READY without creating any change',
        });
      }

      // Cumulative candidate scope: the whole candidate against the frozen base, not just this
      // round's delta, so an out-of-scope file from an earlier round cannot survive into review.
      assertNoForbiddenWorktreeFiles(state.worktree);
      const candidateViolations = validateExactScope({ files: changedFiles(state.worktree, state.baseSha), allowedWrite: state.task.allowedWrite, deniedWrite: state.task.deniedWrite, lane });
      if (candidateViolations.length) {
        t.emit('scope.violation', { round, lane, stage: 'candidate', violations: candidateViolations });
        throw new Error(`candidate allowed-write violation: ${formatScopeViolations(candidateViolations)}`);
      }

      /**
       * One independent-review stage, as breaker evidence.
       *
       * `relevantChange` answers the question the identical-repeat rule asks: did the remediation
       * that led INTO this review touch any file the finding set it was remediating named? A
       * finding set naming no file is answered by any candidate change at all.
       */
      const reviewProgressRecord = (a: { round: number; source: 'reviewer' | 'visual-reviewer'; actionable: Finding[]; action: 'PASS' | 'REMEDIATE' }): ProgressRecord => ({
        round: a.round,
        source: a.source,
        kind: a.action === 'REMEDIATE' ? 'findings' : 'clear',
        candidateSha: state.candidateSha,
        candidateTree: candidateTree(state.worktree),
        fingerprint: findingSetFingerprint(a.actionable),
        files: findingFiles(a.actionable),
        relevantChange: isRelevantChange({ findingFiles: remediatingFiles, changedFiles: files }),
        detail: a.action === 'REMEDIATE' ? `${a.actionable.length} actionable finding${a.actionable.length === 1 ? '' : 's'}` : 'no actionable findings',
      });

      state.phase = 'REVIEW'; state.findings = []; persistRunState(state);
      t.emit('review.started', { candidate_sha: state.candidateSha, round });
      const reviewerScope = `Only blocker/major/minor findings may demand a change in the CURRENT task and must map to its stated exit/negative criteria or a current correctness, regression or security defect that is actionable within allowedWrite. Future-slice risks, optional hardening, portability outside the supported environment, reminders for later slices, and inability to execute supervisor-owned gates are severity note only. The supervisor has already executed task.gates mechanically; inability to rerun them in reviewer plan mode is not a gate failure.`;
      const r = await runRole({ role: 'reviewer', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nIndependently review candidate ${state.candidateSha} against base ${state.baseSha}. Inspect git diff and tests. Do not edit.\n\n${reviewerScope}`, model: config.models.reviewer });
      state.sessions.reviewer = r.sessionId;
      const rd = reviewDisposition(r.result, 'reviewer');
      state.advisoryFindings = mergeAdvisories(state.advisoryFindings, rd.advisories);
      state.findings = rd.actionable; persistRunState(state);
      t.emit(rd.action === 'REMEDIATE' ? 'review.findings' : rd.advisories.length ? 'review.passed_with_advisories' : 'review.passed', { session_id: r.sessionId, outcome: r.result.outcome, findings: r.result.findings.length, actionable: rd.actionable, advisories: rd.advisories, round });
      if (rd.action === 'BLOCK') throw new Error(`reviewer blocked: ${r.result.summary}`);
      // Advisories are excluded by construction: only the ACTIONABLE set is ever fingerprinted, so
      // notes can accumulate forever without ever producing a breaker verdict.
      recordProgress(reviewProgressRecord({ round, source: 'reviewer', actionable: rd.actionable, action: rd.action }));
      if (rd.action === 'REMEDIATE') { state.attempt = nextRoundAfterRemediation(round); persistRunState(state); continue; }

      if (state.task.visualReview) {
        state.phase = 'VISUAL_REVIEW'; persistRunState(state); t.emit('visual.started', { round });
        const outDir = path.join(state.worktree, '.claude-loop', 'evidence', state.runId, `round-${round}`);
        const capture = await captureVisualEvidence(state.task, state.worktree, outDir);
        try {
          const promptV = `${basePrompt(state.task)}\n\nReview these screenshots and the candidate read-only. Files:\n${capture.files.join('\n')}`;
          const v = await runRole({ role: 'visual-reviewer', cwd: state.worktree, prompt: promptV, model: config.models.visualReviewer });
          state.sessions.visualReviewer = v.sessionId;
          const vd = reviewDisposition(v.result, 'visual-reviewer');
          state.advisoryFindings = mergeAdvisories(state.advisoryFindings, vd.advisories);
          state.findings = vd.actionable; persistRunState(state);
          t.emit(vd.action === 'REMEDIATE' ? 'visual.findings' : vd.advisories.length ? 'visual.passed_with_advisories' : 'visual.passed', { session_id: v.sessionId, outcome: v.result.outcome, findings: v.result.findings.length, actionable: vd.actionable, advisories: vd.advisories, round });
          if (vd.action === 'BLOCK') throw new Error(`visual reviewer blocked: ${v.result.summary}`);
          // Visual findings drive exactly the same progress semantics as reviewer findings.
          recordProgress(reviewProgressRecord({ round, source: 'visual-reviewer', actionable: vd.actionable, action: vd.action }));
          if (vd.action === 'REMEDIATE') { state.attempt = nextRoundAfterRemediation(round); persistRunState(state); continue; }
        } finally { capture.stop(); }
      }

      const finalGates = await runGates(state.task.gates, state.worktree);
      if (!finalGates.ok) {
        state.findings = finalGates.failures.map((g,i) => ({ id:`final-gate-${i+1}`, severity:'major' as const, message:`${g.command.join(' ')} failed\n${g.output}` }));
        state.attempt = nextRoundAfterRemediation(round); persistRunState(state);
        recordProgress({
          round,
          source: 'gates',
          kind: 'findings',
          candidateSha: state.candidateSha,
          candidateTree: candidateTree(state.worktree),
          fingerprint: gateFailureSetFingerprint(finalGates.failures),
          files: [],
          relevantChange: isRelevantChange({ findingFiles: remediatingFiles, changedFiles: files }),
          detail: `final ${finalGates.failures.map((g) => g.command.join(' ')).join(' ; ')}`,
        });
        continue;
      }
      if (!clean(state.worktree)) throw new Error('worktree dirty after final candidate/gates');

      if (config.publish.enabled) {
        state.phase = 'PUBLISH'; persistRunState(state); t.emit('publication.started', { candidate_sha: state.candidateSha });
        const p = publish({ repo, worktree: state.worktree, branch: state.branch, baseSha: state.baseSha, candidateSha: state.candidateSha!, taskId: state.task.id, autoMerge: config.publish.autoMerge, mergeMethod: config.publish.mergeMethod });
        state.prUrl = p.prUrl; t.emit(p.mergedMain ? 'publication.completed' : 'pr.created', { pr: p.prUrl, main: p.mergedMain ?? null, merge_method: config.publish.mergeMethod, merge_sha: p.mergeSha ?? null });
      }
      const completed = completeRunState(state);
      persistRunState(completed); t.emit('run.completed', { task: completed.task.id, candidate_sha: completed.candidateSha, pr: completed.prUrl, advisory_findings: completed.advisoryFindings });
      return completed;
    }
  } catch (e) {
    state.phase = 'BLOCKED'; state.blockedReason = e instanceof Error ? e.message : String(e);
    if (e instanceof ClaimLostError) {
      // Taken over mid-run: this supervisor is no longer the owner, so it records the fact in its
      // own telemetry and writes NOTHING into a run state another supervisor now owns.
      t.emit('run.claim_lost', { reason: state.blockedReason });
      throw e;
    }
    // A plain saveState, deliberately: a heartbeat failure at this moment must not mask the real
    // blocking error that is about to be rethrown.
    saveState(repo, state); t.emit('run.blocked', { reason: state.blockedReason });
    throw e;
  }
}
