import fs from 'node:fs';
import path from 'node:path';
import { git, gitRun, repoRoot } from './util';
import { type FactoryConfig, type RunState, type TaskSpec } from './schemas';
import { loadConfig, startRunFromTask, supervisorAuthoritySelection, type RunHeartbeat } from './supervisor';
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
  CLAIM_KEY_PATTERN,
  ClaimLostError,
  acquireClaim,
  claimHeartbeatAgeSeconds,
  currentClaim,
  heartbeatClaim,
  heartbeatIntervalMs,
  isClaimStale,
  listClaims,
  ownerToken,
  recoverStaleClaims,
  releaseClaim,
  type ClaimRecord,
  type ClaimScope,
  type ClaimSummary,
  type HeartbeatResult,
} from './claims';
import { isTerminalRunPhase, listRunStates, loadState, saveState } from './state';
import {
  clearLedgerEntry,
  findEntry,
  ledgerCompletedIds,
  ledgerOccupiedIds,
  loadLedger,
  writeLedgerEntry,
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
  | 'CLAIM_LOST'
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
  /** Writes exactly ONE task's ledger entry. There is deliberately no whole-ledger write here. */
  writeEntry: (entry: LedgerEntry) => void;
  acquire: (a: { key: string; owner: string; ttlSeconds: number; nowMs: number }) => ReturnType<typeof acquireClaim>;
  release: (a: { claim: ClaimRecord; nowMs: number; note: string }) => void;
  /** Refreshes a held claim. The scheduler beats on a ticker and at every checkpoint. */
  heartbeat: (a: { claim: ClaimRecord; nowMs: number }) => HeartbeatResult;
  startRun: (a: { task: TaskSpec; authorityClass: AuthorityClass; baseSha: string; heartbeat: RunHeartbeat }) => Promise<RunState>;
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
    writeEntry: (entry) => { writeLedgerEntry(repo, entry); },
    acquire: (a) => acquireClaim({ repo, scope: 'task', key: a.key, owner: a.owner, nowMs: a.nowMs, ttlSeconds: a.ttlSeconds }),
    release: (a) => { releaseClaim({ repo, claim: a.claim, nowMs: a.nowMs, note: a.note }); },
    heartbeat: (a) => heartbeatClaim({ repo, claim: a.claim, nowMs: a.nowMs }),
    startRun: (a) => startRunFromTask({ repo, config, task: a.task, authorityClass: a.authorityClass, heartbeat: a.heartbeat }),
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
 * Keeps a held task claim alive across a whole run, and turns a lost claim into a hard stop.
 *
 * The ticker refreshes several times inside every TTL so a long but perfectly healthy run is never
 * mistaken for an abandoned one by `claude:autopilot-recover`. `checkpoint` is handed to the
 * supervisor, which calls it at every phase transition and state write, so a supervisor that WAS
 * taken over stops instead of continuing to write.
 */
function claimKeepalive(args: { deps: AutopilotDeps; claim: ClaimRecord; ttlSeconds: number }): { checkpoint: RunHeartbeat; stop: () => void; lost: () => ClaimRecord | null } {
  let lost: ClaimRecord | null = null;
  let observedLoss = false;
  const beat = (): void => {
    if (observedLoss) return;
    const result = args.deps.heartbeat({ claim: args.claim, nowMs: args.deps.now() });
    if (result.ok) return;
    observedLoss = true;
    lost = result.current;
    args.deps.emit('autopilot.claim_lost', { task: args.claim.key, epoch: args.claim.epoch, current_owner: result.current?.owner ?? null });
  };
  const timer = setInterval(beat, heartbeatIntervalMs(args.ttlSeconds));
  timer.unref?.();
  return {
    checkpoint: () => {
      beat();
      if (observedLoss) throw new ClaimLostError(args.claim.scope, args.claim.key, args.claim.epoch, lost);
    },
    stop: () => clearInterval(timer),
    lost: () => lost,
  };
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

  /**
   * The single exit point of a pass, as an OBSERVABLE event.
   *
   * The stop reason was already returned to the caller, but the event stream — the thing an
   * observer or a `watch-ready` caller consumes — carried nothing at all when a pass simply ran out
   * of work. `autopilot.no_ready_work` is that missing marker: it states, mechanically, that a pass
   * ended with zero READY slices and how many it completed on the way there. It is telemetry only:
   * no scheduling decision is taken, deferred or repeated here.
   */
  const finish = (result: AutopilotResult): AutopilotResult => {
    if (result.stopReason === 'IDLE') {
      deps.emit('autopilot.no_ready_work', {
        completed_this_pass: result.started.length,
        waiting: result.evaluations.filter((e) => e.status === 'WAITING').length,
        ready: result.evaluations.filter((e) => e.status === 'READY').length,
        detail: result.detail,
      });
    }
    deps.emit('autopilot.stopped', { stop_reason: result.stopReason, detail: result.detail, completed_this_pass: result.started.length });
    return result;
  };

  // Checked before anything is fetched or claimed: a disarmed autopilot touches nothing at all.
  if (!config.autopilot.enabled && !args.force) {
    const snapshot = evaluateNow({ deps, selection });
    return finish({ stopReason: 'DISABLED', detail: 'autopilot.enabled=false; run with --force for a single explicit operator-driven pass', started, evaluations: snapshot.evaluations, base: null });
  }

  let base = deps.originMain();

  /**
   * Records ONE task's ledger entry.
   *
   * Every write is a fresh, narrow write of the exact key this supervisor holds the claim for.
   * Nothing is ever rewritten from the iteration's snapshot, so a supervisor in another worktree
   * cannot have its entries — least of all a `DONE` record, which is what keeps merged work from
   * being scheduled again — dropped by this one.
   */
  const record = (fields: Omit<LedgerEntry, 'updatedAt'>): LedgerEntry => {
    const written = entry(fields, deps.now());
    deps.writeEntry(written);
    return written;
  };

  for (let i = 0; i < config.autopilot.maxTasks; i++) {
    const snapshot = evaluateNow({ deps, selection });
    evaluations = snapshot.evaluations;

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
      return finish({ stopReason: skipped.size ? 'CLAIM_UNAVAILABLE' : 'IDLE', detail, started, evaluations, base });
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

    record({ taskId: item.id, status: 'RUNNING', runId: null, baseSha: base, candidateSha: null, mergedMain: null, reason: 'claimed and started' });
    deps.emit('autopilot.task_started', { task: item.id, base, authority_class: authorityClass, fixture_only: item.fixtureOnly });

    // The claim stays alive for the WHOLE run: on a ticker inside the process, and at every
    // supervisor checkpoint. Without it a run longer than claimTtlSeconds would look abandoned to
    // `claude:autopilot-recover`, which would then release a live claim and record the false
    // statement that the run was not completed.
    const keepalive = claimKeepalive({ deps, claim: claimed.claim, ttlSeconds: config.autopilot.claimTtlSeconds });
    let state: RunState | null = null;
    let failure: Error | null = null;
    try {
      state = await deps.startRun({ task, authorityClass, baseSha: base, heartbeat: keepalive.checkpoint });
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    } finally {
      keepalive.stop();
    }

    if (failure instanceof ClaimLostError) {
      // Taken over while running: this supervisor no longer owns the slice, so it must not write
      // the ledger entry for it either. The owner that holds the claim decides the outcome.
      deps.emit('autopilot.task_abandoned', { task: item.id, reason: failure.message });
      return finish({ stopReason: 'CLAIM_LOST', detail: failure.message, started, evaluations, base });
    }

    if (failure || !state || state.phase !== 'DONE') {
      const reason = failure ? failure.message : `run ended in phase ${state?.phase ?? 'UNKNOWN'}: ${state?.blockedReason ?? 'unknown reason'}`;
      record({ taskId: item.id, status: 'BLOCKED', runId: state?.runId ?? null, baseSha: base, candidateSha: state?.candidateSha ?? null, mergedMain: null, reason });
      deps.release({ claim: claimed.claim, nowMs: deps.now(), note: 'released after blocked run' });
      started.push({ taskId: item.id, runId: state?.runId ?? null, baseSha: base, status: 'BLOCKED', candidateSha: state?.candidateSha ?? null, mergedMain: null, reason });
      deps.emit('autopilot.task_blocked', { task: item.id, reason });
      // A blocked slice — including an exhausted remediation budget — stops the autopilot. The
      // budget is never widened by scheduling; that requires an explicit owner extension.
      return finish({ stopReason: 'RUN_BLOCKED', detail: `${item.id} blocked: ${reason}`, started, evaluations, base });
    }

    const mainAfter = deps.originMain();
    const merged = mainAfter !== base && !!state.candidateSha && deps.isMergeOfCandidate({ mergeSha: mainAfter, baseSha: base, candidateSha: state.candidateSha });

    if (mainAfter !== base && !merged) {
      // BASE DRIFT: origin/main moved to something that is not this candidate's merge. The
      // completed candidate was reviewed against a base that is no longer current, so continuing
      // would build the next slice on an unreviewed combination. Stop; never publish, never move
      // main, never rewrite the candidate.
      const reason = `base drift: origin/main moved from ${base} to ${mainAfter} during ${item.id}; the reviewed candidate ${state.candidateSha ?? '-'} is not that commit's merge`;
      record({ taskId: item.id, status: 'BLOCKED', runId: state.runId, baseSha: base, candidateSha: state.candidateSha, mergedMain: null, reason });
      deps.release({ claim: claimed.claim, nowMs: deps.now(), note: 'released after base drift' });
      started.push({ taskId: item.id, runId: state.runId, baseSha: base, status: 'BLOCKED', candidateSha: state.candidateSha, mergedMain: null, reason });
      deps.emit('autopilot.base_drift', { task: item.id, expected: base, actual: mainAfter, candidate_sha: state.candidateSha });
      return finish({ stopReason: 'BASE_DRIFT', detail: reason, started, evaluations, base: mainAfter });
    }

    const status: LedgerEntry['status'] = merged ? 'DONE' : 'AWAITING_PUBLICATION';
    const reason = merged
      ? `merged into main as ${mainAfter}`
      : 'candidate complete and independently reviewed; main is unchanged because publication is not armed';
    record({ taskId: item.id, status, runId: state.runId, baseSha: base, candidateSha: state.candidateSha, mergedMain: merged ? mainAfter : null, reason });
    deps.release({ claim: claimed.claim, nowMs: deps.now(), note: `released after ${status}` });
    started.push({ taskId: item.id, runId: state.runId, baseSha: base, status, candidateSha: state.candidateSha, mergedMain: merged ? mainAfter : null, reason });
    deps.emit('autopilot.task_completed', { task: item.id, status, candidate_sha: state.candidateSha, merged_main: merged ? mainAfter : null });

    if (!merged) {
      // CONTINUE-AFTER-MERGE, negative case: the work is not in main, so any later slice would be
      // built on a base that lacks it. Later slices that do not depend on this one stay selectable
      // on the next invocation; this invocation stops rather than silently stacking candidates.
      return finish({ stopReason: 'AWAITING_PUBLICATION', detail: `${item.id} produced candidate ${state.candidateSha ?? '-'} and is awaiting operator publication; main was not moved`, started, evaluations, base });
    }
    if (!config.autopilot.continueAfterMerge) {
      return finish({ stopReason: 'CONTINUE_AFTER_MERGE_DISABLED', detail: `${item.id} merged as ${mainAfter}; autopilot.continueAfterMerge=false`, started, evaluations, base: mainAfter });
    }
    // CONTINUE-AFTER-MERGE, positive case: the reviewed candidate really is main now, proven from
    // Git parents, so the next slice legitimately builds on it.
    base = mainAfter;
    deps.emit('autopilot.continue_after_merge', { task: item.id, next_base: base });
  }

  return finish({ stopReason: 'MAX_TASKS', detail: `reached autopilot.maxTasks=${config.autopilot.maxTasks}`, started, evaluations, base });
}

/* ------------------------------------------------------------------ stale-run classification */

/**
 * What the persisted evidence says about the process that owns a run.
 *
 * `LIVE`      — a claim covering this run is HELD and still beating inside its TTL.
 * `LOST`      — a claim covering it is HELD but stopped beating: the TTL contract says the owner is
 *               gone, which is the same proof `recoverStaleClaims` has always used.
 * `UNPROVEN`  — no claim covers it (or only a RELEASED one). Nothing on disk proves either liveness
 *               or death, so recovery fails closed and touches it only when an operator names it.
 * `UNREADABLE`— the run state does not parse. It is reported, never written over.
 */
export type RunLiveness = 'LIVE' | 'LOST' | 'UNPROVEN' | 'UNREADABLE';

export type RunOwnership = {
  runId: string;
  taskId: string | null;
  phase: string | null;
  /** True for `DONE`/`BLOCKED`: there is no interrupted work to recover. */
  terminal: boolean;
  liveness: RunLiveness;
  /** Age of the heartbeat of the claim the verdict came from, or `null` when there is none. */
  heartbeatAgeSeconds: number | null;
  claim: { scope: ClaimScope; key: string; owner: string; epoch: number; state: ClaimRecord['state'] } | null;
  evidence: string;
  error: string | null;
};

/**
 * Every claim that can speak for a run: the run's own claim, and the task claim of the slice it
 * belongs to (the autopilot holds THAT one for the whole run it started).
 */
function claimsCoveringRun(repo: string, runId: string, taskId: string | null): ClaimRecord[] {
  const found: ClaimRecord[] = [];
  const keys: Array<{ scope: ClaimScope; key: string }> = [{ scope: 'run', key: runId }];
  if (taskId) keys.push({ scope: 'task', key: taskId });
  for (const { scope, key } of keys) {
    if (!CLAIM_KEY_PATTERN.test(key)) continue;
    const claim = currentClaim(repo, scope, key);
    if (claim) found.push(claim);
  }
  return found;
}

/**
 * Classifies every persisted run against the claims covering it. A pure read: no claim is taken,
 * refreshed or released here, and no run state is written.
 *
 * The bias is deliberate and one-directional: ANY live claim covering a run makes it `LIVE`, even
 * when another covering claim went stale, because the cost of misreading a working supervisor as
 * dead is a demoted live run, and the cost of misreading a dead one as live is only that an
 * operator has to say so explicitly.
 */
export function classifyRuns(args: { repo: string; nowMs: number }): RunOwnership[] {
  const out: RunOwnership[] = [];
  for (const run of listRunStates(args.repo)) {
    if (!run.state) {
      out.push({ runId: run.runId, taskId: null, phase: null, terminal: false, liveness: 'UNREADABLE', heartbeatAgeSeconds: null, claim: null, evidence: 'run state does not parse', error: run.error });
      continue;
    }
    const taskId = run.state.task.id;
    const covering = claimsCoveringRun(args.repo, run.runId, taskId);
    const held = covering.filter((c) => c.state === 'HELD');
    const live = held.find((c) => !isClaimStale(c, args.nowMs)) ?? null;
    const stale = held.find((c) => isClaimStale(c, args.nowMs)) ?? null;
    const source = live ?? stale ?? covering[0] ?? null;
    const age = source ? claimHeartbeatAgeSeconds(source, args.nowMs) : null;
    const liveness: RunLiveness = live ? 'LIVE' : stale ? 'LOST' : 'UNPROVEN';
    const evidence = live
      ? `claim ${live.scope}/${live.key} epoch ${live.epoch} owned by ${live.owner} beat ${age ?? '?'}s ago, inside its ${live.ttlSeconds}s TTL`
      : stale
        ? `claim ${stale.scope}/${stale.key} epoch ${stale.epoch} owned by ${stale.owner} last beat ${age ?? '?'}s ago, beyond its ${stale.ttlSeconds}s TTL`
        : covering.length
          ? 'every claim covering this run is released; no process holds it'
          : 'no claim covers this run, so nothing on disk proves it is alive or dead';
    out.push({
      runId: run.runId,
      taskId,
      phase: run.state.phase,
      terminal: isTerminalRunPhase(run.state.phase),
      liveness,
      heartbeatAgeSeconds: age,
      claim: source ? { scope: source.scope, key: source.key, owner: source.owner, epoch: source.epoch, state: source.state } : null,
      evidence,
      error: null,
    });
  }
  return out;
}

/** Non-terminal runs: the ones an operator has to be able to tell apart mechanically. */
export function unfinishedRuns(runs: readonly RunOwnership[]): RunOwnership[] {
  return runs.filter((r) => !r.terminal);
}

export type AutopilotStatus = {
  base: string | null;
  evaluations: ItemEvaluation[];
  ledger: Ledger;
  claims: ClaimSummary[];
  runs: RunOwnership[];
};

export function autopilotStatus(args: { repo: string; deps: AutopilotDeps; selection: AuthoritySelection; nowMs: number }): AutopilotStatus {
  const { evaluations, ledger } = evaluateNow({ deps: args.deps, selection: args.selection });
  let base: string | null = null;
  try { base = args.deps.originMain(); } catch { base = null; }
  return { base, evaluations, ledger, claims: listClaims(args.repo, args.nowMs), runs: classifyRuns({ repo: args.repo, nowMs: args.nowMs }) };
}

/** Stable prefix of the blocked reason written by process-death recovery. */
export const SUPERVISOR_LOST_BLOCK_PREFIX = 'supervisor process lost (recovered)';

export function supervisorLostBlockedReason(evidence: string): string {
  return `${SUPERVISOR_LOST_BLOCK_PREFIX}: ${evidence}; the run was NOT completed, its worktree and candidate are preserved, and continuing it requires the ordinary resume path`;
}

export type RunRecoveryUpdate = {
  runId: string;
  taskId: string | null;
  from: string;
  to: 'BLOCKED';
  reason: string;
  /** `stale-claim` recovered itself; `operator` was named explicitly on the command line. */
  trigger: 'stale-claim' | 'operator';
};

export type AutopilotRecovery = {
  recoveredClaims: ClaimSummary[];
  ledgerUpdates: Array<{ taskId: string; from: LedgerEntry['status']; to: LedgerEntry['status'] | 'CLEARED'; reason: string }>;
  /** Non-terminal run states demoted to BLOCKED because their supervisor process is provably gone. */
  runUpdates: RunRecoveryUpdate[];
  /**
   * Non-terminal runs left untouched: nothing proved their process is gone (`UNPROVEN`), or their
   * state does not parse (`UNREADABLE`). They are reported so an operator can act on evidence.
   */
  unprovenRuns: RunOwnership[];
};

/**
 * Operator recovery.
 *
 * Releases only STALE claims, demotes the RUNNING ledger entries they abandoned to BLOCKED, and
 * demotes the non-terminal RUN STATES whose supervisor process is provably gone. Recovery never
 * invents an outcome: an abandoned run is not "done", its worktree, branch, candidate commits and
 * append-only progress history are left exactly as they are, and re-scheduling the SLICE still
 * requires the operator to clear its ledger entry deliberately with `--clear <taskId>`.
 *
 * Runs with no liveness evidence at all — a `claude:run` started before run claims existed, for
 * instance — are reported as `unprovenRuns` and touched only when the operator names them with
 * `recoverRunIds`. A named run whose claim is still beating is REFUSED before anything is written.
 */
export function autopilotRecover(args: { repo: string; nowMs: number; owner?: string; clearTaskIds?: readonly string[]; recoverRunIds?: readonly string[] }): AutopilotRecovery {
  const owner = args.owner ?? ownerToken('recover');

  // Classified BEFORE any claim is released, because releasing a stale claim is itself what erases
  // the evidence that the run was abandoned.
  const runs = classifyRuns({ repo: args.repo, nowMs: args.nowMs });
  const byRunId = new Map(runs.map((r) => [r.runId, r]));
  const named = [...new Set(args.recoverRunIds ?? [])];
  // Every explicit id is validated before ANY mutation, so a refusal leaves the whole sweep undone
  // rather than half applied.
  for (const runId of named) {
    const run = byRunId.get(runId);
    if (!run) throw new Error(`no persisted run state for ${runId}; recovery never invents a run`);
    if (run.liveness === 'UNREADABLE') throw new Error(`refusing to recover ${runId}: its run state does not parse (${run.error ?? 'unknown parse failure'})`);
    if (run.liveness === 'LIVE') throw new Error(`refusing to recover ${runId}: ${run.evidence}; a live supervisor is never declared lost`);
    if (run.terminal) throw new Error(`refusing to recover ${runId}: it is already terminal in phase ${run.phase}; recovery never re-opens a finished run`);
  }

  // Only claims whose HEARTBEAT has expired are recovered. A live run keeps beating, so recovery
  // never touches it and never records the false claim that it was abandoned.
  const recoveredClaims = recoverStaleClaims({ repo: args.repo, nowMs: args.nowMs, owner });
  const ledgerUpdates: AutopilotRecovery['ledgerUpdates'] = [];

  for (const recovered of recoveredClaims) {
    if (recovered.scope !== 'task') continue;
    // Re-read per key: recovery must not rewrite entries it does not own either.
    const existing = findEntry(loadLedger(args.repo), recovered.key);
    if (!existing || existing.status !== 'RUNNING') continue;
    const reason = `stale claim recovered from ${recovered.claim.owner}; the run stopped heartbeating and was NOT completed`;
    writeLedgerEntry(args.repo, { ...existing, status: 'BLOCKED', reason, updatedAt: new Date(args.nowMs).toISOString() });
    ledgerUpdates.push({ taskId: recovered.key, from: 'RUNNING', to: 'BLOCKED', reason });
  }

  for (const taskId of args.clearTaskIds ?? []) {
    const existing = findEntry(loadLedger(args.repo), taskId);
    if (!existing) continue;
    if (existing.status === 'DONE') throw new Error(`refusing to clear completed ledger entry ${taskId}; completion is evidence, not scheduling state`);
    clearLedgerEntry(args.repo, taskId);
    ledgerUpdates.push({ taskId, from: existing.status, to: 'CLEARED', reason: 'explicitly cleared by operator' });
  }

  /**
   * PROCESS-DEATH RECOVERY of the run state itself.
   *
   * A supervisor killed mid-phase leaves `state.json` in a non-terminal phase forever: nothing else
   * ever writes it, because the process that would have is gone. The demotion writes exactly two
   * fields — `phase` and `blockedReason` — on a state re-read from disk, so the append-only
   * `progressHistory`, the recorded sessions, the candidate SHA, the branch and the worktree all
   * survive byte-identically and the ordinary resume path can continue the run.
   */
  const runUpdates: RunRecoveryUpdate[] = [];
  /** Runs this call has finished reasoning about: written, or already terminal on re-read. */
  const settled = new Set<string>();
  const demote = (run: RunOwnership, trigger: RunRecoveryUpdate['trigger']): void => {
    // Re-read per run: recovery must never write a state from a snapshot, and a run that reached a
    // terminal phase between classification and now is left exactly as its own supervisor left it.
    const fresh = loadState(args.repo, run.runId);
    settled.add(run.runId);
    if (isTerminalRunPhase(fresh.phase)) return;
    const reason = supervisorLostBlockedReason(trigger === 'operator' ? `${run.evidence}; recovered on explicit operator instruction` : run.evidence);
    saveState(args.repo, { ...fresh, phase: 'BLOCKED', blockedReason: reason });
    runUpdates.push({ runId: run.runId, taskId: run.taskId, from: fresh.phase, to: 'BLOCKED', reason, trigger });
  };

  for (const run of runs) {
    if (run.terminal || run.liveness !== 'LOST') continue;
    demote(run, 'stale-claim');
  }
  for (const runId of named) {
    if (settled.has(runId)) continue;
    demote(byRunId.get(runId)!, 'operator');
  }

  const unprovenRuns = runs.filter((r) => !r.terminal && r.liveness !== 'LIVE' && !settled.has(r.runId));

  return { recoveredClaims, ledgerUpdates, runUpdates, unprovenRuns };
}

/* ------------------------------------------------------------------------ wakeup primitive */

export type WatchWakeReason = 'READY' | 'RUN_TERMINAL' | 'TIMEOUT';

/** One observation of the canonical backlog plus, optionally, the phase of one watched run. */
export type WatchPoll = { readyIds: readonly string[]; watchedRunPhase: string | null };

export type WatchResult = {
  wake: WatchWakeReason;
  readyIds: string[];
  watchedRunId: string | null;
  watchedRunPhase: string | null;
  polls: number;
  waitedMs: number;
};

/**
 * Blocks until there is something to wake up FOR, then exits. It is not a scheduler.
 *
 * The Factory has exactly one scheduler (`runAutopilot`) and exactly one canonical backlog, and this
 * function adds neither. It takes no claim, writes no state, starts no run, never chooses between
 * slices and never re-invokes anything: it OBSERVES the canonical evaluation the scheduler already
 * performs, and returns once a slice is READY (optionally: one named slice, which is the same thing
 * as "this slice's dependencies are now satisfied") or a watched run reaches a terminal phase. What
 * happens next is entirely the caller's decision — that is what keeps scheduling authority in one
 * place while still giving an operator or a later observer surface a single wake instead of a
 * hand-run poll.
 *
 * Every effect is injected, so the wait is deterministic in tests and bounded in production: the
 * timeout is mandatory, so a wakeup can never become an unattended daemon.
 */
export async function watchForReadyWork(args: {
  poll: () => WatchPoll;
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  intervalMs: number;
  timeoutMs: number;
  /** Wake only for this slice; without it, any READY slice wakes the caller. */
  taskId?: string | null;
  watchedRunId?: string | null;
  emit?: (event: string, fields: Record<string, unknown>) => void;
}): Promise<WatchResult> {
  if (!Number.isFinite(args.intervalMs) || args.intervalMs <= 0) throw new Error('watch interval must be a positive number of milliseconds');
  if (!Number.isFinite(args.timeoutMs) || args.timeoutMs <= 0) throw new Error('watch timeout must be a positive number of milliseconds');
  const start = args.now();
  let polls = 0;
  for (;;) {
    const snapshot = args.poll();
    polls += 1;
    const ready = [...snapshot.readyIds].filter((id) => !args.taskId || id === args.taskId);
    const waitedMs = args.now() - start;
    if (ready.length) {
      args.emit?.('watch.ready', { ready, polls, waited_ms: waitedMs, task: args.taskId ?? null });
      return { wake: 'READY', readyIds: ready, watchedRunId: args.watchedRunId ?? null, watchedRunPhase: snapshot.watchedRunPhase, polls, waitedMs };
    }
    if (args.watchedRunId && snapshot.watchedRunPhase && isTerminalRunPhase(snapshot.watchedRunPhase)) {
      args.emit?.('watch.run_terminal', { run: args.watchedRunId, phase: snapshot.watchedRunPhase, polls, waited_ms: waitedMs });
      return { wake: 'RUN_TERMINAL', readyIds: ready, watchedRunId: args.watchedRunId, watchedRunPhase: snapshot.watchedRunPhase, polls, waitedMs };
    }
    if (waitedMs >= args.timeoutMs) {
      args.emit?.('watch.timeout', { polls, waited_ms: waitedMs, task: args.taskId ?? null });
      return { wake: 'TIMEOUT', readyIds: ready, watchedRunId: args.watchedRunId ?? null, watchedRunPhase: snapshot.watchedRunPhase, polls, waitedMs };
    }
    await args.sleep(Math.min(args.intervalMs, args.timeoutMs - waitedMs));
  }
}

/** The production observation: the canonical backlog evaluation plus one optional run phase. */
export function watchPoller(args: { repo: string; deps: AutopilotDeps; selection: AuthoritySelection; watchedRunId?: string | null }): () => WatchPoll {
  return () => {
    const { evaluations } = evaluateNow({ deps: args.deps, selection: args.selection });
    let watchedRunPhase: string | null = null;
    if (args.watchedRunId) {
      // An unreadable or not-yet-written run state is UNKNOWN, never a terminal verdict.
      try { watchedRunPhase = loadState(args.repo, args.watchedRunId).phase; } catch { watchedRunPhase = null; }
    }
    return { readyIds: evaluations.filter((e) => e.status === 'READY').map((e) => e.id), watchedRunPhase };
  };
}

export function defaultAutopilotContext(cliOwnerAuthorTaskIds: readonly string[] = []): { repo: string; config: FactoryConfig; deps: AutopilotDeps; selection: AuthoritySelection } {
  const repo = repoRoot();
  const config = loadConfig(repo);
  return { repo, config, deps: productionAutopilotDeps(repo, config), selection: supervisorAuthoritySelection(config, cliOwnerAuthorTaskIds) };
}
