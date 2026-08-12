/**
 * V1 · SCHEMAVALIDERING.
 *
 * EXIT-KRITERIER SOM MÄTS HÄR
 *  (1) Varje event_type i backendens SEXTON familjer har en typ, och ett event med okänd typ
 *      passerar validering som "okänd" utan att kasta.
 *  (3) Ett event utan seq, event_id eller schema_version avvisas.
 *
 * NEGATIV KONTROLL: "fixtur som saknar den verkliga kanalens form men ändå går grön."
 * Motmedlet är strikta scheman: ett okänt fält är ett UPPFUNNET fält och fälls.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_ENVELOPE_COLUMNS,
  EVENT_FAMILIES,
  KNOWN_EVENT_TYPES,
  KNOWN_EVENT_TYPES_BY_FAMILY,
  LOCKED,
  OPEN_DECISIONS,
  PAYLOAD_CONTRACT,
  PAYLOAD_CONTRACT_ID,
  PAYLOAD_CONTRACT_VERSION,
  SCHEMA_SUPPORT,
  SUPPORTED_SCHEMA_MAJOR,
  TASK_LIFECYCLE,
  classifyEventType,
  isTaskLifecycle,
  schemaDegradesTail,
  schemaSupport,
  validateEvent,
  validateEvents,
  validateSnapshot,
} from "../../lib/loop/schema";
import { RAW_FIXTURES } from "../../lib/loop/fixtures";

function validEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schema_version: "1.0.0",
    event_id: "evt-0001",
    seq: 1,
    ts: "2026-01-01T00:00:00.000Z",
    run_id: "run-a",
    task_id: null,
    attempt_id: null,
    event_type: "run.started",
    payload: {},
    evidence_refs: [],
    ...overrides,
  };
}

/* ── (1) Sexton familjer ───────────────────────────────────────────────────── */

test("V1(1): exakt sexton eventfamiljer, var och en med minst en känd typ", () => {
  assert.equal(EVENT_FAMILIES.length, 16);
  for (const family of EVENT_FAMILIES) {
    const types = KNOWN_EVENT_TYPES_BY_FAMILY[family];
    assert.ok(types.length > 0, `familjen ${family} saknar känd typ`);
    for (const type of types) {
      assert.equal(classifyEventType(type).family, family);
      assert.equal(classifyEventType(type).known, true);
    }
  }
});

test("V1(1): varje känd event_type validerar och klassificeras som känd", () => {
  for (const eventType of KNOWN_EVENT_TYPES) {
    const result = validateEvent(validEvent({ event_type: eventType }));
    assert.equal(result.ok, true, `${eventType} avvisades`);
    if (result.ok) {
      assert.equal(result.data.classification.kind, "known");
      assert.equal(result.data.classification.raw_type, eventType);
    }
  }
});

test("V1(1): okänd event_type passerar som okänd — kastar aldrig, får ingen semantik", () => {
  const unknownFamily = validateEvent(validEvent({ event_type: "kvantfluktuation.uppstod" }));
  assert.equal(unknownFamily.ok, true);
  if (unknownFamily.ok) {
    assert.equal(unknownFamily.data.classification.kind, "unknown_family");
    assert.equal(unknownFamily.data.classification.family, null);
    assert.equal(unknownFamily.data.classification.known, false);
    // Rå typ bevaras oförändrad.
    assert.equal(unknownFamily.data.event.event_type, "kvantfluktuation.uppstod");
  }

  // Känd familj, okänd typ (t.ex. B2:s liveness vars exakta namn S5 låser).
  const unknownType = validateEvent(validEvent({ event_type: "run.heartbeat" }));
  assert.equal(unknownType.ok, true);
  if (unknownType.ok) {
    assert.equal(unknownType.data.classification.kind, "unknown_type_in_known_family");
    assert.equal(unknownType.data.classification.family, "run");
    assert.equal(unknownType.data.classification.known, false);
  }
});

