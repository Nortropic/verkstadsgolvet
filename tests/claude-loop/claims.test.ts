import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  acquireClaim,
  claimDir,
  claimIsCurrent,
  claimsRoot,
  currentClaim,
  heartbeatClaim,
  isClaimStale,
  listClaims,
  readClaimHistory,
  recoverStaleClaims,
  releaseClaim,
} from '../../scripts/claude-loop/claims';
import { commonGitDir } from '../../scripts/claude-loop/util';

/**
 * Hermetic claim suite.
 *
 * Every test runs against a DISPOSABLE local Git repository, so the exclusive-create semantics
 * being asserted are the REAL filesystem semantics the production scheduler relies on, while the
 * real repository, the real common directory and the real ledger are never touched.
 */
function disposableRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-claims-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'ignore' });
  return root;
}

const TTL = 900;
const T0 = Date.parse('2026-08-13T10:00:00.000Z');

test('a claim is granted exactly once: the second claimer is refused, never queued behind it', () => {
  const repo = disposableRepo();

  const first = acquireClaim({ repo, scope: 'task', key: 'V8-FIXTURE', owner: 'supervisor-A', nowMs: T0, ttlSeconds: TTL });
  assert.equal(first.ok, true);
  const second = acquireClaim({ repo, scope: 'task', key: 'V8-FIXTURE', owner: 'supervisor-B', nowMs: T0 + 1000, ttlSeconds: TTL });

  assert.equal(second.ok, false);
  assert.equal(second.ok === false && second.reason, 'HELD');
  assert.equal(second.ok === false && second.current?.owner, 'supervisor-A');
  // Exactly one epoch exists: the refused claimer wrote nothing at all.
  assert.deepEqual(readClaimHistory(repo, 'task', 'V8-FIXTURE').map((c) => `${c.epoch}:${c.owner}:${c.state}`), ['1:supervisor-A:HELD']);
});

/**
 * Genuinely concurrent claimers, in separate OS processes.
 *
 * Sequential calls can only prove the "someone already holds it" branch. Duplicate work is created
 * by the other branch: several processes that all read "free" before any of them writes. These
 * children synchronise on a shared wall-clock start time and then hit the same key at once, so the
 * only thing that can separate them is the exclusive create itself.
 */
async function raceForClaim(repo: string, key: string, owners: string[]): Promise<Array<{ owner: string; ok: boolean; reason: string }>> {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-claim-race-'));
  const childFile = path.join(scratch, 'claimer.ts');
  const claimsModule = path.resolve('scripts/claude-loop/claims.ts');
  fs.writeFileSync(childFile, `
import { acquireClaim } from ${JSON.stringify(claimsModule)};
const [repo, key, owner, startAt, ttl] = process.argv.slice(2);
while (Date.now() < Number(startAt)) { /* spin to the shared start instant */ }
const r = acquireClaim({ repo, scope: 'task', key, owner, nowMs: Date.now(), ttlSeconds: Number(ttl) });
process.stdout.write(JSON.stringify({ owner, ok: r.ok, reason: r.ok ? 'WON' : r.reason }));
`, 'utf8');

  const startAt = Date.now() + 2000;
  const results = await Promise.all(owners.map((owner) => new Promise<{ owner: string; ok: boolean; reason: string }>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', childFile, repo, key, owner, String(startAt), String(TTL)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = ''; let err = '';
    child.stdout.on('data', (d) => { out += String(d); });
    child.stderr.on('data', (d) => { err += String(d); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) return reject(new Error(`claimer ${owner} exited ${code}: ${err}`));
      try { resolve(JSON.parse(out.trim()) as { owner: string; ok: boolean; reason: string }); } catch (e) { reject(new Error(`claimer ${owner} output '${out}' ${String(e)}`)); }
    });
  })));
  fs.rmSync(scratch, { recursive: true, force: true });
  return results;
}

test('genuinely concurrent claimers of the same key: exactly one wins', async () => {
  const repo = disposableRepo();
  const results = await raceForClaim(repo, 'V4', ['A', 'B', 'C', 'D', 'E', 'F']);

  assert.equal(results.filter((r) => r.ok).length, 1, `exactly one claimer may win, got ${JSON.stringify(results)}`);
  for (const loser of results.filter((r) => !r.ok)) {
    // HELD = it saw the winner's claim; RACE_LOST = it lost the exclusive create itself.
    assert.ok(loser.reason === 'HELD' || loser.reason === 'RACE_LOST', `unexpected loser reason ${loser.reason}`);
  }
  const held = readClaimHistory(repo, 'task', 'V4').filter((c) => c.state === 'HELD');
  assert.equal(held.length, 1, 'exactly one HELD epoch may exist after the race');
  assert.equal(held[0].owner, results.find((r) => r.ok)?.owner);
});

