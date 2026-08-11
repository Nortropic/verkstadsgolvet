#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { doctor } from './doctor';
import { liveSmoke } from './smoke';
import { empiricalSmoke } from './empirical-smoke';
import { startRun, resumeRun } from './supervisor';
import { repoRoot, commonGitDir } from './util';

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'doctor') return doctor();
  if (cmd === 'selftest') { doctor(); console.log('CLAUDE_FACTORY_SELFTEST=PASS'); return; }
  if (cmd === 'live-smoke') return await liveSmoke();
  if (cmd === 'empirical-smoke') return await empiricalSmoke();
  if (cmd === 'run') {
    const i = args.indexOf('--task'); if (i < 0 || !args[i+1]) throw new Error('run requires --task <file>');
    const s = await startRun(args[i+1]); console.log(JSON.stringify(s, null, 2)); return;
  }
  if (cmd === 'resume') {
    const id = args[0]; if (!id) throw new Error('resume requires run-id');
    const s = await resumeRun(id); console.log(JSON.stringify(s, null, 2)); return;
  }
  if (cmd === 'status') {
    const repo = repoRoot(); const root = path.join(commonGitDir(repo), 'claude-factory', 'runs');
    if (!fs.existsSync(root)) { console.log('NO_RUNS'); return; }
    for (const d of fs.readdirSync(root).sort()) {
      const p = path.join(root,d,'state.json'); if (!fs.existsSync(p)) continue;
      const s = JSON.parse(fs.readFileSync(p,'utf8')); console.log(`${s.runId}\t${s.task?.id}\t${s.phase}\t${s.candidateSha ?? '-'}`);
    } return;
  }
  if (cmd === 'watch') {
    const repo = repoRoot(); const root = path.join(commonGitDir(repo), 'claude-factory', 'runs');
    console.log(`Watch ${root}; Ctrl-C to stop.`);
    let last=''; setInterval(() => { if (!fs.existsSync(root)) return; const rows:string[]=[]; for (const d of fs.readdirSync(root).sort()) { const p=path.join(root,d,'state.json'); if(fs.existsSync(p)){const s=JSON.parse(fs.readFileSync(p,'utf8')); rows.push(`${s.runId}\t${s.task?.id}\t${s.phase}\t${s.candidateSha ?? '-'}`);}} const v=rows.join('\n'); if(v!==last){console.clear();console.log(v||'NO_RUNS');last=v;} }, 1500); return;
  }
  throw new Error('usage: cli.ts doctor|selftest|live-smoke|empirical-smoke|status|watch|run --task <file>|resume <run-id>');
}

main().catch((e) => { console.error(`CLAUDE_FACTORY_BLOCKED: ${e instanceof Error ? e.stack || e.message : String(e)}`); process.exitCode = 2; });
