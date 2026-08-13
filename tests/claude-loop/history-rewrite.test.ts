import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORBIDDEN_GIT_SHORT_FLAGS,
  FORBIDDEN_GIT_SUBCOMMANDS,
  FORBIDDEN_GIT_TOKENS,
  assertSafeGitArgs,
  gitRun,
} from '../../scripts/claude-loop/util';
import { assertSafeGhArgs, requireSupportedMergeMethod, MERGE_METHOD_MERGE } from '../../scripts/claude-loop/publication';
import { ConfigSchema } from '../../scripts/claude-loop/schemas';

/**
 * Every history-rewrite path, falsified.
 *
 * A candidate commit is the exact object an independent reviewer read and the exact object
 * publication proves as the merge's second parent. Anything that could rewrite, re-point or destroy
 * it must fail BEFORE a process is spawned. These tests enumerate the ways that could happen —
 * commit rewriting, ref forging, branch deletion, reflog/gc destruction, forced pushes, refspec
 * deletion, and rebase/squash publication — and require each one to throw.
 */

/** Predicate for `assert.throws`: any real Error passes; the point is that it fails closed. */
const isError = (e: unknown): e is Error => e instanceof Error;

const REWRITE_CASES: Array<{ name: string; argv: string[] }> = [
  { name: 'reset --hard', argv: ['reset', '--hard', 'HEAD~1'] },
  { name: 'reset --soft', argv: ['reset', '--soft', 'HEAD~1'] },
  { name: 'reset --mixed', argv: ['reset', '--mixed', 'HEAD'] },
  { name: 'reset behind -c', argv: ['-c', 'core.pager=cat', 'reset', 'HEAD~1'] },
  { name: 'rebase', argv: ['rebase', 'origin/main'] },
  { name: 'rebase --root', argv: ['rebase', '--root'] },
  { name: 'rebase --autosquash', argv: ['rebase', '--autosquash', 'origin/main'] },
  { name: 'commit --amend', argv: ['commit', '--amend', '-m', 'rewritten candidate'] },
  { name: 'commit --amend behind ident flags', argv: ['-c', 'user.name=x', 'commit', '--amend', '--no-edit'] },
  { name: 'commit --fixup', argv: ['commit', '--fixup', 'HEAD'] },
  { name: 'filter-branch', argv: ['filter-branch', '--tree-filter', 'rm -f secret', 'HEAD'] },
  { name: 'filter-repo', argv: ['filter-repo', '--path', 'lib'] },
  { name: 'update-ref', argv: ['update-ref', 'refs/heads/main', 'deadbeef'] },
  { name: 'update-ref -d', argv: ['update-ref', '-d', 'refs/heads/claude/candidate'] },
  { name: 'symbolic-ref', argv: ['symbolic-ref', 'HEAD', 'refs/heads/other'] },
  { name: 'replace', argv: ['replace', 'aaaa', 'bbbb'] },
  { name: 'reflog expire', argv: ['reflog', 'expire', '--expire=now', '--all'] },
  { name: 'gc --prune', argv: ['gc', '--prune=now'] },
  { name: 'prune', argv: ['prune'] },
  { name: 'cherry-pick', argv: ['cherry-pick', 'aaaa'] },
  { name: 'am', argv: ['am', 'patch.mbox'] },
  { name: 'commit-tree', argv: ['commit-tree', 'aaaa'] },
  { name: 'fast-import', argv: ['fast-import'] },
  { name: 'push --force', argv: ['push', '--force', 'origin', 'main'] },
  { name: 'push --force-with-lease', argv: ['push', '--force-with-lease', 'origin', 'main'] },
  { name: 'push --force-if-includes', argv: ['push', '--force-if-includes', 'origin', 'main'] },
  { name: 'push -f', argv: ['push', '-f', 'origin', 'main'] },
  { name: 'push --mirror', argv: ['push', '--mirror', 'origin'] },
  { name: 'push --prune', argv: ['push', '--prune', 'origin', 'refs/heads/*'] },
  { name: 'push --delete', argv: ['push', '--delete', 'origin', 'claude/candidate'] },
  { name: 'push refspec deletion', argv: ['push', 'origin', ':refs/heads/claude/candidate'] },
  { name: 'push leading + refspec', argv: ['push', 'origin', '+refs/heads/main:refs/heads/main'] },
  { name: 'branch -D', argv: ['branch', '-D', 'claude/candidate'] },
  { name: 'branch -M', argv: ['branch', '-M', 'main'] },
  { name: 'branch -f', argv: ['branch', '-f', 'main', 'HEAD~3'] },
  { name: 'tag -f', argv: ['tag', '-f', 'v1', 'HEAD'] },
  { name: 'tag -d', argv: ['tag', '-d', 'v1'] },
  { name: 'checkout --orphan', argv: ['checkout', '--orphan', 'fresh'] },
  { name: 'switch --orphan', argv: ['switch', '--orphan', 'fresh'] },
  { name: 'merge --squash', argv: ['merge', '--squash', 'claude/candidate'] },
];

test('every history-rewrite argv fails before any process is spawned', () => {
  for (const c of REWRITE_CASES) {
    assert.throws(() => assertSafeGitArgs(c.argv), isError, `${c.name} must be refused`);
    // gitRun is the only production path that reaches git; the guard is in front of it.
    assert.throws(() => gitRun(process.cwd(), c.argv, true), isError, `${c.name} must be refused by gitRun too`);
  }
});

