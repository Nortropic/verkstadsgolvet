import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeRoleFailure } from '../../scripts/claude-loop/claude';
import * as supervisor from '../../scripts/claude-loop/supervisor';
import {
  BUILDER_CONTINUATION_BUDGET_BLOCK_PREFIX,
  allowedMaxRound,
  builderContinuationResumeBlocked,
  builderContinuationsRemaining,
  completeRunState,
  extendRemediationState,
  isBuilderContinuationFailure,
  nextRoundAfterRemediation,
  recoverableBuilderSession,
  runBuilderWithContinuation,
  type BuilderContinuationDeps,
  type BuilderSegmentResult,
} from '../../scripts/claude-loop/supervisor';
import { ConfigSchema, RunStateSchema, TaskSchema, type FactoryConfig, type RoleResult, type RunState } from '../../scripts/claude-loop/schemas';

const config = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
const task = TaskSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example-task.json', 'utf8')));

function legacyBudgetState() {
  return RunStateSchema.parse({
    version: 1,
    runId: 'v1-test',
    task,
    baseSha: 'a'.repeat(40),
    branch: 'claude/v1-test',
    worktree: '/tmp/v1-test',
    phase: 'BLOCKED',
    attempt: 3,
    candidateSha: 'b'.repeat(40),
    sessions: { architect: 'arch', builder: 'builder', reviewer: 'reviewer', visualReviewer: null },
    findings: [],
    advisoryFindings: [],
    prUrl: null,
    blockedReason: 'remediation budget exhausted after 4 rounds',
  });
}

/** A live (non-blocked) run state at `round`, with whatever builder session identity is given. */
function runningState(fields: { round: number; builderSession: string | null; used?: number }): RunState {
  return RunStateSchema.parse({
    ...legacyBudgetState(),
    runId: 'continuation-test',
    phase: fields.round === 0 ? 'BUILD' : 'REMEDIATE',
    attempt: fields.round,
    candidateSha: null,
    sessions: { architect: 'arch', builder: fields.builderSession, reviewer: null, visualReviewer: null },
    ownerRemediationExtensionRounds: 0,
    builderContinuationResumesUsed: fields.used ?? 0,
    findings: [{ id: 'reviewer-1', severity: 'major', message: 'fix the persisted counter' }],
    blockedReason: null,
  });
}

const readyResult: RoleResult = { outcome: 'READY', summary: 'done', findings: [], tests: [], changed_files: [], next_action: 'REVIEW' };

function maxTurns(sessionId: string | null): ClaudeRoleFailure {
  return new ClaudeRoleFailure('builder', 'error_max_turns', sessionId, 48, 'turn budget spent');
}

type SegmentCall = { prompt: string; resume: string | null; round: number };

/**
 * Fake role runner for the production continuation seam.
 *
 * Every model invocation, every persist and every telemetry emission is appended to one ordered
 * log, so tests can prove BOTH the counts and the ordering (persist strictly before the next
 * model segment). Invoking more segments than the scripted plan fails the test immediately, which
 * is what makes "no extra model invocation after budget exhaustion" mechanical.
 */
function harness(plan: Array<RoleResult | Error>) {
  const calls: SegmentCall[] = [];
  const persisted: RunState[] = [];
  const events: Array<{ event: string; fields: Record<string, unknown> }> = [];
  const log: string[] = [];
  const deps: BuilderContinuationDeps = {
    runBuilderSegment: async (call): Promise<BuilderSegmentResult> => {
      calls.push({ ...call });
      log.push(`segment#${calls.length} resume=${call.resume ?? 'FRESH'} round=${call.round}`);
      assert.ok(calls.length <= plan.length, `unexpected extra model invocation #${calls.length}`);
      const step = plan[calls.length - 1];
      if (step instanceof Error) throw step;
      return { sessionId: call.resume ?? 'session-fresh', result: step };
    },
    persist: (s) => {
      persisted.push(structuredClone(s));
      log.push(`persist used=${s.builderContinuationResumesUsed} attempt=${s.attempt} builder=${s.sessions.builder ?? 'NULL'}`);
    },
    emit: (event, fields) => { events.push({ event, fields }); log.push(`emit ${event}`); },
  };
  return { deps, calls, persisted, events, log };
}

