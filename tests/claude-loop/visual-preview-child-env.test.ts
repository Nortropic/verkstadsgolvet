import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
import type { TaskSpec } from '../../scripts/claude-loop/schemas';

type ChildEnvironment = Record<string, string | undefined>;
type PageCall = { method: 'goto' | 'fill' | 'click'; args: unknown[] };
type CaptureResult = { childEnv: ChildEnvironment; pageCalls: PageCall[]; authGlobalWrites: string[] };

const visualReviewPath = path.resolve('scripts/claude-loop/visual-review.ts');
const realRequire = createRequire(import.meta.url);
const UNEXPECTED_SECRET_NAME = 'FAV003_UNKNOWN_7B64F021E9_SECRET';

const SECRET_NAMES = [
  'AUTH_USERNAME',
  'AUTH_PASSWORD',
  'AUTH_SECRET',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'VERCEL_TOKEN',
  'RESEND_API_KEY',
  'FAL_KEY',
  'FAV003_ARBITRARY_SECRET_SENTINEL',
] as const;

const SUPERVISOR_VALUES: Record<(typeof SECRET_NAMES)[number], string> = Object.fromEntries(
  SECRET_NAMES.map((name) => [name, `supervisor-${name.toLowerCase()}-sentinel`]),
) as Record<(typeof SECRET_NAMES)[number], string>;

function task(authenticated: boolean): TaskSpec {
  return {
    id: 'FACTORY-AUTH-VISUAL-001-FAV-003',
    title: 'preview child environment boundary',
    description: 'freeze the FAV-003 owner security contract',
    allowedWrite: ['tests/claude-loop/visual-preview-child-env.test.ts'],
    deniedWrite: [],
    gates: [['npm', 'run', 'claude:test']],
    visualReview: true,
    visual: {
      previewCommand: ['preview-command-sentinel', '--serve'],
      previewUrl: 'http://localhost:4317/loop',
      authenticated,
      readyTimeoutMs: 1_000,
      viewports: [{ name: 'contract', width: 900, height: 700 }],
    },
  };
}

function loadInstrumentedVisualReview(observe: {
  childEnvironments: ChildEnvironment[];
  pages: PageCall[][];
  authGlobalWrites: string[];
}): { captureVisualEvidence: (task: TaskSpec, cwd: string, outDir: string) => Promise<unknown> } {
  const source = fs.readFileSync(visualReviewPath, 'utf8');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    fileName: visualReviewPath,
  }).outputText;

  const spawn = (_command: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
    observe.childEnvironments.push({ ...(options.env ?? {}) });
    return { pid: undefined, stdout: null, stderr: null };
  };
  const chromium = {
    async launch() {
      return {
        async newPage() {
          const calls: PageCall[] = [];
          observe.pages.push(calls);
          let currentUrl = 'about:blank';
          return {
            async goto(url: string) { calls.push({ method: 'goto', args: [url] }); currentUrl = url; },
            async fill(selector: string, value: string) { calls.push({ method: 'fill', args: [selector, value] }); },
            async click(selector: string) {
              calls.push({ method: 'click', args: [selector] });
              currentUrl = 'http://localhost:4317/';
            },
            async waitForURL(predicate: (url: URL) => boolean) {
              if (!predicate(new URL(currentUrl))) throw new Error(`waitForURL did not match ${currentUrl}`);
            },
            url() { return currentUrl; },
            async screenshot() {},
            async close() {},
          };
        },
        async close() {},
      };
    },
  };
  const schemas = {
    isLoopbackPreviewTarget(value: string | URL) {
      const url = typeof value === 'string' ? new URL(value) : value;
      return ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    },
    describePreviewOrigin(value: string | URL) {
      return (typeof value === 'string' ? new URL(value) : value).origin;
    },
  };
  const instrumentedRequire = (specifier: string): unknown => {
    if (specifier === 'node:child_process') return { spawn };
    if (specifier === 'playwright') return { chromium };
    if (specifier === './schemas') return schemas;
    return realRequire(specifier);
  };
  const module = { exports: {} as Record<string, unknown> };
  const observedEnv = new Proxy(process.env, {
    set(target, property, value) {
      if (['AUTH_USERNAME', 'AUTH_PASSWORD', 'AUTH_SECRET'].includes(String(property))) observe.authGlobalWrites.push(`set:${String(property)}`);
      return Reflect.set(target, property, value);
    },
    deleteProperty(target, property) {
      if (['AUTH_USERNAME', 'AUTH_PASSWORD', 'AUTH_SECRET'].includes(String(property))) observe.authGlobalWrites.push(`delete:${String(property)}`);
      return Reflect.deleteProperty(target, property);
    },
  });
  const observedProcess = new Proxy(process, {
    get(target, property, receiver) {
      if (property === 'env') return observedEnv;
      return Reflect.get(target, property, receiver);
    },
  });
  new Function('require', 'module', 'exports', 'process', javascript)(instrumentedRequire, module, module.exports, observedProcess);
  return module.exports as { captureVisualEvidence: (task: TaskSpec, cwd: string, outDir: string) => Promise<unknown> };
}

