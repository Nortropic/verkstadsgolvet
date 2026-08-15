import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import {
  SUPERVISOR_LOST_BLOCK_PREFIX,
  autopilotRecover,
  autopilotStatus,
  classifyRuns,
  runAutopilot,
  unfinishedRuns,
  watchForReadyWork,
  watchPoller,
  type AutopilotDeps,
  type WatchPoll,
} from '../../scripts/claude-loop/autopilot';
import {
  acquireClaim,
  acquireRunClaim,
  claimHeartbeatAgeSeconds,
  currentClaim,
  isClaimStale,
  listClaims,
  ownerToken,
  releaseClaim,
} from '../../scripts/claude-loop/claims';
import { isTerminalRunPhase, listRunStates, loadState, saveState, statePath } from '../../scripts/claude-loop/state';
import { circuitBreakerResumeRefusal, extendRemediationState } from '../../scripts/claude-loop/supervisor';
import { BacklogSchema, materializeTask, type Backlog } from '../../scripts/claude-loop/backlog';
import { loadLedger, writeLedgerEntry } from '../../scripts/claude-loop/ledger';
import { ConfigSchema, RunStateSchema, TaskSchema, type FactoryConfig, type RunState, type TaskSpec } from '../../scripts/claude-loop/schemas';
import { git, gitRun } from '../../scripts/claude-loop/util';
import type { AuthorityClass, AuthoritySelection } from '../../scripts/claude-loop/authority';

/**
 * Hermetic suite for persistent sessions and asynchronous ownership (SUPERVISOR-01).
 *
 * Everything here runs against DISPOSABLE Git repositories. R1 is a genuine process death: a real
 * child supervisor is started, allowed to reach a real remediation round with a real candidate
 * commit, and then SIGKILLed — no simulated phase, no forged state. Nothing in this file can reach
 * the real repository, start a model, push, create a PR or move any branch.
 *
 * The controls these tests exist to hold:
 *
 * - recovery never demotes a run whose claim is still beating;
 * - recovery never touches a candidate commit, a branch, a worktree or the append-only history;
 * - recovery never manufactures retry entitlement;
 * - a run with no liveness evidence is reported, never silently swept;
 * - the wakeup primitive takes no claim, starts nothing and decides nothing.
 */

const shipped: FactoryConfig = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
const TTL = shipped.autopilot.claimTtlSeconds;
const NOW = Date.parse('2026-08-15T10:00:00.000Z');

/* ---------------------------------------------------------------- disposable repositories */

type Factory = { root: string; repo: string; worktreeRoot: string };

function disposableFactory(): Factory {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-async-'));
  const repo = path.join(root, 'repo');
  const bare = path.join(root, 'origin.git');
  fs.mkdirSync(path.join(repo, 'work'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'work', 'seed.txt'), 'seed\n', 'utf8');
  fs.writeFileSync(path.join(repo, '.gitignore'), '/.claude-loop.json\n/.claude-loop/\n', 'utf8');
  fs.copyFileSync('.claude-loop.example.json', path.join(repo, '.claude-loop.example.json'));
  gitRun(repo, ['init', '-b', 'main']);
  gitRun(repo, ['add', '--all']);
  gitRun(repo, ['-c', 'user.name=Async Test', '-c', 'user.email=async@nortropic.local', 'commit', '-m', 'fixture base']);
  gitRun(root, ['init', '--bare', bare]);
  gitRun(repo, ['remote', 'add', 'origin', bare]);
  gitRun(repo, ['push', '-u', 'origin', 'main']);
  return { root, repo, worktreeRoot: path.join(root, 'worktrees') };
}

function disposableRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-async-plain-'));
  gitRun(root, ['init', '-b', 'main']);
  return root;
}

function dispose(root: string): void { fs.rmSync(root, { recursive: true, force: true }); }

function taskSpec(over: Record<string, unknown> = {}): TaskSpec {
  return TaskSchema.parse({
    id: 'ASYNC',
    title: 'async ownership fixture',
    description: 'synthetic slice',
    allowedWrite: ['work/**'],
    deniedWrite: ['work/secret/**'],
    gates: [['true']],
    ...over,
  });
}

