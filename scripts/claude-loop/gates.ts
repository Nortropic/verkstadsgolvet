import { spawn } from 'node:child_process';

function stopGroup(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch {} }, 2000).unref();
}

export async function runGate(argv: string[], cwd: string, timeoutMs = 15 * 60_000): Promise<{ ok: boolean; output: string }> {
  if (!argv.length || argv.some((x) => !x)) throw new Error('gate argv must be non-empty strings');
  return await new Promise((resolve) => {
    const child = spawn(argv[0], argv.slice(1), { cwd, env: process.env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', (d) => out += d.toString());
    child.stderr.on('data', (d) => out += d.toString());
    const timer = setTimeout(() => stopGroup(child), timeoutMs);
    child.on('error', (e) => { clearTimeout(timer); resolve({ ok: false, output: String(e) }); });
    child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0, output: out.slice(-30000) }); });
  });
}

export async function runGates(commands: string[][], cwd: string): Promise<{ ok: boolean; failures: Array<{ command: string[]; output: string }> }> {
  const failures: Array<{ command: string[]; output: string }> = [];
  for (const command of commands) {
    const r = await runGate(command, cwd);
    if (!r.ok) failures.push({ command, output: r.output });
  }
  return { ok: failures.length === 0, failures };
}
