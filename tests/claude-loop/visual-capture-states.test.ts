import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { TaskSchema, type TaskSpec, type VisualCaptureState } from '../../scripts/claude-loop/schemas';

/**
 * FACTORY-VISUAL-CAPTURE-V1 contract, hermetically: no browser, no network, no preview process.
 *
 * `visual-review.ts` is transpiled and loaded with instrumented `playwright`/`node:child_process`
 * modules (the pattern established by visual-preview-child-env.test.ts), so the assertions are made
 * against the real shipped source. The stub page keeps a tiny DOM model and encodes it into every
 * recorded screenshot, which is how "the disclosures were open / focus was parked when the shot was
 * taken" is proven rather than assumed.
 */

const visualReviewPath = path.resolve('scripts/claude-loop/visual-review.ts');
const realRequire = createRequire(import.meta.url);

type Shot = {
  path: string;
  fullPage: boolean;
  viewport: { width: number; height: number };
  /** Location of the page when the shutter fired. */
  url: string;
  /** Rendered state of the stub page at shutter time. */
  rendered: string;
};

type Recording = { shots: Shot[]; gotos: string[]; fills: [string, string][]; spawns: number };

const DETAILS_PER_PAGE = 3;

/** A stub page whose entire "rendering" is a text encoding of the DOM state a shot would show. */
function stubPage(viewport: { width: number; height: number }, recording: Recording) {
  const details = Array.from({ length: DETAILS_PER_PAGE }, () => ({ open: false }));
  let currentUrl = 'about:blank';
  let focused: string | null = null;
  let scrolledTo: string | null = null;
  const rendered = (): string => [
    `details-open=${details.map((d) => (d.open ? '1' : '0')).join('')}`,
    `focused=${focused ?? 'none'}`,
    `scrolled-to=${scrolledTo ?? 'none'}`,
  ].join(' ');

  return {
    async goto(url: string) { recording.gotos.push(url); currentUrl = url; },
    async fill(selector: string, value: string) { recording.fills.push([selector, value]); },
    async click() { currentUrl = new URL('/', currentUrl).href; },
    async waitForURL(predicate: (url: URL) => boolean) {
      if (!predicate(new URL(currentUrl))) throw new Error(`waitForURL did not match ${currentUrl}`);
    },
    url() { return currentUrl; },
    async $$eval(selector: string, pageFunction: (elements: { open: boolean }[]) => void) {
      assert.equal(selector, 'details', 'the disclosure query must stay a fixed selector in visual-review.ts');
      pageFunction(details);
    },
    async $eval(selector: string, pageFunction: (element: { scrollIntoView: () => void }) => void) {
      pageFunction({ scrollIntoView: () => { scrolledTo = selector; } });
    },
    async focus(selector: string) { focused = selector; },
    async screenshot(options: { path: string; fullPage?: boolean }) {
      recording.shots.push({
        path: options.path,
        fullPage: options.fullPage === true,
        viewport,
        url: currentUrl,
        rendered: rendered(),
      });
    },
    async close() {},
  };
}

function loadInstrumentedVisualReview(recording: Recording): {
  captureVisualEvidence: (task: TaskSpec, cwd: string, outDir: string) => Promise<{ files: string[]; stop: () => void }>;
} {
  const source = fs.readFileSync(visualReviewPath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: visualReviewPath,
  }).outputText;

  const spawn = () => { recording.spawns += 1; return { pid: undefined, stdout: null, stderr: null }; };
  const chromium = {
    async launch() {
      return {
        async newPage(options: { viewport: { width: number; height: number } }) { return stubPage(options.viewport, recording); },
        async close() {},
      };
    },
  };
  const schemas = {
    isLoopbackPreviewTarget(value: string | URL) {
      let url: URL;
      try { url = typeof value === 'string' ? new URL(value) : value; } catch { return false; }
      return ['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    },
    describePreviewOrigin(value: string | URL) {
      try { return (typeof value === 'string' ? new URL(value) : value).origin; } catch { return 'an unparsable preview URL'; }
    },
  };
  const instrumentedRequire = (specifier: string): unknown => {
    if (specifier === 'node:child_process') return { spawn };
    if (specifier === 'playwright') return { chromium };
    if (specifier === './schemas') return schemas;
    if (specifier === 'node:fs') return { ...realRequire('node:fs'), mkdirSync: () => undefined };
    return realRequire(specifier);
  };
  const module = { exports: {} as Record<string, unknown> };
  new Function('require', 'module', 'exports', javascript)(instrumentedRequire, module, module.exports);
  return module.exports as ReturnType<typeof loadInstrumentedVisualReview>;
}

const PREVIEW_URL = 'http://localhost:4317/loop';

function task(visual: Partial<NonNullable<TaskSpec['visual']>> = {}): TaskSpec {
  return {
    id: 'FACTORY-VISUAL-CAPTURE-V1',
    title: 'visual capture states',
    description: 'clipped shots, capture states, multi-url',
    authorityClass: 'ordinary',
    allowedWrite: ['tests/claude-loop/**'],
    deniedWrite: [],
    gates: [['npm', 'run', 'claude:test']],
    visualReview: true,
    visual: {
      previewCommand: ['preview-command-sentinel'],
      previewUrl: PREVIEW_URL,
      authenticated: false,
      readyTimeoutMs: 1_000,
      viewports: [{ name: 'mobile', width: 390, height: 844 }],
      ...visual,
    },
  };
}

async function capture(taskSpec: TaskSpec): Promise<{ files: string[]; recording: Recording }> {
  const recording: Recording = { shots: [], gotos: [], fills: [], spawns: 0 };
  const visualReview = loadInstrumentedVisualReview(recording);
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 200 });
  try {
    const result = await visualReview.captureVisualEvidence(taskSpec, '/candidate-worktree', '/evidence/round-0');
    return { files: result.files, recording };
  } finally {
    globalThis.fetch = beforeFetch;
  }
}

