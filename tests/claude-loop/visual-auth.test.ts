import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { TaskSchema } from '../../scripts/claude-loop/schemas';

type PageCall = { method: string; args: unknown[] };
type AuthenticatePreviewPage = (page: unknown, previewUrl: string) => Promise<void>;

const visualReviewPath = path.resolve('scripts/claude-loop/visual-review.ts');

async function futureAuthenticatePreviewPage(): Promise<AuthenticatePreviewPage> {
  const module = await import('../../scripts/claude-loop/visual-review') as Record<string, unknown>;
  assert.equal(
    typeof module.authenticatePreviewPage,
    'function',
    'visual-review.ts must export authenticatePreviewPage(page, previewUrl)',
  );
  return module.authenticatePreviewPage as AuthenticatePreviewPage;
}

function withAuthEnv(username: string | undefined, password: string | undefined, run: () => Promise<void>): Promise<void> {
  const beforeUsername = process.env.AUTH_USERNAME;
  const beforePassword = process.env.AUTH_PASSWORD;
  if (username === undefined) delete process.env.AUTH_USERNAME;
  else process.env.AUTH_USERNAME = username;
  if (password === undefined) delete process.env.AUTH_PASSWORD;
  else process.env.AUTH_PASSWORD = password;

  return run().finally(() => {
    if (beforeUsername === undefined) delete process.env.AUTH_USERNAME;
    else process.env.AUTH_USERNAME = beforeUsername;
    if (beforePassword === undefined) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = beforePassword;
  });
}

function fakePage(previewUrl: string, leaveLoginOnSubmit: boolean): { page: unknown; calls: PageCall[] } {
  const calls: PageCall[] = [];
  let currentUrl = 'about:blank';
  const page = {
    async goto(url: string, options?: unknown) {
      calls.push({ method: 'goto', args: [url, options] });
      currentUrl = url;
    },
    async fill(selector: string, value: string) {
      calls.push({ method: 'fill', args: [selector, value] });
    },
    async click(selector: string) {
      calls.push({ method: 'click', args: [selector] });
      if (leaveLoginOnSubmit) currentUrl = new URL('/', previewUrl).href;
    },
    async waitForURL(predicate: string | RegExp | ((url: URL) => boolean)) {
      calls.push({ method: 'waitForURL', args: [predicate] });
      const matched = typeof predicate === 'function'
        ? predicate(new URL(currentUrl))
        : predicate instanceof RegExp
          ? predicate.test(currentUrl)
          : currentUrl === predicate;
      if (!matched) throw new Error(`waitForURL did not match ${currentUrl}`);
    },
    url() { return currentUrl; },
  };
  return { page, calls };
}

