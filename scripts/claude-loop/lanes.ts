import fs from 'node:fs';
import path from 'node:path';

/**
 * Workflow lanes.
 *
 * A lane is a WORKFLOW isolation of one Claude session: which settings the session may load, which
 * system prompt governs it and which repository paths its writes may cover. A lane is never a
 * security boundary and never Nortropic Trust Kernel authority; the supervisor still derives every
 * fact (changed files, candidate identity, gate outcome) mechanically from Git and from processes.
 *
 * `ordinary`     — the normal product lane. Project settings (`.claude/**`) apply.
 * `owner-author` — the explicitly supervisor-selected owner-authority lane. It is the ONLY lane
 *                  allowed to author protected workflow-authority files, and it is deliberately
 *                  isolated from project settings so a protected-path edit can never be granted by
 *                  a file the same lane is allowed to rewrite.
 */
export type Lane = 'ordinary' | 'owner-author';

export const LANES: readonly Lane[] = ['ordinary', 'owner-author'];

/** `settingSources` for the ordinary lane: exactly the project sources, unchanged from v1. */
export const ORDINARY_SETTING_SOURCES: readonly string[] = ['project'];

/**
 * `settingSources` for the owner-author lane: EXACTLY the empty list.
 *
 * Claude Agent SDK 0.3.228 loads no filesystem settings when `settingSources` is `[]`. The
 * owner-author lane therefore cannot inherit `.claude/settings.json`, `.claude/agents/**` or any
 * user/local settings; it runs only under the dedicated lane settings file and lane system prompt
 * below. Both live under `scripts/claude-loop/owner-author/**`, which is a supervisor-owned,
 * tracked path — never a path the lane grants itself at runtime.
 */
export const OWNER_AUTHOR_SETTING_SOURCES: readonly string[] = [];

export const OWNER_AUTHOR_DIR = 'scripts/claude-loop/owner-author';
export const OWNER_AUTHOR_SETTINGS_FILE = `${OWNER_AUTHOR_DIR}/settings.json`;
export const OWNER_AUTHOR_SYSTEM_PROMPT_FILE = `${OWNER_AUTHOR_DIR}/system-prompt.md`;

/** Marker that must be present in the lane system prompt; a foreign/empty file fails closed. */
export const OWNER_AUTHOR_SYSTEM_PROMPT_MARKER = 'OWNER_AUTHOR_LANE=WORKFLOW_AUTHORITY_ONLY';

export function ownerAuthorSettingsPath(root: string): string {
  return path.join(root, OWNER_AUTHOR_SETTINGS_FILE);
}

export function ownerAuthorSystemPromptPath(root: string): string {
  return path.join(root, OWNER_AUTHOR_SYSTEM_PROMPT_FILE);
}

/** Reads the dedicated lane system prompt. Missing marker or empty body is a hard failure. */
export function ownerAuthorSystemPrompt(root: string): string {
  const file = ownerAuthorSystemPromptPath(root);
  const raw = fs.readFileSync(file, 'utf8').trim();
  if (!raw) throw new Error(`owner-author lane system prompt is empty: ${file}`);
  if (!raw.includes(OWNER_AUTHOR_SYSTEM_PROMPT_MARKER)) {
    throw new Error(`owner-author lane system prompt is missing ${OWNER_AUTHOR_SYSTEM_PROMPT_MARKER}: ${file}`);
  }
  return raw;
}

export type LaneQueryOptions = {
  lane: Lane;
  settingSources: string[];
  settings?: string;
  systemPrompt?: string;
};

/**
 * The exact Claude Agent SDK option fragment for a lane.
 *
 * Pure and file-reading only: it never starts a session, so lane isolation is testable without
 * consuming model usage. The ordinary lane keeps v1 behaviour byte for byte.
 */
export function laneQueryOptions(args: { lane: Lane; root: string }): LaneQueryOptions {
  if (args.lane === 'owner-author') {
    const settings = ownerAuthorSettingsPath(args.root);
    if (!fs.existsSync(settings)) throw new Error(`owner-author lane settings file missing: ${settings}`);
    return {
      lane: 'owner-author',
      settingSources: [...OWNER_AUTHOR_SETTING_SOURCES],
      settings,
      systemPrompt: ownerAuthorSystemPrompt(args.root),
    };
  }
  return { lane: 'ordinary', settingSources: [...ORDINARY_SETTING_SOURCES] };
}
