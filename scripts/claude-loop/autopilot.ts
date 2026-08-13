import fs from 'node:fs';
import path from 'node:path';
import { git, gitRun, repoRoot } from './util';
import { type FactoryConfig, type RunState, type TaskSpec } from './schemas';
import { loadConfig, startRunFromTask, supervisorAuthoritySelection } from './supervisor';
import { resolveAuthorityClass, type AuthorityClass, type AuthoritySelection } from './authority';
import {
  commandPrerequisiteRunner,
  evaluateBacklog,
  loadBacklog,
  loadExternalEvidence,
  materializeTask,
  selectNextItem,
  type Backlog,
  type EvaluationContext,
  type ExternalMeasurement,
  type ItemEvaluation,
} from './backlog';
import {
  acquireClaim,
  listClaims,
  ownerToken,
  recoverStaleClaims,
  releaseClaim,
  type ClaimRecord,
  type ClaimSummary,
} from './claims';
import {
  findEntry,
  ledgerCompletedIds,
  ledgerOccupiedIds,
  loadLedger,
  saveLedger,
  withEntry,
  withoutEntry,
  type Ledger,
  type LedgerEntry,
} from './ledger';

/**
 * The autopilot: a deterministic, restart-safe backlog scheduler.
 *
 * Every decision is a pure function of files that live under the tracked backlog and the Git common
 * directory: the canonical backlog, the owner-measured backend evidence, the claim epochs and the
 * ledger. Nothing is remembered in a model session, in chat context or in this process's heap
 * between iterations — each iteration re-reads state from disk, so a killed and restarted autopilot
 * makes exactly the same next decision instead of duplicating work.
 *
 * The autopilot never publishes and never moves `main`. Publication stays behind the unchanged
 * Publication v2 merge-only guards, and the scheduler only OBSERVES whether a merge already
 * happened before deciding whether the next slice may build on it.
 */
export type AutopilotStopReason =
  | 'IDLE'
  | 'MAX_TASKS'
  | 'DISABLED'
  | 'BASE_DRIFT'
  | 'RUN_BLOCKED'
  | 'AWAITING_PUBLICATION'
  | 'CONTINUE_AFTER_MERGE_DISABLED'
  | 'CLAIM_UNAVAILABLE';

export type AutopilotTaskOutcome = {
  taskId: string;
  runId: string | null;
  baseSha: string;
  status: LedgerEntry['status'];
  candidateSha: string | null;
  mergedMain: string | null;
  reason: string | null;
};

export type AutopilotResult = {
  stopReason: AutopilotStopReason;
  detail: string;
  started: AutopilotTaskOutcome[];
  evaluations: ItemEvaluation[];
  /** The base the pass worked from, or `null` when nothing was fetched because nothing ran. */
  base: string | null;
};

export type AutopilotDeps = {
  now: () => number;
  /** Current authoritative-for-this-repo base: freshly fetched `origin/main`. */
  originMain: () => string;
  /** True when `mergeSha` is a two-parent merge of `baseSha` + `candidateSha`. */
  isMergeOfCandidate: (a: { mergeSha: string; baseSha: string; candidateSha: string }) => boolean;
  loadBacklog: () => Backlog;
  externalEvidence: () => readonly ExternalMeasurement[];
  fileExists: (relativePath: string) => boolean;
  runPrerequisiteCommand: ((command: string[]) => boolean) | null;
  readLedger: () => Ledger;
  writeLedger: (ledger: Ledger) => void;
  acquire: (a: { key: string; owner: string; ttlSeconds: number; nowMs: number }) => ReturnType<typeof acquireClaim>;
  release: (a: { claim: ClaimRecord; nowMs: number; note: string }) => void;
  startRun: (a: { task: TaskSpec; authorityClass: AuthorityClass; baseSha: string }) => Promise<RunState>;
  emit: (event: string, fields: Record<string, unknown>) => void;
};

export function productionAutopilotDeps(repo: string, config: FactoryConfig): AutopilotDeps {
  return {
    now: () => Date.now(),
    originMain: () => { gitRun(repo, ['fetch', 'origin', 'main']); return git(repo, 'rev-parse', 'refs/remotes/origin/main'); },
    isMergeOfCandidate: ({ mergeSha, baseSha, candidateSha }) => {
      const parents = git(repo, 'rev-list', '--parents', '-n', '1', mergeSha).split(/\s+/).filter(Boolean).slice(1);
      return parents.length === 2 && parents[0] === baseSha && parents[1] === candidateSha;
    },
    loadBacklog: () => loadBacklog(repo),
    externalEvidence: () => loadExternalEvidence(repo),
    fileExists: (relativePath) => fs.existsSync(path.join(repo, relativePath)),
    runPrerequisiteCommand: commandPrerequisiteRunner(repo),
    readLedger: () => loadLedger(repo),
    writeLedger: (ledger) => saveLedger(repo, ledger),
    acquire: (a) => acquireClaim({ repo, scope: 'task', key: a.key, owner: a.owner, nowMs: a.nowMs, ttlSeconds: a.ttlSeconds }),
    release: (a) => { releaseClaim({ repo, claim: a.claim, nowMs: a.nowMs, note: a.note }); },
    startRun: (a) => startRunFromTask({ repo, config, task: a.task, authorityClass: a.authorityClass }),
    emit: (event, fields) => { process.stdout.write(`CLAUDE_FACTORY ${event}: ${Object.entries(fields).map(([k, v]) => `${k}=${typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}`).join(' ')}\n`); },
  };
}

