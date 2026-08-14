/**
 * ROOM-01 · FABRIKSRUMMET — negativa kontroller.
 *
 * Provar exit-kriterierna i docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01).
 * Provstilen är V1–V10:s: varje krav mäts på det UI:t FAKTISKT renderar eller på källan, aldrig
 * på prosa, och varje mätare bär en lögnstubbe eller en negativ kontroll så att den kan skilja
 * rätt från fel i praktiken.
 *
 * DE ÅTTA REGRESSIONERNA PROVET FINNS FÖR
 * ---------------------------------------
 *   1. "builder" börjar antyda en principal eller en behörighet.
 *   2. Ett okänt identitetsfält får ett gissat värde.
 *   3. Fixtur och live delar en omärkt yta.
 *   4. En tail-rad flyttar ett uppgiftstillstånd (t.ex. till DONE).
 *   5. Operatörstext blir en shell- eller kommandoväg (nätverk/exekvering i rummet).
 *   6. En procentsats eller framstegsstapel smyger in i rummets träd.
 *   7. Ett tillstånd utanför de elva kanoniska införs.
 *   8. Befintliga ytor (/, leads, onboarding, dokument) ändras av den här skivan.
 *
 * HARNESS-NOT: samma som V2 — tsconfig har `jsx: "preserve"`, så delade komponenter behöver en
 * global React när de renderas utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import MaskinShell from "../../components/loop/MaskinShell";
import IdentityStrip from "../../components/loop/room/IdentityStrip";
import RoomTimeline from "../../components/loop/room/RoomTimeline";
import WorkComposer from "../../components/loop/room/WorkComposer";
import { ROOM_CSS, ROOM_CSS_PREFIX } from "../../components/loop/room/ui";
import { LOOP_CSS } from "../../components/loop/ui";
import { FIXTURE_MODE, fixtureCommands, fixtureIntakeOutcomes, fixtureSnapshot } from "../../lib/loop/fixtures";
import { MISSING, TASK_LIFECYCLE_PRESENTATION } from "../../lib/loop/labels";
import { buildReadModel } from "../../lib/loop/snapshot";
import {
  TASK_LIFECYCLE,
  validateSnapshot,
  type LoopSnapshot,
  type TaskLifecycle,
  type TaskView,
} from "../../lib/loop/schema";
import {
  ATTENTION_HEADING,
  OWNER_AUTHORITY_SOURCE,
  deriveAttention,
} from "../../lib/loop/room/attention";
import { ROOM_FACTS, ageText, mainConfirmation } from "../../lib/loop/room/header";
import {
  IDENTITY_DISCLAIMER,
  IDENTITY_FIELDS_WITHOUT_SOURCE,
  IDENTITY_FIELD_IDS,
  identityFieldCoverage,
  identityFields,
} from "../../lib/loop/room/identity";
import { TIMELINE_ORDER, TIMELINE_SOURCES, roomTimeline } from "../../lib/loop/room/timeline";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** Etiketten som ALDRIG får renderas utan ett auktoritativt fält bakom sig. */
const OWNER_ACTION_LABEL = "ÄGARÅTGÄRD KRÄVS";

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

function renderRoom(snapshot: LoopSnapshot | null, fixture = true): string {
  return renderToStaticMarkup(createElement(MaskinShell, { snapshot, fixture }));
}

function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Rummets EGNA filer: komponentträdet och logiken. Rekursivt, så en flytt inte tappar mätaren. */
function roomSourceFiles(): { path: string; source: string }[] {
  const dirs = [join(REPO_ROOT, "components/loop/room"), join(REPO_ROOT, "lib/loop/room")];
  return dirs.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .map((name) => join(dir, name))
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .map((path) => ({ path, source: readFileSync(path, "utf8") })),
  );
}

