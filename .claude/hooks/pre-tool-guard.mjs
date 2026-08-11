import fs from 'node:fs';
import path from 'node:path';

const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
const tool = input.tool_name || '';
const payload = input.tool_input || {};
const block = (reason) => { process.stderr.write(`CLAUDE_FACTORY_GUARD_BLOCK: ${reason}\n`); process.exit(2); };

if (tool === 'Bash') {
  const cmd = String(payload.command || '');
  const forbidden = [
    /(^|[;&|\n]\s*)sudo\b/i,
    /\bgit\s+push\b/i,
    /\bgit\s+reset\b/i,
    /\bgit\s+rebase\b/i,
    /\bgit\s+clean\b/i,
    /\bgit\s+commit\b[^\n]*--amend\b/i,
    /\bgit\b[^\n]*(--force-with-lease|--force|-f\b)/i,
    /\bgh\s+(pr\s+merge|api|repo|release|workflow)\b/i,
    /\b(rm\s+-rf|rm\s+-fr)\s+(\/|~|\$HOME)\b/i,
    /\b(vercel|railway|supabase)\b/i,
    /\bnpm\s+publish\b/i,
    /\b(curl|wget|scp|ssh)\b/i,
  ];
  if (forbidden.some((r) => r.test(cmd))) block(`forbidden Bash command: ${cmd.slice(0, 240)}`);
}

if (tool === 'Edit' || tool === 'Write') {
  const cwd = path.resolve(String(input.cwd || process.cwd()));
  const raw = String(payload.file_path || payload.filePath || '');
  if (!raw) block('write tool missing file path');
  const absolute = path.resolve(cwd, raw);
  const rel = path.relative(cwd, absolute).replaceAll('\\\\', '/');
  if (rel === '..' || rel.startsWith('../') || path.isAbsolute(rel)) block(`write outside assigned cwd: ${raw}`);
  const protectedPaths = new Set([
    'CLAUDE.md',
    'docs/claude-operating-model-v1.md',
    'docs/nortropic-control-room-plan-v1.md',
    'docs/nortropic-control-room-codex-handoff.md',
  ]);
  if (rel === '.claude' || rel.startsWith('.claude/') || protectedPaths.has(rel)) block(`protected workflow/authority path: ${rel}`);
  if (/(^|\/)\.env(?:\.|$)/.test(rel)) block(`secret path: ${rel}`);
}
process.exit(0);
