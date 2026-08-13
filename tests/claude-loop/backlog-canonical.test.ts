import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BacklogSchema,
  CANONICAL_BACKLOG_FILE,
  ExternalMeasurementSchema,
  evaluateBacklog,
  evaluatePrerequisite,
  loadBacklog,
  materializeTask,
  measurementKey,
  prerequisiteKey,
  selectNextItem,
  validateBacklog,
  type Backlog,
  type EvaluationContext,
  type ExternalMeasurement,
} from '../../scripts/claude-loop/backlog';
import { PROTECTED_AUTHORITY_PATHS } from '../../scripts/claude-loop/scope';
import { LedgerSchema, ledgerCompletedIds, ledgerOccupiedIds } from '../../scripts/claude-loop/ledger';

/** Predicate for `assert.throws`: any real Error passes; the point is that it fails closed. */
const isError = (e: unknown): e is Error => e instanceof Error;

const backlog = loadBacklog(process.cwd());
const repoFileExists = (p: string) => fs.existsSync(path.join(process.cwd(), p));

function ctx(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return {
    fileExists: repoFileExists,
    runCommand: () => true,
    externalEvidence: [],
    ledgerCompleted: new Set<string>(),
    ledgerOccupied: new Set<string>(),
    ownerAuthorSelection: { selectedTaskIds: [] },
    ...overrides,
  };
}

function statuses(evaluations: ReturnType<typeof evaluateBacklog>): Record<string, string> {
  return Object.fromEntries(evaluations.map((e) => [e.id, e.status]));
}

test('the canonical backlog is tracked repository data, not runtime state', () => {
  assert.equal(CANONICAL_BACKLOG_FILE, 'backlog/control-room-v1.json');
  assert.ok(fs.existsSync(path.join(process.cwd(), CANONICAL_BACKLOG_FILE)));
  assert.equal(backlog.plan, 'docs/nortropic-control-room-plan-v1.md');
  // Every plan slice V1..V11 is represented, plus the fixture-only intake slice.
  const ids = backlog.items.map((i) => i.id);
  for (const slice of ['V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11']) {
    assert.ok(ids.includes(slice), `plan slice ${slice} must be in the canonical backlog`);
  }
  assert.ok(ids.includes('V8-FIXTURE'));
});

test('V1-V3 are complete and every completion claim is backed by evidence that exists', () => {
  const evaluated = statuses(evaluateBacklog(backlog, ctx()));
  assert.equal(evaluated.V1, 'DONE');
  assert.equal(evaluated.V2, 'DONE');
  assert.equal(evaluated.V3, 'DONE');
  for (const item of backlog.items.filter((i) => i.declaredStatus === 'DONE')) {
    assert.ok(item.completionEvidence.length > 0, `${item.id} must carry evidence`);
    for (const evidence of item.completionEvidence) {
      assert.ok(repoFileExists(evidence), `${item.id} evidence ${evidence} must exist on disk`);
    }
  }
});

test('a DONE claim whose evidence is missing becomes BLOCKED and never satisfies a dependency', () => {
  const lying = ctx({ fileExists: (p) => (p === 'lib/loop/schema.ts' ? false : repoFileExists(p)) });
  const evaluations = evaluateBacklog(backlog, lying);
  const evaluated = statuses(evaluations);
  assert.equal(evaluated.V1, 'BLOCKED', 'a DONE claim is believed only while its evidence exists');
  assert.match(evaluations.find((e) => e.id === 'V1')!.reasons[0], /completion evidence is missing/);
  // A completion built on an unproven slice is not a completion either: the doubt propagates.
  assert.equal(evaluated.V2, 'BLOCKED');
  assert.match(evaluations.find((e) => e.id === 'V2')!.reasons[0], /declared DONE but depends on slices that are not complete: V1/);
  assert.equal(evaluated.V3, 'BLOCKED');
  assert.equal(evaluated['V8-FIXTURE'], 'WAITING', 'and nothing downstream becomes schedulable');
  assert.equal(selectNextItem(evaluations), null, 'a doubtful backlog schedules nothing at all');
});

