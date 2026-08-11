import path from 'node:path';
import net from 'node:net';
import { spawn, type ChildProcess } from 'node:child_process';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { repoRoot } from './util';

const require = createRequire(import.meta.url);

async function freePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const s = net.createServer();
    s.once('error', reject);
    s.listen(0, 'localhost', () => {
      const address = s.address();
      if (!address || typeof address === 'string') {
        s.close();
        reject(new Error('cannot allocate port'));
        return;
      }
      const port = address.port;
      s.close((e) => e ? reject(e) : resolve(port));
    });
  });
}

async function waitFor(url: string, child: ChildProcess, timeoutMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`next start exited before readiness rc=${child.exitCode}`);
    try {
      const r = await fetch(url, { redirect: 'manual' });
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`next start not ready: ${url}`);
}

function stop(child: ChildProcess): void {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
}

export async function authRuntimeSmoke(): Promise<void> {
  const repo = repoRoot();
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const nextBin = require.resolve('next/dist/bin/next');
  let logs = '';
  const child = spawn(process.execPath, [nextBin, 'start', '-H', 'localhost', '-p', String(port)], {
    cwd: repo,
    detached: true,
    env: {
      ...process.env,
      AUTH_SECRET: 'claude-factory-auth-runtime-smoke-secret-0123456789abcdef0123456789abcdef',
      AUTH_USERNAME: 'claude-smoke-user',
      AUTH_PASSWORD: 'claude-smoke-password',
      AUTH_URL: origin,
      NEXTAUTH_URL: origin,
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (d) => { logs += d.toString(); });
  child.stderr?.on('data', (d) => { logs += d.toString(); });

  try {
    await waitFor(`${origin}/login`, child);
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const page = await context.newPage();

      const anon = await page.goto(`${origin}/`, { waitUntil: 'networkidle' });
      if (!anon || anon.status() >= 500 || new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/login') {
        throw new Error(`anonymous protected-route gate failed status=${anon?.status()} url=${page.url()}`);
      }

      await page.fill('#username', 'claude-smoke-user');
      await page.fill('#password', 'wrong-password');
      await page.click('button[type="submit"]');
      const loginError = page.locator('.login-err');
      await loginError.waitFor({ state: 'visible', timeout: 15_000 });
      if (await loginError.count() !== 1) throw new Error(`expected exactly one .login-err, got ${await loginError.count()}`);
      if (new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/login') throw new Error(`invalid credentials escaped canonical login origin url=${page.url()}`);

      await page.fill('#username', 'claude-smoke-user');
      await page.fill('#password', 'claude-smoke-password');
      const goodRespP = page.waitForResponse(
        (r) => r.url().startsWith(`${origin}/api/auth/callback/credentials`) && r.request().method() === 'POST',
        { timeout: 20_000 },
      );
      await page.click('button[type="submit"]');
      const goodResp = await goodRespP;
      await page.waitForURL((u) => u.origin === origin && u.pathname === '/', { timeout: 20_000 });

      const setCookies = await goodResp.headerValues('set-cookie');
      if (!setCookies.some((v) => /(?:^|;\s*)(?:__Secure-)?authjs\.session-token(?:\.\d+)?=/i.test(v))) {
        throw new Error('successful credential callback issued no Auth.js session cookie');
      }
      const cookies = await context.cookies();
      if (!cookies.some((c) => c.name.includes('authjs.session-token') && c.domain === 'localhost')) {
        throw new Error('successful login did not retain Auth.js session cookie on canonical localhost host');
      }

      const sessionResponse = await context.request.get(`${origin}/api/auth/session`, { failOnStatusCode: false });
      if (sessionResponse.status() !== 200) throw new Error(`session endpoint status=${sessionResponse.status()}`);
      const session = await sessionResponse.json().catch(() => null) as { user?: { name?: string } } | null;
      if (session?.user?.name !== 'claude-smoke-user') {
        throw new Error(`Auth.js session endpoint did not decode expected user: ${JSON.stringify(session)}`);
      }

      const protectedResponse = await page.goto(`${origin}/systemhalsa`, { waitUntil: 'networkidle' });
      if (!protectedResponse || protectedResponse.status() >= 500 || new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/systemhalsa') {
        throw new Error(`authenticated middleware/session failed status=${protectedResponse?.status()} url=${page.url()}`);
      }
      await page.reload({ waitUntil: 'networkidle' });
      if (new URL(page.url()).origin !== origin || new URL(page.url()).pathname !== '/systemhalsa') {
        throw new Error(`session did not survive authenticated reload url=${page.url()}`);
      }
    } finally {
      await browser.close();
    }

    if (/\b(?:CompressionStream|DecompressionStream) is not defined\b|ReferenceError[^\n]*(?:CompressionStream|DecompressionStream)/i.test(logs)) {
      throw new Error(`Edge runtime compression API failure observed:\n${logs.slice(-5000)}`);
    }
    console.log('CLAUDE_FACTORY_AUTH_RUNTIME_SMOKE=PASS');
    console.log(`AUTH_RUNTIME_ORIGIN=${origin}`);
    console.log('AUTH_RUNTIME_CANONICAL_HOST=localhost');
  } finally {
    stop(child);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  authRuntimeSmoke().catch((e) => {
    console.error(`CLAUDE_FACTORY_AUTH_RUNTIME_BLOCKED: ${e instanceof Error ? e.stack || e.message : String(e)}`);
    process.exitCode = 2;
  });
}
