import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export function sh(cmd: string, args: string[], cwd?: string, allowFailure = false): { code: number; out: string } {
  const p = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = `${p.stdout ?? ''}${p.stderr ?? ''}`;
  if (!allowFailure && p.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed rc=${p.status}\n${out}`);
  return { code: p.status ?? 1, out };
}

/**
 * Git subcommands that rewrite, destroy or re-point history, blocked before any process is spawned.
 *
 * Candidates are immutable evidence: a candidate commit is what an independent reviewer read and
 * what publication proves as the merge's second parent. Every command here could make the object on
 * disk stop being that object — by rewriting commits (`reset`, `rebase`, `filter-branch`,
 * `filter-repo`, `commit-tree`), by re-pointing or forging refs (`update-ref`, `symbolic-ref`,
 * `replace`, `fast-import`), or by destroying the reachability evidence itself (`reflog`, `gc`,
 * `prune`). None of them is ever needed by the Factory, so all of them fail closed.
 */
export const FORBIDDEN_GIT_SUBCOMMANDS: readonly string[] = [
  'reset', 'rebase', 'filter-branch', 'filter-repo', 'replace', 'update-ref', 'symbolic-ref',
  'reflog', 'gc', 'prune', 'commit-tree', 'fast-import', 'cherry-pick', 'am',
];

/** Substring-matched rewriting/forcing option tokens. */
export const FORBIDDEN_GIT_TOKENS: readonly string[] = [
  '--force', '--force-with-lease', '--force-if-includes', '--amend', '--orphan', '--mirror',
  '--prune', '--hard', '--soft', '--mixed', '--root', '--autosquash', '--fixup', '--squash',
  '--filter=', '--delete', '--allow-empty-message',
];

/** Exact-match short flags whose git spelling means force/delete/move. `-m`/`-b` stay allowed. */
export const FORBIDDEN_GIT_SHORT_FLAGS: readonly string[] = ['-f', '-D', '-M', '-d'];

export function assertSafeGitArgs(args: string[]): void {
  const joined = args.join(' ');
  const bad = FORBIDDEN_GIT_TOKENS.filter((x) => joined.includes(x));
  if (bad.length) throw new Error(`forbidden git semantics: ${bad.join(' ')} in ${joined}`);
  // Scanned over EVERY argument, not just argv[0]: `git -c core.x=y reset --hard` must fail too.
  const subcommand = args.find((x) => FORBIDDEN_GIT_SUBCOMMANDS.includes(x));
  if (subcommand) throw new Error(`history rewrite command forbidden: ${subcommand} in ${joined}`);
  if (args.some((x) => FORBIDDEN_GIT_SHORT_FLAGS.includes(x))) throw new Error(`forbidden git short flag: ${joined}`);
  if (args.some((x) => x.startsWith('+'))) throw new Error(`leading + refspec forbidden: ${joined}`);
  // `git push origin :branch` and `refs/heads/x:` delete or re-point a remote ref.
  if ((args[0] || '') === 'push' && args.some((x) => x.startsWith(':'))) throw new Error(`refspec deletion forbidden: ${joined}`);
}

export function gitRun(cwd: string, args: string[], allowFailure = false): { code: number; out: string } {
  assertSafeGitArgs(args);
  return sh('git', args, cwd, allowFailure);
}

export function git(cwd: string, ...args: string[]): string {
  assertSafeGitArgs(args);
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function repoRoot(cwd = process.cwd()): string { return git(cwd, 'rev-parse', '--show-toplevel'); }
export function commonGitDir(repo: string): string {
  const p = git(repo, 'rev-parse', '--git-common-dir');
  return path.resolve(repo, p);
}
/**
 * The OPERATOR's checkout, derived from the Git common directory rather than from `cwd`.
 *
 * `repoRoot()` answers "which working tree am I standing in", which inside a Factory worktree is
 * the candidate's own tree — a tree a model just wrote. Supervisor configuration must never be read
 * from there, so it is resolved here instead: the common directory of every worktree is the main
 * checkout's `.git`, and its parent is the operator's checkout. A repository layout that is not
 * `<checkout>/.git` (a bare repository) falls back to the given root rather than guessing.
 */
export function mainCheckout(repo: string): string {
  const common = commonGitDir(repo);
  // Git's own answer about where the main repository lives, so it cannot be influenced by a model
  // or by the current working directory. A bare repository has no checkout to point at.
  return path.basename(common) === '.git' ? path.dirname(common) : repo;
}

export function ensureDir(p: string): void { fs.mkdirSync(p, { recursive: true, mode: 0o700 }); }
export function readJson<T>(p: string): T { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; }
/**
 * Writes JSON atomically: a temp file in the SAME directory, then `rename`.
 *
 * `rename` within one filesystem is atomic, so a concurrent reader — another supervisor in another
 * worktree reading the shared claim/ledger/run state under the Git common directory — sees either
 * the whole previous file or the whole new one, never a truncated file. A torn state file would
 * otherwise fail every later parse and take the whole scheduler down.
 */
export function writeJson(p: string, value: unknown): void {
  ensureDir(path.dirname(p));
  const tmp = `${p}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
    fs.renameSync(tmp, p);
  } catch (error) {
    try { fs.rmSync(tmp, { force: true }); } catch { /* the temp file is best-effort cleanup only */ }
    throw error;
  }
}
export function slug(v: string): string { return v.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'task'; }
export function nowId(): string { return new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14); }

export function matchPattern(file: string, pattern: string): boolean {
  const f = file.replaceAll('\\\\', '/');
  const p = pattern.replaceAll('\\\\', '/');
  if (p.endsWith('/**')) { const prefix = p.slice(0, -3).replace(/\/$/, ''); return f === prefix || f.startsWith(prefix + '/'); }
  const re = '^' + p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$';
  return new RegExp(re).test(f);
}

export function checkWriteScope(files: string[], allowed: string[], denied: string[]): string[] {
  return files.filter((f) => denied.some((p) => matchPattern(f, p)) || !allowed.some((p) => matchPattern(f, p)));
}