test('the fixture-only intake slice is the only READY slice, and is honest about being fixture-only', () => {
  const evaluations = evaluateBacklog(backlog, ctx());
  const ready = evaluations.filter((e) => e.status === 'READY').map((e) => e.id);
  assert.deepEqual(ready, ['V8-FIXTURE'], `only the fixture slice may be ready today, got ${ready.join(',')}`);

  const item = backlog.items.find((i) => i.id === 'V8-FIXTURE')!;
  assert.equal(item.fixtureOnly, true);
  assert.equal(item.liveCounterpart, 'V8', 'a fixture slice must name the live slice it is not');
  assert.deepEqual(item.dependsOn, ['V1', 'V2', 'V3'], 'the fixture slice depends only on fixture-buildable slices');
  assert.equal(item.prerequisites.some((p) => p.kind.startsWith('external')), false, 'a fixture slice must not claim a backend prerequisite');
  // The materialized task tells the builder, in words, that this is never live-complete.
  const task = materializeTask(item, { baseSha: null, authorityClass: 'ordinary' });
  assert.match(task.description, /FIXTURE-ONLY SLICE/);
  assert.match(task.description, /Never describe this slice as live-complete/);
  assert.match(task.description, /live counterpart is V8/);
  // And it cannot reach a live surface even if a model wanted to.
  assert.equal(task.allowedWrite.includes('app/api/loop/**'), false);
  assert.ok(task.deniedWrite.includes('app/api/**'));
  const readyEvaluation = evaluations.find((e) => e.id === 'V8-FIXTURE')!;
  assert.match(readyEvaluation.reasons[0], /FIXTURE-ONLY/);
});

test('every backend-live slice carries mechanical backend prerequisites and stays WAITING while unmet', () => {
  const evaluated = evaluateBacklog(backlog, ctx());
  const backendSlices: Record<string, string[]> = {
    V4: ['S5', 'S13'],
    V5: ['S1', 'S4', 'S13'],
    V6: ['S8'],
    V7: ['S13'],
    V8: ['S10', 'S13'],
    V9: ['S5'],
  };
  for (const [id, slices] of Object.entries(backendSlices)) {
    const item = backlog.items.find((i) => i.id === id)!;
    const declared = item.prerequisites.filter((p) => p.kind === 'external_slice').map((p) => (p.kind === 'external_slice' ? p.slice : ''));
    assert.deepEqual(declared.sort(), [...slices].sort(), `${id} must name its backend slices`);
    for (const p of item.prerequisites) {
      if (p.kind === 'external_slice') assert.equal(p.repository, 'Nortropic/nortropic-system');
    }
    const evaluation = evaluated.find((e) => e.id === id)!;
    assert.equal(evaluation.status, 'WAITING', `${id} must stay WAITING while its backend prerequisites are unmet`);
    assert.ok(evaluation.reasons.length > 0, `${id} must say why it waits`);
  }
});

test('a backend prerequisite is met only by an exact owner measurement, never by prose or optimism', () => {
  const item = backlog.items.find((i) => i.id === 'V9')!;
  const s5 = item.prerequisites.find((p) => p.kind === 'external_slice')!;
  assert.equal(prerequisiteKey(s5), 'Nortropic/nortropic-system#slice:S5');

  const unmet = evaluatePrerequisite(s5, ctx());
  assert.equal(unmet.met, false);
  assert.match(unmet.reason, /no owner-measured evidence/);
  assert.match(unmet.reason, /never infers it/);

  const measurement: ExternalMeasurement = ExternalMeasurementSchema.parse({
    repository: 'Nortropic/nortropic-system',
    slice: 'S5',
    sha: '0b3212c991d4227c8df2656465ae2c0252dda39e',
    measuredBy: 'owner',
    measuredAt: '2026-08-13T09:00:00.000Z',
  });
  assert.equal(measurementKey(measurement), prerequisiteKey(s5));
  assert.equal(evaluatePrerequisite(s5, ctx({ externalEvidence: [measurement] })).met, true);

  // A near-miss measurement is not a match: wrong repository, wrong slice, or not owner-measured.
  const wrongSlice = ExternalMeasurementSchema.parse({ ...measurement, slice: 'S13' });
  assert.equal(evaluatePrerequisite(s5, ctx({ externalEvidence: [wrongSlice] })).met, false);
  const wrongRepo = ExternalMeasurementSchema.parse({ ...measurement, repository: 'Nortropic/verkstadsgolvet' });
  assert.equal(evaluatePrerequisite(s5, ctx({ externalEvidence: [wrongRepo] })).met, false);
  assert.throws(() => ExternalMeasurementSchema.parse({ ...measurement, measuredBy: 'model' }), isError, 'only an owner measurement is evidence');
  assert.throws(() => ExternalMeasurementSchema.parse({ ...measurement, sha: 'not-a-sha' }), isError, 'a measurement must carry a real commit sha');
});