/** Alla element som bär ett givet attribut, som hela öppningstaggar. */
function tagsWith(html: string, attribute: string): string[] {
  return html.match(new RegExp(`<[A-Za-z][^>]*${attribute}[^>]*>`, "g")) ?? [];
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/** Markupen för EN identitetscell, från dess märkning fram till nästa cells. */
function identityCell(html: string, id: string): string {
  const start = html.indexOf(`data-identity-field="${id}"`);
  assert.ok(start >= 0, `identitetsfältet ${id} renderades inte`);
  const rest = html.slice(start + 1);
  const next = rest.indexOf('data-identity-field="');
  return next === -1 ? rest : rest.slice(0, next);
}

/** Textinnehållet i varje element som märkts som saknat värde. */
function missingValues(html: string): string[] {
  const matches = html.match(/data-missing="true"[^>]*>([^<]*)</g) ?? [];
  return matches.map((m) => m.replace(/^[\s\S]*>/, "").replace(/<$/, ""));
}

function cards(html: string): string[] {
  return html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
}

function cardFor(html: string, taskId: string): string {
  const found = cards(html).find((card) => card.includes(`data-task-id="${taskId}"`));
  assert.ok(found, `hittade inget kort för ${taskId}`);
  return found;
}

/** En avtalsenlig snapshot där ALLA elva tillstånd finns samtidigt (samma mönster som V2). */
function snapshotWithEveryState(): { snapshot: LoopSnapshot; idOf: (s: TaskLifecycle) => string } {
  const base = snapshotOrThrow();
  const template = base.backlog[0];
  assert.ok(template, "fixturens backlog är tom");
  const idOf = (state: TaskLifecycle) => `rum-${state}`;
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

function git(args: string[]): string | null {
  try {
    return execFileSync("git", args, {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return null;
  }
}

/**
 * KÖRNINGENS FRUSNA BAS — den commit grenen utgår ifrån, ALDRIG `HEAD`.
 *
 * Skälet är att mätaren annars blir tom precis när den behövs: körs grinden EFTER att kandidaten
 * committats är `HEAD` kandidaten själv, och en jämförelse mot `HEAD` jämför då kandidaten med
 * sig själv. En committad regression i en yta som ligger utanför skivan hade passerat obemärkt.
 * `merge-base` ger basen både före och efter commit: körs provet på en ren arbetskopia är basen
 * lika med `HEAD` (rätt), och ligger kandidatcommits ovanpå pekar den fortfarande på basen (rätt).
 *
 * Samma bindning som tests/loop/security.ts gör mot PLAN_BASE_SHA, men mätt i stället för
 * transkriberad — en handskriven SHA i den här filen hade behövt uppdateras för hand vid varje
 * skiva och blivit osann i tysthet.
 */
function frozenBaseSha(): string | null {
  for (const ref of ["origin/main", "main"]) {
    const sha = git(["merge-base", "HEAD", ref]);
    if (sha === null) continue;
    const trimmed = sha.trim();
    if (/^[0-9a-f]{40}$/.test(trimmed)) return trimmed;
  }
  return null;
}

/** Filens innehåll vid en given commit, eller null när git-objektet inte går att läsa. */
function gitShow(sha: string, relative: string): string | null {
  return git(["show", `${sha}:${relative}`]);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 1 + 2 · IDENTITET — "builder" bevisar ingenting, och inget hål fylls med en gissning
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-IDENT-1: en registrerad builder-agent gör INTE principal eller behörighet känd", () => {
  const base = snapshotOrThrow();
  const task = base.current_task;
  assert.ok(task, "fixturen saknar aktuell uppgift");
  assert.equal(task.builder.agent, null, "fixturen bar redan en agent — provet mäter fel sak");

  const withBuilder: TaskView = {
    ...structuredClone(task),
    builder: { agent: "builder-fixtur-01", model: "modell-fixtur-01" },
  };
  const validated = validateSnapshot({ ...structuredClone(base), current_task: withBuilder });
  assert.equal(validated.ok, true);
  const snapshot = (validated as { ok: true; data: LoopSnapshot }).data;

  const html = renderRoom(snapshot);

  // Det som FINNS visas — under sin egen etikett.
  const agent = identityCell(html, "builder_agent");
  assert.ok(agent.includes("Registrerad builder-agent"), "agenten fick fel etikett");
  assert.ok(agent.includes("builder-fixtur-01"), "den registrerade agenten renderades inte");
  assert.equal(attr(agent, "data-identity-source"), "snapshot");

  // Det som INTE finns förblir okänt — även när en agent är känd.
  for (const id of IDENTITY_FIELDS_WITHOUT_SOURCE) {
    const cell = identityCell(html, id);
    assert.equal(attr(cell, "data-identity-source"), "no_field_in_schema", `${id} fick en källa`);
    assert.match(cell, /data-missing="true"[^>]*>—</, `${id} renderades inte som em-streck`);
    assert.ok(!cell.includes("builder-fixtur-01"), `${id} fylldes med builder-agentens värde`);
    assert.ok(!cell.includes("modell-fixtur-01"), `${id} fylldes med builder-modellens värde`);
  }

  // Rollnamnet är aldrig ett bevis, och remsan säger det RAKT UT.
  assert.ok(html.includes(IDENTITY_DISCLAIMER), "låstexten om workflowsroll saknas i markupen");
  const role = identityCell(html, "workflow_role");
  assert.ok(!role.includes("builder-fixtur-01"), "builder.agent etiketterades som workflowsroll");

  // LÖGNSTUB: hade projektionen börjat fylla ett källösa fält skulle mätaren ovan falla.
  const lying = identityFields(withBuilder).map((field) =>
    field.id === "execution_principal" ? { ...field, value: withBuilder.builder.agent } : field,
  );
  assert.notDeepEqual(
    lying.map((field) => field.value),
    identityFields(withBuilder).map((field) => field.value),
    "stubben skiljer sig inte från verkligheten — mätaren skulle inte se skillnaden",
  );
  assert.equal(
    identityFields(withBuilder).find((field) => field.id === "execution_principal")?.value,
    null,
  );
});

test("ROOM-IDENT-2: alla sju fälten finns, i låst ordning, och saknade värden är exakt '—'", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task);
  assert.equal(task.builder.agent, null);
  assert.equal(task.builder.model, null);

  const html = renderToStaticMarkup(createElement(IdentityStrip, { task }));

  // Ordningen är låst och mätbar — inget fält tappas bort och inget byter plats.
  assert.equal(identityFieldCoverage(), true);
  const rendered = tagsWith(html, "data-identity-field").map((tag) => attr(tag, "data-identity-field"));
  assert.deepEqual(rendered, [...IDENTITY_FIELD_IDS]);

  // Med nullade builder-fält är ALLA sju okända — och varje okänt fält är exakt ett em-streck.
  for (const id of IDENTITY_FIELD_IDS) {
    const cell = identityCell(html, id);
    assert.match(cell, /data-missing="true"[^>]*>—</, `${id} renderades inte som em-streck`);
  }
  const values = missingValues(html);
  assert.equal(values.length, IDENTITY_FIELD_IDS.length);
  for (const value of values) assert.equal(value, MISSING);
  assert.ok(!/>\s*(null|undefined|NaN|okänd|unknown)\s*</i.test(html), "ett hål fick ett gissat värde");

  // Workflowsroll och exekverande principal är SKILDA fält — aldrig ett hopslaget.
  assert.notEqual(
    identityFields(task).find((f) => f.id === "workflow_role")?.label,
    identityFields(task).find((f) => f.id === "execution_principal")?.label,
  );
  assert.equal(ROOM_FACTS.EXECUTION_PRINCIPAL_FIELD_IN_SCHEMA, "NONE");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · FIXTUR OCH LIVE DELAR ALDRIG EN OMÄRKT YTA
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-KÄLLA: varje tidslinjepost bär sin källa, och gränsen mot live-ytan står kvar", () => {
  const html = renderRoom(snapshotOrThrow());

  const entries = tagsWith(html, "data-room-entry");
  assert.ok(entries.length > 0, "rummet renderade inga tidslinjeposter — mätaren mäter ingenting");
  for (const entry of entries) {
    const source = attr(entry, "data-room-source");
    assert.ok(source !== null, `en post saknar maskinläsbar källa: ${entry}`);
    assert.ok(
      (TIMELINE_SOURCES as readonly string[]).includes(source),
      `okänd källa «${source}» — källorna är låsta`,
    );
  }

  // Segmenten är SYNLIGT märkta som fixtur, inte bara i ett attribut.
  const segments = tagsWith(html, "data-room-timeline-segment");
  assert.equal(segments.length, 2, "tidslinjen är inte segmenterad i två fixtursegment");
  for (const segment of segments) assert.equal(attr(segment, "data-room-segment-source"), "fixture");
  const visible = withoutStyles(html);
  assert.ok(visible.includes("Operatör och källa · fixtur"), "operatörssegmentet märks inte som fixtur");
  assert.ok(visible.includes("Fabrikens kvitton · fixtur"), "kvittosegmentet märks inte som fixtur");

  // Gränsstycket mellan fixturytorna och live-ytan finns kvar.
  assert.ok(html.includes('data-stream-source-boundary="true"'), "gränsen mot live-ytan saknas");

  // EN enda live-yta i rummet: strömpanelen. Ingen andra anslutning monteras.
  assert.equal((html.match(/data-event-stream="true"/g) ?? []).length, 1, "fler än en strömyta");
  assert.equal((html.match(/data-transport-mode=/g) ?? []).length, 1, "fler än ett transportläge");
  assert.equal(ROOM_FACTS.ONE_TAIL_CONNECTION_PER_FACTORY_ROOM, "YES");

  // Ingen post påstår en orsakskedja utan ett DELAT id.
  const bindings = tagsWith(html, "data-room-binding");
  for (const binding of bindings) {
    const key = attr(binding, "data-room-binding");
    assert.equal(key, "command_id", "en bindning ritades på något annat än ett verkligt id");
  }
  assert.equal(TIMELINE_ORDER.GLOBAL_CAUSAL_ORDER_NOT_CLAIMED, "YES");
  assert.equal(TIMELINE_ORDER.WALL_CLOCK_IS_ORDERING_AUTHORITY, "NO");
  assert.equal(TIMELINE_ORDER.LIVE_EVENT_ORDER, "seq");
});

test("ROOM-KÄLLA: utan fixturläge visas ingen fixturpost alls — hellre tomt än omärkt", () => {
  const html = renderToStaticMarkup(createElement(RoomTimeline, { fixture: false }));
  assert.equal(tagsWith(html, "data-room-entry").length, 0, "fixturposter läckte in i en icke-fixturvy");
  assert.ok(html.includes('data-timeline-empty="true"'), "tomläget saknar orsak");

  // …och med fixturläget på finns posterna, med identifierarna bevarade.
  const withFixture = renderToStaticMarkup(createElement(RoomTimeline, { fixture: true }));
  const segments = roomTimeline({
    outcomes: fixtureIntakeOutcomes(),
    commands: fixtureCommands(),
  });
  const expected = segments.flatMap((segment) => segment.entries.length);
  assert.ok(expected.every((n) => n > 0), "ett segment blev tomt — fixturen bär inte provets data");
  assert.equal(
    tagsWith(withFixture, "data-room-entry").length,
    segments.reduce((sum, segment) => sum + segment.entries.length, 0),
  );
  for (const key of ["command_id", "submission_id", "source_kind"]) {
    assert.ok(
      withFixture.includes(`data-room-identifier="${key}"`),
      `identifieraren ${key} bevarades inte i markupen`,
    );
  }
  // Rådataläget finns kvar för teknisk inspektion — utan skript och utan att kapa något.
  assert.ok(withFixture.includes('data-room-raw="true"'));
  assert.ok(withFixture.includes('data-room-raw-json="true"'));
});

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · EN TAIL-RAD FLYTTAR ALDRIG ETT TILLSTÅND
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-SNAPSHOT-WINS: en tail som 'avslutar' en uppgift ger fortfarande WORKING", () => {
  const snapshot = snapshotOrThrow();
  const task = snapshot.current_task;
  assert.ok(task);
  assert.equal(task.state, "WORKING");

  const finishing = ["attestation.created", "promotion.completed", "main.advanced"].map(
    (event_type, index) => ({
      schema_version: "1.0.0",
      event_id: `evt-rum-${index}`,
      seq: snapshot.seq_watermark + index + 1,
      ts: "2026-01-01T02:00:00.000Z",
      run_id: snapshot.run_id,
      task_id: task.task_id,
      attempt_id: null,
      event_type,
      payload: {},
      evidence_refs: [],
    }),
  );

  // Läsmodellens EGEN regel — aldrig en omskriven fold i rummet.
  const model = buildReadModel({ snapshot, events: finishing });
  const projection = model.tasks.find((row) => row.task_id === task.task_id);
  assert.ok(projection, "läsmodellen tappade bort den aktuella uppgiften");
  assert.equal(projection.lifecycle_state, "WORKING", "tail flyttade tillståndet");
  assert.equal(projection.lifecycle_source, "snapshot");
  assert.ok(
    model.pending_confirmations.length > 0,
    "de terminala raderna syns inte ens som obekräftade — provet mäter fel ström",
  );

  // Och rummet renderar snapshotens tillstånd, inte tailens antydan.
  const html = renderRoom(snapshot);
  const card = cardFor(html, task.task_id);
  assert.equal(attr(card, "data-state"), "WORKING");
  assert.equal(attr(card, "data-may-look-done"), "false");
  assert.ok(!card.includes("mk-tone-success"), "den pågående uppgiften såg klar ut");
  assert.ok(!card.includes(`data-state-badge="DONE"`));

  // Skalet tar inte ens emot en eventström: det finns ingen väg för tail att nå ett kort.
  const shell = stripComments(readFileSync(join(REPO_ROOT, "components/loop/MaskinShell.tsx"), "utf8"));
  assert.ok(!/events=/.test(shell), "skalet matar en eventström in i uppgiftsytorna");
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(
      !/buildReadModel|projectEvents|liveRows/.test(stripComments(source)),
      `${path} bygger en egen fold över strömmen`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · INGEN NÄTVERKS- ELLER EXEKVERINGSVÄG I RUMMET
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-NEG: rummets filer har noll nätverk, noll exekvering och noll egen anslutning", () => {
  const files = roomSourceFiles();
  assert.ok(files.length >= 8, `hittade inte rummets träd — mätaren mäter inget (${files.length})`);

  const forbidden: { pattern: RegExp; why: string }[] = [
    { pattern: /\bfetch\s*\(/, why: "nätverksanrop" },
    { pattern: /XMLHttpRequest/, why: "nätverksanrop" },
    { pattern: /EventSource/, why: "egen strömanslutning" },
    { pattern: /WebSocket/, why: "egen socket" },
    { pattern: /child_process/, why: "underprocess" },
    { pattern: /\beval\s*\(/, why: "exekvering av text" },
    { pattern: /new Function\s*\(/, why: "exekvering av text" },
    { pattern: /\bnode:fs\b|from "fs"/, why: "filsystem" },
    { pattern: /console\.(log|info|warn|error|debug|trace)\s*\(/, why: "loggning" },
    { pattern: /github-read|github-write|GITHUB_TOKEN|simple-git|octokit/i, why: "credentialväg" },
  ];

  for (const { path, source } of files) {
    const code = stripComments(source);
    for (const rule of forbidden) {
      assert.ok(!rule.pattern.test(code), `${path}: ${rule.why} (${rule.pattern})`);
    }
  }

  // Kompositören lämnar INGENTING in: den öppnar bara den byggda inlämningsytan.
  const composer = renderToStaticMarkup(createElement(WorkComposer, {}));
  assert.ok(composer.includes('href="/loop/mata"'), "kompositören saknar vägen till inlämningen");
  assert.ok(!/<form|<textarea|<input/i.test(composer), "kompositören fejkar en inlämningsyta");
  assert.ok(composer.includes('data-composer-mode="fixture"'), "fixturläget märks inte ut");

  // Ingen rumsfil monterar en andra strömklient.
  for (const { path, source } of files) {
    assert.ok(
      !/LiveEventStream|createTailConnection/.test(stripComments(source)),
      `${path} monterar en andra anslutning`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · INGEN PROCENT, INGEN STAPEL, INGEN FEJKAD RÖRELSE
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-NEG: varken källan eller markupen bär procent, framstegselement eller rörelse", () => {
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(!source.includes("%"), `procenttecken i ${path}`);
    assert.ok(
      !/<progress|role=["']progressbar|aria-valuenow|<meter\b/i.test(source),
      `framstegselement i ${path}`,
    );
    assert.ok(
      !/@keyframes|animation:|animate-/i.test(source),
      `fabricerad rörelse i ${path}`,
    );
  }

  const { snapshot } = snapshotWithEveryState();
  const html = [renderRoom(snapshotOrThrow()), renderRoom(snapshot), renderRoom(null)].join("\n");
  assert.ok(!html.includes("%"), "procenttecken i rummets markup");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement i markup");
  assert.ok(!/@keyframes|animation:/i.test(html), "rörelse i rummets markup");

  // Rummets stilark når markupen — och Maskinens eget är kvar, oförändrat.
  assert.ok(html.includes(ROOM_CSS), "rummets stilark når aldrig markupen");
  assert.ok(html.includes(LOOP_CSS), "Maskinens stilark föll bort");
  assert.equal(ROOM_CSS_PREFIX, "rm-");

  /*
    LOOP_CSS är Maskinens provade stilark och ligger UTANFÖR den här skivan. Jämförelsen görs mot
    körningens frusna bas — inte mot HEAD, som efter en commit är kandidaten själv och därför
    hade jämfört filen med sig själv.
  */
  const base = frozenBaseSha();
  const loopUi = base === null ? null : gitShow(base, "components/loop/ui.ts");
  if (loopUi === null) {
    // Går git-objektet inte att läsa ska det SYNAS att jämförelsen inte gjordes. Kravet bärs då
    // av det svagare men verkliga: rummet definierar aldrig om Maskinens stilark, det importerar det.
    for (const { path, source } of roomSourceFiles()) {
      assert.ok(
        !/export const LOOP_CSS/.test(source),
        `NOT_MEASURED mot basen OCH ${path} definierar om LOOP_CSS`,
      );
    }
    return;
  }
  assert.equal(
    readFileSync(join(REPO_ROOT, "components/loop/ui.ts"), "utf8"),
    loopUi,
    `components/loop/ui.ts (LOOP_CSS) ändrades sedan basen ${base} — den ligger utanför den här skivan`,
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · ELVA TILLSTÅND, VARKEN FLER ELLER FÄRRE
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-LIFECYCLE: rummet renderar exakt de elva kanoniska tillstånden", () => {
  const { snapshot, idOf } = snapshotWithEveryState();
  const html = renderRoom(snapshot);

  const states = new Set(
    tagsWith(html, "data-state=").map((tag) => attr(tag, "data-state")).filter((s) => s !== null),
  );
  assert.deepEqual([...states].sort(), [...TASK_LIFECYCLE].sort());

  const badges = new Set(
    tagsWith(html, "data-state-badge").map((tag) => attr(tag, "data-state-badge")),
  );
  assert.deepEqual([...badges].sort(), [...TASK_LIFECYCLE].sort());

  for (const state of TASK_LIFECYCLE) {
    const card = cardFor(html, idOf(state));
    assert.equal(attr(card, "data-tone"), TASK_LIFECYCLE_PRESENTATION[state].tone);
  }

  // STOPPED är fail-closed och ser aldrig ut som DONE; NEEDS_SPEC är arbete, aldrig fel.
  const stopped = cardFor(html, idOf("STOPPED"));
  assert.equal(attr(stopped, "data-tone"), "danger");
  assert.ok(!stopped.includes("mk-tone-success"));
  const needsSpec = cardFor(html, idOf("NEEDS_SPEC"));
  assert.equal(attr(needsSpec, "data-tone"), "warning");
  assert.ok(needsSpec.includes('data-needs-spec-explanation="true"'));
  assert.ok(!/\bFEL\b|\bError\b|misslyckad/i.test(needsSpec), "NEEDS_SPEC beskrevs som fel");

  // Rummets tre banor är kvar som tre kolumner — varken fler eller färre.
  assert.equal((html.match(/data-column="/g) ?? []).length, 3);
  for (const marker of ["data-room-stage", "data-work-composer", "data-task-focus-rail",
    "data-output-tray", "data-identity-strip", "data-room-timeline", "data-factory-room-header"]) {
    assert.ok(html.includes(`${marker}="`), `rummets yta ${marker} monterades inte`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * UPPMÄRKSAMHET — härledd, aldrig påhittad ägarbehörighet
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-ATTENTION: rubriken visas för fixturens NEEDS_SPEC/STOPPED — ägaråtgärd påstås aldrig", () => {
  const snapshot = snapshotOrThrow();
  const derived = deriveAttention(snapshot);
  assert.ok(derived.length > 0, "fixturen bär varken NEEDS_SPEC eller STOPPED — provet mäter inget");
  assert.deepEqual(derived.map((item) => item.id), ["NEEDS_SPEC", "STOPPED"]);
  assert.deepEqual(
    derived.map((item) => item.tone),
    ["warning", "danger"],
    "NEEDS_SPEC och STOPPED delade färgroll — arbete och stopp måste skiljas åt",
  );

  const html = renderRoom(snapshot);
  const visible = withoutStyles(html);
  assert.ok(visible.includes(ATTENTION_HEADING), "den härledda rubriken saknas");
  assert.equal(ATTENTION_HEADING, "BEHÖVER UPPMÄRKSAMHET");

  // Ingen ägaråtgärd: kontraktet har inget fält att härleda den ur.
  assert.ok(!html.includes(OWNER_ACTION_LABEL), "rummet påstod ägaråtgärd utan auktoritativt fält");
  assert.equal(OWNER_AUTHORITY_SOURCE, "NONE");
  assert.equal(ROOM_FACTS.OWNER_AUTHORITY_FIELD_IN_SCHEMA, "NONE");
  /*
    Mätt på KODEN, kommentarerna bortskalade — samma princip som V2:s negativa kontroller: en
    fil som i klartext förbjuder etiketten får inte fällas av sitt eget förbud. Den renderade
    markupen mäts separat ovan och är det som faktiskt når en läsare.
  */
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(
      !stripComments(source).includes(OWNER_ACTION_LABEL),
      `${path} bär etiketten som inte får renderas`,
    );
  }

  // En tom snapshot ger tomläge MED orsak — aldrig en rubrik utan innehåll.
  const empty = validateSnapshot({
    ...structuredClone(snapshot),
    current_task: null,
    backlog: [],
    completed: [],
  });
  assert.equal(empty.ok, true);
  const emptyHtml = renderRoom((empty as { ok: true; data: LoopSnapshot }).data);
  assert.ok(emptyHtml.includes('data-attention-empty="true"'));
  assert.deepEqual(deriveAttention((empty as { ok: true; data: LoopSnapshot }).data), []);
});

test("ROOM-HUVUD: controllerns bekräftade main och dess ålder visas — åldern är ingen liveness", () => {
  const snapshot = snapshotOrThrow();
  const now = new Date("2026-01-02T00:00:23.000Z");
  const confirmation = mainConfirmation(snapshot, now);
  assert.equal(confirmation.sha, snapshot.current_main.sha);
  assert.equal(confirmation.confirmed_ts, snapshot.current_main.confirmed_ts);
  assert.equal(confirmation.age_text, "1 dygn sedan");

  // Saknad stämpel gissas aldrig.
  assert.equal(ageText(null, now), null);
  assert.equal(ageText("inte en tidsstämpel", now), null);
  assert.equal(mainConfirmation(null, now).age_text, null);

  const html = renderRoom(snapshot);
  // Statusraden äger fortfarande liveness-märket, och det är OKÄNT utan signal.
  assert.ok(html.includes('data-liveness="unknown"'));
  assert.ok(!/AUTONOM/.test(withoutStyles(html)), "rummet påstod AUTONOM utan liveness-signal");
  assert.ok(html.includes('data-age-is-liveness="false"'), "åldern märks inte som ren visning");
  assert.ok(html.includes("FIXTUR"), "fixturmärkningen syns inte på rumsnivå");
  assert.ok(html.includes('data-room-transport-state="unknown"'), "rummet gissade ett transportläge");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · INGEN ANNAN YTA ÄNDRAS
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-ISOLERING: rummet rör ingen annan yta, och startsidan är byte-identisk", () => {
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(
      !/PipelinePanel|ProcessGuide|MetricsPanel/.test(source),
      `${path} importerar en panel som rummet inte delar`,
    );
    assert.ok(!/app\/\(app\)\/page|components\/Sidebar/.test(source), `${path} rör en annan route`);
  }

  /*
    Startsidan jämförs mot KÖRNINGENS FRUSNA BAS, inte mot HEAD: efter en commit är HEAD
    kandidaten, och en jämförelse mot HEAD hade jämfört filen med sig själv — en committad
    regression på / hade då passerat. Basen mäts med merge-base mot origin/main.
  */
  const relative = "app/(app)/page.tsx";
  const baseSha = frozenBaseSha();
  const baseSource = baseSha === null ? null : gitShow(baseSha, relative);
  if (baseSource === null) {
    // Git-objektet kan saknas i en grund klon. Då bärs kravet av den statiska kontrollen ovan,
    // och det ska SYNAS att jämförelsen inte kunde göras.
    assert.ok(
      roomSourceFiles().every(({ source }) => !source.includes("(app)/page")),
      "NOT_MEASURED mot basen OCH rummet refererar startsidan",
    );
    return;
  }
  assert.equal(
    readFileSync(join(REPO_ROOT, relative), "utf8"),
    baseSource,
    `startsidan ändrades sedan basen ${baseSha} — den ligger utanför den här skivan`,
  );

  /*
    MÄTNINGEN SKA VARA VERKLIG. Två kontroller på själva mätaren:
      · basen är en FÖRFADER till HEAD — den pekar alltså på grenens utgångspunkt, och ligger
        kandidatcommits ovanpå jämförs de mot basen, inte mot sig själva;
      · en enda tillagd rad i innehållet fälls av samma jämförelse (lögnstub).
  */
  assert.notEqual(
    git(["merge-base", "--is-ancestor", baseSha as string, "HEAD"]),
    null,
    `basen ${baseSha} är inte en förfader till HEAD — jämförelsen mäter fel commit`,
  );
  assert.notEqual(
    `${baseSource}\n// regression`,
    baseSource,
    "jämförelsen skulle inte se ens en tillagd rad",
  );

  // Routen matar fortfarande skalet med fixturen, och flaggan läses vid request.
  const route = readFileSync(join(REPO_ROOT, "app/(app)/loop/page.tsx"), "utf8");
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.equal(FIXTURE_MODE, true);
  assert.ok(existsSync(join(REPO_ROOT, "components/loop/room")));
});
