/**
 * V3 · READ MODEL + SNAPSHOT_WINS.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V3 samt de bevis planen
 * pekar ut som V3:s (E1, E2, E3, E6, E9, E11, E13, S7t):
 *   (1) En tail-sekvens som "avslutar" en task ändrar INTE state till DONE — DONE kräver snapshot.
 *   (2) Out-of-order och dubblerad ström ger IDENTISK serialiserad read model som en perfekt
 *       ordnad unik ström.
 *   (3) Dedup sker på `event_id`, inte på `seq` — mätt med data där skillnaden är observerbar.
 *   (4) Lucka i seq detekteras och rapporteras (och en run-filtrerad vy larmar aldrig, B3).
 *   (5) Snapshot mot tail som säger olika → snapshoten är fortsatt authority.
 *   (6) `ts` är irrelevant för ordningen — mätt med bakåtgående klocka.
 *   (7) Okänd `event_type` kastar inte och flyttar ingen authority.
 *   (8) V1:s schema.ts och de GENERERADE fixturerna är källkontrakten — inget parallellt
 *       handskrivet event- eller task-vokabulär i V3:s filer.
 *   (9) INPUT-RENHET: buildReadModel muterar aldrig anroparens indata. Nästlade objekt och
 *       listor i en payload är strukturellt oförändrade OCH lika muterbara efter anropet —
 *       ingen rekursiv frysning kryper ut i anroparens buffert — medan modellen ändå är
 *       immutabel och SNAPSHOT_WINS fortsatt håller.
 *
 * PROVSTIL: varje exit-kriterium bär en LÖGNSTUB — den vanligaste genvägen — och provet mäter
 * att stuben FÄLLS av exakt samma data. Ett prov som bara mäter den riktiga implementationen
 * bevisar inte att datan kan skilja rätt från fel.
 *
 * Ingen fixtur här är livedata, och ingenting i provet gör anspråk på att V3 är live-komplett.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  EVENT_FAMILIES,
  KNOWN_EVENT_TYPES,
  LOCKED,
  PHASES,
  TASK_LIFECYCLE,
  type LoopSnapshot,
  type TaskView,
} from "../../lib/loop/schema";
import { RAW_FIXTURES, fixtureSnapshot } from "../../lib/loop/fixtures";
import {
  READ_MODEL_RULES,
  TERMINAL_SUGGESTING_EVENT_TYPES,
  TRANSIENT_PHASE_BY_FAMILY,
  projectEvents,
  stableStringify,
  type ProjectedEventRow,
} from "../../lib/loop/events";
import {
  buildReadModel,
  serializeReadModel,
  type ReadModel,
  type TaskProjection,
} from "../../lib/loop/snapshot";

/* ────────────────────────────────────────────────────────────────────────────
 * PROVDATA — allt härleds ur V1:s GENERERADE fixturer, aldrig ur handskrivna event
 * ──────────────────────────────────────────────────────────────────────────── */

type RawEvent = Record<string, unknown>;

const RAW_SNAPSHOT: unknown = RAW_FIXTURES.snapshot;
const RAW_EVENTS = RAW_FIXTURES.events as unknown as RawEvent[];
const RAW_UNKNOWN_EVENTS = RAW_FIXTURES.eventsUnknown as unknown as RawEvent[];
const RAW_BACKWARDS_TS_EVENTS = RAW_FIXTURES.eventsBackwardsTs as unknown as RawEvent[];

function snapshot(): LoopSnapshot {
  const parsed = fixtureSnapshot();
  assert.ok(parsed, "fixtursnapshoten måste validera — annars mäter provet ingenting");
  return parsed;
}

function currentTask(): TaskView {
  const current = snapshot().current_task;
  assert.ok(current, "fixturen måste ha en current_task");
  return current;
}

/** Ett fixturevent av en given KÄND typ. Kastar hellre än att tyst prova mot fel data. */
function fixtureEventOfType(eventType: string): RawEvent {
  const found = RAW_EVENTS.find((event) => event.event_type === eventType);
  assert.ok(found, `fixturen saknar ett event av typen ${eventType}`);
  return found;
}

/** Klon av ett fixturevent med patchade kuvertfält. Formen kommer alltid ur fixturen. */
function patched(event: RawEvent, patch: RawEvent): RawEvent {
  return { ...event, ...patch };
}

/** Djupkopia av fixturdata, så att ett prov aldrig kan smitta ett annat. */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * En tail-sekvens som för ett mänskligt öga "avslutar" uppgiften: attestation skriven,
 * promotion klar, konflikt löst och main flyttad — allt ovanför snapshotens watermark och
 * allt pekande på current_task.
 */
function tailThatLooksFinished(taskId: string, watermark: number): RawEvent[] {
  return [
    "attestation.created",
    "promotion.completed",
    "merge.resolution.completed",
    "main.advanced",
  ].map((eventType, index) =>
    patched(fixtureEventOfType(eventType), {
      event_id: `evt-tail-finish-${String(index + 1).padStart(4, "0")}`,
      seq: watermark + 1 + index,
      task_id: taskId,
    }),
  );
}

function taskById(model: ReadModel, taskId: string): TaskProjection {
  const found = model.tasks.find((task) => task.task_id === taskId);
  assert.ok(found, `read-modellen saknar task ${taskId}`);
  return found;
}

function eventIds(rows: readonly ProjectedEventRow[]): string[] {
  return rows.map((row) => row.event.event_id);
}

/* ── LÖGNSTUBAR ────────────────────────────────────────────────────────────── */

