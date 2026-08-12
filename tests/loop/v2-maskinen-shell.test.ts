/**
 * V2 · MASKINEN-SHELL (fixturbaserad).
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V2:
 *   (1) /loop renderar tre kolumner ur fixtur, BAKOM LOOP_ENABLED (fail-closed när den är av).
 *   (2) Alla elva TASK_LIFECYCLE-tillstånd — inklusive STOPPED — har distinkt rendering.
 *   (3) Ett fixturfält satt till null renderar exakt "—", aldrig 0 och aldrig tomt.
 *   (4) Negativa kontroller: NEEDS_SPEC som fel · fallet/ej avslutat arbete som ser klart ut ·
 *       procentsats eller framstegsstapel någonstans i /loop-trädet.
 *
 * HARNESS-NOT: tsconfig.json har `jsx: "preserve"` (Next kompilerar själv), så esbuild/tsx
 * lämnar JSX till den KLASSISKA transformen `React.createElement`. Egna komponenter importerar
 * därför React explicit; de DELADE komponenterna (PageHeader, Graceful) gör det inte, och
 * behöver en global React när de renderas utanför Next. Raden nedan är ett provharness-skal —
 * den påverkar inte produktionsbygget, som använder Next egen JSX-transform.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import MaskinShell from "../../components/loop/MaskinShell";
import TaskCard from "../../components/loop/TaskCard";
import PhaseRail, { activePhaseFromSnapshot } from "../../components/loop/PhaseRail";
import { splitCompleted } from "../../components/loop/CompletedColumn";
import { groupByState } from "../../components/loop/BacklogColumn";
import { isLoopEnabled } from "../../components/loop/flag";
import { LOOP_CSS, shortSha } from "../../components/loop/ui";
import MaskinenPage from "../../app/(app)/loop/page";
import { FIXTURE_MODE, RAW_FIXTURES, fixtureSnapshot } from "../../lib/loop/fixtures";
import {
  MISSING,
  NEEDS_SPEC_EXPLANATION,
  TASK_LIFECYCLE_PRESENTATION,
} from "../../lib/loop/labels";
import {
  PHASES,
  TASK_LIFECYCLE,
  validateSnapshot,
  type LoopSnapshot,
  type TaskLifecycle,
  type TaskView,
} from "../../lib/loop/schema";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

function renderShell(snapshot: LoopSnapshot | null, fixture = true): string {
  return renderToStaticMarkup(createElement(MaskinShell, { snapshot, fixture }));
}

/**
 * Markupen utan stilarket. Påståenden om vad UI:t SÄGER ska mätas på det som syns, inte på
 * CSS-regler och deras kommentarer. De negativa kontrollerna läser tvärtom hela markupen,
 * stilarket inkluderat — där är just CSS:en det som ska granskas.
 */
function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/** Alla <article>-kort i markupen. Korten nästlas aldrig i varandra. */
function cards(html: string): string[] {
  return html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
}

function cardFor(html: string, taskId: string): string {
  const found = cards(html).find((card) => card.includes(`data-task-id="${taskId}"`));
  assert.ok(found, `hittade inget kort för ${taskId}`);
  return found;
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/** Textinnehållet i varje element som märkts som saknat värde. */
function missingValues(html: string): string[] {
  const matches = html.match(/data-missing="true"[^>]*>([^<]*)</g) ?? [];
  return matches.map((m) => m.replace(/^[\s\S]*>/, "").replace(/<$/, ""));
}

/**
 * Kod utan kommentarer. De negativa kontrollerna ska mäta vad UI:t GÖR, inte vilka regler
 * filhuvudena beskriver — en fil som förbjuder framstegsstaplar i klartext får inte fällas
 * av sitt eget förbud. Den renderade markupen provas separat och täcker CSS:en.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Alla filer i /loop-trädet — komponentträdet OCH routen. */
function loopSourceFiles(): { path: string; source: string }[] {
  const dirs = [join(REPO_ROOT, "components/loop"), join(REPO_ROOT, "app/(app)/loop")];
  return dirs.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .map((name) => join(dir, name))
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .map((path) => ({ path, source: stripComments(readFileSync(path, "utf8")) })),
  );
}

