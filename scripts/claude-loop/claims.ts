import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { z } from 'zod';
import { commonGitDir, ensureDir } from './util';

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

export type HeartbeatResult = { ok: true; claim: ClaimRecord } | { ok: false; reason: 'LOST'; current: ClaimRecord | null };

/** Refreshes the owner's own epoch in place. A taken-over owner learns it lost instead of writing. */
export function heartbeatClaim(args: { repo: string; claim: ClaimRecord; nowMs: number }): HeartbeatResult {
  if (!claimIsCurrent(args.repo, args.claim)) {
    return { ok: false, reason: 'LOST', current: currentClaim(args.repo, args.claim.scope, args.claim.key) };
  }
  const next: ClaimRecord = { ...args.claim, heartbeatAt: new Date(args.nowMs).toISOString() };
  const file = epochFile(claimDir(args.repo, args.claim.scope, args.claim.key), args.claim.epoch);
  fs.writeFileSync(file, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 });
  return { ok: true, claim: next };
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
