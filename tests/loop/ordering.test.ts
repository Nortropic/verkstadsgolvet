/**
 * V1 · ORDNINGSPROVET — handoffens "första provet att skriva, före kod".
 *
 * EXIT-KRITERIUM V1(4): hundra event med bakåtgående `ts` ska ge exakt samma läsordning som
 * med stigande `ts`. Ordning läses ur `seq` ENSAMT (B3).
 *
 * NEGATIV KONTROLL: "ts-baserad sortering som råkar ge rätt svar på testdata." Provet bär
 * därför en LÖGNSTUB som sorterar på `ts`, och mäter att stuben FÄLLS av samma data.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { orderEvents, type LoopEvent } from "../../lib/loop/schema";
import {
  fixtureAscendingTsEvents,
  fixtureBackwardsTsEvents,
} from "../../lib/loop/fixtures";

function seqs(events: readonly { seq: number }[]): number[] {
  return events.map((event) => event.seq);
}

/** LÖGNSTUB: den vanligaste genvägen — sortera på wall-clock. Ska fällas av provet nedan. */
function orderByTsLie<T extends { ts: string }>(events: readonly T[]): T[] {
  return [...events].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

test("fixturerna bär faktiskt bakåtgående ts — annars bevisar provet ingenting", () => {
  const backwards = fixtureBackwardsTsEvents().map((v) => v.event);
  assert.equal(backwards.length, 100);
  const timestamps = backwards.map((event) => Date.parse(event.ts));
  const strictlyDecreasing = timestamps.every(
    (value, index) => index === 0 || value < timestamps[index - 1],
  );
  assert.equal(strictlyDecreasing, true, "ts måste gå bakåt i events-backwards-ts.json");
});

test("V1(4): bakåtgående ts ger identisk läsordning som stigande ts", () => {
  const backwards = fixtureBackwardsTsEvents().map((v) => v.event);
  const ascending = fixtureAscendingTsEvents().map((v) => v.event);

  assert.deepEqual(seqs(orderEvents(backwards)), seqs(orderEvents(ascending)));
  assert.deepEqual(
    seqs(orderEvents(backwards)),
    Array.from({ length: 100 }, (_unused, index) => index + 1),
  );
});

test("ordningen är oberoende av ankomstordningen (shufflad ström ger samma läsordning)", () => {
  const events = fixtureBackwardsTsEvents().map((v) => v.event);
  // Deterministisk "shuffle": udda index först, sedan jämna. Ingen slump i provet.
  const shuffled: LoopEvent[] = [
    ...events.filter((_unused, index) => index % 2 === 1),
    ...events.filter((_unused, index) => index % 2 === 0),
  ];
  assert.deepEqual(seqs(orderEvents(shuffled)), seqs(orderEvents(events)));
});

test("NEG: lögnstub som sorterar på ts fälls av exakt samma data", () => {
  const backwards = fixtureBackwardsTsEvents().map((v) => v.event);
  const truth = seqs(orderEvents(backwards));
  const lie = seqs(orderByTsLie(backwards));

  assert.notDeepEqual(lie, truth, "ts-sortering får INTE råka ge rätt svar på testdatan");
  assert.deepEqual(lie, [...truth].reverse());
});

test("seq är butiksglobal: två interfolierande runs ordnas som en enda ström", () => {
  const events = fixtureBackwardsTsEvents().map((v) => v.event);
  const runs = new Set(events.map((event) => event.run_id));
  assert.ok(runs.size > 1, "fixturen måste bära mer än en run för att pröva B3");

  const ordered = orderEvents(events);
  const monotonic = ordered.every((event, index) => index === 0 || event.seq > ordered[index - 1].seq);
  assert.equal(monotonic, true, "seq ska vara strikt stigande över hela butiken, inte per run");
});
