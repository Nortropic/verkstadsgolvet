import test from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeGitArgs, checkWriteScope, matchPattern } from '../../scripts/claude-loop/util';

test('allowed-write patterns', () => {
  assert.equal(matchPattern('lib/loop/a.ts', 'lib/loop/**'), true);
  assert.deepEqual(checkWriteScope(['lib/loop/a.ts'], ['lib/loop/**'], []), []);
  assert.deepEqual(checkWriteScope(['app/page.tsx'], ['lib/loop/**'], []), ['app/page.tsx']);
  assert.deepEqual(checkWriteScope(['lib/loop/a.ts'], ['lib/loop/**'], ['lib/loop/**']), ['lib/loop/a.ts']);
});

test('forbidden git semantics fail closed', () => {
  assert.throws(() => assertSafeGitArgs(['push','--force','origin','x']));
  assert.throws(() => assertSafeGitArgs(['reset','--hard','HEAD']));
  assert.throws(() => assertSafeGitArgs(['rebase','main']));
  assert.doesNotThrow(() => assertSafeGitArgs(['status','--short']));
});
