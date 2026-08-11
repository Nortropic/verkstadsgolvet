import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import type { TaskSpec } from './schemas';

async function waitFor(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const r = await fetch(url); if (r.ok || r.status < 500) return; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview did not become ready: ${url}`);
}

export async function captureVisualEvidence(task: TaskSpec, cwd: string, outDir: string): Promise<{ files: string[]; stop: () => void }> {
  if (!task.visualReview || !task.visual) throw new Error('visual review requested but task.visual is missing');
  fs.mkdirSync(outDir, { recursive: true });
  const [command, ...args] = task.visual.previewCommand;
  const child: ChildProcess = spawn(command, args, { cwd, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const stop = () => {
    if (!child.pid) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, 2000).unref();
  };
  try {
    await waitFor(task.visual.previewUrl, task.visual.readyTimeoutMs);
    const browser = await chromium.launch({ headless: true });
    const files: string[] = [];
    try {
      for (const vp of task.visual.viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        await page.goto(task.visual.previewUrl, { waitUntil: 'networkidle' });
        const file = path.join(outDir, `${vp.name}-${vp.width}x${vp.height}.png`);
        await page.screenshot({ path: file, fullPage: true });
        files.push(file);
        await page.close();
      }
    } finally { await browser.close(); }
    return { files, stop };
  } catch (e) { stop(); throw e; }
}

export async function captureSmokeScreenshot(outDir: string): Promise<string> {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
    await page.setContent('<main style="font-family:system-ui;padding:48px"><h1>Claude Factory visual smoke</h1><p>Truthful state: <strong>—</strong></p></main>');
    const file = path.join(outDir, 'visual-smoke.png');
    await page.screenshot({ path: file, fullPage: true });
    return file;
  } finally { await browser.close(); }
}