test('sequential claimers of the same key are refused, never queued behind it', () => {
  const repo = disposableRepo();
  const owners = ['A', 'B', 'C', 'D'];
  const results = owners.map((owner) => acquireClaim({ repo, scope: 'task', key: 'V4', owner, nowMs: T0, ttlSeconds: TTL }));

  assert.equal(results.filter((r) => r.ok).length, 1, 'exactly one claimer may win');
  assert.deepEqual(results.filter((r) => !r.ok).map((r) => (r.ok === false ? r.reason : '')), ['HELD', 'HELD', 'HELD']);
  assert.equal(readClaimHistory(repo, 'task', 'V4').length, 1, 'a refused claimer writes nothing');
});

test('a live claim is never overridden, however old, until its TTL expires', () => {
  const repo = disposableRepo();
  const held = acquireClaim({ repo, scope: 'task', key: 'V7', owner: 'long-runner', nowMs: T0, ttlSeconds: TTL });
  assert.equal(held.ok, true);
  if (!held.ok) return;

  // One second before expiry: still held.
  assert.equal(isClaimStale(held.claim, T0 + TTL * 1000 - 1), false);
  const early = acquireClaim({ repo, scope: 'task', key: 'V7', owner: 'thief', nowMs: T0 + TTL * 1000 - 1, ttlSeconds: TTL });
  assert.equal(early.ok, false);

  // A heartbeat pushes expiry forward without creating a new epoch.
  const beat = heartbeatClaim({ repo, claim: held.claim, nowMs: T0 + 60_000 });
  assert.equal(beat.ok, true);
  assert.equal(readClaimHistory(repo, 'task', 'V7').length, 1, 'a heartbeat must not create a new epoch');
  assert.equal(isClaimStale(beat.ok ? beat.claim : held.claim, T0 + TTL * 1000 + 1), false, 'the heartbeat moved the deadline');
});

test('a stale claim is recovered by exactly one taker, and the crashed owner learns it lost', () => {
  const repo = disposableRepo();
  const crashed = acquireClaim({ repo, scope: 'task', key: 'V5', owner: 'crashed-supervisor', nowMs: T0, ttlSeconds: TTL });
  assert.equal(crashed.ok, true);
  if (!crashed.ok) return;

  const afterTtl = T0 + TTL * 1000 + 1;
  assert.equal(isClaimStale(crashed.claim, afterTtl), true);

  const takers = ['recover-A', 'recover-B', 'recover-C'].map((owner) =>
    acquireClaim({ repo, scope: 'task', key: 'V5', owner, nowMs: afterTtl, ttlSeconds: TTL }));
  const winners = takers.filter((t) => t.ok);
  assert.equal(winners.length, 1, 'stale recovery is still exactly-once');
  const winner = winners[0];
  assert.equal(winner.ok === true && winner.recovered?.owner, 'crashed-supervisor');
  assert.equal(winner.ok === true && winner.claim.epoch, 2);
  assert.equal(winner.ok === true && winner.claim.takeoverOf?.epoch, 1, 'the takeover records who it recovered');
  // The later takers see the recovered claim as a LIVE claim, not as another stale one to steal.
  assert.deepEqual(takers.filter((t) => !t.ok).map((t) => (t.ok === false ? t.reason : '')), ['HELD', 'HELD']);
  assert.equal(readClaimHistory(repo, 'task', 'V5').length, 2, 'a refused taker writes no epoch');

  // The crashed owner's epoch is preserved as evidence, and it can no longer act.
  assert.equal(claimIsCurrent(repo, crashed.claim), false);
  assert.equal(heartbeatClaim({ repo, claim: crashed.claim, nowMs: afterTtl + 1 }).ok, false);
  const lostRelease = releaseClaim({ repo, claim: crashed.claim, nowMs: afterTtl + 2 });
  assert.equal(lostRelease.ok, false);
  assert.equal(lostRelease.ok === false && lostRelease.reason, 'LOST', 'a taken-over owner may not erase the recovering owner');
  assert.equal(readClaimHistory(repo, 'task', 'V5').length, 2, 'the audit trail is append-only');
});