test('an owner-measured backend slice unblocks exactly its dependants and nothing else', () => {
  const measured = [
    ExternalMeasurementSchema.parse({ repository: 'Nortropic/nortropic-system', slice: 'S5', sha: 'a'.repeat(40), measuredBy: 'owner', measuredAt: '2026-08-13T09:00:00.000Z' }),
    ExternalMeasurementSchema.parse({ repository: 'Nortropic/nortropic-system', slice: 'S13', sha: 'b'.repeat(40), measuredBy: 'owner', measuredAt: '2026-08-13T09:00:00.000Z' }),
  ];
  const evaluated = statuses(evaluateBacklog(backlog, ctx({ externalEvidence: measured })));
  assert.equal(evaluated.V4, 'READY', 'V4 becomes schedulable once S5 and S13 are owner-measured');
  assert.equal(evaluated.V5, 'WAITING', 'V5 still waits on its own dependency V4 and on S1/S4');
  assert.equal(evaluated.V9, 'WAITING', 'V9 still waits on V4 even though S5 is measured');
  assert.equal(evaluated.V6, 'WAITING');
});

test('dependencies gate scheduling even when every prerequisite is met', () => {
  const item = backlog.items.find((i) => i.id === 'V10')!;
  assert.deepEqual(item.dependsOn, ['V7']);
  const evaluation = evaluateBacklog(backlog, ctx()).find((e) => e.id === 'V10')!;
  assert.equal(evaluation.status, 'WAITING');
  assert.deepEqual(evaluation.unmetDependencies, ['V7']);
  assert.match(evaluation.reasons[0], /unmet dependencies: V7/);
  // Marking the dependency complete in the ledger — and only that — releases it.
  const released = evaluateBacklog(backlog, ctx({ ledgerCompleted: new Set(['V7']) })).find((e) => e.id === 'V10')!;
  assert.equal(released.status, 'READY');
});

test('a failing local test prerequisite keeps a slice WAITING and is measured, not assumed', () => {
  const commands: string[][] = [];
  const failing = ctx({ runCommand: (command) => { commands.push(command); return false; } });
  const evaluation = evaluateBacklog(backlog, failing).find((e) => e.id === 'V8-FIXTURE')!;
  assert.equal(evaluation.status, 'WAITING');
  assert.match(evaluation.reasons[0], /loop:test failed/);
  assert.deepEqual(commands, [['npm', 'run', 'loop:test']], 'the prerequisite command is actually executed');

  // Cheap prerequisites are evaluated first, and a failure short-circuits the expensive ones, so a
  // slice that is already waiting never spends minutes running product test suites.
  const synthetic = BacklogSchema.parse({
    version: 1,
    plan: 'docs/nortropic-control-room-plan-v1.md',
    planBaseSha: 'ae9d250240e47c40eccf72ff045198f8f5f054ea',
    note: 'synthetic fixture for prerequisite ordering',
    items: [{
      id: 'SYN', order: 1, title: 'synthetic', summary: 'synthetic', planSection: 'none',
      declaredStatus: 'PENDING', dependsOn: [],
      prerequisites: [
        { kind: 'local_test', command: ['npm', 'run', 'expensive'] },
        { kind: 'local_file', path: 'absent-file.ts' },
      ],
      task: { description: 'synthetic', allowedWrite: ['tests/loop/**'], gates: [['npx', 'tsc', '--noEmit']] },
    }],
  });
  const shortCircuited = evaluateBacklog(synthetic, ctx({
    fileExists: () => false,
    runCommand: () => { throw new Error('local test must not run once a cheaper prerequisite failed'); },
  }))[0];
  assert.equal(shortCircuited.status, 'WAITING');
  assert.equal(shortCircuited.prerequisites[0].prerequisite.kind, 'local_file', 'the cheap check runs first');
  assert.equal(shortCircuited.prerequisites[0].met, false);
  assert.equal(shortCircuited.prerequisites[1].evaluated, false, 'the expensive check is not evaluated');
  assert.match(shortCircuited.prerequisites[1].reason, /not evaluated/);
});

