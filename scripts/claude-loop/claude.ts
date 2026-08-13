import fs from 'node:fs';
import path from 'node:path';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { sh } from './util';
import { roleOutputJsonSchema, RoleResultSchema, type RoleResult } from './schemas';
import { laneQueryOptions, ownerAuthorSystemPrompt, type Lane } from './lanes';

/**
 * `owner-author` is the write role of the owner-authority lane. It replaces `builder` for a
 * supervisor-selected owner-author task and is never available to an ordinary task.
 */
export type RoleName = 'architect' | 'builder' | 'reviewer' | 'visual-reviewer' | 'owner-author';

export const WRITE_ROLES: readonly RoleName[] = ['builder', 'owner-author'];

function roleBody(cwd: string, role: RoleName): string {
  // The owner-author lane deliberately does not read `.claude/agents/**`: it runs with
  // settingSources:[] under its own tracked, supervisor-owned system prompt.
  if (role === 'owner-author') return ownerAuthorSystemPrompt(cwd);
  const file = path.join(cwd, '.claude', 'agents', `${role}.md`);
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`invalid agent file: ${file}`);
  return m[1].trim();
}

const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput';

export class ClaudeRoleFailure extends Error {
  constructor(
    public readonly role: RoleName,
    public readonly subtype: string,
    public readonly sessionId: string | null,
    public readonly numTurns: number | null,
    result: string,
  ) {
    const compact = result.replace(/\s+/g, ' ').slice(0, 800);
    super(`Claude role ${role} failed subtype=${subtype} session_id=${sessionId ?? 'UNKNOWN'} num_turns=${numTurns ?? 'UNKNOWN'}: ${compact}`);
    this.name = 'ClaudeRoleFailure';
  }
}

export function roleDefinition(cwd: string, role: RoleName, model?: string): AgentDefinition {
  const common = { description: `Claude Factory ${role}`, prompt: roleBody(cwd, role), model: model ?? 'opus', maxTurns: 48 };
  if (role === 'builder' || role === 'owner-author') return { ...common, tools: ['Read','Glob','Grep','Edit','Write','Bash',STRUCTURED_OUTPUT_TOOL], permissionMode: 'acceptEdits' };
  if (role === 'visual-reviewer') return { ...common, tools: ['Read','Glob','Grep',STRUCTURED_OUTPUT_TOOL], permissionMode: 'plan' };
  return { ...common, tools: ['Read','Glob','Grep','Bash',STRUCTURED_OUTPUT_TOOL], permissionMode: 'plan' };
}

/** The lane a role runs in: `owner-author` is isolated, every other role keeps v1 behaviour. */
export function laneForRole(role: RoleName): Lane {
  return role === 'owner-author' ? 'owner-author' : 'ordinary';
}

export async function runRole(args: {
  role: RoleName;
  prompt: string;
  cwd: string;
  resume?: string | null;
  maxTurns?: number;
  model?: string;
}): Promise<{ sessionId: string; result: RoleResult; rawSubtype: string }> {
  let sessionId = args.resume ?? '';
  let structured: unknown = null;
  let subtype = '';
  const lane = laneQueryOptions({ lane: laneForRole(args.role), root: args.cwd });
  const options: Record<string, unknown> = {
    cwd: args.cwd,
    agent: args.role,
    agents: { [args.role]: roleDefinition(args.cwd, args.role, args.model) },
    // Ordinary roles load project settings; the owner-author lane loads NONE (settingSources: [])
    // and instead runs under its dedicated settings file and dedicated system prompt.
    settingSources: lane.settingSources,
    permissionMode: WRITE_ROLES.includes(args.role) ? 'acceptEdits' : 'plan',
    outputFormat: { type: 'json_schema', schema: roleOutputJsonSchema },
    maxTurns: args.maxTurns ?? 48,
    persistSession: true,
  };
  if (lane.settings) options.settings = lane.settings;
  if (lane.systemPrompt) options.systemPrompt = lane.systemPrompt;
  if (args.resume) options.resume = args.resume;
  const explicitClaude = process.env.CLAUDE_FACTORY_CLAUDE_PATH;
  const discovered = explicitClaude ? { code: 0, out: explicitClaude } : sh('/usr/bin/env', ['which', 'claude'], args.cwd, true);
  if (discovered.code === 0 && discovered.out.trim()) options.pathToClaudeCodeExecutable = discovered.out.trim();

  for await (const msg of query({ prompt: args.prompt, options: options as never })) {
    const m = msg as any;
    if (m.type === 'system' && m.subtype === 'init') sessionId = m.session_id || m.data?.session_id || sessionId;
    if (m.type === 'result') {
      subtype = String(m.subtype || '');
      const resultSession = typeof m.session_id === 'string' && m.session_id ? m.session_id : sessionId;
      if (resultSession) sessionId = resultSession;
      const numTurns = Number.isInteger(m.num_turns) ? Number(m.num_turns) : null;
      if (m.subtype === 'success') {
        structured = m.structured_output;
        if (structured === undefined || structured === null) {
          const raw = String(m.result || '').replace(/\s+/g, ' ').slice(0, 800);
          throw new Error(`Claude role ${args.role} returned success without structured_output; raw_result=${raw}`);
        }
      } else {
        throw new ClaudeRoleFailure(args.role, subtype, sessionId || null, numTurns, String(m.result || ''));
      }
    }
  }
  if (!sessionId) throw new Error(`Claude role ${args.role} did not provide session_id`);
  return { sessionId, result: RoleResultSchema.parse(structured), rawSubtype: subtype };
}
