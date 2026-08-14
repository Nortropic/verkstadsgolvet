import { z } from 'zod';

export const FindingSchema = z.object({
  id: z.string().min(1),
  severity: z.enum(['blocker', 'major', 'minor', 'note']),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  message: z.string().min(1),
  fix: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const RoleResultSchema = z.object({
  outcome: z.enum(['READY', 'NEEDS_REMEDIATION', 'BLOCKED']),
  summary: z.string(),
  findings: z.array(FindingSchema),
  tests: z.array(z.string()),
  changed_files: z.array(z.string()),
  next_action: z.enum(['BUILD', 'REVIEW', 'VISUAL_REVIEW', 'REMEDIATE', 'PUBLISH', 'DONE', 'BLOCKED']),
});
export type RoleResult = z.infer<typeof RoleResultSchema>;

/**
 * Loopback-only policy for credential-bearing preview targets.
 *
 * An authenticated visual review types the real runtime AUTH_USERNAME/AUTH_PASSWORD values into
 * the preview origin, so that origin must be the operator's own machine and never a
 * task-controlled remote host. The decision is made purely on the WHATWG-normalized protocol and
 * hostname of the parsed URL, by exact set membership: never substring/prefix/suffix matching,
 * never a lookalike-admitting regex, never DNS resolution, never a network call.
 *
 * Only credential-bearing previews are restricted; anonymous remote visual review is untouched.
 */
const CREDENTIAL_BEARING_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);
const LOOPBACK_HOSTNAMES: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

function parseUrlOrNull(value: string | URL): URL | null {
  if (value instanceof URL) return value;
  try { return new URL(value); } catch { return null; }
}

/** True only for http/https on the exact normalized loopback hosts. Unparsable input fails closed. */
export function isLoopbackPreviewTarget(value: string | URL): boolean {
  const url = parseUrlOrNull(value);
  if (!url) return false;
  return CREDENTIAL_BEARING_PROTOCOLS.has(url.protocol) && LOOPBACK_HOSTNAMES.has(url.hostname);
}

/**
 * Renders `protocol//host[:port]` for security errors. `host` never contains URL userinfo, so a
 * credential embedded in the target cannot be echoed back into a message or log line.
 */
export function describePreviewOrigin(value: string | URL): string {
  const url = parseUrlOrNull(value);
  return url ? `${url.protocol}//${url.host}` : 'an unparsable preview URL';
}

/**
 * An optional additional capture situation: the same preview, shot again after a declared,
 * selector-only page manipulation and/or at a declared URL.
 *
 * Existence is opt-in. A task without `captureStates` keeps exactly today's capture behavior, so
 * every already-written task JSON keeps validating and producing the same evidence set.
 *
 * DELIBERATE EXECUTION LIMIT: `focusSelector` and `scrollToSelector` are CSS SELECTORS handed to the
 * standard Playwright selector APIs, and `openDisclosures` toggles a fixed `details` query written
 * in `visual-review.ts`. No field here is ever evaluated as JavaScript in the page: a task can name
 * WHICH element to open, focus or scroll to, never WHAT code runs in the preview.
 */
export const VisualCaptureStateSchema = z.object({
  /**
   * Evidence filename segment. The alphabet is deliberately filename-safe and cannot start with a
   * dot, so a task-declared name can never contain `/`, `\` or `..` and can never steer a
   * screenshot out of the run's evidence directory.
   */
  name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  /** Defaults to `previewUrl` when absent. Carries the identical loopback policy when authenticated. */
  url: z.string().url().optional(),
  openDisclosures: z.boolean().optional(),
  focusSelector: z.string().min(1).optional(),
  scrollToSelector: z.string().min(1).optional(),
});
export type VisualCaptureState = z.infer<typeof VisualCaptureStateSchema>;

export const VisualConfigSchema = z.object({
  previewCommand: z.array(z.string().min(1)).min(1),
  previewUrl: z.string().url(),
  readyTimeoutMs: z.number().int().positive().default(60000),
  // Opt-in only. Anonymous visual review remains the default and never requires credentials.
  authenticated: z.boolean().default(false),
  viewports: z.array(z.object({ name: z.string(), width: z.number().int().positive(), height: z.number().int().positive() })).default([
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'tablet', width: 900, height: 1000 },
    { name: 'mobile', width: 390, height: 844 },
  ]),
  // Additive and optional on purpose: absent stays absent after a parse, so a legacy task's
  // persisted run state round-trips unchanged.
  captureStates: z.array(VisualCaptureStateSchema).optional(),
}).superRefine((visual, ctx) => {
  // Schema barrier: a task may not even declare a credential-bearing preview against a remote
  // origin. Anonymous previews (authenticated=false, the default) keep accepting any URL.
  if (visual.authenticated !== true) return;
  if (!isLoopbackPreviewTarget(visual.previewUrl)) {
    ctx.addIssue({
      code: 'custom',
      path: ['previewUrl'],
      message: `authenticated visual review is restricted to loopback preview origins (http/https on localhost, 127.0.0.1 or [::1]); ${describePreviewOrigin(visual.previewUrl)} is not loopback`,
    });
  }
  // Every navigated URL carries the same policy as `previewUrl`. A capture state is another
  // credential-bearing navigation, so a remote `state.url` is refused at the same barrier instead of
  // becoming a second, weaker way to point the logged-in browser at a task-controlled host.
  (visual.captureStates ?? []).forEach((state, index) => {
    if (state.url === undefined || isLoopbackPreviewTarget(state.url)) return;
    ctx.addIssue({
      code: 'custom',
      path: ['captureStates', index, 'url'],
      message: `authenticated visual review is restricted to loopback preview origins (http/https on localhost, 127.0.0.1 or [::1]); ${describePreviewOrigin(state.url)} is not loopback`,
    });
  });
}).optional();

