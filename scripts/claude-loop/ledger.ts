import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { commonGitDir, readJson, writeJson } from './util';

/**
 * The autopilot ledger: the ONLY memory the scheduler has.
 *
 * It lives under the Git common directory, is written before and after every scheduling decision,
 * and is re-read from disk at the start of every iteration. That is what makes a restart
 * deterministic instead of duplicating work: a fresh process with an empty context reconstructs
 * exactly the same picture from the same files. Chat context, terminal output and model summaries
 * are never consulted, and never become operational state.
 */
export const LedgerEntrySchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(['RUNNING', 'AWAITING_PUBLICATION', 'DONE', 'BLOCKED']),
  runId: z.string().nullable().default(null),
  baseSha: z.string().nullable().default(null),
  candidateSha: z.string().nullable().default(null),
  mergedMain: z.string().nullable().default(null),
  reason: z.string().nullable().default(null),
  updatedAt: z.string(),
});
export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

export const LedgerSchema = z.object({
  version: z.literal(1),
  entries: z.array(LedgerEntrySchema).default([]),
});
export type Ledger = z.infer<typeof LedgerSchema>;

export const EMPTY_LEDGER: Ledger = { version: 1, entries: [] };

/** Statuses that make a backlog item unavailable for a new run without operator action. */
export const LEDGER_OCCUPIED_STATUSES: readonly LedgerEntry['status'][] = ['RUNNING', 'AWAITING_PUBLICATION', 'DONE', 'BLOCKED'];

/** Statuses that count as "this slice's work exists" for dependency resolution. */
export const LEDGER_COMPLETED_STATUSES: readonly LedgerEntry['status'][] = ['DONE'];

export function autopilotDir(repo: string): string {
  return path.join(commonGitDir(repo), 'claude-factory', 'autopilot');
}

/** The aggregate view. Written whole only by tests and operator tooling, never per scheduling step. */
export function ledgerPath(repo: string): string {
  return path.join(autopilotDir(repo), 'ledger.json');
}

/**
 * One file per task id.
 *
 * The ledger is shared by every supervisor in every worktree of the repository, so it must never be
 * rewritten as a whole from a snapshot: two supervisors whose snapshots predate each other's write
 * would silently drop each other's entries, and a dropped `DONE` record would make already merged
 * work schedulable again. Splitting the ledger by task id means a supervisor only ever writes the
 * exact key it holds the claim for, so no interleaving can lose another supervisor's record.
 */
export function ledgerEntryDir(repo: string): string {
  return path.join(autopilotDir(repo), 'ledger');
}

export const LEDGER_TASK_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function ledgerEntryPath(repo: string, taskId: string): string {
  if (!LEDGER_TASK_ID_PATTERN.test(taskId)) throw new Error(`unsafe ledger task id '${taskId}'`);
  return path.join(ledgerEntryDir(repo), `${taskId}.json`);
}

/**
 * Reads the whole ledger: the aggregate file first, then the per-task files, which win.
 *
 * Reading is a merge rather than a single parse so that the aggregate view stays usable while every
 * write stays narrow.
 */
export function loadLedger(repo: string): Ledger {
  const byTask = new Map<string, LedgerEntry>();
  const aggregate = ledgerPath(repo);
  if (fs.existsSync(aggregate)) {
    for (const entry of LedgerSchema.parse(readJson(aggregate)).entries) byTask.set(entry.taskId, entry);
  }
  const dir = ledgerEntryDir(repo);
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir).sort()) {
      if (!name.endsWith('.json')) continue;
      const entry = LedgerEntrySchema.parse(readJson(path.join(dir, name)));
      byTask.set(entry.taskId, entry);
    }
  }
  const entries = [...byTask.values()].sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
  return { version: 1, entries };
}

export function saveLedger(repo: string, ledger: Ledger): void {
  writeJson(ledgerPath(repo), LedgerSchema.parse(ledger));
}

/**
 * Persists exactly ONE task's entry, atomically, touching no other task's record.
 *
 * This is the only write the scheduler performs during a pass.
 */
export function writeLedgerEntry(repo: string, entry: LedgerEntry): LedgerEntry {
  const parsed = LedgerEntrySchema.parse(entry);
  writeJson(ledgerEntryPath(repo, parsed.taskId), parsed);
  return parsed;
}

/** Removes one task's record from both the per-task file and the aggregate view. */
export function clearLedgerEntry(repo: string, taskId: string): void {
  const file = ledgerEntryPath(repo, taskId);
  if (fs.existsSync(file)) fs.rmSync(file);
  const aggregate = ledgerPath(repo);
  if (!fs.existsSync(aggregate)) return;
  const current = LedgerSchema.parse(readJson(aggregate));
  if (!current.entries.some((e) => e.taskId === taskId)) return;
  saveLedger(repo, withoutEntry(current, taskId));
}

export function findEntry(ledger: Ledger, taskId: string): LedgerEntry | null {
  return ledger.entries.find((e) => e.taskId === taskId) ?? null;
}

/** Pure upsert, ordered by task id so the persisted file is stable across restarts. */
export function withEntry(ledger: Ledger, entry: LedgerEntry): Ledger {
  const entries = ledger.entries.filter((e) => e.taskId !== entry.taskId).concat(LedgerEntrySchema.parse(entry));
  entries.sort((a, b) => (a.taskId < b.taskId ? -1 : a.taskId > b.taskId ? 1 : 0));
  return { version: 1, entries };
}

export function withoutEntry(ledger: Ledger, taskId: string): Ledger {
  return { version: 1, entries: ledger.entries.filter((e) => e.taskId !== taskId) };
}

export function ledgerCompletedIds(ledger: Ledger): Set<string> {
  return new Set(ledger.entries.filter((e) => LEDGER_COMPLETED_STATUSES.includes(e.status)).map((e) => e.taskId));
}

export function ledgerOccupiedIds(ledger: Ledger): Set<string> {
  return new Set(ledger.entries.filter((e) => LEDGER_OCCUPIED_STATUSES.includes(e.status)).map((e) => e.taskId));
}
