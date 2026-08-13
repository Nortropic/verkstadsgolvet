import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BacklogSchema,
  CANONICAL_BACKLOG_FILE,
  ExternalMeasurementSchema,
  assertMaterializesToTask,
  evaluateBacklog,
  evaluatePrerequisite,
  loadBacklog,
  materializeTask,
  measurementKey,
  prerequisiteKey,
  selectNextItem,
  validateBacklog,
  type Backlog,
  type BacklogItem,
  type EvaluationContext,
  type ExternalMeasurement,
} from '../../scripts/claude-loop/backlog';
import { TaskSchema, isLoopbackPreviewTarget } from '../../scripts/claude-loop/schemas';
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

/* --------------------------------------------------------- visual configuration, before any run */

/**
 * The one canonical V8-FIXTURE visual target: the intake surface this fixture slice actually
 * changes. A screenshot of `/loop` is evidence about a different surface, so the target carries the
 * `/loop/mata` path explicitly. Same loopback origin, so it stays credential-safe.
 */
const V8_FIXTURE_PREVIEW_URL = 'http://127.0.0.1:4317/loop/mata';

/**
 * The preview configuration for V8-FIXTURE. Transport is exactly what the persisted successful V2
 * Factory run proved: `/usr/bin/env` carries `LOOP_ENABLED=true` into `npm run dev`, whose own `--`
 * separator forwards the host/port argv to Next.js. It is an argv array, so no shell ever
 * interprets it. Port, ready timeout, authenticated mode and the three viewports are unchanged; only
 * the URL path points at the surface under review.
 */
const PROVEN_VISUAL = {
  previewCommand: ['/usr/bin/env', 'LOOP_ENABLED=true', 'npm', 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '4317'],
  previewUrl: V8_FIXTURE_PREVIEW_URL,
  readyTimeoutMs: 120000,
  authenticated: true,
  viewports: [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 900, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ],
};

type RawBacklog = { items: Array<{ id: string; task: Record<string, unknown> }> };

const canonicalJson = (): RawBacklog => JSON.parse(fs.readFileSync(path.join(process.cwd(), CANONICAL_BACKLOG_FILE), 'utf8')) as RawBacklog;

/** Loads a mutated copy of the canonical backlog through the REAL production load path. */
function loadMutatedCanonical(id: string, mutate: (task: Record<string, unknown>) => void): Backlog {
  const json = canonicalJson();
  const item = json.items.find((i) => i.id === id);
  assert.ok(item, `${id} must exist in the canonical backlog`);
  mutate(item.task);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'claude-backlog-')), 'control-room-v1.json');
  fs.writeFileSync(file, JSON.stringify(json, null, 2), 'utf8');
  return loadBacklog(file);
}

const visualItems = (): BacklogItem[] => backlog.items.filter((i) => i.task.visualReview);

test('every canonical visualReview slice carries a TaskSchema-valid preview configuration', () => {
  const ids = visualItems().map((i) => i.id);
  assert.ok(ids.includes('V8-FIXTURE'), 'the visual slices must include V8-FIXTURE');
  assert.deepEqual(ids, ['V5', 'V8-FIXTURE', 'V8', 'V11', 'V6'], `visual slices changed: ${ids.join(',')}`);

  for (const item of visualItems()) {
    assert.ok(item.task.visual, `${item.id} declares visual review and must declare how the preview is started`);
    const visual = item.task.visual!;
    // The materialized task — what the supervisor actually runs — carries it verbatim.
    const task = materializeTask(item, { baseSha: null, authorityClass: item.authorityClass });
    assert.equal(TaskSchema.safeParse(task).success, true, `${item.id} must materialize into a TaskSchema-valid task`);
    assert.equal(task.visualReview, true);
    assert.deepEqual(task.visual, visual, `${item.id} preview configuration must survive materialization unchanged`);
    // argv semantics: a list of arguments, never a shell string handed to a shell.
    assert.ok(Array.isArray(visual.previewCommand) && visual.previewCommand.length >= 1);
    for (const arg of visual.previewCommand) assert.equal(typeof arg === 'string' && arg.length > 0, true);
    assert.equal(new URL(visual.previewUrl).protocol.startsWith('http'), true);
    assert.ok(visual.readyTimeoutMs > 0);
    assert.deepEqual(visual.viewports.map((v) => v.name), ['desktop', 'tablet', 'mobile'], `${item.id} must capture all three viewports`);
    // Credential-bearing previews are loopback-only, everywhere in the canonical backlog.
    if (visual.authenticated) assert.equal(isLoopbackPreviewTarget(visual.previewUrl), true, `${item.id} may only type credentials into a loopback origin`);
  }
});