test('selection is deterministic: lowest order first, identical across repeated evaluations', () => {
  const measured = [ExternalMeasurementSchema.parse({ repository: 'Nortropic/nortropic-system', slice: 'S5', sha: 'a'.repeat(40), measuredBy: 'owner', measuredAt: 'now' }),
    ExternalMeasurementSchema.parse({ repository: 'Nortropic/nortropic-system', slice: 'S13', sha: 'b'.repeat(40), measuredBy: 'owner', measuredAt: 'now' })];
  const first = evaluateBacklog(backlog, ctx({ externalEvidence: measured }));
  const second = evaluateBacklog({ ...backlog, items: [...backlog.items].reverse() }, ctx({ externalEvidence: measured }));

  assert.deepEqual(first.map((e) => e.id), second.map((e) => e.id), 'evaluation order never depends on file order');
  assert.deepEqual(first.map((e) => e.order), [...first.map((e) => e.order)].sort((a, b) => a - b));
  assert.equal(selectNextItem(first)?.id, 'V4', 'the lowest-order READY slice wins');
  assert.equal(selectNextItem(second)?.id, 'V4');
  // Skipping a claimed slice moves deterministically to the next one, never to a random one.
  assert.equal(selectNextItem(first, new Set(['V4']))?.id, 'V8-FIXTURE');
  assert.equal(selectNextItem(first, new Set(['V4', 'V8-FIXTURE'])), null);
});

test('a slice already in the ledger is never scheduled twice, which is what makes restart safe', () => {
  const at = '2026-08-13T10:00:00.000Z';
  for (const status of ['RUNNING', 'AWAITING_PUBLICATION', 'BLOCKED'] as const) {
    const ledger = LedgerSchema.parse({ version: 1, entries: [{ taskId: 'V8-FIXTURE', status, updatedAt: at }] });
    const evaluation = evaluateBacklog(backlog, ctx({ ledgerOccupied: ledgerOccupiedIds(ledger), ledgerCompleted: ledgerCompletedIds(ledger) })).find((e) => e.id === 'V8-FIXTURE')!;
    assert.equal(evaluation.status, 'WAITING', `a ${status} ledger entry must not be re-selected`);
    assert.match(evaluation.reasons[0], /ledger already holds an entry/);
    assert.equal(selectNextItem(evaluateBacklog(backlog, ctx({ ledgerOccupied: ledgerOccupiedIds(ledger) }))), null, `nothing is schedulable while ${status} stands`);
  }
  const doneLedger = LedgerSchema.parse({ version: 1, entries: [{ taskId: 'V8-FIXTURE', status: 'DONE', updatedAt: at }] });
  const done = evaluateBacklog(backlog, ctx({ ledgerOccupied: ledgerOccupiedIds(doneLedger), ledgerCompleted: ledgerCompletedIds(doneLedger) })).find((e) => e.id === 'V8-FIXTURE')!;
  assert.equal(done.status, 'DONE', 'a completed slice reads as complete, not as blocked');
  assert.match(done.reasons[0], /recorded complete in the autopilot ledger/);
});