export const AuthorityClassSchema = z.enum(['ordinary', 'owner-author']);

export const TaskSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  baseSha: z.string().regex(/^[0-9a-f]{40}$/).optional(),
  allowedWrite: z.array(z.string()).min(1),
  deniedWrite: z.array(z.string()).default([]),
  gates: z.array(z.array(z.string().min(1)).min(1)).min(1),
  visualReview: z.boolean().default(false),
  visual: VisualConfigSchema,
  /**
   * DECLARED authority class. Task data, backlog data and model output can only ever declare it;
   * the effective class is resolved by `resolveAuthorityClass` against the supervisor's explicit
   * selection, and a `owner-author` declaration without that selection fails the run closed.
   */
  authorityClass: AuthorityClassSchema.default('ordinary'),
}).superRefine((task, ctx) => {
  // Completeness barrier for a visual slice. A task that ASKS for visual review but carries no
  // preview configuration cannot ever produce screenshots, so it is invalid task DATA — not a
  // condition to be discovered once a run, a worktree and a claim already exist. Making it a
  // schema failure means every parse site (task file, materialized backlog item, persisted run
  // state) refuses it at the same point, before any run starts.
  //
  // The reverse is deliberately NOT an error: `visualReview=false` never requires `visual`, and an
  // ordinary non-visual task keeps parsing exactly as before.
  if (task.visualReview !== true || task.visual) return;
  ctx.addIssue({
    code: 'custom',
    path: ['visual'],
    message: 'visualReview=true requires a task.visual preview configuration (at least previewCommand and previewUrl); a visual task must be fully configured before a run starts',
  });
});
export type TaskSpec = z.infer<typeof TaskSchema>;

export const ConfigSchema = z.object({
  version: z.literal(1),
  maxRemediationRounds: z.number().int().min(0).max(10).default(3),
  /**
   * Bounded budget for automatic builder self-resume segments after `error_max_turns`.
   *
   * This is a TOTAL-PER-RUN budget for continuing the SAME builder session across bounded
   * Claude segments. It is orthogonal to `maxRemediationRounds`: a continuation is the same
   * builder turn continuing, never a new remediation round. Legacy configs without the field
   * parse to the empirically chosen default of 6.
   */
  maxBuilderContinuationResumes: z.number().int().min(0).max(20).default(6),
  models: z.object({ architect: z.string(), builder: z.string(), reviewer: z.string(), visualReviewer: z.string() }),
  /**
   * Publication switches. Both gates default off in the shipped example configuration.
   *
   * `mergeMethod` accepts ONLY the normal GitHub merge commit. A configuration asking for
   * 'rebase' or 'squash' fails validation here instead of being silently downgraded to a
   * supported method: rebase/squash would publish a NEW commit rather than the exact commit an
   * independent reviewer read.
   */
  publish: z.object({ enabled: z.boolean(), autoMerge: z.boolean(), mergeMethod: z.enum(['merge']) }),
  /**
   * Autopilot scheduling. Disabled by default: an operator arms continuous backlog work explicitly.
   *
   * `maxTasks`          — hard bound on tasks started per invocation. There is no unbounded loop.
   * `claimTtlSeconds`   — how long a claim survives without a heartbeat before it is recoverable.
   * `continueAfterMerge`— continue to the next slice only after the previous candidate really is in
   *                       `origin/main` as a verified merge commit. Never a way to move main itself.
   */
  autopilot: z.object({
    enabled: z.boolean().default(false),
    maxTasks: z.number().int().min(1).max(20).default(1),
    claimTtlSeconds: z.number().int().min(30).max(86400).default(900),
    continueAfterMerge: z.boolean().default(true),
  }).default({ enabled: false, maxTasks: 1, claimTtlSeconds: 900, continueAfterMerge: true }),
  /**
   * Operator-local selection of owner-author tasks. This file, not repository or model data, is one
   * of the only two ways into the owner-author lane; the other is the explicit `--owner-author` CLI
   * flag. It is workflow authority only and never a Nortropic trust boundary.
   */
  ownerAuthor: z.object({
    selectedTaskIds: z.array(z.string().min(1)).default([]),
  }).default({ selectedTaskIds: [] }),
});
export type FactoryConfig = z.infer<typeof ConfigSchema>;