function evaluationContext(args: { deps: AutopilotDeps; ledger: Ledger; selection: AuthoritySelection }): EvaluationContext {
  return {
    fileExists: args.deps.fileExists,
    runCommand: args.deps.runPrerequisiteCommand,
    externalEvidence: args.deps.externalEvidence(),
    ledgerCompleted: ledgerCompletedIds(args.ledger),
    ledgerOccupied: ledgerOccupiedIds(args.ledger),
    ownerAuthorSelection: args.selection,
  };
}

export function evaluateNow(args: { deps: AutopilotDeps; selection: AuthoritySelection }): { evaluations: ItemEvaluation[]; ledger: Ledger } {
  const ledger = args.deps.readLedger();
  const backlog = args.deps.loadBacklog();
  return { evaluations: evaluateBacklog(backlog, evaluationContext({ deps: args.deps, ledger, selection: args.selection })), ledger };
}

function entry(fields: Omit<LedgerEntry, 'updatedAt'>, nowMs: number): LedgerEntry {
  return { ...fields, updatedAt: new Date(nowMs).toISOString() };
}

/**
 * Runs the autopilot for at most `maxTasks` slices.
 *
 * The loop is intentionally boring and fail-closed:
 *
 * 1. Re-read `origin/main`, the backlog, the evidence and the ledger from disk.
 * 2. Pick the lowest-order READY slice (deterministic; no randomness, no recency, no model input).
 * 3. Take an atomic claim, or skip that slice — a live claim is never overridden.
 * 4. Record RUNNING in the ledger BEFORE the run starts, so a crash cannot look like "never ran".
 * 5. Run the ordinary supervised pipeline: architect → write role → exact scope → gates → immutable
 *    candidate → independent review → bounded remediation.
 * 6. Re-read `origin/main` and decide, mechanically, whether the next slice may continue.
 */
