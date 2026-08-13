import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { ConfigSchema, RunStateSchema, type FactoryConfig, type RunState, type TaskSpec } from '../../scripts/claude-loop/schemas';
import { BacklogSchema, loadBacklog, materializeTask, type Backlog, type ExternalMeasurement } from '../../scripts/claude-loop/backlog';
import { autopilotRecover, autopilotStatus, runAutopilot, type AutopilotDeps } from '../../scripts/claude-loop/autopilot';
import { acquireClaim, currentClaim, heartbeatClaim, isClaimStale, listClaims, recoverStaleClaims, releaseClaim } from '../../scripts/claude-loop/claims';
import { autopilotDir, ledgerEntryDir, ledgerPath, ledgerOccupiedIds, loadLedger, saveLedger, writeLedgerEntry, type Ledger } from '../../scripts/claude-loop/ledger';
import { commonGitDir } from '../../scripts/claude-loop/util';
import type { AuthorityClass, AuthoritySelection } from '../../scripts/claude-loop/authority';

/**
 * Hermetic autopilot suite.
 *
 * The scheduler runs against a DISPOSABLE Git repository with REAL claim files and a REAL ledger
 * under that repository's common directory, while `origin/main`, the merge-parent proof and the
 * supervised run itself are injected seams. Nothing here can reach the real repository, start a
 * model, push, create a PR or move any branch.
 *
 * "Restart" is modelled the way it actually happens: a brand new deps object with an empty heap,
 * reading the same files. If any scheduling memory lived in the process instead of on disk, the
 * restart assertions would fail.
 */
const BASE_A = 'a'.repeat(40);
const MERGE_A = 'b'.repeat(40);
const FOREIGN = 'c'.repeat(40);
const CANDIDATE_A = 'd'.repeat(40);
const CANDIDATE_B = 'e'.repeat(40);

const EMPTY_SELECTION: AuthoritySelection = { selectedTaskIds: [] };

/** The harness clock. Claim freshness is asserted against it, never against the wall clock. */
const NOW = Date.parse('2026-08-13T10:00:00.000Z');

function disposableRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-autopilot-'));
  execFileSync('git', ['init', '--initial-branch=main'], { cwd: root, stdio: 'ignore' });
  return root;
}

function config(overrides: Partial<FactoryConfig['autopilot']> = {}): FactoryConfig {
  const shipped = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
  return ConfigSchema.parse({ ...shipped, autopilot: { ...shipped.autopilot, enabled: true, maxTasks: 3, ...overrides } });
}

function twoSliceBacklog(): Backlog {
  const task = { description: 'synthetic slice', allowedWrite: ['tests/loop/**'], gates: [['npx', 'tsc', '--noEmit']] };
  return BacklogSchema.parse({
    version: 1,
    plan: 'docs/nortropic-control-room-plan-v1.md',
    planBaseSha: 'ae9d250240e47c40eccf72ff045198f8f5f054ea',
    note: 'synthetic backlog for autopilot tests',
    items: [
      { id: 'A', order: 1, title: 'slice A', summary: 'first', planSection: 'synthetic', declaredStatus: 'PENDING', dependsOn: [], prerequisites: [], task },
      { id: 'B', order: 2, title: 'slice B', summary: 'second', planSection: 'synthetic', declaredStatus: 'PENDING', dependsOn: [], prerequisites: [], task },
      { id: 'C', order: 3, title: 'slice C', summary: 'depends on A', planSection: 'synthetic', declaredStatus: 'PENDING', dependsOn: ['A'], prerequisites: [], task },
    ],
  });
}

type StartCall = { taskId: string; baseSha: string; authorityClass: AuthorityClass; task: TaskSpec; heartbeat: () => void };

function doneState(a: { task: TaskSpec; baseSha: string; candidateSha: string | null; authorityClass: AuthorityClass }): RunState {
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
    candidateSha: a.candidateSha,
    sessions: { architect: 'arch', builder: 'build', reviewer: 'review', visualReviewer: null },
    findings: [],
    advisoryFindings: [],
    prUrl: null,
    blockedReason: null,
  });
}

