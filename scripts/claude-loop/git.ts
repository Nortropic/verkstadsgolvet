import fs from 'node:fs';
import path from 'node:path';
import { git, gitRun, slug } from './util';

export function originMain(repo: string): string {
  gitRun(repo, ['fetch', 'origin', 'main']);
  return git(repo, 'rev-parse', 'refs/remotes/origin/main');
}
export function clean(repo: string): boolean { return git(repo, 'status', '--porcelain=v1', '--untracked-files=all') === ''; }
export function changedFiles(repo: string, base: string): string[] {
  const tracked = git(repo, 'diff', '--name-only', base).split('\n').filter(Boolean);
  const untracked = git(repo, 'ls-files', '--others', '--exclude-standard').split('\n').filter(Boolean);
  return [...new Set([...tracked, ...untracked])].sort();
}
export function createWorktree(repo: string, root: string, taskId: string, runId: string, base: string): { worktree: string; branch: string } {
  fs.mkdirSync(root, { recursive: true });
  const branch = `claude/${slug(taskId)}-${runId}`;
  const worktree = path.join(root, `${slug(taskId)}-${runId}`);
  if (fs.existsSync(worktree)) throw new Error(`worktree already exists: ${worktree}`);
  gitRun(repo, ['worktree', 'add', '-b', branch, worktree, base]);
  return { worktree, branch };
}
export function commitCandidate(worktree: string, taskId: string, round: number): string {
  gitRun(worktree, ['add', '--all']);
  const check = gitRun(worktree, ['diff', '--cached', '--quiet'], true);
  if (check.code === 0) throw new Error('no changes to commit');
  gitRun(worktree, ['-c', 'user.name=Nortropic Claude Supervisor', '-c', 'user.email=claude-supervisor@nortropic.local', 'commit', '-m', `[CLAUDE] ${taskId}: candidate round ${round}`]);
  return git(worktree, 'rev-parse', 'HEAD');
}
export function candidateTree(worktree: string): string { return git(worktree, 'rev-parse', 'HEAD^{tree}'); }
export function pushBranch(worktree: string, branch: string): void { gitRun(worktree, ['push', '-u', 'origin', branch]); }