test("okänd typ kastar inte ens vid grovt skräp i event_type", () => {
  for (const eventType of [".", "..", "utan-punkt", "RUN.STARTED", "run.", "🙂.x"]) {
    assert.doesNotThrow(() => validateEvent(validEvent({ event_type: eventType })));
  }
});

/* ── (3) Obligatoriska envelope-fält ───────────────────────────────────────── */

test("V1(3): event utan seq, event_id eller schema_version avvisas", () => {
  for (const field of ["seq", "event_id", "schema_version"]) {
    const broken = validEvent();
    delete broken[field];
    const result = validateEvent(broken);
    assert.equal(result.ok, false, `${field} saknades men eventet godkändes`);
    if (!result.ok) assert.equal(result.reason, "invalid-event");
  }
});

test("V1(3): seq måste vara ett icke-negativt heltal, aldrig en sträng", () => {
  for (const seq of ["1", 1.5, -1, null, Number.NaN]) {
    assert.equal(validateEvent(validEvent({ seq })).ok, false, `seq=${String(seq)} godkändes`);
  }
  assert.equal(validateEvent(validEvent({ seq: 0 })).ok, true);
});

test("schema_version måste vara major.minor.patch", () => {
  for (const version of ["1", "1.0", "v1.0.0", "", "1.0.0-beta"]) {
    assert.equal(validateEvent(validEvent({ schema_version: version })).ok, false);
  }
});

test("NEG: ett uppfunnet fält fälls — strikt schema, ingen tyst passage", () => {
  const withInventedField = validEvent({ tokens_used: 4211 });
  const result = validateEvent(withInventedField);
  assert.equal(result.ok, false, "uppfunnet fält gick igenom valideringen");
});

test("V1-R-02: kontraktskolumnerna är exakt tio och härledda ur schemat", () => {
  assert.deepEqual(EVENT_ENVELOPE_COLUMNS, [
    "schema_version",
    "event_id",
    "seq",
    "ts",
    "run_id",
    "task_id",
    "attempt_id",
    "event_type",
    "payload",
    "evidence_refs",
  ]);
  // Transportkolumnen får aldrig smyga in i projektionen V4 selectar.
  assert.equal(EVENT_ENVELOPE_COLUMNS.includes("ingested_at" as never), false);
});

test("V1-R-02: en rå tabellrad med ingested_at FÄLLS — V4 måste projicera explicit", () => {
  // Dokumenterar fällan skarpt: select("*") mot loop_events ger en rad som inte validerar.
  const rawRow = { ...validEvent(), ingested_at: "2026-01-01T00:00:00.000Z" };
  assert.equal(validateEvent(rawRow).ok, false);

  // Projektionen enligt EVENT_ENVELOPE_COLUMNS validerar däremot grönt.
  const projected = Object.fromEntries(
    EVENT_ENVELOPE_COLUMNS.map((column) => [column, rawRow[column as keyof typeof rawRow]]),
  );
  assert.equal(validateEvent(projected).ok, true);
});

test("V1-R-02: ogiltiga rader TYSTAS aldrig — validateEvents rapporterar dem med index", () => {
  const batch = [validEvent(), { ...validEvent({ event_id: "evt-0002" }), ingested_at: "x" }, validEvent({ event_id: "evt-0003", seq: 3 })];
  const { valid, invalid } = validateEvents(batch);
  assert.equal(valid.length, 2);
  assert.equal(invalid.length, 1);
  assert.equal(invalid[0].index, 1);
  assert.ok(invalid[0].message.length > 0, "avvisningen måste bära en orsak");
});

test("V1-REV-02: validateEvents KASTAR ALDRIG på icke-lista — den degraderar", () => {
  // Transporten kan svara med en felkropp, ett objekt eller null i stället för en lista.
  for (const notAList of [null, undefined, {}, "[]", 42, { error: "boom" }, true]) {
    assert.doesNotThrow(() => validateEvents(notAList));
    const { valid, invalid } = validateEvents(notAList);
    assert.deepEqual(valid, []);
    assert.equal(invalid.length, 1);
    assert.match(invalid[0].message, /förväntade en lista av event/);
  }
});

