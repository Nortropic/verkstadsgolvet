import type { Lane } from './lanes';

/**
 * Task authority class.
 *
 * `ordinary`     — every product task. Protected workflow-authority paths are never writable.
 * `owner-author` — the owner-authority lane, described in `scripts/claude-loop/owner-author/**`.
 *
 * The class is WORKFLOW data. It is never a security boundary and never Nortropic Trust Kernel
 * authority: it only decides which lane options and which exact write scope the supervisor applies.
 */
export type AuthorityClass = 'ordinary' | 'owner-author';

export const AUTHORITY_CLASSES: readonly AuthorityClass[] = ['ordinary', 'owner-author'];

export function laneForAuthorityClass(authorityClass: AuthorityClass): Lane {
  return authorityClass === 'owner-author' ? 'owner-author' : 'ordinary';
}

/**
 * The supervisor-side selection of owner-author task ids.
 *
 * The ONLY legitimate sources are operator-controlled and out of band of any model turn: the
 * `--owner-author <taskId>` CLI flag and `ownerAuthor.selectedTaskIds` in the git-ignored,
 * operator-local `.claude-loop.json`. The tracked backlog, a task file, chat context and model
 * output are all mere DECLARATIONS with no selecting power.
 */
export type AuthoritySelection = { selectedTaskIds: readonly string[] };

export const EMPTY_AUTHORITY_SELECTION: AuthoritySelection = { selectedTaskIds: [] };

export function isSupervisorSelected(taskId: string, selection: AuthoritySelection): boolean {
  return selection.selectedTaskIds.includes(taskId);
}

export const OWNER_AUTHOR_SELF_CLAIM_CODE = 'OWNER_AUTHOR_SELF_CLAIM';

/** Raised when anything other than an explicit supervisor selection tries to enter the owner lane. */
export class AuthorityEscalationError extends Error {
  readonly code = OWNER_AUTHOR_SELF_CLAIM_CODE;
  constructor(public readonly taskId: string, public readonly source: string) {
    super(`${OWNER_AUTHOR_SELF_CLAIM_CODE}: ${source} declares authorityClass=owner-author for task '${taskId}' without an explicit supervisor selection; the owner-author lane is entered only through the supervisor's --owner-author selection or operator-local ownerAuthor.selectedTaskIds, never through repository, task or model data`);
    this.name = 'AuthorityEscalationError';
  }
}

/**
 * Resolves the EFFECTIVE authority class for one task.
 *
 * Selection is the only grant. A declaration of `owner-author` that is not backed by a selection is
 * an escalation attempt and fails closed instead of being silently downgraded, so a model that
 * writes `"authorityClass": "owner-author"` into the tracked backlog or into a task file stops the
 * run rather than gaining authority. A declaration of `ordinary` never removes a real selection:
 * the operator, not the file, decides.
 */
export function resolveAuthorityClass(args: {
  taskId: string;
  declared?: AuthorityClass | null;
  selection: AuthoritySelection;
  source?: string;
}): AuthorityClass {
  const selected = isSupervisorSelected(args.taskId, args.selection);
  if (args.declared === 'owner-author' && !selected) {
    throw new AuthorityEscalationError(args.taskId, args.source ?? 'task data');
  }
  return selected ? 'owner-author' : 'ordinary';
}

/**
 * Publication guard for the owner-author lane.
 *
 * An owner-authority edit is never auto-merged into `main` by the Factory. Publication v2's
 * merge-only guards stay exactly as they are for ordinary tasks; here auto-merge simply may not be
 * armed at all, so a workflow-authority document can never be promoted by a model turn.
 */
export function assertOwnerAuthorPublicationGuard(args: { authorityClass: AuthorityClass; autoMerge: boolean }): void {
  if (args.authorityClass === 'owner-author' && args.autoMerge) {
    throw new Error('owner-author runs may never auto-merge: disable publish.autoMerge before running an owner-author task');
  }
}
