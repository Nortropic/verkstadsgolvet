import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABSOLUTE_ROUND_BACKSTOP,
  ABSOLUTE_BACKSTOP_BLOCK_PREFIX,
  NO_PROGRESS_BLOCK_PREFIX,
  LEGACY_REMEDIATION_BUDGET_BLOCK_PREFIX,
  absoluteBackstopBlockedReason,
  classifyProgress,
  endsWithOwnerExtension,
  findingFingerprint,
  findingFiles,
  findingSetFingerprint,
  gateFailureFingerprint,
  gateFailureSetFingerprint,
  historyAfterLastOwnerExtension,
  isOwnerExtendableBlockedReason,
  isRelevantChange,
  normalizeFindingMessage,
  ownerExtensionRecord,
} from '../../scripts/claude-loop/progress';
import {
  circuitBreakerResumeRefusal,
  execute,
  extendRemediationBudget,
  extendRemediationState,
  resumeRun,
  startRunFromTask,
  supervisorAuthoritySelection,
  loadConfig,
  type RunDeps,
} from '../../scripts/claude-loop/supervisor';
import { ConfigSchema, RunStateSchema, TaskSchema, type FactoryConfig, type Finding, type ProgressRecord, type RoleResult, type RunState, type TaskSpec } from '../../scripts/claude-loop/schemas';
import { loadState, statePath } from '../../scripts/claude-loop/state';
import { commonGitDir, git, gitRun, assertSafeGitArgs } from '../../scripts/claude-loop/util';
import { acquireClaim, currentClaim, listClaims, ownerToken } from '../../scripts/claude-loop/claims';
import { autopilotRecover } from '../../scripts/claude-loop/autopilot';
import { AuthorityEscalationError, OWNER_AUTHOR_SELF_CLAIM_CODE, laneForAuthorityClass, resolveAuthorityClass } from '../../scripts/claude-loop/authority';

/**
 * Hermetic circuit-breaker suite.
 *
 * Every run here is a REAL supervised run — real worktree, real append-only candidate commits, real
 * post-write scope validation, real claims, real persisted run state under a DISPOSABLE repository's
 * Git common directory — with the Claude sessions, the mechanical gates, the screenshot capture and
 * publication injected as scripted seams. Nothing can reach the real repository, start a model,
 * push, create a PR or move any branch.
 *
 * "Restart" is modelled the way it actually happens: a brand new deps object and a state re-read
 * from disk. If retry entitlement lived in the process instead of in the append-only history, the
 * resume assertions would fail.
 */

const shipped: FactoryConfig = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));

/* ------------------------------------------------------------------ disposable repo */

type Factory = { root: string; repo: string; worktreeRoot: string };

function disposableFactory(): Factory {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-breaker-'));
  const repo = path.join(root, 'repo');
  const bare = path.join(root, 'origin.git');
  fs.mkdirSync(path.join(repo, 'work'), { recursive: true });
  fs.writeFileSync(path.join(repo, 'work', 'seed.txt'), 'seed\n', 'utf8');
  fs.writeFileSync(path.join(repo, 'README.md'), '# disposable factory fixture\n', 'utf8');
  // The evidence directory of a visual review is git-ignored exactly as in the real repository, so
  // screenshots never enter a changed-file set.
  fs.writeFileSync(path.join(repo, '.gitignore'), '/.claude-loop.json\n/.claude-loop/\n', 'utf8');
  fs.copyFileSync('.claude-loop.example.json', path.join(repo, '.claude-loop.example.json'));
  gitRun(repo, ['init', '-b', 'main']);
  gitRun(repo, ['add', '--all']);
  gitRun(repo, ['-c', 'user.name=Breaker Test', '-c', 'user.email=breaker@nortropic.local', 'commit', '-m', 'fixture base']);
  gitRun(root, ['init', '--bare', bare]);
  gitRun(repo, ['remote', 'add', 'origin', bare]);
  gitRun(repo, ['push', '-u', 'origin', 'main']);
  return { root, repo, worktreeRoot: path.join(root, 'worktrees') };
}

function dispose(f: Factory): void {
  fs.rmSync(f.root, { recursive: true, force: true });
}

/** Overrides are schema INPUT: every task in this suite is parsed by the real TaskSchema. */
function taskSpec(over: Record<string, unknown> = {}): TaskSpec {
  return TaskSchema.parse({
    id: 'BREAKER',
    title: 'circuit breaker fixture',
    description: 'synthetic slice',
    allowedWrite: ['work/**'],
    deniedWrite: ['work/secret/**'],
    gates: [['true']],
    ...over,
  });
}

const VISUAL = { previewCommand: ['node', '-e', '0'], previewUrl: 'http://localhost:3999' };

/** The single persisted run of a disposable factory. */
function onlyRunId(repo: string): string {
  const root = path.join(commonGitDir(repo), 'claude-factory', 'runs');
  const ids = fs.readdirSync(root).filter((d) => fs.existsSync(path.join(root, d, 'state.json')));
  assert.equal(ids.length, 1, 'exactly one run is expected in a disposable factory');
  return ids[0];
}

/* ------------------------------------------------------------------- scripted roles */

const ARCHITECT: RoleResult = { outcome: 'READY', summary: 'planned', findings: [], tests: [], changed_files: [], next_action: 'BUILD' };
const BUILT: RoleResult = { outcome: 'READY', summary: 'built', findings: [], tests: [], changed_files: [], next_action: 'REVIEW' };
const PASS: RoleResult = { outcome: 'READY', summary: 'clean', findings: [], tests: [], changed_files: [], next_action: 'DONE' };

function finding(a: { id: string; message: string; file?: string; line?: number; severity?: Finding['severity'] }): Finding {
  return { id: a.id, severity: a.severity ?? 'major', message: a.message, ...(a.file ? { file: a.file } : {}), ...(a.line ? { line: a.line } : {}) };
}

function findings(...f: Finding[]): RoleResult {
  return { outcome: 'NEEDS_REMEDIATION', summary: 'findings', findings: f, tests: [], changed_files: [], next_action: 'REMEDIATE' };
}

function notes(...f: Finding[]): RoleResult {
  return { outcome: 'READY', summary: 'clean with advisories', findings: f, tests: [], changed_files: [], next_action: 'DONE' };
}

/** Builder behaviour for one round: write into the worktree, optionally return a role result. */
type BuilderStep = (worktree: string, call: number) => RoleResult | void;

function writes(...files: string[]): BuilderStep {
  return (wt, call) => {
    for (const f of files) {
      const p = path.join(wt, f);
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.appendFileSync(p, `round ${call} line\n`, 'utf8');
    }
  };
}

/** READY without touching a single file: the adversarial no-change remediation. */
const writesNothing: BuilderStep = () => BUILT;

type GateOutcome = { ok: boolean; failures: Array<{ command: string[]; output: string }> };

function gateFailure(output: string, command: string[] = ['true']): GateOutcome {
  return { ok: false, failures: [{ command, output }] };
}

const GATES_OK: GateOutcome = { ok: true, failures: [] };

type Script = {
  worktreeRoot: string;
  builder: BuilderStep[];
  reviewer?: Array<RoleResult | ((worktree: string) => RoleResult)>;
  visual?: RoleResult[];
  gates?: GateOutcome[];
};