test("V1-REV-02: en tom lista är giltig och rapporterar ingenting som fel", () => {
  assert.deepEqual(validateEvents([]), { valid: [], invalid: [] });
});

test("V1-REV-03: strikthetsvalen är REGISTRERADE, inte ärvda av slentrian", () => {
  const ids = OPEN_DECISIONS.map((decision) => decision.id);
  assert.deepEqual([...ids], ["STRICT_EVENT_ENVELOPE", "STRICT_SNAPSHOT"]);

  const snapshotDecision = OPEN_DECISIONS.find((d) => d.id === "STRICT_SNAPSHOT");
  assert.ok(snapshotDecision);
  assert.match(snapshotDecision.revisit_in, /V3|V4/);
  assert.match(snapshotDecision.depends_on, /S13/);
});

test("V1-REV-03: en avvisad snapshot bär en ORSAK — aldrig en tyst tom vy", () => {
  // Ett tillagt minor-fält avvisar i dag hela snapshoten. Det får synas, inte tystna.
  const withFutureField = { ...RAW_FIXTURES.snapshot, nytt_falt_fran_s13: true };
  const result = validateSnapshot(withFutureField);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "invalid-snapshot");
    assert.ok(result.message.length > 0, "avvisandet måste bära en läsbar orsak");
  }
});

test("payload är opak: B4-kontraktet är OLÖST och inga fält uppfinns", () => {
  assert.equal(PAYLOAD_CONTRACT.status, "UNRESOLVED");
  assert.equal(PAYLOAD_CONTRACT.id, null);
  assert.equal(PAYLOAD_CONTRACT.version, null);

  // Godtycklig payload accepteras rått; den tolkas inte och får inga namngivna fält.
  const result = validateEvent(validEvent({ payload: { vad_som_helst: [1, 2, 3] } }));
  assert.equal(result.ok, true);
});

/* ── Schemaversion: nyare major flaggas, avvisas aldrig ────────────────────── */

test("nyare major flaggas som ahead_major men avvisas ALDRIG", () => {
  const result = validateEvent(validEvent({ schema_version: `${SUPPORTED_SCHEMA_MAJOR + 1}.0.0` }));
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.data.schema_support, "ahead_major");

  assert.equal(schemaSupport(`${SUPPORTED_SCHEMA_MAJOR}.7.3`), "supported");
  assert.equal(schemaSupport("0.9.9"), "behind_major");
});

test("V1-R1: en oläsbar version rapporteras ALDRIG som supported", () => {
  for (const version of ["abc", "", "x.y.z", "v1.0.0", ".", "NaN.0.0", "1e3.0.0", "-1.0.0"]) {
    const support = schemaSupport(version);
    assert.notEqual(support, "supported", `"${version}" rapporterades som supported`);
    assert.equal(support, "unknown", `"${version}" borde klassas som unknown`);
  }
});

test("V1-R1: unknown degraderar tail exakt som ahead_major — banner, ingen fashärledning", () => {
  assert.equal(schemaDegradesTail("unknown"), true);
  assert.equal(schemaDegradesTail("ahead_major"), true);
  // Ett äldre schema är läsbart; endast okänt och nyare stoppar tailens fashärledning.
  assert.equal(schemaDegradesTail("supported"), false);
  assert.equal(schemaDegradesTail("behind_major"), false);
});

test("V1-R1: SCHEMA_SUPPORT bär det explicita unknown-läget", () => {
  assert.deepEqual([...SCHEMA_SUPPORT], ["supported", "ahead_major", "behind_major", "unknown"]);
});

test("V1-R2: PAYLOAD_CONTRACT_ID och PAYLOAD_CONTRACT_VERSION bärs under planens namn", () => {
  // B4 kräver namnen ordagrant. Båda är null tills S5 publicerat sin kontraktsidentitet.
  assert.equal(PAYLOAD_CONTRACT_ID, null);
  assert.equal(PAYLOAD_CONTRACT_VERSION, null);
  assert.equal(PAYLOAD_CONTRACT_ID, PAYLOAD_CONTRACT.id);
  assert.equal(PAYLOAD_CONTRACT_VERSION, PAYLOAD_CONTRACT.version);
});