test('the guard scans every argument, not just the subcommand position', () => {
  assert.throws(() => assertSafeGitArgs(['-c', 'core.hooksPath=/dev/null', '-c', 'x=y', 'reset', '--hard']));
  assert.throws(() => assertSafeGitArgs(['worktree', 'add', '-f', '/tmp/x', 'main']));
  assert.deepEqual(FORBIDDEN_GIT_SUBCOMMANDS.includes('reset'), true);
  assert.deepEqual(FORBIDDEN_GIT_TOKENS.includes('--amend'), true);
  assert.deepEqual(FORBIDDEN_GIT_SHORT_FLAGS.includes('-f'), true);
});

test('the ordinary Factory git vocabulary still works, so the guard is not vacuous', () => {
  const allowed: string[][] = [
    ['fetch', 'origin', 'main'],
    ['rev-parse', 'refs/remotes/origin/main'],
    ['rev-parse', '--git-common-dir'],
    ['status', '--porcelain=v1', '--untracked-files=all'],
    ['diff', '--name-only', 'a'.repeat(40)],
    ['diff', '--cached', '--quiet'],
    ['ls-files', '--others', '--exclude-standard'],
    ['worktree', 'add', '-b', 'claude/task-run', '/tmp/wt', 'a'.repeat(40)],
    ['add', '--all'],
    ['-c', 'user.name=Nortropic Claude Supervisor', '-c', 'user.email=claude-supervisor@nortropic.local', 'commit', '-m', '[CLAUDE] V8-FIXTURE: candidate round 1'],
    ['push', '-u', 'origin', 'claude/task-run'],
    ['rev-list', '--parents', '-n', '1', 'a'.repeat(40)],
  ];
  for (const argv of allowed) assert.doesNotThrow(() => assertSafeGitArgs(argv), `${argv.join(' ')} must stay allowed`);
});

test('candidates are only ever appended: the supervisor has no amend or repair path', () => {
  const git = fs.readFileSync('scripts/claude-loop/git.ts', 'utf8');
  assert.match(git, /'commit', '-m'/, 'a candidate is a plain new commit');
  assert.equal(/--amend|reset|rebase|filter-branch|update-ref/.test(git), false, 'no rewriting vocabulary in the candidate path');

  const supervisor = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(supervisor, /Each round appends a NEW immutable candidate commit/);
  assert.equal(/commitCandidate\([^)]*amend/.test(supervisor), false);

  const autopilot = fs.readFileSync('scripts/claude-loop/autopilot.ts', 'utf8');
  // The scheduler OBSERVES publication; it never performs one and never moves a ref. Its entire
  // Git vocabulary is read-only: fetch, rev-parse, rev-list and nothing else.
  for (const forbidden of [/\bpushBranch\b/, /\bpublish\s*\(/, /\bgh\b/, /merge_method/, /\bcommitCandidate\b/, /'(push|commit|merge|branch|tag|update-ref)'/]) {
    assert.equal(forbidden.test(autopilot), false, `the autopilot must not contain ${forbidden}`);
  }
  const gitVerbs = [...autopilot.matchAll(/\bgit(?:Run)?\((?:[^,]+),\s*(?:\[)?'([a-z-]+)'/g)].map((m) => m[1]);
  assert.ok(gitVerbs.length > 0, 'the autopilot does read Git');
  assert.deepEqual([...new Set(gitVerbs)].sort(), ['fetch', 'rev-list', 'rev-parse'], 'only read-only Git verbs');
});

test('Publication v2 stays merge-only and refuses every rewriting publication semantic', () => {
  for (const argv of [
    ['pr', 'merge', '--rebase', '17'],
    ['pr', 'merge', '--squash', '17'],
    ['pr', 'merge', '--delete-branch', '17'],
    ['pr', 'merge', '--admin', '17'],
    ['api', '--method', 'PUT', 'repos/x/pulls/1/merge', '-f', 'merge_method=rebase'],
    ['api', '--method', 'PUT', 'repos/x/pulls/1/merge', '-f', 'merge_method=squash'],
  ]) {
    assert.throws(() => assertSafeGhArgs(argv), /forbidden publication semantics/, `${argv.join(' ')} must be refused`);
  }
  assert.equal(requireSupportedMergeMethod('merge'), MERGE_METHOD_MERGE);
  assert.throws(() => requireSupportedMergeMethod('rebase'), /publishes only normal GitHub merge commits/);
  assert.throws(() => requireSupportedMergeMethod('squash'), /publishes only normal GitHub merge commits/);
  assert.throws(() => ConfigSchema.parse({ ...ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8'))), publish: { enabled: true, autoMerge: true, mergeMethod: 'rebase' } }));
});

test('the autopilot cannot publish or move main: publication stays behind the operator switches', () => {
  const shipped = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
  assert.equal(shipped.publish.enabled, false);
  assert.equal(shipped.publish.autoMerge, false);
  assert.equal(shipped.publish.mergeMethod, 'merge');
  assert.equal(shipped.autopilot.enabled, false);

  // Publication is reached only from the supervisor's PUBLISH phase, guarded by config.
  const supervisor = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(supervisor, /if \(config\.publish\.enabled\)/);
  assert.match(supervisor, /mergeMethod: config\.publish\.mergeMethod/);
});
