import { git, gitRun, sh } from './util';
import { changedFiles, pushBranch } from './git';

/** The single repository Claude Factory may publish into. */
export const PUBLICATION_REPO = 'Nortropic/verkstadsgolvet';

/**
 * The ONLY auto-merge method supported by Claude Factory: a normal GitHub merge commit.
 *
 * A merge commit is the only result that preserves the exact reviewed candidate commit as an
 * immutable ancestor of `main`. Rebase and squash both synthesize NEW commits, so the object that
 * lands on `main` is not the object an independent reviewer read. Any request for another method
 * fails closed here and in `ConfigSchema`; it is never silently replaced by this one.
 */
export const MERGE_METHOD_MERGE = 'merge';
export type MergeMethod = typeof MERGE_METHOD_MERGE;

const SHA40 = /^[0-9a-f]{40}$/;

/** Returns the merge method only when it is the supported merge-commit method; throws otherwise. */
export function requireSupportedMergeMethod(method: string): MergeMethod {
  if (method !== MERGE_METHOD_MERGE) {
    throw new Error(`unsupported publication merge method '${method}': Claude Factory publishes only normal GitHub merge commits (merge_method=${MERGE_METHOD_MERGE})`);
  }
  return method;
}

/**
 * History-rewriting and branch-destroying `gh` semantics, blocked before any process is spawned.
 *
 * This mirrors `assertSafeGitArgs` for the GitHub CLI: publication may never reach `gh pr merge
 * --rebase/--squash`, may never force anything and may never delete the immutable candidate branch
 * whose remote identity is the published evidence.
 */
const FORBIDDEN_GH_TOKENS = ['--rebase', '--squash', '--force', '--amend', '--delete-branch', '--admin', `merge_method=rebase`, `merge_method=squash`];

export function assertSafeGhArgs(args: string[]): void {
  const joined = args.join(' ');
  const bad = FORBIDDEN_GH_TOKENS.filter((token) => joined.includes(token));
  if (bad.length) throw new Error(`forbidden publication semantics: ${bad.join(' ')} in gh ${joined}`);
}

function gh(args: string[], cwd: string, allowFailure = false): { code: number; out: string } {
  assertSafeGhArgs(args);
  return sh('gh', args, cwd, allowFailure);
}

function prNumber(url: string): string {
  const m = url.match(/\/pull\/(\d+)(?:\/?$)/);
  if (!m) throw new Error(`cannot parse PR number from ${url}`);
  return m[1];
}

/** Exactly the PR facts publication is allowed to depend on. Everything else is ignored. */
export type PullRequestSnapshot = {
  state?: string;
  base?: { ref?: string; sha?: string };
  head?: { ref?: string; sha?: string };
};

/** GitHub's merge response. `merged` must be explicitly true and `sha` a real merge commit. */
export type MergeResponse = { merged?: boolean; sha?: string | null; message?: string };

/** Injectable GitHub seam so publication is testable without touching the real repository. */
export type GitHubPublicationApi = {
  createPullRequest(a: { repo: string; base: string; head: string; title: string; body: string; cwd: string }): string;
  readPullRequest(a: { repo: string; number: string; cwd: string }): PullRequestSnapshot;
  listPullRequestFiles(a: { repo: string; number: string; cwd: string }): string[];
  mergePullRequest(a: { repo: string; number: string; expectedHeadSha: string; mergeMethod: MergeMethod; cwd: string }): MergeResponse;
};

export const githubCliApi: GitHubPublicationApi = {
  createPullRequest: ({ repo, base, head, title, body, cwd }) => {
    const out = gh(['pr', 'create', '--repo', repo, '--base', base, '--head', head, '--title', title, '--body', body], cwd).out;
    return out.trim().split('\n').at(-1) || '';
  },
  readPullRequest: ({ repo, number, cwd }) => JSON.parse(gh(['api', `repos/${repo}/pulls/${number}`], cwd).out) as PullRequestSnapshot,
  listPullRequestFiles: ({ repo, number, cwd }) =>
    (JSON.parse(gh(['api', `repos/${repo}/pulls/${number}/files?per_page=100`], cwd).out) as Array<{ filename?: unknown }>).map((x) => String(x.filename)).sort(),
  mergePullRequest: ({ repo, number, expectedHeadSha, mergeMethod, cwd }) => {
    // `sha` is GitHub's expected-head guard: the API refuses the merge if the PR head moved.
    const args = ['api', '--method', 'PUT', `repos/${repo}/pulls/${number}/merge`, '-f', `sha=${expectedHeadSha}`, '-f', `merge_method=${requireSupportedMergeMethod(mergeMethod)}`];
    const res = gh(args, cwd, true);
    if (res.code !== 0) throw new Error(`github refused the merge request rc=${res.code}\n${res.out}`);
    return JSON.parse(res.out) as MergeResponse;
  },
};

