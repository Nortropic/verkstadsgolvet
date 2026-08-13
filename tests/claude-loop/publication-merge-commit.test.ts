import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ConfigSchema } from '../../scripts/claude-loop/schemas';
import {
  MERGE_METHOD_MERGE,
  PUBLICATION_REPO,
  assertSafeGhArgs,
  publish,
  requireSupportedMergeMethod,
  type GitHubPublicationApi,
  type MergeResponse,
  type PublishArgs,
  type PullRequestSnapshot,
} from '../../scripts/claude-loop/publication';

/**
 * Hermetic publication regression suite.
 *
 * Every test runs against a DISPOSABLE local Git universe (a bare origin, a repo clone, a Factory
 * worktree and a "server side" clone used to simulate GitHub-side history) inside a temp dir that
 * is deleted afterwards. GitHub itself is an injected seam, so no test can reach, mutate or even
 * name the real Nortropic/verkstadsgolvet repository. Git behaviour — merge parents, trees,
 * fast-forwards, remote refs — is REAL, which is what makes the parentage assertions meaningful.
 */

const IDENT = ['-c', 'user.name=Claude Factory Test', '-c', 'user.email=factory-test@nortropic.local', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false'];

function g(cwd: string, ...args: string[]): string {
  return execFileSync('git', [...IDENT, ...args], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

type Fixture = {
  root: string;
  bare: string;
  repo: string;
  worktree: string;
  server: string;
  branch: string;
  baseSha: string;
  baseTree: string;
  candidateSha: string;
  candidateTree: string;
};

const CANDIDATE_FILE = 'factory-note.txt';

function makeFixture(): Fixture {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-publication-'));
  const bare = path.join(root, 'origin.git');
  const repo = path.join(root, 'repo');
  const server = path.join(root, 'server');
  const worktree = path.join(root, 'worktree');
  const branch = 'claude/publication-fixture-20260813';

  g(root, 'init', '--bare', '--initial-branch=main', bare);
  fs.mkdirSync(repo, { recursive: true });
  g(repo, 'init', '--initial-branch=main');
  fs.writeFileSync(path.join(repo, 'README.md'), 'disposable publication fixture\n', 'utf8');
  g(repo, 'add', '--all');
  g(repo, 'commit', '-m', 'fixture base');
  g(repo, 'remote', 'add', 'origin', bare);
  g(repo, 'push', '-u', 'origin', 'main');
  const baseSha = g(repo, 'rev-parse', 'HEAD');
  const baseTree = g(repo, 'rev-parse', 'HEAD^{tree}');

  g(repo, 'worktree', 'add', '-b', branch, worktree, 'main');
  fs.writeFileSync(path.join(worktree, CANDIDATE_FILE), 'exact reviewed candidate\n', 'utf8');
  g(worktree, 'add', '--all');
  g(worktree, 'commit', '-m', '[CLAUDE] candidate round 0');
  const candidateSha = g(worktree, 'rev-parse', 'HEAD');
  const candidateTree = g(worktree, 'rev-parse', 'HEAD^{tree}');

  g(root, 'clone', bare, server);
  return { root, bare, repo, worktree, server, branch, baseSha, baseTree, candidateSha, candidateTree };
}

/** Runs `fn` against a fresh disposable universe and always deletes it. */
function withFixture(fn: (fx: Fixture) => void): void {
  const fx = makeFixture();
  try { fn(fx); } finally { fs.rmSync(fx.root, { recursive: true, force: true }); }
}

function originRef(fx: Fixture, ref: string): string {
  const out = execFileSync('git', ['ls-remote', fx.bare, `refs/heads/${ref}`], { encoding: 'utf8' }).trim();
  return out.split(/\s+/)[0] ?? '';
}

/** Ordinary fast-forward push of a new commit onto an origin branch: no force, no rewrite. */
function serverAdvance(fx: Fixture, ref: string, file: string): string {
  g(fx.server, 'fetch', 'origin');
  g(fx.server, 'checkout', '-B', 'drift', `origin/${ref}`);
  fs.writeFileSync(path.join(fx.server, file), `${file}\n`, 'utf8');
  g(fx.server, 'add', '--all');
  g(fx.server, 'commit', '-m', `drift ${file}`);
  const sha = g(fx.server, 'rev-parse', 'HEAD');
  g(fx.server, 'push', 'origin', `HEAD:refs/heads/${ref}`);
  return sha;
}

/** Server-side commit creation with an exact tree and exact parents. */
function serverCommit(fx: Fixture, spec: { parents: string[]; tree: string; message: string }): string {
  g(fx.server, 'fetch', 'origin');
  const args = ['commit-tree', spec.tree, '-m', spec.message];
  for (const p of spec.parents) args.push('-p', p);
  return g(fx.server, ...args);
}

/** Server-side commit creation + fast-forward publish to main, exactly as scripted by a test. */
function serverPublishToMain(fx: Fixture, spec: { parents: string[]; tree: string }): string {
  const sha = serverCommit(fx, { ...spec, message: 'Merge pull request (fixture)' });
  g(fx.server, 'push', 'origin', `${sha}:refs/heads/main`);
  return sha;
}

function defaultPr(fx: Fixture): PullRequestSnapshot {
  return { state: 'open', base: { ref: 'main', sha: fx.baseSha }, head: { ref: fx.branch, sha: fx.candidateSha } };
}

type MergeCall = { repo: string; number: string; expectedHeadSha: string; mergeMethod: string };

type FakeOptions = {
  pr?: PullRequestSnapshot;
  files?: string[];
  afterPrCreated?: () => void;
  merge?: (fx: Fixture) => MergeResponse;
};

function fakeGitHub(fx: Fixture, opts: FakeOptions = {}) {
  const calls = { create: 0, read: 0, files: 0, merge: [] as MergeCall[] };
  const api: GitHubPublicationApi = {
    createPullRequest: () => {
      calls.create += 1;
      opts.afterPrCreated?.();
      return `https://github.test/${PUBLICATION_REPO}/pull/42`;
    },
    readPullRequest: () => { calls.read += 1; return opts.pr ?? defaultPr(fx); },
    listPullRequestFiles: () => { calls.files += 1; return opts.files ?? [CANDIDATE_FILE]; },
    mergePullRequest: (a) => {
      calls.merge.push({ repo: a.repo, number: a.number, expectedHeadSha: a.expectedHeadSha, mergeMethod: a.mergeMethod });
      if (opts.merge) return opts.merge(fx);
      const sha = serverPublishToMain(fx, { parents: [fx.baseSha, fx.candidateSha], tree: fx.candidateTree });
      return { merged: true, sha };
    },
  };
  return { api, calls };
}

function publishArgs(fx: Fixture, over: Partial<PublishArgs> = {}): PublishArgs {
  return {
    repo: fx.repo,
    worktree: fx.worktree,
    branch: fx.branch,
    baseSha: fx.baseSha,
    candidateSha: fx.candidateSha,
    taskId: 'FACTORY-PUBLICATION-V2',
    autoMerge: true,
    mergeMethod: MERGE_METHOD_MERGE,
    ...over,
  };
}

/** Asserts publication blocked, GitHub was never asked to merge, and origin/main never moved. */
function assertBlockedBeforeMerge(fx: Fixture, calls: { merge: MergeCall[] }, run: () => void, expected: RegExp): void {
  assert.throws(run, expected);
  assert.equal(calls.merge.length, 0, 'a blocked publication must never call the merge API');
  assert.equal(originRef(fx, 'main'), fx.baseSha, 'origin/main must be untouched by a blocked publication');
}

test('POSITIVE: the exact reviewed candidate lands as a two-parent merge commit preserving the reviewed tree', () => {
  withFixture((fx) => {
    const { api, calls } = fakeGitHub(fx);

    const result = publish(publishArgs(fx), api);

    // GitHub was asked for exactly one normal merge commit, guarded by the reviewed head SHA.
    assert.deepEqual(calls.merge, [{ repo: PUBLICATION_REPO, number: '42', expectedHeadSha: fx.candidateSha, mergeMethod: 'merge' }]);
    assert.equal(calls.create, 1);
    // Identity is re-read immediately before the merge, not trusted from PR-creation time.
    assert.equal(calls.read, 2);
    assert.equal(calls.files, 2);

    const mergeSha = result.mergeSha!;
    assert.match(mergeSha, /^[0-9a-f]{40}$/);
    assert.equal(result.mergedMain, mergeSha);
    assert.equal(result.prUrl, `https://github.test/${PUBLICATION_REPO}/pull/42`);

    // Truth from Git, not from the API response: origin/main IS that merge commit.
    assert.equal(originRef(fx, 'main'), mergeSha);
    const parents = g(fx.repo, 'rev-list', '--parents', '-n', '1', mergeSha).split(/\s+/).slice(1);
    assert.equal(parents.length, 2, 'publication must produce a real merge commit');
    assert.equal(parents[0], fx.baseSha, 'first parent is the frozen base');
    assert.equal(parents[1], fx.candidateSha, 'second parent is the EXACT reviewed candidate');
    assert.equal(g(fx.repo, 'rev-parse', `${mergeSha}^{tree}`), fx.candidateTree, 'merged tree is the reviewed tree');
    // The reviewed candidate commit itself survives unrewritten and is now an ancestor of main.
    assert.equal(g(fx.repo, 'rev-parse', `${fx.candidateSha}^{tree}`), fx.candidateTree);
    assert.equal(g(fx.repo, 'merge-base', '--is-ancestor', fx.candidateSha, mergeSha), '');
    // The candidate branch keeps its immutable remote identity: this task never deletes it.
    assert.equal(originRef(fx, fx.branch), fx.candidateSha);
    assert.equal(g(fx.worktree, 'rev-parse', 'HEAD'), fx.candidateSha, 'the worktree candidate is never rewritten');
  });
});

test('autoMerge=false creates a verified PR and stops without merging', () => {
  withFixture((fx) => {
    const { api, calls } = fakeGitHub(fx);

    const result = publish(publishArgs(fx, { autoMerge: false }), api);

    assert.equal(result.prUrl, `https://github.test/${PUBLICATION_REPO}/pull/42`);
    assert.equal(result.mergedMain, undefined);
    assert.equal(result.mergeSha, undefined);
    assert.equal(calls.merge.length, 0, 'autoMerge=false must never merge');
    assert.equal(calls.create, 1);
    assert.equal(calls.read, 1);
    assert.equal(calls.files, 1);
    // Ordinary non-force branch push happened; main is untouched.
    assert.equal(originRef(fx, fx.branch), fx.candidateSha);
    assert.equal(originRef(fx, 'main'), fx.baseSha);
  });
});

test('main changed before publication blocks at the frozen-base lock', () => {
  withFixture((fx) => {
    const moved = serverAdvance(fx, 'main', 'someone-elses-change.txt');
    const { api, calls } = fakeGitHub(fx);

    assert.throws(() => publish(publishArgs(fx), api), new RegExp(`publication base changed expected=${fx.baseSha} actual=${moved}`));
    assert.equal(calls.create, 0, 'a changed base must block before a PR is opened');
    assert.equal(calls.merge.length, 0);
    assert.equal(originRef(fx, 'main'), moved);
  });
});

test('main drifting after PR creation blocks in the pre-merge re-lock', () => {
  withFixture((fx) => {
    let moved = '';
    const { api, calls } = fakeGitHub(fx, { afterPrCreated: () => { moved = serverAdvance(fx, 'main', 'late-drift.txt'); } });

    assert.throws(() => publish(publishArgs(fx), api), /pre-merge origin\/main is not the frozen base/);
    assert.equal(calls.merge.length, 0);
    assert.equal(originRef(fx, 'main'), moved, 'publication must not merge onto a drifted main');
  });
});

test('a moved candidate/worktree HEAD blocks both before and after PR creation', () => {
  withFixture((fx) => {
    fs.writeFileSync(path.join(fx.worktree, 'unreviewed.txt'), 'not reviewed\n', 'utf8');
    g(fx.worktree, 'add', '--all');
    g(fx.worktree, 'commit', '-m', 'unreviewed extra commit');
    const { api, calls } = fakeGitHub(fx);

    assert.throws(() => publish(publishArgs(fx), api), /worktree HEAD differs from reviewed candidate/);
    assert.equal(calls.create, 0);
    assert.equal(calls.merge.length, 0);
    assert.equal(originRef(fx, 'main'), fx.baseSha);
  });

  withFixture((fx) => {
    // Same file set, different content: the file-scope guard cannot see this, only the pre-merge
    // HEAD identity re-lock can.
    const { api, calls } = fakeGitHub(fx, {
      afterPrCreated: () => {
        fs.writeFileSync(path.join(fx.worktree, CANDIDATE_FILE), 'silently edited after review\n', 'utf8');
        g(fx.worktree, 'add', '--all');
        g(fx.worktree, 'commit', '-m', 'unreviewed extra commit');
      },
    });

    assertBlockedBeforeMerge(fx, calls, () => publish(publishArgs(fx), api), /pre-merge worktree HEAD is not the reviewed candidate/);
  });
});

test('remote candidate branch drift blocks before merge', () => {
  withFixture((fx) => {
    let drifted = '';
    const { api, calls } = fakeGitHub(fx, { afterPrCreated: () => { drifted = serverAdvance(fx, fx.branch, 'branch-drift.txt'); } });

    assertBlockedBeforeMerge(fx, calls, () => publish(publishArgs(fx), api), /pre-merge remote candidate branch is not the reviewed candidate/);
    assert.notEqual(drifted, fx.candidateSha);
    assert.equal(originRef(fx, fx.branch), drifted);
  });
});

test('a wrong PR base blocks', () => {
  const cases: Array<{ name: string; pr: (fx: Fixture) => PullRequestSnapshot; expect: RegExp }> = [
    { name: 'base ref is not main', pr: (fx) => ({ ...defaultPr(fx), base: { ref: 'release', sha: fx.baseSha } }), expect: /PR base ref is not main/ },
    { name: 'base sha is not the frozen base', pr: (fx) => ({ ...defaultPr(fx), base: { ref: 'main', sha: 'f'.repeat(40) } }), expect: /PR base sha is not the frozen base/ },
    { name: 'PR is not open', pr: (fx) => ({ ...defaultPr(fx), state: 'closed' }), expect: /PR is not open/ },
  ];
  for (const c of cases) {
    withFixture((fx) => {
      const { api, calls } = fakeGitHub(fx, { pr: c.pr(fx) });
      assertBlockedBeforeMerge(fx, calls, () => publish(publishArgs(fx), api), c.expect);
    });
  }
});

test('a wrong PR head blocks', () => {
  const cases: Array<{ name: string; pr: (fx: Fixture) => PullRequestSnapshot; expect: RegExp }> = [
    { name: 'head ref is another branch', pr: (fx) => ({ ...defaultPr(fx), head: { ref: 'claude/some-other-run', sha: fx.candidateSha } }), expect: /PR head ref is not the factory branch/ },
    { name: 'head sha is not the reviewed candidate', pr: (fx) => ({ ...defaultPr(fx), head: { ref: fx.branch, sha: 'a'.repeat(40) } }), expect: /PR head sha is not the reviewed candidate/ },
  ];
  for (const c of cases) {
    withFixture((fx) => {
      const { api, calls } = fakeGitHub(fx, { pr: c.pr(fx) });
      assertBlockedBeforeMerge(fx, calls, () => publish(publishArgs(fx), api), c.expect);
    });
  }
});

test('a changed PR file scope blocks', () => {
  for (const files of [[CANDIDATE_FILE, 'app/page.tsx'], [], ['app/page.tsx']]) {
    withFixture((fx) => {
      const { api, calls } = fakeGitHub(fx, { files });
      assertBlockedBeforeMerge(fx, calls, () => publish(publishArgs(fx), api), /PR file scope mismatch/);
    });
  }
});

test('merge API returning merged=false is BLOCKED, never success', () => {
  withFixture((fx) => {
    const { api, calls } = fakeGitHub(fx, { merge: () => ({ merged: false, message: 'Base branch was modified. Review and try the merge again.' }) });

    assert.throws(() => publish(publishArgs(fx), api), /github did not merge the candidate merged=false/);
    assert.equal(calls.merge.length, 1);
    assert.equal(originRef(fx, 'main'), fx.baseSha);
  });

  // An absent/undefined `merged` is equally not a success.
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, { merge: () => ({ sha: 'b'.repeat(40) }) as MergeResponse });
    assert.throws(() => publish(publishArgs(fx), api), /github did not merge the candidate/);
    assert.equal(originRef(fx, 'main'), fx.baseSha);
  });
});