/** Den klassiska genvägen: folda strömmen till task state. Ska fällas av prov (1). */
function foldToStateLie(events: readonly RawEvent[]): string | null {
  let state: string | null = null;
  for (const event of events) {
    const type = String(event.event_type);
    if (type === "attestation.created" || type === "promotion.completed") state = "DONE";
  }
  return state;
}

/** Dedup på seq i stället för event_id. Ska fällas av prov (3). */
function dedupeBySeqLie(events: readonly RawEvent[]): RawEvent[] {
  const bySeq = new Map<number, RawEvent>();
  for (const event of events) {
    const seq = Number(event.seq);
    if (!bySeq.has(seq)) bySeq.set(seq, event);
  }
  return [...bySeq.values()];
}

/** Sortering på wall-clock. Ska fällas av prov (6). */
function orderByTsLie(events: readonly RawEvent[]): RawEvent[] {
  return [...events].sort((a, b) => Date.parse(String(a.ts)) - Date.parse(String(b.ts)));
}

/**
 * Den självklara genvägen till "en immutabel read model": frys rekursivt det som byggdes.
 * Ska fällas av prov (9) — den kryper ut genom de opaka kartornas nästlade referenser och
 * fryser anroparens egna objekt.
 */
function recursiveFreezeLie(value: unknown, seen: Set<object> = new Set()): void {
  if (value === null || typeof value !== "object") return;
  const node = value as object;
  if (seen.has(node)) return;
  seen.add(node);
  for (const nested of Object.values(node as Record<string, unknown>)) {
    recursiveFreezeLie(nested, seen);
  }
  Object.freeze(node);
}