function visualReviewAst(): { source: ts.SourceFile; capture: ts.FunctionDeclaration; authenticate?: ts.FunctionDeclaration } {
  const text = fs.readFileSync(visualReviewPath, 'utf8');
  const source = ts.createSourceFile(visualReviewPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const functions = source.statements.filter(ts.isFunctionDeclaration);
  const capture = functions.find((node) => node.name?.text === 'captureVisualEvidence');
  assert.ok(capture?.body, 'captureVisualEvidence must remain a function declaration with an inspectable body');
  return {
    source,
    capture,
    authenticate: functions.find((node) => node.name?.text === 'authenticatePreviewPage'),
  };
}

function callsNamed(root: ts.Node, name: string): ts.CallExpression[] {
  const found: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if ((ts.isIdentifier(expression) && expression.text === name)
        || (ts.isPropertyAccessExpression(expression) && expression.name.text === name)) found.push(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(root);
  return found;
}

function hasAuthenticatedTrueGuard(node: ts.Node, boundary: ts.Node, source: ts.SourceFile): boolean {
  for (let current = node.parent; current && current !== boundary; current = current.parent) {
    let condition: ts.Expression | undefined;
    if (ts.isIfStatement(current) && current.thenStatement.pos <= node.pos && node.end <= current.thenStatement.end) condition = current.expression;
    if (ts.isConditionalExpression(current) && current.whenTrue.pos <= node.pos && node.end <= current.whenTrue.end) condition = current.condition;
    if (ts.isBinaryExpression(current) && current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && current.right.pos <= node.pos) condition = current.left;
    if (condition) {
      const normalized = condition.getText(source).replace(/\s+/g, '');
      if (/authenticated(?:===true)?$/.test(normalized) || /\.authenticated(?:===true)?/.test(normalized)) return true;
    }
  }
  return false;
}

test('TaskSchema preserves visual.authenticated=true and defaults anonymous mode to false', () => {
  const base = {
    id: 'FACTORY-AUTH-VISUAL-001', title: 'visual auth', description: 'visual auth',
    allowedWrite: ['tests/claude-loop/**'], gates: [['npm', 'run', 'claude:test']], visualReview: true,
    visual: { previewCommand: ['npm', 'run', 'dev'], previewUrl: 'http://localhost:3000/loop' },
  };
  const authenticated = TaskSchema.parse({ ...base, visual: { ...base.visual, authenticated: true } });
  assert.equal((authenticated.visual as { authenticated?: boolean } | undefined)?.authenticated, true);

  const absent = TaskSchema.parse(base);
  assert.equal((absent.visual as { authenticated?: boolean } | undefined)?.authenticated, false);
  const explicitFalse = TaskSchema.parse({ ...base, visual: { ...base.visual, authenticated: false } });
  assert.equal((explicitFalse.visual as { authenticated?: boolean } | undefined)?.authenticated, false);
});

test('authenticatePreviewPage uses the real same-origin Credentials form and exact preview target', async () => {
  const authenticate = await futureAuthenticatePreviewPage();
  const previewUrl = 'http://localhost:4317/loop?task=V2#review';
  const username = 'visual-user-sentinel';
  const password = 'visual-password-sentinel';
  const { page, calls } = fakePage(previewUrl, true);

  await withAuthEnv(username, password, () => authenticate(page, previewUrl));

  const semanticCalls = calls.map(({ method, args }) => [method, ...args]);
  assert.deepEqual(semanticCalls.filter(([method]) => method === 'goto').map(([, url]) => url), [
    'http://localhost:4317/login',
    previewUrl,
  ]);
  assert.deepEqual(semanticCalls.filter(([method]) => method === 'fill'), [
    ['fill', '#username', username],
    ['fill', '#password', password],
  ]);
  assert.deepEqual(semanticCalls.filter(([method]) => method === 'click'), [
    ['click', 'button[type="submit"]'],
  ]);
  assert.ok(calls.some(({ method }) => method === 'waitForURL'), 'login completion must be awaited/established');
});

test('authenticatePreviewPage fails closed when either runtime credential is missing without leaking values', async () => {
  const authenticate = await futureAuthenticatePreviewPage();
  for (const [username, password] of [[undefined, 'password-secret'], ['username-secret', undefined]] as const) {
    const { page, calls } = fakePage('http://localhost:4317/loop', true);
    let failure: unknown;
    await withAuthEnv(username, password, async () => {
      try { await authenticate(page, 'http://localhost:4317/loop'); } catch (error) { failure = error; }
    });
    assert.ok(failure, 'missing credential must reject');
    const message = failure instanceof Error ? failure.message : String(failure);
    assert.doesNotMatch(message, /password-secret|username-secret/);
    assert.equal(calls.some(({ method }) => method === 'goto' || method === 'click'), false, 'must fail before login/evidence navigation');
  }
});

test('authenticatePreviewPage rejects a login that remains on /login', async () => {
  const authenticate = await futureAuthenticatePreviewPage();
  const previewUrl = 'http://localhost:4317/loop';
  const { page, calls } = fakePage(previewUrl, false);
  await assert.rejects(withAuthEnv('visual-user', 'visual-password', () => authenticate(page, previewUrl)));
  assert.equal(calls.some(({ method, args }) => method === 'goto' && args[0] === previewUrl), false,
    'a failed login must not advance to the screenshot target');
});

test('captureVisualEvidence authenticates only opted-in tasks and does so before every screenshot', () => {
  const { source, capture } = visualReviewAst();
  const authCalls = callsNamed(capture.body!, 'authenticatePreviewPage');
  const screenshots = callsNamed(capture.body!, 'screenshot');
  assert.ok(authCalls.length > 0, 'captureVisualEvidence must invoke authenticatePreviewPage');
  assert.ok(screenshots.length > 0, 'captureVisualEvidence must retain screenshot capture');
  assert.ok(authCalls.every((call) => hasAuthenticatedTrueGuard(call, capture.body!, source)),
    'authentication must be guarded by visual.authenticated=true so absent/false remains anonymous');
  assert.ok(authCalls.some((authCall) => screenshots.every((screenshot) => authCall.pos < screenshot.pos)),
    'authenticated login must occur before screenshot acceptance');
});

test('authenticatePreviewPage does not fabricate cookies or bypass the Credentials form', () => {
  const { source, authenticate } = visualReviewAst();
  assert.ok(authenticate?.body, 'authenticatePreviewPage must be an exported, inspectable function declaration');
  const helperSource = authenticate.getText(source);
  assert.doesNotMatch(helperSource, /addCookies|setCookie|session-token|document\.cookie/i);
  assert.match(helperSource, /#username/);
  assert.match(helperSource, /#password/);
  assert.match(helperSource, /button\[type=["']submit["']\]/);
});