function scripted(o: Script) {
  const roles: string[] = [];
  const prompts: string[] = [];
  let bi = 0, ri = 0, vi = 0, gi = 0;
  const deps: RunDeps = {
    worktreeRoot: o.worktreeRoot,
    runRole: async (a) => {
      roles.push(a.role);
      prompts.push(a.prompt);
      if (a.role === 'architect') return { sessionId: 'architect-session', result: ARCHITECT };
      if (a.role === 'builder' || a.role === 'owner-author') {
        assert.ok(bi < o.builder.length, `unexpected extra ${a.role} invocation #${bi + 1}`);
        const step = o.builder[bi++];
        return { sessionId: a.resume ?? `builder-session`, result: step(a.cwd, bi - 1) ?? BUILT };
      }
      if (a.role === 'reviewer') {
        assert.ok(o.reviewer && ri < o.reviewer.length, `unexpected extra reviewer invocation #${ri + 1}`);
        const step = o.reviewer![ri++];
        return { sessionId: `reviewer-session-${ri}`, result: typeof step === 'function' ? step(a.cwd) : step };
      }
      assert.ok(o.visual && vi < o.visual.length, `unexpected extra visual-reviewer invocation #${vi + 1}`);
      return { sessionId: `visual-session-${++vi}`, result: o.visual![vi - 1] };
    },
    runGates: async () => o.gates?.[gi++] ?? (gi++, GATES_OK),
    captureVisualEvidence: async (_task, _cwd, outDir) => {
      fs.mkdirSync(outDir, { recursive: true });
      const shot = path.join(outDir, 'desktop.png');
      fs.writeFileSync(shot, 'png', 'utf8');
      return { files: [shot], stop: () => {} };
    },
    publish: () => { throw new Error('publication must never run in the circuit-breaker suite'); },
  };
  return { deps, roles, prompts, counts: () => ({ builder: bi, reviewer: ri, visual: vi, gates: gi }) };
}

async function runFactory(f: Factory, script: Omit<Script, 'worktreeRoot'>, over: { task?: Record<string, unknown>; config?: FactoryConfig } = {}) {
  const h = scripted({ ...script, worktreeRoot: f.worktreeRoot });
  const task = taskSpec(over.task);
  const state = await startRunFromTask({ repo: f.repo, config: over.config ?? shipped, task, authorityClass: 'ordinary', deps: h.deps });
  return { h, state, task };
}

async function runFactoryExpectingBlock(f: Factory, script: Omit<Script, 'worktreeRoot'>, over: { task?: Record<string, unknown>; config?: FactoryConfig } = {}) {
  const h = scripted({ ...script, worktreeRoot: f.worktreeRoot });
  const task = taskSpec(over.task);
  let error: Error | null = null;
  try {
    await startRunFromTask({ repo: f.repo, config: over.config ?? shipped, task, authorityClass: 'ordinary', deps: h.deps });
  } catch (e) {
    error = e as Error;
  }
  assert.ok(error, 'the run was expected to fail closed');
  const state = loadState(f.repo, onlyRunId(f.repo));
  return { h, error: error!, state, task };
}

const kinds = (history: readonly ProgressRecord[]): string[] => history.map((r) => `${r.source}:${r.kind}`);

/* ================================================================== pure classifier */

test('finding fingerprints are phrasing-tolerant and deliberately blind to reviewer ids and line numbers', () => {
  assert.equal(normalizeFindingMessage('  Missing   NULL check\non LINE 42 '), 'missing null check on line #');

  const first = finding({ id: 'reviewer-1', message: 'Missing NULL check on line 42', file: 'work/a.txt', line: 42 });
  const reworded = finding({ id: 'r-91', message: 'missing   null check\non line 1337', file: 'work/a.txt', line: 1337 });
  assert.equal(findingFingerprint(first), findingFingerprint(reworded), 'a renumbered, re-wrapped restatement is the SAME finding');
  assert.equal(findingSetFingerprint([first]), findingSetFingerprint([reworded]));

  // Severity and file are part of the identity; message content is too.
  assert.notEqual(findingSetFingerprint([first]), findingSetFingerprint([{ ...first, severity: 'blocker' }]));
  assert.notEqual(findingSetFingerprint([first]), findingSetFingerprint([{ ...first, file: 'work/b.txt' }]));
  assert.notEqual(findingSetFingerprint([first]), findingSetFingerprint([{ ...first, message: 'something else entirely' }]));

  // Order is not information; notes never are.
  const a = finding({ id: 'x', message: 'alpha', file: 'work/a.txt' });
  const b = finding({ id: 'y', message: 'beta', file: 'work/b.txt' });
  assert.equal(findingSetFingerprint([a, b]), findingSetFingerprint([b, a]));
  const note = finding({ id: 'n', message: 'future slice idea', severity: 'note' });
  assert.equal(findingSetFingerprint([a, note]), findingSetFingerprint([a]), 'advisories can never change a fingerprint');
  assert.equal(findingSetFingerprint([note]), findingSetFingerprint([]), 'a note-only review is an EMPTY actionable set');
  assert.deepEqual(findingFiles([a, b, note]), ['work/a.txt', 'work/b.txt']);

  // The fingerprint is a SHA-256 over sorted parts, so it is stable across processes.
  assert.match(findingSetFingerprint([a]), /^[0-9a-f]{64}$/);
});

test('fingerprint parts cannot collide across fields, and the Factory sources stay reviewable text', () => {
  // A delimiter that can occur inside a field would make two DIFFERENT findings fingerprint the
  // same, which is a false no-progress block on genuinely different work.
  const split = finding({ id: 'a', message: 'c', file: 'work/a b' });
  const shifted = finding({ id: 'a', message: 'b c', file: 'work/a' });
  assert.notEqual(findingSetFingerprint([split]), findingSetFingerprint([shifted]), 'field boundaries must be unambiguous');
  const gateSplit = { command: ['npm', 'run', 'x y'], output: 'z' };
  const gateShifted = { command: ['npm', 'run', 'x'], output: 'y z' };
  assert.notEqual(gateFailureSetFingerprint([gateSplit]), gateFailureSetFingerprint([gateShifted]));

  // And the encoding must not smuggle control characters into the source: a NUL byte makes Git
  // classify a tracked file as BINARY, which would hand the independent reviewer an unreadable
  // diff of the very module that decides when a run may continue.
  for (const dir of ['scripts/claude-loop', 'tests/claude-loop']) {
    for (const entry of fs.readdirSync(dir)) {
      if (!entry.endsWith('.ts')) continue;
      const bytes = fs.readFileSync(path.join(dir, entry));
      assert.equal(bytes.includes(0), false, `${dir}/${entry} must be reviewable text, not a binary blob`);
    }
  }
});

test('gate fingerprints are the exact argv plus the first non-empty normalized output line', () => {
  const one = { command: ['npm', 'run', 'claude:test'], output: '\n\n  FAIL tests/x.test.ts line 12\nmore noise\n' };
  const two = { command: ['npm', 'run', 'claude:test'], output: 'fail   tests/x.test.ts LINE 987654\ncompletely different tail\n' };
  assert.equal(gateFailureFingerprint(one), gateFailureFingerprint(two), 'digit drift and re-wrapping is the same gate failure');
  assert.equal(gateFailureSetFingerprint([one]), gateFailureSetFingerprint([two]));
  const other = { command: ['npx', 'tsc', '--noEmit'], output: 'FAIL tests/x.test.ts line 12' };
  assert.notEqual(gateFailureSetFingerprint([one]), gateFailureSetFingerprint([other]), 'a different gate argv is a different failure');
});

