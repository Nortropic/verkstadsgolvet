import { matchPattern } from './util';
import type { Lane } from './lanes';

/**
 * Workflow-authority paths.
 *
 * Only the explicitly supervisor-selected owner-author lane may author these, and only when the
 * task's own `allowedWrite` names them. An ordinary product task can never reach them, no matter
 * what its task file, the tracked backlog or a model claims.
 */
export const PROTECTED_AUTHORITY_PATHS: readonly string[] = [
  'CLAUDE.md',
  '.claude/**',
  'docs/claude-operating-model-v1.md',
];

/**
 * Paths no Claude lane may ever write.
 *
 * The control-room plan and its codex handoff are owner-authored inputs to the Factory, not Factory
 * outputs; secrets are never writable; `.git/**` is Git's own object/ref storage, and writing it
 * would be a ref/history rewrite behind the supervisor's back.
 */
export const NEVER_WRITABLE_PATHS: readonly string[] = [
  'docs/nortropic-control-room-plan-v1.md',
  'docs/nortropic-control-room-codex-handoff.md',
  '.env',
  '.env.*',
  '**/.env',
  '**/.env.*',
  '.git/**',
  '**/.git/**',
];

export type ScopeViolationReason =
  | 'unsafe-path'
  | 'never-writable'
  | 'denied'
  | 'protected-authority'
  | 'outside-allowed';

export type ScopeViolation = { file: string; reason: ScopeViolationReason; detail: string };

/** Rejects anything that is not a plain repository-relative forward-slash path. */
export function unsafeRepoPath(file: string): string | null {
  if (!file) return 'empty path';
  if (file.includes('\0')) return 'path contains NUL';
  const normalized = file.replaceAll('\\', '/');
  if (normalized.startsWith('/')) return 'absolute path';
  if (/^[A-Za-z]:/.test(normalized)) return 'drive-qualified path';
  if (normalized.startsWith('~')) return 'home-relative path';
  const segments = normalized.split('/');
  if (segments.some((s) => s === '..')) return 'parent traversal';
  return null;
}

/**
 * Post-write EXACT scope validation.
 *
 * Runs on the changed-file set the supervisor derives from Git AFTER the model stopped writing, so
 * it measures what actually happened rather than what a role reported. Every rule fails closed and
 * a single violation blocks the run; there is no "mostly in scope".
 */
export function validateExactScope(args: {
  files: string[];
  allowedWrite: string[];
  deniedWrite: string[];
  lane: Lane;
}): ScopeViolation[] {
  const violations: ScopeViolation[] = [];
  for (const file of args.files) {
    const unsafe = unsafeRepoPath(file);
    if (unsafe) { violations.push({ file, reason: 'unsafe-path', detail: unsafe }); continue; }
    const never = NEVER_WRITABLE_PATHS.find((p) => matchPattern(file, p));
    if (never) { violations.push({ file, reason: 'never-writable', detail: `matches never-writable ${never}` }); continue; }
    const denied = args.deniedWrite.find((p) => matchPattern(file, p));
    if (denied) { violations.push({ file, reason: 'denied', detail: `matches task deniedWrite ${denied}` }); continue; }
    const protectedPath = PROTECTED_AUTHORITY_PATHS.find((p) => matchPattern(file, p));
    if (protectedPath && args.lane !== 'owner-author') {
      violations.push({ file, reason: 'protected-authority', detail: `matches workflow-authority ${protectedPath}; only a supervisor-selected owner-author run may write it` });
      continue;
    }
    if (!args.allowedWrite.some((p) => matchPattern(file, p))) {
      violations.push({ file, reason: 'outside-allowed', detail: 'matches no task allowedWrite pattern' });
    }
  }
  return violations;
}

export function formatScopeViolations(violations: ScopeViolation[]): string {
  return violations.map((v) => `${v.file} [${v.reason}: ${v.detail}]`).join(', ');
}

/**
 * Declaration-time guard for a task's write scope.
 *
 * An ordinary task may not even DECLARE a protected workflow-authority path, and no task may
 * declare a never-writable path. This is checked before a model starts, so a backlog entry that
 * tries to widen an ordinary lane is refused instead of being discovered after the writes.
 */
export function assertDeclaredScope(args: { taskId: string; allowedWrite: string[]; lane: Lane }): void {
  for (const pattern of args.allowedWrite) {
    const unsafe = unsafeRepoPath(pattern.replaceAll('*', 'x'));
    if (unsafe) throw new Error(`task ${args.taskId} declares an unsafe allowedWrite pattern '${pattern}': ${unsafe}`);
    if (NEVER_WRITABLE_PATHS.some((p) => p === pattern || matchPattern(pattern.replaceAll('*', 'x'), p))) {
      throw new Error(`task ${args.taskId} declares a never-writable allowedWrite pattern '${pattern}'`);
    }
    if (args.lane !== 'owner-author' && PROTECTED_AUTHORITY_PATHS.some((p) => p === pattern || matchPattern(pattern.replaceAll('*', 'x'), p))) {
      throw new Error(`ordinary task ${args.taskId} declares workflow-authority allowedWrite pattern '${pattern}'; only a supervisor-selected owner-author run may write it`);
    }
  }
}