type Harness = {
  deps: AutopilotDeps;
  starts: StartCall[];
  events: Array<{ event: string; fields: Record<string, unknown> }>;
  mainRef: { value: string };
  beats: () => number;
};

function harness(repo: string, o: {
  backlog?: Backlog;
  run: (call: StartCall) => Promise<RunState>;
  main?: string;
  merges?: (a: { mergeSha: string; baseSha: string; candidateSha: string }) => boolean;
  evidence?: ExternalMeasurement[];
  now?: number;
}): Harness {
  const starts: StartCall[] = [];
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const mainRef = { value: o.main ?? BASE_A };
  const backlog = o.backlog ?? twoSliceBacklog();
  let beats = 0;
  const deps: AutopilotDeps = {
    now: () => o.now ?? Date.parse('2026-08-13T10:00:00.000Z'),
    originMain: () => mainRef.value,
    isMergeOfCandidate: (a) => (o.merges ? o.merges(a) : false),
    loadBacklog: () => backlog,
    externalEvidence: () => o.evidence ?? [],
    fileExists: () => true,
    runPrerequisiteCommand: () => true,
    readLedger: () => loadLedger(repo),
    // The real per-task write path: one file per task id, never a whole-ledger rewrite.
    writeEntry: (e) => { writeLedgerEntry(repo, e); },
    acquire: (a) => acquireClaim({ repo, scope: 'task', key: a.key, owner: a.owner, nowMs: a.nowMs, ttlSeconds: a.ttlSeconds }),
    // The real release path, so the claim epochs in these tests are the production epochs.
    release: (a) => { releaseClaim({ repo, claim: a.claim, nowMs: a.nowMs, note: a.note }); },
    heartbeat: (a) => { beats += 1; return heartbeatClaim({ repo, claim: a.claim, nowMs: a.nowMs }); },
    startRun: async (a) => {
      const call: StartCall = { taskId: a.task.id, baseSha: a.baseSha, authorityClass: a.authorityClass, task: a.task, heartbeat: a.heartbeat };
      starts.push(call);
      return await o.run(call);
    },
    emit: (event, fields) => { events.push({ event, fields }); },
  };
  return { deps, starts, events, mainRef, beats: () => beats };
}

test('autopilot is disabled in the shipped configuration and starts nothing', async () => {
  const repo = disposableRepo();
  const shipped = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
  assert.equal(shipped.autopilot.enabled, false, 'the shipped example config must not arm the autopilot');

  const h = harness(repo, { run: async () => { throw new Error('no run may start while the autopilot is disabled'); } });
  // A disarmed autopilot touches nothing at all: no fetch, no claim, no ledger write, no run.
  h.deps.originMain = () => { throw new Error('a disabled autopilot must not even fetch'); };
  const result = await runAutopilot({ config: shipped, deps: h.deps, selection: EMPTY_SELECTION });

  assert.equal(result.stopReason, 'DISABLED');
  assert.equal(result.base, null);
  assert.ok(result.evaluations.length > 0, 'it still reports what it would have done');
  assert.equal(h.starts.length, 0);
  assert.equal(loadLedger(repo).entries.length, 0, 'a disabled pass writes no ledger entry');
  assert.deepEqual(listClaims(repo, Date.now()), [], 'a disabled pass takes no claim');
});