function names(files: string[]): string[] {
  return files.map((file) => path.basename(file));
}

test('legacy tasks keep their exact filenames and gain a viewport clip per viewport', async () => {
  const legacy = task({
    viewports: [
      { name: 'desktop', width: 1440, height: 1000 },
      { name: 'mobile', width: 390, height: 844 },
    ],
  });
  assert.equal((legacy.visual as { captureStates?: unknown }).captureStates, undefined, 'the legacy fixture declares no capture states');

  const { files, recording } = await capture(legacy);

  assert.deepEqual(names(files), [
    'desktop-1440x1000.png',
    'desktop-1440x1000-clip.png',
    'mobile-390x844.png',
    'mobile-390x844-clip.png',
  ]);
  // The established fullPage evidence is unchanged; the clip is strictly additive.
  assert.deepEqual(
    recording.shots.map(({ path: file, fullPage }) => [path.basename(file), fullPage]),
    [
      ['desktop-1440x1000.png', true],
      ['desktop-1440x1000-clip.png', false],
      ['mobile-390x844.png', true],
      ['mobile-390x844-clip.png', false],
    ],
  );
  assert.deepEqual(new Set(recording.gotos), new Set([PREVIEW_URL]), 'a legacy task navigates only previewUrl');
  assert.ok(recording.shots.every(({ rendered }) => rendered === 'details-open=000 focused=none scrolled-to=none'),
    'a legacy capture must not manipulate the page');
});

test('a capture state with openDisclosures shoots a DOM whose disclosures are all open', async () => {
  const { files, recording } = await capture(task({
    captureStates: [{ name: 'expanded', openDisclosures: true }],
  }));

  assert.deepEqual(names(files), [
    'mobile-390x844.png',
    'mobile-390x844-clip.png',
    'expanded-mobile-390x844.png',
    'expanded-mobile-390x844-clip.png',
  ]);
  const stateShots = recording.shots.filter(({ path: file }) => path.basename(file).startsWith('expanded-'));
  assert.equal(stateShots.length, 2, 'a capture state produces both a fullPage shot and a clip per viewport');
  for (const shot of stateShots) {
    assert.match(shot.rendered, /details-open=111/, 'every disclosure must already be open when the shutter fires');
  }
  // The baseline capture is untouched by the state manipulation.
  const baseShots = recording.shots.filter(({ path: file }) => !path.basename(file).startsWith('expanded-'));
  assert.ok(baseShots.every(({ rendered }) => rendered.includes('details-open=000')));
});

