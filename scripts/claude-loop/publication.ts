import { git, gitRun, sh } from './util';
import { changedFiles, pushBranch } from './git';

function prNumber(url: string): string {
  const m = url.match(/\/pull\/(\d+)(?:\/?$)/);
  if (!m) throw new Error(`cannot parse PR number from ${url}`);
  return m[1];
}

export function publish(args: { repo: string; worktree: string; branch: string; baseSha: string; candidateSha: string; taskId: string; autoMerge: boolean }): { prUrl: string; mergedMain?: string } {
  gitRun(args.repo, ['fetch', 'origin', 'main']);
  const currentMain = git(args.repo, 'rev-parse', 'refs/remotes/origin/main');
  if (currentMain !== args.baseSha) throw new Error(`publication base changed expected=${args.baseSha} actual=${currentMain}`);
  if (git(args.worktree, 'rev-parse', 'HEAD') !== args.candidateSha) throw new Error('worktree HEAD differs from reviewed candidate');
  pushBranch(args.worktree, args.branch);
  const remoteHead = sh('git', ['ls-remote', 'origin', `refs/heads/${args.branch}`], args.worktree).out.trim().split(/\s+/)[0] || '';
  if (remoteHead !== args.candidateSha) throw new Error(`remote branch identity mismatch expected=${args.candidateSha} actual=${remoteHead}`);

  const pr = sh('gh', ['pr', 'create', '--repo', 'Nortropic/verkstadsgolvet', '--base', 'main', '--head', args.branch, '--title', `[CLAUDE] ${args.taskId}`, '--body', `Claude Factory candidate ${args.candidateSha}. Model output is workflow evidence only; mechanical gates and reviewed candidate identity are recorded by the supervisor.`], args.worktree);
  const prUrl = pr.out.trim().split('\n').at(-1) || '';
  const num = prNumber(prUrl);
  const meta = JSON.parse(sh('gh', ['api', `repos/Nortropic/verkstadsgolvet/pulls/${num}`], args.worktree).out);
  if (meta.state !== 'open' || meta.base?.ref !== 'main' || meta.base?.sha !== args.baseSha || meta.head?.ref !== args.branch || meta.head?.sha !== args.candidateSha) {
    throw new Error('PR identity/base/head mismatch after creation');
  }
  const expectedFiles = changedFiles(args.worktree, args.baseSha);
  const actualFiles = JSON.parse(sh('gh', ['api', `repos/Nortropic/verkstadsgolvet/pulls/${num}/files?per_page=100`], args.worktree).out).map((x: any) => String(x.filename)).sort();
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) throw new Error(`PR file scope mismatch expected=${expectedFiles.join(',')} actual=${actualFiles.join(',')}`);
  if (!args.autoMerge) return { prUrl };

  sh('gh', ['pr', 'merge', prUrl, '--repo', 'Nortropic/verkstadsgolvet', '--rebase', '--match-head-commit', args.candidateSha], args.worktree);
  gitRun(args.repo, ['fetch', 'origin', 'main']);
  const mergedMain = git(args.repo, 'rev-parse', 'refs/remotes/origin/main');
  const candidateTree = git(args.worktree, 'rev-parse', `${args.candidateSha}^{tree}`);
  const mainTree = git(args.repo, 'rev-parse', 'refs/remotes/origin/main^{tree}');
  if (candidateTree !== mainTree) throw new Error('merged tree differs from reviewed candidate tree');
  return { prUrl, mergedMain };
}