export async function runAutopilot(args: {
  config: FactoryConfig;
  deps: AutopilotDeps;
  selection: AuthoritySelection;
  owner?: string;
  force?: boolean;
}): Promise<AutopilotResult> {
  const { config, deps, selection } = args;
  const owner = args.owner ?? ownerToken();
  const started: AutopilotTaskOutcome[] = [];
  let evaluations: ItemEvaluation[] = [];

  // Checked before anything is fetched or claimed: a disarmed autopilot touches nothing at all.
  if (!config.autopilot.enabled && !args.force) {
    const snapshot = evaluateNow({ deps, selection });
    return { stopReason: 'DISABLED', detail: 'autopilot.enabled=false; run with --force for a single explicit operator-driven pass', started, evaluations: snapshot.evaluations, base: null };
  }

  let base = deps.originMain();

  for (let i = 0; i < config.autopilot.maxTasks; i++) {
    const snapshot = evaluateNow({ deps, selection });
    evaluations = snapshot.evaluations;
    let ledger = snapshot.ledger;

    const skipped = new Set<string>();
    let claimed: { claim: ClaimRecord; evaluation: ItemEvaluation } | null = null;
    for (;;) {
      const candidate = selectNextItem(evaluations, skipped);
      if (!candidate) break;
      const attempt = deps.acquire({ key: candidate.id, owner, ttlSeconds: config.autopilot.claimTtlSeconds, nowMs: deps.now() });
      if (attempt.ok) {
        if (attempt.recovered) deps.emit('autopilot.claim_recovered', { task: candidate.id, recovered_owner: attempt.recovered.owner, recovered_epoch: attempt.recovered.epoch });
        claimed = { claim: attempt.claim, evaluation: candidate };
        break;
      }
      deps.emit('autopilot.claim_refused', { task: candidate.id, reason: attempt.reason, owner: attempt.current?.owner ?? null });
      skipped.add(candidate.id);
    }

    if (!claimed) {
      const detail = skipped.size
        ? `every READY slice is claimed by another supervisor: ${[...skipped].join(', ')}`
        : `no READY slice: ${evaluations.filter((e) => e.status === 'WAITING').map((e) => `${e.id} (${e.reasons[0] ?? 'waiting'})`).join('; ') || 'backlog empty'}`;
      return { stopReason: skipped.size ? 'CLAIM_UNAVAILABLE' : 'IDLE', detail, started, evaluations, base };
    }

    const item = claimed.evaluation.item;
    let authorityClass: AuthorityClass;
    let task: TaskSpec;
    try {
      // The escalation guard runs INSIDE the claim, and a refusal releases the claim instead of
      // parking the slice until its TTL expires.
      authorityClass = resolveAuthorityClass({ taskId: item.id, declared: item.authorityClass, selection, source: 'tracked backlog' });
      task = materializeTask(item, { baseSha: base, authorityClass });
    } catch (error) {
      deps.release({ claim: claimed.claim, nowMs: deps.now(), note: 'released after refusing to materialize the task' });
      throw error;
    }

    ledger = withEntry(ledger, entry({ taskId: item.id, status: 'RUNNING', runId: null, baseSha: base, candidateSha: null, mergedMain: null, reason: 'claimed and started' }, deps.now()));
    deps.writeLedger(ledger);
    deps.emit('autopilot.task_started', { task: item.id, base, authority_class: authorityClass, fixture_only: item.fixtureOnly });

    let state: RunState | null = null;
    let failure: Error | null = null;
    try {
      state = await deps.startRun({ task, authorityClass, baseSha: base });
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    }

    if (failure || !state || state.phase !== 'DONE') {
      const reason = failure ? failure.message : `run ended in phase ${state?.phase ?? 'UNKNOWN'}: ${state?.blockedReason ?? 'unknown reason'}`;
      ledger = withEntry(ledger, entry({ taskId: item.id, status: 'BLOCKED', runId: state?.runId ?? null, baseSha: base, candidateSha: state?.candidateSha ?? null, mergedMain: null, reason }, deps.now()));
      deps.writeLedger(ledger);
      deps.release({ claim: claimed.claim, nowMs: deps.now(), note: 'released after blocked run' });
      started.push({ taskId: item.id, runId: state?.runId ?? null, baseSha: base, status: 'BLOCKED', candidateSha: state?.candidateSha ?? null, mergedMain: null, reason });
      deps.emit('autopilot.task_blocked', { task: item.id, reason });
      // A blocked slice — including an exhausted remediation budget — stops the autopilot. The
      // budget is never widened by scheduling; that requires an explicit owner extension.
      return { stopReason: 'RUN_BLOCKED', detail: `${item.id} blocked: ${reason}`, started, evaluations, base };
    }

    const mainAfter = deps.originMain();
    const merged = mainAfter !== base && !!state.candidateSha && deps.isMergeOfCandidate({ mergeSha: mainAfter, baseSha: base, candidateSha: state.candidateSha });

    if (mainAfter !== base && !merged) {
      // BASE DRIFT: origin/main moved to something that is not this candidate's merge. The
      // completed candidate was reviewed against a base that is no longer current, so continuing
      // would build the next slice on an unreviewed combination. Stop; never publish, never move
      // main, never rewrite the candidate.
      const reason = `base drift: origin/main moved from ${base} to ${mainAfter} during ${item.id}; the reviewed candidate ${state.candidateSha ?? '-'} is not that commit's merge`;
      ledger = withEntry(ledger, entry({ taskId: item.id, status: 'BLOCKED', runId: state.runId, baseSha: base, candidateSha: state.candidateSha, mergedMain: null, reason }, deps.now()));
      deps.writeLedger(ledger);
      deps.release({ claim: claimed.claim, nowMs: deps.now(), note: 'released after base drift' });
      started.push({ taskId: item.id, runId: state.runId, baseSha: base, status: 'BLOCKED', candidateSha: state.candidateSha, mergedMain: null, reason });
      deps.emit('autopilot.base_drift', { task: item.id, expected: base, actual: mainAfter, candidate_sha: state.candidateSha });
      return { stopReason: 'BASE_DRIFT', detail: reason, started, evaluations, base: mainAfter };
    }

    const status: LedgerEntry['status'] = merged ? 'DONE' : 'AWAITING_PUBLICATION';
    const reason = merged
      ? `merged into main as ${mainAfter}`
      : 'candidate complete and independently reviewed; main is unchanged because publication is not armed';
    ledger = withEntry(ledger, entry({ taskId: item.id, status, runId: state.runId, baseSha: base, candidateSha: state.candidateSha, mergedMain: merged ? mainAfter : null, reason }, deps.now()));
    deps.writeLedger(ledger);
    deps.release({ claim: claimed.claim, nowMs: deps.now(), note: `released after ${status}` });
    started.push({ taskId: item.id, runId: state.runId, baseSha: base, status, candidateSha: state.candidateSha, mergedMain: merged ? mainAfter : null, reason });
    deps.emit('autopilot.task_completed', { task: item.id, status, candidate_sha: state.candidateSha, merged_main: merged ? mainAfter : null });

    if (!merged) {
      // CONTINUE-AFTER-MERGE, negative case: the work is not in main, so any later slice would be
      // built on a base that lacks it. Later slices that do not depend on this one stay selectable
      // on the next invocation; this invocation stops rather than silently stacking candidates.
      return { stopReason: 'AWAITING_PUBLICATION', detail: `${item.id} produced candidate ${state.candidateSha ?? '-'} and is awaiting operator publication; main was not moved`, started, evaluations, base };
    }
    if (!config.autopilot.continueAfterMerge) {
      return { stopReason: 'CONTINUE_AFTER_MERGE_DISABLED', detail: `${item.id} merged as ${mainAfter}; autopilot.continueAfterMerge=false`, started, evaluations, base: mainAfter };
    }
    // CONTINUE-AFTER-MERGE, positive case: the reviewed candidate really is main now, proven from
    // Git parents, so the next slice legitimately builds on it.
    base = mainAfter;
    deps.emit('autopilot.continue_after_merge', { task: item.id, next_base: base });
  }

  return { stopReason: 'MAX_TASKS', detail: `reached autopilot.maxTasks=${config.autopilot.maxTasks}`, started, evaluations, base };
}

