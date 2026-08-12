/**
 * V1 · FIXTURGENERATOR.
 *
 * FIXTURREGELN (planens viktigaste i detta repo): fixturer GENERERAS ur lib/loop/schema.ts,
 * de handskrivs aldrig. Ett prov (tests/loop/fixtures.test.ts) regenererar och jämför byte för
 * byte — en handredigerad fixtur som avviker från schemat fälls.
 *
 * ÄRLIGHETSREGLER SOM GENERATORN LYDER
 * ------------------------------------
 * · payload = {} för ALLA event. B4:s canonical payload-kontrakt per event_type ägs av
 *   backendens S5 och finns inte vid NORTROPIC_PLAN_COMMIT. Att fylla payload med påhittade
 *   fält vore precis den negativa kontrollen V1 ska fälla ("fixtur utan den verkliga kanalens
 *   form som ändå går grön").
 * · OLÖSTA kontrakt (run.state, run.breaker, run.budget, TaskView.merge, TaskView.promotion)
 *   sätts till null → renderas "—". Ett påhittat enumvärde vore ett uppfunnet backendfält.
 * · `seq` är globalt monoton över butiken och delas av två interfolierande runs — det är den
 *   verkliga kanalens form (B3), inte en per-run-räknare.
 * · `ts` går BAKÅT i events-backwards-ts.json. Läsordningen ska ändå bli identisk med den
 *   stigande varianten; det fäller ts-baserad sortering.
 *
 * Körs med: npm run loop:fixtures
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  COMMAND_VERBS,
  KNOWN_EVENT_TYPES,
  TASK_LIFECYCLE,
  type Command,
  type LoopEvent,
  type LoopSnapshot,
  type TaskLifecycle,
  type TaskView,
} from "../schema";

/** Allt härleds ur dessa konstanter — ingen klocka, ingen slump, ingen miljö. */
const FIXTURE_SCHEMA_VERSION = "1.0.0";
const BASE_TS_MS = Date.parse("2026-01-01T00:00:00.000Z");
const STEP_MS = 1_000;
const RUNS = ["run-fixture-a", "run-fixture-b"] as const;
const BACKWARDS_EVENT_COUNT = 100;

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** Deterministisk sha256 ur en etikett. Riktig hash, inget påhittat hex. */
function sha256(label: string): string {
  return createHash("sha256").update(label).digest("hex");
}

/**
 * FULL Git-objektidentitet (40 hex), aldrig förkortad. Förkortning är en VYFRÅGA och görs i
 * V2/V5 — en fixtur som redan är kapad hade dolt ett trunkerings- eller layoutfel i de vyerna,
 * och hade dessutom gett en annan rigor än source.sha256 (64 hex) utan skäl i planen.
 */
function gitSha(label: string): string {
  return sha256(label).slice(0, 40);
}

/* ── Event ─────────────────────────────────────────────────────────────────── */

/** Ett event per KÄND event_type, seq 1..N, två interfolierande runs. */
export function buildKnownEventFixtures(): LoopEvent[] {
  return KNOWN_EVENT_TYPES.map((eventType, index) => {
    const seq = index + 1;
    const runIndex = index % RUNS.length;
    return {
      schema_version: FIXTURE_SCHEMA_VERSION,
      event_id: `evt-${String(seq).padStart(4, "0")}`,
      seq,
      ts: iso(BASE_TS_MS + index * STEP_MS),
      run_id: RUNS[runIndex],
      task_id: `p-${String(100 + runIndex)}`,
      attempt_id: index % 3 === 0 ? null : `a-${String(seq).padStart(4, "0")}`,
      event_type: eventType,
      // B4 OLÖST → tom payload. Aldrig uppfunna fält.
      payload: {},
      // Opaka referenser, aldrig innehåll. Vartannat event saknar evidence → "—" i UI:t.
      evidence_refs: index % 2 === 0 ? [] : [`evidence-ref-${String(seq).padStart(4, "0")}`],
    };
  });
}

/**
 * Hundra event med STIGANDE seq och BAKÅTGÅENDE ts. Ordningsprovet (V1 exit 4) kräver att
 * läsordningen blir identisk med den stigande varianten nedan.
 */
