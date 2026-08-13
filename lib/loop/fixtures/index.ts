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
import intakeCandidates from "./intake-candidates.json";
import intakeOutcomes from "./intake-outcomes.json";
import intakeOverCount from "./intake-over-count.json";
import snapshotEmpty from "./snapshot-empty.json";
import snapshot from "./snapshot.json";
import {
  validateIntakeCandidate,
  validateIntakeOutcome,
  type IntakeCandidate,
  type IntakeOutcome,
} from "../intake";
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
  intakeOutcomes,
  intakeCandidates,
  intakeOverCount,
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

/* ── V8* · Markdown-intake i fixturläge ────────────────────────────────────── */

/**
 * Inlämningsutfallen. Varje utfall går genom V8*:s validering: en fixtur som inte har den
 * verkliga kanalens form (V1:s CommandRecord respektive TaskView) faller bort i stället för att
 * renderas. Detta är ALDRIG en levande inlämning — V8 live kräver S10 + S13 (B5).
 */
export function fixtureIntakeOutcomes(): IntakeOutcome[] {
  return (RAW_FIXTURES.intakeOutcomes as unknown[]).flatMap((raw) => {
    const result = validateIntakeOutcome(raw);
    return result.ok ? [result.data] : [];
  });
}

/** Kandidatfiler för den formella klientvalideringen. Domarna beräknas av UI:t, inte av fixturen. */
export function fixtureIntakeCandidates(): IntakeCandidate[] {
  return (RAW_FIXTURES.intakeCandidates as unknown[]).flatMap((raw) => {
    const result = validateIntakeCandidate(raw);
    return result.ok ? [result.data] : [];
  });
}

/** Ett urval som överskrider antalsgränsen med exakt en fil. */
export function fixtureIntakeOverCountSelection(): IntakeCandidate[] {
  return (RAW_FIXTURES.intakeOverCount as unknown[]).flatMap((raw) => {
    const result = validateIntakeCandidate(raw);
    return result.ok ? [result.data] : [];
  });
}
