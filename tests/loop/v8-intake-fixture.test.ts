/**
 * V8* · MARKDOWN-INTAKE I FIXTURLÄGE.
 *
 * Provar exit-kriterierna i docs/nortropic-control-room-plan-v1.md §V8 i den form de kan
 * bevisas MOT FIXTUR, plus TEST_MATRIX §Intake (I1, I2, I3, I5, I6, I7) och §States (S4t):
 *
 *   (1) .md accepteras; .txt/.pdf/.exe avvisas i KLIENTEN. Serverledet hör till V8 live.
 *   (2) Storleks- och antalsgräns hålls; överskridande avvisas med tydlig orsak.
 *   (3) Originalkällan bevaras byte-identisk och kan visas efteråt.
 *   (4) Frontenden kompilerar ALDRIG tasks: en källa med två arbetsmål ger noll UI-genererade
 *       tasks före controllerns svar, och antalet är "—" — aldrig 0 som påstående.
 *   (5) Backend-avslag visas ordagrant med rå command_id och status, utan att ett namngivet
 *       fält läses ur controllerns opaka svar.
 *   (6) NEEDS_SPEC renderas som ARBETSLÄGE i warning, aldrig som fel.
 *
 * OCH DEN VIKTIGASTE NEGATIVA KONTROLLEN FÖR EN FIXTURSKIVA: att skivan inte i smyg har blivit
 * "live". Provet mäter statiskt att app/api/loop/intake INTE finns, att ingen transportväg
 * anropas, att ingen sha256 beräknas och att ingen markdown tolkas semantiskt.
 *
 * HARNESS-NOT: samma som V2 — tsconfig har `jsx: "preserve"`, så den globala React-raden nedan
 * behövs för de DELADE komponenterna (PageHeader, Graceful) utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import IntakeDropzone, {
  INTAKE_DOM_IDS,
  SelectionReport,
  toCandidate,
} from "../../components/loop/IntakeDropzone";
import IntakeResult from "../../components/loop/IntakeResult";
import IntakeShell from "../../components/loop/IntakeShell";
import MataMaskinenPage from "../../app/(app)/loop/mata/page";
import {
  FIXTURE_MODE,
  RAW_FIXTURES,
  fixtureIntakeCandidates,
  fixtureIntakeOutcomes,
  fixtureIntakeOverCountSelection,
} from "../../lib/loop/fixtures";
import {
  FRONTEND_COMPILES_TASKS,
  INTAKE_ACCEPTED_EXTENSIONS,
  INTAKE_ACCEPTED_MIME_TYPES,
  INTAKE_ACCEPT_ATTRIBUTE,
  INTAKE_BLOCKED_ON,
  INTAKE_CLIENT_COMPUTES_SHA256,
  INTAKE_DISABLED_REASON,
  INTAKE_MAX_FILES,
  INTAKE_MAX_FILE_BYTES,
  INTAKE_MODE,
  INTAKE_SERVER_ROUTE,
  INTAKE_TRANSPORT,
  NEEDS_SPEC_ACTION_LABEL,
  SUBMISSION_PRESENTATION,
  SUBMISSION_WAITING_TEXT,
  classifyIntakeCandidate,
  controllerTaskCount,
  intakeSubmissionEnabled,
  pasteSourceName,
  sourceStats,
  submissionPresentationCoverage,
  uiGeneratedTaskCount,
  validateIntakeOutcome,
  validateIntakeSelection,
  type IntakeCandidate,
  type IntakeOutcome,
  type IntakeRejectionCode,
} from "../../lib/loop/intake";
import { LOOP_CSS } from "../../components/loop/ui";
import { MISSING, NEEDS_SPEC_EXPLANATION, TASK_LIFECYCLE_PRESENTATION } from "../../lib/loop/labels";
import { SUBMISSION_LIFECYCLE, TASK_LIFECYCLE } from "../../lib/loop/schema";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Filerna V8* äger. Den statiska kontrollen ska mäta exakt dem — inte "ungefär /loop". */
const INTAKE_FILES = [
  "lib/loop/intake.ts",
  "components/loop/IntakeDropzone.tsx",
  "components/loop/IntakeResult.tsx",
  "components/loop/IntakeShell.tsx",
  "app/(app)/loop/mata/page.tsx",
] as const;

