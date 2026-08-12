/**
 * V1 · Typad ingång till de GENERERADE fixturerna.
 *
 * Filerna här är produkter av lib/loop/fixtures/generate.ts. De handredigeras aldrig —
 * tests/loop/fixtures.test.ts regenererar och jämför byte för byte.
 *
 * BINDANDE: en fixtur är INTE den verkliga kanalen. Ingen skiva får kallas live-komplett
 * mot den här katalogen. V4 och framåt kräver nortropic-system S5 respektive S13.
 */
import commands from "./commands.json";
import eventsAscendingTs from "./events-ascending-ts.json";
import eventsBackwardsTs from "./events-backwards-ts.json";
import eventsUnknown from "./events-unknown.json";
import events from "./events.json";
import snapshotEmpty from "./snapshot-empty.json";
import snapshot from "./snapshot.json";
import {
  validateCommand,
  validateEvents,
  validateSnapshot,
  type Command,
  type LoopSnapshot,
  type ValidatedEvent,
} from "../schema";

/** Rådata precis som de ligger på disk. Otypade med flit — de ska gå genom validering. */
export const RAW_FIXTURES = {
  events,
  eventsBackwardsTs,
  eventsAscendingTs,
  eventsUnknown,
  snapshot,
  snapshotEmpty,
  commands,
} as const;

/** Fixturer är ALDRIG live-data. Konstanten finns för att vyer ska kunna märka läget. */
export const FIXTURE_MODE = true;

export function fixtureEvents(): ValidatedEvent[] {
  const { valid } = validateEvents(RAW_FIXTURES.events);
  return valid;
}

export function fixtureUnknownEvents(): ValidatedEvent[] {
  const { valid } = validateEvents(RAW_FIXTURES.eventsUnknown);
  return valid;
}

export function fixtureBackwardsTsEvents(): ValidatedEvent[] {
  const { valid } = validateEvents(RAW_FIXTURES.eventsBackwardsTs);
  return valid;
}

export function fixtureAscendingTsEvents(): ValidatedEvent[] {
  const { valid } = validateEvents(RAW_FIXTURES.eventsAscendingTs);
  return valid;
}

/** Returnerar envelope, aldrig kast — samma mönster som lib/github-read.ts. */
export function fixtureSnapshot(): LoopSnapshot | null {
  const result = validateSnapshot(RAW_FIXTURES.snapshot);
  return result.ok ? result.data : null;
}

export function fixtureEmptySnapshot(): LoopSnapshot | null {
  const result = validateSnapshot(RAW_FIXTURES.snapshotEmpty);
  return result.ok ? result.data : null;
}

export function fixtureCommands(): Command[] {
  const parsed = (RAW_FIXTURES.commands as unknown[]).map((raw) => validateCommand(raw));
  return parsed.flatMap((result) => (result.ok ? [result.data] : []));
}
