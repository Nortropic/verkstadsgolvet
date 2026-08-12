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
  models: z.object({ architect: z.string(), builder: z.string(), reviewer: z.string(), visualReviewer: z.string() }),
  publish: z.object({ enabled: z.boolean(), autoMerge: z.boolean(), mergeMethod: z.enum(['rebase']) }),
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
