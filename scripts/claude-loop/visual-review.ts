import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { chromium } from 'playwright';
import { describePreviewOrigin, isLoopbackPreviewTarget, type TaskSpec, type VisualCaptureState } from './schemas';

const LOGIN_PATH = '/login';
const LOGIN_TIMEOUT_MS = 30_000;

/**
 * Explicit allowlist of non-secret execution-context variables that may cross from the supervisor
 * into the preview child. The preview command is candidate/task-controlled code from the task
 * worktree, so the child environment is built by enumeration: anything not named here is denied by
 * default, including supervisor variables this file has never heard of. This is deliberately not a
 * secret blacklist — a new supervisor secret is denied without any change to this list.
 *
 * Only process-execution basics are listed. `PATH` (plus the Windows `PATHEXT`/`SystemRoot`/
 * `ComSpec` equivalents) keeps ordinary preview commands resolvable; `HOME` and the temp-directory
 * names keep toolchains that need a writable scratch/config location working; the locale, `TERM`
 * and `TZ` entries keep output formatting stable; `NODE_ENV` and `CI` are ordinary non-secret build
 * mode switches. No credential, token, API key or connection string belongs in this list.
 */
const PREVIEW_EXECUTION_ENV_ALLOWLIST = [
  'PATH',
  'PATHEXT',
  'SystemRoot',
  'ComSpec',
  'HOME',
  'TMPDIR',
  'TMP',
  'TEMP',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'TZ',
  'NODE_ENV',
  'CI',
] as const;

/**
 * A freshly constructed preview child environment. Deliberately a plain string record rather than
 * `NodeJS.ProcessEnv`, so it can never be satisfied by handing back `process.env` itself.
 */
export type PreviewChildEnv = Record<string, string>;

/** A disposable, preview-only credential bundle. Never the supervisor's own credentials. */
export interface PreviewCredentials {
  username: string;
  password: string;
  authSecret: string;
}

/**
 * Mints a fresh preview-only credential bundle from cryptographically secure randomness. No
 * constants, no shared module-global bundle: every call returns unrelated high-entropy values, so a
 * bundle handed to one preview child is worthless anywhere else.
 */
function createPreviewCredentials(): PreviewCredentials {
  return {
    username: `preview-${randomBytes(12).toString('base64url')}`,
    password: randomBytes(32).toString('base64url'),
    authSecret: randomBytes(32).toString('base64url'),
  };
}

/**
 * Builds the environment for the preview child process. Pure: it reads the supplied supervisor
 * environment, never mutates it, never returns or spreads it, and never copies a name outside the
 * execution allowlist.
 *
 * Auth variables are injected only from an explicit disposable bundle. Without a bundle (anonymous
 * preview) the child receives no AUTH_* values at all, even when the supervisor has them.
 */
export function buildPreviewChildEnv(
  supervisorEnv: NodeJS.ProcessEnv,
  previewCredentials?: PreviewCredentials,
): PreviewChildEnv {
  const childEnv: PreviewChildEnv = {};
  for (const name of PREVIEW_EXECUTION_ENV_ALLOWLIST) {
    const value = supervisorEnv[name];
    if (typeof value === 'string') childEnv[name] = value;
  }
  if (previewCredentials) {
    childEnv.AUTH_USERNAME = previewCredentials.username;
    childEnv.AUTH_PASSWORD = previewCredentials.password;
    childEnv.AUTH_SECRET = previewCredentials.authSecret;
  }
  return childEnv;
}

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

/**
 * URL-normalized comparison form of a navigation target. Comparing `href` preserves and enforces
 * protocol, hostname, effective port, pathname, query string and fragment in a single check.
 */
function normalizedTarget(url: string): string {
  return new URL(url).href;
}

/** Renders a target for error messages with any embedded userinfo removed, so no credential leaks. */
function describeTarget(url: string): string {
  const safe = new URL(url);
  safe.username = '';
  safe.password = '';
  return safe.href;
}

/**
 * Runtime barrier. `authenticatePreviewPage` is an exported callable boundary, so it re-proves the
 * loopback policy itself instead of trusting that a TaskSchema parse happened upstream. Shares the
 * single URL-policy definition with the schema barrier.
 */
function assertLoopbackAuthTarget(target: string | URL): void {
  if (isLoopbackPreviewTarget(target)) return;
  throw new Error(
    `authenticated visual review refused: ${describePreviewOrigin(target)} is not a loopback preview origin `
      + '(allowed: http/https on localhost, 127.0.0.1 or [::1])',
  );
}

/**
 * Post-navigation origin barrier. The requested login URL proves nothing once the response can
 * redirect, so the actual browser location is compared against the expected loopback origin.
 */
