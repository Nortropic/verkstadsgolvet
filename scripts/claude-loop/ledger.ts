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

export function ledgerPath(repo: string): string {
  return path.join(autopilotDir(repo), 'ledger.json');
}

export function loadLedger(repo: string): Ledger {
  const file = ledgerPath(repo);
  if (!fs.existsSync(file)) return { version: 1, entries: [] };
  return LedgerSchema.parse(readJson(file));
}

export function saveLedger(repo: string, ledger: Ledger): void {
  writeJson(ledgerPath(repo), LedgerSchema.parse(ledger));
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