test('two consecutive error_max_turns builder segments auto-continue one session and then succeed', async () => {
  const state = runningState({ round: 0, builderSession: null });
  const before = structuredClone(state);
  const h = harness([maxTurns('S-1'), maxTurns('S-1'), readyResult]);

  const out = await runBuilderWithContinuation({ state, config, round: 0, prompt: 'build it', deps: h.deps });

  assert.equal(out.result.outcome, 'READY');
  assert.equal(h.calls.length, 3, 'exactly three bounded segments, no more');
  // One session: the first segment opens it, every continuation resumes that EXACT id.
  assert.deepEqual(h.calls.map((c) => c.resume), [null, 'S-1', 'S-1']);
  assert.deepEqual(h.calls.map((c) => c.round), [0, 0, 0]);
  assert.deepEqual(h.calls.map((c) => c.prompt), ['build it', 'build it', 'build it']);
  assert.equal(state.sessions.builder, 'S-1');
  // Counter incremented exactly twice and persisted BEFORE each retry segment.
  assert.equal(state.builderContinuationResumesUsed, 2);
  assert.deepEqual(h.log, [
    'segment#1 resume=FRESH round=0',
    'persist used=0 attempt=0 builder=S-1',
    'emit builder.session_preserved_after_error',
    'persist used=1 attempt=0 builder=S-1',
    'emit builder.continuation_started',
    'segment#2 resume=S-1 round=0',
    'persist used=1 attempt=0 builder=S-1',
    'emit builder.session_preserved_after_error',
    'persist used=2 attempt=0 builder=S-1',
    'emit builder.continuation_started',
    'segment#3 resume=S-1 round=0',
  ]);
  // No budget of any other kind moved, and no candidate/gate/review work happened between segments.
  assert.equal(state.attempt, before.attempt);
  assert.equal(state.ownerRemediationExtensionRounds, before.ownerRemediationExtensionRounds);
  assert.deepEqual(state.findings, before.findings);
  assert.equal(state.candidateSha, null);
  assert.equal(allowedMaxRound(config, state), allowedMaxRound(config, before));
  assert.deepEqual(h.persisted.map((s) => s.attempt), [0, 0, 0, 0]);
  assert.deepEqual(h.events.map((e) => e.event), [
    'builder.session_preserved_after_error',
    'builder.continuation_started',
    'builder.session_preserved_after_error',
    'builder.continuation_started',
  ]);
  const continuation = h.events[1];
  assert.equal(continuation.fields.session_id, 'S-1');
  assert.equal(continuation.fields.continuations_used, 1);
  assert.equal(continuation.fields.max_continuations, config.maxBuilderContinuationResumes);
  assert.equal(builderContinuationsRemaining(config, state), config.maxBuilderContinuationResumes - 2);
});

test('remediation-round continuation reuses session, round and remediation findings verbatim', async () => {
  const state = runningState({ round: 2, builderSession: 'S-live', used: 1 });
  const prompt = `Remediate these independent findings:\n${JSON.stringify(state.findings)}`;
  const h = harness([maxTurns('S-live'), readyResult]);

  await runBuilderWithContinuation({ state, config, round: 2, prompt, deps: h.deps });

  assert.deepEqual(h.calls.map((c) => c.resume), ['S-live', 'S-live']);
  assert.deepEqual(h.calls.map((c) => c.round), [2, 2]);
  assert.deepEqual(h.calls.map((c) => c.prompt), [prompt, prompt]);
  // TOTAL PER RUN: a continuation carried over from an earlier round keeps accumulating.
  assert.equal(state.builderContinuationResumesUsed, 2);
  assert.equal(state.attempt, 2, 'a continuation is the same round continuing, not a new round');
  assert.equal(state.ownerRemediationExtensionRounds, 0);
});

test('exhausted continuation budget fails closed without another model segment', async () => {
  const tight: FactoryConfig = ConfigSchema.parse({ ...config, maxBuilderContinuationResumes: 1 });
  const state = runningState({ round: 1, builderSession: 'S-2', used: 1 });
  assert.equal(builderContinuationsRemaining(tight, state), 0);
  const h = harness([maxTurns('S-2')]);

  await assert.rejects(
    () => runBuilderWithContinuation({ state, config: tight, round: 1, prompt: 'p', deps: h.deps }),
    (e: unknown) => {
      const message = (e as Error).message;
      assert.ok(message.startsWith(BUILDER_CONTINUATION_BUDGET_BLOCK_PREFIX), message);
      assert.match(message, /S-2/, 'blocked reason must retain the builder session identity');
      assert.match(message, /maxBuilderContinuationResumes/);
      return true;
    },
  );

  assert.equal(h.calls.length, 1, 'budget exhaustion must not invoke another model segment');
  assert.equal(state.builderContinuationResumesUsed, 1, 'no continuation was spent');
  assert.equal(state.sessions.builder, 'S-2', 'session identity is retained for a later resume');
  assert.deepEqual(h.events.map((e) => e.event), ['builder.session_preserved_after_error', 'builder.continuation_budget_exhausted']);

  // resumeRun's pre-Claude gate: closed at the current limit, re-opened by raising it.
  const blocked = RunStateSchema.parse({ ...state, phase: 'BLOCKED', blockedReason: supervisor.builderContinuationBudgetBlockedReason('S-2', 1) });
  assert.equal(builderContinuationResumeBlocked(tight, blocked), true);
  assert.equal(builderContinuationResumeBlocked(ConfigSchema.parse({ ...config, maxBuilderContinuationResumes: 2 }), blocked), false);
  assert.equal(builderContinuationResumeBlocked(tight, { ...blocked, blockedReason: 'reviewer blocked: nope' }), false);
  assert.equal(builderContinuationResumeBlocked(tight, { ...blocked, phase: 'REMEDIATE' }), false);
});