function assertActualOriginIsExpected(actualUrl: string, expectedOrigin: string): void {
  let actual: URL;
  try {
    actual = new URL(actualUrl);
  } catch {
    throw new Error('authenticated visual review refused: the login navigation ended on an unparsable location');
  }
  if (actual.origin !== expectedOrigin) {
    throw new Error(
      `authenticated visual review refused: the login navigation left the preview origin and landed on ${describePreviewOrigin(actual)}`,
    );
  }
}

/** Validates a required credential. The value is never included in errors or logs. */
function requiredCredential(name: 'AUTH_USERNAME' | 'AUTH_PASSWORD', value: string | undefined, origin: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`authenticated visual review requires ${name} to be set in ${origin}`);
  }
  return value;
}

/**
 * Signs the preview page in through the real same-origin Credentials form and leaves the page
 * on the exact requested preview target. No cookie fabrication and no auth bypass.
 *
 * `previewCredentials` is the disposable bundle that was handed to the preview child process, so
 * the browser types exactly the credentials that child accepts. When it is omitted the helper keeps
 * its established direct-invocation behavior and fails closed on a missing runtime credential.
 */
export async function authenticatePreviewPage(
  page: PreviewAuthPage,
  previewUrl: string,
  previewCredentials?: PreviewCredentials,
): Promise<void> {
  const target = new URL(previewUrl);
  // Fail closed on a non-loopback credential-bearing target before the credentials are even read,
  // and before any goto/fill/click reaches the browser.
  assertLoopbackAuthTarget(target);
  const loginUrl = new URL(LOGIN_PATH, target.origin).href;
  // Fail closed before any navigation when a credential is absent or empty.
  const supplied = previewCredentials
    ? { username: previewCredentials.username, password: previewCredentials.password, origin: 'the disposable preview credential bundle' }
    : { username: process.env.AUTH_USERNAME, password: process.env.AUTH_PASSWORD, origin: 'the runtime environment' };
  const username = requiredCredential('AUTH_USERNAME', supplied.username, supplied.origin);
  const password = requiredCredential('AUTH_PASSWORD', supplied.password, supplied.origin);

  await page.goto(loginUrl, { waitUntil: 'networkidle' });
  // A redirect can move the browser off the requested loopback origin, so the credentials are only
  // typed once the actual post-navigation location is proven to still be that origin.
  assertActualOriginIsExpected(page.url(), target.origin);
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
  // The final browser location is the evidence target: any redirect or fallback elsewhere fails closed.
  const expectedTarget = normalizedTarget(previewUrl);
  const actualTarget = normalizedTarget(page.url());
  if (actualTarget !== expectedTarget) {
    throw new Error(
      isLoginLocation(new URL(actualTarget))
        ? `authenticated visual review failed: ${LOGIN_PATH} was served instead of the requested preview target ${describeTarget(expectedTarget)}`
        : `authenticated visual review failed: preview navigation ended on ${describeTarget(actualTarget)} instead of the exact requested target ${describeTarget(expectedTarget)}`,
    );
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

/**
 * Minimal structural contract of the browser page used to establish a declared capture state.
 *
 * SELECTORS ONLY. Every page function below is a fixed literal written in this file; the task-supplied
 * strings (`focusSelector`, `scrollToSelector`) reach the browser exclusively as CSS selector
 * arguments of the standard Playwright selector APIs. Task data is never evaluated as JavaScript in
 * the preview, and `openDisclosures` operates on a hardcoded `details` query — a task can say WHICH
 * element to open, focus or scroll to, never WHAT code runs there.
 */
export interface CaptureStatePage {
  $$eval(selector: string, pageFunction: (elements: HTMLDetailsElement[]) => void): Promise<void>;
  $eval(selector: string, pageFunction: (element: Element) => void): Promise<void>;
  focus(selector: string): Promise<void>;
}

/**
 * Applies a declared capture state to an already-navigated page, in a fixed order:
 * disclosures first (they change layout), then keyboard focus, then the explicit scroll target — so a
 * declared scroll target always wins the final framing of the clipped shot, while the focus ring that
 * `focus()` parks stays in the DOM for the reviewer to see.
 *
 * Every field is optional: an empty state is a plain second capture of the (possibly different) URL.
 */
export async function applyCaptureState(page: CaptureStatePage, state: VisualCaptureState): Promise<void> {
  if (state.openDisclosures === true) {
    // Fixed selector, fixed page function: this is the whole "open every disclosure" capability.
    await page.$$eval('details', (elements) => { for (const element of elements) element.open = true; });
  }
  if (state.focusSelector !== undefined) {
    // Real keyboard focus on the named element, so the screenshot carries actual :focus-visible evidence.
    await page.focus(state.focusSelector);
  }
  if (state.scrollToSelector !== undefined) {
    await page.$eval(state.scrollToSelector, (element) => { element.scrollIntoView({ block: 'center', inline: 'nearest' }); });
  }
}

/**
 * Every URL this capture will navigate. `previewUrl` first, then each declared capture state's URL
 * (a state without a URL reuses `previewUrl`). Used both to plan the capture and to re-prove the
 * loopback policy per navigated URL.
 */
function captureTargetUrls(visual: NonNullable<TaskSpec['visual']>): string[] {
  return [visual.previewUrl, ...(visual.captureStates ?? []).map((state) => state.url ?? visual.previewUrl)];
}

export async function captureVisualEvidence(task: TaskSpec, cwd: string, outDir: string): Promise<{ files: string[]; stop: () => void }> {
  if (!task.visualReview || !task.visual) throw new Error('visual review requested but task.visual is missing');
  // Runtime barrier, ahead of the preview child and every navigation: an authenticated capture is
  // loopback-only for EVERY url it will visit, not just for previewUrl. The schema refuses such a
  // task too; this re-proves it here because captureVisualEvidence is an exported callable boundary
  // that mints a credential bundle a few lines below.
  if (task.visual.authenticated === true) {
    for (const url of captureTargetUrls(task.visual)) assertLoopbackAuthTarget(url);
  }
  fs.mkdirSync(outDir, { recursive: true });
  // One disposable bundle per capture: every viewport page authenticates against the same preview
  // server process, and the next independent capture mints an unrelated bundle.
  const previewCredentials = task.visual.authenticated === true ? createPreviewCredentials() : undefined;
  const [command, ...args] = task.visual.previewCommand;
  // The preview command is candidate-controlled code, so it is started with an allowlisted child
  // environment instead of the supervisor's process.env.
  const child: ChildProcess = spawn(command, args, {
    cwd,
    // The cast only bridges the Next.js `ProcessEnv` augmentation (a required readonly NODE_ENV);
    // the value stays an allowlisted plain record.
    env: buildPreviewChildEnv(process.env, previewCredentials) as NodeJS.ProcessEnv,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stop = () => {
    if (!child.pid) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
    setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, 2000).unref();
  };
  try {
    // Readiness is proven for every distinct url this capture will navigate (previewUrl first, so a
    // legacy task waits exactly as before). A capture state may name a second loopback port, and a
    // screenshot of a not-yet-serving preview is worthless evidence.
    for (const url of new Set(captureTargetUrls(task.visual))) await waitFor(url, task.visual.readyTimeoutMs);
    const browser = await chromium.launch({ headless: true });
    const files: string[] = [];
    try {
      for (const vp of task.visual.viewports) {
        const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
        if (task.visual.authenticated === true) {
          // Per-page (per-context) login: no shared global auth state across viewports. The browser
          // types the same disposable credentials the preview child was started with.
          await authenticatePreviewPage(page, task.visual.previewUrl, previewCredentials);
        } else {
          await page.goto(task.visual.previewUrl, { waitUntil: 'networkidle' });
        }
        // Established evidence, unchanged filename: the whole page in one image.
        const file = path.join(outDir, `${vp.name}-${vp.width}x${vp.height}.png`);
        await page.screenshot({ path: file, fullPage: true });
        // Added evidence: the viewport-sized clip. A tall fullPage shot is downscaled to a few percent
        // when a reviewer looks at it, which is why legibility, touch-target and focus claims were
        // unjudgeable from fullPage alone. The clip is the same pixels a person would actually see.
        const clipFile = path.join(outDir, `${vp.name}-${vp.width}x${vp.height}-clip.png`);
        await page.screenshot({ path: clipFile, fullPage: false });
        files.push(file, clipFile);
        await page.close();
      }
      // Declared capture states. Absent (the default) means this loop never runs and the evidence set
      // is byte-for-byte the legacy set plus the clips above.
      for (const state of task.visual.captureStates ?? []) {
        const stateUrl = state.url ?? task.visual.previewUrl;
        for (const vp of task.visual.viewports) {
          const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
          if (task.visual.authenticated === true) {
            // Same helper, same policy, per navigated url: loopback barrier, real Credentials form,
            // and the exact-target assertion against THIS state's url (an off-origin redirect fails closed).
            await authenticatePreviewPage(page, stateUrl, previewCredentials);
          } else {
            await page.goto(stateUrl, { waitUntil: 'networkidle' });
          }
          await applyCaptureState(page, state);
          const stateFile = path.join(outDir, `${state.name}-${vp.name}-${vp.width}x${vp.height}.png`);
          await page.screenshot({ path: stateFile, fullPage: true });
          const stateClipFile = path.join(outDir, `${state.name}-${vp.name}-${vp.width}x${vp.height}-clip.png`);
          await page.screenshot({ path: stateClipFile, fullPage: false });
          files.push(stateFile, stateClipFile);
          await page.close();
        }
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