/* ────────────────────────────────────────────────────────────────────────────
 * (1) S7t · TAIL SOM SÄGER "KLART" GER INTE DONE
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(1): en tail-sekvens som ser avslutad ut flyttar INTE snapshotens state till DONE", () => {
  const snap = snapshot();
  const current = currentTask();
  const tail = tailThatLooksFinished(current.task_id, snap.seq_watermark);

  // Förutsättningen provet vilar på: snapshoten säger uttryckligen INTE klart.
  assert.notEqual(current.state, "DONE");
  assert.equal(current.attestation, null);
  assert.equal(current.promotion, null);

  const model = buildReadModel({ snapshot: RAW_SNAPSHOT, events: [...RAW_EVENTS, ...tail] });
  const task = taskById(model, current.task_id);

  assert.equal(task.lifecycle_state, current.state);
  assert.notEqual(task.lifecycle_state, "DONE");
  assert.equal(task.lifecycle_source, "snapshot");

  // Hela den auktoritativa vyn är oförändrad — inte bara state.
  assert.equal(stableStringify(task.authoritative), stableStringify(current));
  assert.equal(task.authoritative.attestation, null);
  assert.equal(task.authoritative.promotion, null);
  assert.equal(task.authoritative.candidate_sha, current.candidate_sha);
  assert.equal(model.snapshot.current_main?.sha, snap.current_main.sha);

  // Exakt lika många DONE som snapshoten själv bär — tail skapade ingen ny.
  const doneInSnapshot = [
    ...(snap.current_task ? [snap.current_task] : []),
    ...snap.backlog,
    ...snap.completed,
  ].filter((view) => view.state === "DONE").length;
  assert.equal(model.tasks.filter((t) => t.lifecycle_state === "DONE").length, doneInSnapshot);

  // Signalerna FÖRSVINNER inte — de blir obekräftade.
  assert.equal(task.pending.length, tail.length);
  for (const pending of task.pending) {
    assert.equal(pending.status, "AWAITING_SNAPSHOT_CONFIRMATION");
    assert.equal(pending.confirms_state, null);
  }
  assert.ok(model.divergences.some((d) => d.kind === "terminal_suggested_by_tail"));
  assert.ok(model.divergences.every((d) => d.resolution === "SNAPSHOT_WINS" && d.observed_only));

  // NEG: den vanligaste genvägen — folda strömmen — ger DONE på exakt samma data.
  assert.equal(foldToStateLie(tail), "DONE");
});

test("V3(1b): DONE kommer när — och bara när — en SENARE snapshot bekräftar det", () => {
  const snap = snapshot();
  const current = currentTask();
  const tail = tailThatLooksFinished(current.task_id, snap.seq_watermark);

  const confirming: unknown = {
    ...snap,
    seq_watermark: snap.seq_watermark + tail.length,
    current_task: { ...current, state: "DONE" },
  };

  const model = buildReadModel({ snapshot: confirming, events: [...RAW_EVENTS, ...tail] });
  const task = taskById(model, current.task_id);

  assert.equal(task.lifecycle_state, "DONE");
  assert.equal(task.lifecycle_source, "snapshot");
  // Och nu är tail-raderna stale — de bidrar varken med fas eller obekräftade markeringar.
  assert.equal(task.pending.length, 0);
  assert.equal(task.live.tail_event_count, 0);
});

test("V3(1c): utan snapshot finns INGEN task lifecycle-state alls (E13)", () => {
  const current = currentTask();
  const tail = tailThatLooksFinished(current.task_id, 0);

  const model = buildReadModel({ snapshot: null, events: [...RAW_EVENTS, ...tail] });

  assert.equal(model.displayed_truth, "NONE");
  assert.equal(model.snapshot.status, "absent");
  assert.deepEqual(model.tasks, []);
  assert.equal(model.snapshot.current_main, null);

  // Bara ström, transienta faser och obekräftade markeringar.
  assert.ok(model.stream.rows.length > 0);
  const tailOnly = model.tail_only_tasks.find((t) => t.task_id === current.task_id);
  assert.ok(tailOnly);
  assert.equal(tailOnly.lifecycle_state, null);
  assert.equal(tailOnly.lifecycle_source, "unavailable_without_snapshot");
  assert.equal(tailOnly.authoritative, null);
  assert.ok(tailOnly.pending.length > 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (2) E1/E2/E3 · OUT-OF-ORDER + DUBBLETTER ≡ ORDNAD UNIK STRÖM
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(2): omkastad och dubblerad ström serialiseras IDENTISKT med den ordnade unika", () => {
  const snap = snapshot();
  const ordered = [...RAW_EVENTS, ...tailThatLooksFinished(currentTask().task_id, snap.seq_watermark)];

  // Omkastad ankomst + varje event levererat två gånger (andra gången som en egen kopia).
  const messy = [...ordered].reverse().flatMap((event) => [event, { ...event }]);

  const orderedModel = buildReadModel({ snapshot: RAW_SNAPSHOT, events: ordered });
  const messyModel = buildReadModel({ snapshot: RAW_SNAPSHOT, events: messy });

  assert.equal(serializeReadModel(messyModel), serializeReadModel(orderedModel));

  // Provet vore innehållslöst om strömmarna varit lika: de var det bevisligen inte.
  assert.equal(messyModel.ingest.received, ordered.length * 2);
  assert.equal(orderedModel.ingest.received, ordered.length);
  assert.equal(messyModel.ingest.duplicates.length, ordered.length);
  assert.ok(messyModel.ingest.duplicates.every((d) => d.occurrences === 2 && d.identical));
  assert.deepEqual(orderedModel.ingest.duplicates, []);

  // E1: samma ström två gånger ger samma modell (ingen klocka, ingen slump, ingen Map-ordning).
  assert.equal(
    serializeReadModel(buildReadModel({ snapshot: RAW_SNAPSHOT, events: ordered })),
    serializeReadModel(orderedModel),
  );

  // Serialiseringen är inte trivialt tom.
  assert.ok(serializeReadModel(orderedModel).includes(currentTask().task_id));

  // E2: dubbletten gav ingen andra rad.
  assert.equal(messyModel.stream.counts.rows, orderedModel.stream.counts.rows);
  assert.equal(new Set(eventIds(messyModel.stream.rows)).size, messyModel.stream.counts.rows);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (3) DEDUP PÅ event_id — INTE PÅ seq
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(3): dedup sker på event_id; två event som delar seq överlever båda", () => {
  const base = RAW_EVENTS[0];
  const other = fixtureEventOfType("task.claimed");

  // A · SAMMA event_id levererat med OLIKA seq (backendfel eller trasig retry): en rad.
  const sameIdLowSeq = patched(base, { event_id: "evt-v3-dedup-a", seq: 101 });
  const sameIdHighSeq = patched(base, { event_id: "evt-v3-dedup-a", seq: 102 });
  // B · OLIKA event_id som delar seq: två rader, plus en synlig kollisionsvarning.
  const collidingOne = patched(base, { event_id: "evt-v3-dedup-b1", seq: 200 });
  const collidingTwo = patched(other, { event_id: "evt-v3-dedup-b2", seq: 200 });

  const input = [sameIdLowSeq, collidingTwo, sameIdHighSeq, collidingOne];
  const { stream, ingest } = projectEvents(input, { scope: "store" });

  const ids = eventIds(stream.rows);
  assert.deepEqual([...ids].sort(), ["evt-v3-dedup-a", "evt-v3-dedup-b1", "evt-v3-dedup-b2"]);
  assert.equal(new Set(ids).size, ids.length, "ingen event_id får förekomma två gånger");

  // Kollisionen tystas inte — den rapporteras som den backendavvikelse den är.
  assert.deepEqual(stream.seq_collisions, [
    { seq: 200, event_ids: ["evt-v3-dedup-b1", "evt-v3-dedup-b2"] },
  ]);
  const duplicateA = ingest.duplicates.find((d) => d.event_id === "evt-v3-dedup-a");
  assert.ok(duplicateA);
  assert.equal(duplicateA.occurrences, 2);
  assert.equal(duplicateA.identical, false);

  // Den kanoniska vinnaren väljs på innehåll (lägsta seq), inte på ankomstordning.
  const reversed = projectEvents([...input].reverse(), { scope: "store" });
  assert.equal(stableStringify(reversed.stream), stableStringify(stream));
  assert.equal(stream.rows.find((row) => row.event.event_id === "evt-v3-dedup-a")?.event.seq, 101);

  // NEG: dedup på seq ger ett annat, felaktigt resultat på EXAKT samma data —
  // "evt-v3-dedup-a" överlever två gånger och en av kollisionsraderna försvinner.
  const lie = dedupeBySeqLie(input);
  const lieIds = lie.map((event) => String(event.event_id));
  assert.equal(lieIds.filter((id) => id === "evt-v3-dedup-a").length, 2);
  assert.equal(new Set(lieIds).size, 2);
  assert.ok(!lieIds.includes("evt-v3-dedup-b1") || !lieIds.includes("evt-v3-dedup-b2"));
});

/* ────────────────────────────────────────────────────────────────────────────
 * (4) E9/E11 · GAP DETEKTERAS OCH RAPPORTERAS
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(4): lucka i den ofiltrerade butiksströmmen detekteras och rapporteras", () => {
  const full = buildReadModel({ snapshot: RAW_SNAPSHOT, events: RAW_EVENTS });
  assert.deepEqual(full.stream.gaps, [], "hela fixturströmmen är sammanhängande");

  const missingSeq = 12;
  const withHole = RAW_EVENTS.filter((event) => event.seq !== missingSeq);
  const model = buildReadModel({ snapshot: RAW_SNAPSHOT, events: withHole });

  assert.deepEqual(model.stream.gaps, [{ from: missingSeq, to: missingSeq, missing: 1 }]);
  assert.equal(model.stream.gap_detection, "store_stream");

  // Inget event hittas på för att fylla luckan …
  assert.equal(model.stream.counts.rows, RAW_EVENTS.length - 1);
  assert.ok(!model.stream.rows.some((row) => row.event.seq === missingSeq));
  // … och ingen authority ändras av att den finns.
  assert.equal(stableStringify(model.tasks), stableStringify(full.tasks));
  assert.equal(stableStringify(model.snapshot), stableStringify(full.snapshot));

  // Ett större hål rapporteras som ETT intervall med rätt antal.
  const wideHole = RAW_EVENTS.filter((event) => Number(event.seq) < 5 || Number(event.seq) > 9);
  assert.deepEqual(buildReadModel({ snapshot: RAW_SNAPSHOT, events: wideHole }).stream.gaps, [
    { from: 5, to: 9, missing: 5 },
  ]);
});

test("V3(4b): B3 · en run-filtrerad vy gap-detekterar ALDRIG, men butiksströmmen gör det", () => {
  const runA = RAW_EVENTS.filter((event) => event.run_id === "run-fixture-a");
  assert.ok(runA.length > 1 && runA.length < RAW_EVENTS.length);

  const filtered = buildReadModel({ snapshot: RAW_SNAPSHOT, events: runA, scope: "filtered" });
  assert.deepEqual(filtered.stream.gaps, []);
  assert.equal(filtered.stream.gap_detection, "disabled_filtered_view");

  // Samma rader lästa som om de vore butiksströmmen larmar — filtreringen är alltså skälet
  // till tystnaden, inte att datan råkade sakna hopp.
  const asStore = buildReadModel({ snapshot: RAW_SNAPSHOT, events: runA, scope: "store" });
  assert.ok(asStore.stream.gaps.length > 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (5) SNAPSHOT MOT TAIL — SNAPSHOTEN VINNER ALLTID
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(5): konflikt snapshot ↔ tail lämnar snapshoten authority; divergensen loggas", () => {
  const snap = snapshot();
  const current = currentTask();
  assert.equal(current.phase, "BUILD");

  const conflicting = [
    patched(fixtureEventOfType("verification.started"), {
      event_id: "evt-v3-conflict-0001",
      seq: snap.seq_watermark + 1,
      task_id: current.task_id,
    }),
    patched(fixtureEventOfType("policy.failed"), {
      event_id: "evt-v3-conflict-0002",
      seq: snap.seq_watermark + 2,
      task_id: current.task_id,
    }),
    patched(fixtureEventOfType("verification.failed"), {
      event_id: "evt-v3-conflict-0003",
      seq: snap.seq_watermark + 3,
      task_id: current.task_id,
    }),
  ];

  const model = buildReadModel({ snapshot: RAW_SNAPSHOT, events: conflicting });
  const task = taskById(model, current.task_id);

  // Fasen: tail såg VERIFY, snapshoten säger BUILD. Snapshoten visas.
  assert.equal(task.phase.authoritative, "BUILD");
  assert.equal(task.phase.transient, "VERIFY");
  assert.equal(task.phase.displayed, "BUILD");
  assert.equal(task.phase.displayed_source, "snapshot");
  assert.equal(task.phase.confirmed, true);
  assert.equal(task.phase.diverges_from_snapshot, true);

  const phaseDivergence = model.divergences.find((d) => d.kind === "phase");
  assert.ok(phaseDivergence);
  assert.equal(phaseDivergence.resolution, "SNAPSHOT_WINS");
  assert.equal(phaseDivergence.observed_only, true);

  // Domarna är snapshotens. Två fällande tail-event ändrar dem inte.
  assert.equal(task.authoritative.policy, current.policy);
  assert.equal(task.authoritative.verification, current.verification);
  assert.equal(stableStringify(task.authoritative), stableStringify(current));

  // Modellen är dessutom FRUSEN: ett senare lager kan inte ens skriva över snapshotfälten.
  assert.throws(() => {
    (task.authoritative as { state: string }).state = "DONE";
  }, TypeError);
  assert.equal(task.authoritative.state, current.state);

  // Ingen eventrad gör anspråk på authority.
  assert.ok(model.stream.rows.every((row) => row.authority === "NONE"));

  // E6: ett event UNDER watermarken bidrar varken med fas eller aktivitet.
  const stale = buildReadModel({
    snapshot: RAW_SNAPSHOT,
    events: [
      patched(fixtureEventOfType("verification.started"), {
        event_id: "evt-v3-stale-0001",
        seq: snap.seq_watermark,
        task_id: current.task_id,
      }),
    ],
  });
  const staleTask = taskById(stale, current.task_id);
  assert.equal(stale.stream.counts.stale, 1);
  assert.equal(staleTask.phase.transient, null);
  assert.equal(staleTask.phase.displayed, current.phase);
  assert.equal(staleTask.live.tail_event_count, 0);
});

test("V3(5b): tail får fylla ett TOMT fasfält, men bara som obekräftad transient", () => {
  const snap = snapshot();
  const withoutPhase = snap.backlog.find((task) => task.phase === null);
  assert.ok(withoutPhase);

  const model = buildReadModel({
    snapshot: RAW_SNAPSHOT,
    events: [
      patched(fixtureEventOfType("agent.started"), {
        event_id: "evt-v3-transient-0001",
        seq: snap.seq_watermark + 1,
        task_id: withoutPhase.task_id,
      }),
    ],
  });
  const task = taskById(model, withoutPhase.task_id);

  assert.equal(task.phase.authoritative, null);
  assert.equal(task.phase.displayed, "BUILD");
  assert.equal(task.phase.displayed_source, "tail_transient");
  assert.equal(task.phase.confirmed, false, "en transient fas är ALDRIG bekräftad");
  assert.equal(task.phase.diverges_from_snapshot, false);
  // Och lifecycle-state är fortfarande snapshotens.
  assert.equal(task.lifecycle_state, withoutPhase.state);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (6) E8 · ts ÄR IRRELEVANT FÖR ORDNINGEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(6): bakåtgående ts ändrar varken läsordning eller read model", () => {
  const timestamps = RAW_BACKWARDS_TS_EVENTS.map((event) => Date.parse(String(event.ts)));
  assert.equal(RAW_BACKWARDS_TS_EVENTS.length, 100);
  assert.ok(
    timestamps.every((value, index) => index === 0 || value < timestamps[index - 1]),
    "fixturen måste faktiskt bära bakåtgående ts — annars bevisar provet ingenting",
  );

  // Deterministisk omkastning: udda index först, sedan jämna. Ingen slump i provet.
  const shuffled = [
    ...RAW_BACKWARDS_TS_EVENTS.filter((_unused, index) => index % 2 === 1),
    ...RAW_BACKWARDS_TS_EVENTS.filter((_unused, index) => index % 2 === 0),
  ];

  const inOrder = buildReadModel({ snapshot: RAW_SNAPSHOT, events: RAW_BACKWARDS_TS_EVENTS });
  const outOfOrder = buildReadModel({ snapshot: RAW_SNAPSHOT, events: shuffled });
  const byTsFirst = buildReadModel({ snapshot: RAW_SNAPSHOT, events: orderByTsLie(RAW_BACKWARDS_TS_EVENTS) });

  assert.equal(serializeReadModel(outOfOrder).length > 0, true);
  assert.equal(serializeReadModel(outOfOrder), serializeReadModel(inOrder));
  assert.equal(serializeReadModel(byTsFirst), serializeReadModel(inOrder));

  const seqs = inOrder.stream.rows.map((row) => row.event.seq);
  assert.deepEqual(seqs, Array.from({ length: 100 }, (_unused, index) => index + 1));
  // Läsordningen är alltså stigande seq medan klockan går bakåt.
  const readTs = inOrder.stream.rows.map((row) => Date.parse(row.event.ts));
  assert.ok(readTs.every((value, index) => index === 0 || value < readTs[index - 1]));

  // NEG: en ts-sorterande läsning ger den motsatta ordningen på exakt samma data.
  const lieSeqs = orderByTsLie(RAW_BACKWARDS_TS_EVENTS).map((event) => Number(event.seq));
  assert.notDeepEqual(lieSeqs, seqs);
  assert.deepEqual(lieSeqs, [...seqs].reverse());
});

/* ────────────────────────────────────────────────────────────────────────────
 * (7) E4 · OKÄND event_type ÄR DATA, INTE SEMANTIK
 * ──────────────────────────────────────────────────────────────────────────── */