test('continue-after-merge: the next slice starts only once the reviewed candidate really is main', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    // The proof is Git parentage, not the API answer: only the exact merge of base+candidate counts.
    merges: (a) => a.mergeSha === MERGE_A && a.baseSha === BASE_A && a.candidateSha === CANDIDATE_A,
    run: async (call) => {
      if (call.taskId === 'A') { h.mainRef.value = MERGE_A; return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }); }
      return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_B, authorityClass: call.authorityClass });
    },
  });

  const result = await runAutopilot({ config: config({ maxTasks: 2 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['A', 'B'], 'deterministic order by backlog order');
  assert.equal(h.starts[0].baseSha, BASE_A);
  assert.equal(h.starts[1].baseSha, MERGE_A, 'the continued slice is based on the merged main, never on the stale base');
  assert.equal(result.stopReason, 'AWAITING_PUBLICATION', 'B produced a candidate that is not merged, so the pass stops there');

  const ledger = loadLedger(repo);
  assert.equal(ledger.entries.find((e) => e.taskId === 'A')?.status, 'DONE');
  assert.equal(ledger.entries.find((e) => e.taskId === 'A')?.mergedMain, MERGE_A);
  assert.equal(ledger.entries.find((e) => e.taskId === 'B')?.status, 'AWAITING_PUBLICATION');
  assert.ok(h.events.some((e) => e.event === 'autopilot.continue_after_merge'));
});

test('continue-after-merge can be switched off without becoming a publication decision', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    merges: () => true,
    run: async (call) => { h.mainRef.value = MERGE_A; return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }); },
  });

  const result = await runAutopilot({ config: config({ maxTasks: 3, continueAfterMerge: false }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['A']);
  assert.equal(result.stopReason, 'CONTINUE_AFTER_MERGE_DISABLED');
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'DONE');
});

test('an unmerged candidate stops the pass, is never treated as done, and blocks its dependants', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }),
  });

  const result = await runAutopilot({ config: config(), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['A'], 'the autopilot does not stack candidates on an unpublished base');
  assert.equal(result.stopReason, 'AWAITING_PUBLICATION');
  assert.equal(h.mainRef.value, BASE_A, 'the autopilot never moves main');
  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'A')!;
  assert.equal(entry.status, 'AWAITING_PUBLICATION');
  assert.equal(entry.mergedMain, null);
  assert.equal(entry.candidateSha, CANDIDATE_A);

  // C depends on A. An awaiting-publication A is not complete, so C is not schedulable.
  const status = autopilotStatus({ repo, deps: h.deps, selection: EMPTY_SELECTION, nowMs: Date.now() });
  assert.equal(status.evaluations.find((e) => e.id === 'C')?.status, 'WAITING');
  assert.match(status.evaluations.find((e) => e.id === 'C')!.reasons.join(' '), /unmet dependencies: A/);
});

test('base drift stops the autopilot without publishing, merging or rewriting anything', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    merges: () => false,
    run: async (call) => {
      // Someone else advanced main while this run was in flight.
      h.mainRef.value = FOREIGN;
      return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass });
    },
  });

  const result = await runAutopilot({ config: config(), deps: h.deps, selection: EMPTY_SELECTION });

  assert.equal(result.stopReason, 'BASE_DRIFT');
  assert.match(result.detail, /base drift/);
  assert.match(result.detail, new RegExp(FOREIGN));
  assert.deepEqual(h.starts.map((s) => s.taskId), ['A'], 'no further slice is started on a drifted base');
  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'A')!;
  assert.equal(entry.status, 'BLOCKED');
  assert.equal(entry.mergedMain, null, 'drift is never recorded as a merge');
  assert.match(entry.reason ?? '', /base drift/);
  assert.ok(h.events.some((e) => e.event === 'autopilot.base_drift'));
  // The claim is released so an operator can act, but the slice is not re-schedulable.
  assert.equal(currentClaim(repo, 'task', 'A')?.state, 'RELEASED');
  const after = autopilotStatus({ repo, deps: h.deps, selection: EMPTY_SELECTION, nowMs: Date.now() });
  assert.equal(after.evaluations.find((e) => e.id === 'A')?.status, 'WAITING');
});