test('an invalid merge SHA in the merge response is BLOCKED', () => {
  for (const sha of [undefined, null, '', 'merged', 'ABCDEF', 'a'.repeat(39)]) {
    withFixture((fx) => {
      const { api } = fakeGitHub(fx, { merge: () => ({ merged: true, sha: sha as string | null | undefined }) });
      assert.throws(() => publish(publishArgs(fx), api), /github merge returned an invalid merge sha/);
      assert.equal(originRef(fx, 'main'), fx.baseSha);
    });
  }
});

test('a returned merge SHA that differs from the fetched origin/main is BLOCKED', () => {
  withFixture((fx) => {
    let realMerge = '';
    const { api } = fakeGitHub(fx, {
      merge: () => {
        realMerge = serverPublishToMain(fx, { parents: [fx.baseSha, fx.candidateSha], tree: fx.candidateTree });
        return { merged: true, sha: fx.candidateSha };
      },
    });

    assert.throws(() => publish(publishArgs(fx), api), /origin\/main is not the merge commit reported by github/);
    assert.equal(originRef(fx, 'main'), realMerge);
    assert.notEqual(realMerge, fx.candidateSha);
  });
});

test('a rewritten single-parent history with the reviewed tree is BLOCKED', () => {
  // Exactly the rebase/fast-forward shape this task exists to forbid: right tree, wrong history.
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, {
      merge: () => ({ merged: true, sha: serverPublishToMain(fx, { parents: [fx.baseSha], tree: fx.candidateTree }) }),
    });

    assert.throws(() => publish(publishArgs(fx), api), /published main is not a two-parent merge commit parents=1/);
    assert.equal(g(fx.repo, 'rev-parse', `refs/remotes/origin/main^{tree}`), fx.candidateTree, 'tree-equivalence alone must not be accepted');
  });
});