test('relevance is exact file intersection, and a finding naming no file is answered by any change', () => {
  assert.equal(isRelevantChange({ findingFiles: ['work/a.txt'], changedFiles: ['work/a.txt'] }), true);
  assert.equal(isRelevantChange({ findingFiles: ['work/a.txt'], changedFiles: ['work/b.txt'] }), false);
  assert.equal(isRelevantChange({ findingFiles: ['work/a.txt'], changedFiles: [] }), false);
  assert.equal(isRelevantChange({ findingFiles: [], changedFiles: ['work/b.txt'] }), true, 'an unlocatable finding fails OPEN on any change');
  assert.equal(isRelevantChange({ findingFiles: [], changedFiles: [] }), false, 'no change is never relevant');
});

test('the absolute backstop is a frozen constant with its own stable, never-extendable prefix', () => {
  assert.equal(ABSOLUTE_ROUND_BACKSTOP, 30);
  const reason = absoluteBackstopBlockedReason({ runId: 'r-1', round: 30 });
  assert.ok(reason.startsWith(ABSOLUTE_BACKSTOP_BLOCK_PREFIX));
  assert.equal(isOwnerExtendableBlockedReason(reason), false, 'the backstop is NEVER extendable');
  assert.equal(isOwnerExtendableBlockedReason(`${NO_PROGRESS_BLOCK_PREFIX}identical-repeat: x`), true);
  assert.equal(isOwnerExtendableBlockedReason(`${LEGACY_REMEDIATION_BUDGET_BLOCK_PREFIX}4 rounds`), true, 'legacy persisted runs stay extendable');
  assert.equal(isOwnerExtendableBlockedReason('reviewer blocked: nope'), false);
  assert.equal(isOwnerExtendableBlockedReason(null), false);

  // The breaker adds NO configuration knob of its own.
  const configKeys = Object.keys(ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8'))));
  for (const key of configKeys) assert.equal(/backstop|breaker|progress/i.test(key), false, `the breaker must not be configurable: ${key}`);
  assert.equal(/ABSOLUTE_ROUND_BACKSTOP = 30/.test(fs.readFileSync('scripts/claude-loop/progress.ts', 'utf8')), true, 'the backstop is a frozen literal in code');
});

test('an owner extension moves the classifier window forward without touching the record it follows', () => {
  const record = (over: Partial<ProgressRecord>): ProgressRecord => ({ round: 0, source: 'reviewer', kind: 'findings', candidateSha: 'c', candidateTree: 't', fingerprint: 'FP', files: ['work/a.txt'], relevantChange: false, detail: null, ...over });
  const history = [record({ round: 1 }), record({ round: 2 })];
  // Without the marker the third identical occurrence is a churn-cap block...
  assert.equal(classifyProgress(history, record({ round: 3, relevantChange: true })).verdict, 'BLOCK');
  // ...and with it the re-opened run gets a genuine fresh chance.
  const extended = [...history, ownerExtensionRecord({ round: 3, rounds: 1 })];
  assert.equal(classifyProgress(extended, record({ round: 3, relevantChange: true })).verdict, 'PROGRESS');
  assert.deepEqual(historyAfterLastOwnerExtension(extended), [], 'the window starts after the marker');
  assert.deepEqual(extended.slice(0, 2), history, 'the marker appends and never rewrites what came before');
  assert.equal(endsWithOwnerExtension(extended), true);
  assert.equal(endsWithOwnerExtension(history), false);
});

test('classification is a pure function of persisted data: same inputs, same verdict, no mutation', () => {
  const prior: ProgressRecord[] = [{ round: 0, source: 'reviewer', kind: 'findings', candidateSha: 'c0', candidateTree: 't0', fingerprint: 'FP', files: ['work/a.txt'], relevantChange: true, detail: null }];
  const next: ProgressRecord = { round: 1, source: 'reviewer', kind: 'findings', candidateSha: 'c1', candidateTree: 't1', fingerprint: 'FP', files: ['work/a.txt'], relevantChange: false, detail: null };
  const snapshot = structuredClone({ prior, next });
  const first = classifyProgress(prior, next);
  const second = classifyProgress(prior, next);
  assert.deepEqual(first, second, 'repeated classification is identical');
  assert.deepEqual({ prior, next }, snapshot, 'the classifier mutates neither history nor record');
  assert.equal(first.verdict, 'BLOCK');
});

/* =============================================================== R1: progress runs on */

test('R1: a run that makes progress every round continues far past maxRemediationRounds with no owner extension', async () => {
  const f = disposableFactory();
  try {
    const named = (n: string) => finding({ id: `reviewer-${n}`, message: `${n} is wrong`, file: `work/${n}.txt`, line: 3 });
    const { h, state } = await runFactory(f, {
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/b.txt'), writes('work/c.txt'), writes('work/d.txt'), writes('work/e.txt')],
      reviewer: [findings(named('a')), findings(named('b')), findings(named('c')), findings(named('d')), findings(named('e')), PASS],
    });

    assert.equal(state.phase, 'DONE');
    assert.equal(state.blockedReason, null);
    assert.deepEqual(state.findings, []);
    assert.equal(state.attempt, 5, 'the loop ran rounds 0..5');
    assert.ok(state.attempt > shipped.maxRemediationRounds, `round ${state.attempt} is past the retired budget of ${shipped.maxRemediationRounds}`);
    assert.equal(shipped.maxRemediationRounds, 3, 'the retired budget would have stopped this run at round 3');
    // Not one operator act was involved.
    assert.equal(state.ownerRemediationExtensionRounds, 0);
    assert.equal(state.progressHistory.some((r) => r.kind === 'owner-extension'), false, 'no owner extension anywhere in the history');
    assert.equal(h.counts().builder, 6, 'six write-role rounds');
    assert.equal(h.counts().reviewer, 6, 'each round got its own fresh independent review');

    // The history is the evidence trail of that autonomy.
    const reviewerFindings = state.progressHistory.filter((r) => r.source === 'reviewer' && r.kind === 'findings');
    assert.equal(reviewerFindings.length, 5);
    assert.equal(new Set(reviewerFindings.map((r) => r.fingerprint)).size, 5, 'five DIFFERENT finding sets closed sequentially');
    assert.deepEqual(reviewerFindings.map((r) => r.relevantChange), [true, true, true, true, true]);
    assert.equal(state.progressHistory.at(-1)?.kind, 'clear', 'the run ends on a review that found nothing actionable');
  } finally { dispose(f); }
});

test('R8 + R11: those progressing rounds stay in the ordinary lane and append one immutable descendant candidate per round', async () => {
  const f = disposableFactory();
  try {
    const named = (n: string) => finding({ id: `reviewer-${n}`, message: `${n} is wrong`, file: `work/${n}.txt` });
    const { h, state } = await runFactory(f, {
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/b.txt'), writes('work/c.txt'), writes('work/d.txt')],
      reviewer: [findings(named('a')), findings(named('b')), findings(named('c')), findings(named('d')), PASS],
    });

    // R8: no path upgrades a progressing ordinary run.
    assert.equal(state.authorityClass, 'ordinary');
    assert.equal(laneForAuthorityClass(state.authorityClass), 'ordinary');
    assert.deepEqual([...new Set(h.roles)], ['architect', 'builder', 'reviewer'], 'the owner-author write role is never reached');
    assert.equal(h.roles.includes('owner-author'), false);

    // R11: N progressing rounds, N distinct candidates, each a descendant of the previous.
    const candidates = state.progressHistory.filter((r) => r.kind === 'candidate').map((r) => r.candidateSha!);
    assert.equal(candidates.length, 5, 'one immutable candidate per progressing round');
    assert.equal(new Set(candidates).size, 5, 'no candidate is ever reused or rewritten');
    assert.equal(state.candidateSha, candidates.at(-1));
    for (let i = 1; i < candidates.length; i++) {
      const ancestry = gitRun(state.worktree, ['merge-base', '--is-ancestor', candidates[i - 1], candidates[i]], true);
      assert.equal(ancestry.code, 0, `candidate ${i} must be a descendant of candidate ${i - 1}`);
      assert.notEqual(git(state.worktree, 'rev-parse', `${candidates[i]}^{tree}`), git(state.worktree, 'rev-parse', `${candidates[i - 1]}^{tree}`));
    }
    const base = state.progressHistory.find((r) => r.kind === 'base')!;
    assert.equal(base.candidateSha, state.baseSha, 'the frozen base opens the history');
    assert.equal(gitRun(state.worktree, ['merge-base', '--is-ancestor', state.baseSha, candidates[0]], true).code, 0);

    // The supervisor's git surface is still the guarded one, and the guard itself is untouched.
    for (const forbidden of [['commit', '--amend'], ['reset', '--hard', 'HEAD~1'], ['rebase', 'main'], ['push', '--force'], ['update-ref', 'refs/heads/main', 'x']]) {
      assert.throws(() => assertSafeGitArgs(forbidden), `assertSafeGitArgs must still refuse: ${forbidden.join(' ')}`);
    }
    const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
    assert.equal(/execFileSync\(|spawnSync\(|spawn\(/.test(src), false, 'the supervisor may only reach git through the guarded helpers');
  } finally { dispose(f); }
});

/* ============================================== R2 + R13: reviewer / visual symmetry */

test('R2: a mixed reviewer and visual-reviewer sequence closes sequentially and reaches DONE past the retired budget', async () => {
  const f = disposableFactory();
  try {
    const { h, state } = await runFactory(f, {
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/b.txt'), writes('work/c.txt'), writes('work/d.txt')],
      reviewer: [
        findings(finding({ id: 'rev-1', message: 'a is wrong', file: 'work/a.txt' })),
        PASS,
        findings(finding({ id: 'rev-2', message: 'c is wrong', file: 'work/c.txt' })),
        PASS,
        PASS,
      ],
      visual: [
        findings(finding({ id: 'vis-1', message: 'b renders wrong', file: 'work/b.txt' })),
        findings(finding({ id: 'vis-2', message: 'd renders wrong', file: 'work/d.txt' })),
        PASS,
      ],
    }, { task: { visualReview: true, visual: VISUAL } });

    assert.equal(state.phase, 'DONE');
    assert.equal(state.attempt, 4);
    assert.ok(state.attempt > shipped.maxRemediationRounds);
    assert.equal(state.ownerRemediationExtensionRounds, 0);
    assert.equal(h.counts().visual, 3, 'visual review ran only after the reviewer passed');
    assert.deepEqual(
      kinds(state.progressHistory.filter((r) => r.source === 'reviewer' || r.source === 'visual-reviewer')),
      [
        'reviewer:findings',
        'reviewer:clear', 'visual-reviewer:findings',
        'reviewer:findings',
        'reviewer:clear', 'visual-reviewer:findings',
        'reviewer:clear', 'visual-reviewer:clear',
      ],
      'both independent reviews record their own progress evidence',
    );
    const visualFindings = state.progressHistory.filter((r) => r.source === 'visual-reviewer' && r.kind === 'findings');
    assert.equal(new Set(visualFindings.map((r) => r.fingerprint)).size, 2, 'two different visual findings closed in sequence');
  } finally { dispose(f); }
});

test('R13: an identical visual finding after an irrelevant change blocks exactly like a reviewer finding', async () => {
  const f = disposableFactory();
  try {
    const v1 = finding({ id: 'vis-1', message: 'The header overlaps at 1440px', file: 'work/a.txt', line: 10 });
    const v1Reworded = finding({ id: 'vis-77', message: 'the header   overlaps at 390px', file: 'work/a.txt', line: 812 });
    const { error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writes('work/z.txt')],
      reviewer: [PASS, PASS],
      visual: [findings(v1), findings(v1Reworded)],
    }, { task: { visualReview: true, visual: VISUAL } });

    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), error.message);
    assert.match(error.message, /identical-repeat/);
    assert.match(error.message, /source=visual-reviewer/);
    assert.equal(state.phase, 'BLOCKED');
    assert.equal(state.blockedReason, error.message);
    const visualRecords = state.progressHistory.filter((r) => r.source === 'visual-reviewer' && r.kind === 'findings');
    assert.equal(visualRecords[0].fingerprint, visualRecords[1].fingerprint, 'the reworded repeat is the same finding');
    assert.equal(visualRecords[1].relevantChange, false, 'work/z.txt is not a file the finding names');
  } finally { dispose(f); }
});