function remoteBranchSha(worktree: string, branch: string): string {
  return sh('git', ['ls-remote', 'origin', `refs/heads/${branch}`], worktree).out.trim().split(/\s+/)[0] || '';
}

function assertPullRequestIdentity(pr: PullRequestSnapshot, args: { branch: string; baseSha: string; candidateSha: string }, stage: string): void {
  if (pr.state !== 'open') throw new Error(`PR is not open ${stage} state=${String(pr.state)}`);
  if (pr.base?.ref !== 'main') throw new Error(`PR base ref is not main ${stage} actual=${String(pr.base?.ref)}`);
  if (pr.base?.sha !== args.baseSha) throw new Error(`PR base sha is not the frozen base ${stage} expected=${args.baseSha} actual=${String(pr.base?.sha)}`);
  if (pr.head?.ref !== args.branch) throw new Error(`PR head ref is not the factory branch ${stage} expected=${args.branch} actual=${String(pr.head?.ref)}`);
  if (pr.head?.sha !== args.candidateSha) throw new Error(`PR head sha is not the reviewed candidate ${stage} expected=${args.candidateSha} actual=${String(pr.head?.sha)}`);
}

function assertFileScope(actual: string[], expected: string[], stage: string): void {
  const a = [...actual].sort();
  const e = [...expected].sort();
  if (JSON.stringify(a) !== JSON.stringify(e)) throw new Error(`PR file scope mismatch ${stage} expected=${e.join(',')} actual=${a.join(',')}`);
}

export type PublishArgs = {
  repo: string;
  worktree: string;
  branch: string;
  baseSha: string;
  candidateSha: string;
  taskId: string;
  autoMerge: boolean;
  mergeMethod: string;
};

export type PublishResult = { prUrl: string; mergedMain?: string; mergeSha?: string };

/**
 * Publishes one exact reviewed candidate.
 *
 * `autoMerge=false` stops at a verified PR. `autoMerge=true` additionally re-locks EVERY identity
 * fact immediately before merging (origin/main still the frozen base, worktree HEAD and the remote
 * candidate branch still the exact reviewed candidate, PR still open with the same base/head/file
 * scope), merges through GitHub's merge API with an expected head SHA and `merge_method=merge`,
 * and then proves from Git itself that `main` really is a two-parent merge commit of
 * base + reviewed candidate carrying the reviewed tree. Anything else is a block, never a success:
 * a tree-equivalent but rewritten history is explicitly rejected.
 *
 * The candidate branch is intentionally left in place; its remote identity is publication evidence.
 */