test('a three-parent octopus merge is BLOCKED', () => {
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, {
      merge: () => {
        const sideline = serverCommit(fx, { parents: [fx.baseSha], tree: fx.candidateTree, message: 'sideline' });
        return { merged: true, sha: serverPublishToMain(fx, { parents: [fx.baseSha, fx.candidateSha, sideline], tree: fx.candidateTree }) };
      },
    });

    assert.throws(() => publish(publishArgs(fx), api), /published main is not a two-parent merge commit parents=3/);
  });
});

test('a merge commit whose first parent is not the frozen base is BLOCKED', () => {
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, {
      merge: () => ({ merged: true, sha: serverPublishToMain(fx, { parents: [fx.candidateSha, fx.baseSha], tree: fx.candidateTree }) }),
    });

    assert.throws(() => publish(publishArgs(fx), api), /merge commit first parent is not the frozen base/);
  });
});

test('a merge commit whose second parent is not the reviewed candidate is BLOCKED', () => {
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, {
      merge: () => {
        // A DIFFERENT commit carrying the identical reviewed tree: content matches, identity does not.
        const impostor = serverCommit(fx, { parents: [fx.baseSha], tree: fx.candidateTree, message: 'impostor candidate' });
        assert.notEqual(impostor, fx.candidateSha);
        return { merged: true, sha: serverPublishToMain(fx, { parents: [fx.baseSha, impostor], tree: fx.candidateTree }) };
      },
    });

    assert.throws(() => publish(publishArgs(fx), api), /merge commit second parent is not the reviewed candidate/);
  });
});