test('R13 + churn cap: a repeat that DID change the named file continues, and the third occurrence still stops the run', async () => {
  const f = disposableFactory();
  try {
    const v1 = () => finding({ id: `vis-${Math.random()}`, message: 'The header overlaps', file: 'work/a.txt' });
    const { error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/a.txt')],
      reviewer: [PASS, PASS, PASS],
      visual: [findings(v1()), findings(v1()), findings(v1())],
    }, { task: { visualReview: true, visual: VISUAL } });

    // Round 1 genuinely edited the named file, so the identical repeat is NOT an instant block...
    const visualRecords = state.progressHistory.filter((r) => r.source === 'visual-reviewer' && r.kind === 'findings');
    assert.equal(visualRecords.length, 3);
    assert.deepEqual(visualRecords.map((r) => r.relevantChange), [true, true, true]);
    assert.equal(new Set(visualRecords.map((r) => r.fingerprint)).size, 1);
    // ...but the same finding a THIRD time is churn however hard the builder worked.
    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), error.message);
    assert.match(error.message, /churn-cap/);
    assert.match(error.message, /third time/);
    assert.equal(state.attempt, 2, 'the run was stopped inside round 2, before any round 3 could start');
  } finally { dispose(f); }
});

/* ================================================================ R3: identical repeat */