/** Kod utan kommentarer: en fil som FÖRBJUDER en väg i klartext får inte fällas av sitt förbud. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceOf(relative: string): string {
  return stripComments(readFileSync(path.join(REPO_ROOT, relative), "utf8"));
}

/** React escapar &, <, >, " och '. Ordagrannhetsprov mäts på den avkodade texten. */
function decodeEntities(html: string): string {
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function outcomes(): IntakeOutcome[] {
  const list = fixtureIntakeOutcomes();
  assert.ok(list.length >= 4, "intakefixturen saknar utfall — provet mäter ingenting");
  return list;
}

function outcomeById(id: string): IntakeOutcome {
  const found = outcomes().find((outcome) => outcome.submission_id === id);
  assert.ok(found, `inget fixturutfall med id ${id}`);
  return found;
}

const AWAITING = "sub-fixture-0001";
const REJECTED = "sub-fixture-0002";
const NEEDS_SPEC = "sub-fixture-0003";
const ANSWERED = "sub-fixture-0004";

function renderResult(outcome: IntakeOutcome): string {
  return renderToStaticMarkup(createElement(IntakeResult, { outcome }));
}

function renderShell(): string {
  return renderToStaticMarkup(
    createElement(IntakeShell, { outcomes: outcomes(), fixture: FIXTURE_MODE }),
  );
}

function cards(html: string): string[] {
  return html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/* ── 1 · Grinden och fixturläget ──────────────────────────────────────────── */

test("V8*-GATE: /loop/mata finns inte när LOOP_ENABLED är av — samma fail-closed som resten", () => {
  const before = process.env.LOOP_ENABLED;
  try {
    delete process.env.LOOP_ENABLED;
    assert.throws(() => MataMaskinenPage(), /NEXT_HTTP_ERROR_FALLBACK;404/);
    process.env.LOOP_ENABLED = "false";
    assert.throws(() => MataMaskinenPage(), /NEXT_HTTP_ERROR_FALLBACK;404/);

    process.env.LOOP_ENABLED = "true";
    const page = MataMaskinenPage() as ReactElement;
    assert.ok(page, "sidan returnerade inget träd med LOOP_ENABLED=true");
    const route = readFileSync(path.join(REPO_ROOT, "app/(app)/loop/mata/page.tsx"), "utf8");
    assert.match(route, /export const dynamic = "force-dynamic"/);
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
});

test("V8*-DATA: routen matar skalet med EXAKT fixturens utfall — ingen egen modell", () => {
  const before = process.env.LOOP_ENABLED;
  try {
    process.env.LOOP_ENABLED = "true";
    const page = MataMaskinenPage() as ReactElement;
    const children = React.Children.toArray(
      (page.props as { children: React.ReactNode }).children,
    ) as ReactElement[];
    const shell = children.find((child) => child.type === IntakeShell);
    assert.ok(shell, "routen renderar inte IntakeShell");
    const props = shell.props as { outcomes: IntakeOutcome[]; fixture: boolean };
    assert.deepEqual(props.outcomes, fixtureIntakeOutcomes());
    assert.equal(props.fixture, FIXTURE_MODE, "fixturläget märks inte ut för skalet");
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
});

test("V8*-FIXTUR: läget märks ut synligt och maskinläsbart — skivan påstår aldrig att den är live", () => {
  const html = renderShell();
  assert.equal(INTAKE_MODE, "FIXTURE_ONLY");
  assert.equal(INTAKE_TRANSPORT, "NONE");
  assert.equal(INTAKE_SERVER_ROUTE, null);
  assert.equal(INTAKE_CLIENT_COMPUTES_SHA256, false);
  assert.equal(FRONTEND_COMPILES_TASKS, false);
  assert.equal(intakeSubmissionEnabled(), false);

  assert.ok(html.includes('data-intake-mode="FIXTURE_ONLY"'));
  assert.ok(html.includes('data-intake-transport="NONE"'));
  assert.ok(html.includes('data-client-hashes="false"'));
  assert.ok(html.includes('data-fixture="true"'));
  assert.ok(html.includes('data-fixture-banner="true"'), "fixturbannern saknas");
  assert.ok(html.includes(INTAKE_BLOCKED_ON), "blockeringen på S10 + S13 nämns inte i UI:t");
  assert.ok(
    !/live-komplett|live complete|nu live\b/i.test(html),
    "UI:t beskrev fixturskivan som live",
  );
});

/* ── 2 · Ingen transport, ingen route, ingen hash, ingen markdown-tolkning ─── */

test("V8*-NEG: app/api/loop/intake finns INTE — och ingen loop-route har smugit in i app/api", () => {
  assert.equal(existsSync(path.join(REPO_ROOT, "app/api/loop")), false, "app/api/loop finns");
  assert.equal(
    existsSync(path.join(REPO_ROOT, "app/api/loop/intake/route.ts")),
    false,
    "intake-routen finns — den skivan är V8 live och blockerad på S10 + S13",
  );
});

test("V8*-NEG: ingen transportväg, ingen hashning och ingen semantisk markdown-tolkning", () => {
  for (const file of INTAKE_FILES) {
    const source = sourceOf(file);

    assert.ok(
      !/fetch\(|XMLHttpRequest|sendBeacon|EventSource|WebSocket|axios|supabase|createClient/i.test(source),
      `${file} rör en transport som den här skivan inte har`,
    );
    assert.ok(
      !/<form\b|new FormData|method=["']post|action=["']\//i.test(source),
      `${file} bär en inlämningsväg`,
    );
    assert.ok(
      !/crypto\.subtle|createHash|\.digest\(|sha256\(|hashSync/i.test(source),
      `${file} beräknar en hash — appens värde får aldrig bli ett trust-anchor`,
    );
    assert.ok(
      !/marked|remark|markdown-it|micromark|parseMarkdown|dangerouslySetInnerHTML: *\{ *__html: *(?!LOOP_CSS)/i.test(
        source,
      ),
      `${file} tolkar markdown`,
    );
    assert.ok(
      !/#\{1,6\}|startsWith\(["']#|split\(["']#|match\(\/#/.test(source),
      `${file} parsar rubriker — klienten tolkar aldrig källan semantiskt`,
    );
    assert.ok(
      !/github-write|github-read|GITHUB_TOKEN|child_process|simple-git|LOOP_SUPABASE/i.test(source),
      `${file} rör en väg som /loop aldrig äger`,
    );
  }
});

test("V8*-NEG: källans påstådda sha256 och dedup-nyckel når ALDRIG DOM", () => {
  const html = renderShell();
  for (const outcome of outcomes()) {
    const command = outcome.command;
    assert.ok(command, "fixturutfallet saknar transportrad");
    const claimed = (command.payload as Record<string, unknown>).source_sha256;
    assert.equal(typeof claimed, "string");
    assert.ok(
      !html.includes(claimed as string),
      "en påstådd sha256 renderades — appens hash får aldrig se ut som en sanning om källan",
    );
    assert.ok(!html.includes(command.dedup_key), "dedup-nyckeln (som bär hashen) renderades");
  }
});

/* ── 3 · I1 · filtyp: .md accepteras, annat avvisas i klienten ────────────── */

test("V8*-I1: klienten accepterar markdown och avvisar allt annat, med orsak per fil", () => {
  const candidates = fixtureIntakeCandidates();
  assert.equal(candidates.length, (RAW_FIXTURES.intakeCandidates as unknown[]).length);

  /** Förutsagd fällningskarta, skriven FÖRE körning och oberoende av klassificeraren. */
  const expected: Record<string, IntakeRejectionCode | "accepted"> = {
    "backlog-aug.md": "accepted",
    "PLAN.MD": "accepted",
    "anteckningar.markdown": "accepted",
    "med-parametrar.md": "accepted",
    "exakt-gransen.md": "accepted",
    "over-gransen.md": "too_large",
    "tom.md": "empty",
    "anteckningar.txt": "extension",
    "rapport.pdf": "extension",
    "verktyg.exe": "extension",
    README: "extension",
    "falsk.md": "mime_type",
    "dubbel.md.exe": "extension",
  };

  for (const candidate of candidates) {
    const verdict = classifyIntakeCandidate(candidate);
    const want = expected[candidate.file_name];
    assert.ok(want, `fixturkandidaten ${candidate.file_name} saknar förutsagd dom`);
    if (want === "accepted") {
      assert.equal(verdict.accepted, true, `${candidate.file_name} avvisades felaktigt`);
    } else {
      assert.equal(verdict.accepted, false, `${candidate.file_name} accepterades felaktigt`);
      if (!verdict.accepted) assert.equal(verdict.code, want, `fel orsak för ${candidate.file_name}`);
    }
  }

  // Vokabulären är låst: bara dessa ändelser och MIME-typer tas emot.
  assert.deepEqual([...INTAKE_ACCEPTED_EXTENSIONS], [".md", ".markdown"]);
  assert.deepEqual([...INTAKE_ACCEPTED_MIME_TYPES], ["text/markdown", "text/plain", ""]);
});

test("V8*-I1: avvisade filer syns i UI:t med sin orsak — ingen fil faller bort tyst", () => {
  const selection = validateIntakeSelection(fixtureIntakeCandidates());
  const html = renderToStaticMarkup(createElement(SelectionReport, { selection }));

  for (const verdict of selection.verdicts) {
    assert.ok(
      html.includes(`data-file-name="${verdict.candidate.file_name}"`),
      `${verdict.candidate.file_name} saknas i rapporten`,
    );
    if (!verdict.accepted) {
      assert.ok(html.includes(`data-rejection-code="${verdict.code}"`));
      assert.ok(decodeEntities(html).includes(verdict.message), "orsaken visas inte ordagrant");
    }
  }
  assert.ok(html.includes('data-accepted="false"'), "ingen fil renderades som avvisad");
  assert.ok(html.includes('data-accepted="true"'), "ingen fil renderades som godkänd");
});

test("V8*-I1: filväljaren begränsar urvalet och kandidaten byggs utan att läsa filens bytes", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes(`accept="${INTAKE_ACCEPT_ATTRIBUTE}"`), "accept-attributet saknas");
  assert.deepEqual(toCandidate({ name: "a.md", size: 12, type: "text/markdown" }), {
    file_name: "a.md",
    byte_size: 12,
    mime_type: "text/markdown",
  });
  // Kandidatens form har exakt tre fält — innehållet ingår aldrig.
  assert.deepEqual(Object.keys(toCandidate({ name: "a.md", size: 1, type: "" })).sort(), [
    "byte_size",
    "file_name",
    "mime_type",
  ]);
});

/* ── 4 · I2 · storleks- och antalsgräns ───────────────────────────────────── */

test("V8*-I2: storleksgränsen håller på bytenivå — gränsvärdet accepteras, ett byte över fälls", () => {
  const atLimit: IntakeCandidate = {
    file_name: "gransen.md",
    byte_size: INTAKE_MAX_FILE_BYTES,
    mime_type: "text/markdown",
  };
  const overLimit: IntakeCandidate = { ...atLimit, byte_size: INTAKE_MAX_FILE_BYTES + 1 };

  assert.equal(classifyIntakeCandidate(atLimit).accepted, true, "gränsvärdet avvisades");
  const over = classifyIntakeCandidate(overLimit);
  assert.equal(over.accepted, false);
  if (!over.accepted) {
    assert.equal(over.code, "too_large");
    assert.ok(over.message.length > 0, "avslaget saknar orsak");
  }
  assert.equal(INTAKE_MAX_FILE_BYTES, 1_048_576);
});

test("V8*-I2: antalsgränsen fälls FAIL-CLOSED — ingen fil accepteras tyst ur ett för stort urval", () => {
  const many = fixtureIntakeOverCountSelection();
  assert.equal(many.length, INTAKE_MAX_FILES + 1);

  const selection = validateIntakeSelection(many);
  assert.ok(selection.selection_rejection, "antalsgränsen fälldes inte");
  assert.equal(selection.selection_rejection?.code, "too_many_files");
  assert.deepEqual(selection.accepted, [], "filer accepterades trots att urvalet fälldes");
  assert.equal(selection.verdicts.length, many.length, "en fil tystades bort");

  const html = renderToStaticMarkup(createElement(SelectionReport, { selection }));
  assert.ok(html.includes('data-selection-rejection="too_many_files"'));
  assert.ok(decodeEntities(html).includes(selection.selection_rejection!.message));
  assert.ok(html.includes('data-accepted-count="0"'));

  // Exakt vid gränsen går allt igenom — gränsen är inte "en till för säkerhets skull".
  const exact = validateIntakeSelection(many.slice(0, INTAKE_MAX_FILES));
  assert.equal(exact.selection_rejection, null);
  assert.equal(exact.accepted.length, INTAKE_MAX_FILES);
});

test("V8*-I2: inlämningsknappen är avstängd med ORDAGRANN orsak — ingen fejkad inlämning", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes('data-submit-disabled="true"'), "knappen är inte avstängd");
  assert.ok(/<button[^>]*disabled/.test(html), "knappen saknar disabled-attribut");
  assert.ok(decodeEntities(html).includes(INTAKE_DISABLED_REASON), "orsaken visas inte ordagrant");
  assert.ok(html.includes(INTAKE_BLOCKED_ON));
});

/* ── 4b · Tillgänglighet: varje kontroll har ett namn, varje orsak en koppling ─ */

test("V8*-A11Y: kontrollerna har programmatiska namn via riktiga label-element", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));

  for (const control of [INTAKE_DOM_IDS.filePicker, INTAKE_DOM_IDS.pasteArea] as const) {
    const label = html.match(new RegExp(`<label[^>]*for="${control}"[^>]*>([^<]+)</label>`));
    assert.ok(label, `kontrollen ${control} saknar en <label for>`);
    assert.ok(label[1].trim().length > 0, `etiketten för ${control} är tom`);
    assert.ok(html.includes(`id="${control}"`), `kontrollen ${control} saknar sitt id`);
  }

  // Ingen kvarlämnad platshållare-som-namn: textarean har både label OCH placeholder.
  assert.ok(/<textarea[^>]*id="intake-inklistrad-text"/.test(html));
  assert.ok(/<input[^>]*id="intake-filvaljare"[^>]*type="file"/.test(html));
});

test("V8*-A11Y: den avstängda knappens ORSAK är kopplad till knappen, inte bara placerad bredvid", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const button = html.match(/<button[^>]*>/);
  assert.ok(button, "knappen saknas");
  const describedBy = attr(button[0], "aria-describedby");
  assert.ok(describedBy, "den avstängda knappen förklarar sig inte för hjälpmedel");
  assert.ok(
    describedBy.split(/\s+/).includes(INTAKE_DOM_IDS.disabledReason),
    "orsakstexten är inte kopplad till knappen",
  );
  assert.ok(describedBy.split(/\s+/).includes(INTAKE_DOM_IDS.blockedOn));
  assert.ok(html.includes(`id="${INTAKE_DOM_IDS.disabledReason}"`));
});

test("V8*-A11Y-NEG: ingen koppling pekar på ett id som saknas i markupen", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const present = new Set((html.match(/ id="([^"]+)"/g) ?? []).map((m) => m.slice(5, -1)));

  const referenced = [
    ...(html.match(/(?:for|aria-describedby|aria-labelledby)="([^"]+)"/g) ?? []),
  ].flatMap((match) => match.replace(/^[^"]+"/, "").replace(/"$/, "").split(/\s+/));

  assert.ok(referenced.length > 0, "inga kopplingar hittades — provet mäter ingenting");
  for (const id of referenced) {
    assert.ok(present.has(id), `kopplingen pekar på ett id som inte finns: ${id}`);
  }
  // Varje id är unikt: en dubblett hade gjort kopplingen tvetydig.
  const all = (html.match(/ id="([^"]+)"/g) ?? []).map((m) => m.slice(5, -1));
  assert.equal(new Set(all).size, all.length, "samma id förekommer två gånger");
  for (const id of Object.values(INTAKE_DOM_IDS)) {
    assert.ok(present.has(id), `id ${id} bärs som konstant men når aldrig markupen`);
  }
});

/* ── 5 · I3 · originalkällan bevaras byte-identisk och kan visas ──────────── */

test("V8*-I3: originalkällan renderas RÅTT och byte-identiskt med fixturen", () => {
  for (const outcome of outcomes()) {
    const html = renderResult(outcome);
    const raw = html.match(/<pre[^>]*data-source-raw="true"[^>]*>([\s\S]*?)<\/pre>/);
    assert.ok(raw, `originalkällan visas inte för ${outcome.submission_id}`);
    assert.equal(
      decodeEntities(raw[1]),
      outcome.source.text,
      "källan renderades inte byte-identiskt",
    );
  }
});

test("V8*-I3: källans mått är tecken och rader — inget annat räknas fram ur en markdownkälla", () => {
  const outcome = outcomeById(AWAITING);
  const stats = sourceStats(outcome.source.text);
  assert.equal(stats.lines, outcome.source.text.split("\n").length - 1);
  assert.equal(stats.characters, [...outcome.source.text].length);
  assert.equal(sourceStats("").lines, 0);
  assert.equal(sourceStats("a").lines, 1);
  assert.equal(sourceStats("a\n").lines, 1);
  assert.equal(sourceStats("a\nb").lines, 2);

  const html = renderResult(outcome);
  assert.ok(html.includes('data-source-stats="true"'));
  assert.ok(html.includes(`${stats.characters} tecken`));
  assert.ok(html.includes(`${stats.lines} rader`));
});

/* ── 6 · I6 · frontenden kompilerar ALDRIG tasks ──────────────────────────── */

test("V8*-I6: en källa med TVÅ arbetsmål ger NOLL uppgifter före controllerns svar", () => {
  const outcome = outcomeById(AWAITING);
  // Fixturkällan innehåller bevisligen två arbetsmål — annars mäter provet ingenting.
  assert.equal((outcome.source.text.match(/## Mål/g) ?? []).length, 2);
  assert.equal(outcome.controller_answer, null);
  assert.equal(controllerTaskCount(outcome), null);
  assert.equal(uiGeneratedTaskCount(), 0);

  const html = renderResult(outcome);
  assert.equal(cards(html).length, 0, "UI:t skapade uppgifter före controllerns svar");
  assert.ok(html.includes('data-ui-generated-tasks="0"'));
  assert.ok(html.includes(`data-controller-task-count="${MISSING}"`), "antalet gissades");
  assert.ok(html.includes(SUBMISSION_WAITING_TEXT), "planens väntetext saknas");
  assert.ok(html.includes('data-awaiting="true"'));
  // Inga siffror som förhandstolkning: varken "2 uppgifter" eller ett nollpåstående.
  assert.ok(!/\b2 uppgifter\b/.test(html), "UI:t uppskattade antalet uppgifter");
  assert.ok(!/data-controller-task-count="0"/.test(html), "okänt antal renderades som 0");
});

test("V8*-I6: efter svaret kommer antalet ur CONTROLLERN — samma källa, nu två uppgifter", () => {
  const awaiting = outcomeById(AWAITING);
  const answered = outcomeById(ANSWERED);
  // Samma källa i båda utfallen: skillnaden är controllerns svar, inte källans innehåll.
  assert.equal(answered.source.text, awaiting.source.text);
  assert.equal(controllerTaskCount(answered), 2);

  const html = renderResult(answered);
  assert.equal(cards(html).length, 2);
  assert.ok(html.includes('data-controller-task-count="2"'));
  assert.ok(html.includes('data-ui-generated-tasks="0"'), "UI:t räknade sig själv som upphov");
  for (const task of answered.controller_answer!.tasks) {
    assert.ok(html.includes(`data-task-id="${task.task_id}"`));
  }
});

/* ── 7 · I5 · backend-avslag ordagrant ────────────────────────────────────── */

test("V8*-I5: controllerns avslag visas ordagrant med rå command_id och rå status", () => {
  const outcome = outcomeById(REJECTED);
  const command = outcome.command!;
  assert.equal(command.status, "rejected");
  const result = command.result as Record<string, unknown>;
  const reason = Object.values(result)[0] as string;
  assert.equal(typeof reason, "string");

  const html = decodeEntities(renderResult(outcome));
  assert.ok(html.includes('data-intake-rejection="true"'));
  assert.ok(html.includes(command.command_id), "rå command_id saknas");
  assert.ok(html.includes(`data-rejection-status="${command.status}"`), "rå status saknas");
  assert.ok(html.includes(reason), "orsakssträngen visas inte ordagrant");
  // Ingen omskrivning till något vänligare, och ingen knapp som skickar samma sak igen.
  assert.ok(!/försök igen|prova igen|try again/i.test(html), "UI:t erbjöd en blind omsändning");
  assert.ok(!/något gick fel|ett fel uppstod/i.test(html), "orsaken skrevs om");
});

test("V8*-I5: 'i sin helhet' är ett löfte om SYNLIGHET — avslaget bryts om, kapas aldrig", () => {
  const html = renderResult(outcomeById(REJECTED));
  // Påståendet finns i UI:t …
  assert.ok(html.includes("ordagrant och i sin helhet"), "löftet om helheten saknas");

  // … och stilarket måste infria det: hela svaret läsbart utan horisontell scroll.
  assert.match(
    LOOP_CSS,
    /\.mk-raw\[data-rejection-verbatim="true"\]\s*\{[^}]*white-space:\s*pre-wrap/,
    "avslaget kräver sidled-scroll för att läsas — UI:t lovar mer än det visar",
  );
  assert.match(
    LOOP_CSS,
    /\.mk-raw\[data-rejection-verbatim="true"\]\s*\{[^}]*overflow-wrap:\s*anywhere/,
    "en lång sträng utan mellanslag (t.ex. en hash) bryts inte och sticker ut ur panelen",
  );

  // Och ingenting får kapa svaret: varken CSS-trunkering eller en "visa mer"-lucka.
  assert.ok(
    !/text-overflow:\s*ellipsis|line-clamp/i.test(LOOP_CSS),
    "stilarket trunkerar text i /loop-trädet",
  );
  assert.ok(!/visa mer|läs mer|show more/i.test(html), "avslaget gömdes bakom en expandering");
  assert.ok(!html.includes("…"), "avslaget renderades med ellips");
});

test("V8*-STIL: intakens klasser finns faktiskt i stilarket — ingen klass utan regel", () => {
  const html = renderShell();
  const used = new Set(
    (html.match(/class="([^"]*)"/g) ?? [])
      .flatMap((match) => match.slice(7, -1).split(/\s+/))
      .filter((name) => name.startsWith("mk-")),
  );
  assert.ok(used.size > 0, "ingen namnrymdad klass användes — provet mäter ingenting");
  /*
    `mk-tone-neutral` är AVSIKTLIGT regellös: neutral ÄR grundutseendet på .mk-card och
    .mk-badge, och en modifierare som återupprepar grunden hade bara kunnat glida isär från
    den. Undantaget står här, uttryckligen, i stället för att provet tyst släpper igenom
    varje klass utan regel.
  */
  const intentionallyRuleless = new Set(["mk-tone-neutral"]);
  for (const name of used) {
    if (intentionallyRuleless.has(name)) continue;
    assert.ok(
      LOOP_CSS.includes(`.${name}`),
      `klassen ${name} används men har ingen regel i stilarket`,
    );
  }
  // Kontrollernas namn ska läsas som namn, inte som kapitälrubrik.
  assert.ok(html.includes('class="mk-control-label"'));
  assert.match(LOOP_CSS, /\.mk-control-label\s*\{[^}]*font-size:\s*12\.5px/);
  // Webbläsarens filknapp bär husets färger i stället för systemets ljusa default.
  assert.match(LOOP_CSS, /\.mk-file-input::file-selector-button\s*\{[^}]*background:\s*var\(--bg-surface-2\)/);
});

test("V8*-I5-NEG: avslaget läses ALDRIG fältvis — ett annat nyckelnamn renderas lika ordagrant", () => {
  const base = outcomeById(REJECTED);
  const original = base.command!.result as Record<string, unknown>;
  const originalText = Object.values(original)[0] as string;

  // Controllerns resultatkarta är opak (S13/B5). Byts nyckelnamnet ut ska renderingen vara
  // oförändrad — annars läser UI:t ett fält vars namn ingen backend har låst.
  const mutated = structuredClone(base) as unknown as Record<string, unknown>;
  (mutated.command as Record<string, unknown>).result = { orsak_fran_controllern: originalText };
  const validated = validateIntakeOutcome(mutated);
  assert.equal(validated.ok, true, "en opak resultatkarta med annat nyckelnamn avvisades");
  if (!validated.ok) return;

  const html = decodeEntities(renderResult(validated.data));
  assert.ok(html.includes(originalText), "orsaken försvann när nyckelnamnet byttes");
  assert.ok(html.includes("orsak_fran_controllern"), "kartan renderades inte i sin helhet");
  assert.ok(html.includes('data-rejection-verbatim="true"'));

  // Och ett avslag helt utan resultatkarta blir "—", aldrig en påhittad orsak.
  const withoutResult = structuredClone(base) as unknown as Record<string, unknown>;
  (withoutResult.command as Record<string, unknown>).result = null;
  const empty = validateIntakeOutcome(withoutResult);
  assert.equal(empty.ok, true);
  if (!empty.ok) return;
  const emptyHtml = renderResult(empty.data);
  assert.ok(emptyHtml.includes(MISSING));
  assert.ok(!emptyHtml.includes('data-rejection-verbatim="true"'));
});

/* ── 8 · S4t · NEEDS_SPEC är ett arbetsläge ───────────────────────────────── */

test("V8*-S4t: NEEDS_SPEC renderas som arbetsläge i warning — aldrig som fel", () => {
  const outcome = outcomeById(NEEDS_SPEC);
  const tasks = outcome.controller_answer!.tasks;
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].state, "NEEDS_SPEC");
  assert.equal(TASK_LIFECYCLE_PRESENTATION.NEEDS_SPEC.tone, "warning");

  const html = renderResult(outcome);
  const card = cards(html)[0];
  assert.ok(card, "uppgiftskortet saknas");
  assert.equal(attr(card, "data-tone"), "warning");
  assert.ok(!card.includes("mk-tone-danger"), "NEEDS_SPEC renderades som fel");
  assert.ok(html.includes(NEEDS_SPEC_EXPLANATION), "planens förklaring saknas");
  assert.ok(html.includes('data-needs-spec-action="true"'));
  assert.ok(html.includes(NEEDS_SPEC_ACTION_LABEL), "åtgärden 'Komplettera källan' saknas");
  assert.ok(!/försök igen|prova igen/i.test(html), "en blind omsändning erbjöds");
  assert.ok(!/\bFEL\b|misslyckad|Error\b/i.test(html), "NEEDS_SPEC beskrevs som fel");
  // Originalet finns kvar att komplettera — arbetsläget är hanterbart, inte en återvändsgränd.
  assert.ok(html.includes('data-source-raw="true"'));
});

/* ── 9 · I7 · inklistrad text går samma väg som en fil ────────────────────── */

test("V8*-I7: inklistrad text blir en EGEN källa med genererat namn och samma väg som en fil", () => {
  const pasted = outcomeById(REJECTED);
  const file = outcomeById(AWAITING);
  assert.equal(pasted.source.origin, "paste");
  assert.equal(file.source.origin, "file");
  assert.equal(pasted.source.source_name, pasteSourceName(1));

  // Samma kontrakt, samma verb, samma transportform — inget genvägsspår för den inklistrade.
  assert.equal(pasted.command!.verb, file.command!.verb);
  assert.deepEqual(
    Object.keys(pasted.command!.payload as Record<string, unknown>).sort(),
    Object.keys(file.command!.payload as Record<string, unknown>).sort(),
  );
  assert.deepEqual(Object.keys(pasted.source).sort(), Object.keys(file.source).sort());

  // Namngenereringen är deterministisk — ingen klocka och ingen slump i ett filnamn.
  assert.equal(pasteSourceName(1), pasteSourceName(1));
  assert.equal(pasteSourceName(2), "inklistrad-kalla-02.md");

  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes('data-paste-area="true"'), "inklistringsytan saknas");
});

/* ── 10 · Inlämningsläget är UI-LOKALT och aldrig task state (B1) ─────────── */

test("V8*-B1: submission.* renderas som UI-lokalt läge, aldrig som en task lifecycle-state", () => {
  assert.equal(submissionPresentationCoverage(), true);
  const taskLabels = new Set(TASK_LIFECYCLE.map((state) => TASK_LIFECYCLE_PRESENTATION[state].label));

  for (const state of SUBMISSION_LIFECYCLE) {
    const presentation = SUBMISSION_PRESENTATION[state];
    assert.equal(presentation.is_task_state, false);
    assert.ok(
      !taskLabels.has(presentation.label),
      `inlämningsläget ${state} delar etikett med ett task-tillstånd`,
    );
    assert.ok(
      !(TASK_LIFECYCLE as readonly string[]).includes(state),
      `${state} smög in i task lifecycle-vokabulären`,
    );
  }

  const html = renderShell();
  assert.ok(html.includes('data-task-state="false"'), "inlämningsmärket är inte märkt UI-lokalt");
  for (const outcome of outcomes()) {
    assert.ok(html.includes(`data-submission-state="${outcome.submission_state}"`));
  }
});

/* ── 11 · Fixturingången släpper aldrig igenom en uppfunnen form ──────────── */

test("V8*-FIXTUR: varje utfall validerar mot V1:s låsta kontrakt — inget tystas och inget uppfinns", () => {
  assert.equal(fixtureIntakeOutcomes().length, (RAW_FIXTURES.intakeOutcomes as unknown[]).length);

  const base = outcomeById(ANSWERED);
  const lies: { namn: string; muterad: () => unknown }[] = [
    {
      namn: "uppfunnet toppnivåfält",
      muterad: () => ({ ...structuredClone(base), estimated_tasks: 2 }),
    },
    {
      namn: "task utan V1:s TaskView-form",
      muterad: () => {
        const clone = structuredClone(base) as unknown as {
          controller_answer: { tasks: Record<string, unknown>[] };
        };
        delete clone.controller_answer.tasks[0].task_gate;
        return clone;
      },
    },
    {
      namn: "inlämningsläge utanför den UI-lokala namnrymden",
      muterad: () => ({ ...structuredClone(base), submission_state: "WORKING" }),
    },
    {
      namn: "command_id som inte är en UUIDv4",
      muterad: () => {
        const clone = structuredClone(base) as unknown as { command: { command_id: string } };
        clone.command.command_id = "inte-ett-uuid";
        return clone;
      },
    },
  ];

  for (const lie of lies) {
    assert.equal(
      validateIntakeOutcome(lie.muterad()).ok,
      false,
      `lögnen "${lie.namn}" gick grön`,
    );
  }
});

/* ── 12 · Inga procent, inga staplar, ingen fabricerad aktivitet ──────────── */

test("V8*-NEG: intakeytan bär ingen procentsats, ingen stapel och ingen fejkad aktivitet", () => {
  const html = renderShell();
  assert.ok(!html.includes("%"), "procenttecken i intake-markup");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement");
  assert.ok(!/@keyframes|animation:/i.test(html), "animation i intake-markup");
  assert.ok(!/laddar upp|skickar|uppladdning pågår/i.test(html), "UI:t antydde en pågående inlämning");

  for (const file of INTAKE_FILES) {
    const source = sourceOf(file);
    assert.ok(!source.includes("%"), `procenttecken i ${file}`);
    assert.ok(
      !/\b(progressbar|progress-bar|framstegsstapel|procentsats|percentage)\b/i.test(source),
      `framstegssemantik i ${file}`,
    );
  }
});