test('focusSelector parks real keyboard focus before the shutter fires', async () => {
  const { recording } = await capture(task({
    captureStates: [{ name: 'focus', focusSelector: '#primary-action' }],
  }));

  const stateShots = recording.shots.filter(({ path: file }) => path.basename(file).startsWith('focus-'));
  assert.equal(stateShots.length, 2);
  for (const shot of stateShots) assert.match(shot.rendered, /focused=#primary-action/);
});

test('scrollToSelector scrolls the named element into view before the shutter fires', async () => {
  const { recording } = await capture(task({
    captureStates: [{ name: 'deep', scrollToSelector: '#run-table' }],
  }));

  const stateShots = recording.shots.filter(({ path: file }) => path.basename(file).startsWith('deep-'));
  assert.equal(stateShots.length, 2);
  for (const shot of stateShots) assert.match(shot.rendered, /scrolled-to=#run-table/);
});

test('capture states can combine disclosures, focus and scroll in one shot', async () => {
  const { recording } = await capture(task({
    captureStates: [{ name: 'combo', openDisclosures: true, focusSelector: '#tab', scrollToSelector: '#end' }],
  }));

  const stateShots = recording.shots.filter(({ path: file }) => path.basename(file).startsWith('combo-'));
  assert.equal(stateShots.length, 2);
  for (const shot of stateShots) {
    assert.equal(shot.rendered, 'details-open=111 focused=#tab scrolled-to=#end');
  }
});

test('capture states capture several urls in one run, each with fullPage and clip', async () => {
  const { files, recording } = await capture(task({
    previewUrl: 'http://localhost:4317/loop',
    captureStates: [
      { name: 'mata', url: 'http://localhost:4317/loop/mata' },
      { name: 'loop-expanded', openDisclosures: true },
    ],
  }));

  assert.deepEqual(names(files), [
    'mobile-390x844.png',
    'mobile-390x844-clip.png',
    'mata-mobile-390x844.png',
    'mata-mobile-390x844-clip.png',
    'loop-expanded-mobile-390x844.png',
    'loop-expanded-mobile-390x844-clip.png',
  ]);
  assert.deepEqual(recording.gotos, [
    'http://localhost:4317/loop',
    'http://localhost:4317/loop/mata',
    'http://localhost:4317/loop',
  ], 'a state without a url reuses previewUrl; a state with a url navigates exactly it');
  const mataShots = recording.shots.filter(({ path: file }) => path.basename(file).startsWith('mata-'));
  assert.equal(mataShots.length, 2);
  assert.ok(mataShots.every(({ url }) => url === 'http://localhost:4317/loop/mata'));
});

test('an authenticated capture logs in per navigated state url through the real credentials form', async () => {
  const { recording } = await capture(task({
    authenticated: true,
    captureStates: [{ name: 'mata', url: 'http://localhost:4317/loop/mata', openDisclosures: true }],
  }));

  assert.deepEqual(recording.gotos, [
    'http://localhost:4317/login',
    'http://localhost:4317/loop',
    'http://localhost:4317/login',
    'http://localhost:4317/loop/mata',
  ], 'each captured url is reached by a fresh same-origin login, never by a fabricated session');
  assert.deepEqual(recording.fills.map(([selector]) => selector), ['#username', '#password', '#username', '#password']);
  const usernames = new Set(recording.fills.filter(([selector]) => selector === '#username').map(([, value]) => value));
  assert.equal(usernames.size, 1, 'all pages of one capture use the same disposable bundle');
  assert.equal([...usernames][0]?.startsWith('preview-'), true, 'the browser types the disposable preview credential');
});

test('an off-loopback state url is refused at runtime before the preview child or any navigation', async () => {
  const remote = task({
    authenticated: true,
    captureStates: [{ name: 'exfil', url: 'https://attacker.example/collect' }],
  });

  const recording: Recording = { shots: [], gotos: [], fills: [], spawns: 0 };
  const visualReview = loadInstrumentedVisualReview(recording);
  await assert.rejects(
    visualReview.captureVisualEvidence(remote, '/candidate-worktree', '/evidence/round-0'),
    /not a loopback preview origin/,
  );
  assert.equal(recording.spawns, 0, 'the preview child must not start for a refused capture');
  assert.deepEqual(recording.gotos, [], 'no navigation may happen for a refused capture');
  assert.deepEqual(recording.fills, [], 'no credential may be typed for a refused capture');
});

test('TaskSchema refuses an authenticated capture state pointed off loopback', () => {
  for (const url of [
    'https://attacker.example/collect',
    'http://192.168.1.10/loop',
    'https://localhost.attacker.example/loop',
  ]) {
    const parsed = TaskSchema.safeParse({
      id: 'FACTORY-VISUAL-CAPTURE-V1',
      title: 'visual capture states',
      description: 'schema barrier',
      allowedWrite: ['tests/claude-loop/**'],
      gates: [['npm', 'run', 'claude:test']],
      visualReview: true,
      visual: {
        previewCommand: ['npm', 'run', 'dev'],
        previewUrl: PREVIEW_URL,
        authenticated: true,
        captureStates: [{ name: 'ok' }, { name: 'remote', url }],
      },
    });
    assert.equal(parsed.success, false, `authenticated capture state must reject ${url}`);
    if (!parsed.success) {
      assert.deepEqual(parsed.error.issues[0].path, ['visual', 'captureStates', 1, 'url']);
    }
  }
});

test('TaskSchema keeps loopback and anonymous capture states valid', () => {
  const base = {
    id: 'FACTORY-VISUAL-CAPTURE-V1',
    title: 'visual capture states',
    description: 'schema barrier',
    allowedWrite: ['tests/claude-loop/**'],
    gates: [['npm', 'run', 'claude:test']],
    visualReview: true,
  };
  const authenticatedLoopback = TaskSchema.safeParse({
    ...base,
    visual: {
      previewCommand: ['npm', 'run', 'dev'],
      previewUrl: PREVIEW_URL,
      authenticated: true,
      captureStates: [{ name: 'mata', url: 'http://127.0.0.1:4317/loop/mata', openDisclosures: true, focusSelector: '#a', scrollToSelector: '#b' }],
    },
  });
  assert.equal(authenticatedLoopback.success, true);

  // Anonymous remote previews were always allowed and stay allowed, states included.
  const anonymousRemote = TaskSchema.safeParse({
    ...base,
    visual: {
      previewCommand: ['npm', 'run', 'dev'],
      previewUrl: 'https://example.com/loop',
      captureStates: [{ name: 'other', url: 'https://example.com/loop/mata' }],
    },
  });
  assert.equal(anonymousRemote.success, true);
});

test('capture state names cannot steer evidence out of the run directory', () => {
  for (const name of ['../escape', '/absolute', 'nested/name', '.hidden', 'back\\slash', '']) {
    const parsed = TaskSchema.safeParse({
      id: 'FACTORY-VISUAL-CAPTURE-V1',
      title: 'visual capture states',
      description: 'filename safety',
      allowedWrite: ['tests/claude-loop/**'],
      gates: [['npm', 'run', 'claude:test']],
      visualReview: true,
      visual: { previewCommand: ['npm', 'run', 'dev'], previewUrl: PREVIEW_URL, captureStates: [{ name }] },
    });
    assert.equal(parsed.success, false, `capture state name ${JSON.stringify(name)} must be rejected`);
  }
});

test('captureStates stays absent after parsing a legacy task', () => {
  const parsed = TaskSchema.parse({
    id: 'FACTORY-VISUAL-CAPTURE-V1',
    title: 'legacy visual task',
    description: 'additive-only schema change',
    allowedWrite: ['tests/claude-loop/**'],
    gates: [['npm', 'run', 'claude:test']],
    visualReview: true,
    visual: { previewCommand: ['npm', 'run', 'dev'], previewUrl: PREVIEW_URL },
  });
  const visual = parsed.visual as Record<string, unknown>;
  assert.equal('captureStates' in visual, false, 'an absent captureStates must not be materialized by the parse');
  // The rest of the legacy contract is untouched.
  assert.equal(visual.authenticated, false);
  assert.equal(visual.readyTimeoutMs, 60000);
  assert.equal((visual.viewports as unknown[]).length, 3);
});

test('applyCaptureState only ever hands selectors to the page', async () => {
  const { applyCaptureState } = await import('../../scripts/claude-loop/visual-review') as unknown as {
    applyCaptureState: (page: unknown, state: VisualCaptureState) => Promise<void>;
  };
  const seen: { method: string; selector: string }[] = [];
  const page = {
    async $$eval(selector: string, pageFunction: (elements: { open: boolean }[]) => void) {
      seen.push({ method: '$$eval', selector });
      assert.equal(typeof pageFunction, 'function', 'the page function is source code from visual-review.ts, never task data');
      pageFunction([]);
    },
    async $eval(selector: string, pageFunction: (element: { scrollIntoView: () => void }) => void) {
      seen.push({ method: '$eval', selector });
      pageFunction({ scrollIntoView: () => {} });
    },
    async focus(selector: string) { seen.push({ method: 'focus', selector }); },
  };

  await applyCaptureState(page, { name: 'all', openDisclosures: true, focusSelector: '#focus-me', scrollToSelector: '#scroll-me' });
  assert.deepEqual(seen, [
    { method: '$$eval', selector: 'details' },
    { method: 'focus', selector: '#focus-me' },
    { method: '$eval', selector: '#scroll-me' },
  ]);

  seen.length = 0;
  await applyCaptureState(page, { name: 'none' });
  assert.deepEqual(seen, [], 'a state with no manipulation touches the page not at all');
});

test('visual-review.ts never evaluates task-supplied strings as page code', () => {
  const source = fs.readFileSync(visualReviewPath, 'utf8');
  // Playwright evaluates whatever `page.evaluate`/`addInitScript` receives; task-supplied selectors
  // must never reach those, so the capture path uses selector APIs only.
  // `$eval`/`$$eval` are selector APIs (their page function is source code from this file) and are
  // deliberately allowed; the arbitrary-code entry points are not.
  assert.doesNotMatch(source, /\.evaluate\(|\.evaluateHandle\(|addInitScript|new Function|[^$\w.]eval\(/);
});