test('R3: a materially identical reviewer finding after an irrelevant remediation blocks on the FIRST repeat', async () => {
  const f = disposableFactory();
  try {
    const original = finding({ id: 'reviewer-1', message: 'Missing NULL check on line 42', file: 'work/a.txt', line: 42 });
    const restated = finding({ id: 'reviewer-9', message: 'missing   null check\non line 1337', file: 'work/a.txt', line: 1337 });
    const { h, error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writes('work/b.txt')],
      reviewer: [findings(original), findings(restated)],
    });

    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), `stable prefix required, got: ${error.message}`);
    assert.match(error.message, /identical-repeat/);
    assert.match(error.message, new RegExp(findingSetFingerprint([original])), 'the reason names the repeated fingerprint');
    assert.match(error.message, /rounds 0->1/, 'the reason names the rounds involved');
    assert.match(error.message, /candidate [0-9a-f]{12}->[0-9a-f]{12}/, 'the reason names the candidate identities');
    assert.match(error.message, /files=work\/a\.txt/);

    assert.equal(state.phase, 'BLOCKED');
    assert.equal(state.blockedReason, error.message, 'the verdict is persisted verbatim');
    assert.equal(h.counts().builder, 2, 'the run stopped instead of starting a third round');
    assert.equal(h.counts().reviewer, 2);
    const records = state.progressHistory.filter((r) => r.source === 'reviewer' && r.kind === 'findings');
    assert.equal(records[0].fingerprint, records[1].fingerprint, 'a renumbered restatement is not new information');
    assert.equal(records[1].relevantChange, false, 'work/b.txt is not the file the finding named');
    assert.equal(state.progressHistory.at(-1), records[1], 'the blocking record is APPENDED, never withheld from the audit trail');
  } finally { dispose(f); }
});

/* ============================================================== R4: no-change READY */

test('R4: a no-change READY gets exactly one fresh review, and the second consecutive one blocks without another review', async () => {
  const f = disposableFactory();
  try {
    const pending = () => finding({ id: 'reviewer-1', message: 'still wrong', file: 'work/a.txt' });
    const { h, error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writesNothing, writesNothing],
      reviewer: [findings(pending()), findings(pending())],
    });

    assert.equal(h.counts().builder, 3, 'the write role got its round 2 attempt after the fresh review');
    assert.equal(h.counts().reviewer, 2, 'exactly ONE fresh independent review was granted, and no third review was run');

    const noChange = state.progressHistory.filter((r) => r.kind === 'no-change-ready');
    assert.equal(noChange.length, 2);
    assert.equal(noChange[0].fingerprint, noChange[1].fingerprint, 'the same pending findings both times');
    assert.deepEqual(noChange.map((r) => r.candidateSha), [state.candidateSha, state.candidateSha], 'the candidate never moved');

    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), error.message);
    assert.match(error.message, /no-change-ready/);
    assert.match(error.message, /READY twice in a row/);
    assert.equal(state.blockedReason, error.message);
    // The unchanged candidate really did reach a fresh independent reviewer between the two.
    assert.deepEqual(
      kinds(state.progressHistory),
      ['builder:base', 'builder:candidate', 'reviewer:findings', 'builder:no-change-ready', 'reviewer:findings', 'builder:no-change-ready'],
      'exactly one fresh review sits between the first and the second no-change READY',
    );
  } finally { dispose(f); }
});

/* ==================================================================== R5: gate repeat */

test('R5: the same gate failure on an unchanged tree blocks, and a gate failure that moves continues to completion', async () => {
  const blocked = disposableFactory();
  try {
    // Digit drift only: mechanically the SAME failure.
    const { h, error, state } = await runFactoryExpectingBlock(blocked, {
      builder: [writes('work/a.txt'), writesNothing],
      gates: [gateFailure('FAIL work/a.txt line 12\n', ['npm', 'run', 'claude:test']), gateFailure('fail   work/a.txt LINE 9981\n', ['npm', 'run', 'claude:test'])],
      reviewer: [],
    });

    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), error.message);
    assert.match(error.message, /gate-repeat/);
    assert.match(error.message, /two consecutive rounds with no candidate change/);
    assert.equal(h.counts().reviewer, 0, 'a failing gate never reaches an independent review');
    const gateRecords = state.progressHistory.filter((r) => r.source === 'gates');
    assert.equal(gateRecords.length, 2);
    assert.equal(gateRecords[0].fingerprint, gateRecords[1].fingerprint);
    assert.equal(gateRecords[0].candidateTree, gateRecords[1].candidateTree, 'the tree the gate judged did not move at all');
    assert.equal(state.candidateSha, null, 'a failing gate never produces a candidate');
  } finally { dispose(blocked); }

  const progressing = disposableFactory();
  try {
    const { h, state } = await runFactory(progressing, {
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/b.txt')],
      // Same gate, DIFFERENT failure; then the same failure again but on a tree that moved; then pass.
      gates: [gateFailure('FAIL parse error\n'), gateFailure('FAIL type error\n'), GATES_OK, GATES_OK],
      reviewer: [PASS],
    });

    assert.equal(state.phase, 'DONE', 'a gate that progresses keeps the loop running');
    assert.equal(h.counts().builder, 3);
    const gateRecords = state.progressHistory.filter((r) => r.source === 'gates');
    assert.equal(gateRecords.length, 2);
    assert.notEqual(gateRecords[0].fingerprint, gateRecords[1].fingerprint, 'a different failure is progress');
  } finally { dispose(progressing); }
});

test('R5: the same gate failure survives a changed candidate twice, and the third consecutive failure stops the run', async () => {
  const f = disposableFactory();
  try {
    const sameFailure = () => gateFailure('FAIL work/a.txt line 12\n', ['npm', 'run', 'claude:test']);
    const { h, error, state } = await runFactoryExpectingBlock(f, {
      // The write role really works on it every round, so the tree moves every round...
      builder: [writes('work/a.txt'), writes('work/a.txt'), writes('work/a.txt')],
      gates: [sameFailure(), sameFailure(), sameFailure()],
      reviewer: [],
    });

    const gateRecords = state.progressHistory.filter((r) => r.source === 'gates');
    assert.equal(gateRecords.length, 3);
    assert.equal(new Set(gateRecords.map((r) => r.fingerprint)).size, 1, 'the same gate failure throughout');
    assert.equal(new Set(gateRecords.map((r) => r.candidateTree)).size, 3, 'and a genuinely different tree each round');
    // ...which buys exactly two rounds. The third consecutive identical failure is not progress.
    assert.ok(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), error.message);
    assert.match(error.message, /gate-repeat/);
    assert.match(error.message, /three consecutive rounds/);
    assert.equal(h.counts().builder, 3);
  } finally { dispose(f); }
});