export function buildBackwardsTsEventFixtures(): LoopEvent[] {
  return Array.from({ length: BACKWARDS_EVENT_COUNT }, (_unused, index) => {
    const seq = index + 1;
    const runIndex = index % RUNS.length;
    return {
      schema_version: FIXTURE_SCHEMA_VERSION,
      event_id: `evt-back-${String(seq).padStart(4, "0")}`,
      seq,
      // Klockan går bakåt: högre seq = tidigare ts.
      ts: iso(BASE_TS_MS + (BACKWARDS_EVENT_COUNT - index) * STEP_MS),
      run_id: RUNS[runIndex],
      task_id: null,
      attempt_id: null,
      event_type: KNOWN_EVENT_TYPES[index % KNOWN_EVENT_TYPES.length],
      payload: {},
      evidence_refs: [],
    };
  });
}

/** Samma event, samma seq, men STIGANDE ts. Endast ts skiljer de två filerna åt. */
export function buildAscendingTsEventFixtures(): LoopEvent[] {
  return buildBackwardsTsEventFixtures().map((event, index) => ({
    ...event,
    event_id: `evt-fwd-${String(index + 1).padStart(4, "0")}`,
    ts: iso(BASE_TS_MS + index * STEP_MS),
  }));
}

/**
 * Event som detta bygge INTE känner igen. De ska passera validering, bevaras rått,
 * sakna semantik och aldrig flytta state. En nyare controller får emittera sådana.
 */
export function buildUnknownEventFixtures(): LoopEvent[] {
  const base = {
    schema_version: FIXTURE_SCHEMA_VERSION,
    run_id: RUNS[0],
    task_id: null,
    attempt_id: null,
    payload: {},
    evidence_refs: [],
  };
  return [
    {
      ...base,
      event_id: "evt-unknown-0001",
      seq: 9001,
      ts: iso(BASE_TS_MS + 9001 * STEP_MS),
      // Okänd familj helt utanför de sexton.
      event_type: "kvantfluktuation.uppstod",
    },
    {
      ...base,
      event_id: "evt-unknown-0002",
      seq: 9002,
      ts: iso(BASE_TS_MS + 9002 * STEP_MS),
      // Känd familj, okänd typ inom den (t.ex. B2:s liveness vars namn S5 låser).
      event_type: "run.heartbeat",
    },
    {
      ...base,
      event_id: "evt-unknown-0003",
      seq: 9003,
      ts: iso(BASE_TS_MS + 9003 * STEP_MS),
      // Nyare major: banner i UI:t, aldrig krasch, aldrig avvisning.
      schema_version: "2.0.0",
      event_type: "run.started",
    },
  ];
}

/* ── Snapshot ──────────────────────────────────────────────────────────────── */

function buildTask(state: TaskLifecycle, index: number): TaskView {
  const taskId = `p-${String(200 + index)}`;
  const hasCandidate = state === "REVIEWING" || state === "MERGING" || state === "DONE";
  return {
    task_id: taskId,
    title: `Fixturuppgift ${taskId}`,
    state,
    source: {
      source_id: `src-${String(index).padStart(3, "0")}`,
      sha256: sha256(`source:${taskId}`),
      locator: index % 2 === 0 ? `backlog-aug.md` : null,
    },
    attempt: { n: state === "RAW" || state === "PLANNING" ? null : 1, budget: null },
    phase: state === "WORKING" ? "BUILD" : null,
    // B4 OLÖST → builder/modell är "—".
    builder: { agent: null, model: null },
    // S10 OLÖST → riskklass är "—".
    risk_class: null,
    base_sha: state === "RAW" ? null : gitSha(`base:${taskId}`),
    candidate_sha: hasCandidate ? gitSha(`candidate:${taskId}`) : null,
    first_seen_ts: iso(BASE_TS_MS + index * STEP_MS),
    policy: state === "DONE" ? "PASS" : "NOT_RUN",
    verification: state === "DONE" ? "PASS" : "NOT_RUN",
    task_gate: {
      verdict: state === "DONE" ? "PASS" : "NOT_RUN",
      grind_id: state === "DONE" ? `grind-${String(index).padStart(3, "0")}` : null,
      // Endast identitet. Grindens innehåll når ALDRIG en fixtur och aldrig DOM.
      grind_sha256: state === "DONE" ? sha256(`grind:${taskId}`) : null,
    },
    evaluation: { required: null, verdict: "NOT_RUN", findings: null },
    attestation: state === "DONE" ? { exists: true, promotion_eligible: true } : null,
    // S8 + B7 OLÖST → null, renderas "—". Ett påhittat mergeobjekt vore ett uppfunnet kontrakt.
    merge: null,
    // S7 OLÖST (promotion-state-enumen) → null, renderas "—".
    promotion: null,
    evidence_refs: state === "DONE" ? [`evidence-ref-task-${taskId}`] : [],
  };
}