test('V8-FIXTURE carries exactly the preview configuration proven by the successful V2 Factory run', () => {
  // Asserted against the tracked FILE, so the proof is about repository data and not about defaults.
  const raw = canonicalJson().items.find((i) => i.id === 'V8-FIXTURE')!;
  assert.deepEqual(raw.task.visual, PROVEN_VISUAL);

  const item = backlog.items.find((i) => i.id === 'V8-FIXTURE')!;
  assert.equal(item.task.visualReview, true);
  assert.deepEqual(item.task.visual, PROVEN_VISUAL);
  const task = materializeTask(item, { baseSha: null, authorityClass: 'ordinary' });
  assert.deepEqual(task.visual, PROVEN_VISUAL, 'the run receives the proven configuration, not a default');
  assert.deepEqual(task.visual!.previewCommand, PROVEN_VISUAL.previewCommand, 'the env/npm/-- argv semantics are preserved element by element');
  assert.equal(task.visual!.previewUrl, V8_FIXTURE_PREVIEW_URL);
  assert.equal(task.visual!.readyTimeoutMs, 120000);
  assert.equal(task.visual!.authenticated, true);
  assert.equal(isLoopbackPreviewTarget(task.visual!.previewUrl), true);
  assert.deepEqual(task.visual!.viewports, [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 900, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]);
});

test('the V8-FIXTURE visual target is the intake surface the slice changes, on the same loopback origin', () => {
  // Asserted on the tracked FILE and on every derived form, so no layer can quietly retarget it.
  const raw = canonicalJson().items.find((i) => i.id === 'V8-FIXTURE')!;
  const rawVisual = raw.task.visual as { previewUrl: string; authenticated: boolean };
  const item = backlog.items.find((i) => i.id === 'V8-FIXTURE')!;
  const task = materializeTask(item, { baseSha: null, authorityClass: 'ordinary' });

  for (const [label, url] of [
    ['tracked file', rawVisual.previewUrl],
    ['loaded backlog', item.task.visual!.previewUrl],
    ['materialized task', task.visual!.previewUrl],
  ] as const) {
    assert.equal(url, V8_FIXTURE_PREVIEW_URL, `${label} must target the intake surface`);
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/loop/mata', `${label} path must be exactly the intake route`);
    assert.notEqual(parsed.pathname, '/loop', `${label} must not fall back to the shell route this slice does not change`);
    // The allowedWrite surface of this slice is app/(app)/loop/mata/**, so the evidence covers it.
    assert.equal(parsed.origin, 'http://127.0.0.1:4317', `${label} keeps the proven loopback origin and port`);
    assert.equal(isLoopbackPreviewTarget(url), true, `${label} must stay loopback while credentials are typed`);
  }
  assert.equal(rawVisual.authenticated, true, 'the intake surface is behind auth, so the capture stays authenticated');
  assert.equal(task.visual!.authenticated, true);
  assert.ok(
    item.task.allowedWrite.some((p) => p.includes('loop/mata')),
    'the retarget is only honest while the slice actually writes the intake route',
  );
});

test('visualReview=false never requires a preview configuration', () => {
  const ordinary = backlog.items.filter((i) => !i.task.visualReview);
  assert.ok(ordinary.length > 0);
  for (const item of ordinary) {
    assert.equal(item.task.visual, undefined, `${item.id} does not do visual review and declares no preview`);
    const task = materializeTask(item, { baseSha: null, authorityClass: item.authorityClass });
    assert.equal(task.visualReview, false);
    assert.equal(task.visual, undefined);
    assertMaterializesToTask(item); // and it validates without one
  }
  // Turning visual review OFF for a slice with no preview keeps the canonical backlog valid.
  const loaded = loadMutatedCanonical('V8-FIXTURE', (task) => { task.visualReview = false; delete task.visual; });
  assert.equal(loaded.items.find((i) => i.id === 'V8-FIXTURE')?.task.visualReview, false);
});