test("V3(7): okända event_type kastar inte, får ingen semantik och flyttar ingen authority", () => {
  const withUnknown = [...RAW_EVENTS, ...RAW_UNKNOWN_EVENTS];
  const baseline = buildReadModel({ snapshot: RAW_SNAPSHOT, events: RAW_EVENTS });

  let model!: ReadModel;
  assert.doesNotThrow(() => {
    model = buildReadModel({ snapshot: RAW_SNAPSHOT, events: withUnknown });
  });

  // Raderna finns kvar — rått bevarade, utan tolkning.
  assert.equal(model.stream.counts.rows, RAW_EVENTS.length + RAW_UNKNOWN_EVENTS.length);
  const unknownRows = model.stream.rows.filter((row) => !row.classification.known);
  assert.ok(unknownRows.length >= 2);
  for (const row of unknownRows) {
    assert.equal(row.transient_phase, null);
    assert.equal(row.suggests_terminal_outcome, false);
    assert.equal(row.authority, "NONE");
    assert.equal(row.event.event_type, row.classification.raw_type);
  }
  assert.ok(unknownRows.some((row) => row.classification.kind === "unknown_family"));
  assert.ok(unknownRows.some((row) => row.classification.kind === "unknown_type_in_known_family"));

  // Nyare major → banner och stoppad fas-härledning, ALDRIG krasch och aldrig tom snapshotvy.
  assert.equal(model.stream.schema_banner, true);
  assert.equal(model.stream.tail_phase_derivation, "disabled_unsupported_schema");
  assert.equal(model.displayed_truth, "CONTROLLER_PUBLISHED_SNAPSHOT");

  // Ingen authority rörd: tasksprojektionen är byte-identisk med den utan okända event.
  assert.equal(stableStringify(model.tasks), stableStringify(baseline.tasks));
  assert.equal(stableStringify(model.snapshot), stableStringify(baseline.snapshot));
  assert.deepEqual(model.pending_confirmations, []);
  assert.deepEqual(model.divergences, []);

  // Hoppet upp till de okända seq-numren rapporteras som lucka, inte som tystnad.
  assert.deepEqual(model.stream.gaps, [{ from: 24, to: 9000, missing: 8977 }]);
});

