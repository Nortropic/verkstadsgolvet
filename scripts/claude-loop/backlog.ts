import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { commonGitDir, readJson, sh } from './util';
import { TaskSchema, VisualConfigSchema, type TaskSpec } from './schemas';
import type { AuthorityClass, AuthoritySelection } from './authority';
import { isSupervisorSelected } from './authority';

/** The tracked canonical backlog. It is repository data, never runtime state. */
export const CANONICAL_BACKLOG_FILE = 'backlog/control-room-v1.json';

/**
 * A mechanical prerequisite.
 *
 * `local_file` / `local_test` are measurable inside THIS repository and are measured, never assumed.
 *
 * `external_ref` / `external_file` point into another repository — in practice
 * `Nortropic/nortropic-system`. Verkstadsgolvet is not that repository's authority and cannot read
 * it from a Factory run, so such a prerequisite is UNMET until an owner-measured entry exists in the
 * runtime evidence file under the Git common directory. Absence is never optimism: it keeps the
 * slice WAITING. Model prose about a backend slice is not a measurement and can never satisfy this.
 */
export const PrerequisiteSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('local_file'), path: z.string().min(1), note: z.string().optional() }),
  z.object({ kind: z.literal('local_test'), command: z.array(z.string().min(1)).min(1), note: z.string().optional() }),
  z.object({ kind: z.literal('external_ref'), repository: z.string().min(1), ref: z.string().min(1), note: z.string().optional() }),
  z.object({ kind: z.literal('external_file'), repository: z.string().min(1), ref: z.string().min(1), path: z.string().min(1), note: z.string().optional() }),
  /**
   * "Backend slice <slice> is built and green in <repository>."
   *
   * Named by the backend's own slice identifier rather than by a guessed file path: this repository
   * must never invent a path, a ref layout or a field in `Nortropic/nortropic-system` in order to
   * describe a dependency it does not own.
   */
  z.object({ kind: z.literal('external_slice'), repository: z.string().min(1), slice: z.string().min(1), note: z.string().optional() }),
]);
export type Prerequisite = z.infer<typeof PrerequisiteSchema>;

/** The exact identity an owner measurement must carry to satisfy a prerequisite. */
export function prerequisiteKey(prerequisite: Prerequisite): string {
  if (prerequisite.kind === 'local_file') return `local:file:${prerequisite.path}`;
  if (prerequisite.kind === 'local_test') return `local:test:${prerequisite.command.join(' ')}`;
  if (prerequisite.kind === 'external_ref') return `${prerequisite.repository}#${prerequisite.ref}`;
  if (prerequisite.kind === 'external_file') return `${prerequisite.repository}#${prerequisite.ref}#${prerequisite.path}`;
  return `${prerequisite.repository}#slice:${prerequisite.slice}`;
}

export const BacklogTaskSchema = z.object({
  description: z.string().min(1),
  allowedWrite: z.array(z.string().min(1)).min(1),
  deniedWrite: z.array(z.string().min(1)).default([]),
  gates: z.array(z.array(z.string().min(1)).min(1)).min(1),
  visualReview: z.boolean().default(false),
  /**
   * Preview configuration for a visual slice, in the SAME shape the supervisor consumes.
   *
   * It is validated by the shared `VisualConfigSchema`, so the canonical backlog cannot declare an
   * unusable preview (empty argv, unparsable URL, zero-size viewport) and cannot declare a
   * credential-bearing preview against a non-loopback origin. `previewCommand` stays an argv array:
   * never a shell string, so nothing here is interpreted by a shell.
   *
   * Required exactly when `visualReview` is true; see `assertMaterializesToTask`.
   */
  visual: VisualConfigSchema,
});

export const BacklogItemSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  order: z.number().int().positive(),
  title: z.string().min(1),
  summary: z.string().min(1),
  planSection: z.string().min(1),
  /** A tracked CLAIM about the slice. `DONE` is only believed when its evidence files exist. */
  declaredStatus: z.enum(['DONE', 'PENDING']),
  /** True for a slice whose exit criteria are satisfied against fixtures only. Never live-complete. */
  fixtureOnly: z.boolean().default(false),
  /** The live slice this fixture slice must never be confused with. */
  liveCounterpart: z.string().nullable().default(null),
  /** A DECLARATION only. Entering the owner-author lane still requires supervisor selection. */
  authorityClass: z.enum(['ordinary', 'owner-author']).default('ordinary'),
  dependsOn: z.array(z.string()).default([]),
  prerequisites: z.array(PrerequisiteSchema).default([]),
  completionEvidence: z.array(z.string()).default([]),
  task: BacklogTaskSchema,
});
export type BacklogItem = z.infer<typeof BacklogItemSchema>;

