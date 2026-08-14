/**
 * UX-SWEEP-RESIDUALS · De två återstående fynden ur den mätta UX-genomgången.
 *
 * VAD PROVET ÄGER
 * ---------------
 * R1 (U6) · Strömpanelens huvudbok och avkortningsrad GRUPPERAR sina tal med SAMMA delade
 *           regel som inlämningsytan (`groupDigits` i lib/loop/intake). Ett ogrupperat
 *           "1500 rader i minnet" bredvid ett grupperat bytetal i samma vy är två sanningar
 *           om samma siffra. Maskinläsbara `data-*`-attribut bär däremot fortsatt RÅTALET —
 *           de är för prov och verktyg, inte för ögat.
 * R2 (U13) · Den föråldrade prosan som PÅSTOD att eventströmmen inte är kopplad är borta ur
 *           components/ och app/. Sedan V9 finns strömmen; att förneka den lärde läsaren att
 *           panelen nedanför var dekoration. Den ärliga begränsningen som står kvar är en
 *           ANNAN: fasmarkörerna härleds fortfarande bara ur snapshoten.
 * R3       · Den nya prosan tar INTE över transportbadgens påstående. Ordet "Direktström"
 *           ägs av lib/loop/realtime (läget `live`) och får bara stå där en ström faktiskt
 *           är öppen — aldrig i en statisk mening i fasraden eller statusraden.
 *
 * HARNESS-NOT: samma skäl som i tests/loop/v2-maskinen-shell.test.ts — tsconfig har
 * `jsx: "preserve"`, så komponenterna behöver en global React när de renderas utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import EventStream from "../../components/loop/EventStream";
import PhaseRail from "../../components/loop/PhaseRail";
import RunStatusBar from "../../components/loop/RunStatusBar";
import { groupDigits } from "../../lib/loop/intake";
import {
  TRANSPORT_PRESENTATION,
  createTailStore,
  idleSnapshot,
  type TailSnapshot,
} from "../../lib/loop/realtime";
import { fixtureSnapshot } from "../../lib/loop/fixtures";
import type { LoopEvent, LoopSnapshot } from "../../lib/loop/schema";

/** Hårt mellanslag: grupperingens tecken, skrivet som escape så provet inte beror på editorn. */
const GROUP_SEPARATOR = "\u00A0";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function sourceOf(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), "utf8");
}

/** Varje .ts/.tsx/.css under de UI-träd som /loop faktiskt renderar ur. */
function uiSourceFiles(): { path: string; source: string }[] {
  return ["components", "app"].flatMap((dir) => {
    const root = join(REPO_ROOT, dir);
    return readdirSync(root, { recursive: true, encoding: "utf8" })
      .map((name) => join(root, name))
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .map((path) => ({ path, source: readFileSync(path, "utf8") }));
  });
}

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

/** Ett avtalsenligt event. Samma form som V9:s prov använder. */
function ev(seq: number): LoopEvent {
  return {
    schema_version: "1.0.0",
    event_id: `e-${seq}`,
    seq,
    ts: new Date(Date.UTC(2026, 0, 1, 0, 0, Math.min(seq, 59))).toISOString(),
    run_id: "run-a",
    task_id: null,
    attempt_id: null,
    event_type: "run.started",
    payload: {},
    evidence_refs: [],
  };
}

function range(from: number, to: number): LoopEvent[] {
  const out: LoopEvent[] = [];
  for (let seq = from; seq <= to; seq += 1) out.push(ev(seq));
  return out;
}

/** Fyrsiffriga räknare hela vägen: rader, dubbletter och ogiltiga rader. */
const TOTAL_ROWS = 1500;
const INVALID_ROWS = 1234;
const VISIBLE_ROWS = 1100;

function bigSnapshot(): TailSnapshot {
  const store = createTailStore();
  store.ingest(range(1, TOTAL_ROWS), "backfill");
  // Samma leverans en gång till: dedupen räknar upp, ingen andra rad läggs till.
  store.ingest(range(1, TOTAL_ROWS), "stream");
  // Rader som inte validerar mot eventkontraktet. De räknas, aldrig tystas.
  store.ingest(
    Array.from({ length: INVALID_ROWS }, () => ({ not: "an event" })),
    "stream",
  );
  return {
    connection: { ...idleSnapshot().connection, mode: "live", realtime: true, cursor: TOTAL_ROWS },
    stream: store.view(),
    stats: store.stats(),
  };
}

/* ── R1 · Strömmens tal grupperas som inlämningsytans ─────────────────────── */

