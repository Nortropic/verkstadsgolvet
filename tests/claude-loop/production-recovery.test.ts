import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClaudeRoleFailure } from '../../scripts/claude-loop/claude';
import { allowedMaxRound, extendRemediationState, nextRoundAfterRemediation, recoverableBuilderSession } from '../../scripts/claude-loop/supervisor';
import { ConfigSchema, RunStateSchema, TaskSchema } from '../../scripts/claude-loop/schemas';

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
