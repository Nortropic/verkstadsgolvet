import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('project settings keep sandbox, no-force guards and disable bypass/auto modes', () => {
  const s=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));
  assert.equal(s.sandbox.enabled,true);
  assert.equal(s.sandbox.failIfUnavailable,true);
  assert.equal(s.sandbox.allowUnsandboxedCommands,false);
  assert.equal(s.permissions.disableBypassPermissionsMode,'disable');
  assert.equal(s.permissions.disableAutoMode,'disable');
  assert.ok(s.permissions.deny.some((x:string)=>x.includes('git push')));
  assert.equal(s.permissions.allow.includes('Read'), false);
});