function persistedRun(repo: string, over: { runId: string; taskId?: string; phase: string; candidateSha?: string | null }): RunState {
  const state = RunStateSchema.parse({
    version: 1,
    runId: over.runId,
    task: taskSpec({ id: over.taskId ?? 'ASYNC' }),
    baseSha: 'a'.repeat(40),
    branch: `claude/${over.runId}`,
    worktree: path.join(repo, '..', over.runId),
    phase: over.phase,
    attempt: 1,
    candidateSha: over.candidateSha ?? null,
    sessions: { architect: 'arch', builder: 'build', reviewer: null, visualReviewer: null },
    findings: [],
    advisoryFindings: [],
    prUrl: null,
    blockedReason: null,
  });
  saveState(repo, state);
  return state;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

async function waitFor(what: string, condition: () => boolean, timeoutMs = 90_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (condition()) return;
    await sleep(100);
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`);
}

/* ===================================================================== R1: real process death */

/**
 * The child supervisor.
 *
 * It runs the REAL `startRunFromTask` with `runClaim: true` — the exact path `claude:run --task`
 * takes — against the disposable repository, with scripted role results. Round 0 produces a real
 * candidate commit, the reviewer returns findings, and the round-1 write role announces itself and
 * then never returns, so the parent can kill it in a genuinely non-terminal phase.
 */
function childSupervisorSource(): string {
  const supervisor = JSON.stringify(path.resolve('scripts/claude-loop/supervisor.ts'));
  const schemas = JSON.stringify(path.resolve('scripts/claude-loop/schemas.ts'));
  return `
import fs from 'node:fs';
import path from 'node:path';
import { startRunFromTask } from ${supervisor};
import { ConfigSchema, TaskSchema } from ${schemas};

const [repo, worktreeRoot, marker, configFile, taskFile] = process.argv.slice(2);
const config = ConfigSchema.parse(JSON.parse(fs.readFileSync(configFile, 'utf8')));
const task = TaskSchema.parse(JSON.parse(fs.readFileSync(taskFile, 'utf8')));
const ready = (next) => ({ outcome: 'READY', summary: 'ok', findings: [], tests: [], changed_files: [], next_action: next });
let builderCalls = 0;

const deps = {
  worktreeRoot,
  runRole: async (a) => {
    if (a.role === 'architect') return { sessionId: 'architect-session', result: ready('BUILD') };
    if (a.role === 'reviewer') {
      return { sessionId: 'reviewer-session-1', result: { outcome: 'NEEDS_REMEDIATION', summary: 'findings', findings: [{ id: 'reviewer-1', severity: 'major', message: 'a is wrong', file: 'work/a.txt' }], tests: [], changed_files: [], next_action: 'REMEDIATE' } };
    }
    builderCalls += 1;
    if (builderCalls === 1) {
      fs.mkdirSync(path.join(a.cwd, 'work'), { recursive: true });
      fs.writeFileSync(path.join(a.cwd, 'work', 'a.txt'), 'round 0 work\\n', 'utf8');
      return { sessionId: 'builder-session', result: ready('REVIEW') };
    }
    // Mid-remediation, holding the event loop open, exactly like a supervisor that is working.
    setInterval(() => {}, 1000);
    fs.writeFileSync(marker, String(process.pid), 'utf8');
    return await new Promise(() => {});
  },
  runGates: async () => ({ ok: true, failures: [] }),
  captureVisualEvidence: async () => ({ files: [], stop: () => {} }),
  publish: () => { throw new Error('publication must never run in this suite'); },
};

startRunFromTask({ repo, config, task, authorityClass: 'ordinary', deps, runClaim: true })
  .catch((error) => { process.stderr.write(String((error && error.stack) || error)); process.exit(3); });
`;
}

test('R1: a SIGKILLed direct run is recovered from its stale claim, and its candidate survives byte-identically', async () => {
  const f = disposableFactory();
  let child: ChildProcess | null = null;
  try {
    const scratch = path.join(f.root, 'child');
    fs.mkdirSync(scratch, { recursive: true });
    const childFile = path.join(scratch, 'supervisor-child.ts');
    const marker = path.join(scratch, 'mid-remediation');
    const configFile = path.join(scratch, 'config.json');
    const taskFile = path.join(scratch, 'task.json');
    fs.writeFileSync(childFile, childSupervisorSource(), 'utf8');
    fs.writeFileSync(configFile, JSON.stringify(shipped), 'utf8');
    fs.writeFileSync(taskFile, JSON.stringify(taskSpec()), 'utf8');

    let stderr = '';
    child = spawn(process.execPath, ['--import', 'tsx', childFile, f.repo, f.worktreeRoot, marker, configFile, taskFile], { stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr?.on('data', (d) => { stderr += String(d); });
    let exited = false;
    child.on('close', () => { exited = true; });

    await waitFor('the child supervisor to reach mid-remediation', () => fs.existsSync(marker) || exited);
    assert.equal(exited, false, `the child supervisor died before it reached remediation: ${stderr}`);

    const runs = listRunStates(f.repo);
    assert.equal(runs.length, 1, 'exactly one run exists in the disposable factory');
    const runId = runs[0].runId;

    // The state on disk really is mid-run, and the run really is claim-covered and beating.
    const killed = loadState(f.repo, runId);
    assert.equal(killed.phase, 'REMEDIATE', 'the persisted phase is the interrupted one');
    assert.equal(isTerminalRunPhase(killed.phase), false);
    assert.ok(killed.candidateSha, 'round 0 produced a real candidate commit');
    const claimBeforeKill = currentClaim(f.repo, 'run', runId)!;
    assert.equal(claimBeforeKill.state, 'HELD');
    assert.equal(claimBeforeKill.runId, runId);

    // Evidence captured BEFORE the kill, so "byte-identical" is measured, not asserted.
    const historyBefore = structuredClone(killed.progressHistory);
    const candidateSha = killed.candidateSha!;
    const candidateObject = git(f.repo, 'cat-file', '-p', candidateSha);
    const candidateTree = git(f.repo, 'rev-parse', `${candidateSha}^{tree}`);
    const branchSha = git(f.repo, 'rev-parse', killed.branch);
    const worktreeFile = fs.readFileSync(path.join(killed.worktree, 'work', 'a.txt'), 'utf8');

    // THE KILL. No cleanup handler runs, so the claim is never released.
    child.kill('SIGKILL');
    await waitFor('the killed supervisor process to be gone', () => exited);
    child = null;

    // A killed process leaves a HELD claim behind: the run still LOOKS live until the TTL expires,
    // and recovery must refuse to touch it for exactly that long.
    const atKill = Date.now();
    const stillLive = classifyRuns({ repo: f.repo, nowMs: atKill }).find((r) => r.runId === runId)!;
    assert.equal(stillLive.liveness, 'LIVE');
    assert.equal(stillLive.terminal, false);
    assert.equal(typeof stillLive.heartbeatAgeSeconds, 'number');
    const early = autopilotRecover({ repo: f.repo, nowMs: atKill });
    assert.deepEqual(early.runUpdates, [], 'recovery never demotes a claim that is still inside its TTL');
    assert.deepEqual(early.recoveredClaims, []);
    assert.equal(loadState(f.repo, runId).phase, 'REMEDIATE', 'the run state is untouched while the claim looks live');

    // Past the TTL the heartbeat is the proof: the owner is gone.
    const afterTtl = atKill + TTL * 1000 + 1;
    const lost = classifyRuns({ repo: f.repo, nowMs: afterTtl }).find((r) => r.runId === runId)!;
    assert.equal(lost.liveness, 'LOST');
    assert.match(lost.evidence, /beyond its \d+s TTL/);

    const recovery = autopilotRecover({ repo: f.repo, nowMs: afterTtl });

    assert.deepEqual(recovery.recoveredClaims.map((c) => `${c.scope}:${c.key}`), [`run:${runId}`], 'the stale run claim is released');
    assert.equal(currentClaim(f.repo, 'run', runId)?.state, 'RELEASED');
    assert.deepEqual(recovery.runUpdates.map((u) => `${u.runId}:${u.from}->${u.to}:${u.trigger}`), [`${runId}:REMEDIATE->BLOCKED:stale-claim`]);
    assert.ok(recovery.runUpdates[0].reason.startsWith(SUPERVISOR_LOST_BLOCK_PREFIX), recovery.runUpdates[0].reason);
    assert.match(recovery.runUpdates[0].reason, /was NOT completed/);
    assert.deepEqual(recovery.ledgerUpdates, [], 'a direct run has no ledger row, and recovery invents none');
    assert.deepEqual(loadLedger(f.repo).entries, [], 'the ledger is untouched for a task without a ledger row');
    assert.deepEqual(recovery.unprovenRuns, [], 'the recovered run is not also reported as unproven');

    // The run is now terminal, with the reason an operator can act on.
    const recovered = loadState(f.repo, runId);
    assert.equal(recovered.phase, 'BLOCKED');
    assert.ok(recovered.blockedReason?.startsWith(SUPERVISOR_LOST_BLOCK_PREFIX));

    // NEGATIVE CONTROL: the candidate, its branch, its worktree and the history are untouched.
    assert.equal(recovered.candidateSha, candidateSha, 'the exact candidate is retained');
    assert.equal(git(f.repo, 'cat-file', '-p', candidateSha), candidateObject, 'the candidate commit object is byte-identical');
    assert.equal(git(f.repo, 'rev-parse', `${candidateSha}^{tree}`), candidateTree);
    assert.equal(git(f.repo, 'rev-parse', recovered.branch), branchSha, 'the candidate branch still points at the same commit');
    assert.equal(fs.existsSync(recovered.worktree), true, 'the worktree is preserved for inspection');
    assert.equal(fs.readFileSync(path.join(recovered.worktree, 'work', 'a.txt'), 'utf8'), worktreeFile);
    assert.deepEqual(recovered.progressHistory, historyBefore, 'recovery never rewrites, truncates or appends to progressHistory');
    assert.deepEqual(recovered.sessions, killed.sessions, 'the reconstructable session identities survive');
    assert.equal(recovered.attempt, killed.attempt, 'recovery never moves the round counter');
    assert.deepEqual(recovered.findings, killed.findings, 'the pending findings the run was working on survive');

    // NEGATIVE CONTROL: recovery manufactures no retry entitlement. The ordinary resume path still
    // applies, and the owner re-open path still refuses a run that never earned one.
    assert.equal(recovered.progressHistory.some((r) => r.kind === 'owner-extension'), false);
    assert.equal(circuitBreakerResumeRefusal(recovered), null, 'a recovered run is resumable through the ordinary path');
    assert.throws(() => extendRemediationState(recovered, shipped, 1), /owner remediation extension requires/, 'recovery is not an extension');
    assert.equal(recovered.ownerRemediationExtensionRounds, 0);

    // Recovery is idempotent: a terminal run is never re-demoted and never re-reasoned.
    const again = autopilotRecover({ repo: f.repo, nowMs: afterTtl + 60_000 });
    assert.deepEqual(again.runUpdates, []);
    assert.deepEqual(again.recoveredClaims, []);
    assert.deepEqual(loadState(f.repo, runId), recovered, 'a second recovery writes nothing at all');
  } finally {
    child?.kill('SIGKILL');
    dispose(f.root);
  }
});

/* ============================================================ R2: stale-run classification */

test('R2: every unfinished run is classified from its claim heartbeat, and status lists it with the age', () => {
  const repo = disposableRepo();
  try {
    persistedRun(repo, { runId: 'live-run', taskId: 'ASYNC-LIVE', phase: 'BUILD' });
    persistedRun(repo, { runId: 'lost-run', taskId: 'ASYNC-LOST', phase: 'REMEDIATE', candidateSha: 'd'.repeat(40) });
    persistedRun(repo, { runId: 'orphan-run', taskId: 'ASYNC-ORPHAN', phase: 'REVIEW' });
    persistedRun(repo, { runId: 'done-run', taskId: 'ASYNC-DONE', phase: 'DONE' });
    persistedRun(repo, { runId: 'autopilot-run', taskId: 'ASYNC-SCHEDULED', phase: 'BUILD' });

    // A beating run claim, a claim that stopped beating an hour ago, and — for the scheduled run —
    // the autopilot's TASK claim, which is the claim that covers a run the scheduler started.
    assert.equal(acquireRunClaim({ repo, runId: 'live-run', owner: 'live-supervisor', nowMs: NOW - 10_000, ttlSeconds: TTL }).ok, true);
    assert.equal(acquireRunClaim({ repo, runId: 'lost-run', owner: 'lost-supervisor', nowMs: NOW - 3_600_000, ttlSeconds: TTL }).ok, true);
    assert.equal(acquireClaim({ repo, scope: 'task', key: 'ASYNC-SCHEDULED', owner: 'lost-scheduler', nowMs: NOW - 3_600_000, ttlSeconds: TTL }).ok, true);

    const runs = classifyRuns({ repo, nowMs: NOW });
    const by = (id: string) => runs.find((r) => r.runId === id)!;

    assert.equal(by('live-run').liveness, 'LIVE');
    assert.equal(by('live-run').heartbeatAgeSeconds, 10);
    assert.equal(by('live-run').claim?.scope, 'run');
    assert.match(by('live-run').evidence, /inside its \d+s TTL/);

    assert.equal(by('lost-run').liveness, 'LOST');
    assert.equal(by('lost-run').heartbeatAgeSeconds, 3600);
    assert.equal(by('lost-run').terminal, false);

    assert.equal(by('orphan-run').liveness, 'UNPROVEN');
    assert.equal(by('orphan-run').heartbeatAgeSeconds, null, 'an unknown heartbeat is never invented');
    assert.match(by('orphan-run').evidence, /no claim covers this run/);

    assert.equal(by('done-run').terminal, true, 'DONE is terminal, so there is nothing to recover');
    assert.equal(by('autopilot-run').liveness, 'LOST', 'the task claim covers the run the scheduler started');
    assert.equal(by('autopilot-run').claim?.scope, 'task');

    assert.deepEqual(unfinishedRuns(runs).map((r) => r.runId).sort(), ['autopilot-run', 'live-run', 'lost-run', 'orphan-run']);

    // The same classification is what `claude:autopilot-status` reports.
    const status = autopilotStatus({ repo, deps: statusDeps(repo), selection: { selectedTaskIds: [] }, nowMs: NOW });
    assert.deepEqual(status.runs.map((r) => r.runId).sort(), ['autopilot-run', 'done-run', 'live-run', 'lost-run', 'orphan-run']);
    assert.equal(status.runs.find((r) => r.runId === 'lost-run')?.liveness, 'LOST');

    // A live claim is not stale, whatever the run phase says; the claim is the only liveness source.
    const live = currentClaim(repo, 'run', 'live-run')!;
    assert.equal(isClaimStale(live, NOW), false);
    assert.equal(claimHeartbeatAgeSeconds(live, NOW), 10);
  } finally { dispose(repo); }
});

test('R2: a live task claim can never mask a dead run of the same slice, and still covers a scheduled run', () => {
  const repo = disposableRepo();
  try {
    // The exact G1 collision: a direct run of a canonical slice was killed (its own run claim went
    // stale, no ledger row), and the autopilot LATER scheduled the same slice and holds a live task
    // claim for it. The dead run must still be recoverable — the live task claim says nothing about
    // a run id that nothing ever adopts.
    persistedRun(repo, { runId: 'killed-run', taskId: 'ASYNC-SHARED', phase: 'REMEDIATE', candidateSha: 'd'.repeat(40) });
    persistedRun(repo, { runId: 'scheduled-run', taskId: 'ASYNC-SHARED', phase: 'BUILD' });
    assert.equal(acquireRunClaim({ repo, runId: 'killed-run', owner: 'killed-supervisor', nowMs: NOW - 3_600_000, ttlSeconds: TTL }).ok, true);
    assert.equal(acquireClaim({ repo, scope: 'task', key: 'ASYNC-SHARED', owner: 'live-scheduler', nowMs: NOW - 10_000, ttlSeconds: TTL }).ok, true);

    const runs = classifyRuns({ repo, nowMs: NOW });
    const killed = runs.find((r) => r.runId === 'killed-run')!;
    const scheduled = runs.find((r) => r.runId === 'scheduled-run')!;

    assert.equal(killed.liveness, 'LOST', 'a HELD run claim is authoritative for its OWN run id');
    assert.equal(killed.claim?.scope, 'run', 'the verdict cites the run own claim, not the slice claim');
    assert.equal(killed.heartbeatAgeSeconds, 3600);
    // The autopilot mints no run claim, so the scheduled run is still covered by the task claim.
    assert.equal(scheduled.liveness, 'LIVE');
    assert.equal(scheduled.claim?.scope, 'task');
    assert.equal(scheduled.heartbeatAgeSeconds, 10);

    const recovery = autopilotRecover({ repo, nowMs: NOW });

    assert.deepEqual(recovery.runUpdates.map((u) => u.runId), ['killed-run'], 'the dead run is demoted despite the live slice claim');
    assert.equal(loadState(repo, 'killed-run').phase, 'BLOCKED');
    assert.equal(loadState(repo, 'killed-run').candidateSha, 'd'.repeat(40), 'its candidate is retained');
    assert.deepEqual(recovery.recoveredClaims.map((c) => `${c.scope}:${c.key}`), ['run:killed-run'], 'only the stale claim is released');
    assert.equal(loadState(repo, 'scheduled-run').phase, 'BUILD', 'the live scheduled run is untouched');
    assert.equal(currentClaim(repo, 'task', 'ASYNC-SHARED')?.state, 'HELD', 'the live task claim is untouched');
    assert.deepEqual(recovery.unprovenRuns, [], 'nothing is left in an unexplained state');
  } finally { dispose(repo); }
});

test('R2: an unreadable run state is reported, never classified as recoverable and never written over', () => {
  const repo = disposableRepo();
  try {
    persistedRun(repo, { runId: 'broken-run', phase: 'BUILD' });
    const file = statePath(repo, 'broken-run');
    fs.writeFileSync(file, '{ this is not a run state', 'utf8');
    const raw = fs.readFileSync(file, 'utf8');

    const [run] = classifyRuns({ repo, nowMs: NOW });
    assert.equal(run.liveness, 'UNREADABLE');
    assert.ok(run.error, 'the parse failure is reported as evidence');

    const recovery = autopilotRecover({ repo, nowMs: NOW });
    assert.deepEqual(recovery.runUpdates, [], 'recovery never writes a state it cannot read');
    assert.deepEqual(recovery.unprovenRuns.map((r) => r.runId), ['broken-run'], 'it is surfaced instead of being skipped');
    assert.equal(fs.readFileSync(file, 'utf8'), raw, 'the unreadable file is byte-identical afterwards');
    assert.throws(() => autopilotRecover({ repo, nowMs: NOW, recoverRunIds: ['broken-run'] }), /does not parse/);
  } finally { dispose(repo); }
});

/* ================================================ R5: fail-closed recovery of unproven runs */

test('R5: a run with no liveness evidence is never swept, is recovered only when named, and a live run is refused', () => {
  const repo = disposableRepo();
  try {
    persistedRun(repo, { runId: 'orphan-run', taskId: 'ASYNC-ORPHAN', phase: 'REVIEW', candidateSha: 'd'.repeat(40) });
    persistedRun(repo, { runId: 'live-run', taskId: 'ASYNC-LIVE', phase: 'BUILD' });
    persistedRun(repo, { runId: 'done-run', taskId: 'ASYNC-DONE', phase: 'DONE' });
    assert.equal(acquireRunClaim({ repo, runId: 'live-run', owner: 'live-supervisor', nowMs: NOW - 10_000, ttlSeconds: TTL }).ok, true);

    // A plain sweep leaves both alone: one is live, the other proves nothing.
    const sweep = autopilotRecover({ repo, nowMs: NOW });
    assert.deepEqual(sweep.runUpdates, []);
    assert.deepEqual(sweep.unprovenRuns.map((r) => r.runId), ['orphan-run'], 'the unproven run is reported for an operator decision');
    assert.equal(loadState(repo, 'orphan-run').phase, 'REVIEW');

    // Naming a LIVE run is refused, and the refusal happens before anything is written.
    assert.throws(() => autopilotRecover({ repo, nowMs: NOW, recoverRunIds: ['live-run', 'orphan-run'] }), /a live supervisor is never declared lost/);
    assert.equal(loadState(repo, 'orphan-run').phase, 'REVIEW', 'a refused sweep is not half applied');
    assert.equal(currentClaim(repo, 'run', 'live-run')?.state, 'HELD');

    // A terminal run and an unknown run are refused too: recovery never re-opens or invents one.
    assert.throws(() => autopilotRecover({ repo, nowMs: NOW, recoverRunIds: ['done-run'] }), /already terminal/);
    assert.throws(() => autopilotRecover({ repo, nowMs: NOW, recoverRunIds: ['no-such-run'] }), /no persisted run state/);

    const before = loadState(repo, 'orphan-run');
    const named = autopilotRecover({ repo, nowMs: NOW, recoverRunIds: ['orphan-run'] });
    assert.deepEqual(named.runUpdates.map((u) => `${u.runId}:${u.from}->${u.to}:${u.trigger}`), ['orphan-run:REVIEW->BLOCKED:operator']);
    assert.match(named.runUpdates[0].reason, /explicit operator instruction/);

    const after = loadState(repo, 'orphan-run');
    assert.equal(after.phase, 'BLOCKED');
    assert.ok(after.blockedReason?.startsWith(SUPERVISOR_LOST_BLOCK_PREFIX));
    assert.equal(after.candidateSha, before.candidateSha, 'the candidate is retained');
    assert.deepEqual(after.progressHistory, before.progressHistory);
    assert.deepEqual({ ...after, phase: before.phase, blockedReason: before.blockedReason }, before, 'exactly two fields changed');
    assert.deepEqual(loadLedger(repo).entries, [], 'no ledger row is created by run recovery');
  } finally { dispose(repo); }
});

test('R5: recovery releases a stale claim without granting anyone the right to keep writing', () => {
  const repo = disposableRepo();
  try {
    persistedRun(repo, { runId: 'lost-run', taskId: 'ASYNC-LOST', phase: 'BUILD' });
    const taken = acquireRunClaim({ repo, runId: 'lost-run', owner: 'lost-supervisor', nowMs: NOW - 3_600_000, ttlSeconds: TTL });
    assert.equal(taken.ok, true);
    if (!taken.ok) return;

    autopilotRecover({ repo, nowMs: NOW });

    // The dead owner's epoch is superseded, so its own release and heartbeat both fail closed.
    assert.equal(currentClaim(repo, 'run', 'lost-run')?.state, 'RELEASED');
    const late = releaseClaim({ repo, claim: taken.claim, nowMs: NOW + 1000, note: 'zombie release' });
    assert.equal(late.ok, false, 'a taken-over owner can never erase the recovering owner record');
  } finally { dispose(repo); }
});

/* ================================================================ R3: G3 wakeup primitive */

function scriptedWatch(polls: WatchPoll[]) {
  let i = 0;
  let clock = 0;
  const slept: number[] = [];
  return {
    slept,
    polled: () => i,
    poll: (): WatchPoll => polls[Math.min(i++, polls.length - 1)],
    now: () => clock,
    sleep: async (ms: number) => { slept.push(ms); clock += ms; },
  };
}

const nothing: WatchPoll = { readyIds: [], watchedRunPhase: null };

test('R3: the wakeup blocks until a slice is READY, then exits with what woke it', async () => {
  const s = scriptedWatch([nothing, nothing, { readyIds: ['ROOM-09'], watchedRunPhase: null }]);
  const result = await watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 1000, timeoutMs: 60_000 });

  assert.equal(result.wake, 'READY');
  assert.deepEqual(result.readyIds, ['ROOM-09']);
  assert.equal(result.polls, 3);
  assert.deepEqual(s.slept, [1000, 1000], 'it waits between observations instead of spinning');
  assert.equal(result.waitedMs, 2000);
});

test('R3: dependency wakeup — a named slice wakes only for itself', async () => {
  const other: WatchPoll = { readyIds: ['SOMETHING-ELSE'], watchedRunPhase: null };
  const mine: WatchPoll = { readyIds: ['SOMETHING-ELSE', 'ROOM-09'], watchedRunPhase: null };
  const s = scriptedWatch([other, other, mine]);
  const result = await watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 500, timeoutMs: 60_000, taskId: 'ROOM-09' });

  assert.equal(result.wake, 'READY');
  assert.deepEqual(result.readyIds, ['ROOM-09'], 'another READY slice is not this caller wakeup');
  assert.equal(result.polls, 3);
});

test('R3: a watched run reaching a terminal phase wakes the caller', async () => {
  const running: WatchPoll = { readyIds: [], watchedRunPhase: 'REMEDIATE' };
  const blocked: WatchPoll = { readyIds: [], watchedRunPhase: 'BLOCKED' };
  const s = scriptedWatch([running, blocked]);
  const result = await watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 1000, timeoutMs: 60_000, watchedRunId: 'some-run' });

  assert.equal(result.wake, 'RUN_TERMINAL');
  assert.equal(result.watchedRunPhase, 'BLOCKED');
  assert.equal(result.polls, 2);

  // An unknown phase is never a terminal verdict.
  const unknown = scriptedWatch([{ readyIds: [], watchedRunPhase: null }]);
  const timedOut = await watchForReadyWork({ poll: unknown.poll, now: unknown.now, sleep: unknown.sleep, intervalMs: 1000, timeoutMs: 1000, watchedRunId: 'some-run' });
  assert.equal(timedOut.wake, 'TIMEOUT');
});

test('R3: the wakeup is bounded, takes no claim, starts nothing and writes nothing', async () => {
  const repo = disposableRepo();
  try {
    const s = scriptedWatch([nothing]);
    const result = await watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 5000, timeoutMs: 12_000 });

    assert.equal(result.wake, 'TIMEOUT');
    assert.deepEqual(s.slept, [5000, 5000, 2000], 'the last wait never overshoots the deadline');
    assert.equal(result.waitedMs, 12_000);
    assert.deepEqual(listClaims(repo, NOW), [], 'watching is not owning: no claim epoch is created');
    assert.deepEqual(listRunStates(repo), [], 'watching starts no run');
    assert.deepEqual(loadLedger(repo).entries, [], 'watching writes no scheduling state');

    await assert.rejects(() => watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 0, timeoutMs: 1000 }), /positive number of milliseconds/);
    await assert.rejects(() => watchForReadyWork({ poll: s.poll, now: s.now, sleep: s.sleep, intervalMs: 1000, timeoutMs: -1 }), /positive number of milliseconds/);
  } finally { dispose(repo); }
});

test('R3: the production poller reads the canonical backlog and the persisted run phase, nothing else', () => {
  const repo = disposableRepo();
  try {
    persistedRun(repo, { runId: 'watched-run', taskId: 'A', phase: 'BUILD' });
    const deps = harnessDeps(repo, { run: async () => { throw new Error('the poller must never start a run'); } });
    const poller = watchPoller({ repo, deps, selection: { selectedTaskIds: [] }, watchedRunId: 'watched-run' });

    const first = poller();
    assert.deepEqual([...first.readyIds], ['A'], 'the canonical evaluation is the source of READY, not a second backlog');
    assert.equal(first.watchedRunPhase, 'BUILD');
    assert.deepEqual(listClaims(repo, NOW), [], 'polling takes no claim');

    // A completed slice stops being READY through the ordinary ledger, with no scheduler involved.
    writeLedgerEntry(repo, { taskId: 'A', status: 'DONE', runId: 'a-run', baseSha: 'a'.repeat(40), candidateSha: 'd'.repeat(40), mergedMain: 'b'.repeat(40), reason: 'merged', updatedAt: new Date(NOW).toISOString() });
    assert.deepEqual([...poller().readyIds], ['B'], 'the next slice becomes READY without anything being scheduled');

    // A missing run is UNKNOWN, never terminal.
    assert.equal(watchPoller({ repo, deps, selection: { selectedTaskIds: [] }, watchedRunId: 'no-such-run' })().watchedRunPhase, null);
  } finally { dispose(repo); }
});

/* ================================================== R3: G4 no-ready-work marker */

const BASE = 'a'.repeat(40);
const MERGE = 'b'.repeat(40);
const CANDIDATE = 'd'.repeat(40);

function backlogOf(ids: readonly string[]): Backlog {
  const task = { description: 'synthetic slice', allowedWrite: ['tests/loop/**'], gates: [['npx', 'tsc', '--noEmit']] };
  return BacklogSchema.parse({
    version: 1,
    plan: 'docs/nortropic-control-room-plan-v1.md',
    planBaseSha: 'ae9d250240e47c40eccf72ff045198f8f5f054ea',
    note: 'synthetic backlog for asynchronous-ownership tests',
    items: ids.map((id, i) => ({
      id,
      order: i + 1,
      title: `slice ${id}`,
      summary: 'synthetic',
      planSection: 'synthetic',
      declaredStatus: 'PENDING',
      dependsOn: i === 0 ? [] : [ids[i - 1]],
      prerequisites: [],
      task,
    })),
  });
}

function twoSliceBacklog(): Backlog { return backlogOf(['A', 'B']); }

function doneState(a: { task: TaskSpec; baseSha: string; authorityClass: AuthorityClass }): RunState {
  return RunStateSchema.parse({
    version: 1,
    runId: `${a.task.id}-run`,
    task: a.task,
    authorityClass: a.authorityClass,
    baseSha: a.baseSha,
    branch: `claude/${a.task.id}-run`,
    worktree: `/tmp/${a.task.id}-run`,
    phase: 'DONE',
    attempt: 0,
    candidateSha: CANDIDATE,
    sessions: { architect: 'arch', builder: 'build', reviewer: 'review', visualReviewer: null },
    findings: [],
    advisoryFindings: [],
    prUrl: null,
    blockedReason: null,
  });
}

type Harness = { deps: AutopilotDeps; events: Array<{ event: string; fields: Record<string, unknown> }>; mainRef: { value: string } };

function harnessDeps(repo: string, o: { run: (a: { task: TaskSpec; authorityClass: AuthorityClass; baseSha: string }) => Promise<RunState>; merges?: boolean; main?: string; events?: Harness['events']; mainRef?: { value: string }; backlog?: Backlog }): AutopilotDeps {
  const mainRef = o.mainRef ?? { value: o.main ?? BASE };
  const backlog = o.backlog ?? twoSliceBacklog();
  return {
    now: () => NOW,
    originMain: () => mainRef.value,
    isMergeOfCandidate: () => !!o.merges,
    loadBacklog: () => backlog,
    externalEvidence: () => [],
    fileExists: () => true,
    runPrerequisiteCommand: () => true,
    readLedger: () => loadLedger(repo),
    writeEntry: (e) => { writeLedgerEntry(repo, e); },
    acquire: (a) => acquireClaim({ repo, scope: 'task', key: a.key, owner: a.owner, nowMs: a.nowMs, ttlSeconds: a.ttlSeconds }),
    release: (a) => { releaseClaim({ repo, claim: a.claim, nowMs: a.nowMs, note: a.note }); },
    heartbeat: (a) => ({ ok: true as const, claim: a.claim }),
    startRun: async (a) => await o.run(a),
    emit: (event, fields) => { o.events?.push({ event, fields }); },
  };
}

/** `autopilotStatus` needs deps only for the evaluation; nothing here may start or claim anything. */
function statusDeps(repo: string): AutopilotDeps {
  return harnessDeps(repo, { run: async () => { throw new Error('status must never start a run'); } });
}

test('R3: a pass that runs out of READY work emits an explicit, observer-consumable no-ready-work marker', async () => {
  const repo = disposableRepo();
  try {
    const events: Harness['events'] = [];
    const mainRef = { value: BASE };
    const deps = harnessDeps(repo, {
      mainRef,
      merges: true,
      events,
      // One slice only: after it merges there is genuinely nothing left to schedule, which is the
      // exact condition an observer needs stated — not "stopped", but "stopped because it is done".
      backlog: backlogOf(['A']),
      run: async (a) => { mainRef.value = MERGE; return doneState({ task: a.task, baseSha: a.baseSha, authorityClass: a.authorityClass }); },
    });
    const config = ConfigSchema.parse({ ...shipped, autopilot: { ...shipped.autopilot, enabled: true, maxTasks: 5 } });

    const result = await runAutopilot({ config, deps, selection: { selectedTaskIds: [] } });

    // The slice completed and merged, the loop continued, and the next iteration found no work.
    assert.equal(result.stopReason, 'IDLE');
    assert.equal(result.started.length, 1);
    const marker = events.find((e) => e.event === 'autopilot.no_ready_work');
    assert.ok(marker, `no-ready-work marker missing; events were ${events.map((e) => e.event).join(', ')}`);
    assert.equal(marker!.fields.completed_this_pass, 1, 'the marker states that work HAD completed before the backlog ran dry');
    assert.equal(marker!.fields.ready, 0);
    const stopped = events.filter((e) => e.event === 'autopilot.stopped');
    assert.equal(stopped.length, 1, 'exactly one stop marker per pass');
    assert.equal(stopped[0].fields.stop_reason, 'IDLE');
    assert.equal(events.indexOf(marker!) < events.indexOf(stopped[0]), true, 'the reason is stated before the stop');
  } finally { dispose(repo); }
});

test('R3: every other stop reason is marked too, and never as no-ready-work', async () => {
  const repo = disposableRepo();
  try {
    const events: Harness['events'] = [];
    const deps = harnessDeps(repo, { events, run: async (a) => doneState({ task: a.task, baseSha: a.baseSha, authorityClass: a.authorityClass }) });
    const config = ConfigSchema.parse({ ...shipped, autopilot: { ...shipped.autopilot, enabled: true, maxTasks: 1 } });

    const result = await runAutopilot({ config, deps, selection: { selectedTaskIds: [] } });

    assert.equal(result.stopReason, 'AWAITING_PUBLICATION');
    assert.equal(events.some((e) => e.event === 'autopilot.no_ready_work'), false, 'unpublished work is not the same statement as no work');
    assert.equal(events.filter((e) => e.event === 'autopilot.stopped')[0].fields.stop_reason, 'AWAITING_PUBLICATION');

    // A disarmed pass still says why it stopped, and still touches nothing.
    const disabledEvents: Harness['events'] = [];
    const disabled = harnessDeps(repo, { events: disabledEvents, run: async () => { throw new Error('a disabled autopilot must not run'); } });
    await runAutopilot({ config: shipped, deps: disabled, selection: { selectedTaskIds: [] } });
    assert.equal(disabledEvents.filter((e) => e.event === 'autopilot.stopped')[0].fields.stop_reason, 'DISABLED');
  } finally { dispose(repo); }
});

/* ============================================================ production wiring, as source facts */

test('the production CLI really exposes the recovery, classification and wakeup surfaces', () => {
  const cli = fs.readFileSync('scripts/claude-loop/cli.ts', 'utf8');
  assert.match(cli, /recoverRunIds: collectFlag\(args, '--run'\)/, 'autopilot-recover must accept explicit run ids');
  assert.match(cli, /RUN_UPDATE/, 'a recovered run state must be reported');
  assert.match(cli, /RUN_UNRECOVERED/, 'a run recovery refused to touch must be reported, not hidden');
  assert.match(cli, /status\.runs\.filter\(\(x\) => !x\.terminal\)/, 'autopilot-status must list unfinished runs');
  assert.match(cli, /classifyRuns\(\{ repo, nowMs: Date\.now\(\) \}\)/, 'claude:status must carry the liveness classification');
  assert.match(cli, /WATCH_WAKE=/, 'the wakeup must state what woke it');
  assert.match(cli, /heartbeat_age=/, 'stale-run classification is useless without the age');
  // One poll is a full canonical evaluation and can execute local_test prerequisite commands, so
  // the default interval is a deliberate cost decision rather than a UI refresh rate.
  assert.match(cli, /positiveIntFlag\(args, '--interval-ms', 60_000\)/, 'the poll interval default must be proportionate to a full evaluation');

  const supervisor = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(supervisor, /startRunFromTask\(\{ repo, config, task, authorityClass, runClaim: true \}\)/, 'a direct claude:run must be claim-covered');
  assert.match(supervisor, /acquireRunClaim\(\{ repo, runId, owner: ownerToken\('run'\)/, 'the direct run claim is an ordinary run claim');
  assert.match(supervisor, /releaseClaim\(\{ repo, claim: claimed\.claim, nowMs: Date\.now\(\), note: 'released after run' \}\)/, 'a finished run releases its claim');

  // The scheduler is still the ONLY scheduler: the wakeup decides nothing.
  const autopilot = fs.readFileSync('scripts/claude-loop/autopilot.ts', 'utf8');
  /** Executable source only: a doc comment naming a field is documentation, not a write. */
  const code = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const watchBody = code(autopilot.slice(autopilot.indexOf('export async function watchForReadyWork('), autopilot.indexOf('export function watchPoller(')));
  for (const forbidden of ['acquireClaim', 'startRun', 'writeEntry', 'saveState', 'selectNextItem']) {
    assert.equal(watchBody.includes(forbidden), false, `the wakeup must not ${forbidden}: it observes, it does not schedule`);
  }
  // Recovery writes exactly two fields of a re-read run state: it can neither rewrite the
  // append-only history nor touch a candidate, a branch, a worktree or any Git object.
  const recoverBody = code(autopilot.slice(autopilot.indexOf('export function autopilotRecover(')));
  for (const forbidden of ['progressHistory', 'worktree', 'branch', 'candidateSha', 'rmSync', 'gitRun', 'git(']) {
    assert.equal(recoverBody.includes(forbidden), false, `recovery must never touch ${forbidden}`);
  }
  assert.match(recoverBody, /saveState\(args\.repo, \{ \.\.\.fresh, phase: 'BLOCKED', blockedReason: reason \}\)/, 'the demotion is a two-field write on a freshly re-read state');
});

test('the canonical backlog is still the only backlog the wakeup and the scheduler read', () => {
  const autopilot = fs.readFileSync('scripts/claude-loop/autopilot.ts', 'utf8');
  const loaders = autopilot.match(/deps\.loadBacklog\(\)|args\.deps\.loadBacklog\(\)/g) ?? [];
  assert.ok(loaders.length >= 1, 'the backlog is loaded through the injected canonical loader');
  assert.equal(/backlog\/control-room-v1\.json/.test(autopilot), false, 'no second or repurposed backlog file is referenced');
  // The wakeup reuses `evaluateNow`, i.e. the same evaluation the scheduler makes its decisions on.
  assert.match(autopilot, /export function watchPoller\([\s\S]*?evaluateNow\(\{ deps: args\.deps, selection: args\.selection \}\)/);
  // And the one materialization path is unchanged.
  const repo = disposableRepo();
  try {
    const item = twoSliceBacklog().items[0];
    assert.equal(materializeTask(item, { baseSha: BASE, authorityClass: 'ordinary' }).id, 'A');
    assert.deepEqual(listClaims(repo, NOW), []);
  } finally { dispose(repo); }
});