test('remediation exhaustion blocks the slice, stops the pass and survives a restart', async () => {
  const repo = disposableRepo();
  const exhausted = 'remediation budget exhausted after 4 rounds';
  const first = harness(repo, { main: BASE_A, run: async () => { throw new Error(exhausted); } });

  const result = await runAutopilot({ config: config(), deps: first.deps, selection: EMPTY_SELECTION });

  assert.equal(result.stopReason, 'RUN_BLOCKED');
  assert.match(result.detail, /remediation budget exhausted/);
  assert.deepEqual(first.starts.map((s) => s.taskId), ['A'], 'a blocked slice never silently rolls on to the next one');
  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'A')!;
  assert.equal(entry.status, 'BLOCKED');
  assert.match(entry.reason ?? '', /remediation budget exhausted/);

  // RESTART: a brand new process with an empty heap must not retry the blocked slice, and must not
  // widen the remediation budget by rescheduling it. Independent slices remain available.
  const restarted = harness(repo, {
    main: BASE_A,
    run: async (call) => {
      assert.notEqual(call.taskId, 'A', 'a slice blocked by remediation exhaustion must never be retried by a restart');
      return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_B, authorityClass: call.authorityClass });
    },
  });
  const second = await runAutopilot({ config: config(), deps: restarted.deps, selection: EMPTY_SELECTION });
  assert.deepEqual(restarted.starts.map((s) => s.taskId), ['B'], 'the restart works on an independent slice instead');
  assert.deepEqual(second.evaluations.filter((e) => e.status === 'READY').map((e) => e.id), ['B'], 'A is not READY after the block');
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'BLOCKED', 'the block still stands');

  // Only an explicit operator decision makes it schedulable again.
  const recovery = autopilotRecover({ repo, nowMs: Date.now(), clearTaskIds: ['A'] });
  assert.deepEqual(recovery.ledgerUpdates.map((u) => `${u.taskId}:${u.from}->${u.to}`), ['A:BLOCKED->CLEARED']);
  const cleared = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }) });
  await runAutopilot({ config: config(), deps: cleared.deps, selection: EMPTY_SELECTION });
  assert.deepEqual(cleared.starts.map((s) => s.taskId), ['A']);
});

test('a restart never duplicates a run that a crashed supervisor left RUNNING', async () => {
  const repo = disposableRepo();
  // A crashed supervisor: a RUNNING ledger entry and a live claim, both on disk.
  saveLedger(repo, { version: 1, entries: [{ taskId: 'A', status: 'RUNNING', runId: 'a-run', baseSha: BASE_A, candidateSha: null, mergedMain: null, reason: 'crashed mid run', updatedAt: '2026-08-13T09:00:00.000Z' }] } as Ledger);
  const held = acquireClaim({ repo, scope: 'task', key: 'A', owner: 'crashed-supervisor', nowMs: Date.now(), ttlSeconds: 900 });
  assert.equal(held.ok, true);

  const h = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_B, authorityClass: call.authorityClass }) });
  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['B'], 'the restarted supervisor works on a different slice, never a second A run');
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'RUNNING', 'the crashed entry is left for recovery, not overwritten');
  assert.equal(currentClaim(repo, 'task', 'A')?.owner, 'crashed-supervisor');
});

test('a live claim held by another supervisor is skipped, never overridden', async () => {
  const repo = disposableRepo();
  const other = acquireClaim({ repo, scope: 'task', key: 'A', owner: 'supervisor-other', nowMs: Date.now(), ttlSeconds: 900 });
  assert.equal(other.ok, true);

  const h = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_B, authorityClass: call.authorityClass }) });
  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['B'], 'exactly one supervisor may build a given slice');
  assert.ok(h.events.some((e) => e.event === 'autopilot.claim_refused' && e.fields.task === 'A'));
  assert.equal(currentClaim(repo, 'task', 'A')?.owner, 'supervisor-other', 'the live claim is untouched');
});

