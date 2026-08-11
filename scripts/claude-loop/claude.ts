import fs from 'node:fs';
import path from 'node:path';
import { query, type AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { sh } from './util';
import { roleOutputJsonSchema, RoleResultSchema, type RoleResult } from './schemas';

export type RoleName = 'architect' | 'builder' | 'reviewer' | 'visual-reviewer';

function roleBody(cwd: string, role: RoleName): string {
  const file = path.join(cwd, '.claude', 'agents', `${role}.md`);
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`invalid agent file: ${file}`);
  return m[1].trim();
}

const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput';

export function roleDefinition(cwd: string, role: RoleName, model?: string): AgentDefinition {
  const common = { description: `Claude Factory ${role}`, prompt: roleBody(cwd, role), model: model ?? 'opus', maxTurns: 48 };
  if (role === 'builder') return { ...common, tools: ['Read','Glob','Grep','Edit','Write','Bash',STRUCTURED_OUTPUT_TOOL], permissionMode: 'acceptEdits' };
  if (role === 'visual-reviewer') return { ...common, tools: ['Read','Glob','Grep',STRUCTURED_OUTPUT_TOOL], permissionMode: 'plan' };
  return { ...common, tools: ['Read','Glob','Grep','Bash',STRUCTURED_OUTPUT_TOOL], permissionMode: 'plan' };
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
  const options: Record<string, unknown> = {
    cwd: args.cwd,
    agent: args.role,
    agents: { [args.role]: roleDefinition(args.cwd, args.role, args.model) },
    settingSources: ['project'],
    permissionMode: args.role === 'builder' ? 'acceptEdits' : 'plan',
    outputFormat: { type: 'json_schema', schema: roleOutputJsonSchema },
    maxTurns: args.maxTurns ?? 48,
    persistSession: true,
  };
  if (args.resume) options.resume = args.resume;
  const explicitClaude = process.env.CLAUDE_FACTORY_CLAUDE_PATH;
  const discovered = explicitClaude ? { code: 0, out: explicitClaude } : sh('/usr/bin/env', ['which', 'claude'], args.cwd, true);
  if (discovered.code === 0 && discovered.out.trim()) options.pathToClaudeCodeExecutable = discovered.out.trim();

  for await (const msg of query({ prompt: args.prompt, options: options as never })) {
    const m = msg as any;
    if (m.type === 'system' && m.subtype === 'init') sessionId = m.session_id || m.data?.session_id || sessionId;
    if (m.type === 'result') {
      subtype = String(m.subtype || '');
      if (m.subtype === 'success') {
        structured = m.structured_output;
        if (structured === undefined || structured === null) {
          const raw = String(m.result || '').replace(/\s+/g, ' ').slice(0, 800);
          throw new Error(`Claude role ${args.role} returned success without structured_output; raw_result=${raw}`);
        }
      } else throw new Error(`Claude role ${args.role} failed subtype=${m.subtype}: ${String(m.result || '')}`);
    }
  }
  if (!sessionId) throw new Error(`Claude role ${args.role} did not provide session_id`);
  return { sessionId, result: RoleResultSchema.parse(structured), rawSubtype: subtype };
}