/* ────────────────────────────────────────────────────────────────────────────
 * (8) V1:s SCHEMA OCH FIXTURER ÄR KÄLLKONTRAKTEN
 * ──────────────────────────────────────────────────────────────────────────── */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB_LOOP = path.join(HERE, "..", "..", "lib", "loop");

function sourceOf(file: "events.ts" | "snapshot.ts"): string {
  return readFileSync(path.join(LIB_LOOP, file), "utf8");
}

test("V3(8): V3:s regler är HÄMTADE ur V1:s låsta konstanter, inte omskrivna", () => {
  assert.equal(READ_MODEL_RULES.ORDERING_KEY, LOCKED.ORDERING_KEY);
  assert.equal(READ_MODEL_RULES.DEDUP_KEY, LOCKED.DEDUP_KEY);
  assert.equal(READ_MODEL_RULES.SNAPSHOT_WINS, LOCKED.SNAPSHOT_WINS);
  assert.equal(READ_MODEL_RULES.EVENT_STREAM_IS_AUTHORITY, LOCKED.EVENT_STREAM_IS_AUTHORITY);
  assert.equal(READ_MODEL_RULES.DISPLAYED_TRUTH, LOCKED.DISPLAYED_TRUTH);
  assert.equal(READ_MODEL_RULES.ORDERING_KEY, "seq");
  assert.equal(READ_MODEL_RULES.DEDUP_KEY, "event_id");
  assert.equal(READ_MODEL_RULES.TS_IS_ORDERING, false);
  assert.equal(READ_MODEL_RULES.ARRIVAL_ORDER_IS_ORDERING, false);
  assert.equal(READ_MODEL_RULES.MUTATES_CALLER_INPUT, false);
});

