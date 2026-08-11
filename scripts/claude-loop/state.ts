import path from 'node:path';
import { commonGitDir, readJson, writeJson } from './util';
import { RunStateSchema, type RunState } from './schemas';

export function statePath(repo: string, runId: string): string { return path.join(commonGitDir(repo), 'claude-factory', 'runs', runId, 'state.json'); }
export function saveState(repo: string, state: RunState): void { writeJson(statePath(repo, state.runId), state); }
export function loadState(repo: string, runId: string): RunState { return RunStateSchema.parse(readJson(statePath(repo, runId))); }
