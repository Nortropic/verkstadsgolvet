import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewDisposition, builderRemediationFindings } from '../../scripts/claude-loop/review-policy';
import type { RoleResult } from '../../scripts/claude-loop/schemas';

const base = (over: Partial<RoleResult> = {}): RoleResult => ({
  outcome: 'READY', summary: 'ok', findings: [], tests: [], changed_files: [], next_action: 'DONE', ...over,
});

test('minor findings require remediation; notes are advisory', () => {
  const minor = reviewDisposition(base({ findings: [{ id:'m1', severity:'minor', message:'fix me' }] }));
  assert.equal(minor.action, 'REMEDIATE');
  assert.equal(minor.actionable.length, 1);
  const note = reviewDisposition(base({ findings: [{ id:'n1', severity:'note', message:'FYI' }] }));
  assert.equal(note.action, 'PASS');
  assert.equal(note.advisories.length, 1);
});

test('NEEDS_REMEDIATION cannot pass just because findings are nonblocking', () => {
  const r = reviewDisposition(base({ outcome:'NEEDS_REMEDIATION', findings:[{id:'n1',severity:'note',message:'note'}], next_action:'REMEDIATE' }));
  assert.equal(r.action, 'REMEDIATE');
  assert.equal(r.actionable[0]?.severity, 'major');
});

test('BLOCKED remains blocked', () => {
  assert.equal(reviewDisposition(base({ outcome:'BLOCKED', next_action:'BLOCKED' })).action, 'BLOCK');
});

test('builder NEEDS_REMEDIATION synthesizes actionable feedback when needed', () => {
  const f = builderRemediationFindings(base({ outcome:'NEEDS_REMEDIATION', next_action:'REMEDIATE', findings:[] }));
  assert.equal(f?.[0]?.severity, 'major');
});