test('a merged tree that differs from the reviewed candidate tree is BLOCKED', () => {
  withFixture((fx) => {
    const { api } = fakeGitHub(fx, {
      merge: () => ({ merged: true, sha: serverPublishToMain(fx, { parents: [fx.baseSha, fx.candidateSha], tree: fx.baseTree }) }),
    });

    assert.throws(() => publish(publishArgs(fx), api), /merged tree differs from reviewed candidate tree/);
  });
});

test('a configuration asking for rebase or squash fails validation instead of silently merging', () => {
  const example = JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8'));
  assert.equal(ConfigSchema.parse(example).publish.mergeMethod, 'merge');
  for (const bad of ['rebase', 'squash', 'REBASE', 'merge-commit', '']) {
    assert.throws(
      () => ConfigSchema.parse({ ...example, publish: { ...example.publish, mergeMethod: bad } }),
      `mergeMethod '${bad}' must fail configuration validation`,
    );
  }
  assert.throws(() => ConfigSchema.parse({ ...example, publish: { enabled: false, autoMerge: false } }), 'mergeMethod is required');

  assert.equal(requireSupportedMergeMethod('merge'), 'merge');
  for (const bad of ['rebase', 'squash']) {
    assert.throws(() => requireSupportedMergeMethod(bad), /unsupported publication merge method/);
  }
});

