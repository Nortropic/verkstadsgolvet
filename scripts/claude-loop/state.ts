import fs from 'node:fs';
import path from 'node:path';
import { commonGitDir, readJson, writeJson } from './util';
import { RunStateSchema, type RunState } from './schemas';

export function runsRoot(repo: string): string { return path.join(commonGitDir(repo), 'claude-factory', 'runs'); }
export function statePath(repo: string, runId: string): string { return path.join(runsRoot(repo), runId, 'state.json'); }
export function saveState(repo: string, state: RunState): void { writeJson(statePath(repo, state.runId), state); }
export function loadState(repo: string, runId: string): RunState { return RunStateSchema.parse(readJson(statePath(repo, runId))); }

/**
 * The phases from which nothing further happens on its own.
 *
 * `DONE` is the successful terminal, `BLOCKED` is the failed terminal that an operator resumes or
 * extends deliberately. Every other phase means "a supervisor process was in the middle of this
 * run", which is exactly the condition process-death recovery has to reason about.
 */
export const TERMINAL_RUN_PHASES: readonly string[] = ['DONE', 'BLOCKED'];

export function isTerminalRunPhase(phase: string): boolean { return TERMINAL_RUN_PHASES.includes(phase); }

/**
 * One persisted run as it is on disk, INCLUDING the ones that do not parse.
 *
 * An unreadable run state is reported rather than skipped: recovery must never quietly ignore a run
 * it cannot read, and it must never write over one either — `state` is `null` and `error` carries
 * the parse failure, so the caller fails closed on evidence instead of on absence.
 */
export type PersistedRun = { runId: string; state: RunState | null; error: string | null };

/** Every persisted run under the Git common directory, ordered by run id. */
export function listRunStates(repo: string): PersistedRun[] {
  const root = runsRoot(repo);
  if (!fs.existsSync(root)) return [];
  const out: PersistedRun[] = [];
  for (const runId of fs.readdirSync(root).sort()) {
    const file = path.join(root, runId, 'state.json');
    if (!fs.existsSync(file)) continue;
    try {
      out.push({ runId, state: RunStateSchema.parse(readJson(file)), error: null });
    } catch (error) {
      out.push({ runId, state: null, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return out;
}