test('release makes the key claimable again and keeps every epoch as evidence', () => {
  const repo = disposableRepo();
  const first = acquireClaim({ repo, scope: 'task', key: 'V9', owner: 'A', nowMs: T0, ttlSeconds: TTL });
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const released = releaseClaim({ repo, claim: first.claim, nowMs: T0 + 5000, note: 'released after AWAITING_PUBLICATION' });
  assert.equal(released.ok, true);
  assert.equal(currentClaim(repo, 'task', 'V9')?.state, 'RELEASED');

  const next = acquireClaim({ repo, scope: 'task', key: 'V9', owner: 'B', nowMs: T0 + 6000, ttlSeconds: TTL });
  assert.equal(next.ok, true);
  assert.equal(next.ok === true && next.claim.epoch, 3);
  assert.equal(next.ok === true && next.claim.takeoverOf, null, 'a clean handover is not a stale takeover');
  assert.deepEqual(readClaimHistory(repo, 'task', 'V9').map((c) => c.state), ['HELD', 'RELEASED', 'HELD']);
});

test('task claims and run claims are separate namespaces', () => {
  const repo = disposableRepo();
  assert.equal(acquireClaim({ repo, scope: 'task', key: 'V4', owner: 'A', nowMs: T0, ttlSeconds: TTL }).ok, true);
  assert.equal(acquireClaim({ repo, scope: 'run', key: 'V4', owner: 'B', nowMs: T0, ttlSeconds: TTL }).ok, true, 'a run claim is not a task claim');
  assert.equal(acquireClaim({ repo, scope: 'run', key: 'V4', owner: 'C', nowMs: T0, ttlSeconds: TTL }).ok, false);
  assert.deepEqual(listClaims(repo, T0).map((c) => `${c.scope}/${c.key}/${c.claim.owner}`).sort(), ['run/V4/B', 'task/V4/A']);
});

test('operator recovery releases only stale claims and never a live one', () => {
  const repo = disposableRepo();
  const stale = acquireClaim({ repo, scope: 'task', key: 'V5', owner: 'crashed', nowMs: T0, ttlSeconds: TTL });
  const live = acquireClaim({ repo, scope: 'task', key: 'V7', owner: 'running', nowMs: T0 + TTL * 1000, ttlSeconds: TTL });
  assert.equal(stale.ok && live.ok, true);

  const now = T0 + TTL * 1000 + 1;
  const recovered = recoverStaleClaims({ repo, nowMs: now, owner: 'operator' });

  assert.deepEqual(recovered.map((r) => r.key), ['V5']);
  assert.equal(currentClaim(repo, 'task', 'V5')?.state, 'RELEASED', 'the abandoned key is claimable again');
  assert.equal(currentClaim(repo, 'task', 'V7')?.state, 'HELD', 'the live claim is untouched');
  assert.equal(currentClaim(repo, 'task', 'V7')?.owner, 'running');
});

test('claim state lives only under the Git common directory, never in a worktree or in prose', () => {
  const repo = disposableRepo();
  acquireClaim({ repo, scope: 'task', key: 'V8-FIXTURE', owner: 'A', nowMs: T0, ttlSeconds: TTL });

  const common = commonGitDir(repo);
  assert.equal(claimsRoot(repo), path.join(common, 'claude-factory', 'claims'));
  assert.ok(claimDir(repo, 'task', 'V8-FIXTURE').startsWith(common + path.sep), 'claims must not escape the common dir');
  assert.ok(fs.existsSync(path.join(common, 'claude-factory', 'claims', 'task', 'V8-FIXTURE', '0000000001.json')));
  // Nothing is written into the working tree: a checkout carries no operational state.
  assert.deepEqual(fs.readdirSync(repo).filter((n) => n !== '.git'), []);
});

test('the production resume path really takes, and releases, a run claim', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /acquireClaim\(\{ repo, scope: 'run', key: runId/, 'resumeRun must claim the run before any Claude segment');
  assert.match(src, /is already claimed by/, 'a second resume of the same run must be refused');
  assert.match(src, /} finally {\n\s*releaseClaim\(\{ repo, claim: claim\.claim/, 'the run claim is released even when the run blocks');
});

test('unsafe claim keys and corrupt claim files fail closed', () => {
  const repo = disposableRepo();
  for (const key of ['../escape', 'a/b', '.hidden', '']) {
    assert.throws(() => claimDir(repo, 'task', key), /unsafe claim key/, `key ${JSON.stringify(key)} must be refused`);
  }
  acquireClaim({ repo, scope: 'task', key: 'V4', owner: 'A', nowMs: T0, ttlSeconds: TTL });
  fs.writeFileSync(path.join(claimDir(repo, 'task', 'V4'), '0000000001.json'), '{not json', 'utf8');
  assert.throws(() => currentClaim(repo, 'task', 'V4'), /corrupt claim file/, 'a corrupt claim is never treated as free');
});