/* ── Vokabulär ─────────────────────────────────────────────────────────────── */

test("TASK_LIFECYCLE är backendens elva tillstånd — inte uppdragets lista", () => {
  assert.deepEqual([...TASK_LIFECYCLE], [
    "RAW",
    "PLANNING",
    "NEEDS_SPEC",
    "READY",
    "QUEUED",
    "WORKING",
    "VERIFYING",
    "REVIEWING",
    "MERGING",
    "DONE",
    "STOPPED",
  ]);
  assert.equal(isTaskLifecycle("STOPPED"), true);
});

test("VERIFYING_SPEC, UPLOADED och ANALYZING är INTE task-tillstånd", () => {
  for (const invented of ["VERIFYING_SPEC", "UPLOADED", "ANALYZING"]) {
    assert.equal(isTaskLifecycle(invented), false);
  }
});

test("låsta ordnings- och authority-värden står kvar", () => {
  assert.equal(LOCKED.ORDERING_KEY, "seq");
  assert.equal(LOCKED.DEDUP_KEY, "event_id");
  assert.equal(LOCKED.EVENT_SEQ_RESETS_PER_RUN, false);
  assert.equal(LOCKED.SNAPSHOT_WINS, true);
  assert.equal(LOCKED.EVENT_STREAM_IS_AUTHORITY, false);
});

/* ── Snapshot ──────────────────────────────────────────────────────────────── */

test("snapshotfixturen validerar och bär alla elva tillstånd", () => {
  const result = validateSnapshot(RAW_FIXTURES.snapshot);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const states = new Set(
    [
      ...result.data.backlog,
      ...result.data.completed,
      ...(result.data.current_task ? [result.data.current_task] : []),
    ].map((task) => task.state),
  );
  for (const state of TASK_LIFECYCLE) {
    assert.ok(states.has(state), `tillståndet ${state} saknas i snapshotfixturen`);
  }
});

test("snapshot avvisas om ett tillstånd inte finns i backendens vokabulär", () => {
  const snapshot = JSON.parse(JSON.stringify(RAW_FIXTURES.snapshot)) as {
    backlog: { state: string }[];
  };
  snapshot.backlog[0].state = "VERIFYING_SPEC";
  const result = validateSnapshot(snapshot);
  assert.equal(result.ok, false);
});

test("OLÖSTA kontrakt renderas som null (—), aldrig som ett påhittat enumvärde", () => {
  const result = validateSnapshot(RAW_FIXTURES.snapshot);
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.data.run.state, null);
  assert.equal(result.data.run.breaker, null);
  assert.equal(result.data.run.budget, null);
  for (const task of result.data.backlog) {
    assert.equal(task.merge, null);
    assert.equal(task.promotion, null);
    assert.equal(task.builder.agent, null);
    assert.equal(task.risk_class, null);
  }
});

test("tom snapshot validerar: nollor uppfinns aldrig, allt saknat är null", () => {
  const result = validateSnapshot(RAW_FIXTURES.snapshotEmpty);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.current_task, null);
  assert.equal(result.data.current_main.sha, null);
  assert.deepEqual(result.data.backlog, []);
});

test("TaskView har INGET fält för procent, tokens eller kostnad (B6)", () => {
  const snapshot = JSON.parse(JSON.stringify(RAW_FIXTURES.snapshot)) as {
    backlog: Record<string, unknown>[];
  };
  snapshot.backlog[0].progress_percent = 42;
  assert.equal(validateSnapshot(snapshot).ok, false);

  const withCost = JSON.parse(JSON.stringify(RAW_FIXTURES.snapshot)) as {
    backlog: Record<string, unknown>[];
  };
  withCost.backlog[0].cost_usd = 1.5;
  assert.equal(validateSnapshot(withCost).ok, false);
});
