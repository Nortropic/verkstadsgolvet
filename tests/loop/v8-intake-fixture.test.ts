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
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import IntakeDropzone, {
  INTAKE_DESCRIBED_BY,
  INTAKE_DOM_IDS,
  INTAKE_MAX_DESCRIBED_BY_NODES,
  INTAKE_PANEL_TITLE,
  SelectionReport,
  dragDepthAfter,
  emptyEventText,
  isDragActive,
  pasteVerdictText,
  toCandidate,
} from "../../components/loop/IntakeDropzone";
import IntakeResult from "../../components/loop/IntakeResult";
import IntakeShell from "../../components/loop/IntakeShell";
import { VALIDATION_SHOWCASE_TITLE } from "../../components/loop/IntakeValidationShowcase";
import BacklogColumn from "../../components/loop/BacklogColumn";
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
  INTAKE_EMPTY_DROP_TEXT,
  INTAKE_EMPTY_PICK_TEXT,
  INTAKE_MAX_FILES,
  INTAKE_MAX_FILE_BYTES,
  INTAKE_MODE,
  INTAKE_NO_SELECTION_TEXT,
  INTAKE_SERVER_ROUTE,
  INTAKE_TRANSPORT,
  NEEDS_SPEC_ACTION_HINT,
  NEEDS_SPEC_ACTION_LABEL,
  SUBMISSION_PRESENTATION,
  SUBMISSION_WAITING_TEXT,
  classifyIntakeCandidate,
  controllerTaskCount,
  groupDigits,
  intakeSubmissionEnabled,
  pasteSourceName,
  sourceStats,
  sourceStatsText,
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
  "components/loop/IntakeValidationShowcase.tsx",
  "app/(app)/loop/mata/page.tsx",
] as const;

/** Kod utan kommentarer: en fil som FÖRBJUDER en väg i klartext får inte fällas av sitt förbud. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceOf(relative: string): string {
  return stripComments(readFileSync(path.join(REPO_ROOT, relative), "utf8"));
}

/**
 * Filen MED sina kommentarer. En påstådd riktning ("nedan") eller ett påstått antal
 * ("enda live-området") lever ofta i en kommentar, och en kommentar som blivit osann vilseleder
 * nästa läsare precis lika mycket som en osann etikett i UI:t.
 */
function rawSourceOf(relative: string): string {
  return readFileSync(path.join(REPO_ROOT, relative), "utf8");
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
    createElement(IntakeShell, {
      outcomes: outcomes(),
      candidates: fixtureIntakeCandidates(),
      overCount: fixtureIntakeOverCountSelection(),
      fixture: FIXTURE_MODE,
    }),
  );
}