test('the frozen absolute backstop stops a run before it can start another round, and no owner act re-opens it', async () => {
  const f = disposableFactory();
  try {
    const { state } = await runFactoryExpectingBlock(f, { builder: [writes('escaped.txt')], reviewer: [] });

    // A run that has churned all the way to the backstop. The builder script is EMPTY, so any
    // further write-role invocation would fail the test: the backstop must stop it before that.
    const atBackstop = RunStateSchema.parse({ ...state, phase: 'REMEDIATE', attempt: ABSOLUTE_ROUND_BACKSTOP, blockedReason: null });
    const h = scripted({ worktreeRoot: f.worktreeRoot, builder: [], reviewer: [] });
    await assert.rejects(() => execute(f.repo, shipped, atBackstop, undefined, h.deps), (e: unknown) => {
      const message = (e as Error).message;
      assert.ok(message.startsWith(ABSOLUTE_BACKSTOP_BLOCK_PREFIX), message);
      assert.match(message, new RegExp(`${ABSOLUTE_ROUND_BACKSTOP}-round backstop`));
      assert.match(message, /terminally blocked/);
      assert.match(message, /fresh sequential run/);
      return true;
    });
    assert.equal(h.counts().builder, 0, 'the backstop stops the run without invoking another model segment');

    const blocked = loadState(f.repo, state.runId);
    assert.ok(blocked.blockedReason?.startsWith(ABSOLUTE_BACKSTOP_BLOCK_PREFIX));
    assert.throws(() => extendRemediationState(blocked, shipped, 1), /never extendable/, 'the backstop is not a budget an owner can refill');
    assert.equal(isOwnerExtendableBlockedReason(blocked.blockedReason), false);
    // Even a marker forged into the history cannot re-open it: the backstop is terminal.
    const forged = RunStateSchema.parse({ ...blocked, progressHistory: [...blocked.progressHistory, ownerExtensionRecord({ round: ABSOLUTE_ROUND_BACKSTOP, rounds: 3 })] });
    assert.match(circuitBreakerResumeRefusal(forged) ?? '', /terminally blocked/);
  } finally { dispose(f); }
});

/* ======================================================== R6: kill / reload determinism */

test('R6: a killed run reloads its full history from disk and re-derives the identical verdict', async () => {
  const f = disposableFactory();
  try {
    const pending = finding({ id: 'reviewer-1', message: 'a is wrong', file: 'work/a.txt' });
    // The process dies in the middle of round 1.
    const crash = scripted({
      worktreeRoot: f.worktreeRoot,
      builder: [writes('work/a.txt'), () => { throw new Error('SIGKILL: supervisor process lost'); }],
      reviewer: [findings(pending)],
    });
    await assert.rejects(
      () => startRunFromTask({ repo: f.repo, config: shipped, task: taskSpec(), authorityClass: 'ordinary', deps: crash.deps }),
      /supervisor process lost/,
    );

    const runId = onlyRunId(f.repo);
    const killed = loadState(f.repo, runId);
    const persistedAtKill = structuredClone(killed.progressHistory);
    assert.ok(persistedAtKill.length >= 3, 'the history survived the kill');
    assert.deepEqual(kinds(persistedAtKill), ['builder:base', 'builder:candidate', 'reviewer:findings']);
    assert.equal(killed.attempt, 1, 'the persisted next round is the one that was interrupted');
    // A raw re-read parses to exactly the same evidence: nothing is derived from the dead process.
    assert.deepEqual(RunStateSchema.parse(JSON.parse(fs.readFileSync(statePath(f.repo, runId), 'utf8'))).progressHistory, persistedAtKill);

    // A BRAND NEW deps object, an empty heap, the same files on disk.
    const restarted = scripted({
      worktreeRoot: f.worktreeRoot,
      builder: [writes('work/b.txt')],
      reviewer: [findings(finding({ id: 'reviewer-fresh', message: 'A IS WRONG', file: 'work/a.txt' }))],
    });
    const reloaded = loadState(f.repo, runId);
    await assert.rejects(() => execute(f.repo, shipped, reloaded, undefined, restarted.deps), (e: unknown) => {
      assert.ok((e as Error).message.startsWith(NO_PROGRESS_BLOCK_PREFIX), (e as Error).message);
      return true;
    });

    const after = loadState(f.repo, runId);
    // Append-only across the restart: the pre-kill history is a strict PREFIX of the final history.
    assert.deepEqual(after.progressHistory.slice(0, persistedAtKill.length), persistedAtKill, 'a resume never truncates, reorders or re-fingerprints history');
    assert.ok(after.progressHistory.length > persistedAtKill.length);
    assert.equal(after.progressHistory.some((r) => r.kind === 'owner-extension'), false, 'a restart is not an entitlement');

    // The persisted evidence ALONE re-derives the persisted verdict, byte for byte.
    const last = after.progressHistory.at(-1)!;
    const prior = after.progressHistory.slice(0, -1);
    const verdict = classifyProgress(prior, last);
    assert.equal(verdict.verdict, 'BLOCK');
    assert.equal(verdict.verdict === 'BLOCK' && verdict.reason, after.blockedReason, 'the classifier is deterministic over persisted data');
    assert.deepEqual(classifyProgress(prior, last), verdict, 'and stable when asked again');
  } finally { dispose(f); }
});

/* ============================================== R7: resume guard and owner re-open */

test('R7: a breaker-blocked run is refused on resume, and an owner extension re-opens it without resetting anything', async () => {
  const f = disposableFactory();
  const cwd = process.cwd();
  try {
    const original = finding({ id: 'reviewer-1', message: 'a is wrong', file: 'work/a.txt' });
    const { state: blockedState } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writes('work/b.txt')],
      reviewer: [findings(original), findings({ ...original, id: 'reviewer-2' })],
    });
    const runId = blockedState.runId;
    const historyAtBlock = structuredClone(blockedState.progressHistory);
    const attemptAtBlock = blockedState.attempt;

    // The pure guard and the production resume path agree: no fresh entitlement from a restart.
    assert.match(circuitBreakerResumeRefusal(blockedState) ?? '', /explicit owner extend-remediation is required before resume/);
    process.chdir(f.repo);
    await assert.rejects(() => resumeRun(runId), /explicit owner extend-remediation is required before resume/);
    await assert.rejects(() => resumeRun(runId), /explicit owner extend-remediation is required before resume/, 'repeating the resume changes nothing');
    assert.deepEqual(loadState(f.repo, runId).progressHistory, historyAtBlock, 'a refused resume writes no history');
    assert.deepEqual(listClaims(f.repo, Date.now()), [], 'a refused resume never takes a claim');

    // The owner re-opens it through the real CLI-level path.
    const extended = extendRemediationBudget(runId, 1);
    assert.equal(extended.attempt, attemptAtBlock, 'attempt is NEVER reset by an extension');
    assert.deepEqual(extended.progressHistory.slice(0, historyAtBlock.length), historyAtBlock, 'history is never truncated');
    assert.equal(extended.progressHistory.length, historyAtBlock.length + 1);
    const marker = extended.progressHistory.at(-1)!;
    assert.equal(marker.kind, 'owner-extension');
    assert.equal(marker.source, 'owner-extension');
    assert.equal(marker.detail, 'owner extension of 1 round');
    assert.equal(extended.ownerRemediationExtensionRounds, 1);
    assert.equal(circuitBreakerResumeRefusal(extended), null, 'the marker, not the counter, is what re-opens the run');

    // The re-opened run really does get a fresh chance and completes.
    const resumed = scripted({ worktreeRoot: f.worktreeRoot, builder: [writes('work/a.txt')], reviewer: [PASS] });
    const done = await execute(f.repo, shipped, loadState(f.repo, runId), undefined, resumed.deps);
    assert.equal(done.phase, 'DONE');
    assert.deepEqual(done.progressHistory.slice(0, historyAtBlock.length + 1), extended.progressHistory, 'the whole append-only trail survives the re-open');

    // An extension is bounded, and the backstop is never extendable.
    const backstopped = RunStateSchema.parse({ ...done, phase: 'BLOCKED', attempt: ABSOLUTE_ROUND_BACKSTOP, blockedReason: absoluteBackstopBlockedReason({ runId, round: ABSOLUTE_ROUND_BACKSTOP }) });
    assert.throws(() => extendRemediationState(backstopped, shipped, 1), /terminally blocked and is never extendable/);
    assert.match(circuitBreakerResumeRefusal(backstopped) ?? '', /terminally blocked/);
  } finally { process.chdir(cwd); dispose(f); }
});