test("V3(8b): V3:s vokabulär är en DELMÄNGD av V1:s — inget parallellt register", () => {
  for (const family of Object.keys(TRANSIENT_PHASE_BY_FAMILY)) {
    assert.ok((EVENT_FAMILIES as readonly string[]).includes(family), `okänd familj: ${family}`);
  }
  for (const phase of Object.values(TRANSIENT_PHASE_BY_FAMILY)) {
    assert.ok((PHASES as readonly string[]).includes(phase as string), `okänd fas: ${phase}`);
  }

  assert.ok(TERMINAL_SUGGESTING_EVENT_TYPES.length > 0);
  for (const eventType of TERMINAL_SUGGESTING_EVENT_TYPES) {
    assert.ok(KNOWN_EVENT_TYPES.includes(eventType), `okänd typ: ${eventType}`);
  }

  // Lifecycle-tillstånden i modellen kommer ur fixtursnapshoten, inte ur V3.
  const snap = snapshot();
  const model = buildReadModel({ snapshot: RAW_SNAPSHOT, events: RAW_EVENTS });
  const fromSnapshot = [
    ...(snap.current_task ? [snap.current_task] : []),
    ...snap.backlog,
    ...snap.completed,
  ]
    .map((view) => view.state)
    .sort();
  assert.deepEqual(model.tasks.map((task) => task.lifecycle_state).sort(), fromSnapshot);
  for (const task of model.tasks) {
    assert.ok((TASK_LIFECYCLE as readonly string[]).includes(task.lifecycle_state));
  }

  // Statiskt: V3:s filer bär inget eget lifecycle-vokabulär och läser V1:s schema.
  const lifecycleLiteral = new RegExp(`["'\`](${TASK_LIFECYCLE.join("|")})["'\`]`);
  for (const file of ["events.ts", "snapshot.ts"] as const) {
    const source = sourceOf(file);
    assert.ok(/from "\.\/schema"/.test(source), `${file} måste läsa V1:s schema.ts`);
    assert.ok(
      !lifecycleLiteral.test(source),
      `${file} får inte bära en egen lifecycle-sträng (parallellt vokabulär)`,
    );
    // Ingen procentsats och inget framstegsmått någonstans i read-modellen.
    assert.ok(!/percent|progress/i.test(source), `${file} får inte bära procent eller framsteg`);
  }
});

test("V3(8c): V1:s validering är grinden — uppfunna fält når aldrig read-modellen", () => {
  const invented = { ...RAW_EVENTS[0], event_id: "evt-v3-invented", progress_percent: 99 };
  const { stream, ingest } = projectEvents([...RAW_EVENTS, invented], { scope: "store" });

  assert.equal(ingest.invalid.length, 1);
  assert.equal(ingest.invalid[0].index, RAW_EVENTS.length);
  assert.ok(!eventIds(stream.rows).includes("evt-v3-invented"));
  assert.equal(stream.counts.rows, RAW_EVENTS.length);

  // En snapshot med uppfunnen form avvisas SYNLIGT — och tail tar aldrig över authority.
  const rejected = buildReadModel({
    snapshot: { ...(RAW_SNAPSHOT as Record<string, unknown>), progress_percent: 42 },
    events: RAW_EVENTS,
  });
  assert.equal(rejected.snapshot.status, "rejected");
  assert.ok(rejected.snapshot.reason);
  assert.equal(rejected.displayed_truth, "NONE");
  assert.deepEqual(rejected.tasks, []);
  assert.ok(rejected.stream.rows.length > 0, "strömmen visas fortfarande som ren logg");

  // Och en indata som inte ens är en lista degraderar i stället för att kasta.
  const notAList = buildReadModel({ snapshot: RAW_SNAPSHOT, events: null });
  assert.deepEqual(notAList.stream.rows, []);
  assert.equal(notAList.ingest.invalid.length, 1);
  assert.equal(notAList.displayed_truth, "CONTROLLER_PUBLISHED_SNAPSHOT");
});