test('publish refuses a non-merge method before touching Git or GitHub', () => {
  for (const bad of ['rebase', 'squash']) {
    withFixture((fx) => {
      const { api, calls } = fakeGitHub(fx);
      assert.throws(() => publish(publishArgs(fx, { mergeMethod: bad }), api), /unsupported publication merge method/);
      assert.equal(calls.create, 0, 'no PR may be created for an unsupported merge method');
      assert.equal(calls.merge.length, 0);
      assert.equal(originRef(fx, 'main'), fx.baseSha);
      assert.equal(originRef(fx, fx.branch), '', 'the candidate branch is not even pushed');
    });
  }
});

test('gh argument guard rejects rebase/squash/force/amend/branch-deleting publication semantics', () => {
  const forbidden = [
    ['pr', 'merge', 'https://github.test/x/pull/1', '--rebase', '--match-head-commit', 'a'.repeat(40)],
    ['pr', 'merge', '1', '--squash'],
    ['pr', 'merge', '1', '--merge', '--delete-branch'],
    ['pr', 'merge', '1', '--merge', '--admin'],
    ['api', '--method', 'PUT', 'repos/x/y/pulls/1/merge', '-f', 'merge_method=rebase'],
    ['api', '--method', 'PUT', 'repos/x/y/pulls/1/merge', '-f', 'merge_method=squash'],
    ['push', '--force'],
    ['api', '--method', 'PATCH', 'x', '-f', 'commit=--amend'],
  ];
  for (const args of forbidden) {
    assert.throws(() => assertSafeGhArgs(args), /forbidden publication semantics/, args.join(' '));
  }
  // The only merge call publication is allowed to build stays safe.
  assertSafeGhArgs(['api', '--method', 'PUT', `repos/${PUBLICATION_REPO}/pulls/42/merge`, '-f', `sha=${'a'.repeat(40)}`, '-f', 'merge_method=merge']);
  assertSafeGhArgs(['pr', 'create', '--repo', PUBLICATION_REPO, '--base', 'main', '--head', 'claude/x', '--title', 't', '--body', 'b']);
});

