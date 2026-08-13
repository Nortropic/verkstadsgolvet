import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import {
  ClaimLostError,
  acquireClaim,
  claimDir,
  claimIsCurrent,
  claimsRoot,
  currentClaim,
  heartbeatClaim,
  heartbeatIntervalMs,
  isClaimStale,
  listClaims,
  readClaimHistory,
  recoverStaleClaims,
  releaseClaim,
  startClaimHeartbeat,
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

test('a heartbeated claim never goes stale, so a live long run is never recovered from under it', () => {
  const repo = disposableRepo();
  const held = acquireClaim({ repo, scope: 'task', key: 'V4', owner: 'long-runner', nowMs: T0, ttlSeconds: TTL });
  assert.equal(held.ok, true);
  if (!held.ok) return;

  // A run far longer than the TTL, beating on the interval the production ticker uses.
  const interval = heartbeatIntervalMs(TTL);
  assert.ok(interval < TTL * 1000, 'a claim must be refreshed several times inside its own TTL');
  let now = T0;
  for (const _step of Array.from({ length: 60 })) {
    now += interval;
    assert.equal(heartbeatClaim({ repo, claim: held.claim, nowMs: now }).ok, true);
    assert.equal(isClaimStale(currentClaim(repo, 'task', 'V4')!, now), false, `still live at +${now - T0}ms`);
    assert.equal(acquireClaim({ repo, scope: 'task', key: 'V4', owner: 'thief', nowMs: now, ttlSeconds: TTL }).ok, false);
  }
  assert.ok(now - T0 > TTL * 1000 * 3, 'the run outlived its TTL several times over');
  // Operator recovery leaves it alone precisely because the heartbeat is fresh.
  assert.deepEqual(recoverStaleClaims({ repo, nowMs: now, owner: 'operator' }).map((r) => r.key), []);
  assert.equal(currentClaim(repo, 'task', 'V4')?.state, 'HELD');

  // Stop beating, and only then does it become recoverable.
  const afterSilence = now + TTL * 1000 + 1;
  assert.equal(isClaimStale(currentClaim(repo, 'task', 'V4')!, afterSilence), true);
  assert.deepEqual(recoverStaleClaims({ repo, nowMs: afterSilence, owner: 'operator' }).map((r) => r.key), ['V4']);
});

test('the heartbeat ticker beats on its own and a checkpoint fails closed once the claim is lost', () => {
  const repo = disposableRepo();
  const held = acquireClaim({ repo, scope: 'run', key: 'v8-fixture-20260813', owner: 'A', nowMs: T0, ttlSeconds: TTL });
  assert.equal(held.ok, true);
  if (!held.ok) return;

  const beats: number[] = [];
  let now = T0;
  const heartbeat = startClaimHeartbeat({
    repo,
    claim: held.claim,
    ttlSeconds: TTL,
    now: () => now,
    beat: (a) => { beats.push(a.nowMs); return heartbeatClaim(a); },
  });
  try {
    now += 1000;
    heartbeat.checkpoint();
    assert.deepEqual(beats, [T0 + 1000], 'a checkpoint beats the claim');
    assert.equal(Date.parse(currentClaim(repo, 'run', 'v8-fixture-20260813')!.heartbeatAt), T0 + 1000);

    // Another supervisor recovers the claim as stale while this one is mid-run.
    const takeover = acquireClaim({ repo, scope: 'run', key: 'v8-fixture-20260813', owner: 'B', nowMs: T0 + TTL * 1000 + 2000, ttlSeconds: TTL });
    assert.equal(takeover.ok, true);

    now += 2000;
    assert.throws(() => heartbeat.checkpoint(), (e: unknown) => e instanceof ClaimLostError && e.key === 'v8-fixture-20260813' && e.epoch === 1);
    assert.equal(heartbeat.lostTo()?.owner, 'B');
    // The loser stops beating instead of fighting the new owner for the claim file.
    const beatsAtLoss = beats.length;
    assert.throws(() => heartbeat.checkpoint(), ClaimLostError);
    assert.equal(beats.length, beatsAtLoss, 'a lost claim is never beaten again');
    assert.equal(currentClaim(repo, 'run', 'v8-fixture-20260813')?.owner, 'B', 'the new owner is untouched');
  } finally {
    heartbeat.stop();
  }
});

test('heartbeat interval always refreshes several times inside the TTL', () => {
  for (const ttl of [30, 60, 300, 900, 3600, 86400]) {
    const interval = heartbeatIntervalMs(ttl);
    assert.ok(interval >= 1000, `interval for ttl=${ttl} must be sane`);
    assert.ok(interval * 3 <= ttl * 1000, `ttl=${ttl} must fit at least three beats`);
  }
});

test('claim files are written atomically, so a reader never sees a torn claim', () => {
  const repo = disposableRepo();
  const held = acquireClaim({ repo, scope: 'task', key: 'V4', owner: 'A', nowMs: T0, ttlSeconds: TTL });
  assert.equal(held.ok, true);
  if (!held.ok) return;
  heartbeatClaim({ repo, claim: held.claim, nowMs: T0 + 1000 });
  const dir = claimDir(repo, 'task', 'V4');
  assert.deepEqual(fs.readdirSync(dir), ['0000000001.json'], 'the atomic temp file is renamed, never left behind');
  assert.doesNotThrow(() => currentClaim(repo, 'task', 'V4'));
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

test('the production resume path takes, heartbeats and releases a run claim', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /acquireClaim\(\{ repo, scope: 'run', key: runId/, 'resumeRun must claim the run before any Claude segment');
  assert.match(src, /is already claimed by/, 'a second resume of the same run must be refused');
  assert.match(src, /const heartbeat = startClaimHeartbeat\(\{ repo, claim: claim\.claim, ttlSeconds: config\.autopilot\.claimTtlSeconds \}\)/, 'the run claim must be kept alive for the whole resume');
  assert.match(src, /execute\(repo, config, state, heartbeat\.checkpoint\)/, 'the supervisor must beat at its own checkpoints');
  assert.match(src, /} finally {\n\s*heartbeat\.stop\(\);\n\s*releaseClaim\(\{ repo, claim: claim\.claim/, 'the ticker stops and the claim is released even when the run blocks');
  // Every state write inside execute() beats first and refuses to write once the claim is lost.
  assert.match(src, /const persistRunState = \(s: RunState\): void => \{\n\s*heartbeat\?\.\(\);\n\s*saveState\(repo, s\);/);
  assert.match(src, /if \(e instanceof ClaimLostError\) \{/, 'a taken-over supervisor must not write the run state it no longer owns');
  // Exactly one raw write survives inside execute(): the terminal BLOCKED record, which is reached
  // only AFTER the claim-loss branch has returned, so it can never write on a lost claim and a
  // heartbeat failure there can never mask the real blocking error.
  const executeBody = src.slice(src.indexOf('async function execute('));
  const rawWrites = executeBody.match(/saveState\(repo, state\)/g) ?? [];
  assert.equal(rawWrites.length, 1, 'execute() persists through the heartbeat-checked path everywhere except the documented terminal block');
  assert.match(executeBody, /saveState\(repo, state\); t\.emit\('run\.blocked'/);
  assert.ok(executeBody.indexOf('if (e instanceof ClaimLostError) {') < executeBody.indexOf("saveState(repo, state); t.emit('run.blocked'"), 'the claim-loss branch must return before the terminal write');
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