test('operator recovery demotes an abandoned RUNNING entry and never invents a completion', () => {
  const repo = disposableRepo();
  const t0 = Date.parse('2026-08-13T10:00:00.000Z');
  saveLedger(repo, { version: 1, entries: [{ taskId: 'A', status: 'RUNNING', runId: 'a-run', baseSha: BASE_A, candidateSha: null, mergedMain: null, reason: 'started', updatedAt: '2026-08-13T09:00:00.000Z' }] } as Ledger);
  acquireClaim({ repo, scope: 'task', key: 'A', owner: 'crashed', nowMs: t0, ttlSeconds: 900 });

  const recovery = autopilotRecover({ repo, nowMs: t0 + 901_000 });

  assert.deepEqual(recovery.recoveredClaims.map((c) => c.key), ['A']);
  assert.deepEqual(recovery.ledgerUpdates.map((u) => `${u.taskId}:${u.from}->${u.to}`), ['A:RUNNING->BLOCKED']);
  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'A')!;
  assert.equal(entry.status, 'BLOCKED');
  assert.match(entry.reason ?? '', /was NOT completed/);
  assert.equal(currentClaim(repo, 'task', 'A')?.state, 'RELEASED');
});

test('a completed ledger entry is evidence and may not be cleared away', () => {
  const repo = disposableRepo();
  saveLedger(repo, { version: 1, entries: [{ taskId: 'A', status: 'DONE', runId: 'a-run', baseSha: BASE_A, candidateSha: CANDIDATE_A, mergedMain: MERGE_A, reason: 'merged', updatedAt: '2026-08-13T09:00:00.000Z' }] } as Ledger);
  assert.throws(() => autopilotRecover({ repo, nowMs: Date.now(), clearTaskIds: ['A'] }), /refusing to clear completed ledger entry/);
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'DONE');
});

test('all autopilot runtime state lives under the Git common directory, never in the working tree', async () => {
  const repo = disposableRepo();
  const h = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }) });
  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  const common = commonGitDir(repo);
  assert.equal(ledgerPath(repo), path.join(common, 'claude-factory', 'autopilot', 'ledger.json'));
  assert.equal(ledgerEntryDir(repo), path.join(common, 'claude-factory', 'autopilot', 'ledger'));
  assert.ok(autopilotDir(repo).startsWith(common + path.sep));
  // The scheduler writes per-task entry files, never the aggregate view.
  assert.deepEqual(fs.readdirSync(ledgerEntryDir(repo)), ['A.json']);
  assert.equal(fs.existsSync(ledgerPath(repo)), false, 'no whole-ledger rewrite happens during a pass');
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'AWAITING_PUBLICATION');
  assert.deepEqual(fs.readdirSync(repo).filter((n) => n !== '.git'), [], 'no operational state is written into the checkout');
});

/* ------------------------------------------------------------------ shared-ledger integrity */

test('two supervisors interleaving on the shared ledger never lose each others entries', async () => {
  const repo = disposableRepo();
  const at = '2026-08-13T10:00:00.000Z';

  // Supervisor A finished slice A and recorded DONE. Supervisor B is mid-run on slice B, with a
  // ledger snapshot taken BEFORE A's write — the classic lost-update setup.
  writeLedgerEntry(repo, { taskId: 'A', status: 'DONE', runId: 'a-run', baseSha: BASE_A, candidateSha: CANDIDATE_A, mergedMain: MERGE_A, reason: 'merged', updatedAt: at });
  const staleSnapshot = { version: 1, entries: [] } as Ledger;
  assert.deepEqual(staleSnapshot.entries, [], 'B holds a snapshot that predates A');

  // B now writes ITS entry. Because a write is per task id, A's record is untouched.
  writeLedgerEntry(repo, { taskId: 'B', status: 'RUNNING', runId: 'b-run', baseSha: BASE_A, candidateSha: null, mergedMain: null, reason: 'claimed and started', updatedAt: at });

  const merged = loadLedger(repo);
  assert.deepEqual(merged.entries.map((e) => `${e.taskId}:${e.status}`), ['A:DONE', 'B:RUNNING'], 'neither supervisor dropped the other');

  // A then writes a later update for its own key; B's RUNNING entry still stands.
  writeLedgerEntry(repo, { taskId: 'A', status: 'DONE', runId: 'a-run', baseSha: BASE_A, candidateSha: CANDIDATE_A, mergedMain: MERGE_A, reason: 'merged (re-recorded)', updatedAt: at });
  assert.deepEqual(loadLedger(repo).entries.map((e) => `${e.taskId}:${e.status}`), ['A:DONE', 'B:RUNNING']);

  // The consequence that matters: a surviving DONE record keeps merged work from being scheduled
  // again, and a surviving RUNNING record keeps a live slice unschedulable.
  const h = harness(repo, { main: MERGE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_B, authorityClass: call.authorityClass }) });
  const result = await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });
  assert.deepEqual(h.starts.map((s) => s.taskId), ['C'], 'only the untouched slice is schedulable');
  assert.equal(result.evaluations.find((e) => e.id === 'A')?.status, 'DONE');
  assert.equal(result.evaluations.find((e) => e.id === 'B')?.status, 'WAITING');
});