export const BacklogSchema = z.object({
  version: z.literal(1),
  plan: z.string().min(1),
  planBaseSha: z.string().min(1),
  note: z.string().min(1),
  items: z.array(BacklogItemSchema).min(1),
});
export type Backlog = z.infer<typeof BacklogSchema>;

/**
 * Owner-measured evidence about another repository, kept as RUNTIME state under the common dir.
 *
 * `measuredBy` is literally `owner`: the only way a backend prerequisite becomes met is a human
 * measurement recorded outside any model turn. There is deliberately no code path in this
 * repository that writes this file, so no Factory run can satisfy its own backend prerequisite.
 */
export const ExternalMeasurementSchema = z.object({
  repository: z.string().min(1),
  ref: z.string().min(1).nullable().default(null),
  path: z.string().min(1).nullable().default(null),
  slice: z.string().min(1).nullable().default(null),
  sha: z.string().regex(/^[0-9a-f]{40}$/),
  measuredBy: z.literal('owner'),
  measuredAt: z.string().min(1),
  note: z.string().nullable().default(null),
});
export type ExternalMeasurement = z.infer<typeof ExternalMeasurementSchema>;

/** The identity a measurement claims. Compared by exact string equality with `prerequisiteKey`. */
export function measurementKey(measurement: ExternalMeasurement): string {
  if (measurement.slice) return `${measurement.repository}#slice:${measurement.slice}`;
  if (measurement.path) return `${measurement.repository}#${measurement.ref ?? ''}#${measurement.path}`;
  return `${measurement.repository}#${measurement.ref ?? ''}`;
}

export const ExternalEvidenceSchema = z.object({
  version: z.literal(1),
  measurements: z.array(ExternalMeasurementSchema).default([]),
});
export type ExternalEvidence = z.infer<typeof ExternalEvidenceSchema>;

export function externalEvidencePath(repo: string): string {
  return path.join(commonGitDir(repo), 'claude-factory', 'backend-prerequisites.json');
}

export function loadExternalEvidence(repo: string): ExternalMeasurement[] {
  const file = externalEvidencePath(repo);
  if (!fs.existsSync(file)) return [];
  return ExternalEvidenceSchema.parse(readJson(file)).measurements;
}

export function loadBacklog(repoOrFile: string): Backlog {
  const file = repoOrFile.endsWith('.json') ? repoOrFile : path.join(repoOrFile, CANONICAL_BACKLOG_FILE);
  return validateBacklog(BacklogSchema.parse(readJson(file)));
}

/** Structural integrity: unique ids/orders, resolvable dependencies, no cycles, honest fixtures. */
export function validateBacklog(backlog: Backlog): Backlog {
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (const item of backlog.items) {
    if (ids.has(item.id)) throw new Error(`duplicate backlog id ${item.id}`);
    if (orders.has(item.order)) throw new Error(`duplicate backlog order ${item.order} at ${item.id}`);
    ids.add(item.id); orders.add(item.order);
  }
  for (const item of backlog.items) {
    for (const dep of item.dependsOn) {
      if (!ids.has(dep)) throw new Error(`backlog item ${item.id} depends on unknown id ${dep}`);
      if (dep === item.id) throw new Error(`backlog item ${item.id} depends on itself`);
    }
    if (item.fixtureOnly && !item.liveCounterpart) {
      throw new Error(`fixture-only backlog item ${item.id} must name its liveCounterpart so it is never read as live-complete`);
    }
    if (item.fixtureOnly && item.prerequisites.some((p) => isExternalPrerequisite(p))) {
      throw new Error(`fixture-only backlog item ${item.id} must not carry external backend prerequisites`);
    }
    if (item.declaredStatus === 'DONE' && item.completionEvidence.length === 0) {
      throw new Error(`backlog item ${item.id} claims DONE without completionEvidence`);
    }
    if (item.liveCounterpart && !ids.has(item.liveCounterpart)) {
      throw new Error(`backlog item ${item.id} names unknown liveCounterpart ${item.liveCounterpart}`);
    }
    assertMaterializesToTask(item);
  }
  detectCycles(backlog);
  return backlog;
}

