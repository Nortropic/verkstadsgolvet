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
}).superRefine((visual, ctx) => {
  // Schema barrier: a task may not even declare a credential-bearing preview against a remote
  // origin. Anonymous previews (authenticated=false, the default) keep accepting any URL.
  if (visual.authenticated !== true) return;
  if (isLoopbackPreviewTarget(visual.previewUrl)) return;
  ctx.addIssue({
    code: 'custom',
    path: ['previewUrl'],
    message: `authenticated visual review is restricted to loopback preview origins (http/https on localhost, 127.0.0.1 or [::1]); ${describePreviewOrigin(visual.previewUrl)} is not loopback`,
  });
}).optional();

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
});
export type FactoryConfig = z.infer<typeof ConfigSchema>;

export const RunStateSchema = z.object({
  version: z.literal(1),
  runId: z.string(),
  task: TaskSchema,
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
