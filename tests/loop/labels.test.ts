/**
 * V1 · ETIKETTER.
 *
 * Kartan täcker backendens familjer och INGENTING mer. Saknas en översättning visas rå
 * event_type — det är rätt beteende, inte ett fel. Ingen okänd typ får semantik.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVENT_TYPE_LABELS,
  MISSING,
  NEEDS_SPEC_EXPLANATION,
  PAUSE_AT_SAFE_BOUNDARY_LABEL,
  TASK_LIFECYCLE_PRESENTATION,
  eventLabel,
  lifecyclePresentationCoverage,
  orMissing,
} from "../../lib/loop/labels";
import { TASK_LIFECYCLE, classifyEventType } from "../../lib/loop/schema";

test("översättningstabellen översätter kända typer till svenska", () => {
  assert.equal(eventLabel("run.started").text, "Körning startad");
  assert.equal(eventLabel("main.advanced").text, "main flyttad");
  assert.equal(eventLabel("merge.resolution.started").text, "Konfliktlösare arbetar");
});

test("okänd typ visas RÅ och märks som okänd — aldrig som fel, aldrig med påhittad mening", () => {
  const label = eventLabel("kvantfluktuation.uppstod");
  assert.equal(label.text, "kvantfluktuation.uppstod");
  assert.equal(label.translated, false);
  assert.equal(label.unknown_type, true);
});

test("känd typ utan översättning visas rå men är inte 'okänd'", () => {
  const label = eventLabel("policy.started");
  assert.equal(classifyEventType("policy.started").known, true);
  assert.equal(label.translated, false);
  assert.equal(label.text, "policy.started");
  assert.equal(label.unknown_type, false);
});

/**
 * V1-LBL-PROTO: ett event_type är otrodd indata. Namn som sammanfaller med medlemmar i
 * Object.prototype fick tidigare en ärvd funktion som "översättning" — en OKÄND typ hade
 * alltså både fått semantik och ett värde som inte går att rendera. Det bryter mot V1(1)
 * och mot EVENT_CLIENT-regeln att okänd typ visas rå, utan semantik, utan krasch.
 */
test("V1-LBL-PROTO: prototypnamn som event_type ger rå text, aldrig en ärvd medlem", () => {
  const prototypeNames = [
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "__proto__",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "__defineGetter__",
  ];

  for (const name of prototypeNames) {
    const label = eventLabel(name);
    assert.equal(typeof label.text, "string", `${name} gav ett icke-renderbart värde`);
    assert.equal(label.text, name, `${name} översattes trots att den är okänd`);
    assert.equal(label.translated, false, `${name} märktes som översatt`);
    assert.equal(label.unknown_type, true, `${name} märktes som känd typ`);
    assert.equal(label.raw_type, name);
  }
});

test("V1-LBL-PROTO: kartan saknar prototypkedja — hålet är stängt i konstruktionen", () => {
  assert.equal(Object.getPrototypeOf(EVENT_TYPE_LABELS), null);
  assert.equal(Object.getPrototypeOf(TASK_LIFECYCLE_PRESENTATION), null);
  // Ingen ärvd medlem går att nå ens vid direkt uppslag, förbi eventLabel().
  for (const name of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
    assert.equal(
      (EVENT_TYPE_LABELS as Record<string, unknown>)[name],
      undefined,
      `${name} nåddes via prototypkedjan`,
    );
  }
});

test("V1-LBL-PROTO: ett prototypnamn med giltig familj blir ändå aldrig översatt", () => {
  // Känd familj (run) + prototypnamn som medlem: fortfarande okänd typ, fortfarande rå.
  const label = eventLabel("run.constructor");
  assert.equal(label.text, "run.constructor");
  assert.equal(label.translated, false);
  assert.equal(label.unknown_type, true);
});

test("rå typ är alltid tillgänglig för [raw event_type]-läget", () => {
  assert.equal(eventLabel("run.started").raw_type, "run.started");
});

test("etikettkartan innehåller inga typer utanför planens tabell", () => {
  assert.equal(Object.keys(EVENT_TYPE_LABELS).length, 20);
});

test("alla elva tillstånd har etikett, färgroll och en 'får se ut som klart'-regel", () => {
  assert.equal(lifecyclePresentationCoverage(), true);
  assert.equal(Object.keys(TASK_LIFECYCLE_PRESENTATION).length, TASK_LIFECYCLE.length);
});

test("NEEDS_SPEC är warning och ett arbetsläge — aldrig danger, aldrig ett fel", () => {
  assert.equal(TASK_LIFECYCLE_PRESENTATION.NEEDS_SPEC.tone, "warning");
  assert.equal(TASK_LIFECYCLE_PRESENTATION.NEEDS_SPEC.may_look_done, false);
  assert.match(NEEDS_SPEC_EXPLANATION, /Ingen builder startades/);
});

test("endast DONE får se ut som klart; STOPPED är danger", () => {
  const mayLookDone = TASK_LIFECYCLE.filter(
    (state) => TASK_LIFECYCLE_PRESENTATION[state].may_look_done,
  );
  assert.deepEqual(mayLookDone, ["DONE"]);
  assert.equal(TASK_LIFECYCLE_PRESENTATION.STOPPED.tone, "danger");
  assert.equal(TASK_LIFECYCLE_PRESENTATION.DONE.tone, "success");
});

test("pausknappen påstår aldrig omedelbart stopp", () => {
  assert.equal(PAUSE_AT_SAFE_BOUNDARY_LABEL, "Pausa efter aktuell uppgift");
});

test("saknat värde blir '—', aldrig 0 och aldrig tomt", () => {
  assert.equal(MISSING, "—");
  assert.equal(orMissing(null), "—");
  assert.equal(orMissing(undefined), "—");
  assert.equal(orMissing("   "), "—");
  assert.equal(orMissing(0), "0");
  assert.equal(orMissing("a1b2c3d"), "a1b2c3d");
});