/**
 * The stage whose judgement a progress record captures.
 *
 * `owner-extension` is not a stage: it is the explicit marker an owner re-open appends, so the
 * append-only history itself records that a human, not a countdown, re-opened the run.
 */
export const ProgressSourceSchema = z.enum(['gates', 'reviewer', 'visual-reviewer', 'builder', 'owner-extension']);
export type ProgressSource = z.infer<typeof ProgressSourceSchema>;

export const ProgressRecordKindSchema = z.enum(['findings', 'clear', 'candidate', 'base', 'no-change-ready', 'owner-extension']);
export type ProgressRecordKind = z.infer<typeof ProgressRecordKindSchema>;

/**
 * One append-only observation the remediation circuit breaker reasons over.
 *
 * Records are evidence. They are never rewritten, never removed and never reordered, and a resume
 * loads and continues the SAME history — so a restart re-derives the identical verdict instead of
 * manufacturing fresh retry entitlement.
 */
export const ProgressRecordSchema = z.object({
  round: z.number().int().nonnegative(),
  source: ProgressSourceSchema,
  kind: ProgressRecordKindSchema,
  /** The candidate the stage judged, and its exact content identity. */
  candidateSha: z.string().nullable().default(null),
  candidateTree: z.string().nullable().default(null),
  /** Stable fingerprint of the actionable finding set (or gate failure set) produced. */
  fingerprint: z.string(),
  /** The exact repo-relative paths those findings named. */
  files: z.array(z.string()).default([]),
  /** Did the remediation leading into this stage change a file the finding set named? */
  relevantChange: z.boolean(),
  detail: z.string().nullable().default(null),
});
export type ProgressRecord = z.infer<typeof ProgressRecordSchema>;

export const RunStateSchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  task: TaskSchema,
  /**
   * EFFECTIVE authority class for this run, resolved once by the supervisor from its explicit
   * selection. It is persisted so a resume cannot re-derive a different lane from mutated task data.
   */
  authorityClass: AuthorityClassSchema.default('ordinary'),
  baseSha: z.string(),
  branch: z.string(),
  worktree: z.string(),
  phase: z.string(),
  attempt: z.number().int().nonnegative(),
  candidateSha: z.string().nullable(),
  sessions: z.object({ architect: z.string().nullable(), builder: z.string().nullable(), reviewer: z.string().nullable(), visualReviewer: z.string().nullable() }),
  ownerRemediationExtensionRounds: z.number().int().min(0).max(10).default(0),
  /**
   * Automatic builder continuation segments already consumed by this run, TOTAL PER RUN.
   *
   * Never reset on builder success and never reset between remediation rounds: it is the
   * persisted audit trail of how much bounded self-resume the run has spent. Legacy state
   * files without the field parse as 0.
   */
  builderContinuationResumesUsed: z.number().int().nonnegative().default(0),
  /**
   * APPEND-ONLY progress evidence, owned by the remediation circuit breaker.
   *
   * `.default([])` so every run state persisted before the breaker existed keeps parsing, and so a
   * legacy BLOCKED run stays loadable, extendable and resumable exactly as it was.
   */
  progressHistory: z.array(ProgressRecordSchema).default([]),
  findings: z.array(FindingSchema),
  advisoryFindings: z.array(FindingSchema).default([]),
  prUrl: z.string().nullable(),
  blockedReason: z.string().nullable(),
});
export type RunState = z.infer<typeof RunStateSchema>;

export const roleOutputJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    outcome: { type: 'string', enum: ['READY','NEEDS_REMEDIATION','BLOCKED'] },
    summary: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          id: { type: 'string' },
          severity: { type: 'string', enum: ['blocker','major','minor','note'] },
          file: { type: 'string' },
          line: { type: 'integer' },
          message: { type: 'string' },
          fix: { type: 'string' }
        },
        required: ['id','severity','message']
      }
    },
    tests: { type: 'array', items: { type: 'string' } },
    changed_files: { type: 'array', items: { type: 'string' } },
    next_action: { type: 'string', enum: ['BUILD','REVIEW','VISUAL_REVIEW','REMEDIATE','PUBLISH','DONE','BLOCKED'] }
  },
  required: ['outcome','summary','findings','tests','changed_files','next_action']
} as const;
