import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

export function sh(cmd: string, args: string[], cwd?: string, allowFailure = false): { code: number; out: string } {
  const p = spawnSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const out = `${p.stdout ?? ''}${p.stderr ?? ''}`;
  if (!allowFailure && p.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed rc=${p.status}\n${out}`);
  return { code: p.status ?? 1, out };
}

export function assertSafeGitArgs(args: string[]): void {
  const joined = args.join(' ');
  const badTokens = ['--force', '--force-with-lease', '--amend'];
  if (badTokens.some((x) => joined.includes(x))) throw new Error(`forbidden git semantics: ${joined}`);
  if (['reset', 'rebase'].includes(args[0] || '')) throw new Error(`history rewrite command forbidden: ${joined}`);
  if (args.some((x) => x.startsWith('+'))) throw new Error(`leading + refspec forbidden: ${joined}`);
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
export function ensureDir(p: string): void { fs.mkdirSync(p, { recursive: true, mode: 0o700 }); }
export function readJson<T>(p: string): T { return JSON.parse(fs.readFileSync(p, 'utf8')) as T; }
export function writeJson(p: string, value: unknown): void { ensureDir(path.dirname(p)); fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }); }
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