/** Hela routen, som den faktiskt renderas: sidhuvudets h1 OCH skalets paneler i ett svep. */
function renderPage(): string {
  const before = process.env.LOOP_ENABLED;
  try {
    process.env.LOOP_ENABLED = "true";
    return renderToStaticMarkup(MataMaskinenPage() as ReactElement);
  } finally {
    if (before === undefined) delete process.env.LOOP_ENABLED;
    else process.env.LOOP_ENABLED = before;
  }
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

/**
 * V4 byggde LÄSYTAN (app/api/loop/{snapshot,events,task}), V7 den SMALA KOMMANDOYTAN
 * (app/api/loop/command) och V9 SSE-TAILEN (app/api/loop/stream). Provet mäter därför inte att
 * app/api/loop saknas, utan det som fortfarande gäller för DEN HÄR skivan: katalogen får
 * innehålla exakt de BYGGDA routarna och ingenting mer.
 *
 * INTAKE-ROUTEN ÄR FORTFARANDE FÖRBJUDEN här: V8 live är blockerad på S10 + S13, och den här
 * skivan är fixturbunden. Listan uppdateras när en skiva FAKTISKT byggt en route — aldrig i
 * förväg, eftersom en förväntad route i listan hade slutat mäta något.
 */
const ALLOWED_LOOP_API_ROUTES = ["command", "events", "snapshot", "stream", "task"];

test("V8*-NEG: app/api/loop innehåller EXAKT de byggda routarna — ingen intake-väg", () => {
  const loopApi = path.join(REPO_ROOT, "app/api/loop");
  const present = existsSync(loopApi) ? readdirSync(loopApi).sort() : [];
  assert.deepEqual(
    present,
    ALLOWED_LOOP_API_ROUTES,
    "app/api/loop har en route utanför läsytan, kommandoytan och strömmen",
  );

  assert.equal(
    existsSync(path.join(loopApi, "intake", "route.ts")),
    false,
    "intake-routen finns — den skivan är inte byggd här",
  );

  // Och strömmen är byggd av V9 — inte av intake-skivan. Att den finns mäts av
  // tests/loop/v9-realtime.test.ts, som äger dess grindar och beteende.
  assert.equal(existsSync(path.join(loopApi, "stream", "route.ts")), true);
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

test("V8*-NEG: intakevyn läser ALDRIG kommandots payload — källhashen kommer bara ur snapshot", () => {
  /*
    STRUKTURELL kontroll, inte en strängjakt. Efter ett ACCEPTERAT intag är controllerns
    publicerade `TaskView.source.sha256` med nödvändighet samma 64 tecken som påståendet i
    kommandot — det är hela poängen med B5: controllern läser bytes, räknar om hashen och
    kräver match. En substrängsökning kan därför inte längre skilja de två värdena åt, och
    provet mäter i stället VARIFRÅN vyn hämtar sitt värde: transportens payload och dedup-nyckel
    får inte läsas alls.
  */
  for (const file of INTAKE_FILES) {
    const source = sourceOf(file);
    assert.ok(!/\bpayload\b/.test(source), `${file} läser kommandots payload`);
    assert.ok(!/dedup_key|dedupKey/.test(source), `${file} läser dedup-nyckeln`);
    assert.ok(!/source_ref/.test(source), `${file} läser den opaka transportreferensen`);
    assert.ok(!/source_sha256/.test(source), `${file} läser appens påstådda hash`);
  }
});

test("V8*-NEG: påståendet och dedup-nyckeln syns aldrig i vyn — och aldrig utanför snapshotens kort", () => {
  for (const outcome of outcomes()) {
    const command = outcome.command;
    assert.ok(command, "fixturutfallet saknar transportrad");
    const claimed = (command.payload as Record<string, unknown>).source_sha256 as string;
    assert.match(claimed, /^[0-9a-f]{64}$/);

    const html = renderResult(outcome);
    assert.ok(!html.includes(command.dedup_key), "dedup-nyckeln (som bär hashen) renderades");

    if (outcome.controller_answer === null) {
      // Inget controllersvar finns → värdet får inte synas någonstans alls.
      assert.ok(
        !html.includes(claimed),
        "ett påstående renderades innan controllern bekräftat det",
      );
      continue;
    }

    /*
      Med ett svar publicerar controllern källans identitet i sina TaskViews, och DEN får visas.
      Utanför korten — i intakevyns egen krom — får värdet däremot inte förekomma, för där hade
      det bara kunnat komma ur transporten.
    */
    const withoutCards = html.replace(/<article\b[\s\S]*?<\/article>/g, "");
    assert.ok(
      !withoutCards.includes(claimed),
      "källhashen renderades i intakevyns egen krom, inte ur snapshotens uppgiftskort",
    );
  }
});

test("V8*-PROVENANCE: alla uppgifter ur EN inlämning delar EN källidentitet, härledd ur källan", () => {
  for (const outcome of outcomes()) {
    const tasks = outcome.controller_answer?.tasks ?? [];
    if (tasks.length === 0) continue;

    // Provets EGEN härledning ur källtexten — aldrig fixturens eget värde återanvänt.
    const expected = createHash("sha256").update(outcome.source.text).digest("hex");

    const ids = new Set(tasks.map((task) => task.source?.source_id));
    assert.equal(ids.size, 1, `${outcome.submission_id}: uppgifterna bär olika källidentitet`);
    for (const task of tasks) {
      assert.ok(task.source, "en uppgift ur en inlämning saknar källa");
      assert.equal(
        task.source.sha256,
        expected,
        `${outcome.submission_id}: uppgiftens käll-sha256 hör inte till den inlämnade källan`,
      );
      assert.equal(
        task.source.locator,
        outcome.source.source_name,
        `${outcome.submission_id}: uppgiften pekar på en annan fil än den inlämnade`,
      );
    }

    // Och identiteten är unik per inlämning — två inlämningar delar aldrig källa.
    const others = outcomes().filter((other) => other.submission_id !== outcome.submission_id);
    for (const other of others) {
      for (const task of other.controller_answer?.tasks ?? []) {
        assert.notEqual(
          task.source?.source_id,
          [...ids][0],
          "två skilda inlämningar delar källidentitet",
        );
      }
    }
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

  // I ett urval som INTE fälls på antalet syns den gröna domen som vanligt.
  assert.ok(html.includes('data-selection-fell="false"'));
  assert.ok(html.includes('data-included="true"'));
  assert.ok(html.includes("Formellt godkänd"));
  assert.equal(
    (html.match(/data-included="true"/g) ?? []).length,
    selection.accepted.length,
    "raderna som lämnas in stämmer inte med urvalets accepterade filer",
  );
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

  /*
    ETT svar per fråga: fälls hela urvalet får ingen rad se godkänd ut. En grön rad ovanför
    "0 filer lämnas in" hade låtit ytan svara två olika saker på samma fråga — och den gröna
    raden är den som läses först.
  */
  assert.ok(html.includes('data-selection-fell="true"'));
  assert.equal(
    (html.match(/mk-tone-success/g) ?? []).length,
    0,
    "en fil såg godkänd ut trots att hela urvalet fälldes",
  );
  assert.ok(!html.includes("Formellt godkänd"), "en rad påstod sig godkänd i ett fällt urval");
  assert.equal(
    (html.match(/data-included="false"/g) ?? []).length,
    many.length,
    "varje rad måste visa att den INTE lämnas in",
  );
  assert.ok(!html.includes('data-included="true"'));
  // Den egna formella domen står kvar — filerna är felfria, det är urvalet som fälls.
  assert.equal((html.match(/data-accepted="true"/g) ?? []).length, many.length);

  /*
    Orsaken bärs EN gång, av banneret. Tjugoen identiska meningar hade inte gjort avslaget
    tydligare — bara längre. Men varje fil ska fortfarande stå i listan: ingen faller bort tyst.
  */
  assert.equal(
    (html.match(/data-file-name="/g) ?? []).length,
    many.length,
    "en fil utelämnades ur listan",
  );
  assert.equal(
    (html.match(/mk-file-reason/g) ?? []).length,
    0,
    "raden upprepar en orsak som redan står i banneret",
  );
  assert.equal(
    (html.match(/data-selection-rejection="/g) ?? []).length,
    1,
    "urvalets orsak ska stå exakt en gång",
  );
  assert.ok(html.includes("mk-list-dense"), "de orsakslösa raderna står inte tätare");
  assert.match(
    LOOP_CSS,
    /@media \(min-width: \d+px\) \{\s*\.mk-list-dense \{[^}]*grid-template-columns/,
    "tätare listan saknar sin flerspaltsregel",
  );

  /*
    C1 · Ingen rad i succéton. Filerna är formellt felfria, men urvalet är fällt — raden ritas
    nedtonad (blockerad) i stället för grön, så att HELA utfallet läses blockerat.
  */
  assert.equal(
    (html.match(/mk-file-blocked/g) ?? []).length,
    many.length,
    "raderna i ett fällt urval ritas inte som blockerade",
  );
  assert.ok(
    LOOP_CSS.includes(".mk-file.mk-file-blocked"),
    "den blockerade raden saknar regel i stilarket",
  );

  // Exakt vid gränsen går allt igenom — gränsen är inte "en till för säkerhets skull".
  const exact = validateIntakeSelection(many.slice(0, INTAKE_MAX_FILES));
  assert.equal(exact.selection_rejection, null);
  assert.equal(exact.accepted.length, INTAKE_MAX_FILES);
});

test("V8*-I2: inlämningsknappen är avstängd med ORDAGRANN orsak — ingen fejkad inlämning", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes('data-submit-disabled="true"'), "knappen är inte avstängd");
  assert.ok(/<button[^>]*aria-disabled="true"/.test(html), "knappen är inte märkt blockerad");
  assert.ok(decodeEntities(html).includes(INTAKE_DISABLED_REASON), "orsaken visas inte ordagrant");
  assert.ok(html.includes(INTAKE_BLOCKED_ON));
  // En blockerad knapp får inte SE öppen ut: den avstängda formen målas nu av aria-tillståndet.
  assert.match(
    LOOP_CSS,
    /\.mk-button\[aria-disabled="true"\][^{]*\{[^}]*cursor:\s*not-allowed/,
    "den aria-blockerade knappen saknar avstängt utseende",
  );
});

/* ── 4a · Avslagen syns UTAN interaktion — annars kan de aldrig granskas ──── */

test("V8*-SYNLIG: avslagsrader och antalsgränsens banner renderas serverside, inte bara efter drag", () => {
  /*
    Utan den här panelen uppstår avvisningarna först efter att någon dragit in filer, och en
    granskning av faktiska skärmbilder ser dem aldrig — kriteriet vore bevisat i prov men
    osett i verkligheten. Panelen kör fixturkandidaterna genom samma validering och samma
    komponent som dropzonen.
  */
  const html = renderShell();
  assert.ok(html.includes('data-validation-showcase="true"'), "valideringspanelen saknas");
  assert.ok(html.includes('data-sample="mixed"'));
  assert.ok(html.includes('data-sample="over-count"'));

  // Varje avslagskod i det blandade urvalet syns med sin orsak, utan en enda klickning.
  const mixed = validateIntakeSelection(fixtureIntakeCandidates());
  const codes = new Set(
    mixed.verdicts.flatMap((verdict) => (verdict.accepted ? [] : [verdict.code])),
  );
  assert.ok(codes.size >= 4, "fixturen täcker för få avslagsorsaker för att panelen ska bevisa något");
  for (const code of codes) {
    assert.ok(html.includes(`data-rejection-code="${code}"`), `orsaken ${code} syns inte`);
  }
  assert.ok(html.includes("mk-tone-danger"), "ingen avvisad rad renderades i danger");

  // Och antalsgränsens fail-closed-banner syns i samma vy.
  assert.ok(html.includes('data-selection-rejection="too_many_files"'));
  assert.ok(html.includes('data-selection-fell="true"'));
});

test("V8*-SYNLIG-NEG: panelen är märkt som fixtur och kan aldrig läsas som ett gjort urval", () => {
  const html = renderShell();
  assert.ok(html.includes('data-fixture-driven="true"'), "panelen är inte märkt som fixturdriven");
  assert.ok(
    html.includes("GENERERADE fixturfiler"),
    "panelen säger inte i klartext att raderna är fixturer",
  );
  assert.ok(html.includes("inget urval, ingen inlämning"));
  // Dropzonens EGNA rapport är fortfarande tom — panelen har inte förvandlats till ett urval.
  assert.ok(html.includes('data-selection="empty"'), "dropzonens tomma läge försvann");
  /*
    Statusraden delas med dropzonen, och dess operatörsröst ("13 valda: …", "21 filer valda.")
    läser som ett gjort urval i EXAKT den panel som säger "Det är ingen fil du valt". Mönstret
    täcker därför också den formen — inte bara "vald fil"/"har valts"/"dina filer".
  */
  assert.ok(
    !/har valts|dina filer|vald fil|filer valda|valda:/i.test(html),
    "panelen påstod att filer valts",
  );

  // Panelens rader talar om KANDIDATER; dropzonens om valda filer. Samma komponent, två röster.
  const fixtureVoice = renderToStaticMarkup(
    createElement(SelectionReport, { selection: validateIntakeSelection(fixtureIntakeCandidates()) }),
  );
  const operatorVoice = renderToStaticMarkup(
    createElement(SelectionReport, {
      selection: validateIntakeSelection(fixtureIntakeCandidates()),
      live: true,
    }),
  );
  assert.ok(fixtureVoice.includes('data-selection-voice="fixture"'), "fixturrösten är inte utmärkt");
  assert.ok(operatorVoice.includes('data-selection-voice="operator"'), "operatörsrösten är inte utmärkt");
  const fixtureStatus = fixtureVoice.match(/data-selection-status="true"[^>]*>([^<]+)</);
  const operatorStatus = operatorVoice.match(/data-selection-status="true"[^>]*>([^<]+)</);
  assert.ok(fixtureStatus && operatorStatus, "statusraden saknas i något av sammanhangen");
  assert.ok(fixtureStatus[1].includes("kandidater"), "fixturpanelen kallar inte raderna kandidater");
  assert.ok(!/valda/i.test(fixtureStatus[1]), `fixturpanelen påstår ett val: "${fixtureStatus[1]}"`);
  assert.ok(operatorStatus[1].includes("valda"), "dropzonen slutade tala om operatörens val");

  // Och detsamma gäller det fällda urvalet, där raden är som mest kategorisk.
  const fellFixture = renderToStaticMarkup(
    createElement(SelectionReport, {
      selection: validateIntakeSelection(fixtureIntakeOverCountSelection()),
    }),
  ).match(/data-selection-status="true"[^>]*>([^<]+)</);
  assert.ok(fellFixture, "det fällda urvalets statusrad saknas");
  assert.ok(!/valda/i.test(fellFixture[1]), `fixturpanelen påstår ett val: "${fellFixture[1]}"`);
  assert.ok(fellFixture[1].includes("kandidater"), "det fällda fixturutfallet nämner inte kandidater");

  // Rösten byter ENDAST substantiv: domarna, antalen och orsakerna är oförändrade.
  assert.equal(
    (fixtureVoice.match(/data-rejection-code="/g) ?? []).length,
    (operatorVoice.match(/data-rejection-code="/g) ?? []).length,
    "rösterna ger olika många avslag",
  );
  assert.equal(
    attr(fixtureVoice, "data-accepted-count"),
    attr(operatorVoice, "data-accepted-count"),
    "rösterna ger olika många godkända",
  );

  // Panelen får inte bära en egen kopia av reglerna: enda vägen till en dom är lib/loop/intake.ts.
  const source = sourceOf("components/loop/IntakeValidationShowcase.tsx");
  assert.ok(
    /validateIntakeSelection/.test(source),
    "panelen använder inte den delade valideringen",
  );
  assert.ok(
    !/\.md\b|text\/markdown|1048576|1_048_576|too_many_files/.test(source),
    "panelen bär en parallell kopia av valideringsreglerna",
  );
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

test("V8*-I7: inklistrad text döms av SAMMA funktion som en fil — storleksgränsen gäller båda", () => {
  /*
    "Samma väg som en fil" måste gälla även GRÄNSERNA. En inklistrad källa som bara fick sitt
    bytetal utskrivet hade gjort de två vägarna oense om den enda regel skivan påstår sig hålla,
    och asymmetrin hade blivit skarp i samma stund som V8 live kopplar in transporten.
  */
  const source = sourceOf("components/loop/IntakeDropzone.tsx");
  assert.ok(
    /classifyIntakeCandidate\(\{[\s\S]*byte_size: stats\.bytes/.test(source),
    "den inklistrade texten körs inte genom den delade klassificeraren",
  );

  // Domen är densamma som för en fil av samma storlek — mätt på funktionen, inte på texten.
  const asPaste = classifyIntakeCandidate({
    file_name: pasteSourceName(1),
    byte_size: INTAKE_MAX_FILE_BYTES + 1,
    mime_type: "text/markdown",
  });
  const asFile = classifyIntakeCandidate({
    file_name: "stor.md",
    byte_size: INTAKE_MAX_FILE_BYTES + 1,
    mime_type: "text/markdown",
  });
  assert.equal(asPaste.accepted, false);
  assert.equal(asFile.accepted, false);
  if (!asPaste.accepted && !asFile.accepted) assert.equal(asPaste.code, asFile.code);

  // Gränsvärdet självt går igenom på båda vägarna.
  assert.equal(
    classifyIntakeCandidate({
      file_name: pasteSourceName(1),
      byte_size: INTAKE_MAX_FILE_BYTES,
      mime_type: "text/markdown",
    }).accepted,
    true,
  );

  // Tom inmatning är inget avslag: den har inte lämnats in, den finns bara inte ännu.
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes("Ingen text inklistrad ännu."));
  assert.ok(!html.includes("data-paste-rejection"), "tom textarea renderades som ett avslag");
  assert.ok(!html.includes('data-paste-accepted'), "tom textarea fick en dom");
});

/**
 * De EXAKT två ytor som får annonsera i intaken. Listan är provets facit och komponentens
 * kommentar refererar samma antal — glider de isär faller provet, inte läsaren.
 */
const LIVE_REGIONS = ["data-selection-status", "data-paste-verdict"] as const;

test("V8*-A11Y: urvalets utfall annonseras — och bara de ytor vars UTFALL faktiskt ändras", () => {
  const dropzone = renderToStaticMarkup(createElement(IntakeDropzone, {}));

  // Live-området finns INNAN det uppdateras — ett område som skapas samtidigt som sitt
  // innehåll annonseras inte pålitligt.
  assert.ok(
    /<p[^>]*data-selection-status="true"[^>]*role="status"[^>]*aria-live="polite"|<p[^>]*role="status"[^>]*aria-live="polite"[^>]*data-selection-status="true"/.test(
      dropzone,
    ),
    "urvalets status är inget artigt live-område",
  );
  assert.ok(dropzone.includes(INTAKE_NO_SELECTION_TEXT), "live-området saknar sitt tomma läge");

  // Statusen är KOMPAKT: den ska höras, inte läsas upp som tjugoen rader.
  const selection = validateIntakeSelection(fixtureIntakeCandidates());
  const report = renderToStaticMarkup(createElement(SelectionReport, { selection, live: true }));
  const status = report.match(/data-selection-status="true"[^>]*>([^<]+)</);
  assert.ok(status, "statusraden saknas när ett urval finns");
  assert.ok(
    status[1].includes(groupDigits(selection.accepted.length)),
    "antalet godkända annonseras inte",
  );
  assert.ok(status[1].includes("avvisade"), "antalet avvisade annonseras inte");

  /*
    A1 · MÅTTRADEN FÅR INTE ANNONSERA.

    Tecken, rader och byte ändras vid varje tangenttryck. Som live-område hade raden köat en
    uppläsning per tecken och dränkt både det användaren skriver och den dom som faktiskt
    betyder något. Måttet står synligt kvar — men utan role/aria-live.
  */
  const statsRow = dropzone.match(/<p[^>]*data-paste-stats="true"[^>]*>/);
  assert.ok(statsRow, "måttraden för inklistrad text saknas");
  assert.ok(!/aria-live/.test(statsRow[0]), "måttraden annonserar löpande statistik");
  assert.ok(!/role="status"/.test(statsRow[0]), "måttraden är ett statusområde");
  assert.ok(statsRow[0].includes('data-paste-live="false"'), "måttraden är inte märkt icke-live");

  // Det som annonseras på inklistringsvägen är DOMEN — den ändras bara när utfallet vänder.
  assert.ok(
    /<p[^>]*data-paste-verdict="true"[^>]*aria-live="polite"|<p[^>]*aria-live="polite"[^>]*data-paste-verdict="true"/.test(
      dropzone,
    ),
    "domen över inklistrad text är inget artigt live-område",
  );

  /*
    A1 · DEN ANNONSERADE TEXTEN ÄR STORLEKSOBEROENDE.

    Orsakstexten KAN bära kandidatens exakta bytetal. I ett live-område är den formen ett löpande
    mått förklätt till dom: varje tangenttryck i en text som redan passerat gränsen ändrar
    siffran, och ett artigt live-område köar en uppläsning per tecken — samma defekt som
    måttraden gjordes icke-live för att slippa, bara flyttad. Invarianten mäts därför, den
    beskrivs inte i prosa: två OLIKA storlekar över gränsen måste ge EXAKT samma annonserade text.
  */
  const paste = (byteSize: number) =>
    classifyIntakeCandidate({
      file_name: pasteSourceName(1),
      byte_size: byteSize,
      mime_type: "text/markdown",
    });
  const justOver = pasteVerdictText(paste(INTAKE_MAX_FILE_BYTES + 1));
  const farOver = pasteVerdictText(paste(INTAKE_MAX_FILE_BYTES + 5_000));
  assert.equal(justOver, farOver, "den annonserade domen ändras med storleken — ett löpande mått");
  assert.ok(justOver.length > 0, "ett fällt utfall annonserar ingenting alls");
  for (const size of [INTAKE_MAX_FILE_BYTES + 1, INTAKE_MAX_FILE_BYTES + 5_000]) {
    assert.ok(
      !justOver.includes(groupDigits(size)),
      `den annonserade domen bär kandidatens bytetal (${groupDigits(size)})`,
    );
  }
  // Samma sak på den gröna sidan: en godkänd text som växer annonserar inte om sig själv.
  assert.equal(pasteVerdictText(paste(10)), pasteVerdictText(paste(999)));
  // Och tomt är ingen dom alls.
  assert.equal(pasteVerdictText(null), "");

  /*
    Det exakta bytetalet ska inte försvinna — det flyttas till den ICKE-live måttraden, där det
    kan läsas utan att annonseras.
  */
  const dropzoneSource = sourceOf("components/loop/IntakeDropzone.tsx");
  assert.match(
    dropzoneSource,
    /id=\{IDS\.pasteStats\}[\s\S]*?sourceStatsText\(stats\)/,
    "måttraden bär inte längre det exakta bytetalet",
  );
  assert.match(
    dropzoneSource,
    /id=\{IDS\.pasteVerdict\}[\s\S]*?\{pasteVerdictText\(pasteVerdict\)\}/,
    "live-området renderar inte den storleksoberoende domen",
  );
  assert.ok(
    !/pasteVerdict\.message/.test(dropzoneSource),
    "live-området renderar orsakstexten med kandidatens storlek inbakad",
  );

  /*
    E2 · Räkningen och meddelandet mäter samma sak: exakt LIVE_REGIONS ytor annonserar, och
    fixturpanelens statiska kopia av samma rapport är inte en av dem.
  */
  const shell = renderShell();
  assert.equal(
    (shell.match(/aria-live="polite"/g) ?? []).length,
    LIVE_REGIONS.length,
    `fel antal live-områden: exakt ${LIVE_REGIONS.length} ska annonsera (${LIVE_REGIONS.join(", ")})`,
  );
  for (const region of LIVE_REGIONS) {
    assert.ok(
      new RegExp(`<p[^>]*${region}="true"[^>]*aria-live|<p[^>]*aria-live[^>]*${region}="true"`).test(
        shell,
      ),
      `${region} annonserar inte`,
    );
  }
  // Fixturpanelen renderar SAMMA komponent utan live — annars hade en statisk kopia talat.
  assert.ok(
    shell.includes('data-validation-showcase="true"'),
    "fixturpanelen saknas — räkningen ovan mäter då inte att den tiger",
  );
});

test("V8*-A11Y: beskrivningskedjorna är korta och sammanhängande — högst två noder per kontroll", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));

  /*
    A2 · Fem separata beskrivningsnoder läses upp som ett enda andlöst stycke varje gång
    kontrollen får fokus, och det som gällde just då drunknar. Kedjan hålls därför vid högst två
    noder — mätt på den FAKTISKA markupen, inte bara på konstanten.
  */
  const chains = [...(html.match(/aria-describedby="([^"]+)"/g) ?? [])].map((match) =>
    match.replace(/^aria-describedby="/, "").replace(/"$/, "").split(/\s+/),
  );
  assert.ok(chains.length >= 3, "för få beskrivningskedjor hittades — provet mäter ingenting");
  for (const chain of chains) {
    assert.ok(
      chain.length <= INTAKE_MAX_DESCRIBED_BY_NODES,
      `en beskrivningskedja har ${chain.length} noder: ${chain.join(" ")}`,
    );
  }

  // Kedjorna i markupen är exakt de deklarerade — ingen tredje sanning i JSX:en.
  const textarea = html.match(/<textarea[^>]*>/);
  assert.ok(textarea, "textarean saknas");
  assert.equal(attr(textarea[0], "aria-describedby"), INTAKE_DESCRIBED_BY.pasteArea.join(" "));
  const picker = html.match(/<input[^>]*type="file"[^>]*>/);
  assert.ok(picker, "filkontrollen saknas");
  assert.equal(attr(picker[0], "aria-describedby"), INTAKE_DESCRIBED_BY.filePicker.join(" "));

  /*
    Domen är INTE en beskrivningsnod: den annonserar sig själv som live-område, och en text som
    både beskriver och annonserar hörs dubbelt.
  */
  for (const chain of chains) {
    assert.ok(
      !chain.includes(INTAKE_DOM_IDS.pasteVerdict),
      "domen är både live-område och beskrivning — den hörs då två gånger",
    );
  }

  /*
    ETT mönster för blockeringen: `aria-disabled` + `aria-describedby`, aldrig nativt `disabled`
    tillsammans med en beskrivning (flera skärmläsarpar hoppar över eller tömmer den).
  */
  const button = html.match(/<button[^>]*>/);
  assert.ok(button, "knappen saknas");
  assert.equal(attr(button[0], "aria-disabled"), "true");
  assert.ok(
    !/<button[^>]*\sdisabled(?:=|[\s>])/.test(html),
    "knappen kombinerar nativt disabled med aria-describedby",
  );
  assert.deepEqual(attr(button[0], "aria-describedby")?.split(/\s+/), [
    ...INTAKE_DESCRIBED_BY.submit,
  ]);
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
  assert.ok(decodeEntities(html).includes(sourceStatsText(stats)), "måttraden saknas i utfallet");
  assert.ok(html.includes(`${groupDigits(stats.characters)} tecken`));
  assert.ok(html.includes(`${groupDigits(stats.lines)} rader`));
});

test("V8*-C5: tecken, rader OCH byte grupperas med SAMMA regel — en formatering, två ytor", () => {
  /*
    Tre tal på samma rad där bara ett är grupperat läser som tre olika sorters mått, och läsaren
    får lägga energi på att avgöra om skillnaden betyder något. Formateringen bärs därför på ETT
    ställe (lib/loop/intake.ts) och delas av utfallets rad och dropzonens rad.
  */
  const stats = { characters: 12_345, lines: 6_789, bytes: 1_234_567 };
  assert.equal(
    sourceStatsText(stats),
    `${groupDigits(12_345)} tecken · ${groupDigits(6_789)} rader · ${groupDigits(1_234_567)} byte`,
  );
  // Grupperingen är hårda mellanslag — aldrig toLocaleString, som beror på värdens ICU-data.
  assert.ok(sourceStatsText(stats).includes(" "), "stora tal grupperas inte");
  assert.equal(sourceStatsText({ characters: 7, lines: 1, bytes: 7 }), "7 tecken · 1 rader · 7 byte");

  // Båda ytorna använder den delade formateringen — ingen egen sammansättning kvar.
  for (const file of ["components/loop/IntakeResult.tsx", "components/loop/IntakeDropzone.tsx"]) {
    const source = sourceOf(file);
    assert.ok(source.includes("sourceStatsText"), `${file} formaterar måttraden på egen hand`);
    assert.ok(
      !/stats\.characters\}? tecken/.test(source),
      `${file} skriver ut ett ogrupperat teckenantal`,
    );
  }
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
});

test("V8*-SPRAK: filväljaren visar SVENSK knapptext — värdens egen krom är dold, inte borttagen", () => {
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));

  // Kontrollen finns kvar i DOM:en, med id och etikett — bara visuellt dold.
  assert.ok(/<input[^>]*id="intake-filvaljare"[^>]*type="file"/.test(html), "filkontrollen togs bort");
  assert.ok(/<input[^>]*class="mk-sr-only"/.test(html), "kontrollen döljs inte visuellt");
  assert.ok(
    /<label[^>]*class="mk-file-label"[^>]*for="intake-filvaljare"[^>]*>Välj Markdown-filer<\/label>/.test(
      html,
    ),
    "etiketten är inte den synliga knappen",
  );

  // Den dolda kontrollen måste stå FÖRE etiketten: syskonregeln som målar fokusringen kräver det.
  assert.ok(
    html.indexOf('id="intake-filvaljare"') < html.indexOf('class="mk-file-label"'),
    "ordningen input → label är bruten, så fokusringen kan inte målas på etiketten",
  );

  // display:none hade tagit kontrollen ur tabbordningen — den får aldrig användas här.
  assert.match(LOOP_CSS, /\.mk-sr-only\s*\{[^}]*position:\s*absolute/);
  assert.ok(
    !/\.mk-sr-only\s*\{[^}]*display:\s*none/.test(LOOP_CSS),
    "den dolda kontrollen är borttagen ur tabbordningen",
  );
  // Fokus måste synas trots att kontrollen inte gör det.
  assert.match(
    LOOP_CSS,
    /\.mk-sr-only:focus-visible \+ \.mk-file-label\s*\{[^}]*box-shadow:\s*var\(--focus-ring\)/,
    "tangentbordsfokus syns inte när filkontrollen är dold",
  );
  assert.match(LOOP_CSS, /\.mk-file-label\s*\{[^}]*background:\s*var\(--bg-surface-2\)/);
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

/* ── 13 · Interaktionen, tomlägena och de synliga påståendena ─────────────── */

test("V8*-B2/B3: en händelse med NOLL filer ger ett ÄRLIGT tomläge — aldrig ett rapportskal", () => {
  /*
    Två vanliga händelser bär noll filer: ett släpp som var markerad text, en länk eller en mapp,
    och en `change` från en avbruten fildialog. Ingen av dem är ett urval, och ingen av dem får
    rita rapportens skal: ett tomt skal i positiv ton läser som "urvalet gick igenom".
  */
  for (const [event, text] of [
    ["drop", INTAKE_EMPTY_DROP_TEXT],
    ["pick", INTAKE_EMPTY_PICK_TEXT],
  ] as const) {
    const html = decodeEntities(
      renderToStaticMarkup(
        createElement(SelectionReport, { selection: null, live: true, emptyEvent: event }),
      ),
    );
    assert.ok(html.includes('data-selection="empty"'), `${event} renderade ett urval`);
    assert.ok(html.includes(`data-selection-empty-event="${event}"`), `${event} är inte utmärkt`);
    assert.ok(html.includes(text), `${event} saknar sin ärliga förklaring`);

    // Inget skal: inga rader, ingen banner, ingen sammanfattning, ingen positiv ton.
    assert.ok(!html.includes("data-selection-rows"), `${event} renderade radlistan`);
    assert.ok(!html.includes("data-accepted-count"), `${event} renderade en sammanfattning`);
    assert.ok(!html.includes("data-file-name"), `${event} renderade en filrad`);
    assert.ok(!/mk-tone-success|Formellt godkänd/.test(html), `${event} fick en positiv ton`);
  }

  // Grundläget (inget har hänt ännu) skiljs från de två händelserna.
  assert.equal(emptyEventText(null), INTAKE_NO_SELECTION_TEXT);
  assert.equal(emptyEventText("drop"), INTAKE_EMPTY_DROP_TEXT);
  assert.equal(emptyEventText("pick"), INTAKE_EMPTY_PICK_TEXT);
  assert.ok(
    !/lyckades|klart|mottagen|inlämnad/i.test(INTAKE_EMPTY_DROP_TEXT + INTAKE_EMPTY_PICK_TEXT),
    "tomläget antydde att något togs emot",
  );

  /*
    Och vägen dit går genom EN spärr: klassificeraren släpper aldrig igenom en tom lista till
    validateIntakeSelection, oavsett om den kom från ett släpp eller från filkontrollen.
  */
  const source = sourceOf("components/loop/IntakeDropzone.tsx");
  assert.match(
    source,
    /if \(files\.length === 0\) \{\s*setSelection\(null\);/,
    "en händelse med noll filer går rakt in i valideringen",
  );
  assert.match(source, /classify\(Array\.from\(event\.dataTransfer\.files\), "drop"\)/);
  assert.match(source, /classify\(Array\.from\(event\.target\.files \?\? \[\]\), "pick"\)/);
});

test("V8*-B1: filkontrollens värde nollställs efter varje val — samma fil kan väljas igen", () => {
  /*
    Utan nollställning skickar webbläsaren INGEN `change` när samma fil väljs en andra gång:
    värdet är oförändrat. Ytan hade då stått kvar med gammal dom trots att operatören precis
    gjorde ett val — det mest förvirrande av alla utfall, eftersom ingenting alls händer.
  */
  const source = sourceOf("components/loop/IntakeDropzone.tsx");
  assert.match(
    source,
    /if \(filePicker\.current !== null\) filePicker\.current\.value = "";/,
    "filkontrollens värde nollställs inte efter ett val",
  );
  // Nollställningen sker EFTER att domen tagits — annars hade urvalet försvunnit med värdet.
  const classifyAt = source.indexOf('classify(Array.from(event.target.files ?? []), "pick")');
  const resetAt = source.indexOf('filePicker.current.value = ""');
  assert.ok(classifyAt > 0 && resetAt > classifyAt, "värdet nollställs innan domen tagits");

  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(/<input[^>]*type="file"/.test(html), "filkontrollen saknas");
});

test("V8*-B4: dragmarkeringen flimrar inte över inre element — räknaren är symmetrisk", () => {
  /*
    `dragleave` utlöses ÄVEN när pekaren går in i ett BARN i zonen (titeln, hinten, etiketten).
    Räknaren gör lämnandet symmetriskt, och förloppet kan därför BEVISAS i stället för att provas
    för hand: in i zonen → in i ett barn → ut ur barnet ska INTE släcka markeringen.
  */
  let depth = 0;
  depth = dragDepthAfter(depth, "enter"); // in över zonen
  assert.equal(isDragActive(depth), true, "markeringen tändes inte");
  depth = dragDepthAfter(depth, "enter"); // barnets dragenter
  depth = dragDepthAfter(depth, "leave"); // zonens dragleave för samma rörelse
  assert.equal(isDragActive(depth), true, "markeringen slocknade mitt inne i zonen (flimmer)");
  depth = dragDepthAfter(depth, "leave"); // ut ur zonen på riktigt
  assert.equal(isDragActive(depth), false, "markeringen släcktes inte när zonen lämnades");

  // Ett släpp nollställer alltid: inget dragleave följer på ett drop.
  assert.equal(dragDepthAfter(3, "drop"), 0);
  assert.equal(isDragActive(dragDepthAfter(3, "drop")), false);
  // Räknaren går aldrig under noll — ett oparat dragleave får inte skulda kommande dragenter.
  assert.equal(dragDepthAfter(0, "leave"), 0);
  assert.equal(isDragActive(0), false);

  /*
    `dragover` upprepas några gånger per sekund så länge pekaren rör sig över zonen. Den måste
    avbrytas för att ett släpp ska vara möjligt, men får inte skriva markeringens tillstånd —
    då hade räknaren varit meningslös.
  */
  const source = sourceOf("components/loop/IntakeDropzone.tsx");
  const dragOverHandler = source.match(/onDragOver=\{\(event\) => \{[\s\S]*?\}\}/);
  assert.ok(dragOverHandler, "onDragOver saknas");
  assert.ok(
    !/setDragDepth|setSelection/.test(dragOverHandler[0]),
    "onDragOver skriver tillstånd och gör räknaren meningslös",
  );
  assert.match(dragOverHandler[0], /event\.preventDefault\(\)/, "släpp är inte tillåtet i zonen");

  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  assert.ok(html.includes('data-drag-over="false"'), "vilan är inte markerad som fri från drag");
  assert.ok(html.includes('data-drag-depth="0"'), "räknaren syns inte maskinläsbart");
});

test("V8*-B5: den inklistrade källan får en FORMELL dom — tom, godkänd och över gränsen", () => {
  /*
    Samma funktion som filvägen (bevisat i I7-provet ovan) — här mäts att domen också NÅR ytan:
    ett eget område, med maskinläsbar utfallsmarkering, som annonserar när utfallet vänder.
  */
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const verdict = html.match(/<p[^>]*data-paste-verdict="true"[^>]*>([\s\S]*?)<\/p>/);
  assert.ok(verdict, "domen över inklistrad text saknar område");
  assert.equal(verdict[1], "", "tom inmatning fick en dom — den finns bara inte ännu");
  assert.ok(!/data-paste-accepted/.test(verdict[0]), "tom inmatning märktes som dömd");

  // Gränsvärdena själva: tomt är ingen dom, exakt gränsen går igenom, ett byte över fälls.
  const paste = (byteSize: number) =>
    classifyIntakeCandidate({
      file_name: pasteSourceName(1),
      byte_size: byteSize,
      mime_type: "text/markdown",
    });
  const empty = paste(0);
  assert.equal(empty.accepted, false, "en tom källa är inte formellt godkänd");
  if (!empty.accepted) assert.equal(empty.code, "empty");
  assert.equal(paste(INTAKE_MAX_FILE_BYTES).accepted, true);
  assert.equal(paste(INTAKE_MAX_FILE_BYTES + 1).accepted, false);

  // Domen hämtas ur den delade klassificeraren — ingen egen storleksregel i komponenten.
  const source = sourceOf("components/loop/IntakeDropzone.tsx");
  assert.ok(!/1048576|1_048_576/.test(source), "komponenten bär en egen kopia av storleksgränsen");
});

test("V8*-A3: fixturpanelens programmatiska namn är SAMMA text som dess synliga rubrik", () => {
  /*
    Två formuleringar av samma rubrik ger seende och lyssnande läsare olika landmärken: den som
    hör "kandidatfiler" hittar aldrig den rubrik någon annan läser upp för dem.
  */
  const html = renderShell();
  const section = html.match(/<section[^>]*data-validation-showcase="true"[^>]*>/);
  assert.ok(section, "valideringspanelen saknas");
  assert.equal(decodeEntities(attr(section[0], "aria-label") ?? ""), VALIDATION_SHOWCASE_TITLE);
  assert.ok(
    decodeEntities(html).includes(`<span>${VALIDATION_SHOWCASE_TITLE}</span>`),
    "den synliga rubriken bär inte samma text som sektionens namn",
  );

  // Samma regel för dropzonens panel: namnet och rubriken kommer ur EN konstant.
  const dropzone = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const panel = dropzone.match(/<section[^>]*data-intake-dropzone="true"[^>]*>/);
  assert.ok(panel, "dropzonens panel saknas");
  assert.equal(decodeEntities(attr(panel[0], "aria-label") ?? ""), INTAKE_PANEL_TITLE);
  assert.ok(decodeEntities(dropzone).includes(`<span>${INTAKE_PANEL_TITLE}</span>`));
});

test("V8*-C4: sidans rubrik står EN gång — hierarkin h1 → h2 behålls, dubbletten är borta", () => {
  const html = decodeEntities(renderPage());

  // Sidans egen titel finns kvar som h1 — det är sidans namn.
  assert.ok(/<h1[^>]*>Mata maskinen<\/h1>/.test(html), "sidans h1 saknas");
  // Och den upprepas inte som en andra rubrik med identisk text.
  assert.equal(
    (html.match(/>Mata maskinen</g) ?? []).length,
    1,
    "rubriken 'Mata maskinen' står mer än en gång",
  );

  // Panelen har fortfarande en h2 — nivån under sidans rubrik, med ett eget namn.
  assert.ok(html.includes(`<span>${INTAKE_PANEL_TITLE}</span>`), "panelens egen rubrik saknas");
  assert.notEqual(INTAKE_PANEL_TITLE, "Mata maskinen");
  assert.ok(/<h2[^>]*class="mk-panel-title"/.test(html), "panelrubriken är inte längre en h2");
  // Sidan har exakt en toppnivårubrik.
  assert.equal((html.match(/<h1/g) ?? []).length, 1, "sidan har fler än en h1");
});

test("V8*-C2: riktningstexterna pekar åt det håll innehållet FAKTISKT står", () => {
  /*
    "Nedan" är ett påstående om renderingsordningen. IntakeResult ritar originalkällan FÖRE
    tolkningsgruppen, så NEEDS_SPEC-arbetsläget måste peka uppåt — annars skickas läsaren till
    slutet av panelen efter något som stod högst upp.
  */
  const html = renderResult(outcomeById(NEEDS_SPEC));
  const sourceAt = html.indexOf('data-source-raw="true"');
  const actionAt = html.indexOf('data-needs-spec-action="true"');
  assert.ok(sourceAt > 0 && actionAt > 0, "källan eller arbetsläget saknas");
  assert.ok(sourceAt < actionAt, "källan renderas inte före arbetsläget — riktningen kan inte prövas");
  assert.ok(NEEDS_SPEC_ACTION_HINT.includes("ovanför"), "hinten pekar inte uppåt mot källan");
  assert.ok(!/nedan/.test(NEEDS_SPEC_ACTION_HINT), "hinten pekar fortfarande nedåt");

  // Och "uppgifterna nedan" är sant: korten renderas EFTER sin mening.
  const answered = renderResult(outcomeById(ANSWERED));
  assert.ok(
    answered.indexOf("Uppgifterna nedan") < answered.indexOf("<article"),
    "texten lovar uppgifter nedanför men korten står ovanför",
  );

  /*
    SVEPET: ingen mening i intakens filer får peka NEDÅT mot källan — varken i UI-text eller i en
    kommentar. Rond 3:s fynd satt just i ett filhuvud, långt från den text som redan rättats.
  */
  for (const file of INTAKE_FILES) {
    for (const sentence of rawSourceOf(file).split(/[.\n]/)) {
      if (!/källa/i.test(sentence)) continue;
      assert.ok(
        !/\bnedan(för)?\b/i.test(sentence),
        `${file} påstår att källan står nedanför: "${sentence.trim()}"`,
      );
    }
  }
});

test("V8*-A4: den visuellt dolda filkontrollen har en POSITIONERAD förälder", () => {
  /*
    .mk-sr-only positioneras absolut. Utan en positionerad förälder räknas positionen mot
    VIEWPORTEN — kontrollen hamnar då i sidans hörn i stället för i sin egen zon. Osynligt, men
    fel plats för fokus och för varje senare regel som utgår från att kontrollen ligger i zonen.
  */
  assert.match(LOOP_CSS, /\.mk-sr-only\s*\{[^}]*position:\s*absolute/);
  const drop = LOOP_CSS.match(/\.mk-drop \{[^}]*\}/);
  assert.ok(drop, ".mk-drop saknar regel");
  assert.match(drop[0], /position:\s*relative/, "dropzonen är inte en positionerad förälder");

  // Och kontrollen ligger faktiskt INUTI den zonen i markupen.
  const html = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const zone = html.match(/<div[^>]*data-drop-target="true"[^>]*>[\s\S]*?<\/div>/);
  assert.ok(zone, "dropzonen saknas");
  assert.ok(zone[0].includes('class="mk-sr-only"'), "den dolda kontrollen ligger utanför zonen");
});

test("V8*-D1: dropzonen ser droppbar ut i VILA — och aktivläget är fortfarande skilt från den", () => {
  const drop = LOOP_CSS.match(/\.mk-drop \{[^}]*\}/);
  assert.ok(drop, ".mk-drop saknar regel");
  assert.match(drop[0], /border:\s*1px dashed/, "zonen saknar droppbar affordans i vila");

  const over = LOOP_CSS.match(/\.mk-drop-over \{[^}]*\}/);
  assert.ok(over, ".mk-drop-over saknar regel");
  assert.match(over[0], /background:\s*var\(--tint-accent-bg\)/, "aktivläget tappade sin tint");
  assert.match(over[0], /border-style:\s*solid/, "aktivläget skiljer sig inte från vilan i kanten");
  assert.match(over[0], /var\(--tint-accent-border\)/, "aktivläget tappade sin accentkant");

  // Ingen ny färg införs: affordansen använder husets befintliga token.
  assert.match(drop[0], /var\(--border-strong\)/, "zonen införde en färg utanför tokensystemet");
});

test("V8*-D2: den täta listan står i tre spalter redan vid surfplattans bredd", () => {
  /*
    Rond 8: brytpunkten låg på 960px medan granskningens surfplatteläge är 900px — exakt den vy
    där tjugoen orsakslösa kort skulle komprimeras stackades de i EN spalt.
  */
  const media = LOOP_CSS.match(/@media \(min-width: (\d+)px\) \{\s*\.mk-list-dense \{([^}]*)\}/);
  assert.ok(media, "den täta listan saknar sin flerspaltsregel");
  const breakpoint = Number(media[1]);
  assert.ok(
    breakpoint <= 900,
    `tregriden börjar först vid ${breakpoint}px och gäller därför inte vid 900px`,
  );
  assert.match(media[2], /grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/);

  /*
    E1 · Och stilarkets EGEN invariant står kvar sann: "Brytpunkterna är planens (1280 / 960 /
    720) och app/globals.css egna — inga nya." En rättning som smyger in en fjärde pinne gör
    filens första kommentar osann för varje senare läsare, vilket är exakt den defektklass E1
    handlar om. Stegen mäts därför mot stegen — inte mot en läsares minne.
  */
  const LADDER = new Set([600, 719, 720, 959, 960, 1279, 1280]);
  const breakpoints = [...LOOP_CSS.matchAll(/@media \((?:min|max)-width: (\d+)px\)/g)].map(
    (match) => Number(match[1]),
  );
  assert.ok(breakpoints.length > 0, "inga brytpunkter hittades — provet mäter ingenting");
  for (const value of breakpoints) {
    assert.ok(
      LADDER.has(value),
      `${value}px är en NY brytpunkt — stilarkets invariant säger "inga nya"`,
    );
  }
});

test("V8*-E1: kommentaren om live-områden stämmer med hur många som faktiskt finns", () => {
  /*
    Rond 5: en kommentar som säger "enda live-området" när det finns två är lika vilseledande som
    en osann etikett i UI:t — nästa läsare tror att ingen annan yta annonserar.
  */
  const raw = rawSourceOf("components/loop/IntakeDropzone.tsx");
  const dropzone = renderToStaticMarkup(createElement(IntakeDropzone, {}));
  const actual = (dropzone.match(/aria-live="polite"/g) ?? []).length;
  assert.equal(actual, LIVE_REGIONS.length, "antalet live-områden ändrades utan att facit gjorde det");
  assert.ok(
    !/[Ee]nda live-området/.test(raw),
    `kommentaren påstår ETT live-område medan komponenten har ${actual}`,
  );
  assert.ok(
    raw.includes("TVÅ live-områden"),
    "kommentaren namnger inte det faktiska antalet live-områden",
  );
});

test("V8*-F1: CTA:n till /loop/mata navigerar med next/link — ingen full omladdning", () => {
  /*
    En rå <a> river hela kontrollrummet och kostar operatören en kall start för att öppna en
    INTERN route. next/link gör samma navigering på appens villkor och renderar fortfarande ett
    vanligt <a href> — samma URL, samma beteende för mitten-klick och för skärmläsare.

    NOT: komponentens RENDERING hör hemma på /loop, som är systertaskets fotoyta. Här prövas den
    mekaniskt — den här skivan gör inget visuellt påstående om /loop.
  */
  const source = sourceOf("components/loop/BacklogColumn.tsx");
  assert.match(source, /import Link from "next\/link"/, "CTA:n importerar inte next/link");
  assert.match(source, /<Link className="mk-link" href="\/loop\/mata"/, "CTA:n använder inte Link");
  assert.ok(!/<a\s[^>]*href="\/loop\/mata"/.test(source), "en rå <a> till intake-routen finns kvar");

  // Och den renderade markupen är fortfarande en riktig länk med rätt mål.
  const html = renderToStaticMarkup(createElement(BacklogColumn, { tasks: [] }));
  assert.match(html, /<a[^>]*href="\/loop\/mata"[^>]*>/, "CTA:n renderar ingen länk");
  assert.ok(html.includes('data-intake-cta="true"'), "CTA:ns märkning försvann");
  assert.ok(html.includes("Mata maskinen"), "CTA:ns text försvann");
});