test('legacy fixed-budget BLOCKED states stay loadable, extendable and resumable', () => {
  const legacy = RunStateSchema.parse({
    version: 1,
    runId: 'legacy-run',
    task: taskSpec(),
    baseSha: 'a'.repeat(40),
    branch: 'claude/legacy',
    worktree: '/tmp/legacy',
    phase: 'BLOCKED',
    attempt: 3,
    candidateSha: 'b'.repeat(40),
    sessions: { architect: 'a', builder: 'b', reviewer: 'r', visualReviewer: null },
    findings: [],
    advisoryFindings: [],
    prUrl: null,
    blockedReason: 'remediation budget exhausted after 4 rounds',
  });
  assert.deepEqual(legacy.progressHistory, [], 'a state persisted before the breaker parses with an empty history');

  const extended = extendRemediationState(legacy, shipped, 1);
  assert.equal(extended.attempt, 4, 'the legacy budget arithmetic is preserved exactly');
  assert.equal(extended.ownerRemediationExtensionRounds, 1);
  assert.equal(extended.progressHistory.length, 1, 'even a legacy extension records its marker');
  assert.equal(extended.progressHistory[0].kind, 'owner-extension');
  assert.deepEqual(legacy.progressHistory, [], 'the pure helper never mutates its prestate');
  // The legacy reason is not a breaker reason, so the breaker guard has no opinion about it; the
  // unchanged legacy resume arithmetic in resumeRun is what governs it.
  assert.equal(circuitBreakerResumeRefusal(legacy), null);
});

/* ================================================== R9 / R10 / R12: unchanged guards */

test('R9: a remediation round writing outside allowedWrite or into deniedWrite still blocks on exact scope validation', async () => {
  const outside = disposableFactory();
  try {
    const { h, error, state } = await runFactoryExpectingBlock(outside, {
      builder: [writes('work/a.txt'), writes('work/a.txt', 'escaped.txt')],
      reviewer: [findings(finding({ id: 'reviewer-1', message: 'a is wrong', file: 'work/a.txt' }))],
    });
    assert.match(error.message, /allowed-write violation/);
    assert.match(error.message, /escaped\.txt/);
    assert.equal(error.message.startsWith(NO_PROGRESS_BLOCK_PREFIX), false, 'scope is enforced before and independently of the breaker');
    assert.equal(h.counts().reviewer, 1, 'an out-of-scope round never reaches review');
    assert.equal(state.progressHistory.filter((r) => r.kind === 'candidate').length, 1, 'no candidate is created from an out-of-scope round');
  } finally { dispose(outside); }

  const denied = disposableFactory();
  try {
    const { error } = await runFactoryExpectingBlock(denied, {
      builder: [writes('work/secret/leak.txt')],
      reviewer: [],
    });
    assert.match(error.message, /allowed-write violation/);
    assert.match(error.message, /denied/);
  } finally { dispose(denied); }
});

test('R9: hashing the tree for the breaker cannot hide a later out-of-scope file, create a commit or move a ref', async () => {
  const f = disposableFactory();
  try {
    // Round 0 fails its gate, which is where the breaker hashes the worktree and therefore stages
    // the index. An untracked file is tracked-in-index afterwards, so if the changed-file set were
    // derived from `ls-files --others` alone, the NEXT round's escape would become invisible to
    // exact scope validation. It is not: the escape is still caught.
    const { error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt'), writes('escaped.txt')],
      gates: [gateFailure('FAIL first round\n')],
      reviewer: [],
    });
    assert.match(error.message, /allowed-write violation/);
    assert.match(error.message, /escaped\.txt/);

    // The hash itself is a read: no candidate commit, no ref movement, no history rewrite.
    assert.equal(state.candidateSha, null);
    assert.equal(git(state.worktree, 'rev-parse', 'HEAD'), state.baseSha, 'HEAD never moved off the frozen base');
    assert.equal(git(state.worktree, 'rev-list', '--count', 'HEAD'), '1', 'no commit was created by hashing the tree');
    const gateRecord = state.progressHistory.find((r) => r.source === 'gates')!;
    assert.match(gateRecord.candidateTree!, /^[0-9a-f]{40}$/, 'the gate judged an exact content tree');
    assert.notEqual(gateRecord.candidateTree, state.progressHistory.find((r) => r.kind === 'base')!.candidateTree);
  } finally { dispose(f); }
});

test('R10: a second supervisor cannot resume a run the first one holds', async () => {
  const f = disposableFactory();
  const cwd = process.cwd();
  try {
    const { state } = await runFactoryExpectingBlock(f, { builder: [writes('escaped.txt')], reviewer: [] });
    assert.match(state.blockedReason ?? '', /allowed-write violation/, 'a scope block is resumable, so the claim is what must stop the second supervisor');

    const held = acquireClaim({ repo: f.repo, scope: 'run', key: state.runId, owner: ownerToken('other-supervisor'), nowMs: Date.now(), ttlSeconds: 900, runId: state.runId });
    assert.equal(held.ok, true);

    process.chdir(f.repo);
    await assert.rejects(() => resumeRun(state.runId), (e: unknown) => {
      const message = (e as Error).message;
      assert.match(message, /is already claimed by/);
      assert.match(message, /claude:autopilot-recover/);
      return true;
    });
    assert.equal(currentClaim(f.repo, 'run', state.runId)?.state, 'HELD', 'the live claim is untouched by the refused resume');
  } finally { process.chdir(cwd); dispose(f); }
});

test('R12: a reviewer that edits the worktree is caught, so review never becomes authorship', async () => {
  const f = disposableFactory();
  try {
    const { error, state } = await runFactoryExpectingBlock(f, {
      builder: [writes('work/a.txt')],
      reviewer: [(worktree) => {
        fs.writeFileSync(path.join(worktree, 'work', 'reviewer-edit.txt'), 'the reviewer wrote this\n', 'utf8');
        return PASS;
      }],
    });
    assert.match(error.message, /worktree dirty after final candidate\/gates/);
    assert.equal(state.phase, 'BLOCKED');
    assert.equal(state.progressHistory.filter((r) => r.kind === 'candidate').length, 1, 'the reviewer edit never became a candidate');
    assert.equal(fs.existsSync(path.join(state.worktree, 'work', 'reviewer-edit.txt')), true, 'the evidence is preserved for inspection');
  } finally { dispose(f); }
});

/* ================================================================ R14: advisories */

