import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { commonGitDir, ensureDir, writeJson } from './util';

/**
 * Atomic task/run claims with stale recovery.
 *
 * ## Where claims live
 *
 * Under the Git COMMON directory only (`<common-git-dir>/claude-factory/claims/<scope>/<key>/`).
 * Every worktree of the same repository shares that directory, so two supervisors in two worktrees
 * see the same claims. Nothing about a claim ever lives in chat context, model prose or a
 * per-worktree file: a claim that only a model remembers is not a claim.
 *
 * ## Why claim identity is a FILE NAME
 *
 * One claim epoch is one file: `0000000001.json`, `0000000002.json`, … Creating that file with the
 * POSIX exclusive-create flag (`wx`) is the whole mutual exclusion: the kernel lets exactly one
 * process create a given name, so exactly one process can own a given epoch. There is no
 * read-then-write window, no lock file to leak, and every attempt — including a stale takeover —
 * leaves an append-only audit trail instead of overwriting the evidence of the previous owner.
 *
 * ## Staleness
 *
 * The current epoch is stale when its heartbeat is older than its TTL. Recovery is simply the next
 * epoch, taken by whichever process wins that one exclusive create; the loser sees a fresh claim
 * and refuses. A crashed supervisor therefore never blocks the backlog forever, and two supervisors
 * never both believe they recovered the same claim.
 */
export type ClaimScope = 'task' | 'run';

export const ClaimSchema = z.object({
  version: z.literal(1),
  scope: z.enum(['task', 'run']),
  key: z.string().min(1),
  epoch: z.number().int().positive(),
  owner: z.string().min(1),
  pid: z.number().int().nonnegative(),
  host: z.string(),
  runId: z.string().nullable().default(null),
  state: z.enum(['HELD', 'RELEASED']),
  acquiredAt: z.string(),
  heartbeatAt: z.string(),
  ttlSeconds: z.number().int().positive(),
  takeoverOf: z.object({ epoch: z.number().int().positive(), owner: z.string() }).nullable().default(null),
  note: z.string().nullable().default(null),
});
export type ClaimRecord = z.infer<typeof ClaimSchema>;

export const CLAIM_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function claimsRoot(repo: string): string {
  return path.join(commonGitDir(repo), 'claude-factory', 'claims');
}

export function claimDir(repo: string, scope: ClaimScope, key: string): string {
  if (!CLAIM_KEY_PATTERN.test(key)) throw new Error(`unsafe claim key '${key}'`);
  return path.join(claimsRoot(repo), scope, key);
}

function epochFile(dir: string, epoch: number): string {
  return path.join(dir, `${String(epoch).padStart(10, '0')}.json`);
}

/** Every epoch of one claim key, ordered by epoch. A corrupt epoch file is a hard failure. */
export function readClaimHistory(repo: string, scope: ClaimScope, key: string): ClaimRecord[] {
  const dir = claimDir(repo, scope, key);
  if (!fs.existsSync(dir)) return [];
  const records: ClaimRecord[] = [];
  for (const name of fs.readdirSync(dir).sort()) {
    if (!name.endsWith('.json')) continue;
    const raw = fs.readFileSync(path.join(dir, name), 'utf8');
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { throw new Error(`corrupt claim file ${path.join(dir, name)}`); }
    records.push(ClaimSchema.parse(parsed));
  }
  return records.sort((a, b) => a.epoch - b.epoch);
}

export function currentClaim(repo: string, scope: ClaimScope, key: string): ClaimRecord | null {
  const history = readClaimHistory(repo, scope, key);
  return history.length ? history[history.length - 1] : null;
}

export function isClaimStale(claim: ClaimRecord, nowMs: number): boolean {
  if (claim.state !== 'HELD') return false;
  const beat = Date.parse(claim.heartbeatAt);
  if (!Number.isFinite(beat)) return true;
  return nowMs - beat > claim.ttlSeconds * 1000;
}

