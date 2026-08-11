import test from 'node:test';
import assert from 'node:assert/strict';
import { roleDefinition, type RoleName } from '../../scripts/claude-loop/claude';

const roles: RoleName[] = ['architect', 'builder', 'reviewer', 'visual-reviewer'];

test('every Claude Factory role keeps StructuredOutput available', () => {
  for (const role of roles) {
    const def = roleDefinition(process.cwd(), role);
    assert.ok(def.tools?.includes('StructuredOutput'), `${role} must expose StructuredOutput when outputFormat is required`);
  }
});

test('role capability split remains narrow while StructuredOutput is available', () => {
  const architect = roleDefinition(process.cwd(), 'architect');
  const builder = roleDefinition(process.cwd(), 'builder');
  const reviewer = roleDefinition(process.cwd(), 'reviewer');
  const visual = roleDefinition(process.cwd(), 'visual-reviewer');

  assert.equal(architect.tools?.includes('Edit'), false);
  assert.equal(reviewer.tools?.includes('Edit'), false);
  assert.equal(visual.tools?.includes('Edit'), false);
  assert.equal(builder.tools?.includes('Edit'), true);
  assert.equal(builder.tools?.includes('Write'), true);
});