test("R1: huvudboken och avkortningsraden grupperar sina tal — samma regel som resten av /loop", () => {
  const snapshot = bigSnapshot();
  assert.equal(snapshot.stats.retained, TOTAL_ROWS, "provets butik bär inte fyrsiffriga tal");
  assert.equal(snapshot.stats.duplicates, TOTAL_ROWS);
  assert.equal(snapshot.stats.invalid, INVALID_ROWS);

  const html = renderToStaticMarkup(
    createElement(EventStream, { snapshot, maxRows: VISIBLE_ROWS }),
  );

  // Förväntan uttrycks med SAMMA hjälpare som vyn använder — annars mäter provet en kopia.
  for (const expected of [
    `${groupDigits(TOTAL_ROWS)} rader i minnet`,
    `${groupDigits(TOTAL_ROWS)} dubbletter avvisade`,
    `${groupDigits(INVALID_ROWS)} ogiltiga rader`,
    `Visar de ${groupDigits(VISIBLE_ROWS)} senaste raderna av ${groupDigits(TOTAL_ROWS)} i minnet`,
  ]) {
    assert.ok(html.includes(expected), `strömmen skriver inte ut grupperat: ${expected}`);
  }

  // …och det ogrupperade talet finns inte kvar i den lästa texten.
  for (const ungrouped of [
    `${TOTAL_ROWS} rader i minnet`,
    `${TOTAL_ROWS} dubbletter avvisade`,
    `${INVALID_ROWS} ogiltiga rader`,
    `Visar de ${VISIBLE_ROWS} senaste`,
  ]) {
    assert.ok(!html.includes(ungrouped), `ogrupperat tal ligger kvar: ${ungrouped}`);
  }

  // Maskinläsbara attribut bär råtalet. Grupperingen är presentation, aldrig data.
  assert.ok(html.includes(`data-ledger-rows="${TOTAL_ROWS}"`), "huvudbokens attribut bär inte råtal");
  assert.ok(html.includes(`data-ledger-duplicates="${TOTAL_ROWS}"`));
  assert.ok(html.includes(`data-ledger-invalid="${INVALID_ROWS}"`));
  assert.ok(html.includes(`data-stream-truncated="${TOTAL_ROWS - VISIBLE_ROWS}"`));
  assert.ok(
    !new RegExp(`data-[\\w-]+="[^"]*${GROUP_SEPARATOR}`).test(html),
    "ett maskinläsbart attribut bär presentationens grupperingstecken",
  );
});

test("R1-STUB: grupperingen är den DELADE hjälparen — ingen andra implementation i panelen", () => {
  // Hjälparen fäller sin egen lögnstub: det ogrupperade talet är inte lika med det grupperade.
  assert.notEqual(groupDigits(1500), "1500");
  assert.equal(groupDigits(1500), `1${GROUP_SEPARATOR}500`);
  assert.equal(groupDigits(999), "999", "tresiffriga tal grupperades ändå");

  const panel = sourceOf("components/loop/EventStream.tsx");
  assert.match(
    panel,
    /import \{ groupDigits \} from "@\/lib\/loop\/intake"/,
    "strömpanelen använder inte den delade grupperingen",
  );
  assert.ok(
    !/function groupDigits|toLocaleString/.test(panel),
    "strömpanelen bär en andra implementation av grupperingen",
  );
});

/* ── R2 · Den föråldrade prosan om en frånkopplad ström är borta ───────────── */

/** Exakt de meningsfragment som förnekade strömmen. De får inte finnas i någon UI-källa. */
const STALE_STREAM_CLAIMS = [
  "eventströmmen, som inte är kopplad i den här skivan",
  "Eventströmmen kopplas in i en senare skiva.",
];

test("R2: ingen UI-källa påstår längre att eventströmmen inte är kopplad", () => {
  const files = uiSourceFiles();
  assert.ok(files.length >= 8, "hittade inget UI-träd — den statiska kontrollen mäter ingenting");

  for (const { path, source } of files) {
    for (const claim of STALE_STREAM_CLAIMS) {
      assert.ok(!source.includes(claim), `föråldrat påstående om strömmen ligger kvar i ${path}`);
    }
  }

  // Lögnstub: en fil som BAR meningen skulle verkligen fällas av kontrollen ovan.
  for (const claim of STALE_STREAM_CLAIMS) {
    const wouldBeCaught = `<p className="mk-hint">Fasmarkörer kommer ur ${claim}</p>`;
    assert.ok(wouldBeCaught.includes(claim), "kontrollen fäller inte sin egen lögnstub");
  }
});

test("R2: den ÄRLIGA begränsningen står kvar — fasmärken kommer fortfarande bara ur snapshoten", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task, "fixturen saknar aktuell uppgift");

  const html = renderToStaticMarkup(createElement(PhaseRail, { task }));
  assert.match(html, /Eventströmmen finns/, "fasraden säger inte att strömmen finns");
  assert.match(html, /snapshoten/, "fasraden säger inte varifrån fasmärkena kommer");
  assert.ok(
    !html.includes('data-mark="done"'),
    "fasraden märkte en fas klar — prosan fick ändras, aldrig beteendet",
  );

  const bar = renderToStaticMarkup(createElement(RunStatusBar, { snapshot, fixture: true }));
  assert.match(bar, /strömpanelen/i, "statusraden hänvisar inte till panelen som bär läget");
  assert.ok(bar.includes('data-liveness="unknown"'), "statusraden ändrade beteende, inte bara prosa");
});

/* ── R3 · "Direktström" ägs av transportbadgen ────────────────────────────── */

test("R3: den nya prosan påstår ingen direktström — ordet ägs av transportläget", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task);

  const phaseRail = renderToStaticMarkup(createElement(PhaseRail, { task }));
  const statusBar = renderToStaticMarkup(createElement(RunStatusBar, { snapshot, fixture: true }));

  for (const [name, html] of [
    ["fasraden", phaseRail],
    ["statusraden", statusBar],
  ] as const) {
    assert.ok(!html.includes("Direktström"), `${name} påstår direktström utan att äga läget`);
    assert.ok(!/\brealtid\b/i.test(html), `${name} påstår realtid utan att äga läget`);
  }

  // Positiv kontroll: ordet finns kvar där det hör hemma — och bara i läget `live`.
  assert.equal(TRANSPORT_PRESENTATION.live.label, "Direktström");
  assert.equal(TRANSPORT_PRESENTATION.live.realtime, true);
  assert.equal(TRANSPORT_PRESENTATION.polling.realtime, false);
  const live = renderToStaticMarkup(createElement(EventStream, { snapshot: bigSnapshot() }));
  assert.ok(live.includes("Direktström"), "transportbadgen tappade sitt eget läge");
  assert.ok(live.includes('data-realtime="true"'), "badgen bär inte läget maskinläsbart");
});