function detectCycles(backlog: Backlog): void {
  const byId = new Map(backlog.items.map((i) => [i.id, i]));
  const state = new Map<string, 'open' | 'closed'>();
  const walk = (id: string, trail: string[]): void => {
    if (state.get(id) === 'closed') return;
    if (state.get(id) === 'open') throw new Error(`backlog dependency cycle: ${[...trail, id].join(' -> ')}`);
    state.set(id, 'open');
    for (const dep of byId.get(id)?.dependsOn ?? []) walk(dep, [...trail, id]);
    state.set(id, 'closed');
  };
  for (const item of backlog.items) walk(item.id, []);
}

export type ItemStatus = 'DONE' | 'READY' | 'WAITING' | 'BLOCKED';

export type PrerequisiteEvaluation = {
  prerequisite: Prerequisite;
  evaluated: boolean;
  met: boolean;
  reason: string;
};

export type ItemEvaluation = {
  id: string;
  order: number;
  status: ItemStatus;
  reasons: string[];
  unmetDependencies: string[];
  prerequisites: PrerequisiteEvaluation[];
  item: BacklogItem;
};

export type EvaluationContext = {
  /** Repository-relative existence check. Injected so evaluation is testable without a checkout. */
  fileExists: (relativePath: string) => boolean;
  /** Runs a mechanical local prerequisite command; `null` disables local_test evaluation. */
  runCommand: ((command: string[]) => boolean) | null;
  externalEvidence: readonly ExternalMeasurement[];
  /** Task ids the runtime ledger records as completed. */
  ledgerCompleted: ReadonlySet<string>;
  /** Task ids the runtime ledger currently occupies (running/awaiting/blocked/done). */
  ledgerOccupied: ReadonlySet<string>;
  ownerAuthorSelection: AuthoritySelection;
};

export function isExternalPrerequisite(prerequisite: Prerequisite): boolean {
  return prerequisite.kind === 'external_ref' || prerequisite.kind === 'external_file' || prerequisite.kind === 'external_slice';
}

export function evaluatePrerequisite(prerequisite: Prerequisite, ctx: EvaluationContext): PrerequisiteEvaluation {
  if (prerequisite.kind === 'local_file') {
    const met = ctx.fileExists(prerequisite.path);
    return { prerequisite, evaluated: true, met, reason: met ? `file present: ${prerequisite.path}` : `file missing: ${prerequisite.path}` };
  }
  if (prerequisite.kind === 'local_test') {
    if (!ctx.runCommand) {
      return { prerequisite, evaluated: false, met: false, reason: `local test not executed in this evaluation: ${prerequisite.command.join(' ')}` };
    }
    const met = ctx.runCommand(prerequisite.command);
    return { prerequisite, evaluated: true, met, reason: `${prerequisite.command.join(' ')} ${met ? 'passed' : 'failed'}` };
  }
  // External prerequisites are satisfied ONLY by an exact owner measurement. Absence is unmet:
  // this repository is not the authority for `Nortropic/nortropic-system` and never infers a
  // backend slice from prose, from a plan sentence or from a model's belief.
  const key = prerequisiteKey(prerequisite);
  const found = ctx.externalEvidence.find((m) => measurementKey(m) === key);
  if (!found) {
    return {
      prerequisite,
      evaluated: true,
      met: false,
      reason: `no owner-measured evidence for ${key}; Verkstadsgolvet cannot measure that repository and never infers it${prerequisite.note ? ` (${prerequisite.note})` : ''}`,
    };
  }
  return { prerequisite, evaluated: true, met: true, reason: `owner-measured ${key} = ${found.sha}` };
}

/** Cheap, deterministic prerequisites first; a local test only runs when nothing cheaper failed. */
function prerequisiteCost(prerequisite: Prerequisite): number {
  if (prerequisite.kind === 'local_file') return 0;
  if (isExternalPrerequisite(prerequisite)) return 1;
  return 2;
}