/**
 * How long ago this claim last beat, in whole seconds, or `null` when its heartbeat is unreadable.
 *
 * A pure read of the recorded heartbeat. It is the number an operator (or a later observer surface)
 * needs to tell a long live run from an abandoned one MECHANICALLY, instead of by opening claim
 * files by hand. It answers nothing on its own: `isClaimStale` remains the only staleness verdict,
 * and this helper never widens, refreshes or weakens a claim.
 */
export function claimHeartbeatAgeSeconds(claim: ClaimRecord, nowMs: number): number | null {
  const beat = Date.parse(claim.heartbeatAt);
  if (!Number.isFinite(beat)) return null;
  return Math.floor((nowMs - beat) / 1000);
}

/** True only while this exact epoch is still the newest one: the owner has not been taken over. */
export function claimIsCurrent(repo: string, claim: ClaimRecord): boolean {
  const now = currentClaim(repo, claim.scope, claim.key);
  return !!now && now.epoch === claim.epoch && now.owner === claim.owner && now.state === 'HELD';
}

function writeNewEpoch(file: string, record: ClaimRecord): boolean {
  ensureDir(path.dirname(file));
  let fd: number;
  try {
    fd = fs.openSync(file, 'wx', 0o600);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
  try { fs.writeFileSync(fd, JSON.stringify(record, null, 2) + '\n'); } finally { fs.closeSync(fd); }
  return true;
}

export type AcquireArgs = {
  repo: string;
  scope: ClaimScope;
  key: string;
  owner: string;
  nowMs: number;
  ttlSeconds: number;
  runId?: string | null;
  note?: string | null;
};

export type AcquireResult =
  | { ok: true; claim: ClaimRecord; recovered: ClaimRecord | null }
  | { ok: false; reason: 'HELD' | 'RACE_LOST'; current: ClaimRecord | null };

/**
 * Takes the claim for `key`, or fails closed.
 *
 * `HELD`      — a live, non-stale owner exists. Never overridden, at any age below the TTL.
 * `RACE_LOST` — another process created the same next epoch first. The caller must NOT retry
 *               blindly; the backlog scheduler simply moves to the next deterministic candidate.
 */
export function acquireClaim(args: AcquireArgs): AcquireResult {
  const dir = claimDir(args.repo, args.scope, args.key);
  const current = currentClaim(args.repo, args.scope, args.key);
  const stale = current ? isClaimStale(current, args.nowMs) : false;
  if (current && current.state === 'HELD' && !stale) return { ok: false, reason: 'HELD', current };

  const epoch = current ? current.epoch + 1 : 1;
  const iso = new Date(args.nowMs).toISOString();
  const record: ClaimRecord = {
    version: 1,
    scope: args.scope,
    key: args.key,
    epoch,
    owner: args.owner,
    pid: process.pid,
    host: os.hostname(),
    runId: args.runId ?? null,
    state: 'HELD',
    acquiredAt: iso,
    heartbeatAt: iso,
    ttlSeconds: args.ttlSeconds,
    takeoverOf: stale && current ? { epoch: current.epoch, owner: current.owner } : null,
    note: args.note ?? null,
  };
  if (!writeNewEpoch(epochFile(dir, epoch), record)) {
    return { ok: false, reason: 'RACE_LOST', current: currentClaim(args.repo, args.scope, args.key) };
  }
  return { ok: true, claim: record, recovered: stale ? current : null };
}

/**
 * Takes the RUN-scope claim for one run id. Ordinary `acquireClaim`, with the scope fixed.
 *
 * It exists so that a run started directly by an operator is covered by the same claim mechanism as
 * a resumed one, without a second copy of the scope/key/runId wiring drifting apart from it.
 * `resumeRun` deliberately keeps its own inline acquisition: its exact shape and its position
 * relative to the resume guards are pinned as source facts by `tests/claude-loop/claims.test.ts`,
 * so this task does not restate it.
 */
export function acquireRunClaim(args: { repo: string; runId: string; owner: string; nowMs: number; ttlSeconds: number; note?: string | null }): AcquireResult {
  return acquireClaim({
    repo: args.repo,
    scope: 'run',
    key: args.runId,
    owner: args.owner,
    nowMs: args.nowMs,
    ttlSeconds: args.ttlSeconds,
    runId: args.runId,
    note: args.note ?? null,
  });
}

export type HeartbeatResult = { ok: true; claim: ClaimRecord } | { ok: false; reason: 'LOST'; current: ClaimRecord | null };

/**
 * Refreshes the owner's own epoch in place. A taken-over owner learns it lost instead of writing.
 *
 * The rewrite is atomic (temp + rename), so a concurrent reader never sees a half-written claim and
 * can never mistake a torn file for an expired one.
 */
export function heartbeatClaim(args: { repo: string; claim: ClaimRecord; nowMs: number }): HeartbeatResult {
  if (!claimIsCurrent(args.repo, args.claim)) {
    return { ok: false, reason: 'LOST', current: currentClaim(args.repo, args.claim.scope, args.claim.key) };
  }
  const next: ClaimRecord = { ...args.claim, heartbeatAt: new Date(args.nowMs).toISOString() };
  writeJson(epochFile(claimDir(args.repo, args.claim.scope, args.claim.key), args.claim.epoch), next);
  return { ok: true, claim: next };
}

/** Thrown when a claim holder discovers it was taken over. It must stop writing, not continue. */
export class ClaimLostError extends Error {
  constructor(public readonly scope: ClaimScope, public readonly key: string, public readonly epoch: number, public readonly current: ClaimRecord | null) {
    super(`claim lost: ${scope}/${key} epoch ${epoch} is no longer the current claim (now ${current ? `epoch ${current.epoch} owned by ${current.owner}` : 'absent'}); this supervisor must stop rather than keep writing as a taken-over owner`);
    this.name = 'ClaimLostError';
  }
}

/**
 * Beat interval for a live claim: a third of the TTL, and never slower than once a minute.
 *
 * A claim must be refreshed several times inside its own TTL, otherwise "stale" degrades into "this
 * run simply took longer than the TTL" and a live run becomes recoverable by anyone.
 */
export function heartbeatIntervalMs(ttlSeconds: number): number {
  return Math.max(1000, Math.min(60_000, Math.floor((ttlSeconds * 1000) / 3)));
}

export type ClaimHeartbeat = {
  /** Beats now and throws `ClaimLostError` if the claim was taken over. Fail closed at checkpoints. */
  checkpoint: () => void;
  /** Stops the background ticker. Always call it in a `finally`. */
  stop: () => void;
  /** The foreign claim that took this one over, once that has been observed. */
  lostTo: () => ClaimRecord | null;
  beats: () => number;
};

/**
 * Keeps a held claim alive for the whole lifetime of a run.
 *
 * A claim that is only written once is not a heartbeat: its staleness would be measured from
 * acquisition, so any run outliving the TTL would be recoverable while it is still working, and two
 * write sessions could end up in one worktree on one candidate. The background ticker refreshes the
 * claim several times inside every TTL, and `checkpoint()` gives the caller fail-closed points —
 * phase transitions, round boundaries, state persistence — at which a lost claim stops the run
 * instead of letting it keep writing.
 */
export function startClaimHeartbeat(args: {
  repo: string;
  claim: ClaimRecord;
  ttlSeconds?: number;
  now?: () => number;
  beat?: (a: { repo: string; claim: ClaimRecord; nowMs: number }) => HeartbeatResult;
  onLost?: (current: ClaimRecord | null) => void;
}): ClaimHeartbeat {
  const now = args.now ?? (() => Date.now());
  const beat = args.beat ?? heartbeatClaim;
  const ttlSeconds = args.ttlSeconds ?? args.claim.ttlSeconds;
  let lost: ClaimRecord | null = null;
  let observedLoss = false;
  let beats = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const stop = (): void => { if (timer) { clearInterval(timer); timer = null; } };
  const tick = (): void => {
    if (observedLoss) return;
    const result = beat({ repo: args.repo, claim: args.claim, nowMs: now() });
    beats += 1;
    if (result.ok) return;
    observedLoss = true; lost = result.current; stop(); args.onLost?.(result.current);
  };

  timer = setInterval(tick, heartbeatIntervalMs(ttlSeconds));
  // Never keep the process alive just to heartbeat; the run itself decides when the process exits.
  timer.unref?.();

  return {
    checkpoint: () => {
      tick();
      if (observedLoss) throw new ClaimLostError(args.claim.scope, args.claim.key, args.claim.epoch, lost);
    },
    stop,
    lostTo: () => lost,
    beats: () => beats,
  };
}

export type ReleaseResult = { ok: true; claim: ClaimRecord } | { ok: false; reason: 'LOST'; current: ClaimRecord | null };

/**
 * Releases a claim by appending a RELEASED epoch.
 *
 * The release is itself an exclusive create, so a supervisor that was already taken over as stale
 * cannot erase the recovering owner's claim; it is told it lost.
 */
export function releaseClaim(args: { repo: string; claim: ClaimRecord; nowMs: number; note?: string | null }): ReleaseResult {
  if (!claimIsCurrent(args.repo, args.claim)) {
    return { ok: false, reason: 'LOST', current: currentClaim(args.repo, args.claim.scope, args.claim.key) };
  }
  const epoch = args.claim.epoch + 1;
  const iso = new Date(args.nowMs).toISOString();
  const record: ClaimRecord = { ...args.claim, epoch, state: 'RELEASED', heartbeatAt: iso, takeoverOf: null, note: args.note ?? null };
  if (!writeNewEpoch(epochFile(claimDir(args.repo, args.claim.scope, args.claim.key), epoch), record)) {
    return { ok: false, reason: 'LOST', current: currentClaim(args.repo, args.claim.scope, args.claim.key) };
  }
  return { ok: true, claim: record };
}

export type ClaimSummary = { scope: ClaimScope; key: string; claim: ClaimRecord; stale: boolean };

export function listClaims(repo: string, nowMs: number): ClaimSummary[] {
  const root = claimsRoot(repo);
  const out: ClaimSummary[] = [];
  if (!fs.existsSync(root)) return out;
  for (const scope of fs.readdirSync(root).sort()) {
    if (scope !== 'task' && scope !== 'run') continue;
    const scopeDir = path.join(root, scope);
    if (!fs.statSync(scopeDir).isDirectory()) continue;
    for (const key of fs.readdirSync(scopeDir).sort()) {
      const claim = currentClaim(repo, scope, key);
      if (!claim) continue;
      out.push({ scope, key, claim, stale: isClaimStale(claim, nowMs) });
    }
  }
  return out;
}

/**
 * Operator recovery: release every stale claim, and only stale claims.
 *
 * Recovery never touches a live owner and never invents a run outcome; it only makes an abandoned
 * key claimable again and records who was recovered.
 */
export function recoverStaleClaims(args: { repo: string; nowMs: number; owner: string }): ClaimSummary[] {
  const recovered: ClaimSummary[] = [];
  for (const entry of listClaims(args.repo, args.nowMs)) {
    if (!entry.stale) continue;
    const taken = acquireClaim({
      repo: args.repo,
      scope: entry.scope,
      key: entry.key,
      owner: args.owner,
      nowMs: args.nowMs,
      ttlSeconds: entry.claim.ttlSeconds,
      runId: entry.claim.runId,
      note: `stale recovery of epoch ${entry.claim.epoch} owned by ${entry.claim.owner}`,
    });
    if (!taken.ok) continue;
    releaseClaim({ repo: args.repo, claim: taken.claim, nowMs: args.nowMs, note: 'released by operator stale recovery' });
    recovered.push(entry);
  }
  return recovered;
}

export function ownerToken(prefix = 'autopilot'): string {
  return `${prefix}:${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 10)}`;
}
