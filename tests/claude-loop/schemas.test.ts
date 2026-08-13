import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskSchema, RoleResultSchema } from '../../scripts/claude-loop/schemas';

test('task requires explicit allowed-write and gates', () => {
  assert.equal(TaskSchema.safeParse({id:'V1',title:'x',description:'x',allowedWrite:['lib/loop/**'],gates:[['npm','run','build']]}).success, true);
  assert.equal(TaskSchema.safeParse({id:'V1',title:'x',description:'x',allowedWrite:[],gates:[]}).success, false);
});

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

const baseTask = { id: 'V8-FIXTURE', title: 'x', description: 'x', allowedWrite: ['components/loop/**'], gates: [['npm', 'run', 'build']] };

test('a visualReview task without preview configuration is invalid DATA, not a run-time surprise', () => {
  const missing = TaskSchema.safeParse({ ...baseTask, visualReview: true });
  assert.equal(missing.success, false, 'visualReview=true without task.visual must never parse');
  assert.deepEqual(missing.error?.issues.map((i) => i.path.join('.')), ['visual'], 'the failure names the missing field');
  assert.match(missing.error!.issues[0].message, /visualReview=true requires a task\.visual preview configuration/);

  // An empty object is not a configuration either: previewCommand and previewUrl are required.
  assert.equal(TaskSchema.safeParse({ ...baseTask, visualReview: true, visual: {} }).success, false);
  assert.equal(TaskSchema.safeParse({ ...baseTask, visualReview: true, visual: { previewCommand: [], previewUrl: 'http://127.0.0.1:4317/loop' } }).success, false);
  assert.equal(TaskSchema.safeParse({ ...baseTask, visualReview: true, visual: { previewCommand: ['npm'], previewUrl: 'not-a-url' } }).success, false);

  // A fully configured visual task parses, and the configuration survives verbatim.
  const configured = TaskSchema.parse({ ...baseTask, visualReview: true, visual: PROVEN_VISUAL });
  assert.deepEqual(configured.visual, PROVEN_VISUAL, 'argv, URL, timeout, auth flag and viewports are preserved exactly');
  assert.deepEqual(configured.visual!.previewCommand, PROVEN_VISUAL.previewCommand, 'previewCommand stays an argv array, never a shell string');
});

test('a non-visual task still needs no preview configuration at all', () => {
  assert.equal(TaskSchema.parse({ ...baseTask, visualReview: false }).visual, undefined);
  const defaulted = TaskSchema.parse(baseTask);
  assert.equal(defaulted.visualReview, false, 'visual review is opt-in');
  assert.equal(defaulted.visual, undefined, 'and a non-visual task is complete without a preview');
});

test('the completeness barrier never weakens the loopback-only rule for credential-bearing previews', () => {
  // Still refused: a credential-bearing preview against a remote origin, configured or not.
  assert.equal(TaskSchema.safeParse({ ...baseTask, visualReview: true, visual: { ...PROVEN_VISUAL, previewUrl: 'https://example.com/loop' } }).success, false);
  // Still allowed: an anonymous remote preview, which carries no credentials.
  assert.equal(TaskSchema.safeParse({ ...baseTask, visualReview: true, visual: { previewCommand: ['npm', 'run', 'dev'], previewUrl: 'https://example.com/loop', authenticated: false } }).success, true);
});

test('role output is structured', () => {
  const x = RoleResultSchema.parse({outcome:'READY',summary:'ok',findings:[],tests:[],changed_files:[],next_action:'DONE'});
  assert.equal(x.outcome, 'READY');
});
