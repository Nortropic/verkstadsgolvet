import fs from 'node:fs';
import path from 'node:path';
import { commonGitDir, ensureDir } from './util';

export class Telemetry {
  readonly root: string;
  readonly events: string;
  constructor(repo: string, public runId: string) {
    this.root = path.join(commonGitDir(repo), 'claude-factory', 'runs', runId);
    ensureDir(this.root);
    this.events = path.join(this.root, 'events.jsonl');
  }
  emit(event: string, fields: Record<string, unknown> = {}): void {
    const row = { ts: new Date().toISOString(), event, run_id: this.runId, ...fields };
    fs.appendFileSync(this.events, JSON.stringify(row) + '\n', { encoding: 'utf8', mode: 0o600 });
    const render=(v: unknown) => typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v);
    process.stdout.write(`CLAUDE_FACTORY ${event}: ${Object.entries(fields).map(([k,v]) => `${k}=${render(v)}`).join(' ')}\n`);
  }
}