test('a visual slice without preview configuration fails canonical backlog validation, before any run or claim', () => {
  // The real production load path: `loadBacklog` refuses the file outright.
  assert.throws(
    () => loadMutatedCanonical('V8-FIXTURE', (task) => { delete task.visual; }),
    /backlog item V8-FIXTURE sets visualReview=true but declares no task\.visual preview configuration/,
  );
  // Nothing about that defect can be reached later: the loaded backlog object never exists, so no
  // evaluation, no selection, no claim and no ledger entry can be derived from it.
  assert.throws(() => loadMutatedCanonical('V5', (task) => { delete task.visual; }), /V5/);
  assert.throws(() => loadMutatedCanonical('V6', (task) => { delete task.visual; }), /never discovered after a run has been claimed and started/);

  // The same refusal applies to an already-parsed backlog object, so a mutated in-memory backlog is
  // not a way around it either.
  const stripped = BacklogSchema.parse(JSON.parse(JSON.stringify(backlog)));
  stripped.items = stripped.items.map((i) => (i.id === 'V8-FIXTURE' ? { ...i, task: { ...i.task, visual: undefined } } : i));
  assert.throws(() => validateBacklog(stripped), /sets visualReview=true but declares no task\.visual/);
  assert.throws(() => assertMaterializesToTask(stripped.items.find((i) => i.id === 'V8-FIXTURE')!), /V8-FIXTURE/);
});

test('an unusable or unsafe preview configuration fails canonical backlog validation too', () => {
  const cases: Array<{ label: string; visual: Record<string, unknown>; expect: RegExp }> = [
    { label: 'empty argv', visual: { ...PROVEN_VISUAL, previewCommand: [] }, expect: /previewCommand|too_small|at least/i },
    { label: 'shell string instead of argv', visual: { ...PROVEN_VISUAL, previewCommand: 'npm run dev' }, expect: /previewCommand|expected array/i },
    { label: 'unparsable url', visual: { ...PROVEN_VISUAL, previewUrl: 'not-a-url' }, expect: /previewUrl|url/i },
    { label: 'zero-size viewport', visual: { ...PROVEN_VISUAL, viewports: [{ name: 'desktop', width: 0, height: 1000 }] }, expect: /width|greater than/i },
    { label: 'negative ready timeout', visual: { ...PROVEN_VISUAL, readyTimeoutMs: -1 }, expect: /readyTimeoutMs|greater than/i },
    // The loopback-only barrier for credential-bearing previews, enforced on canonical data.
    { label: 'authenticated remote origin', visual: { ...PROVEN_VISUAL, previewUrl: 'https://example.com/loop' }, expect: /loopback/ },
    { label: 'authenticated lookalike host', visual: { ...PROVEN_VISUAL, previewUrl: 'http://127.0.0.1.evil.example/loop' }, expect: /loopback/ },
  ];
  for (const c of cases) {
    assert.throws(() => loadMutatedCanonical('V8-FIXTURE', (task) => { task.visual = c.visual; }), c.expect, `${c.label} must fail canonical validation`);
  }
});

test('anonymous remote visual review is still permitted; only credential-bearing previews are restricted', () => {
  const loaded = loadMutatedCanonical('V8-FIXTURE', (task) => {
    task.visual = { previewCommand: ['npm', 'run', 'dev'], previewUrl: 'https://staging.example.com/loop', authenticated: false };
  });
  const item = loaded.items.find((i) => i.id === 'V8-FIXTURE')!;
  assert.equal(item.task.visual?.authenticated, false);
  assert.equal(item.task.visual?.previewUrl, 'https://staging.example.com/loop');
  // Defaults still apply to an anonymous preview, so it is complete without repeating them.
  assert.equal(item.task.visual?.readyTimeoutMs, 60000);
  assert.equal(item.task.visual?.viewports.length, 3);
});

test('the visual invariant does not touch ordinary builder scope or gates', () => {
  for (const item of backlog.items) {
    const before = { allowedWrite: item.task.allowedWrite, deniedWrite: item.task.deniedWrite, gates: item.task.gates };
    const task = materializeTask(item, { baseSha: null, authorityClass: item.authorityClass });
    assert.deepEqual(task.allowedWrite, before.allowedWrite, `${item.id} allowed-write scope is unchanged by the visual repair`);
    assert.deepEqual(task.deniedWrite, before.deniedWrite, `${item.id} denied-write scope is unchanged by the visual repair`);
    assert.deepEqual(task.gates, before.gates, `${item.id} mechanical gates are unchanged by the visual repair`);
  }
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