test('non-recoverable claude failures never auto-resume', async () => {
  const cases: Array<{ name: string; error: unknown }> = [
    { name: 'other builder subtype', error: new ClaudeRoleFailure('builder', 'error_during_execution', 'S-3', 12, 'boom') },
    { name: 'builder without session identity', error: new ClaudeRoleFailure('builder', 'error_max_turns', null, 48, 'no session') },
    { name: 'reviewer max turns', error: new ClaudeRoleFailure('reviewer', 'error_max_turns', 'S-r', 48, 'reviewer') },
    { name: 'ordinary error', error: new Error('worktree exploded') },
  ];
  for (const c of cases) {
    assert.equal(isBuilderContinuationFailure(c.error), false, c.name);
    const state = runningState({ round: 0, builderSession: 'S-3' });
    const h = harness([c.error as Error]);
    await assert.rejects(() => runBuilderWithContinuation({ state, config, round: 0, prompt: 'p', deps: h.deps }), (e: unknown) => e === c.error);
    assert.equal(h.calls.length, 1, `${c.name} must not start a continuation segment`);
    assert.equal(state.builderContinuationResumesUsed, 0, c.name);
    assert.equal(h.events.filter((e) => e.event === 'builder.continuation_started').length, 0, c.name);
  }
  assert.equal(isBuilderContinuationFailure(maxTurns('S-3')), true);
});

test('builder session identity change stays a blocker', async () => {
  const state = runningState({ round: 0, builderSession: 'S-old' });
  const h = harness([maxTurns('S-new'), readyResult]);
  await assert.rejects(
    () => runBuilderWithContinuation({ state, config, round: 0, prompt: 'p', deps: h.deps }),
    /builder session identity changed: S-old -> S-new/,
  );
  assert.equal(h.calls.length, 1);
  assert.equal(state.builderContinuationResumesUsed, 0);
});

test('continuation budget config and persisted counter parse with backwards-compatible defaults', () => {
  assert.equal(config.maxBuilderContinuationResumes, 6, 'shipped example config declares the empirical budget');
  const { maxBuilderContinuationResumes: _omitted, ...legacyConfig } = JSON.parse(JSON.stringify(config)) as Record<string, unknown> & { maxBuilderContinuationResumes: number };
  assert.equal(ConfigSchema.parse(legacyConfig).maxBuilderContinuationResumes, 6, 'legacy config defaults to 6');
  assert.equal(ConfigSchema.parse({ ...config, maxBuilderContinuationResumes: 0 }).maxBuilderContinuationResumes, 0);
  assert.equal(ConfigSchema.parse({ ...config, maxBuilderContinuationResumes: 20 }).maxBuilderContinuationResumes, 20);
  for (const bad of [-1, 21, 1.5]) {
    assert.throws(() => ConfigSchema.parse({ ...config, maxBuilderContinuationResumes: bad }), `maxBuilderContinuationResumes must reject ${bad}`);
  }

  const legacyState = legacyBudgetState();
  assert.equal(legacyState.builderContinuationResumesUsed, 0, 'legacy state files parse as 0');
  assert.throws(() => RunStateSchema.parse({ ...legacyState, builderContinuationResumesUsed: -1 }));
  assert.equal(builderContinuationsRemaining(config, legacyState), 6);
});

test('successful completion keeps the continuation audit count while clearing blocked state', () => {
  const before = runningState({ round: 1, builderSession: 'S-4', used: 4 });
  const blocked = RunStateSchema.parse({ ...before, phase: 'BLOCKED', blockedReason: supervisor.builderContinuationBudgetBlockedReason('S-4', 4) });
  const after = completeRunState(blocked);
  assert.equal(after.phase, 'DONE');
  assert.equal(after.blockedReason, null);
  assert.equal(after.builderContinuationResumesUsed, 4, 'audit trail survives completion and is never reset');
  assert.equal(blocked.builderContinuationResumesUsed, 4, 'pure transition must not mutate its prestate');
});