export function publish(args: PublishArgs, api: GitHubPublicationApi = githubCliApi): PublishResult {
  const mergeMethod = requireSupportedMergeMethod(args.mergeMethod);

  gitRun(args.repo, ['fetch', 'origin', 'main']);
  const currentMain = git(args.repo, 'rev-parse', 'refs/remotes/origin/main');
  if (currentMain !== args.baseSha) throw new Error(`publication base changed expected=${args.baseSha} actual=${currentMain}`);
  if (git(args.worktree, 'rev-parse', 'HEAD') !== args.candidateSha) throw new Error('worktree HEAD differs from reviewed candidate');
  pushBranch(args.worktree, args.branch);
  const remoteHead = remoteBranchSha(args.worktree, args.branch);
  if (remoteHead !== args.candidateSha) throw new Error(`remote branch identity mismatch expected=${args.candidateSha} actual=${remoteHead}`);

  const prUrl = api.createPullRequest({
    repo: PUBLICATION_REPO,
    base: 'main',
    head: args.branch,
    title: `[CLAUDE] ${args.taskId}`,
    body: `Claude Factory candidate ${args.candidateSha}. Model output is workflow evidence only; mechanical gates and reviewed candidate identity are recorded by the supervisor. Auto-merge, when the operator enables it, is a normal GitHub merge commit guarded by the expected head SHA; the candidate commit and branch stay immutable.`,
    cwd: args.worktree,
  });
  const num = prNumber(prUrl);
  assertPullRequestIdentity(api.readPullRequest({ repo: PUBLICATION_REPO, number: num, cwd: args.worktree }), args, 'after creation');
  assertFileScope(api.listPullRequestFiles({ repo: PUBLICATION_REPO, number: num, cwd: args.worktree }), changedFiles(args.worktree, args.baseSha), 'after creation');
  if (!args.autoMerge) return { prUrl };

  // Re-lock every fact immediately before the merge; nothing observed earlier is trusted here.
  gitRun(args.repo, ['fetch', 'origin', 'main']);
  const mainBeforeMerge = git(args.repo, 'rev-parse', 'refs/remotes/origin/main');
  if (mainBeforeMerge !== args.baseSha) throw new Error(`pre-merge origin/main is not the frozen base expected=${args.baseSha} actual=${mainBeforeMerge}`);
  const headBeforeMerge = git(args.worktree, 'rev-parse', 'HEAD');
  if (headBeforeMerge !== args.candidateSha) throw new Error(`pre-merge worktree HEAD is not the reviewed candidate expected=${args.candidateSha} actual=${headBeforeMerge}`);
  const remoteBeforeMerge = remoteBranchSha(args.worktree, args.branch);
  if (remoteBeforeMerge !== args.candidateSha) throw new Error(`pre-merge remote candidate branch is not the reviewed candidate expected=${args.candidateSha} actual=${remoteBeforeMerge}`);
  assertPullRequestIdentity(api.readPullRequest({ repo: PUBLICATION_REPO, number: num, cwd: args.worktree }), args, 'before merge');
  assertFileScope(api.listPullRequestFiles({ repo: PUBLICATION_REPO, number: num, cwd: args.worktree }), changedFiles(args.worktree, args.baseSha), 'before merge');

  const merge = api.mergePullRequest({ repo: PUBLICATION_REPO, number: num, expectedHeadSha: args.candidateSha, mergeMethod, cwd: args.worktree });
  if (merge.merged !== true) throw new Error(`github did not merge the candidate merged=${String(merge.merged)} message=${String(merge.message ?? '')}`);
  const mergeSha = String(merge.sha ?? '');
  if (!SHA40.test(mergeSha)) throw new Error(`github merge returned an invalid merge sha '${mergeSha}'`);

  gitRun(args.repo, ['fetch', 'origin', 'main']);
  const mergedMain = git(args.repo, 'rev-parse', 'refs/remotes/origin/main');
  if (mergedMain !== mergeSha) throw new Error(`origin/main is not the merge commit reported by github expected=${mergeSha} actual=${mergedMain}`);

  const parents = git(args.repo, 'rev-list', '--parents', '-n', '1', mergeSha).split(/\s+/).filter(Boolean).slice(1);
  if (parents.length !== 2) throw new Error(`published main is not a two-parent merge commit parents=${parents.length} [${parents.join(',')}]`);
  if (parents[0] !== args.baseSha) throw new Error(`merge commit first parent is not the frozen base expected=${args.baseSha} actual=${parents[0]}`);
  if (parents[1] !== args.candidateSha) throw new Error(`merge commit second parent is not the reviewed candidate expected=${args.candidateSha} actual=${parents[1]}`);
  const candidateTreeSha = git(args.worktree, 'rev-parse', `${args.candidateSha}^{tree}`);
  const mergeTree = git(args.repo, 'rev-parse', `${mergeSha}^{tree}`);
  if (mergeTree !== candidateTreeSha) throw new Error(`merged tree differs from reviewed candidate tree expected=${candidateTreeSha} actual=${mergeTree}`);

  return { prUrl, mergedMain, mergeSha };
}