test('two concurrent supervisor processes both keep their ledger records', async () => {
  const repo = disposableRepo();
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-ledger-race-'));
  const childFile = path.join(scratch, 'writer.ts');
  const ledgerModule = path.resolve('scripts/claude-loop/ledger.ts');
  fs.writeFileSync(childFile, `
import { writeLedgerEntry } from ${JSON.stringify(ledgerModule)};
const [repo, taskId, status, startAt] = process.argv.slice(2);
while (Date.now() < Number(startAt)) { /* spin to the shared start instant */ }
for (let i = 0; i < 40; i++) {
  writeLedgerEntry(repo, { taskId, status: status as never, runId: taskId + '-run', baseSha: null, candidateSha: null, mergedMain: null, reason: 'iteration ' + i, updatedAt: new Date().toISOString() });
}
process.stdout.write('done');
`, 'utf8');

  const startAt = Date.now() + 2000;
  await Promise.all([['A', 'DONE'], ['B', 'RUNNING'], ['C', 'AWAITING_PUBLICATION']].map(([taskId, status]) => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', childFile, repo, taskId, status, String(startAt)], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stderr.on('data', (d) => { err += String(d); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`writer ${taskId} exited ${code}: ${err}`))));
  })));
  fs.rmSync(scratch, { recursive: true, force: true });

  const ledger = loadLedger(repo);
  assert.deepEqual(ledger.entries.map((e) => `${e.taskId}:${e.status}`), ['A:DONE', 'B:RUNNING', 'C:AWAITING_PUBLICATION'], 'no concurrent writer lost another writer record');
  // And nothing partial survived: every file parses, so the scheduler is never failed closed by a torn write.
  assert.deepEqual(fs.readdirSync(ledgerEntryDir(repo)).sort(), ['A.json', 'B.json', 'C.json']);
});

test('the scheduler writes only its own task key, never the aggregate ledger', async () => {
  const repo = disposableRepo();
  const foreign = { taskId: 'B', status: 'DONE' as const, runId: 'b-run', baseSha: BASE_A, candidateSha: CANDIDATE_B, mergedMain: MERGE_A, reason: 'merged by another supervisor', updatedAt: '2026-08-13T09:00:00.000Z' };
  writeLedgerEntry(repo, foreign);

  const written: string[] = [];
  const h = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }) });
  const realWrite = h.deps.writeEntry;
  h.deps.writeEntry = (e) => { written.push(e.taskId); realWrite(e); };

  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual([...new Set(written)], ['A'], 'the pass touched exactly the key it claimed');
  assert.deepEqual(loadLedger(repo).entries.find((e) => e.taskId === 'B'), foreign, 'the foreign DONE record is byte-identical afterwards');
});

/* ----------------------------------------------------------------------- claim keepalive */

