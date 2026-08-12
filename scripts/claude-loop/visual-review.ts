import fs from 'node:fs';
import path from 'node:path';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import type { TaskSpec } from './schemas';

const LOGIN_PATH = '/login';
const LOGIN_TIMEOUT_MS = 30_000;

/** Minimal structural contract of the browser page used by the authenticated preview flow. */
export interface PreviewAuthPage {
  goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }): Promise<unknown>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string): Promise<void>;
  waitForURL(url: (url: URL) => boolean, options?: { timeout?: number }): Promise<void>;
  url(): string;
}

function isLoginLocation(url: URL): boolean {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  return pathname === LOGIN_PATH;
}

/** Reads a required runtime credential. The value is never included in errors or logs. */
function requiredCredential(name: 'AUTH_USERNAME' | 'AUTH_PASSWORD'): string {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`authenticated visual review requires ${name} to be set in the runtime environment`);
  }
  return value;
}

/**
 * Signs the preview page in through the real same-origin Credentials form and leaves the page
 * on the exact requested preview target. No cookie fabrication and no auth bypass.
 */
export async function authenticatePreviewPage(page: PreviewAuthPage, previewUrl: string): Promise<void> {
  const target = new URL(previewUrl);
  const loginUrl = new URL(LOGIN_PATH, target.origin).href;
  // Fail closed before any navigation when a runtime credential is absent or empty.
  const username = requiredCredential('AUTH_USERNAME');
  const password = requiredCredential('AUTH_PASSWORD');

  await page.goto(loginUrl, { waitUntil: 'networkidle' });
  await page.fill('#username', username);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  // Success is proven by navigating away from the login route; staying there is a failure.
  await page.waitForURL((url) => !isLoginLocation(url), { timeout: LOGIN_TIMEOUT_MS });
  if (isLoginLocation(new URL(page.url()))) {
    throw new Error(`authenticated visual review failed: preview stayed on ${LOGIN_PATH} after submitting the credentials form`);
  }
  // Evidence must show the requested protected target, not a default post-login landing page.
  await page.goto(previewUrl, { waitUntil: 'networkidle' });
  if (isLoginLocation(new URL(page.url()))) {
    throw new Error(`authenticated visual review failed: ${LOGIN_PATH} was served instead of the requested preview target`);
  }
}

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
        if (task.visual.authenticated === true) {
          // Per-page (per-context) login: no shared global auth state across viewports.
          await authenticatePreviewPage(page, task.visual.previewUrl);
        } else {
          await page.goto(task.visual.previewUrl, { waitUntil: 'networkidle' });
        }
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