test('an owner-author slice is never scheduled from repository data alone', () => {
  const item = backlog.items.find((i) => i.id === 'OM1')!;
  assert.equal(item.authorityClass, 'owner-author');
  // It writes a protected workflow-authority document, which is exactly why it needs the lane.
  assert.ok(item.task.allowedWrite.some((p) => PROTECTED_AUTHORITY_PATHS.includes(p)));

  const unselected = evaluateBacklog(backlog, ctx()).find((e) => e.id === 'OM1')!;
  assert.equal(unselected.status, 'WAITING');
  assert.match(unselected.reasons[0], /requires an explicit supervisor selection/);
  assert.equal(selectNextItem(evaluateBacklog(backlog, ctx()))?.id, 'V8-FIXTURE', 'it is never picked implicitly');

  const selected = evaluateBacklog(backlog, ctx({ ownerAuthorSelection: { selectedTaskIds: ['OM1'] } })).find((e) => e.id === 'OM1')!;
  assert.equal(selected.status, 'READY', 'an explicit supervisor selection is the only way in');
});

test('structural integrity is enforced, so a malformed backlog cannot schedule anything', () => {
  const base = (): Backlog => BacklogSchema.parse(JSON.parse(JSON.stringify(backlog)));

  const duplicateId = base();
  duplicateId.items[1] = { ...duplicateId.items[1], id: duplicateId.items[0].id };
  assert.throws(() => validateBacklog(duplicateId), /duplicate backlog id/);

  const duplicateOrder = base();
  duplicateOrder.items[1] = { ...duplicateOrder.items[1], order: duplicateOrder.items[0].order };
  assert.throws(() => validateBacklog(duplicateOrder), /duplicate backlog order/);

  const unknownDep = base();
  unknownDep.items[3] = { ...unknownDep.items[3], dependsOn: ['V99'] };
  assert.throws(() => validateBacklog(unknownDep), /depends on unknown id/);

  const cycle = base();
  cycle.items[0] = { ...cycle.items[0], dependsOn: ['V2'] };
  assert.throws(() => validateBacklog(cycle), /dependency cycle/);

  const dishonestFixture = base();
  dishonestFixture.items = dishonestFixture.items.map((i) => (i.id === 'V8-FIXTURE' ? { ...i, liveCounterpart: null } : i));
  assert.throws(() => validateBacklog(dishonestFixture), /must name its liveCounterpart/);

  const fixtureClaimingBackend = base();
  fixtureClaimingBackend.items = fixtureClaimingBackend.items.map((i) => (i.id === 'V8-FIXTURE'
    ? { ...i, prerequisites: [...i.prerequisites, { kind: 'external_slice' as const, repository: 'Nortropic/nortropic-system', slice: 'S10' }] }
    : i));
  assert.throws(() => validateBacklog(fixtureClaimingBackend), /must not carry external backend prerequisites/);

  const evidenceFreeDone = base();
  evidenceFreeDone.items = evidenceFreeDone.items.map((i) => (i.id === 'V1' ? { ...i, completionEvidence: [] } : i));
  assert.throws(() => validateBacklog(evidenceFreeDone), /claims DONE without completionEvidence/);
});

test('materialized tasks carry the exact declared scope and mechanical gates', () => {
  for (const item of backlog.items) {
    const task = materializeTask(item, { baseSha: null, authorityClass: item.authorityClass });
    assert.equal(task.id, item.id);
    assert.deepEqual(task.allowedWrite, item.task.allowedWrite);
    assert.deepEqual(task.gates, item.task.gates);
    assert.ok(task.gates.length > 0, `${item.id} must carry mechanical gates`);
    for (const gate of task.gates) assert.ok(Array.isArray(gate) && gate.every((a) => typeof a === 'string' && a.length), 'gates are argv arrays, never shell strings');
    assert.match(task.description, /Plan section:/);
    // No slice may declare that it writes the plan or the codex handoff.
    for (const pattern of task.allowedWrite) {
      assert.notEqual(pattern, 'docs/nortropic-control-room-plan-v1.md');
      assert.notEqual(pattern, 'docs/nortropic-control-room-codex-handoff.md');
    }
  }
});