async function capture(authenticated: boolean): Promise<CaptureResult> {
  const childEnvironments: ChildEnvironment[] = [];
  const pages: PageCall[][] = [];
  const authGlobalWrites: string[] = [];
  const visualReview = loadInstrumentedVisualReview({ childEnvironments, pages, authGlobalWrites });
  const beforeFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response('', { status: 200 });
  try {
    await visualReview.captureVisualEvidence(task(authenticated), '/candidate-worktree', '/tmp/fav003-output');
  } finally {
    globalThis.fetch = beforeFetch;
  }
  assert.equal(childEnvironments.length, 1, 'one preview capture must launch exactly one preview child');
  assert.equal(pages.length, 1, 'the contract fixture uses exactly one browser page');
  return { childEnv: childEnvironments[0], pageCalls: pages[0], authGlobalWrites };
}

async function withSupervisorSentinels(run: () => Promise<void>): Promise<void> {
  const before = new Map<string, string | undefined>();
  for (const name of SECRET_NAMES) {
    before.set(name, process.env[name]);
    process.env[name] = SUPERVISOR_VALUES[name];
  }
  before.set('PATH', process.env.PATH);
  before.set(UNEXPECTED_SECRET_NAME, process.env[UNEXPECTED_SECRET_NAME]);
  process.env.PATH = '/fav003/execution/path-sentinel';
  process.env[UNEXPECTED_SECRET_NAME] = 'supervisor-unexpected-secret-sentinel';
  try {
    await run();
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function formValue(calls: PageCall[], selector: '#username' | '#password'): string | undefined {
  return calls.find(({ method, args }) => method === 'fill' && args[0] === selector)?.args[1] as string | undefined;
}

test('authenticated preview denies unknown and known supervisor secrets while preserving PATH', async () => {
  await withSupervisorSentinels(async () => {
    const { childEnv } = await capture(true);
    assert.equal(childEnv.PATH, '/fav003/execution/path-sentinel', 'PATH is the positive execution allowlist control');
    for (const name of SECRET_NAMES) {
      assert.notEqual(childEnv[name], SUPERVISOR_VALUES[name], `${name} must not cross from the supervisor`);
    }
    assert.equal(childEnv.FAV003_ARBITRARY_SECRET_SENTINEL, undefined, 'unknown environment names are denied by default');
    assert.equal(childEnv[UNEXPECTED_SECRET_NAME], undefined, 'an unenumerated environment name is denied by default');
  });
});

test('authenticated child gets disposable auth shared exactly with the browser', async () => {
  await withSupervisorSentinels(async () => {
    const { childEnv, pageCalls } = await capture(true);
    for (const name of ['AUTH_USERNAME', 'AUTH_PASSWORD', 'AUTH_SECRET'] as const) {
      assert.equal(typeof childEnv[name], 'string', `${name} must be explicitly present for authenticated preview`);
      assert.ok(childEnv[name]!.length > 0, `${name} must be non-empty`);
      assert.notEqual(childEnv[name], SUPERVISOR_VALUES[name], `${name} must be preview-only`);
    }
    assert.equal(formValue(pageCalls, '#username'), childEnv.AUTH_USERNAME);
    assert.equal(formValue(pageCalls, '#password'), childEnv.AUTH_PASSWORD);
  });
});

test('authenticated preview credentials are fresh per independent capture', async () => {
  await withSupervisorSentinels(async () => {
    const first = await capture(true);
    const second = await capture(true);
    assert.notDeepEqual(
      [first.childEnv.AUTH_USERNAME, first.childEnv.AUTH_PASSWORD, first.childEnv.AUTH_SECRET],
      [second.childEnv.AUTH_USERNAME, second.childEnv.AUTH_PASSWORD, second.childEnv.AUTH_SECRET],
      'independent captures must not reuse a credential set',
    );
  });
});

test('preview credential handling never mutates supervisor auth globals', async () => {
  await withSupervisorSentinels(async () => {
    const before = [process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD, process.env.AUTH_SECRET];
    const { authGlobalWrites } = await capture(true);
    assert.deepEqual(authGlobalWrites, [], 'preview code must not temporarily set or delete supervisor auth globals');
    assert.deepEqual([process.env.AUTH_USERNAME, process.env.AUTH_PASSWORD, process.env.AUTH_SECRET], before);
  });
});

test('anonymous preview is sanitized and receives no auth injection', async () => {
  await withSupervisorSentinels(async () => {
    const { childEnv, pageCalls } = await capture(false);
    assert.equal(childEnv.PATH, '/fav003/execution/path-sentinel');
    for (const name of SECRET_NAMES) assert.equal(childEnv[name], undefined, `${name} must be absent from anonymous child`);
    assert.equal(childEnv[UNEXPECTED_SECRET_NAME], undefined);
    assert.equal(pageCalls.some(({ method }) => method === 'fill' || method === 'click'), false);
  });
});