/* ────────────────────────────────────────────────────────────────────────────
 * (9) INPUT-RENHET · ANROPARENS DATA ÄGS AV ANROPAREN
 *
 * Bakgrunden i klartext: en `payload` (B4) och snapshotens opaka kartor (S5/S8) valideras som
 * ogenomskinliga kartor. Valideringen kopierar bara den yttersta nivån, så NÄSTLADE objekt och
 * listor lever vidare i read-modellen som anroparens egna referenser. En rekursiv frysning av
 * den färdiga modellen — den självklara vägen till immutabilitet — hade därför tyst fryst
 * transportens buffert hos anroparen. Proven nedan mäter att så inte sker, med data där
 * skillnaden är direkt observerbar.
 * ──────────────────────────────────────────────────────────────────────────── */

type NestedPayload = {
  nested_object: { evidence: { ref: string; tags: string[] } };
  nested_list: { n: number }[];
};

type PurityInput = {
  snapshot: Record<string, unknown>;
  events: RawEvent[];
  /** Anroparens egna nästlade referenser — exakt de som får INTE röras. */
  payload: NestedPayload;
  breaker: { open: boolean; window: { failures: number[] } };
  taskId: string;
  watermark: number;
};

/**
 * En FÄRSK indatamängd per anrop: djupkopierad fixtur plus nästlade strukturer på de två
 * ställen där backendkontraktet uttryckligen är opakt (event payload och run.breaker).
 * Ingen fixturmodul muteras, så inget prov kan smitta ett annat.
 */
function purityInput(): PurityInput {
  const snapshotCopy = deepCopy(RAW_SNAPSHOT) as Record<string, unknown> & {
    seq_watermark: number;
    run: Record<string, unknown>;
  };
  const breaker = { open: false, window: { failures: [1, 2, 3] } };
  snapshotCopy.run = { ...snapshotCopy.run, breaker };

  const payload: NestedPayload = {
    nested_object: { evidence: { ref: "artifact://v3-purity", tags: ["alfa", "beta"] } },
    nested_list: [{ n: 1 }, { n: 2 }],
  };
  const watermark = snapshotCopy.seq_watermark;
  const taskId = currentTask().task_id;

  const carrier = patched(deepCopy(fixtureEventOfType("agent.started")), {
    event_id: "evt-v3-purity-0001",
    seq: watermark + 1,
    task_id: taskId,
    payload,
  });
  // Plus en tail som ser avslutad ut: renheten ska hålla samtidigt som SNAPSHOT_WINS gör det.
  const events = [carrier, ...deepCopy(tailThatLooksFinished(taskId, watermark + 1))];

  return { snapshot: snapshotCopy, events, payload, breaker, taskId, watermark };
}

/** Modellens egen kopia av det bärande eventets payload. */
function modelPayload(model: ReadModel): Record<string, unknown> {
  const row = model.stream.rows.find((r) => r.event.event_id === "evt-v3-purity-0001");
  assert.ok(row, "det bärande eventet måste finnas i modellen");
  return row.event.payload as Record<string, unknown>;
}

test("V3(9): buildReadModel muterar ALDRIG anroparens nästlade indata", () => {
  const input = purityInput();
  const { payload, breaker } = input;

  // Utgångsläget: allt anroparen äger är muterbart innan anropet.
  assert.equal(Object.isFrozen(input.events), false);
  assert.equal(Object.isFrozen(input.events[0]), false);
  assert.equal(Object.isFrozen(payload), false);
  assert.equal(Object.isFrozen(payload.nested_object), false);
  assert.equal(Object.isFrozen(payload.nested_object.evidence), false);
  assert.equal(Object.isFrozen(payload.nested_object.evidence.tags), false);
  assert.equal(Object.isFrozen(payload.nested_list), false);
  assert.equal(Object.isFrozen(payload.nested_list[0]), false);
  assert.equal(Object.isFrozen(breaker), false);
  assert.equal(Object.isFrozen(breaker.window), false);
  assert.equal(Object.isFrozen(breaker.window.failures), false);

  const eventsBefore = stableStringify(input.events);
  const snapshotBefore = stableStringify(input.snapshot);
  const eventsListIdentity = [...input.events];

  const model = buildReadModel({ snapshot: input.snapshot, events: input.events });

  // A · STRUKTURELL LIKHET: ingenting i indatat ändrades.
  assert.equal(stableStringify(input.events), eventsBefore);
  assert.equal(stableStringify(input.snapshot), snapshotBefore);
  assert.deepEqual(input.events, eventsListIdentity, "leveransordningen är också indata");
  assert.deepEqual(payload.nested_object, {
    evidence: { ref: "artifact://v3-purity", tags: ["alfa", "beta"] },
  });
  assert.deepEqual(payload.nested_list, [{ n: 1 }, { n: 2 }]);
  assert.deepEqual(breaker.window.failures, [1, 2, 3]);

  // B · REFERENSIDENTITET: anroparens objekt byttes inte ut under fötterna på hen.
  assert.equal(input.events[0].payload, payload);
  assert.equal((input.snapshot.run as { breaker: unknown }).breaker, breaker);

  // C · MUTERBARHET: Object.isFrozen är fortfarande false hela vägen ner.
  assert.equal(Object.isFrozen(input.events), false);
  assert.equal(Object.isFrozen(input.events[0]), false);
  assert.equal(Object.isFrozen(payload), false);
  assert.equal(Object.isFrozen(payload.nested_object), false);
  assert.equal(Object.isFrozen(payload.nested_object.evidence), false);
  assert.equal(Object.isFrozen(payload.nested_object.evidence.tags), false);
  assert.equal(Object.isFrozen(payload.nested_list), false);
  assert.equal(Object.isFrozen(payload.nested_list[0]), false);
  assert.equal(Object.isFrozen(breaker), false);
  assert.equal(Object.isFrozen(breaker.window), false);
  assert.equal(Object.isFrozen(breaker.window.failures), false);

  // Och muterbarheten är verklig, inte bara ett flaggvärde: skrivningarna går igenom.
  const displayedBefore = serializeReadModel(model);
  assert.doesNotThrow(() => {
    payload.nested_object.evidence.tags.push("gamma");
    payload.nested_list.push({ n: 3 });
    breaker.window.failures.push(4);
  });

  // D · ISOLERING ÅT ANDRA HÅLLET: modellen aliaserar inte indatat, så en senare mutation
  // hos anroparen kan inte ändra det som visas.
  assert.equal(serializeReadModel(model), displayedBefore);
  assert.deepEqual(modelPayload(model).nested_list, [{ n: 1 }, { n: 2 }]);
});

