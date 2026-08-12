import test from 'node:test';
import assert from 'node:assert/strict';
import { authenticatePreviewPage, type PreviewAuthPage } from '../../scripts/claude-loop/visual-review';

const REQUESTED_PREVIEW_URL = 'http://localhost:4317/loop?task=V2#review';

function withAuthEnv(run: () => Promise<void>): Promise<void> {
  const beforeUsername = process.env.AUTH_USERNAME;
  const beforePassword = process.env.AUTH_PASSWORD;
  process.env.AUTH_USERNAME = 'visual-user';
  process.env.AUTH_PASSWORD = 'visual-password';

  return run().finally(() => {
    if (beforeUsername === undefined) delete process.env.AUTH_USERNAME;
    else process.env.AUTH_USERNAME = beforeUsername;
    if (beforePassword === undefined) delete process.env.AUTH_PASSWORD;
    else process.env.AUTH_PASSWORD = beforePassword;
  });
}

function fakePage(finalPreviewUrl: string): PreviewAuthPage {
  let currentUrl = 'about:blank';
  return {
    async goto(url: string) {
      currentUrl = url === REQUESTED_PREVIEW_URL ? finalPreviewUrl : url;
    },
    async fill() {},
    async click() {
      currentUrl = 'http://localhost:4317/';
    },
    async waitForURL(predicate: (url: URL) => boolean) {
      if (!predicate(new URL(currentUrl))) {
        throw new Error(`waitForURL did not match ${currentUrl}`);
      }
    },
    url() {
      return currentUrl;
    },
  };
}

for (const [label, finalPreviewUrl] of [
  ['redirected pathname', 'http://localhost:4317/unexpected'],
  ['different query', 'http://localhost:4317/loop?task=OTHER#review'],
  ['different hash', 'http://localhost:4317/loop?task=V2#different'],
  ['different protocol', 'https://localhost:4317/loop?task=V2#review'],
  ['different host', 'http://127.0.0.1:4317/loop?task=V2#review'],
  ['different effective port', 'http://localhost:4318/loop?task=V2#review'],
] as const) {
  test(`authenticatePreviewPage rejects a final target with ${label}`, async () => {
    await assert.rejects(
      withAuthEnv(() => authenticatePreviewPage(fakePage(finalPreviewUrl), REQUESTED_PREVIEW_URL)),
    );
  });
}

test('authenticatePreviewPage accepts the exact URL-normalized preview target', async () => {
  const previewUrl = 'HTTP://LOCALHOST:80/loop?task=V2#review';
  const normalizedTarget = new URL(previewUrl).href;
  const page = fakePage(normalizedTarget);

  await withAuthEnv(() => authenticatePreviewPage(page, previewUrl));

  assert.equal(new URL(page.url()).href, normalizedTarget);
});