test('publication source uses the GitHub merge API with an expected head SHA and no CLI rebase merge', () => {
  const src = fs.readFileSync('scripts/claude-loop/publication.ts', 'utf8');
  assert.doesNotMatch(src, /\['pr', 'merge'/, 'gh pr merge must not be used at all');
  assert.doesNotMatch(src, /--match-head-commit/);
  assert.match(src, /'api', '--method', 'PUT', `repos\/\$\{repo\}\/pulls\/\$\{number\}\/merge`/);
  assert.match(src, /`sha=\$\{expectedHeadSha\}`/, 'the merge must carry GitHub’s expected-head guard');
  assert.match(src, /`merge_method=\$\{requireSupportedMergeMethod\(mergeMethod\)\}`/);
  assert.match(src, /if \(res\.code !== 0\) throw new Error\(`github refused the merge request/, 'an API refusal must be a block');
  assert.doesNotMatch(src, /gitRun\([^)]*'branch', '-[dD]'/, 'this task must not delete the candidate branch');
});

test('supervisor passes the configured merge method explicitly into publication', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /mergeMethod: config\.publish\.mergeMethod/, 'the config field must not be unused');
  assert.match(src, /autoMerge: config\.publish\.autoMerge/);
});

test('shipped defaults stay safe and operator-local runtime config is git-ignored', () => {
  const config = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));
  assert.equal(config.publish.enabled, false);
  assert.equal(config.publish.autoMerge, false);
  assert.equal(config.publish.mergeMethod, 'merge');

  const ignored = fs.readFileSync('.gitignore', 'utf8').split('\n').map((l) => l.trim());
  assert.ok(ignored.includes('/.claude-loop.json'), '.claude-loop.json must be operator-local, never committed');
  assert.ok(ignored.includes('/.claude-loop/'));
});
