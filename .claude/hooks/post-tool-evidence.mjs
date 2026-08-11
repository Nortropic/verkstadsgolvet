import fs from 'node:fs';
import path from 'node:path';

let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { process.exit(0); }
try {
  const cwd = input.cwd || process.cwd();
  const out = path.join(cwd, '.claude-loop', 'hook-events.jsonl');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const row = {
    ts: new Date().toISOString(),
    event: input.hook_event_name || 'unknown',
    tool: input.tool_name || null,
    agent_type: input.agent_type || null,
    session_id: input.session_id || null,
  };
  fs.appendFileSync(out, JSON.stringify(row) + '\n', { encoding: 'utf8', mode: 0o600 });
} catch {}
process.exit(0);