test('production supervisor path uses the continuation seam and the pre-claude resume gate', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /const b = await runBuilderWithContinuation\(\{/, 'execute() must run the builder through the continuation loop');
  // The write role is lane-derived: `builder` for an ordinary run, `owner-author` for an explicitly
  // supervisor-selected owner-authority run. Both are real Claude write roles, and the continuation
  // seam must be wired to whichever one this run actually uses.
  assert.match(src, /const writeRole: RoleName = lane === 'owner-author' \? 'owner-author' : 'builder'/, 'the write role must be derived from the run lane');
  assert.match(src, /runBuilderSegment: \(seg\) => runRole\(\{ role: writeRole/, 'the seam must be wired to the real write role runner');
  // The continuation persists through the run's single heartbeat-checked persistence point, so a
  // spent continuation is recorded with the same liveness guarantee as every other state write.
  assert.match(src, /persist: \(s\) => persistRunState\(s\)/, 'continuation persistence must be the real state writer');
  assert.match(src, /const persistRunState = \(s: RunState\): void => \{/, 'the state writer beats the claim before writing');
  assert.match(src, /if \(builderContinuationResumeBlocked\(config, state\)\)/, 'resumeRun must gate before any Claude segment');
});

test('V1 task mechanically runs loop:test in addition to typecheck and build', () => {
  assert.deepEqual(task.gates, [
    ['npx', 'tsc', '--noEmit'],
    ['npm', 'run', 'build'],
    ['npm', 'run', 'loop:test'],
  ]);
});

test('error_max_turns preserves recoverable builder session metadata', () => {
  const error = new ClaudeRoleFailure('builder', 'error_max_turns', 'builder-session', 48, '');
  assert.equal(error.sessionId, 'builder-session');
  assert.equal(error.numTurns, 48);
  assert.equal(recoverableBuilderSession(error), 'builder-session');
  assert.equal(recoverableBuilderSession(new ClaudeRoleFailure('reviewer', 'error_max_turns', 'review-session', 32, '')), null);
});

test('completed remediation advances persisted next round', () => {
  assert.equal(nextRoundAfterRemediation(0), 1);
  assert.equal(nextRoundAfterRemediation(3), 4);
});

test('legacy exhausted run needs explicit bounded owner extension before round 4', () => {
  const before = legacyBudgetState();
  assert.equal(before.ownerRemediationExtensionRounds, 0);
  assert.equal(allowedMaxRound(config, before), 3);
  const after = extendRemediationState(before, config, 1);
  assert.equal(before.attempt, 3, 'pure helper must not mutate prestate');
  assert.equal(after.attempt, 4);
  assert.equal(after.ownerRemediationExtensionRounds, 1);
  assert.equal(allowedMaxRound(config, after), 4);
});

test('owner extension rejects non-budget blocked state', () => {
  const state = legacyBudgetState();
  const other = { ...state, blockedReason: 'builder blocked' };
  assert.throws(() => extendRemediationState(other, config, 1), /remediation-budget BLOCKED/);
});

test('reviewer contract makes future/optional/sandbox-gate observations notes', () => {
  const reviewer = fs.readFileSync('.claude/agents/reviewer.md', 'utf8');
  assert.match(reviewer, /CURRENT task/);
  assert.match(reviewer, /Future-slice risks, optional hardening/);
  assert.match(reviewer, /MUST be severity note/);
  assert.match(reviewer, /supervisor's mechanical gate result/);
});

test('builder hands sandbox-blocked required gates back to supervisor', () => {
  const builder = fs.readFileSync('.claude/agents/builder.md', 'utf8');
  assert.match(builder, /cannot run inside the Claude sandbox/);
  assert.match(builder, /supervisor can execute `task\.gates` mechanically/);
});

test('successful completion clears stale blocking metadata and preserves valid run state', () => {
  const completeRunState = (supervisor as typeof supervisor & {
    completeRunState?: (state: RunState) => RunState;
  }).completeRunState;
  assert.equal(typeof completeRunState, 'function', 'supervisor must expose the pure successful-completion transition');

  const before = RunStateSchema.parse({
    ...legacyBudgetState(),
    runId: 'v1-20260811225005-synthetic',
    phase: 'BLOCKED',
    attempt: 5,
    candidateSha: '36c18a06bd41cb1497270c1786eb0bb46dd5ca17',
    sessions: { architect: 'arch-session', builder: 'builder-session', reviewer: 'reviewer-session', visualReviewer: 'visual-session' },
    ownerRemediationExtensionRounds: 2,
    findings: [{ id: 'old-blocker', severity: 'major', message: 'resolved before completion' }],
    advisoryFindings: [{ id: 'advisory', severity: 'note', message: 'retain this valid advisory' }],
    prUrl: 'https://example.test/pull/17',
    blockedReason: 'remediation budget exhausted after 5 rounds',
  });
  const snapshot = structuredClone(before);

  const after = completeRunState!(before);

  assert.deepEqual(after, { ...before, phase: 'DONE', blockedReason: null, findings: [] });
  assert.deepEqual(before, snapshot, 'pure completion transition must not mutate its BLOCKED prestate');
});