/**
 * Evaluates the whole backlog in one deterministic pass.
 *
 * Ordering is `order` then `id`; nothing depends on directory order, wall-clock time or randomness,
 * so two processes — or the same process before and after a restart — always see the same list.
 */
export function evaluateBacklog(backlog: Backlog, ctx: EvaluationContext): ItemEvaluation[] {
  const items = [...backlog.items].sort((a, b) => (a.order - b.order) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const completed = new Set<string>(ctx.ledgerCompleted);
  const evaluations: ItemEvaluation[] = [];

  // Pass 1: tracked DONE claims, believed only when their evidence files exist AND every slice they
  // depend on is itself complete. Run to a fixpoint so the order of the file never decides the
  // answer. A completion built on an unproven slice is not a completion.
  for (let changed = true; changed;) {
    changed = false;
    for (const item of items) {
      if (item.declaredStatus !== 'DONE' || completed.has(item.id)) continue;
      if (item.completionEvidence.some((p) => !ctx.fileExists(p))) continue;
      if (item.dependsOn.some((dep) => !completed.has(dep))) continue;
      completed.add(item.id);
      changed = true;
    }
  }

  for (const item of items) {
    const reasons: string[] = [];
    if (item.declaredStatus === 'DONE') {
      const missing = item.completionEvidence.filter((p) => !ctx.fileExists(p));
      if (missing.length) {
        evaluations.push({ id: item.id, order: item.order, status: 'BLOCKED', reasons: [`declared DONE but completion evidence is missing: ${missing.join(', ')}`], unmetDependencies: [], prerequisites: [], item });
        continue;
      }
      const unprovenDependencies = item.dependsOn.filter((dep) => !completed.has(dep));
      if (unprovenDependencies.length) {
        evaluations.push({ id: item.id, order: item.order, status: 'BLOCKED', reasons: [`declared DONE but depends on slices that are not complete: ${unprovenDependencies.join(', ')}`], unmetDependencies: unprovenDependencies, prerequisites: [], item });
        continue;
      }
      evaluations.push({ id: item.id, order: item.order, status: 'DONE', reasons: [item.fixtureOnly ? `complete against fixtures only; live counterpart ${item.liveCounterpart} remains separate` : 'complete'], unmetDependencies: [], prerequisites: [], item });
      continue;
    }

    const ledgerEntryStatus = ctx.ledgerOccupied.has(item.id);
    const unmetDependencies = item.dependsOn.filter((dep) => !completed.has(dep));
    const prerequisites: PrerequisiteEvaluation[] = [];
    let blockedEarly = false;

    if (ctx.ledgerCompleted.has(item.id)) {
      evaluations.push({ id: item.id, order: item.order, status: 'DONE', reasons: ['recorded complete in the autopilot ledger'], unmetDependencies: [], prerequisites: [], item });
      continue;
    }
    if (ledgerEntryStatus) {
      reasons.push('the autopilot ledger already holds an entry for this task; operator action is required before it is scheduled again');
      blockedEarly = true;
    }
    if (unmetDependencies.length) {
      reasons.push(`unmet dependencies: ${unmetDependencies.join(', ')}`);
      blockedEarly = true;
    }
    if (item.authorityClass === 'owner-author' && !isSupervisorSelected(item.id, ctx.ownerAuthorSelection)) {
      reasons.push('declares the owner-author lane, which requires an explicit supervisor selection; never scheduled from repository data alone');
      blockedEarly = true;
    }

    if (!blockedEarly) {
      const ordered = [...item.prerequisites].sort((a, b) => prerequisiteCost(a) - prerequisiteCost(b));
      let stop = false;
      for (const prerequisite of ordered) {
        if (stop) {
          prerequisites.push({ prerequisite, evaluated: false, met: false, reason: 'not evaluated: an earlier prerequisite is unmet' });
          continue;
        }
        const evaluation = evaluatePrerequisite(prerequisite, ctx);
        prerequisites.push(evaluation);
        if (!evaluation.met) { stop = true; reasons.push(evaluation.reason); }
      }
      if (!stop) {
        evaluations.push({ id: item.id, order: item.order, status: 'READY', reasons: item.fixtureOnly ? [`ready as a FIXTURE-ONLY slice; ${item.liveCounterpart} stays blocked on its live backend prerequisites`] : ['dependencies and prerequisites met'], unmetDependencies: [], prerequisites, item });
        continue;
      }
    }

    evaluations.push({ id: item.id, order: item.order, status: 'WAITING', reasons, unmetDependencies, prerequisites, item });
  }

  return evaluations;
}

/** The deterministic scheduling decision: the lowest-order READY item, or nothing. */
export function selectNextItem(evaluations: readonly ItemEvaluation[], skipIds: ReadonlySet<string> = new Set()): ItemEvaluation | null {
  return evaluations.find((e) => e.status === 'READY' && !skipIds.has(e.id)) ?? null;
}

export function readyItems(evaluations: readonly ItemEvaluation[]): ItemEvaluation[] {
  return evaluations.filter((e) => e.status === 'READY');
}

/** The exact TaskSchema input one backlog item produces. Pure: it reads data and writes nothing. */
function taskSpecInput(item: BacklogItem, args: { baseSha?: string | null; authorityClass: AuthorityClass }): Record<string, unknown> {
  return {
    id: item.id,
    title: item.title,
    description: `${item.summary}\n\n${item.task.description}\n\nPlan section: ${item.planSection}${item.fixtureOnly ? `\n\nFIXTURE-ONLY SLICE: satisfy the exit criteria against generated fixtures. Never describe this slice as live-complete; the live counterpart is ${item.liveCounterpart}.` : ''}`,
    ...(args.baseSha ? { baseSha: args.baseSha } : {}),
    allowedWrite: item.task.allowedWrite,
    deniedWrite: item.task.deniedWrite,
    gates: item.task.gates,
    visualReview: item.task.visualReview,
    // Carried through verbatim, so the preview the backlog declares is the preview the supervisor
    // starts. Absent for a non-visual slice, which never needs one.
    ...(item.task.visual ? { visual: item.task.visual } : {}),
    authorityClass: args.authorityClass,
  };
}

/**
 * Canonical PRE-RUN validation of one backlog item.
 *
 * Every tracked item must already materialize into a TaskSchema-valid task while the backlog is
 * being loaded — before any slice is selected, before a claim is taken, before a ledger entry is
 * written and long before a Claude session or a preview browser exists. A visual slice that carries
 * no preview configuration is a defect in repository DATA; discovering it inside `startRunFromTask`
 * would mean a claim and a `RUNNING` ledger entry already exist for a task that could never run.
 *
 * This tightens data validation only. It changes nothing about ordinary builder scope enforcement
 * and weakens no preview safety rule: the loopback-only barrier for credential-bearing previews is
 * the SAME `VisualConfigSchema` check, simply applied earlier as well.
 */
export function assertMaterializesToTask(item: BacklogItem): void {
  if (item.task.visualReview && !item.task.visual) {
    throw new Error(
      `backlog item ${item.id} sets visualReview=true but declares no task.visual preview configuration; `
        + 'a visual slice must be fully configured in the canonical backlog, never discovered after a run has been claimed and started',
    );
  }
  const parsed = TaskSchema.safeParse(taskSpecInput(item, { baseSha: null, authorityClass: item.authorityClass }));
  if (parsed.success) return;
  const issues = parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`).join('; ');
  throw new Error(`backlog item ${item.id} does not materialize into a valid task: ${issues}`);
}

/**
 * Materializes one backlog item into a validated TaskSpec.
 *
 * The effective authority class is passed in by the supervisor after resolution; the backlog's own
 * `authorityClass` is only echoed as a declaration so an escalation attempt stays visible.
 */
export function materializeTask(item: BacklogItem, args: { baseSha?: string | null; authorityClass: AuthorityClass }): TaskSpec {
  return TaskSchema.parse(taskSpecInput(item, args));
}

/** Production local-test runner for prerequisites: mechanical, bounded, never a model claim. */
export function commandPrerequisiteRunner(cwd: string): (command: string[]) => boolean {
  return (command) => sh(command[0], command.slice(1), cwd, true).code === 0;
}
