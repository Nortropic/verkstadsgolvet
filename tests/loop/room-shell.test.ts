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
import { FOCUS_NOTE, FOCUS_STEP } from "../../components/loop/room/TaskFocusRail";
import { TRAY_NOTE, TRAY_STEP } from "../../components/loop/room/OutputTray";
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
import { ROOM_FACTS, ageText, mainConfirmation, roomIntro } from "../../lib/loop/room/header";
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

/**
 * Väljarna i ett stilark som sätter `order`, med media-blocken genomskådade.
 *
 * Uppslaget går BAKLÄNGES från varje `order:`-deklaration till regelns egen öppningsklammer och
 * vidare till närmast föregående klammer — så en regel inne i ett `@media`-block ger sin EGEN
 * väljare, inte media-frågan. `border-radius` och liknande fälls inte: tecknet före `order` måste
 * vara radbörjan, `;`, `{` eller blanktecken.
 */
function selectorsSettingOrder(css: string): string[] {
  const found: string[] = [];
  const pattern = /(?:^|[;{\s])order\s*:/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(css)) !== null) {
    const ruleOpen = css.lastIndexOf("{", match.index);
    if (ruleOpen < 0) continue;
    const boundary = Math.max(css.lastIndexOf("}", ruleOpen), css.lastIndexOf("{", ruleOpen - 1));
    found.push(
      css
        .slice(boundary + 1, ruleOpen)
        .replace(/\/\*[\s\S]*?\*\//g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return found;
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

test("ROOM-KÄLLA: rummets egen prosa påstår ALDRIG controllerpublicerad härkomst för en fixtur", () => {
  /*
    Två motstridiga påståenden om samma data är värre än ett tyst. Renderas rummet med fixturen
    får ingen mening i rummet säga att värdena kommer ur controllerns publicerade snapshot —
    statusraden bär redan "FIXTUR · INTE LIVEDATA" och sidhuvudets sanningsrad säger fixtur.
  */
  const snapshot = snapshotOrThrow();
  const text = withoutStyles(renderRoom(snapshot, true)).replace(/<[^>]+>/g, " ");

  assert.ok(text.includes(roomIntro(true)), "fixturlägets ingress renderas inte");
  assert.ok(!text.includes(roomIntro(false)), "ingressen påstår controllerpublicerad härkomst");
  assert.ok(
    !/controllerns publicerade snapshot/i.test(text),
    "en mening i rummet påstår controllerpublicerad härkomst i fixturläge",
  );

  // Fixturlägets ingress NAMNGER fixturen — den är inte bara tystare, den är ärlig.
  assert.match(roomIntro(true), /fixtur/i);
  assert.ok(text.includes("FIXTUR"), "fixturmärket saknas i samma vy");

  // Och lägena är FAKTISKT olika texter — annars vore växlingen kosmetik.
  assert.notEqual(roomIntro(true), roomIntro(false));
  assert.match(roomIntro(false), /controllerns publicerade snapshot/i);

  /*
    HÄRKOMSTEN SÄGS EN GÅNG PÅ RUMSNIVÅ. Fokusnotisen upprepar den inte — den bär bara det som
    är mittens eget och som gäller i båda lägena: tillståndet kommer ur snapshoten, aldrig ur
    strömmen. Ett påstående som görs två gånger i intilliggande stycken är dubblerad status,
    inte extra tydlighet.
  */
  assert.match(FOCUS_NOTE, /aldrig ur strömmen/i, "authority-regeln föll bort ur fokusnotisen");
  assert.ok(!/fixtur|controllern/i.test(FOCUS_NOTE), "fokusnotisen upprepar härkomsten");
  assert.ok(text.includes(FOCUS_NOTE), "fokusnotisen renderas inte");

  // Märkningen är maskinläsbar, så växlingen kan mätas utan att läsa prosa.
  const markup = withoutStyles(renderRoom(snapshot, true));
  assert.ok(markup.includes('data-room-intro-source="fixture"'));
  const live = withoutStyles(renderRoom(snapshot, false));
  assert.ok(live.includes('data-room-intro-source="snapshot"'));
});

test("ROOM-KOPIA: transportläget påstås EN gång i rummet — ingen tredje formulering", () => {
  /*
    Sidhuvudet (utanför den här skivan) och strömpanelen äger redan meningen om VEM som bär
    transportläget. Rummets paragraf ska bara bära rummets eget löfte: ingen andra anslutning.
  */
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  const note = markup.match(/<p[^>]*data-room-transport-state="unknown"[\s\S]*?<\/p>/)?.[0];
  assert.ok(note, "rummets transportmening renderas inte");

  const sentences = note
    .replace(/<[^>]+>/g, "")
    .split(/(?<=\.)\s+/)
    .filter((part) => part.trim().length > 0);
  assert.equal(sentences.length, 1, `rummets transportmening är ${sentences.length} meningar`);
  assert.ok(
    !/bär sitt eget transportläge|står i panelen|står där/i.test(note),
    "rummet upprepar sidhuvudets mening om vem som äger transportläget",
  );
  assert.match(note, /ingen egen anslutning/i, "rummets eget löfte saknas");
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

/**
 * V2:s grep, ORDAGRANT dubblerad hit — och det är avsikten.
 *
 * V2 mäter components/loop/** rekursivt och täcker därför rummets komponenter. lib/loop/room/**
 * ligger UTANFÖR det trädet och mäts BARA här. Ett urval av V2:s mönster hade alltså lämnat
 * halva rummet omätt; listan är därför en äkta delmängdsspegling: samma fyra regler, samma
 * ordalydelse, plus procenttecknet som mäts separat nedan.
 *
 * RÄCKVIDD PER REGEL, med samma skäl som V2 anger:
 *   raw  — mäts på hela filen. Strängare, och inget legitimt bruk finns i kommentarer heller.
 *   code — mäts med kommentarerna bortskalade. En fil som i klartext FÖRBJUDER framstegsstaplar
 *          ("Ingen procentsats, ingen framstegsstapel …") får inte fällas av sitt eget förbud;
 *          det är exakt V2:s eget resonemang, och att avvika från det hade straffat ärlig
 *          dokumentation utan att stänga något hål.
 *
 * Varje regel bär en LÖGNSTUBBE: ett mönster som inte kan fälla sitt eget brott mäter ingenting.
 */
const FORBIDDEN_PRESENTATION: {
  pattern: RegExp;
  why: string;
  scope: "raw" | "code";
  stub: string;
}[] = [
  {
    pattern: /<progress|role=["']progressbar|aria-valuenow|<meter\b/i,
    why: "framstegselement",
    scope: "raw",
    stub: '<progress value="1" max="2" />',
  },
  {
    pattern: /\b(progressbar|progress-bar|framstegsstapel|procentsats|percentage)\b/i,
    why: "framstegs-/procentsemantik",
    scope: "code",
    stub: "export const percentage = 1;",
  },
  {
    pattern: /@keyframes|animation:|animate-|\bpulse\b|\bblink\b/i,
    why: "fabricerad liveness-rörelse",
    scope: "raw",
    stub: ".rm-x { animation: pulse 1s infinite; }",
  },
];

test("ROOM-NEG: varken källan eller markupen bär procent, framstegselement eller rörelse", () => {
  const files = roomSourceFiles();
  assert.ok(files.length >= 8, `hittade inte rummets träd — mätaren mäter inget (${files.length})`);

  for (const { path, source } of files) {
    assert.ok(!source.includes("%"), `procenttecken i ${path}`);
    for (const rule of FORBIDDEN_PRESENTATION) {
      const measured = rule.scope === "raw" ? source : stripComments(source);
      assert.ok(!rule.pattern.test(measured), `${rule.why} i ${path}`);
    }
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott, annars är listan bara dekoration.
  for (const rule of FORBIDDEN_PRESENTATION) {
    assert.ok(
      rule.pattern.test(rule.stub),
      `mönstret för ${rule.why} fäller inte ens sin egen stubbe`,
    );
  }
  // NEGATIV KONTROLL: en kommentar som FÖRBJUDER framstegsstaplar får aldrig fällas av förbudet.
  assert.ok(
    !FORBIDDEN_PRESENTATION[1].pattern.test(
      stripComments("/* Ingen procentsats, ingen framstegsstapel. */\nexport const ok = true;"),
    ),
    "det egna förbudet i en kommentar fälls som om det vore ett brott",
  );

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
    LOOP_CSS är Maskinens provade stilark och ligger UTANFÖR rummets skivor. Låset mätte tidigare
    HELA components/loop/ui.ts byte för byte. Det var en PROXY för det verkliga kravet, och
    proxyn dog när SHREDDER-01A (ägarbeslutet i docs/nortropic-factory-room-roadmap-erratum-01.md)
    bytte sidhuvudets ETIKETTER i samma fil: en textkonstant hade fällt en mätare som finns för
    ett stilark.

    Kravet som faktiskt skyddades är därför mätt DIREKT och lika hårt: STILARKET är byte-identiskt
    med basens. Jämförelsen görs mot körningens frusna bas — inte mot HEAD, som efter en commit är
    kandidaten själv och därför hade jämfört filen med sig själv.
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

  /** Stilarket som det STÅR I KÄLLAN, från deklarationen till dess avslutande backtick. */
  const loopCssBlock = (source: string): string | null => {
    const start = source.indexOf("export const LOOP_CSS = `");
    if (start < 0) return null;
    const end = source.indexOf("`;", start + "export const LOOP_CSS = `".length);
    return end < 0 ? null : source.slice(start, end + 2);
  };

  const current = loopCssBlock(readFileSync(join(REPO_ROOT, "components/loop/ui.ts"), "utf8"));
  const frozen = loopCssBlock(loopUi);
  assert.ok(current !== null, "kunde inte läsa LOOP_CSS ur källan — mätaren mäter ingenting");
  assert.ok(frozen !== null, `kunde inte läsa LOOP_CSS ur basen ${base}`);
  assert.equal(
    current,
    frozen,
    `LOOP_CSS i components/loop/ui.ts ändrades sedan basen ${base} — stilarket ligger utanför skivan`,
  );

  // MÄTAREN SKA VARA VERKLIG: uttaget bär faktiskt stilarket, och en enda ändrad regel fälls.
  assert.ok(current.includes(".mk-shell"), "uttaget innehåller inte stilarkets egna regler");
  assert.ok(current.includes(LOOP_CSS), "uttaget matchar inte den exporterade konstanten");
  assert.notEqual(
    current.replace(".mk-shell {", ".mk-shell { display: none;"),
    frozen,
    "jämförelsen skulle inte se ens en ändrad regel",
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
 * BANORNAS ORDNING — LOOP_CSS:s rutnätsordning läcker inte in i rummets flexbanor
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-LAYOUT: banornas ordning är DOM-ordning — etikett, yta, notis, i alla vyer", () => {
  /*
    Kolumnerna låg tidigare i .mk-cols (grid) och LOOP_CSS ordnar dem där för smala vyer. I
    rummet är samma kolumner flexbarn i en bana, och `order` gäller flexbarn precis lika mycket.
    Utan en nollställning hoppar aktuell uppgift ovanför sin egen etikett vid 900 px, och
    utmatningens notis ovanför sin kolumn vid 390 px. Provet mäter både REGELN och DOM-ordningen.
  */
  const orderedColumns = [
    ...LOOP_CSS.matchAll(/\.(mk-col-[a-z]+)\s*\{[^}]*order:\s*(-?\d+)/g),
  ].map((match) => match[1]);
  assert.ok(
    orderedColumns.length > 0,
    "LOOP_CSS ordnar inga kolumner längre — mätaren mäter ingenting och måste skrivas om",
  );

  // Rummet nollställer den ärvda ordningen för sina egna banbarn …
  assert.match(
    ROOM_CSS,
    /\.rm-lane\s*>\s*\.mk-col\s*\{[^}]*order:\s*0/,
    "rummet nollställer inte den ärvda kolumnordningen i sina banor",
  );

  // LÖGNSTUB: tas regeln bort ska samma uppslag INTE hitta den — annars mäter provet ingenting.
  assert.ok(
    !/\.rm-lane\s*>\s*\.mk-col\s*\{[^}]*order:\s*0/.test(
      ROOM_CSS.replace(/\.rm-lane\s*>\s*\.mk-col\s*\{[^}]*\}/, ""),
    ),
    "uppslaget hittar nollställningen även när den tagits bort — mätaren är trasig",
  );

  // … med HÖGRE specificitet än regeln den ska vinna över (två klasser mot en).
  const classCount = (selector: string) => (selector.match(/\.[a-z][\w-]*/g) ?? []).length;
  for (const column of new Set(orderedColumns)) {
    assert.ok(
      classCount(".rm-lane > .mk-col") > classCount(`.${column}`),
      `nollställningen är inte mer specifik än .${column}`,
    );
  }

  const html = renderRoom(snapshotOrThrow());

  // Rummets stilark ligger EFTER Maskinens — lika specifika regler avgörs då till rummets fördel.
  assert.ok(
    html.indexOf(LOOP_CSS) < html.indexOf(ROOM_CSS),
    "rummets stilark injiceras före Maskinens — kaskadens ordning är omvänd",
  );

  /*
    DOM-ordningen ÄR berättelsen: etikett → yta → notis, bana för bana. Mätt på MARKUPEN utan
    stilarket — annars hittar uppslaget klassnamnen i CSS-texten i stället för i elementen.
  */
  const markup = withoutStyles(html);
  const at = (needle: string) => {
    const index = markup.indexOf(needle);
    assert.ok(index >= 0, `hittade inte «${needle}» i rummets markup`);
    return index;
  };
  assert.ok(
    at('data-room-step="in"') < at('data-work-composer="true"'),
    "ingången saknar sin stegetikett",
  );
  assert.ok(
    at('data-work-composer="true"') < at('data-column="backlog"'),
    "kompositören ligger inte före kön — rummets primära handling hamnade under listan",
  );
  assert.ok(
    at(`data-room-step="${FOCUS_STEP}"`) < at('data-column="current"'),
    "aktuell uppgift ligger före sin etikett",
  );
  assert.ok(at('data-column="current"') < at(FOCUS_NOTE), "fokusnotisen ligger före sin yta");
  assert.ok(
    at(`data-room-step="${TRAY_STEP}"`) < at('data-column="completed"'),
    "utmatningen ligger före sin etikett",
  );
  assert.ok(at('data-column="completed"') < at(TRAY_NOTE), "utmatningsnotisen ligger före sin yta");

  // Och banorna kommer i berättelsens ordning: in → arbete → ut.
  assert.ok(at('data-column="backlog"') < at('data-column="current"'));
  assert.ok(at('data-column="current"') < at('data-column="completed"'));

  /*
    Nollställningen använder barnkombinatorn (.rm-lane > .mk-col), så den gäller bara om
    kolumnen FAKTISKT är ett direkt barn till banan. Det mäts här i stället för att antas:
    mellan banans öppningstagg och kolumnen får det inte ligga någon öppnad behållare.
  */
  for (const [lane, column] of [
    ["rm-lane-in", "backlog"],
    ["rm-lane-focus", "current"],
    ["rm-lane-out", "completed"],
  ] as const) {
    const from = at(lane);
    // Fram till kolumnens EGEN öppningstagg — inte in i den, annars räknas den som obalans.
    const to = markup.lastIndexOf("<", at(`data-column="${column}"`));
    const between = markup.slice(from, to);
    /*
      Syskon som öppnats OCH stängts före kolumnen (t.ex. kompositören i ingångsbanan) bryter
      ingen barnrelation. Det som skulle bryta den är en behållare som fortfarande är ÖPPEN när
      kolumnen börjar — alltså en obalans mellan öppnade och stängda taggar i mellanrummet.
    */
    const containers = "div|section|ul|ol|li|p|form|header|article|details|nav";
    const opened = (between.match(new RegExp(`<(${containers})\\b`, "g")) ?? []).length;
    const closed = (between.match(new RegExp(`</(${containers})>`, "g")) ?? []).length;
    assert.equal(
      opened,
      closed,
      `${column}-kolumnen är inte ett direkt barn till .${lane} — barnkombinatorn träffar inte`,
    );
  }

  /*
    ORDNINGSTALET ÄR ETT PÅSTÅENDE OM LAYOUTEN, och det gäller i exakt ett intervall.

    Mellan 720 och 959 px lägger sig arbetet först, och då får etiketten inte påstå 1, 2, 3.
    Talet bärs därför i ett eget element som döljs i EXAKT det media-blocket. Vid ≤719 px
    (ROOM-08) står banorna åter i DOM-ordningen in → arbete → ut, och då är påståendet sant
    igen och talet visas — den regeln mäts av tests/loop/room-mobile.test.ts, medan mätningen
    nedan äger 959-blocket. Talet är dessutom `aria-hidden`, för DOM-ordningen bär redan
    sekvensen för den som lyssnar i stället för att titta.
  */
  /*
    ORDNING SÄTTS BARA PÅ SCENENS EGNA BARN.

    Hyllan (.rm-lane-out) är sedan den flyttades ut ur scenen ett direkt barn till .rm-room. En
    `order` på den ordnar då HELA rummet, inte en spalt: hyllan målades sist på mobilen — efter
    tidslinjen, gränsstycket och live-panelen — vilket både bröt axeln in → arbete → ut och gjorde
    gränsstyckets påstående falskt, eftersom en fixturbaserad yta hamnade under live-panelen.
    Provet mäter därför VARJE order-deklaration i stilarket, inte bara den som fanns då.
  */
  const ORDER_ALLOWED = [".rm-lane-focus", ".rm-lane > .mk-col"];
  const ordering = selectorsSettingOrder(ROOM_CSS);
  assert.ok(ordering.length > 0, "stilarket sätter ingen order alls — mätaren mäter ingenting");
  for (const selector of ordering) {
    assert.ok(
      ORDER_ALLOWED.includes(selector),
      `«${selector}» sätter order utanför scenens egna barn — rummets egen ordning kan flyttas`,
    );
  }
  assert.ok(
    !ordering.some((selector) => selector.includes("rm-lane-out")),
    "hyllan ordnas om — på mobilen hamnar den då efter live-panelen",
  );

  // LÖGNSTUB: regeln som togs bort ska fällas av samma mätare, även inne i ett media-block …
  const stub = "@media (max-width: 719px) {\n  .rm-lane-out { order: 2; }\n}";
  assert.deepEqual(selectorsSettingOrder(stub), [".rm-lane-out"], "mätaren ser inte den gamla regeln");
  // … och NEGATIV KONTROLL: `border-radius` och liknande får aldrig läsas som en order-regel.
  assert.deepEqual(
    selectorsSettingOrder(".rm-x { border-radius: 4px; box-shadow: inset 0 0 0 1px red; }"),
    [],
    "mätaren fälls av ord som bara innehåller «order»",
  );

  assert.ok(markup.includes('class="rm-step-n" aria-hidden="true"'), "ordningstalet är inte urskilt");
  const narrow = ROOM_CSS.slice(ROOM_CSS.indexOf("@media (max-width: 959px)"));
  assert.match(
    narrow.slice(0, narrow.indexOf("}\n}") + 3),
    /\.rm-step-n\s*\{[^}]*display:\s*none/,
    "ordningstalet står kvar när banorna byter ordning vid 720–959 px",
  );
  for (const ordinal of ["1", "2", "3"]) {
    assert.ok(
      markup.includes(`>${ordinal} ·`),
      `ordningstalet ${ordinal} renderas inte i sitt eget element`,
    );
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
  const markup = withoutStyles(html);
  // Statusraden äger fortfarande liveness-märket, och det är OKÄNT utan signal.
  assert.ok(html.includes('data-liveness="unknown"'));
  assert.ok(!/AUTONOM/.test(markup), "rummet påstod AUTONOM utan liveness-signal");
  assert.ok(html.includes('data-age-is-liveness="false"'), "åldern märks inte som ren visning");
  assert.ok(html.includes("FIXTUR"), "fixturmärkningen syns inte på rumsnivå");
  assert.ok(html.includes('data-room-transport-state="unknown"'), "rummet gissade ett transportläge");

  /*
    ÅLDERN ÄR EN BILDTEXT, INTE EN TREDJE REDOVISNING. Statusraden äger sha och tidsstämpel;
    bildtexten lägger bara till åldern. Tidsstämpeln får därför inte skrivas ut en gång till i
    bildtextens SYNLIGA text — den bärs i `title`, där den går att läsa av utan att upprepas.
  */
  const caption = markup.match(/<p[^>]*data-main-confirmation="true"[\s\S]*?<\/p>/)?.[0];
  assert.ok(caption, "bildtexten om controllerns bekräftelse renderas inte");
  const captionText = caption.replace(/<[^>]+>/g, "");
  const ts = snapshot.current_main.confirmed_ts;
  assert.ok(ts !== null, "fixturen saknar bekräftelsestämpel — provet mäter fel sak");
  assert.ok(
    !captionText.includes(ts),
    "bildtexten skriver ut tidsstämpeln igen — statusraden är dess enda ägare",
  );
  assert.ok(caption.includes(`title="${ts}"`), "tidsstämpeln går inte att läsa av i bildtexten");
  assert.ok(
    !markup.includes('data-room-field="main_confirmed_age"'),
    "åldern renderas fortfarande som ett eget fält med egen rubrik",
  );

  /*
    Notisen om transportläget står VID strömmen: efter gränsstycket, före panelen. I huvudet
    kostade den bara höjd ovanför de ytor operatören kom hit för att se.
  */
  const positions = {
    header: markup.indexOf('data-factory-room-header="true"'),
    boundary: markup.indexOf('data-stream-source-boundary="true"'),
    transport: markup.indexOf('data-room-transport-state="unknown"'),
    stream: markup.indexOf('data-event-stream="true"'),
  };
  assert.ok(positions.transport > positions.boundary, "transportnotisen ligger kvar ovanför rummet");
  assert.ok(positions.transport < positions.stream, "transportnotisen hamnade efter panelen");
  assert.ok(positions.header < positions.boundary);
});

test("ROOM-BALANS: scenen är två banor, hyllan ligger under dem, identiteten står i fokusbanan", () => {
  /*
    Med tre smala spalter blev höjdskillnaden mellan en lång kö och en kort utmatning drygt en
    skärmhöjd tomt rutnät till höger — en vägg av kort i stället för ett rum. Scenen bär därför
    ingången och arbetet; utmatningen är en hylla i full bredd under dem, och identitetsremsan
    står där den hör hemma: hos den uppgift den beskriver.
  */
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));

  const stageStart = markup.indexOf('data-room-stage="true"');
  const trayStart = markup.indexOf('data-output-tray="true"');
  assert.ok(stageStart >= 0, "scenen renderas inte");
  assert.ok(trayStart > stageStart, "hyllan ligger före scenen");

  const stage = markup.slice(stageStart, trayStart);
  assert.ok(stage.includes('data-column="backlog"'), "kön ligger utanför scenen");
  assert.ok(stage.includes('data-column="current"'), "arbetet ligger utanför scenen");
  assert.ok(
    !stage.includes('data-column="completed"'),
    "utmatningen ligger kvar som en tredje smal spalt i scenen",
  );

  const focus = markup.slice(markup.indexOf('data-task-focus-rail="true"'), trayStart);
  for (const marker of ['data-identity-strip="true"', 'data-command-deck="true"']) {
    assert.ok(focus.includes(marker), `${marker} ligger utanför fokusbanan`);
  }

  // Och CSS:en säger samma sak: scenen har TVÅ spalter, inte tre.
  const stageRule = ROOM_CSS.slice(
    ROOM_CSS.indexOf(".rm-stage {"),
    ROOM_CSS.indexOf("}", ROOM_CSS.indexOf(".rm-stage {")),
  );
  assert.equal(
    (stageRule.match(/minmax\(/g) ?? []).length,
    2,
    `scenen har inte två spalter: ${stageRule}`,
  );
});

test("ROOM-A11Y: varje interaktiv yta rummet inför bär en synlig fokusring", () => {
  /*
    Exit-kriterium 15 kräver att tangentbordsfokus SYNS. Här mäts att varje interaktiv yta rummet
    självt inför har en :focus-visible-regel med husets --focus-ring — och att ytorna faktiskt
    renderas. Ett skärmklipp med fokus är fortfarande den empiriska bekräftelsen; det här provet
    ser till att regeln inte kan försvinna utan att någon märker det.
  */
  const selectors = [".rm-cta", ".rm-details > summary", '.rm-lane-in .mk-col [data-intake-cta="true"]'];
  const escapeSelector = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const selector of selectors) {
    assert.match(
      ROOM_CSS,
      new RegExp(`${escapeSelector(selector)}:focus-visible\\s*\\{[^}]*box-shadow:\\s*var\\(--focus-ring\\)`),
      `${selector} saknar synlig fokusring`,
    );
  }

  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  assert.ok(markup.includes('class="rm-cta"'), "den primära handlingen renderas inte");
  assert.ok(markup.includes("<summary>"), "rådataväxeln renderas inte");
  assert.ok(markup.includes('data-intake-cta="true"'), "kolumnens genväg renderas inte");
});

test("ROOM-A11Y: rubriknivåerna syns — h2 lånar aldrig h3-rubrikernas form", () => {
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));

  // Rummets sektioner är h2 och bär rummets h2-form …
  for (const heading of ["rm-composer-title", "rm-identity-title", "rm-timeline-title"]) {
    assert.match(markup, new RegExp(`<h2 class="${heading}"`), `${heading} är inte en h2`);
  }
  // … och nivån under är h3 med mono-versalformen.
  assert.match(markup, /<h3 class="rm-attention-heading"/);
  assert.match(markup, /<h3 class="rm-segment-title"/);
  assert.ok(!/<h2 class="rm-attention-heading"/.test(markup), "en h2 lånar h3-formen");
  assert.ok(!/<h2 class="rm-segment-title"/.test(markup), "en h2 lånar segmentrubrikens form");

  // Och formerna är FAKTISKT olika i stilarket — inte bara olika klassnamn.
  const ruleFor = (selector: string) => {
    const start = ROOM_CSS.indexOf(selector);
    assert.ok(start >= 0, `stilarket saknar regel för ${selector}`);
    return ROOM_CSS.slice(start, ROOM_CSS.indexOf("}", start));
  };
  assert.ok(
    !/text-transform:\s*uppercase/.test(ruleFor(".rm-identity-title, .rm-timeline-title")),
    "h2-formen är fortfarande mono-versaler — nivåerna går inte att skilja åt",
  );
  assert.match(ruleFor(".rm-attention-heading"), /text-transform:\s*uppercase/);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · INGEN ANNAN YTA ÄNDRAS
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-ISOLERING: rummet rör ingen annan yta, och startsidans egen översikt överlever", () => {
  /*
    LÅSET ÄR OMFORMULERAT, INTE FÖRSVAGAT (SHREDDER-01A).

    Tidigare mättes startsidan BYTE-IDENTISKT mot körningens frusna bas. Den mätaren kodade den
    upphävda regeln "startsidan ändras aldrig" (ROUTE_PLAN:s dolda /loop-träd), och ägarbeslutet i
    docs/nortropic-factory-room-roadmap-erratum-01.md gör en ingång från startsidan till
    showroomet till en TILLÅTEN produktändring. En byte-jämförelse hade fällt den ändringen som om
    den vore en regression — alltså hade mätaren mätt fel sak, inte för hårt.

    Det byte-låset SKYDDADE är kvar och mäts direkt:
      1 · den gamla översikten finns kvar på / — ProcessGuide, PipelinePanel och MetricsPanel
          importeras OCH renderas där. Rummet får läggas TILL, aldrig ersätta;
      2 · beroendet går bara åt ett håll: ingen rumsmodul importerar från startsidan, och ingen
          rumsmodul drar in startsidans paneler.
  */
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(
      !/PipelinePanel|ProcessGuide|MetricsPanel/.test(source),
      `${path} importerar en panel som rummet inte delar`,
    );
    assert.ok(!/app\/\(app\)\/page|components\/Sidebar/.test(source), `${path} rör en annan route`);
  }

  const homeSource = readFileSync(join(REPO_ROOT, "app/(app)/page.tsx"), "utf8");
  const homeCode = stripComments(homeSource);
  for (const panel of ["ProcessGuide", "PipelinePanel", "MetricsPanel"]) {
    assert.match(
      homeCode,
      new RegExp(`import\\s+${panel}\\s+from`),
      `startsidan importerar inte längre ${panel} — den gamla översikten togs bort`,
    );
    assert.match(
      homeCode,
      new RegExp(`<${panel}[\\s/>]`),
      `startsidan renderar inte längre ${panel}`,
    );
  }

  // LÖGNSTUB: en startsida utan panelen fälls verkligen av samma uppslag.
  const withoutPanel = homeCode.replace(/<MetricsPanel[\s/>]/, "<Borttagen ");
  assert.ok(
    !/<MetricsPanel[\s/>]/.test(withoutPanel),
    "uppslaget skulle inte se att panelen togs bort",
  );

  // Beroenderiktningen: startsidan är ingen modul som rummet läser ur.
  for (const { path, source } of roomSourceFiles()) {
    assert.ok(
      !/from\s+["'][^"']*\(app\)\/page/.test(source),
      `${path} importerar från startsidan — beroendet går åt fel håll`,
    );
  }

  // Routen matar fortfarande skalet med fixturen, och läget läses vid request.
  const route = readFileSync(join(REPO_ROOT, "app/(app)/loop/page.tsx"), "utf8");
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.equal(FIXTURE_MODE, true);
  assert.ok(existsSync(join(REPO_ROOT, "components/loop/room")));
});