/** En snapshot där ALLA elva TASK_LIFECYCLE-tillstånd förekommer minst en gång. */
export function buildSnapshotFixture(): LoopSnapshot {
  const tasks = TASK_LIFECYCLE.map((state, index) => buildTask(state, index));
  const current = tasks.find((task) => task.state === "WORKING") ?? null;
  return {
    schema_version: FIXTURE_SCHEMA_VERSION,
    run_id: RUNS[0],
    // Watermarken ligger på det sista kända eventet — tail ovanför den är provisorisk.
    seq_watermark: KNOWN_EVENT_TYPES.length,
    published_ts: iso(BASE_TS_MS + KNOWN_EVENT_TYPES.length * STEP_MS),
    run: {
      // OLÖSTA kontrakt (S5) → null, aldrig ett påhittat enumvärde.
      state: null,
      breaker: null,
      budget: null,
    },
    current_main: {
      // Controllerns BEKRÄFTADE värde. Aldrig uppslaget av Verkstadsgolvet.
      sha: gitSha("main:fixture"),
      confirmed_ts: iso(BASE_TS_MS + KNOWN_EVENT_TYPES.length * STEP_MS),
    },
    current_task: current,
    backlog: tasks.filter((task) => task.state !== "DONE" && task !== current),
    completed: tasks.filter((task) => task.state === "DONE"),
  };
}

/**
 * En snapshot UTAN någon run-state alls: transporten svarar, men controllern har inte
 * publicerat något ännu. Varje null ska renderas "—", aldrig 0 och aldrig tomt.
 */
export function buildEmptySnapshotFixture(): LoopSnapshot {
  return {
    schema_version: FIXTURE_SCHEMA_VERSION,
    run_id: RUNS[1],
    seq_watermark: 0,
    published_ts: iso(BASE_TS_MS),
    run: { state: null, breaker: null, budget: null },
    current_main: { sha: null, confirmed_ts: null },
    current_task: null,
    backlog: [],
    completed: [],
  };
}

/* ── Kommandon ─────────────────────────────────────────────────────────────── */

/**
 * Bindning mellan fixturerna och schemats verbenum. Kastar om täckningen inte är EXAKT —
 * ett sjätte verb i schema.ts (eller ett borttaget) stoppar därmed fixturgenereringen i
 * stället för att tyst producera en fixtur som inte längre speglar kontraktet.
 */
export function assertCoversEveryVerb(commands: readonly Command[]): void {
  const covered = [...new Set(commands.map((command) => command.verb))].sort();
  const expected = [...COMMAND_VERBS].sort();
  if (covered.length !== expected.length || covered.some((verb, i) => verb !== expected[i])) {
    throw new Error(
      `kommandofixturerna täcker inte COMMAND_SCHEMA_PLAN exakt: [${covered.join(", ")}] ` +
        `mot förväntat [${expected.join(", ")}]`,
    );
  }
}