/**
 * En avtalsenlig snapshot där ALLA elva tillstånd finns samtidigt. Korten klonas ur den
 * GENERERADE fixturen (aldrig en handskriven parallellmodell) och körs genom V1:s
 * validateSnapshot — går det inte igenom är provet fel, inte UI:t.
 */
function snapshotWithEveryState(): { snapshot: LoopSnapshot; idOf: (s: TaskLifecycle) => string } {
  const base = snapshotOrThrow();
  const template = base.backlog[0];
  assert.ok(template, "fixturens backlog är tom");
  const idOf = (state: TaskLifecycle) => `alla-${state}`;
  const backlog: TaskView[] = TASK_LIFECYCLE.map((state) => ({
    ...structuredClone(template),
    task_id: idOf(state),
    title: `Uppgift i ${state}`,
    state,
  }));
  const candidate = { ...structuredClone(base), current_task: null, backlog, completed: [] };
  const validated = validateSnapshot(candidate);
  assert.equal(validated.ok, true, "provets snapshot bröt mot V1-kontraktet");
  return { snapshot: (validated as { ok: true; data: LoopSnapshot }).data, idOf };
}

/* ── 1 · LOOP_ENABLED — grinden ───────────────────────────────────────────── */

test("V2-GATE: LOOP_ENABLED är exakt-matchning mot 'true' och fail-closed för allt annat", () => {
  assert.equal(isLoopEnabled({ LOOP_ENABLED: "true" }), true);
  for (const value of ["false", "TRUE", "True", "1", "yes", "on", " true", "", undefined]) {
    assert.equal(
      isLoopEnabled({ LOOP_ENABLED: value }),
      false,
      `LOOP_ENABLED=${String(value)} öppnade Maskinen`,
    );
  }
  assert.equal(isLoopEnabled({}), false);
});