test('the claim is heartbeated across the whole run, so recovery cannot steal a live slice', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    run: async (call) => {
      // A long run: the supervisor beats at its own checkpoints while it works.
      for (const _round of Array.from({ length: 5 })) call.heartbeat();
      const live = currentClaim(repo, 'task', 'A')!;
      assert.equal(isClaimStale(live, NOW + 899_000), false, 'the claim is fresh while the run works');
      assert.deepEqual(recoverStaleClaims({ repo, nowMs: NOW + 899_000, owner: 'operator' }).map((r) => r.key), [], 'recovery must not touch a beating claim');
      return doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass });
    },
  });

  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.ok(h.beats() >= 5, `the run beat its claim, got ${h.beats()}`);
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'AWAITING_PUBLICATION');
});

test('a supervisor whose claim was taken over stops instead of writing the slice outcome', async () => {
  const repo = disposableRepo();
  const h = harness(repo, {
    main: BASE_A,
    run: async (call) => {
      // Another supervisor recovers this claim as stale mid-run.
      const takeover = acquireClaim({ repo, scope: 'task', key: 'A', owner: 'supervisor-B', nowMs: NOW + 901_000, ttlSeconds: 900 });
      assert.equal(takeover.ok, true);
      call.heartbeat(); // fail-closed: this must throw
      throw new Error('the taken-over supervisor kept running');
    },
  });

  const result = await runAutopilot({ config: config({ maxTasks: 2 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.equal(result.stopReason, 'CLAIM_LOST');
  assert.match(result.detail, /claim lost: task\/A/);
  assert.deepEqual(h.starts.map((s) => s.taskId), ['A'], 'it does not roll on to another slice after losing its claim');
  // It recorded RUNNING before starting, but wrote NOTHING once it no longer owned the slice.
  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'A')!;
  assert.equal(entry.status, 'RUNNING', 'the outcome belongs to the supervisor that holds the claim now');
  assert.equal(currentClaim(repo, 'task', 'A')?.owner, 'supervisor-B', 'the new owner is untouched');
  assert.ok(h.events.some((e) => e.event === 'autopilot.claim_lost'));
  assert.ok(h.events.some((e) => e.event === 'autopilot.task_abandoned'));
});

/* -------------------------------------------------- visual configuration is a pre-run invariant */

/** The preview configuration proven by the persisted successful V2 Factory run. */
const PROVEN_VISUAL = {
  previewCommand: ['/usr/bin/env', 'LOOP_ENABLED=true', 'npm', 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '4317'],
  previewUrl: 'http://127.0.0.1:4317/loop',
  readyTimeoutMs: 120000,
  authenticated: true,
  viewports: [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 900, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ],
};

/** Writes a backlog FILE so it is loaded through the real production `loadBacklog` path. */
function backlogFile(visual: Record<string, unknown> | null): string {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-visual-backlog-')), 'backlog.json');
  fs.writeFileSync(file, JSON.stringify({
    version: 1,
    plan: 'docs/nortropic-control-room-plan-v1.md',
    planBaseSha: 'ae9d250240e47c40eccf72ff045198f8f5f054ea',
    note: 'synthetic backlog for visual pre-run validation',
    items: [{
      id: 'A', order: 1, title: 'a visual slice', summary: 'visual', planSection: 'synthetic',
      declaredStatus: 'PENDING', dependsOn: [], prerequisites: [],
      task: {
        description: 'synthetic visual slice',
        allowedWrite: ['components/loop/**'],
        gates: [['npx', 'tsc', '--noEmit']],
        visualReview: true,
        ...(visual ? { visual } : {}),
      },
    }],
  }, null, 2), 'utf8');
  return file;
}

test('a visual slice without preview configuration stops the pass before any claim, ledger entry or run', async () => {
  const repo = disposableRepo();
  const defective = backlogFile(null);
  const h = harness(repo, { main: BASE_A, run: async () => { throw new Error('no run may start from an invalid backlog'); } });
  // The production load path, unchanged: the scheduler re-reads and validates the backlog first.
  h.deps.loadBacklog = () => loadBacklog(defective);

  await assert.rejects(
    () => runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION }),
    /sets visualReview=true but declares no task\.visual preview configuration/,
    'canonical validation fails before scheduling, not inside the run',
  );

  assert.deepEqual(h.starts.map((s) => s.taskId), [], 'no Claude run is started');
  assert.deepEqual(loadLedger(repo).entries, [], 'no ledger entry is written for a task that could never run');
  assert.equal(fs.existsSync(ledgerEntryDir(repo)), false, 'not even the ledger directory is created');
  assert.deepEqual(listClaims(repo, NOW), [], 'no claim is taken and no claim epoch advances');
  assert.equal(currentClaim(repo, 'task', 'A'), null);
});

test('a correctly configured visual slice reaches the run with its proven preview configuration intact', async () => {
  const repo = disposableRepo();
  const configured = backlogFile(PROVEN_VISUAL);
  const h = harness(repo, { main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }) });
  h.deps.loadBacklog = () => loadBacklog(configured);

  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  assert.deepEqual(h.starts.map((s) => s.taskId), ['A'], 'ordinary visual work is not blocked by the stricter validation');
  const started = h.starts[0].task;
  assert.equal(started.visualReview, true);
  assert.deepEqual(started.visual, PROVEN_VISUAL, 'the supervisor receives exactly the declared preview, argv included');
  assert.deepEqual(started.visual!.previewCommand, PROVEN_VISUAL.previewCommand, 'previewCommand stays an argv array, element by element');
  assert.equal(loadLedger(repo).entries.find((e) => e.taskId === 'A')?.status, 'AWAITING_PUBLICATION');
});