/** Ett giltigt kommando per verb. Exakt fem — ett sjätte finns inte att generera. */
export function buildCommandFixtures(): Command[] {
  const commands: Command[] = [
    {
      verb: "intake.submit",
      payload: {
        // OPAK transportreferens (B5). Formen ägs av S10/S13 och uppfinns inte här.
        source_ref: "source-ref-fixture-0001",
        // PÅSTÅENDE. Controllern räknar om och avvisar vid avvikelse.
        source_sha256: sha256("intake:fixture"),
      },
    },
    { verb: "run.start", payload: { config_ref: "config-ref-fixture-0001" } },
    { verb: "run.pause_at_safe_boundary", payload: { run_id: RUNS[0] } },
    { verb: "run.resume", payload: { run_id: RUNS[0] } },
    { verb: "inspect", payload: { task_id: "p-200" } },
  ];
  assertCoversEveryVerb(commands);
  return commands;
}

/* ── Filer ─────────────────────────────────────────────────────────────────── */

export const FIXTURE_FILES = {
  "events.json": buildKnownEventFixtures,
  "events-backwards-ts.json": buildBackwardsTsEventFixtures,
  "events-ascending-ts.json": buildAscendingTsEventFixtures,
  "events-unknown.json": buildUnknownEventFixtures,
  "snapshot.json": buildSnapshotFixture,
  "snapshot-empty.json": buildEmptySnapshotFixture,
  "commands.json": buildCommandFixtures,
} as const;

export type FixtureFileName = keyof typeof FIXTURE_FILES;

/** Kanonisk serialisering. Provet jämför byte för byte mot filerna på disk. */
export function serializeFixture(name: FixtureFileName): string {
  return `${JSON.stringify(FIXTURE_FILES[name](), null, 2)}\n`;
}

/**
 * Katalogen en modul-URL pekar ut. `fileURLToPath` — ALDRIG `new URL(...).pathname`, som
 * lämnar procentkodning kvar när stigen bär mellanslag eller icke-ASCII (vanligt i macOS-hem)
 * och som dessutom ger fel form på Windows. Generatorn ska fungera på ägarens checkout, inte
 * bara på en stig utan specialtecken. Exporterad så provet kan pröva just den härledningen
 * mot en syntetisk URL — annars hade felet varit osynligt på en stig utan specialtecken.
 */
export function moduleDir(moduleUrl: string): string {
  return path.dirname(fileURLToPath(moduleUrl));
}

const SELF_PATH = fileURLToPath(import.meta.url);
export const FIXTURE_DIR = moduleDir(import.meta.url);

export function fixtureFileNames(): FixtureFileName[] {
  return Object.keys(FIXTURE_FILES) as FixtureFileName[];
}

export function writeFixtures(dir: string = FIXTURE_DIR): FixtureFileName[] {
  const names = fixtureFileNames();
  for (const name of names) {
    writeFileSync(path.join(dir, name), serializeFixture(name), "utf8");
  }
  return names;
}

export type FixtureVerdict = {
  name: FixtureFileName;
  /** true = filen på disk är byte-identisk med generatorns utdata. */
  matches: boolean;
  /** Varför den inte matchar: handredigerad, saknad eller oläsbar. */
  reason: "match" | "byte-mismatch" | "missing";
};

/**
 * ENFORCEMENT-VÄGEN för V1(2): läser fixturerna från disk och jämför byte för byte mot
 * generatorn. En handredigerad, saknad eller trunkerad fil faller här. Provet kör denna
 * funktion både mot repots riktiga katalog och mot en medvetet handredigerad kopia.
 */
export function verifyFixtures(dir: string = FIXTURE_DIR): FixtureVerdict[] {
  return fixtureFileNames().map((name) => {
    let onDisk: string;
    try {
      onDisk = readFileSync(path.join(dir, name), "utf8");
    } catch {
      return { name, matches: false, reason: "missing" };
    }
    const matches = onDisk === serializeFixture(name);
    return { name, matches, reason: matches ? "match" : "byte-mismatch" };
  });
}

/**
 * Skriver bara när filen körs som entrypoint (npm run loop:fixtures). Jämförelsen görs på
 * upplösta absoluta stigar — inte på en suffixsträng — så den är korrekt oavsett hur
 * kommandot skrevs och oavsett specialtecken i repostigen.
 */
const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
const invokedDirectly = entryPath !== null && entryPath === SELF_PATH;
if (invokedDirectly) {
  const written = writeFixtures();
  process.stdout.write(`skrev ${written.length} fixturer till ${FIXTURE_DIR}\n`);
}
