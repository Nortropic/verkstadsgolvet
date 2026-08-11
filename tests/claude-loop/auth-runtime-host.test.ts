import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'scripts/claude-loop/auth-runtime-smoke.ts'), 'utf8');

test('auth runtime smoke uses one canonical localhost host end-to-end', () => {
  assert.match(source, /const origin = `http:\/\/localhost:\$\{port\}`/);
  assert.match(source, /'start', '-H', 'localhost'/);
  assert.match(source, /AUTH_URL: origin/);
  assert.match(source, /NEXTAUTH_URL: origin/);
  assert.doesNotMatch(source, /127\.0\.0\.1/);
});

test('auth runtime smoke validates decoded session and protected route', () => {
  assert.match(source, /api\/auth\/session/);
  assert.match(source, /session\?\.user\?\.name !== 'claude-smoke-user'/);
  assert.match(source, /\/systemhalsa/);
  assert.match(source, /page\.locator\('\.login-err'\)/);
});