test('the persisted V8-FIXTURE record carries no Factory run or candidate, and this repair creates none', () => {
  const repo = process.cwd();
  // Everything this test does is READ-ONLY against the real runtime state; the snapshot proves it.
  const snapshot = () => JSON.stringify({ ledger: loadLedger(repo), claims: listClaims(repo, NOW) });
  const before = snapshot();

  const entry = loadLedger(repo).entries.find((e) => e.taskId === 'V8-FIXTURE');
  if (entry) {
    assert.equal(entry.runId, null, 'the discovered defect stopped V8-FIXTURE before any Factory run existed');
    assert.equal(entry.candidateSha, null, 'no V8-FIXTURE candidate was ever produced');
    assert.equal(entry.mergedMain, null, 'nothing about V8-FIXTURE was ever merged into main');
    assert.notEqual(entry.status, 'DONE', 'the slice is not complete and this repair does not claim it is');
    assert.equal(ledgerOccupiedIds(loadLedger(repo)).has('V8-FIXTURE'), true, 'the persisted entry keeps V8-FIXTURE unschedulable until an operator clears it deliberately');
  }

  // Loading, validating and materializing the canonical backlog is a pure read: it starts no run,
  // writes no ledger entry, takes no claim and clears nothing.
  const canonical = loadBacklog(repo);
  for (const item of canonical.items) materializeTask(item, { baseSha: null, authorityClass: item.authorityClass });
  assert.equal(snapshot(), before, 'validating the canonical backlog mutated no persisted autopilot state');
});

test('the materialized task carries the exact backlog scope into the run', async () => {
  const repo = disposableRepo();
  const backlog = twoSliceBacklog();
  const h = harness(repo, { backlog, main: BASE_A, run: async (call) => doneState({ task: call.task, baseSha: call.baseSha, candidateSha: CANDIDATE_A, authorityClass: call.authorityClass }) });
  await runAutopilot({ config: config({ maxTasks: 1 }), deps: h.deps, selection: EMPTY_SELECTION });

  const started = h.starts[0];
  const expected = materializeTask(backlog.items[0], { baseSha: BASE_A, authorityClass: 'ordinary' });
  assert.deepEqual(started.task, expected);
  assert.equal(started.authorityClass, 'ordinary', 'nothing in a backlog file can start a run in the owner lane');
  assert.equal(started.task.baseSha, BASE_A, 'the run is pinned to the base the scheduler measured');
});