test("V3(9b): modellens EGNA strukturer är frysta — immutabiliteten offrades inte", () => {
  const input = purityInput();
  const model = buildReadModel({ snapshot: input.snapshot, events: input.events });
  const payloadCopy = modelPayload(model) as unknown as NestedPayload;

  // Modellen bär en egen kopia, inte anroparens referens …
  assert.notEqual(payloadCopy, input.payload);
  assert.notEqual(payloadCopy.nested_object, input.payload.nested_object);
  assert.notEqual(payloadCopy.nested_list, input.payload.nested_list);
  // … med identiskt innehåll …
  assert.deepEqual(payloadCopy, input.payload);

  // … och den kopian är fryst hela vägen ner.
  assert.equal(Object.isFrozen(model), true);
  assert.equal(Object.isFrozen(model.stream.rows), true);
  assert.equal(Object.isFrozen(payloadCopy), true);
  assert.equal(Object.isFrozen(payloadCopy.nested_object), true);
  assert.equal(Object.isFrozen(payloadCopy.nested_object.evidence), true);
  assert.equal(Object.isFrozen(payloadCopy.nested_object.evidence.tags), true);
  assert.equal(Object.isFrozen(payloadCopy.nested_list), true);
  assert.equal(Object.isFrozen(payloadCopy.nested_list[0]), true);

  assert.throws(() => {
    (payloadCopy.nested_object.evidence as { ref: string }).ref = "artifact://omskriven";
  }, TypeError);
  assert.throws(() => {
    payloadCopy.nested_list.push({ n: 99 });
  }, TypeError);
});

test("V3(9c): SNAPSHOT_WINS håller oförändrat med nästlad payload i strömmen", () => {
  const input = purityInput();
  const current = currentTask();
  const model = buildReadModel({ snapshot: input.snapshot, events: input.events });
  const task = taskById(model, input.taskId);

  // Snapshoten är fortsatt DISPLAYED_TRUTH — tail-sekvensen "avslutar" ingenting.
  assert.equal(model.displayed_truth, "CONTROLLER_PUBLISHED_SNAPSHOT");
  assert.equal(model.snapshot.status, "present");
  assert.equal(task.lifecycle_state, current.state);
  assert.notEqual(task.lifecycle_state, "DONE");
  assert.equal(task.lifecycle_source, "snapshot");
  assert.equal(task.phase.displayed, current.phase);
  assert.equal(task.phase.displayed_source, "snapshot");
  assert.ok(task.pending.length > 0);
  assert.ok(task.pending.every((p) => p.status === "AWAITING_SNAPSHOT_CONFIRMATION"));
  assert.ok(model.stream.rows.every((row) => row.authority === "NONE"));

  // Snapshotens opaka karta bevaras rå — inget fält uppfinns ur den.
  assert.deepEqual(model.snapshot.run?.breaker, { open: false, window: { failures: [1, 2, 3] } });

  // Determinismen står kvar: dubblerad och omkastad leverans ger identiskt visat läge.
  const messy = [...input.events].reverse().flatMap((event) => [event, { ...event }]);
  const messyModel = buildReadModel({ snapshot: input.snapshot, events: messy });
  assert.equal(serializeReadModel(messyModel), serializeReadModel(model));
  // … och även den messiga leveransen lämnade anroparens nästlade objekt orörda.
  assert.equal(Object.isFrozen(input.payload.nested_object), false);
});

test("V3(9d): NEG · rekursiv frysning av projektionen fryser anroparens egna objekt", () => {
  const lie = purityInput();

  // Projektionen delar med flit referenser med indatat (den kopierar ingenting) — därför är
  // en rekursiv frysning av dess resultat exakt den mutation V3 ska undvika.
  const projection = projectEvents(lie.events, { scope: "store" });
  assert.equal(
    projection.stream.rows.find((row) => row.event.event_id === "evt-v3-purity-0001")?.event
      .payload.nested_object,
    lie.payload.nested_object,
    "projektionen lånar anroparens nästlade referens — det är premissen för lögnstuben",
  );

  assert.equal(Object.isFrozen(lie.payload.nested_object), false);
  recursiveFreezeLie(projection);

  // Genvägen kryper ut i anroparens buffert: samma data, motsatt utfall.
  assert.equal(Object.isFrozen(lie.payload.nested_object), true);
  assert.equal(Object.isFrozen(lie.payload.nested_object.evidence.tags), true);
  assert.throws(() => {
    lie.payload.nested_object.evidence.tags.push("gamma");
  }, TypeError);

  // Kontrollen: den riktiga byggaren lämnar en likadan, färsk indatamängd muterbar.
  const clean = purityInput();
  buildReadModel({ snapshot: clean.snapshot, events: clean.events });
  assert.equal(Object.isFrozen(clean.payload.nested_object), false);
  assert.doesNotThrow(() => {
    clean.payload.nested_object.evidence.tags.push("gamma");
  });
});