export type AutopilotStatus = {
  base: string | null;
  evaluations: ItemEvaluation[];
  ledger: Ledger;
  claims: ClaimSummary[];
};

export function autopilotStatus(args: { repo: string; deps: AutopilotDeps; selection: AuthoritySelection; nowMs: number }): AutopilotStatus {
  const { evaluations, ledger } = evaluateNow({ deps: args.deps, selection: args.selection });
  let base: string | null = null;
  try { base = args.deps.originMain(); } catch { base = null; }
  return { base, evaluations, ledger, claims: listClaims(args.repo, args.nowMs) };
}

export type AutopilotRecovery = {
  recoveredClaims: ClaimSummary[];
  ledgerUpdates: Array<{ taskId: string; from: LedgerEntry['status']; to: LedgerEntry['status'] | 'CLEARED'; reason: string }>;
};

/**
 * Operator recovery.
 *
 * Releases only STALE claims, and demotes the RUNNING ledger entries they abandoned to BLOCKED with
 * an explicit reason. Recovery never invents an outcome: an abandoned run is not "done", its
 * worktree and run state are preserved, and re-scheduling it requires the operator to clear the
 * entry deliberately with `--clear <taskId>` after inspecting the run.
 */
export function autopilotRecover(args: { repo: string; nowMs: number; owner?: string; clearTaskIds?: readonly string[] }): AutopilotRecovery {
  const owner = args.owner ?? ownerToken('recover');
  const recoveredClaims = recoverStaleClaims({ repo: args.repo, nowMs: args.nowMs, owner });
  let ledger = loadLedger(args.repo);
  const ledgerUpdates: AutopilotRecovery['ledgerUpdates'] = [];

  for (const recovered of recoveredClaims) {
    if (recovered.scope !== 'task') continue;
    const existing = findEntry(ledger, recovered.key);
    if (!existing || existing.status !== 'RUNNING') continue;
    const reason = `stale claim recovered from ${recovered.claim.owner}; the run was abandoned and was NOT completed`;
    ledger = withEntry(ledger, { ...existing, status: 'BLOCKED', reason, updatedAt: new Date(args.nowMs).toISOString() });
    ledgerUpdates.push({ taskId: recovered.key, from: 'RUNNING', to: 'BLOCKED', reason });
  }

  for (const taskId of args.clearTaskIds ?? []) {
    const existing = findEntry(ledger, taskId);
    if (!existing) continue;
    if (existing.status === 'DONE') throw new Error(`refusing to clear completed ledger entry ${taskId}; completion is evidence, not scheduling state`);
    ledger = withoutEntry(ledger, taskId);
    ledgerUpdates.push({ taskId, from: existing.status, to: 'CLEARED', reason: 'explicitly cleared by operator' });
  }

  saveLedger(args.repo, ledger);
  return { recoveredClaims, ledgerUpdates };
}

export function defaultAutopilotContext(cliOwnerAuthorTaskIds: readonly string[] = []): { repo: string; config: FactoryConfig; deps: AutopilotDeps; selection: AuthoritySelection } {
  const repo = repoRoot();
  const config = loadConfig(repo);
  return { repo, config, deps: productionAutopilotDeps(repo, config), selection: supervisorAuthoritySelection(config, cliOwnerAuthorTaskIds) };
}
