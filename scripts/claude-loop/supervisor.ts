import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigSchema, TaskSchema, type FactoryConfig, type Finding, type RunState, type TaskSpec } from './schemas';
import { repoRoot, readJson, nowId, slug, checkWriteScope, git } from './util';
import { originMain, createWorktree, changedFiles, commitCandidate, clean } from './git';
import { runRole } from './claude';
import { runGates } from './gates';
import { saveState, loadState } from './state';
import { Telemetry } from './telemetry';
import { captureVisualEvidence } from './visual-review';
import { publish } from './publication';
import { builderRemediationFindings, reviewDisposition } from './review-policy';

function mergeAdvisories(current: Finding[], next: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of [...current, ...next]) {
    const key = `${f.id}\u0000${f.severity}\u0000${f.file ?? ''}\u0000${f.line ?? ''}\u0000${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key); out.push(f);
  }
  return out;
}

export function loadConfig(repo: string): FactoryConfig {
  const local = path.join(repo, '.claude-loop.json');
  const example = path.join(repo, '.claude-loop.example.json');
  return ConfigSchema.parse(readJson(fs.existsSync(local) ? local : example));
}
export function loadTask(file: string): TaskSpec { return TaskSchema.parse(readJson(path.resolve(file))); }

function basePrompt(task: TaskSpec): string {
  return `Task ${task.id}: ${task.title}\n\n${task.description}\n\nAllowed write: ${task.allowedWrite.join(', ')}\nDenied write: ${task.deniedWrite.join(', ')}\nRequired gates: ${task.gates.map((g) => JSON.stringify(g)).join(' ; ')}`;
}

export async function startRun(taskFile: string): Promise<RunState> {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const task = loadTask(taskFile);
  if (task.visualReview && !task.visual) throw new Error('visualReview=true requires task.visual');
  if (!clean(repo)) throw new Error('launch checkout must be clean');
  const main = originMain(repo);
  const baseSha = task.baseSha ?? main;
  if (task.baseSha && task.baseSha !== main) throw new Error(`explicit task base is not current origin/main`);
  const runId = `${slug(task.id)}-${nowId()}`;
  const wtRoot = path.join(os.homedir(), 'nortropic', 'worktrees', 'claude-factory');
  const { worktree, branch } = createWorktree(repo, wtRoot, task.id, runId, baseSha);
  let state: RunState = { version: 1, runId, task, baseSha, branch, worktree, phase: 'ARCHITECT', attempt: 0, candidateSha: null, sessions: { architect: null, builder: null, reviewer: null, visualReviewer: null }, findings: [], advisoryFindings: [], prUrl: null, blockedReason: null };
  saveState(repo, state);
  return await execute(repo, config, state);
}

export async function resumeRun(runId: string): Promise<RunState> {
  const repo = repoRoot();
  const config = loadConfig(repo);
  const state = loadState(repo, runId);
  if (!fs.existsSync(state.worktree)) throw new Error(`recorded worktree missing: ${state.worktree}`);
  return await execute(repo, config, state);
}

async function execute(repo: string, config: FactoryConfig, state: RunState): Promise<RunState> {
  const t = new Telemetry(repo, state.runId);
  try {
    if (!state.sessions.architect) {
      t.emit('architect.started', { task: state.task.id });
      const a = await runRole({ role: 'architect', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nPlan this implementation. Do not edit files.`, model: config.models.architect });
      state.sessions.architect = a.sessionId; state.phase = 'BUILD'; saveState(repo, state);
      t.emit('architect.completed', { session_id: a.sessionId, outcome: a.result.outcome });
      if (a.result.outcome !== 'READY') throw new Error(`architect not READY outcome=${a.result.outcome}: ${a.result.summary}`);
    }

    for (let round = state.attempt; round <= config.maxRemediationRounds; round++) {
      state.attempt = round; state.phase = round === 0 ? 'BUILD' : 'REMEDIATE'; saveState(repo, state);
      t.emit(round === 0 ? 'builder.started' : 'builder.remediation_started', { task: state.task.id, round });
      const prompt = round === 0
        ? `${basePrompt(state.task)}\n\nImplement the task now in this worktree. You are not allowed to publish. Run useful local checks.`
        : `${basePrompt(state.task)}\n\nRemediate these independent findings, then rerun relevant checks:\n${JSON.stringify(state.findings, null, 2)}`;
      const b = await runRole({ role: 'builder', cwd: state.worktree, prompt, resume: state.sessions.builder, model: config.models.builder });
      state.sessions.builder = b.sessionId; saveState(repo, state);
      t.emit('builder.completed', { session_id: b.sessionId, outcome: b.result.outcome, round });
      if (b.result.outcome === 'BLOCKED') throw new Error(`builder blocked: ${b.result.summary}`);
      const builderRemediation = builderRemediationFindings(b.result);
      if (builderRemediation) {
        state.findings = builderRemediation; saveState(repo, state);
        t.emit('builder.self_remediation_requested', { round, findings: builderRemediation });
        continue;
      }

      const files = changedFiles(state.worktree, state.candidateSha ?? state.baseSha);
      const violations = checkWriteScope(files, state.task.allowedWrite, state.task.deniedWrite);
      if (violations.length) throw new Error(`allowed-write violation: ${violations.join(', ')}`);
      const gates = await runGates(state.task.gates, state.worktree);
      t.emit(gates.ok ? 'gates.passed' : 'gates.failed', { round, failures: gates.failures.length });
      if (!gates.ok) {
        state.findings = gates.failures.map((g, i) => ({ id: `gate-${i+1}`, severity: 'major' as const, message: `${g.command.join(' ')} failed\n${g.output}` }));
        saveState(repo, state);
        continue;
      }
      const changedNow = changedFiles(state.worktree, state.candidateSha ?? state.baseSha);
      if (changedNow.length) {
        state.candidateSha = commitCandidate(state.worktree, state.task.id, round);
        t.emit('candidate.created', { candidate_sha: state.candidateSha, round });
      } else if (!state.candidateSha) throw new Error('builder produced no candidate changes');

      state.phase = 'REVIEW'; state.findings = []; saveState(repo, state);
      t.emit('review.started', { candidate_sha: state.candidateSha, round });
      const r = await runRole({ role: 'reviewer', cwd: state.worktree, prompt: `${basePrompt(state.task)}\n\nIndependently review candidate ${state.candidateSha} against base ${state.baseSha}. Inspect git diff and tests. Do not edit.`, model: config.models.reviewer });
      state.sessions.reviewer = r.sessionId;
      const rd = reviewDisposition(r.result, 'reviewer');
      state.advisoryFindings = mergeAdvisories(state.advisoryFindings, rd.advisories);
      state.findings = rd.actionable; saveState(repo, state);
      t.emit(rd.action === 'REMEDIATE' ? 'review.findings' : rd.advisories.length ? 'review.passed_with_advisories' : 'review.passed', { session_id: r.sessionId, outcome: r.result.outcome, findings: r.result.findings.length, actionable: rd.actionable, advisories: rd.advisories, round });
      if (rd.action === 'BLOCK') throw new Error(`reviewer blocked: ${r.result.summary}`);
      if (rd.action === 'REMEDIATE') continue;

      if (state.task.visualReview) {
        state.phase = 'VISUAL_REVIEW'; saveState(repo, state); t.emit('visual.started', { round });
        const outDir = path.join(state.worktree, '.claude-loop', 'evidence', state.runId, `round-${round}`);
        const capture = await captureVisualEvidence(state.task, state.worktree, outDir);
        try {
          const promptV = `${basePrompt(state.task)}\n\nReview these screenshots and the candidate read-only. Files:\n${capture.files.join('\n')}`;
          const v = await runRole({ role: 'visual-reviewer', cwd: state.worktree, prompt: promptV, model: config.models.visualReviewer });
          state.sessions.visualReviewer = v.sessionId;
          const vd = reviewDisposition(v.result, 'visual-reviewer');
          state.advisoryFindings = mergeAdvisories(state.advisoryFindings, vd.advisories);
          state.findings = vd.actionable; saveState(repo, state);
          t.emit(vd.action === 'REMEDIATE' ? 'visual.findings' : vd.advisories.length ? 'visual.passed_with_advisories' : 'visual.passed', { session_id: v.sessionId, outcome: v.result.outcome, findings: v.result.findings.length, actionable: vd.actionable, advisories: vd.advisories, round });
          if (vd.action === 'BLOCK') throw new Error(`visual reviewer blocked: ${v.result.summary}`);
          if (vd.action === 'REMEDIATE') continue;
        } finally { capture.stop(); }
      }

      const finalGates = await runGates(state.task.gates, state.worktree);
      if (!finalGates.ok) { state.findings = finalGates.failures.map((g,i) => ({ id:`final-gate-${i+1}`, severity:'major' as const, message:`${g.command.join(' ')} failed\n${g.output}` })); saveState(repo,state); continue; }
      if (!clean(state.worktree)) throw new Error('worktree dirty after final candidate/gates');

      if (config.publish.enabled) {
        state.phase = 'PUBLISH'; saveState(repo, state); t.emit('publication.started', { candidate_sha: state.candidateSha });
        const p = publish({ repo, worktree: state.worktree, branch: state.branch, baseSha: state.baseSha, candidateSha: state.candidateSha!, taskId: state.task.id, autoMerge: config.publish.autoMerge });
        state.prUrl = p.prUrl; t.emit(p.mergedMain ? 'publication.completed' : 'pr.created', { pr: p.prUrl, main: p.mergedMain ?? null });
      }
      state.phase = 'DONE'; state.findings = []; saveState(repo, state); t.emit('run.completed', { task: state.task.id, candidate_sha: state.candidateSha, pr: state.prUrl, advisory_findings: state.advisoryFindings });
      return state;
    }
    throw new Error(`remediation budget exhausted after ${config.maxRemediationRounds + 1} rounds`);
  } catch (e) {
    state.phase = 'BLOCKED'; state.blockedReason = e instanceof Error ? e.message : String(e); saveState(repo, state); t.emit('run.blocked', { reason: state.blockedReason });
    throw e;
  }
}
