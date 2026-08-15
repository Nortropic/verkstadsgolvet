#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { doctor } from './doctor';
import { liveSmoke } from './smoke';
import { empiricalSmoke } from './empirical-smoke';
import { extendRemediationBudget, startRun, resumeRun } from './supervisor';
import { autopilotRecover, autopilotStatus, classifyRuns, defaultAutopilotContext, evaluateNow, runAutopilot, watchForReadyWork, watchPoller, type RunOwnership } from './autopilot';
import { repoRoot, commonGitDir } from './util';

/** Repeatable `--flag value` collector; unknown values are never inferred. */
function collectFlag(args: string[], flag: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== flag) continue;
    const value = args[i + 1];
    if (!value || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    out.push(value);
  }
  return out;
}

/** Single-valued `--flag value`, or `null`. A repeated flag is a mistake, not a last-one-wins. */
function singleFlag(args: string[], flag: string): string | null {
  const values = collectFlag(args, flag);
  if (values.length > 1) throw new Error(`${flag} may be given at most once`);
  return values[0] ?? null;
}

function positiveIntFlag(args: string[], flag: string, fallback: number): number {
  const raw = singleFlag(args, flag);
  if (raw === null) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${flag} requires a positive integer`);
  return value;
}

/** Unknown/unavailable is `—`, never an invented number. */
function age(seconds: number | null): string {
  return seconds === null ? '—' : `${seconds}s`;
}

function printRun(prefix: string, r: RunOwnership): void {
  console.log(`${prefix}\t${r.runId}\t${r.taskId ?? '—'}\t${r.phase ?? '—'}\t${r.terminal ? 'TERMINAL' : 'UNFINISHED'}\t${r.liveness}\theartbeat_age=${age(r.heartbeatAgeSeconds)}\t${r.evidence}`);
}

function printEvaluations(evaluations: ReturnType<typeof evaluateNow>['evaluations']): void {
  for (const e of evaluations) {
    console.log(`${e.id}\t${e.status}\t${e.item.fixtureOnly ? 'FIXTURE_ONLY' : 'FULL'}\t${e.reasons[0] ?? '-'}`);
  }
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'doctor') return doctor();
  if (cmd === 'selftest') { doctor(); console.log('CLAUDE_FACTORY_SELFTEST=PASS'); return; }
  if (cmd === 'live-smoke') return await liveSmoke();
  if (cmd === 'empirical-smoke') return await empiricalSmoke();
  if (cmd === 'run') {
    const i = args.indexOf('--task'); if (i < 0 || !args[i+1]) throw new Error('run requires --task <file>');
    const s = await startRun(args[i+1], collectFlag(args, '--owner-author')); console.log(JSON.stringify(s, null, 2)); return;
  }
  if (cmd === 'resume') {
    const id = args[0]; if (!id) throw new Error('resume requires run-id');
    // A resume re-applies the owner-author guard, so the selection must be expressible here too.
    const s = await resumeRun(id, collectFlag(args, '--owner-author')); console.log(JSON.stringify(s, null, 2)); return;
  }
  if (cmd === 'backlog') {
    const ctx = defaultAutopilotContext(collectFlag(args, '--owner-author'));
    printEvaluations(evaluateNow({ deps: ctx.deps, selection: ctx.selection }).evaluations);
    return;
  }
  if (cmd === 'autopilot') {
    // The owner-author selection is an explicit operator act on the command line (or in the
    // operator-local config). It can never come from the tracked backlog or from model output.
    const ctx = defaultAutopilotContext(collectFlag(args, '--owner-author'));
    const result = await runAutopilot({ config: ctx.config, deps: ctx.deps, selection: ctx.selection, force: args.includes('--force') });
    console.log(`AUTOPILOT_STOP=${result.stopReason}`);
    console.log(`AUTOPILOT_DETAIL=${result.detail}`);
    for (const s of result.started) console.log(`${s.taskId}\t${s.status}\t${s.runId ?? '-'}\t${s.candidateSha ?? '-'}\t${s.mergedMain ?? '-'}`);
    printEvaluations(result.evaluations);
    if (result.stopReason === 'BASE_DRIFT' || result.stopReason === 'RUN_BLOCKED' || result.stopReason === 'CLAIM_LOST') process.exitCode = 2;
    return;
  }
  if (cmd === 'autopilot-status') {
    const ctx = defaultAutopilotContext(collectFlag(args, '--owner-author'));
    const status = autopilotStatus({ repo: ctx.repo, deps: ctx.deps, selection: ctx.selection, nowMs: Date.now() });
    console.log(`BASE=${status.base ?? '—'}`);
    printEvaluations(status.evaluations);
    for (const e of status.ledger.entries) console.log(`LEDGER\t${e.taskId}\t${e.status}\t${e.runId ?? '-'}\t${e.candidateSha ?? '-'}\t${e.reason ?? '-'}`);
    for (const c of status.claims) console.log(`CLAIM\t${c.scope}\t${c.key}\t${c.claim.state}\tepoch=${c.claim.epoch}\towner=${c.claim.owner}\tstale=${c.stale}`);
    // Stale-run classification: every unfinished run with the heartbeat age of the claim that
    // covers it, so live and abandoned runs are told apart mechanically rather than by hand.
    for (const r of status.runs.filter((x) => !x.terminal)) printRun('RUN', r);
    return;
  }
  if (cmd === 'autopilot-recover') {
    const repo = repoRoot();
    const recovery = autopilotRecover({
      repo,
      nowMs: Date.now(),
      clearTaskIds: collectFlag(args, '--clear'),
      // `--run` is the operator's explicit statement about a run whose process left no liveness
      // evidence. It is refused for a run whose claim is still beating.
      recoverRunIds: collectFlag(args, '--run'),
    });
    for (const c of recovery.recoveredClaims) console.log(`RECOVERED_CLAIM\t${c.scope}\t${c.key}\tepoch=${c.claim.epoch}\towner=${c.claim.owner}`);
    for (const u of recovery.ledgerUpdates) console.log(`LEDGER_UPDATE\t${u.taskId}\t${u.from}->${u.to}\t${u.reason}`);
    for (const u of recovery.runUpdates) console.log(`RUN_UPDATE\t${u.runId}\t${u.taskId ?? '—'}\t${u.from}->${u.to}\t${u.trigger}\t${u.reason}`);
    for (const r of recovery.unprovenRuns) printRun('RUN_UNRECOVERED', r);
    if (!recovery.recoveredClaims.length && !recovery.ledgerUpdates.length && !recovery.runUpdates.length) console.log('NOTHING_TO_RECOVER');
    return;
  }
  if (cmd === 'watch-ready') {
    // ONE wake, then exit. This takes no claim, starts nothing and decides nothing: the caller does.
    const ctx = defaultAutopilotContext(collectFlag(args, '--owner-author'));
    const taskId = singleFlag(args, '--task');
    const watchedRunId = singleFlag(args, '--run');
    // One poll is a FULL canonical backlog evaluation — the same one the scheduler makes its
    // decisions on — so it executes the `local_test` prerequisite commands of every slice whose
    // cheaper prerequisites already pass. In this repository that includes `npm run loop:test`.
    // The default interval is therefore proportionate to that cost, not to UI responsiveness: a
    // faster poll would run a full test suite every few seconds in the operator's live checkout,
    // competing with a supervisor's own gates.
    const intervalMs = positiveIntFlag(args, '--interval-ms', 60_000);
    const timeoutMs = positiveIntFlag(args, '--timeout-ms', 3_600_000);
    const result = await watchForReadyWork({
      poll: watchPoller({ repo: ctx.repo, deps: ctx.deps, selection: ctx.selection, watchedRunId }),
      now: () => Date.now(),
      sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
      intervalMs,
      timeoutMs,
      taskId,
      watchedRunId,
    });
    console.log(`WATCH_WAKE=${result.wake}`);
    console.log(`WATCH_READY=${result.readyIds.join(',') || '—'}`);
    console.log(`WATCH_RUN=${result.watchedRunId ?? '—'}\t${result.watchedRunPhase ?? '—'}`);
    console.log(`WATCH_POLLS=${result.polls}\tWATCH_WAITED_MS=${result.waitedMs}`);
    // A timeout is "nothing woke you", not a failure of the Factory; it is distinguishable by exit
    // code so a caller can loop or stop without parsing prose.
    if (result.wake === 'TIMEOUT') process.exitCode = 1;
    return;
  }
  if (cmd === 'extend-remediation') {
    // The owner re-open. It re-opens a run stopped by the no-progress circuit breaker, and still
    // re-opens runs blocked before the breaker existed. It appends an explicit owner-extension
    // marker to the append-only progress history; it never resets `attempt`, never truncates
    // history and can never re-open a run that reached the frozen absolute round backstop.
    const id = args[0]; const rounds = Number(args[1]);
    if (!id || !Number.isInteger(rounds) || rounds < 1) throw new Error('extend-remediation requires run-id and positive integer rounds');
    const s = extendRemediationBudget(id, rounds); console.log(JSON.stringify(s, null, 2)); return;
  }
  if (cmd === 'status') {
    const repo = repoRoot(); const root = path.join(commonGitDir(repo), 'claude-factory', 'runs');
    if (!fs.existsSync(root)) { console.log('NO_RUNS'); return; }
    // The liveness column is the claim-derived classification, so a non-terminal run on this list
    // can be told apart from an abandoned one without opening a single claim file.
    const liveness = new Map(classifyRuns({ repo, nowMs: Date.now() }).map((r) => [r.runId, r]));
    for (const d of fs.readdirSync(root).sort()) {
      const p = path.join(root,d,'state.json'); if (!fs.existsSync(p)) continue;
      const s = JSON.parse(fs.readFileSync(p,'utf8'));
      const r = liveness.get(d);
      console.log(`${s.runId}\t${s.task?.id}\t${s.phase}\t${s.candidateSha ?? '-'}\t${r?.liveness ?? '—'}\theartbeat_age=${age(r?.heartbeatAgeSeconds ?? null)}`);
    } return;
  }
  if (cmd === 'watch') {
    const repo = repoRoot(); const root = path.join(commonGitDir(repo), 'claude-factory', 'runs');
    console.log(`Watch ${root}; Ctrl-C to stop.`);
    let last=''; setInterval(() => { if (!fs.existsSync(root)) return; const rows:string[]=[]; for (const d of fs.readdirSync(root).sort()) { const p=path.join(root,d,'state.json'); if(fs.existsSync(p)){const s=JSON.parse(fs.readFileSync(p,'utf8')); rows.push(`${s.runId}\t${s.task?.id}\t${s.phase}\t${s.candidateSha ?? '-'}`);}} const v=rows.join('\n'); if(v!==last){console.clear();console.log(v||'NO_RUNS');last=v;} }, 1500); return;
  }
  throw new Error('usage: cli.ts doctor|selftest|live-smoke|empirical-smoke|status|watch|watch-ready [--task <taskId>] [--run <run-id>] [--interval-ms N] [--timeout-ms N]|backlog|autopilot [--force] [--owner-author <taskId>]|autopilot-status|autopilot-recover [--clear <taskId>] [--run <run-id>]|run --task <file> [--owner-author <taskId>]|resume <run-id> [--owner-author <taskId>]|extend-remediation <run-id> <rounds>');
}

main().catch((e) => { console.error(`CLAUDE_FACTORY_BLOCKED: ${e instanceof Error ? e.stack || e.message : String(e)}`); process.exitCode = 2; });