test('R14: note-only review outcomes accumulate as advisories, start no remediation round and never feed the breaker', async () => {
  const f = disposableFactory();
  try {
    const note = finding({ id: 'note-1', message: 'a future slice could hoist this helper', file: 'work/a.txt', severity: 'note' });
    const another = finding({ id: 'note-2', message: 'optional hardening idea', severity: 'note' });
    const { h, state } = await runFactory(f, {
      builder: [writes('work/a.txt')],
      reviewer: [notes(note, another)],
    });

    assert.equal(state.phase, 'DONE');
    assert.equal(h.counts().builder, 1, 'notes never trigger a remediation round');
    assert.deepEqual(state.advisoryFindings.map((a) => a.id), ['note-1', 'note-2']);
    assert.deepEqual(state.findings, []);
    const reviewerRecords = state.progressHistory.filter((r) => r.source === 'reviewer');
    assert.deepEqual(reviewerRecords.map((r) => r.kind), ['clear'], 'a note-only review is recorded as CLEAR, never as findings');
    assert.equal(reviewerRecords[0].fingerprint, findingSetFingerprint([]), 'the advisories are not part of any fingerprint');
    assert.deepEqual(reviewerRecords[0].files, []);
  } finally { dispose(f); }
});

/* ============================================================ R15: self-claim guard */

test('R15: an owner-author declaration without a supervisor selection still fails closed', () => {
  const f = disposableFactory();
  try {
    // The configuration a run in this repository would actually load: shipped defaults, whose
    // owner-author selection is forced empty however the file was edited.
    const config = loadConfig(f.repo);
    assert.deepEqual(config.ownerAuthor.selectedTaskIds, []);
    assert.deepEqual(supervisorAuthoritySelection(config).selectedTaskIds, []);

    const declared = taskSpec({ id: 'OM1', authorityClass: 'owner-author' });
    assert.equal(declared.authorityClass, 'owner-author', 'the declaration stays visible as data');
    assert.throws(
      () => resolveAuthorityClass({ taskId: declared.id, declared: declared.authorityClass, selection: supervisorAuthoritySelection(config), source: 'task file' }),
      (e: unknown) => e instanceof AuthorityEscalationError && e.code === OWNER_AUTHOR_SELF_CLAIM_CODE,
    );
    // Only an explicit selection in THIS invocation grants the lane; nothing in the loop changed that.
    assert.equal(resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: supervisorAuthoritySelection(config, ['OM1']) }), 'owner-author');
  } finally { dispose(f); }
});

/* ============================================ R16: recovery resumes, never restarts */

test('R16: after process loss and claim expiry, recovery releases the stale claim and the run resumes from persisted state', async () => {
  const f = disposableFactory();
  const cwd = process.cwd();
  try {
    const pending = finding({ id: 'reviewer-1', message: 'a is wrong', file: 'work/a.txt' });
    const crash = scripted({
      worktreeRoot: f.worktreeRoot,
      builder: [writes('work/a.txt'), () => { throw new Error('supervisor process lost'); }],
      reviewer: [findings(pending)],
    });
    await assert.rejects(() => startRunFromTask({ repo: f.repo, config: shipped, task: taskSpec(), authorityClass: 'ordinary', deps: crash.deps }), /supervisor process lost/);
    const runId = onlyRunId(f.repo);
    const abandoned = loadState(f.repo, runId);
    const historyBefore = structuredClone(abandoned.progressHistory);

    // The lost process left a claim behind that stopped heartbeating an hour ago.
    const staleAt = Date.now() - 3600_000;
    const claim = acquireClaim({ repo: f.repo, scope: 'run', key: runId, owner: ownerToken('lost-supervisor'), nowMs: staleAt, ttlSeconds: shipped.autopilot.claimTtlSeconds, runId });
    assert.equal(claim.ok, true);
    assert.equal(currentClaim(f.repo, 'run', runId)?.state, 'HELD', 'the abandoned claim is still recorded, not silently forgotten');
    assert.equal(listClaims(f.repo, Date.now()).find((c) => c.key === runId)?.stale, true, 'it is stale because it stopped heartbeating, not because of its age at acquisition');

    const recovery = autopilotRecover({ repo: f.repo, nowMs: Date.now() });
    assert.deepEqual(recovery.recoveredClaims.map((c) => `${c.scope}:${c.key}`), [`run:${runId}`]);
    assert.deepEqual(recovery.ledgerUpdates, [], 'no ledger entry existed to demote, and none is invented');
    assert.equal(currentClaim(f.repo, 'run', runId)?.state, 'RELEASED');

    // The run RESUMES: it continues at the persisted round instead of restarting the task.
    const resumed = scripted({ worktreeRoot: f.worktreeRoot, builder: [writes('work/a.txt')], reviewer: [PASS] });
    const done = await execute(f.repo, shipped, loadState(f.repo, runId), undefined, resumed.deps);

    assert.equal(done.phase, 'DONE');
    assert.equal(done.sessions.architect, 'architect-session', 'the architect phase is not repeated');
    assert.deepEqual(done.progressHistory.slice(0, historyBefore.length), historyBefore, 'history intact across the recovery');
    assert.equal(done.progressHistory.filter((r) => r.kind === 'base').length, 1, 'the task was resumed, not restarted from a new base');
    assert.equal(done.progressHistory.filter((r) => r.kind === 'candidate').length, 2, 'the pre-loss candidate is still the first one');
  } finally { process.chdir(cwd); dispose(f); }
});

/* ================================================== supervisor wiring, as source facts */

test('the production supervisor really runs the breaker and no longer carries a fixed round bound', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /for \(let round = state\.attempt; ; round\+\+\)/, 'the loop has no fixed upper bound any more');
  assert.equal(/remediation budget exhausted after \$\{/.test(src), false, 'the retired budget block is gone from the loop');
  assert.match(src, /if \(absoluteBackstopReached\(round\)\)/, 'the frozen backstop is the terminal bound');
  assert.match(src, /const verdict = classifyProgress\(state\.progressHistory, record\);/, 'the verdict comes from the pure classifier over persisted history');
  assert.match(src, /state\.progressHistory = \[\.\.\.state\.progressHistory, record\];/, 'history is append-only at the single record point');
  assert.match(src, /t\.emit\('progress\.recorded'/);
  assert.match(src, /t\.emit\('circuit_breaker\.blocked'/);
  assert.match(src, /const breakerRefusal = circuitBreakerResumeRefusal\(state\);/, 'resume is gated before any claim or Claude segment');
  assert.ok(src.indexOf('const breakerRefusal = circuitBreakerResumeRefusal(state)') < src.indexOf("acquireClaim({ repo, scope: 'run'"), 'the breaker guard runs before the run claim');
  // Existing behaviour that this task must not disturb.
  assert.match(src, /const b = await runBuilderWithContinuation\(\{/);
  assert.match(src, /if \(builderContinuationResumeBlocked\(config, state\)\)/);
  assert.match(src, /const writeRole: RoleName = lane === 'owner-author' \? 'owner-author' : 'builder'/);
  assert.match(src, /const violations = validateExactScope\(\{ files, allowedWrite: state\.task\.allowedWrite, deniedWrite: state\.task\.deniedWrite, lane \}\)/);
  assert.match(src, /maxRemediationRounds/, 'the retired knob stays readable for configuration compatibility');

  // The classifier module reads no clock, no randomness and no Git.
  const progress = fs.readFileSync('scripts/claude-loop/progress.ts', 'utf8');
  assert.equal(/Date\.now\(|new Date\(|Math\.random\(|child_process|from '\.\/git'|from '\.\/util'/.test(progress), false, 'the classifier must be pure over persisted data');
});
