import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskSchema } from '../../scripts/claude-loop/schemas';
import { authenticatePreviewPage, type PreviewAuthPage } from '../../scripts/claude-loop/visual-review';

type PageCall = { method: 'goto' | 'fill' | 'click' | 'waitForURL'; args: unknown[] };

const USERNAME = 'fav002-username-sentinel';
const PASSWORD = 'fav002-password-sentinel';

function taskWith(previewUrl: string, authenticated: boolean) {
  return {
    id: 'FACTORY-AUTH-VISUAL-001-FAV-002',
    title: 'loopback-only authenticated visual review',
    description: 'freeze the FAV-002 owner policy',
    allowedWrite: ['tests/claude-loop/visual-auth-loopback.test.ts'],
    gates: [['npm', 'run', 'claude:test']],
    visualReview: true,
    visual: {
      previewCommand: ['npm', 'run', 'dev'],
      previewUrl,
      authenticated,
    },
  };
}

function withAuthEnv(run: () => Promise<void>): Promise<void> {
  const beforeUsername = process.env.AUTH_USERNAME;
  const beforePassword = process.env.AUTH_PASSWORD;
  process.env.AUTH_USERNAME = USERNAME;
  process.env.AUTH_PASSWORD = PASSWORD;

  return run().finally(() => {
    if (beforeUsername === undefined) delete process.env.AUTH_USERNAME;
    else process.env.AUTH_USERNAME = beforeUsername;
    if (beforePassword === undefined) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = beforePassword;
  });
}

function fakePage(options: {
  previewUrl: string;
  loginNavigationUrl?: string;
}): { page: PreviewAuthPage; calls: PageCall[] } {
  const calls: PageCall[] = [];
  const expectedOrigin = new URL(options.previewUrl).origin;
  const loginUrl = new URL('/login', expectedOrigin).href;
  let currentUrl = 'about:blank';

  const page: PreviewAuthPage = {
    async goto(url: string, navigationOptions?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit' }) {
      calls.push({ method: 'goto', args: [url, navigationOptions] });
      currentUrl = url === loginUrl ? (options.loginNavigationUrl ?? loginUrl) : url;
    },
    async fill(selector: string, value: string) {
      calls.push({ method: 'fill', args: [selector, value] });
    },
    async click(selector: string) {
      calls.push({ method: 'click', args: [selector] });
      currentUrl = new URL('/', expectedOrigin).href;
    },
    async waitForURL(predicate: (url: URL) => boolean, waitOptions?: { timeout?: number }) {
      calls.push({ method: 'waitForURL', args: [predicate, waitOptions] });
      if (!predicate(new URL(currentUrl))) throw new Error(`waitForURL did not match ${currentUrl}`);
    },
    url() {
      return currentUrl;
    },
  };

  return { page, calls };
}

function credentialBearingCalls(calls: PageCall[]): PageCall[] {
  return calls.filter(({ method }) => method === 'fill' || method === 'click');
}

test('TaskSchema rejects authenticated remote and non-loopback preview targets', () => {
  for (const previewUrl of [
    'https://attacker.example/loop',
    'https://example.com/loop',
    'https://localhost.attacker.example/loop',
    'http://192.168.1.10/loop',
  ]) {
    assert.equal(
      TaskSchema.safeParse(taskWith(previewUrl, true)).success,
      false,
      `authenticated preview must reject ${previewUrl}`,
    );
  }
});

test('TaskSchema preserves anonymous remote visual previews', () => {
  assert.equal(TaskSchema.safeParse(taskWith('https://example.com/loop', false)).success, true);
});

for (const [label, previewUrl] of [
  ['localhost', 'http://localhost:4317/loop'],
  ['IPv4 loopback', 'http://127.0.0.1:4317/loop'],
  ['IPv6 loopback', 'http://[::1]:4317/loop'],
] as const) {
  test(`TaskSchema accepts authenticated ${label} previews`, () => {
    assert.equal(TaskSchema.safeParse(taskWith(previewUrl, true)).success, true);
  });
}

test('authenticatePreviewPage rejects a direct remote target before navigation or credentials', async () => {
  const previewUrl = 'https://attacker.example/loop';
  const { page, calls } = fakePage({ previewUrl });
  let failure: unknown;

  await withAuthEnv(async () => {
    try { await authenticatePreviewPage(page, previewUrl); } catch (error) { failure = error; }
  });

  assert.ok(failure, 'remote authenticated preview must reject');
  assert.deepEqual(calls, [], 'remote target must fail before goto, fill, or click');
  const message = failure instanceof Error ? failure.message : String(failure);
  assert.doesNotMatch(message, new RegExp(`${USERNAME}|${PASSWORD}`));
});

test('authenticatePreviewPage rejects a remote login redirect before credential fill', async () => {
  const previewUrl = 'http://localhost:4317/loop';
  const { page, calls } = fakePage({
    previewUrl,
    loginNavigationUrl: 'https://attacker.example/phish',
  });

  await assert.rejects(withAuthEnv(() => authenticatePreviewPage(page, previewUrl)));

  assert.deepEqual(
    calls.filter(({ method }) => method === 'goto').map(({ args }) => args[0]),
    ['http://localhost:4317/login'],
    'redirect must be detected immediately after the login navigation',
  );
  assert.deepEqual(credentialBearingCalls(calls), [], 'redirect rejection must precede username/password fill and submit');
});

test('authenticatePreviewPage keeps ordinary same-origin loopback login valid', async () => {
  const previewUrl = 'http://localhost:4317/loop';
  const { page, calls } = fakePage({ previewUrl });

  await withAuthEnv(() => authenticatePreviewPage(page, previewUrl));

  assert.deepEqual(
    calls.filter(({ method }) => method === 'goto').map(({ args }) => args[0]),
    ['http://localhost:4317/login', previewUrl],
  );
  assert.deepEqual(
    calls.filter(({ method }) => method === 'fill').map(({ args }) => args),
    [['#username', USERNAME], ['#password', PASSWORD]],
  );
  assert.deepEqual(calls.filter(({ method }) => method === 'click').map(({ args }) => args), [
    ['button[type="submit"]'],
  ]);
});