test("V2-GATE: /loop finns inte när flaggan är av — routen faller stängd, inte till en stubbe", () => {
  const before = process.env.LOOP_ENABLED;
  try {
    delete process.env.LOOP_ENABLED;
    assert.throws(
      () => MaskinenPage(),
      (error: Error & { digest?: string }) => {
        // Next signalerar 404 med exakt den här digesten.
        assert.match(String(error.digest ?? error.message), /NEXT_HTTP_ERROR_FALLBACK;404/);
        return true;
      },
      "sidan renderade trots att LOOP_ENABLED var av",
    );

    process.env.LOOP_ENABLED = "false";
    assert.throws(() => MaskinenPage(), /NEXT_HTTP_ERROR_FALLBACK;404/);
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
});

test("V2-GATE: /loop renderar först när flaggan är på, och läser flaggan vid varje request", () => {
  const before = process.env.LOOP_ENABLED;
  try {
    process.env.LOOP_ENABLED = "true";
    const page = MaskinenPage() as ReactElement;
    assert.ok(page, "sidan returnerade inget träd med LOOP_ENABLED=true");
    // force-dynamic: flaggan får aldrig bakas in vid build.
    const route = readFileSync(join(REPO_ROOT, "app/(app)/loop/page.tsx"), "utf8");
    assert.match(route, /export const dynamic = "force-dynamic"/);
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
});

/* ── 2 · V1-fixturen och V1-kontrakten är datakällan ──────────────────────── */

test("V2-DATA: routen matar skalet med EXAKT V1:s genererade fixtur — ingen egen modell", () => {
  const before = process.env.LOOP_ENABLED;
  try {
    process.env.LOOP_ENABLED = "true";
    const page = MaskinenPage() as ReactElement;
    const children = React.Children.toArray(
      (page.props as { children: React.ReactNode }).children,
    ) as ReactElement[];
    const shell = children.find((child) => child.type === MaskinShell);
    assert.ok(shell, "routen renderar inte MaskinShell");
    const props = shell.props as { snapshot: LoopSnapshot | null; fixture: boolean };
    assert.deepEqual(props.snapshot, fixtureSnapshot());
    assert.deepEqual(props.snapshot, validateSnapshot(RAW_FIXTURES.snapshot).ok
      ? snapshotOrThrow()
      : null);
    assert.equal(props.fixture, FIXTURE_MODE, "fixturläget märks inte ut för skalet");
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
});

test("V2-DATA: skalet renderar tre kolumner och snapshotens egna värden, inte påhittade", () => {
  const snapshot = snapshotOrThrow();
  const html = renderShell(snapshot);

  for (const column of ["backlog", "current", "completed"]) {
    assert.ok(html.includes(`data-column="${column}"`), `kolumnen ${column} saknas`);
  }
  assert.equal((html.match(/data-column="/g) ?? []).length, 3, "antalet kolumner är inte tre");

  assert.ok(html.includes(snapshot.run_id), "kör-id ur snapshoten saknas");
  assert.ok(
    html.includes(shortSha(snapshot.current_main.sha)),
    "controllerns bekräftade main-SHA saknas",
  );
  assert.ok(html.includes("FIXTUR"), "fixturläget märks inte ut i UI:t");
  // Ingen liveness-signal finns i den här skivan → aldrig AUTONOM.
  assert.ok(html.includes('data-liveness="unknown"'));
  assert.ok(
    !/AUTONOM/.test(withoutStyles(html)),
    "UI:t påstod AUTONOM utan liveness-signal",
  );

  /**
   * Planen skiljer glyferna åt: "● AUTONOM" endast med faktisk signal, annars "○ OKÄNT".
   * Formen får därför inte vara densamma i de två lägena. Utan signal ska punkten vara
   * IHÅLIG — en fylld punkt bredvid OKÄNT läses vid en snabb blick som en liveness-markör
   * även när färg och etikett är ärliga.
   */
  assert.match(
    LOOP_CSS,
    /\.mk-liveness-dot\s*\{[^}]*background:\s*transparent/,
    "punkten för okänd liveness är fylld — samma form som live-signalens markör",
  );
  assert.match(
    LOOP_CSS,
    /\.mk-liveness-dot\s*\{[^}]*box-shadow:\s*inset 0 0 0 1px var\(--border-strong\)/,
    "den ihåliga punkten saknar ring och syns inte",
  );
  assert.ok(html.includes(LOOP_CSS), "stilarket når aldrig markupen");

  // Varje kort i markupen motsvarar en task ur snapshoten — inga extra, inga uppfunna.
  const ids = cards(html).map((card) => attr(card, "data-task-id"));
  const expected = [
    ...snapshot.backlog.map((t) => t.task_id),
    ...(snapshot.current_task ? [snapshot.current_task.task_id] : []),
    ...snapshot.completed.map((t) => t.task_id),
  ];
  assert.deepEqual([...ids].sort(), [...expected].sort());
});

test("V2-DATA: kolumnerna speglar snapshotens listor — ingen uppgift flyttas eller härleds", () => {
  const snapshot = snapshotOrThrow();
  assert.deepEqual(
    groupByState(snapshot.backlog).flatMap((g) => g.tasks.map((t) => t.task_id)).sort(),
    snapshot.backlog.map((t) => t.task_id).sort(),
  );
  const split = splitCompleted(snapshot.completed);
  assert.deepEqual(
    [...split.done, ...split.notPromoted].map((t) => t.task_id).sort(),
    snapshot.completed.map((t) => t.task_id).sort(),
  );
  assert.ok(split.done.every((t) => t.state === "DONE"));
  assert.ok(split.notPromoted.every((t) => t.state !== "DONE"));
});

/* ── 3 · Elva tillstånd, distinkt renderade ───────────────────────────────── */

test("V2-LIFECYCLE: fixturen täcker alla elva tillstånd över de tre kolumnerna", () => {
  const snapshot = snapshotOrThrow();
  const states = new Set<string>([
    ...snapshot.backlog.map((t) => t.state),
    ...(snapshot.current_task ? [snapshot.current_task.state] : []),
    ...snapshot.completed.map((t) => t.state),
  ]);
  assert.deepEqual([...states].sort(), [...TASK_LIFECYCLE].sort());
});

test("V2-LIFECYCLE: alla elva tillstånd får distinkt rendering — etikett, färgroll och märkning", () => {
  const { snapshot, idOf } = snapshotWithEveryState();
  const html = renderShell(snapshot);

  const labels = new Set<string>();
  const stateAttrs = new Set<string>();

  for (const state of TASK_LIFECYCLE) {
    const card = cardFor(html, idOf(state));
    const presentation = TASK_LIFECYCLE_PRESENTATION[state];

    assert.equal(attr(card, "data-state"), state);
    assert.equal(attr(card, "data-tone"), presentation.tone, `fel färgroll för ${state}`);
    assert.equal(
      attr(card, "data-may-look-done"),
      presentation.may_look_done ? "true" : "false",
    );
    assert.ok(card.includes(presentation.label), `etiketten för ${state} renderades inte`);
    assert.ok(card.includes(`data-state-badge="${state}"`), `statusmärket för ${state} saknas`);
    assert.ok(card.includes(`mk-tone-${presentation.tone}`));

    labels.add(presentation.label);
    stateAttrs.add(state);
  }

  assert.equal(labels.size, 11, "två tillstånd delar etikett — renderingen är inte distinkt");
  assert.equal(stateAttrs.size, 11);
  // Grupperingen i backlog använder V1:s ordning och inget UI-eget tillstånd.
  assert.deepEqual(groupByState(snapshot.backlog).map((g) => g.state), [...TASK_LIFECYCLE]);
});

test("V2-LIFECYCLE: STOPPED finns, är skilt från DONE och ser aldrig klart ut", () => {
  const { snapshot, idOf } = snapshotWithEveryState();
  const html = renderShell(snapshot);

  const stopped = cardFor(html, idOf("STOPPED"));
  const done = cardFor(html, idOf("DONE"));

  assert.notEqual(TASK_LIFECYCLE_PRESENTATION.STOPPED.label, TASK_LIFECYCLE_PRESENTATION.DONE.label);
  assert.equal(attr(stopped, "data-tone"), "danger");
  assert.equal(attr(done, "data-tone"), "success");
  assert.equal(attr(stopped, "data-may-look-done"), "false");
  assert.equal(attr(done, "data-may-look-done"), "true");

  assert.ok(stopped.includes("Stoppad"));
  assert.ok(!stopped.includes("mk-tone-success"), "STOPPED bar success-färg — såg klart ut");
  assert.ok(!/Klar\b/.test(stopped), "STOPPED beskrevs som klar");
});

test("V2-LIFECYCLE: inget tillstånd utom DONE får se klart ut", () => {
  const { snapshot, idOf } = snapshotWithEveryState();
  const html = renderShell(snapshot);

  for (const state of TASK_LIFECYCLE.filter((s) => s !== "DONE")) {
    const card = cardFor(html, idOf(state));
    assert.equal(attr(card, "data-may-look-done"), "false", `${state} fick se klart ut`);
    assert.ok(!card.includes("mk-tone-success"), `${state} renderades med success-färg`);
  }
  // Endast DONE bär may_look_done i V1:s presentation — UI:t utökar aldrig den mängden.
  assert.deepEqual(
    TASK_LIFECYCLE.filter((s) => TASK_LIFECYCLE_PRESENTATION[s].may_look_done),
    ["DONE"],
  );
});

/* ── 4 · NEEDS_SPEC är ett arbetsläge, aldrig ett fel ─────────────────────── */

test("V2-NEEDS-SPEC: warning, aldrig danger, med planens förklaring och utan felspråk", () => {
  const { snapshot, idOf } = snapshotWithEveryState();
  const html = renderShell(snapshot);
  const card = cardFor(html, idOf("NEEDS_SPEC"));

  assert.equal(attr(card, "data-tone"), "warning");
  assert.equal(TASK_LIFECYCLE_PRESENTATION.NEEDS_SPEC.tone, "warning");
  assert.ok(card.includes("mk-tone-warning"));
  assert.ok(!card.includes("mk-tone-danger"), "NEEDS_SPEC renderades som fel");
  assert.ok(card.includes('data-needs-spec-explanation="true"'));
  assert.ok(card.includes(NEEDS_SPEC_EXPLANATION), "planens förklaringstext saknas");
  assert.ok(!/\bFEL\b|\bfelaktig|\bError\b|misslyckad/i.test(card), "NEEDS_SPEC beskrevs som fel");
  // Behöver spec är inte klart — och inte heller stoppat.
  assert.equal(attr(card, "data-may-look-done"), "false");
});

/* ── 5 · null → exakt "—" ─────────────────────────────────────────────────── */

test("V2-MISSING: varje saknat fält renderas som exakt em-streck, aldrig 0 eller tomt", () => {
  const snapshot = snapshotOrThrow();
  const html = renderShell(snapshot);

  const values = missingValues(html);
  assert.ok(values.length > 0, "inget fält märktes som saknat — provet mäter ingenting");
  for (const value of values) {
    assert.equal(value, MISSING, `saknat fält renderades som ${JSON.stringify(value)}`);
  }
  assert.equal(MISSING, "—");
  assert.ok(!/>\s*(null|undefined|NaN)\s*</.test(html), "råa tomvärden läckte till UI:t");
});

test("V2-MISSING: nullade fält i ett fixturkort blir '—', inte 0, tomt eller en gissning", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task, "fixturen saknar aktuell uppgift");
  assert.equal(task.attempt.budget, null);
  assert.equal(task.candidate_sha, null);
  assert.equal(task.builder.agent, null);
  assert.equal(task.risk_class, null);

  const html = renderToStaticMarkup(createElement(TaskCard, { task, variant: "full" }));

  // Försöksbudget saknas i kontraktet → "1 av —", aldrig "1 av 0" och aldrig "1 av 3".
  assert.ok(html.includes(`${task.attempt.n} av ${MISSING}`), "försöksbudgeten gissades");
  assert.ok(!/av\s*0\b/.test(html), "saknad budget renderades som 0");
  for (const value of missingValues(html)) assert.equal(value, MISSING);

  // Saknas BÅDE försöksnummer och budget blir fältet exakt ett em-streck, aldrig "— av —".
  const bothNull: TaskView = {
    ...structuredClone(task),
    attempt: { n: null, budget: null },
  };
  const bothNullHtml = renderToStaticMarkup(
    createElement(TaskCard, { task: bothNull, variant: "full" }),
  );
  assert.ok(!bothNullHtml.includes(`${MISSING} av ${MISSING}`), "tomt försöksfält lästes som värde");
  for (const value of missingValues(bothNullHtml)) assert.equal(value, MISSING);

  // Opaka, olösta kontrakt läses aldrig fältvis.
  assert.equal(task.merge, null);
  assert.equal(task.promotion, null);
  assert.ok(html.includes("Merge"));
  assert.ok(html.includes("Promotion"));

  // NOT_RUN är visuellt SKILT från PASS.
  assert.ok(html.includes('data-verdict="NOT_RUN"'));
  assert.ok(html.includes("EJ KÖRD"));
  assert.ok(!/data-verdict="NOT_RUN"[^>]*mk-tone-success/.test(html));
});

test("V2-MISSING: en snapshot som inte validerar ger ett synligt läge, aldrig en tyst tom vy", () => {
  const html = renderShell(null);
  assert.ok(html.includes("Ingen giltig snapshot"));
  assert.equal(cards(html).length, 0);
});

/* ── 6 · Fasraden gissar aldrig ───────────────────────────────────────────── */

test("V2-PHASE: fasraden markerar bara snapshotens fas, och bara för arbete som pågår", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task);
  assert.equal(task.state, "WORKING");
  assert.equal(activePhaseFromSnapshot(task), task.phase);

  const html = renderToStaticMarkup(createElement(PhaseRail, { task }));
  assert.equal((html.match(/data-phase="/g) ?? []).length, PHASES.length);
  assert.equal((html.match(/data-mark="active"/g) ?? []).length, 1);
  assert.ok(!html.includes('data-mark="done"'), "en fas märktes klar utan evidens ur event");
  assert.ok(html.includes('data-mark="not_reached"'));
  assert.ok(html.includes(MISSING), "omarkerade faser visas inte som —");
});

test("V2-PHASE: en STOPPAD uppgift har ingen pågående fas — stopp ser aldrig ut som arbete", () => {
  const snapshot = snapshotOrThrow();
  const template = snapshot.current_task;
  assert.ok(template);
  const stopped: TaskView = { ...structuredClone(template), state: "STOPPED" };
  assert.equal(stopped.phase, "BUILD");
  assert.equal(activePhaseFromSnapshot(stopped), null);

  const html = renderToStaticMarkup(createElement(PhaseRail, { task: stopped }));
  assert.ok(!html.includes('data-mark="active"'), "en stoppad uppgift såg ut att arbeta");
  assert.ok(!html.includes('data-mark="done"'));
});

/* ── 7 · Negativa kontroller: procent, framstegsstapel, fejkad liveness ───── */

test("V2-NEG: ingen procentsats eller framstegsstapel i hela /loop-trädets källkod", () => {
  const files = loopSourceFiles();
  assert.ok(files.length >= 8, "hittade inte /loop-trädet — den statiska kontrollen mäter inget");

  for (const { path, source } of files) {
    assert.ok(!source.includes("%"), `procenttecken i ${path}`);
    assert.ok(
      !/<progress|role=["']progressbar|aria-valuenow|<meter\b/i.test(source),
      `framstegselement i ${path}`,
    );
    assert.ok(
      !/\b(progressbar|progress-bar|framstegsstapel|procentsats|percentage)\b/i.test(source),
      `framstegs-/procentsemantik i ${path}`,
    );
    assert.ok(
      !/@keyframes|animation:|animate-|\bpulse\b|\bblink\b/i.test(source),
      `fabricerad liveness-animation i ${path}`,
    );
  }
});

test("V2-NEG: ingen procent, stapel eller kvot som framsteg i den renderade markupen", () => {
  const { snapshot } = snapshotWithEveryState();
  const html = [renderShell(snapshotOrThrow()), renderShell(snapshot), renderShell(null)].join("\n");

  assert.ok(!html.includes("%"), "procenttecken i renderad /loop-markup");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement i markup");
  assert.ok(!/\d+\s*(av|\/)\s*\d+\s*(klara|klart|färdiga|slutförda)/i.test(html), "kvot som framsteg");
  assert.ok(!/@keyframes|animation:/i.test(html), "animation i /loop-markup");
});

test("V2-NEG: skalet hämtar ingen data själv och rör ingen transport eller authority", () => {
  const shell = stripComments(
    readFileSync(join(REPO_ROOT, "components/loop/MaskinShell.tsx"), "utf8"),
  );
  assert.ok(!/fixtures|fetch\(|supabase|octokit/i.test(shell), "skalet hämtar data själv");

  for (const { path, source } of loopSourceFiles()) {
    assert.ok(
      !/github-write|github-read|GITHUB_TOKEN|child_process|simple-git|LOOP_SUPABASE/i.test(source),
      `${path} rör en väg som /loop aldrig äger`,
    );
    assert.ok(
      !/PipelinePanel|ProcessGuide|MetricsPanel/.test(source),
      `${path} importerar en panel som /loop inte ska dela`,
    );
  }
});
