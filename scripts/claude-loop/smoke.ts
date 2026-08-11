import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, ensureDir } from './util';
import { runRole } from './claude';
import { captureSmokeScreenshot } from './visual-review';

export async function liveSmoke(): Promise<void> {
  const repo = repoRoot();
  const root = path.join(repo, '.claude-loop', 'live-smoke');
  ensureDir(root);
  const a = await runRole({ role: 'architect', cwd: repo, maxTurns: 2, prompt: 'Read CLAUDE.md and return READY with a one-sentence summary of your authority boundary. Do not edit anything.' });
  if (a.result.outcome !== 'READY') throw new Error(`architect smoke not READY: ${a.result.summary}`);
  const screenshot = await captureSmokeScreenshot(root);
  const v = await runRole({ role: 'visual-reviewer', cwd: repo, maxTurns: 3, prompt: `Read and inspect this screenshot: ${screenshot}. Return READY if it is legible and truthfully displays an em dash as unavailable state. Do not edit.` });
  if (v.result.outcome !== 'READY') throw new Error(`visual smoke not READY: ${v.result.summary}`);
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify({ architect_session: a.sessionId, visual_session: v.sessionId, screenshot }, null, 2));
  console.log('CLAUDE_FACTORY_LIVE_SMOKE=PASS');
  console.log(`ARCHITECT_SESSION=${a.sessionId}`);
  console.log(`VISUAL_SESSION=${v.sessionId}`);
}
