/**
 * SHREDDER-01B · SHOWROOMETS SYNLIGHET — negativa kontroller.
 *
 * KÄLLA: ägarbeslutet i docs/nortropic-factory-room-roadmap-erratum-01.md
 * (SHOWROOM_BEFORE_BACKEND_COMPLETE=YES · HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO ·
 * FIXTURE_DATA_MUST_BE_EXPLICITLY_LABELLED=YES) med §owner-8 (prosadiet), §owner-11
 * (showroom-scenarier) och §owner-12 (mobilt) ovanpå SHREDDER-01A:s lägeskontrakt.
 *
 * VAD PROVET ÄGER — OCH DÄRFÖR MÅSTE KUNNA FÄLLA
 * ----------------------------------------------
 *   A · Sidomenyns post till Kartongförstöraren: den finns, pekar på /loop, står mellan
 *       "Ny kund" och "Översikt", och är tänd även på /loop/**.
 *   B · Startsidans produktingång: rubriken, raden och knappen finns — OCH den gamla översikten
 *       (ProcessGuide, PipelinePanel, MetricsPanel) står kvar och renderas.
 *   C · Scenariovalet: sluten lista, förvalet vid varje ogiltigt värde, rubriken «Showroom-
 *       scenario» i klartext, och bara GENERERADE fixturer bakom valet.
 *   D · Ingen scenarioyta hämtar något: inga nätverksvägar i de filer skivan rör.
 *   E · Ingen brytpunkt döljer navigeringsposten — mätt på app/globals.css egna media-block.
 *   F · Kompositören pekar fortfarande på /loop/mata, och de två arbetsspåren renderas med sina
 *       etiketter, utan kommandoväg och med showroom-märkning.
 *   G · Skivans egna filer bär varken procent, rörelse, loggning eller framstegselement.
 *
 * VAD PROVET INTE PÅSTÅR: ingenting här är ett bevis för live-data. Rummet är showroom, kanalen
 * är stängd och fixturen är simulerad — det mäts av tests/loop/showroom-contract.test.ts, och
 * den här filen ändrar inte en rad av det.
 *
 * HARNESS-NOT: samma som V2/ROOM-01 — tsconfig har `jsx: "preserve"`, så komponenter som inte
 * importerar React själva behöver en global React när de renderas utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import MaskinenPage from "../../app/(app)/loop/page";
import CommandDeck from "../../components/loop/CommandDeck";
import MaskinShell from "../../components/loop/MaskinShell";
import {
  COMMAND_QUEUE_BLOCKED_ON,
  COMMAND_QUEUE_DISABLED_REASON,
} from "../../lib/loop/commands";
import ScenarioPicker from "../../components/loop/room/ScenarioPicker";
import WorkComposer, {
  COMPOSER_AFFORDANCES,
  COMPOSER_INTENT_QUESTION,
  COMPOSER_LANES,
  COMPOSER_PREVIEW_NOTE,
} from "../../components/loop/room/WorkComposer";
import { fixtureEmptySnapshot, fixtureSnapshot } from "../../lib/loop/fixtures";
import { MISSING } from "../../lib/loop/labels";
import { SHOWROOM } from "../../lib/loop/room/mode";
import {
  DEFAULT_SCENARIO,
  SCENARIO_ANCHOR_ID,
  SCENARIO_PARAM,
  SCENARIO_PICKER_LABEL,
  SCENARIO_POINTER_LABEL,
  SCENARIO_PICKER_NOTE,
  SCENARIO_TIMELINE_SCOPE_NOTE,
  SHOWROOM_SCENARIOS,
  SHOWROOM_SCENARIO_IDS,
  isScenarioId,
  resolveScenario,
  scenarioById,
  scenarioHref,
  scenarioSnapshot,
  type ShowroomScenarioId,
} from "../../lib/loop/room/scenarios";
import type { LoopSnapshot } from "../../lib/loop/schema";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

const SIDEBAR_PATH = "components/Sidebar.tsx";
const HOME_PATH = "app/(app)/page.tsx";
const LOOP_ROUTE_PATH = "app/(app)/loop/page.tsx";
const COMMAND_DECK_PATH = "components/loop/CommandDeck.tsx";
const COMMAND_BUTTON_PATH = "components/loop/CommandButton.tsx";
const GLOBALS_PATH = "app/globals.css";

/** Skivans ändrade ytor som ligger UTANFÖR de rekursiva trädet. Räknas upp vid namn. */
const NAMED_SURFACES = [
  SIDEBAR_PATH,
  HOME_PATH,
  LOOP_ROUTE_PATH,
  COMMAND_DECK_PATH,
  COMMAND_BUTTON_PATH,
] as const;

function read(relative: string): string {
  return readFileSync(join(REPO_ROOT, relative), "utf8");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

function tagsWith(html: string, attribute: string): string[] {
  return html.match(new RegExp(`<[A-Za-z][^>]*${attribute}[^>]*>`, "g")) ?? [];
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/**
 * SKIVANS EGNA FILER — de som mätarna nedan gäller.
 *
 * Rummets träd läses REKURSIVT (samma räckvidd som ROOM-01/ROOM-08 använder) så att en fil som
 * läggs till senare inte tyst slipper undan, och de ytor som ligger UTANFÖR det trädet räknas upp
 * vid namn: sidomenyn, startsidan, routen och V7:s två kommandofiler. Alla fem ändras av den här
 * skivan, och ingen befintlig rekursiv mätare når de tre första.
 */
function sliceFiles(): { path: string; source: string }[] {
  const trees = ["components/loop/room", "lib/loop/room"];
  const fromTrees = trees.flatMap((dir) =>
    readdirSync(join(REPO_ROOT, dir), { recursive: true, encoding: "utf8" })
      .map((name) => join(dir, name))
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .map((path) => ({ path, source: read(path) })),
  );
  const named = NAMED_SURFACES.map((path) => ({ path, source: read(path) }));
  return [...fromTrees, ...named];
}

/* ── En liten CSS-läsare för globals.css media-block ──────────────────────────
   Samma form som rummets egen mätare: media-blocken måste kunna genomskådas, annars går det
   inte att säga något om vad som gäller VID EN VISS BREDD. Läsaren bär sin egen negativa
   kontroll i provet nedan. */

type CssRule = { selector: string; body: string; media: string | null };

function parseRules(css: string): CssRule[] {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, " ");
  const rules: CssRule[] = [];
  let cursor = 0;
  let media: string | null = null;

  while (cursor < source.length) {
    const open = source.indexOf("{", cursor);
    if (open === -1) break;
    const prelude = source.slice(cursor, open).replace(/\s+/g, " ").trim();

    if (prelude.startsWith("@media")) {
      media = prelude;
      cursor = open + 1;
      continue;
    }

    const close = source.indexOf("}", open);
    if (close === -1) break;
    const body = source.slice(open + 1, close).replace(/\s+/g, " ").trim();
    for (const selector of prelude.split(",")) {
      const trimmed = selector.replace(/\s+/g, " ").trim();
      if (trimmed !== "") rules.push({ selector: trimmed, body, media });
    }
    cursor = close + 1;

    const closing = source.slice(cursor).match(/^\s*\}/);
    if (media !== null && closing) {
      media = null;
      cursor += closing[0].length;
    }
  }
  return rules;
}

function declaredValue(body: string, property: string): string | null {
  const found = body
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => ({
      property: part.slice(0, part.indexOf(":")).trim().toLowerCase(),
      value: part.slice(part.indexOf(":") + 1).trim(),
    }))
    .filter((one) => one.property === property);
  return found.length === 0 ? null : found[found.length - 1].value;
}

/** De sätt en navigeringspost kan försvinna på utan att raden syns i markupen. */
const HIDING: { property: string; value: RegExp }[] = [
  { property: "display", value: /^none$/ },
  { property: "visibility", value: /^hidden$/ },
  { property: "content-visibility", value: /^hidden$/ },
  { property: "opacity", value: /^0(\.0+)?$/ },
  { property: "max-height", value: /^0(px)?$/ },
  { property: "height", value: /^0(px)?$/ },
  { property: "font-size", value: /^0(px)?$/ },
];

function hidingRules(css: string): CssRule[] {
  return parseRules(css).filter((rule) =>
    HIDING.some((hide) => {
      const value = declaredValue(rule.body, hide.property);
      return value !== null && hide.value.test(value);
    }),
  );
}

/** Renderar routen och plockar ut MaskinShell:s props — samma väg V2 mäter routen på. */
function shellPropsFor(searchParams?: Record<string, string | string[] | undefined>): {
  snapshot: LoopSnapshot | null;
} {
  /*
    Routen tar emot BÅDA formerna med flit (utlovad respektive redan uppslagen), eftersom det är
    ramverkets sak vilken som skickas in. Provet mäter den uppslagna: den går att köra utan en
    renderare som kan vänta, och det är exakt samma upplösning som den utlovade landar i.
  */
  const page = (
    searchParams === undefined
      ? MaskinenPage()
      : MaskinenPage({
          searchParams: searchParams as unknown as Promise<
            Record<string, string | string[] | undefined>
          >,
        })
  ) as ReactElement;
  const children = React.Children.toArray(
    (page.props as { children: React.ReactNode }).children,
  ) as ReactElement[];
  const shell = children.find((child) => child.type === MaskinShell);
  assert.ok(shell, "routen renderar inte MaskinShell");
  return shell.props as { snapshot: LoopSnapshot | null };
}

/* ────────────────────────────────────────────────────────────────────────────
 * A · SIDOMENYN — PRODUKTEN GÅR ATT HITTA
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-A: sidomenyn bär Kartongförstöraren, mellan «Ny kund» och «Översikt»", () => {
  const source = stripComments(read(SIDEBAR_PATH));

  assert.match(source, /href="\/loop"/, "sidomenyn tappade vägen till /loop");
  assert.match(source, /Kartongförstöraren/, "sidomenyns post saknar produktens namn");
  assert.match(source, /data-nav-loop="true"/, "posten går inte att peka på maskinläsbart");

  /*
    PLACERINGEN ÄR EN PRODUKTREGEL, INTE SMAK: posten ska mötas direkt efter den primära CTA:n
    och före rapportytorna. Mätt på källans ordning, med kommentarerna bortskalade så att den
    här filens egen prosa inte kan flytta ett index.
  */
  const at = (needle: string) => {
    const index = source.indexOf(needle);
    assert.ok(index >= 0, `hittade inte «${needle}» i ${SIDEBAR_PATH}`);
    return index;
  };
  assert.ok(at("Ny kund") < at("data-nav-loop"), "posten står före «Ny kund»-CTA:n");
  assert.ok(at("data-nav-loop") < at("Översikt"), "posten står efter Översikt");

  // Ikonen är postens egen, i husets linjestil — aldrig en återanvänd grannikon.
  assert.match(source, /kartong:\s*\(/, "posten har ingen egen ikon i ikonuppsättningen");
  assert.equal(
    (source.match(/\{I\.kartong\}/g) ?? []).length,
    1,
    "ikonen renderas inte exakt en gång — då delar två poster samma bild",
  );
  /*
    Postens EGEN markup: från dess märkning fram till nästa `<Link`. Ett fast teckenfönster hade
    kunnat glida in i grannposten och läst dess ikon som denna posts — mätaren skulle då säga
    fel sak första gången någon la till ett attribut.
  */
  const entryStart = at("data-nav-loop");
  const nextLink = source.indexOf("<Link", entryStart);
  const entryBlock = source.slice(entryStart, nextLink === -1 ? source.length : nextLink);
  assert.match(entryBlock, /\{I\.kartong\}/, "posten renderar inte sin egen ikon");
  assert.match(entryBlock, /Kartongförstöraren/, "posten saknar sin etikett");
  for (const other of ["I.oversikt", "I.agenter", "I.leads", "I.nykund", "I.halsa"]) {
    assert.ok(!entryBlock.includes(other), `posten lånar ${other}`);
  }
});

test("NAV-A: posten är tänd på /loop OCH /loop/** — exakt-matchning hade släckt inlämningen", () => {
  const source = stripComments(read(SIDEBAR_PATH));

  // Mekanismen är sektionsbaserad och används FÖR /loop.
  assert.match(
    source,
    /const inSection = \(href: string\) =>\s*pathname === href \|\| pathname\.startsWith\(`\$\{href\}\/`\)/,
    "sektionsmekanismen ser inte ut som förväntat — läs om mätaren mot den nya formen",
  );
  assert.match(source, /inSection\("\/loop"\)/, "posten använder inte sektionsmekanismen");

  /*
    OCH SEMANTIKEN MÄTS, INTE BARA STAVNINGEN. Predikatet nedan är exakt den form källan bär;
    lögnstubben under är den form posten HADE (exakt-matchning), som släcker navigeringen så
    fort operatören står i inlämningen — alltså mitt i samma produkt.
  */
  const inSection = (href: string, pathname: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  for (const pathname of ["/loop", "/loop/mata", "/loop/mata/nagot"]) {
    assert.equal(inSection("/loop", pathname), true, `${pathname} tände inte posten`);
  }
  for (const pathname of ["/", "/leads", "/loopa", "/loopa/mata"]) {
    assert.equal(inSection("/loop", pathname), false, `${pathname} tände posten felaktigt`);
  }

  const exactOnly = (href: string, pathname: string) => pathname === href;
  assert.equal(
    exactOnly("/loop", "/loop/mata"),
    false,
    "lögnstubben beter sig inte som den gamla mekanismen — mätaren mäter ingenting",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * B · STARTSIDAN — INGÅNG TILLAGD, ÖVERSIKTEN KVAR
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-B: startsidan bär produktingången — rubrik, en rad och en knapp till /loop", () => {
  const source = stripComments(read(HOME_PATH));

  assert.match(source, /data-product-entry="kartongforstoraren"/, "produktingången saknas");
  assert.match(source, /Kartongförstöraren/, "ingången saknar produktens namn");
  assert.match(
    source,
    /Mata in arbete och se Nortropic arbeta\./,
    "ingången saknar sin enda förklarande rad",
  );
  assert.match(source, /Öppna kartongförstöraren/, "ingången saknar sin knapp");
  assert.match(source, /href="\/loop"/, "knappen pekar inte på /loop");
  assert.match(source, /data-product-entry-cta="true"/, "knappen går inte att peka på");

  /*
    INGÅNG, INTE STATUSWIDGET. Startsidan äger ingen sanning om fabriken: den läser ingen
    snapshot, ingen fixtur och inget läge, och den ritar ingen liveness-markör. En ingång som
    låtsas mäta något vore ett påstående utan källa — precis den sorten rummet finns för att inte
    göra.
  */
  for (const forbidden of [
    /from "@\/lib\/loop/,
    /fixtureSnapshot|fixtureEmptySnapshot|RAW_FIXTURES/,
    /data-liveness|live-dot|status-pill|mk-badge|data-room-mode/,
    /factoryRoomMode/,
  ]) {
    assert.ok(!forbidden.test(source), `startsidans ingång bär ${forbidden} — den är ingen mätare`);
  }
});

test("NAV-B: den gamla översikten överlever — panelerna importeras OCH renderas", () => {
  const source = stripComments(read(HOME_PATH));

  for (const panel of ["ProcessGuide", "PipelinePanel", "MetricsPanel"]) {
    assert.match(
      source,
      new RegExp(`import\\s+${panel}\\s+from`),
      `startsidan importerar inte längre ${panel}`,
    );
    assert.match(source, new RegExp(`<${panel}[\\s/>]`), `startsidan renderar inte längre ${panel}`);
  }

  // LÖGNSTUB: en startsida där panelen tagits bort fälls verkligen av samma uppslag.
  const withoutPanel = source.replace(/<MetricsPanel[\s/>]/, "<Borttagen ");
  assert.ok(
    !/<MetricsPanel[\s/>]/.test(withoutPanel),
    "uppslaget skulle inte se att en panel togs bort",
  );

  // Och ingången ligger FÖRE översikten: produkten först, rapporten under.
  assert.ok(
    source.indexOf("data-product-entry=") < source.indexOf("<ProcessGuide"),
    "produktingången hamnade under den gamla översikten",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * C · SHOWROOM-SCENARIER — SLUTEN LISTA, FÖRVAL VID ALLT ANNAT
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-C: listan är sluten och varje ogiltigt värde faller till förvalet", () => {
  assert.deepEqual([...SHOWROOM_SCENARIO_IDS], ["full", "tom"]);
  assert.equal(DEFAULT_SCENARIO, "full");
  assert.deepEqual(
    SHOWROOM_SCENARIOS.map((scenario) => scenario.id),
    [...SHOWROOM_SCENARIO_IDS],
    "väljaren erbjuder ett värde utanför den slutna listan",
  );
  for (const scenario of SHOWROOM_SCENARIOS) {
    assert.ok(isScenarioId(scenario.id), `${scenario.id} står utanför listan`);
    assert.ok(scenario.label.length > 0 && scenario.description.length > 0);
  }

  // Giltiga värden väljs — och BARA de.
  assert.equal(resolveScenario("full"), "full");
  assert.equal(resolveScenario("tom"), "tom");

  const GARBAGE: (string | string[] | undefined | null)[] = [
    undefined,
    null,
    "",
    "   ",
    "TOM",
    "Tom",
    " tom ",
    "full;tom",
    "merge_conflict",
    "{}",
    "🙂",
    ["tom"],
    ["full", "tom"],
  ];
  for (const value of GARBAGE) {
    assert.equal(
      resolveScenario(value),
      DEFAULT_SCENARIO,
      `«${String(value)}» valde något annat än förvalet`,
    );
  }

  // LÖGNSTUB: en tolerant upplösare (skiftlägesokänslig) fälls av samma tabell.
  const lenient = (raw: string | string[] | undefined | null): ShowroomScenarioId => {
    const one = Array.isArray(raw) ? raw[0] : raw;
    const normalised = (one ?? "").trim().toLowerCase();
    return normalised === "tom" ? "tom" : "full";
  };
  assert.notEqual(
    lenient("TOM"),
    resolveScenario("TOM"),
    "mätaren skiljer inte en tolerant upplösare från den slutna",
  );

  // Förvalet har INGEN parameter: den omärkta adressen betyder samma sak som förut.
  assert.equal(scenarioHref("full"), "/loop");
  assert.equal(scenarioHref("tom"), `/loop?${SCENARIO_PARAM}=tom`);

  /*
    BESKRIVNINGEN LOVAR INTE MER ÄN VALET BYTER.

    Valet byter snapshoten — kön, blicken och hyllan. Tidslinjen monteras av skalet med sin egen
    fixturflagga och läser fixturkatalogen direkt, så den står kvar oavsett scenario. En rad som
    lovade «hur rummet ser ut innan något matats in» hade därför motsagts av posterna längre ned
    på samma skärm. Räckvidden ska i stället stå utskriven i notisen.
  */
  const tom = SHOWROOM_SCENARIOS.find((scenario) => scenario.id === "tom");
  assert.ok(tom, "det tomma scenariot finns inte längre");
  assert.ok(
    !/innan något matats in|tomt rum|hela rummet|tom skärm/i.test(tom.description),
    `«${tom.description}» lovar en tom SKÄRM, men valet tömmer bara snapshoten`,
  );
  assert.match(
    SCENARIO_PICKER_NOTE,
    /[Tt]idslinjen/,
    "notisen säger inte vad valet INTE rör — räckvidden måste stå utskriven",
  );
});

test("NAV-C: bakom valet står bara GENERERADE, schemavaliderade fixturer", () => {
  const full = scenarioSnapshot("full");
  const empty = scenarioSnapshot("tom");

  assert.deepEqual(full, fixtureSnapshot(), "«Full fabrik» är inte V1:s genererade fixtur");
  assert.deepEqual(empty, fixtureEmptySnapshot(), "«Tom fabrik» är inte den genererade tomfixturen");
  assert.ok(full, "fixturen validerade inte — då mäter provet fel sak");
  assert.ok(empty, "tomfixturen validerade inte");
  assert.ok(full.backlog.length > 0, "«Full fabrik» bär ingen kö");
  assert.equal(empty.backlog.length, 0, "«Tom fabrik» bär en kö");
  assert.equal(empty.current_task, null, "«Tom fabrik» bär en aktuell uppgift");
  assert.equal(empty.completed.length, 0, "«Tom fabrik» bär en hylla");

  /*
    OCH INGEN SCENARIO HITTAR PÅ DATA. Modulen bygger ingen snapshot själv: den anropar
    fixturingången och returnerar dess resultat som det är.
  */
  const module = stripComments(read("lib/loop/room/scenarios.ts"));
  assert.ok(!/schema_version|backlog:\s*\[|current_task:/.test(module), "modulen skriver egen data");
  assert.match(module, /fixtureSnapshot|fixtureEmptySnapshot/, "modulen läser inte fixturingången");

  /*
    MERGE_CONFLICT-LÄGET GÅR INTE ATT VISA IDAG, och det ska stå ärligt i stället för att
    fabriceras: kontraktets `merge` är opakt och null i hela den genererade katalogen. En
    scenario som visade en mergekonflikt hade därför varit handskriven data.
  */
  for (const task of [...full.backlog, ...full.completed, full.current_task]) {
    if (task === null) continue;
    assert.equal(task.merge, null, "fixturen bär numera ett merge-utfall — scenarierna ska mäta om");
  }
});

test("NAV-C: väljaren är märkt «Showroom-scenario», är länkar och ser aldrig ut som ett kommando", () => {
  const html = withoutStyles(
    renderToStaticMarkup(createElement(ScenarioPicker, { current: DEFAULT_SCENARIO })),
  );

  assert.ok(html.includes(SCENARIO_PICKER_LABEL), "rubriken «Showroom-scenario» saknas");
  assert.equal(SCENARIO_PICKER_LABEL, "Showroom-scenario");
  assert.ok(html.includes(`data-room-mode="${SHOWROOM}"`), "valet bär inget maskinläsbart läge");

  /*
    MÄRKT SOM SHOWROOM — MEN INTE EN TREDJE GÅNG INOM SAMMA SKÄRM.

    Det fulla märket bärs av sidhuvudets lägesrad ovanför och av statusraden nedanför; att upprepa
    det här kostade en rad på telefonens första skärm utan att tillföra en sanning. Ytan bär i
    stället läget ur lägesmodulen i sin upplysningsyta, och DET mäts — försvinner även det är
    väljaren omärkt.
  */
  assert.match(
    html,
    /<summary[\s\S]*?SHOWROOM/,
    "väljaren är inte märkt som showroom i klartext",
  );

  // Exakt ett alternativ per post i den slutna listan, och inget mer.
  const options = tagsWith(html, "data-scenario-option");
  assert.equal(options.length, SHOWROOM_SCENARIO_IDS.length, "väljaren erbjuder fel antal val");
  for (const option of options) {
    const id = attr(option, "data-scenario-option");
    assert.ok(
      (SHOWROOM_SCENARIO_IDS as readonly string[]).includes(id ?? ""),
      `väljaren erbjuder «${id}» — utanför den slutna listan`,
    );
    assert.ok(option.startsWith("<a "), `valet är inte en vanlig länk: ${option}`);
    assert.equal(attr(option, "href"), scenarioHref(id as ShowroomScenarioId));
  }
  for (const scenario of SHOWROOM_SCENARIOS) {
    assert.ok(html.includes(scenario.label), `${scenario.id} renderas utan etikett`);
  }

  /*
    VALEN ÄR CHIPS, OCH BESKRIVNINGARNA ÄR FLYTTADE — INTE BORTTAGNA.

    Ytan står ovanför produkten och får inte äta första skärmen på en telefon, så etiketten bär
    förstaläget och beskrivningarna står i upplysningsytan. Mätaren håller isär de två sakerna:
    kompakteringen ska synas i FORMEN, aldrig i innehållet.
  */
  assert.match(
    html,
    /<details[^>]*data-scenario-note="true"/,
    "väljaren har ingen upplysningsyta — beskrivningarna ligger då kvar i förstaläget",
  );
  for (const scenario of SHOWROOM_SCENARIOS) {
    assert.ok(
      html.includes(scenario.description),
      `${scenario.id}: beskrivningen raderades i stället för att flyttas`,
    );
    assert.ok(
      html.includes(`data-scenario-description="${scenario.id}"`),
      `${scenario.id}: beskrivningen går inte att peka på`,
    );
  }
  assert.ok(html.includes(SCENARIO_PICKER_NOTE), "notisen raderades i stället för att flyttas");
  assert.match(
    html,
    /<details[^>]*data-scenario-note="true"[\s\S]*?data-scenario-note-text="true"/,
    "notisen ligger kvar i förstaläget i stället för i upplysningsytan",
  );

  /*
    EN SYNLIG MOTSÄGELSE MÅSTE HA EN SYNLIG FÖRKLARING — OCH BARA DÄR DEN FINNS.

    Valet byter snapshoten men inte tidslinjen. Väljer man «Tom fabrik» står därför en tom fabrik
    ovanför en full tidslinje, och ligger den enda förklaringen bakom en stängd växel finns den i
    praktiken inte: då ska både beskrivningen och gränsmeningen stå UTANFÖR upplysningsytan.

    I förvalet finns ingen motsägelse att förklara, och ytan ligger ovanför produkten — varje rad
    den tar är en rad rummets ingång skjuts ned på en telefon. Mätaren kräver därför att raden är
    BORTA i förvalet. Det är en placeringsregel, inte en tystnad: mätningen längre upp kräver
    redan att BÅDA beskrivningarna står ordagrant i upplysningsytan.
  */
  const visiblePart = (markup: string) => {
    const disclosure = markup.indexOf("<details");
    assert.ok(disclosure > 0, "väljaren har ingen upplysningsyta att mäta mot");
    return markup.slice(0, disclosure);
  };

  assert.ok(
    !visiblePart(html).includes(scenarioById(DEFAULT_SCENARIO).description),
    "förvalet bär en förklarande rad ovanför produkten trots att ingen motsägelse finns där",
  );
  assert.ok(
    !visiblePart(html).includes(SCENARIO_TIMELINE_SCOPE_NOTE),
    "gränsmeningen står framme i förvalet, där den inte förklarar något",
  );

  const emptyHtml = withoutStyles(
    renderToStaticMarkup(createElement(ScenarioPicker, { current: "tom" })),
  );
  const emptyVisible = visiblePart(emptyHtml);
  assert.ok(
    emptyVisible.includes(scenarioById("tom").description),
    "«Tom fabrik» beskriver inte sig själv synligt",
  );
  assert.ok(
    emptyVisible.includes(SCENARIO_TIMELINE_SCOPE_NOTE),
    "«Tom fabrik» säger inte SYNLIGT att tidslinjen står kvar — motsägelsen blir oförklarad",
  );

  // Och gränsmeningen är EN sträng: den kompakta raden och den fulla notisen kan inte drifta isär.
  assert.ok(
    SCENARIO_PICKER_NOTE.includes(SCENARIO_TIMELINE_SCOPE_NOTE),
    "den fulla notisen bär inte samma gränsmening som den synliga raden",
  );

  // INGEN KOMMANDOFORM: inga knappar, inget formulär, ingen intention, ingen kö.
  assert.ok(!/<button|<form|<input|<select/i.test(html), "valet ser ut som en kommandoyta");
  assert.ok(!/data-command|aria-disabled/.test(html), "valet bär kommandoytans krokar");

  // Det VALDA alternativet är utpekat för både öga och hjälpmedel.
  const selected = options.filter((option) => attr(option, "data-scenario-selected") === "true");
  assert.equal(selected.length, 1, "exakt ett val ska vara markerat");
  assert.equal(attr(selected[0], "data-scenario-option"), DEFAULT_SCENARIO);
  assert.equal(attr(selected[0], "aria-current"), "page");
});

test("NAV-C: routen väljer scenario — och den omärkta adressen är oförändrad", () => {
  // Utan parameter: EXAKT V1:s fixtur. Det är samma påstående V2:s frysta props-mätning gör.
  assert.deepEqual(shellPropsFor().snapshot, fixtureSnapshot());

  // Med ett giltigt val: den genererade tomfixturen.
  assert.deepEqual(shellPropsFor({ [SCENARIO_PARAM]: "tom" }).snapshot, fixtureEmptySnapshot());

  // Med skräp, upprepad parameter eller fel skiftläge: förvalet, aldrig en tom vy.
  for (const value of ["TOM", "nonsens", "", "merge_conflict"]) {
    assert.deepEqual(
      shellPropsFor({ [SCENARIO_PARAM]: value }).snapshot,
      fixtureSnapshot(),
      `«${value}» föll inte till förvalet`,
    );
  }
  assert.deepEqual(shellPropsFor({ [SCENARIO_PARAM]: ["tom", "full"] }).snapshot, fixtureSnapshot());
  assert.deepEqual(shellPropsFor({ annat: "tom" }).snapshot, fixtureSnapshot());

  // Och väljaren i sidan speglar det valda scenariot, i klartext.
  const html = withoutStyles(renderToStaticMarkup(MaskinenPage() as ReactElement));
  assert.ok(html.includes(SCENARIO_PICKER_LABEL), "väljaren monteras inte på /loop");
  assert.ok(html.includes(`data-scenario-current="${DEFAULT_SCENARIO}"`), "valet märks inte ut");
  assert.ok(html.includes('data-maskin-shell="true"'), "rummet renderas inte längre");

  /*
    PRODUKTEN NAMNGER SIG PÅ SIN EGEN ROUTE.

    Sidomenyn och startsidan säger «Kartongförstöraren». Stod namnet ingenstans på /loop fick den
    som klickade gissa att sidans rubrik var samma produkt — en namnlucka mellan ingången och
    målet. Sidans h1 bär ägarens PRIMARY_LABEL sedan SHREDDER-01C (MaskinHeader, utanför den här
    skivans skrivrätt), och kontinuiteten mäts HÄR eftersom det är den här skivan som bygger de
    två ingångarna som pekar hit. Faller mätaren är namnluckan tillbaka.

    NOT OM JÄMFÖRELSEN: strängen bär inga tecken React skulle entitetskoda (&, <, >, "), så den
    kan jämföras direkt mot markupen. Det gäller inte generellt i den här filen — se NAV-F.
  */
  const PRIMARY_LABEL = "Kartongförstöraren";
  assert.ok(html.includes(PRIMARY_LABEL), "produktens namn står inte på sin egen route");
  assert.ok(
    html.indexOf(PRIMARY_LABEL) < html.indexOf(SCENARIO_PICKER_LABEL),
    "produktnamnet står under scenariovalet — sidans identitet ska mötas först",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * D · INGEN SCENARIOYTA HÄMTAR NÅGOT
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * NÄTVERKSVÄGARNA I RUMMET — BÅDA TVÅ, UTSKRIVNA.
 *
 * Rummet har TVÅ legitima utgående vägar, och en mätare som bara nämner den ena lär läsaren fel:
 *
 *   1. V9:s strömpanel (components/loop/LiveEventStream.tsx) — rummets enda tail-anslutning.
 *      Den ligger UTANFÖR den mätta mängden, eftersom den här skivan inte rör den.
 *   2. V7:s kommandoknapp (components/loop/CommandButton.tsx) — produktens enda utgående
 *      KOMMANDOväg. Den ligger INUTI den mätta mängden, eftersom skivan ändrade den, och den bär
 *      `fetch` i sin `defaultSender`. Den vägen är äldre än skivan, injicerbar just för att kunna
 *      mätas utan socket, och leder till en kanal som är STÄNGD tills backendens S13 finns.
 *
 * Undantaget nedan är därför en NAMNGIVEN fil med ett utskrivet skäl och ett exakt mönster — samma
 * form som `percentExempt` i tests/loop/room-mobile.test.ts — aldrig ett tyst hål i räckvidden.
 * Det MÄTS dessutom: slutar filen bära vägen det ursäktar ska undantaget bort, inte ligga kvar som
 * en öppen dörr.
 */
const NETWORK_EXEMPT: { path: string; pattern: RegExp; why: string }[] = [
  {
    path: COMMAND_BUTTON_PATH,
    pattern: /\bfetch\s*\(/,
    why:
      "V7:s kommandoväg mot app/api/loop/command. Kanalen är stängd (503 tills S13 finns), " +
      "avsändaren är injicerbar för att kunna mätas utan socket, och den här skivan flyttade " +
      "bara knappens PROSA — inte dess semantik.",
  },
];

test("NAV-D: ingen av skivans filer öppnar en nätverksväg utöver den namngivna", () => {
  const LIVE_COMPONENT = "components/loop/LiveEventStream.tsx";
  const files = sliceFiles();
  assert.ok(files.length >= 10, `hittade inte skivans filer — mätaren mäter inget (${files.length})`);

  /*
    RÄCKVIDDEN PÅSTÅS INTE, DEN MÄTS. Strömpanelen ska ligga UTANFÖR mängden: gör den inte det
    beskriver texten ovan fel yta, och då är det texten som ska rättas — inte mätaren som ska
    tystas.
  */
  assert.ok(existsSync(join(REPO_ROOT, LIVE_COMPONENT)), "rummets tail-anslutning finns inte");
  assert.ok(
    !files.some((file) => file.path === LIVE_COMPONENT),
    "strömpanelen ligger i den mätta mängden — undantagsprosan ovan beskriver då fel räckvidd",
  );

  const FORBIDDEN: { pattern: RegExp; why: string }[] = [
    { pattern: /\bfetch\s*\(/, why: "nätverksanrop" },
    { pattern: /XMLHttpRequest/, why: "nätverksanrop" },
    { pattern: /EventSource/, why: "egen strömanslutning" },
    { pattern: /WebSocket/, why: "egen socket" },
    { pattern: /navigator\.sendBeacon/, why: "utgående mätpunkt" },
  ];
  for (const { path, source } of files) {
    const code = stripComments(source);
    for (const rule of FORBIDDEN) {
      const exempt = NETWORK_EXEMPT.some(
        (one) => one.path === path && one.pattern.source === rule.pattern.source,
      );
      if (exempt) continue;
      assert.ok(!rule.pattern.test(code), `${path}: ${rule.why} (${rule.pattern})`);
    }
  }

  /*
    OCH VARJE UNDANTAG ÄR FORTFARANDE SANT. Ett undantag vars orsak försvunnit är ett hål, inte ett
    undantag: bär filen inte längre vägen ska raden tas bort ur listan.
  */
  for (const one of NETWORK_EXEMPT) {
    const file = files.find((entry) => entry.path === one.path);
    assert.ok(file, `${one.path} ingår inte i den mätta mängden — undantaget skyddar ingenting`);
    assert.ok(
      one.pattern.test(stripComments(file.source)),
      `${one.path} bär inte längre ${one.pattern} — ta bort undantaget i stället för att låta det ` +
        "stå kvar som en öppen dörr",
    );
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  const stubs = [
    "const r = await fetch('/api/loop/snapshot');",
    "const x = new XMLHttpRequest();",
    "const s = new EventSource('/api/loop/stream');",
    "const w = new WebSocket('wss://x');",
    "navigator.sendBeacon('/x');",
  ];
  for (let i = 0; i < FORBIDDEN.length; i += 1) {
    assert.ok(
      FORBIDDEN[i].pattern.test(stubs[i]),
      `mönstret för ${FORBIDDEN[i].why} fäller inte ens sin egen stubbe`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * E · INGEN BRYTPUNKT DÖLJER NAVIGERINGSPOSTEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-E: ingen media-regel döljer sidomenyns poster — smala vyer scrollar i stället", () => {
  const css = read(GLOBALS_PATH);
  const rules = parseRules(css);
  assert.ok(rules.length > 40, `läsaren hittade bara ${rules.length} regler — den mäter fel`);

  /*
    Den smala vyn är en HORISONTELL remsa, inte en beskuren meny: sidomenyn blir en rad med egen
    sidled-scroll. Mätaren läser den formen ur stilarket i stället för att anta den — försvinner
    den är posten inte längre nåbar på en telefon, och kravet «nav reachable» faller.
  */
  const narrow = rules.filter((rule) => rule.media !== null && /max-width:\s*720px/.test(rule.media));
  assert.ok(narrow.length > 0, "den smala vyns block finns inte — mätaren mäter ingenting");
  const sidebar = narrow.find((rule) => rule.selector === ".sidebar");
  assert.ok(sidebar, "sidomenyn arrangeras inte om i den smala vyn");
  assert.equal(declaredValue(sidebar.body, "overflow-x"), "auto", "remsan går inte att scrolla");
  assert.equal(declaredValue(sidebar.body, "flex-direction"), "row");
  const nav = narrow.find((rule) => rule.selector === ".sidebar-nav");
  assert.ok(nav, "navigeringen arrangeras inte om i den smala vyn");
  assert.equal(declaredValue(nav.body, "flex-direction"), "row");

  /*
    OCH INGEN REGEL — I NÅGOT MEDIA-BLOCK — DÖLJER POSTEN SJÄLV. Grupprubriker och undermenyer
    får fällas ihop i remsan (de är etiketter respektive nästlade sidor, inte produktens ingång);
    posternas egna väljare får aldrig det.
  */
  const CARRIES_THE_ENTRY = [".nav-item", ".sidebar-nav", ".sidebar"];
  /*
    RÄCKVIDDEN ÄR BASEN OCH BREDDBEROENDE BLOCK — alltså «vid någon mätt brytpunkt». En regel för
    ett helt annat medium (t.ex. utskrift) säger ingenting om produktens nåbarhet på en skärm och
    hör till den skiva som skulle skriva den.
  */
  const measured = hidingRules(css).filter(
    (rule) => rule.media === null || /width:/.test(rule.media),
  );
  for (const rule of measured) {
    const parts = rule.selector.split(/\s+/);
    for (const token of CARRIES_THE_ENTRY) {
      assert.ok(
        !parts.some((part) => part === token),
        `«${rule.selector}» döljer navigeringsposten (${rule.body}) i ${rule.media ?? "basen"}`,
      );
    }
    assert.ok(
      !rule.selector.includes("data-nav-loop"),
      `«${rule.selector}» döljer Kartongförstörarens egen post`,
    );
  }

  /*
    OCH POSTEN KAN INTE KRYMPA BORT — «INTE DOLD» ÄR INTE SAMMA SAK SOM «SYNS».

    En skanning efter display: none kan bara säga att ingen regel gömmer ytan. Den kan inte se
    den andra vägen bort: `.nav-item` bär i basregeln full bredd OCH dold overflow, och i radläget
    (≤720 px) ger det varje länk en basbredd på hela raden och en automatisk minimistorlek på noll.
    Alla poster krymper då till noll bredd, och sidomenyns egen sidled-scroll bläddrar förbi
    osynliga länkar i stället för att visa dem. Posten bär därför sitt EGET mått, och måttet mäts
    här — annars vore NAV-E en mätare som godkänner en tom remsa.

    Värdena LÄSES ur stilarket längre ned i samma prov i stället för att citeras här: en mätare
    ska inte behöva stava ut den CSS den mäter.
  */
  const sidebarSource = stripComments(read(SIDEBAR_PATH));

  // Måttet är EN konstant, delad av posterna — inte en literal upprepad elva gånger.
  assert.match(
    sidebarSource,
    /const NAV_ITEM_ROW_FIT = \{ flex: "none", width: "auto" \}/,
    "radmåttet finns inte längre som delad konstant",
  );

  const entryStart = sidebarSource.indexOf("data-nav-loop");
  assert.ok(entryStart >= 0, "posten finns inte — mätaren mäter ingenting");
  const nextLink = sidebarSource.indexOf("<Link", entryStart);
  const entry = sidebarSource.slice(
    entryStart,
    nextLink === -1 ? sidebarSource.length : nextLink,
  );
  assert.match(entry, /style=\{NAV_ITEM_ROW_FIT\}/, "posten kan krympas bort i remsan");

  /*
    OCH MÅTTET GÄLLER ALLA POSTER, INTE BARA DEN NYA — OCH «POST» ÄR EN KLASS, INTE EN TAGG.

    En ensam immuniserad post tar sin fulla bredd ur raden och lämnar de övriga MINDRE restbredd
    än före ändringen: en post blir nåbar genom att de andra blir sämre. Kravet «nav reachable»
    gäller navigeringen, inte en favoritlänk, så mätaren är total över posterna.

    RÄCKVIDDEN ÄR BÅDA TAGGARNA, EFTERSOM DEN FÖRSTA VERSIONEN AV MÄTAREN MISSADE DET.
    Den samlade bara `<Link`, och sidomenyns två gruppknappar (Leads, Systemhälsa) är
    `<button className="nav-item">`. De blev därför de enda flexbarn som fortfarande KUNDE
    krympa, absorberade hela det negativa utrymmet i remsan och klämdes till noll bredd — två
    poster som dessutom navigerar (`router.push`) försvann från telefonen medan mätaren var grön.
    En mätare som resonerar om «alla poster» men bara ser en av två taggar mäter sin egen
    formulering, inte menyn. Uppslaget matchar därför på KLASSEN och samlar båda taggarna.
  */
  const navEntries = (sidebarSource.match(/<(?:Link|button)[\s\S]*?>/g) ?? []).filter((tag) =>
    tag.includes("nav-item"),
  );
  assert.ok(navEntries.length >= 12, `hittade bara ${navEntries.length} navigeringsposter`);
  for (const tag of navEntries) {
    assert.ok(
      tag.includes("style={NAV_ITEM_ROW_FIT}"),
      `en navigeringspost saknar radmåttet och krymper mot noll i remsan: ${tag}`,
    );
  }

  /*
    OCH BÅDA TAGGSORTERNA FINNS FAKTISKT I MÄNGDEN. Utan den här kontrollen hade uppslaget
    ovan kunnat gå tillbaka till att bara se länkar utan att någon märkte det: en total mätning
    över en mängd som tappat halva sin räckvidd är grön av fel skäl.
  */
  assert.ok(
    navEntries.some((tag) => tag.startsWith("<Link")),
    "mätaren samlar inga länkposter längre",
  );
  assert.ok(
    navEntries.filter((tag) => tag.startsWith("<button")).length >= 2,
    "mätaren samlar inte gruppernas knappposter — de två som en gång klämdes till noll bredd",
  );

  // Och risken är verklig, inte hypotetisk: basregeln bär faktiskt de två egenskaperna.
  const navItem = rules.find((rule) => rule.selector === ".nav-item" && rule.media === null);
  assert.ok(navItem, "basregeln för navigeringsposter finns inte — mätaren mäter fel yta");
  assert.equal(declaredValue(navItem.body, "overflow"), "hidden");
  assert.ok(
    (declaredValue(navItem.body, "width") ?? "").length > 0,
    "basregeln sätter ingen bredd längre — krympningsrisken ska då omprövas",
  );

  // LÖGNSTUB: exakt det brott mätaren finns för fälls av samma uppslag.
  const stub = "@media (max-width: 720px) { .nav-item { display: none; } }";
  assert.deepEqual(
    hidingRules(stub).map((rule) => rule.selector),
    [".nav-item"],
    "mätaren ser inte ens en dold navigeringspost i ett media-block",
  );
  // NEGATIV KONTROLL: en vanlig arrangemangsregel läses aldrig som ett döljande.
  assert.equal(hidingRules(".nav-item { display: flex; opacity: 1; }").length, 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * F · KOMPOSITÖREN — INGÅNGEN OCH DE TVÅ ARBETSSPÅREN
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-F: kompositören pekar på /loop/mata och förhandsvisar inlämningen ärligt", () => {
  const html = renderToStaticMarkup(createElement(WorkComposer, {}));

  assert.ok(html.includes('data-work-composer="true"'), "kompositören renderas inte");
  const cta = tagsWith(html, 'data-room-composer-cta="true"')[0];
  assert.ok(cta, "den primära vägen till inlämningen saknas");
  assert.equal(attr(cta, "href"), "/loop/mata", "kompositören slutade peka på inlämningen");

  // Förhandsvisningen är TEXT om en yta som ligger någon annanstans — aldrig en mottagande yta.
  for (const step of COMPOSER_AFFORDANCES) {
    assert.ok(html.includes(step), `förhandsvisningens steg «${step}» renderas inte`);
  }
  assert.deepEqual(
    [...COMPOSER_AFFORDANCES],
    ["Dra Markdown hit", "Välj Markdown", "Klistra in arbete"],
  );
  assert.ok(html.includes(COMPOSER_PREVIEW_NOTE), "notisen om att inget lämnas saknas");
  assert.match(COMPOSER_PREVIEW_NOTE, /showroom/i, "notisen namnger inte läget");
  assert.ok(
    !/<form|<textarea|<input|<select|method="post"/i.test(html),
    "kompositören fejkar en inlämningsyta",
  );
  assert.ok(!/data-command|aria-disabled/.test(html), "kompositören bär en kommandoväg");

  /*
    Och läget står i klartext på ytan, inte bara i ett attribut någon annanstans.

    MÄTT PÅ LÄGET, INTE PÅ HELA MÄRKESSTRÄNGEN. «.rm-flag» är rummets lägesmärke och bär ett
    LÄGE — SHOWROOM, LIVE, OFFLINE, BLOCKED eller em-streck. Provet mätte tidigare hela
    SHOWROOM_BADGE («SHOWROOM · SIMULERAD FABRIKSDATA») och låste därmed en hel mening inne i ett
    märke vars ordförråd är lägen. Den fulla strängen är inte borta ur vyn: statusraden renderar
    den som sitt DATAKÄLLA-märke, utanför varje upplysningsyta, på samma skärm — och den
    mätningen ägs av showroom-contract-provet, som redan gör den.
  */
  assert.ok(html.includes(SHOWROOM), "kompositören är inte märkt med rummets läge");
  assert.ok(html.includes('data-composer-mode="fixture"'), "fixturläget märks inte ut");
});

test("NAV-F: båda arbetsspåren syns — kundproduktion OCH systemförbättring, utan kommandoväg", () => {
  const html = renderToStaticMarkup(createElement(WorkComposer, {}));

  assert.ok(html.includes(COMPOSER_INTENT_QUESTION), "intentionsfrågan saknas");
  assert.equal(COMPOSER_INTENT_QUESTION, "Vad vill du göra?");

  const lanes = tagsWith(html, "data-composer-lane");
  assert.equal(lanes.length, 2, "Nortropics två arbetsspår syns inte som två val");
  for (const lane of lanes) {
    assert.ok(lane.startsWith("<a "), `arbetsspåret är inte en vanlig länk: ${lane}`);
    assert.equal(attr(lane, "href"), "/loop/mata", "ett arbetsspår leder någon annanstans");
    assert.ok(!/data-command|onclick|onClick/i.test(lane), `arbetsspåret bär en kommandoväg: ${lane}`);
  }

  const labels = COMPOSER_LANES.map((lane) => lane.label);
  assert.deepEqual(labels, ["Bygg / ändra kundprojekt", "Förbättra Nortropic"]);
  for (const lane of COMPOSER_LANES) {
    assert.ok(html.includes(lane.label), `spåret «${lane.label}» renderas utan etikett`);
    assert.ok(html.includes(lane.example), `spåret «${lane.label}» renderas utan exempel`);
    assert.ok(lane.example.length > 20, "exemplet säger inte vad slags arbete det är");
  }
  // Exemplen är skrivna i VAR SIN domän — annars säger de inte vad skillnaden består i.
  assert.match(COMPOSER_LANES[0].example, /hemsida|kund|Måleri/i, "kundspårets exempel är otydligt");
  assert.match(
    COMPOSER_LANES[1].example,
    /credential|proxy|Nortropic|agent/i,
    "systemspårets exempel är otydligt",
  );
  assert.notEqual(COMPOSER_LANES[0].example, COMPOSER_LANES[1].example);

  /*
    OCH SPÅREN ÄR PRESENTATION, INTE ETT KONTRAKT. Den typade arbetsdomänen ägs av sin egen
    kontraktsskiva; den här skivan får inte smyga in den i schema, tillstånd eller fixtur.
  */
  const schema = read("lib/loop/schema.ts");
  for (const pattern of [/CUSTOMER_PRODUCTION/, /SYSTEM_IMPROVEMENT/, /work_domain/]) {
    assert.ok(!pattern.test(schema), `kontraktet bär numera ${pattern} — då gäller en annan skiva`);
  }
  const composer = stripComments(read("components/loop/room/WorkComposer.tsx"));
  assert.ok(
    !/CUSTOMER_PRODUCTION|SYSTEM_IMPROVEMENT/.test(composer),
    "kompositören stavar ett kontraktsvärde som inte finns",
  );
});

test("NAV-F: scenariovaljaren är nåbar från kompositören — ankaret finns i BÅDA ändar", () => {
  /*
    FYNDET SOM MÄTAREN FRYSER: vid ≤719 px målas väljaren efter hela rummet, alltså tusentals
    pixlar under kompositören. Utan en väg dit fanns «Full fabrik / Tom fabrik» i praktiken inte
    för den som öppnar rummet på en telefon.

    Mätaren äger BÅDA ändarna av ankaret, eftersom ett ankare med bara en ände är en trasig länk
    som inget prov märker: väljaren måste BÄRA id:t, och kompositören måste PEKA på samma id —
    och båda ska läsa strängen ur samma konstant i stället för att stava den var för sig.
  */
  const composerHtml = renderToStaticMarkup(createElement(WorkComposer, {}));
  const pickerHtml = withoutStyles(
    renderToStaticMarkup(createElement(ScenarioPicker, { current: DEFAULT_SCENARIO })),
  );

  // Ände 1: väljaren bär ankaret.
  assert.ok(
    pickerHtml.includes(`id="${SCENARIO_ANCHOR_ID}"`),
    "väljaren bär inget ankare — pekaren i rummet skulle peka på ingenting",
  );

  // Ände 2: kompositören pekar på exakt samma ankare, som en ordinär länk inom sidan.
  const pointer = tagsWith(composerHtml, 'data-scenario-pointer="true"')[0];
  assert.ok(pointer, "kompositören saknar vägen till scenariovaljaren");
  assert.ok(pointer.startsWith("<a "), `pekaren är inte en vanlig länk: ${pointer}`);
  assert.equal(attr(pointer, "href"), `#${SCENARIO_ANCHOR_ID}`, "pekaren pekar inte på väljaren");
  assert.ok(composerHtml.includes(SCENARIO_POINTER_LABEL), "pekarens etikett renderas inte");

  /*
    PEKAREN ÄR INGEN INTENTION och ingen väg ut ur rummet: ingen kommandomärkning, ingen
    hämtning, ingen extern adress. Den flyttar blicken inom samma sida.
  */
  assert.ok(!/data-command|onclick|onClick|aria-disabled/i.test(pointer), `pekaren bär en kommandoväg: ${pointer}`);
  assert.ok(!/https?:/.test(pointer), "pekaren lämnar sidan");

  /*
    OCH DEN LJUGER INTE OM RIKTNINGEN. Väljaren står ovanför rummet vid ≥720 px och under det vid
    ≤719 px; en etikett med «ned» eller «upp» hade varit osann i den ena vyn. Ankaret hittar rätt
    i båda, så etiketten ska vara riktningslös.
  */
  assert.ok(
    !/\b(ned|nedan|upp|ovan|längst)\b/i.test(SCENARIO_POINTER_LABEL),
    `pekarens etikett påstår en riktning som bara stämmer i en vy: «${SCENARIO_POINTER_LABEL}»`,
  );

  // Båda ändarna läser samma konstant — ingen yta stavar ankaret för hand.
  for (const path of [
    "components/loop/room/WorkComposer.tsx",
    "components/loop/room/ScenarioPicker.tsx",
  ]) {
    const code = stripComments(read(path));
    assert.match(code, /SCENARIO_ANCHOR_ID/, `${path} stavar ankaret för hand`);
    assert.ok(
      !new RegExp(`["'\`]#?${SCENARIO_ANCHOR_ID}`).test(code),
      `${path} bär ankaret som avskriven sträng i stället för som konstant`,
    );
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * G · SKIVANS EGNA FILER — PROCENT, RÖRELSE, LOGGNING, FRAMSTEG
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-G: ingen av skivans filer bär procent, rörelse, loggning eller framstegselement", () => {
  /*
    Rummets träd mäts redan rekursivt av V2/ROOM-01. Sidomenyn och startsidan ligger UTANFÖR de
    träden, och den här mätaren finns just för dem — men den körs på hela mängden, eftersom en
    mätare som bara gäller de nya filerna hade tappat sin räckvidd nästa gång en fil flyttar.

    Procenttecknet skrivs som teckenkod: annars hade den här filen fällt sig själv om den någon
    gång kom med i en rekursiv mätning.

    VARJE GREP LÄSER KOD, INTE PROSA — OCH DET GÄLLER OCKSÅ PROCENTGREPET.

    Mätaren läste först RÅ källa efter procenttecknet, och fällde då en KOMMENTAR i
    components/Sidebar.tsx som citerade en regel ur app/globals.css. Det som förbjuds är en
    procent-YTA i produkten (en framstegsstapel, en fejkad andel), aldrig ett ord i en förklaring
    — och en mätare som fäller sin egen dokumentation lär nästa läsare att sluta dokumentera.
    Räckvidden är därför kod med kommentarerna bortskalade, samma disciplin som V2/ROOM-01 använder
    när de letar efter förbud de själva beskriver i klartext. Lögnstubben nedan visar att grepet
    fortfarande fäller tecknet när det står i KOD.

    Prosan är inte omätt för det: NAV-G:s systerprov nedan mäter den RENDERADE sidan, där ingen
    kommentar följer med — så ett procenttecken som når en operatörs skärm fälls fortfarande.
  */
  const PERCENT = String.fromCharCode(37);
  const MOTION = /@keyframes|animation:|animate-|\bpulse\b|\bblink\b/i;
  const CONSOLE = /console\.(log|info|warn|error|debug|trace)\s*\(/;
  const PROGRESS = /<progress|role=["']progressbar|aria-valuenow|<meter\b/i;
  const PROGRESS_SEMANTICS = /\b(progressbar|progress-bar|framstegsstapel|procentsats|percentage)\b/i;

  const files = sliceFiles();
  assert.ok(files.length >= 10, `hittade inte skivans filer — mätaren mäter inget (${files.length})`);

  for (const { path, source } of files) {
    const code = stripComments(source);
    assert.ok(!code.includes(PERCENT), `procenttecken i ${path}`);
    assert.ok(!MOTION.test(code), `fabricerad liveness-rörelse i ${path}`);
    assert.ok(!PROGRESS.test(code), `framstegselement i ${path}`);
    assert.ok(!CONSOLE.test(code), `loggning i ${path}`);
    assert.ok(!PROGRESS_SEMANTICS.test(code), `framstegs-/procentsemantik i ${path}`);
  }

  // Och ytorna utanför de rekursiva träden mäts VID NAMN, så räckvidden syns i stället för att antas.
  for (const path of NAMED_SURFACES) {
    assert.ok(
      files.some((file) => file.path === path),
      `${path} ingår inte i mätningen — då är den omätt`,
    );
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  assert.ok(MOTION.test(".x { animation: pulse 1s infinite; }"));
  assert.ok(CONSOLE.test("console.warn('x');"));
  assert.ok(PROGRESS.test('<progress value="1" max="2" />'));
  assert.ok(PROGRESS_SEMANTICS.test("const percentage = 1;"));

  /*
    OCH KOMMENTARSKALNINGEN ÄR MÄTT ÅT BÅDA HÅLL — annars vore den ett hål i stället för ett
    omdöme: tecknet i KOD fälls fortfarande, tecknet i en FÖRKLARING gör det inte.
  */
  assert.ok(
    stripComments(`const w = "50${PERCENT}";`).includes(PERCENT),
    "procentgrepet fäller inte längre tecknet i kod",
  );
  assert.ok(
    !stripComments(`/* regeln säger width: 100${PERCENT} */\nconst w = 1;`).includes(PERCENT),
    "kommentarskalningen tar inte bort tecknet ur en förklaring",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * I · KOMMANDOYTANS PROSA ÄR FLYTTAD — ALDRIG RADERAD, ALDRIG AVKOPPLAD
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-I: kommandoytans orsaker står kvar ordagrant, och aria-kopplingen är intakt", () => {
  /*
    Prosadieten flyttade förklaringen och den ordagranna orsaken in i en upplysningsyta. Det är
    en FORMÄNDRING, och den får aldrig glida över i en innehållsändring: nästa gång någon rör
    ytan ska mätaren säga ifrån om texten försvinner, om kopplingen till hjälpmedlet bryts eller
    om den korta blockeringsraden vid knappen tas bort tillsammans med resten.
  */
  const html = renderToStaticMarkup(
    createElement(CommandDeck, { runId: "run-fixture-a", watermark: 7, currentTaskId: null }),
  );

  // ORDAGRANT KVAR: ett hopfällt <details> renderar sitt innehåll, så texten finns i markupen.
  assert.ok(html.includes(COMMAND_QUEUE_DISABLED_REASON), "den ordagranna orsaken raderades");
  assert.ok(html.includes(COMMAND_QUEUE_BLOCKED_ON), "vad kanalen är blockerad på raderades");

  // KOPPLINGEN ÄR INTAKT: varje avstängd knapp pekar på ett orsakselement som FAKTISKT renderas.
  const buttons = tagsWith(html, "data-command-disabled");
  assert.ok(buttons.length > 0, "kommandoytan renderar inga knappar — mätaren mäter ingenting");
  for (const button of buttons) {
    assert.equal(attr(button, "data-command-disabled"), "true", `en knapp är öppen: ${button}`);
    assert.equal(attr(button, "aria-disabled"), "true", `en knapp är klickbar: ${button}`);
    const describedBy = attr(button, "aria-describedby");
    assert.ok(describedBy, `knappen tappade kopplingen till sin orsak: ${button}`);
    assert.ok(
      html.includes(`id="${describedBy}"`),
      `orsakselementet ${describedBy} renderas inte — beskrivningen pekar i tomma luften`,
    );
  }

  // Den KORTA lägesraden står kvar vid knappen, utanför upplysningsytan.
  assert.ok(html.includes("data-blocked-on="), "den korta blockeringsraden vid knappen är borta");

  // Och den långa texten ligger BAKOM dörren, inte framför den.
  assert.match(
    html,
    /<details[^>]*data-command-detail="[^"]*"[\s\S]*?data-command-reason="true"/,
    "orsaken ligger inte i upplysningsytan — kompakteringen är inte gjord",
  );
  assert.match(
    html,
    /<details[^>]*data-command-notes="true"[\s\S]*?data-command-scope="true"/,
    "ytans räckviddstext ligger inte i upplysningsytan",
  );

  // Upplysningsytorna är rummets egen form: hopfällda som standard, aldrig öppna.
  const disclosures = html.match(/<details\b[^>]*>/g) ?? [];
  assert.ok(disclosures.length >= 2, "kommandoytan bär ingen upplysningsyta");
  for (const tag of disclosures) {
    assert.ok(tag.includes("rm-details"), `upplysningsytan bär inte rummets form: ${tag}`);
    assert.ok(!/\bopen\b/.test(tag), `en upplysningsyta är öppen som standard: ${tag}`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * H · SHOWROOM-ORDFÖRRÅDET ÄGS AV MODE.TS — INGEN YTA STAVAR DET FÖR HAND
 * ──────────────────────────────────────────────────────────────────────────── */

test("NAV-H: ytorna renderar lägeskonstanten, aldrig en avskriven sträng", () => {
  /*
    lib/loop/room/mode.ts säger det rakt ut om sitt märke: «ENDA källan till strängen — ingen yta
    skriver av den». En avskriven sträng driftar isär från konstanten i tysthet den dag ordet
    ändras, och en yta som skriver ordet själv påstår dessutom ett läge den aldrig frågat efter.
    Mätaren gäller de ytor som FAKTISKT bär märket i den här skivan.
  */
  const CARRIERS = [
    "components/loop/room/WorkComposer.tsx",
    "components/loop/room/RoomTimeline.tsx",
    "components/loop/room/CausalChain.tsx",
    "components/loop/room/ScenarioPicker.tsx",
  ];
  /** De två sätten att skriva ordet för hand: som strängliteral och som JSX-text. */
  const HAND_SPELLED = [/["'`]SHOWROOM/, />\s*SHOWROOM\s*</];

  for (const path of CARRIERS) {
    const code = stripComments(read(path));
    assert.match(
      code,
      /from "@\/lib\/loop\/room\/mode"/,
      `${path} bär märket utan att läsa lägesmodulen`,
    );
    for (const pattern of HAND_SPELLED) {
      assert.ok(!pattern.test(code), `${path} stavar showroom-ordförrådet för hand (${pattern})`);
    }
  }

  // Konstanterna bor kvar där de hör hemma, och värdet är det ytorna renderar.
  assert.equal(SHOWROOM, "SHOWROOM");
  assert.match(read("lib/loop/room/mode.ts"), /export const SHOWROOM_BADGE/);

  /*
    OCH TIDSLINJENS MÄRKE ÄR EN AVLÄSNING, INTE ETT PÅSTÅENDE. Skalet skickar inget läge dit, så
    ytan frågar `factoryRoomMode()` (fail-closed) i stället för att hävda showroom på egen hand —
    samma mönster som FactoryRoomHeader använder.
  */
  assert.match(
    stripComments(read("components/loop/room/RoomTimeline.tsx")),
    /mode = factoryRoomMode\(\)/,
    "tidslinjens märke frågar inte lägesmodulen om läget",
  );

  /*
    OCH MÄRKETS ORDFÖRRÅD MÄTS PÅ DET RENDERADE VÄRDET, INTE BARA PÅ IMPORTEN.

    «.rm-flag» är rummets LÄGESMÄRKE. Kontrollerna ovan ser att ytorna läser lägesmodulen, men de
    kunde inte se ett märke som bar ett HELT ANNAT SLAGS ord: tidslinjens ordningsväxel renderade
    en gång «ORDNING» i samma märke — en kategoribeteckning formad exakt som ett tillstånd. Inget
    prov såg det, eftersom ingen hade skrivit ordet som ett lägesnamn.

    Skadan är att märkets värde som markör urholkas: en operatör som ögnar sidan efter statusen
    måste då läsa varje märke för att avgöra om det ens ÄR en status. Mätaren läser därför varje
    renderat märke och kräver att det inleds med ett ord ur lägesordförrådet. Listan är ankrad i
    modulens egen konstant, så den kan inte drifta ifrån den.
  */
  const MODE_VOCABULARY = [SHOWROOM, "LIVE", "DEGRADED", "OFFLINE", "BLOCKED", MISSING];
  assert.ok(MODE_VOCABULARY.includes(SHOWROOM), "ordförrådet är inte ankrat i lägesmodulen");

  const rendered = withoutStyles(renderToStaticMarkup(MaskinenPage() as ReactElement));
  const badges = [...rendered.matchAll(/<span[^>]*class="rm-flag"[^>]*>([\s\S]*?)<\/span>/g)].map(
    (match) => match[1].replace(/<[^>]*>/g, "").trim(),
  );
  assert.ok(badges.length >= 4, `hittade bara ${badges.length} lägesmärken — mätaren mäter inget`);
  for (const badge of badges) {
    assert.ok(
      MODE_VOCABULARY.some((word) => badge.startsWith(word)),
      `«${badge}» bärs av lägesmärket men står utanför lägesordförrådet ` +
        `(${MODE_VOCABULARY.join(" · ")}) — ett kategoriord format som ett tillstånd`,
    );
  }
  // LÖGNSTUB: exakt det brott mätaren finns för fälls av samma uppslag.
  const strayBadge = '<span class="rm-flag">ORDNING</span>';
  const stray = [...strayBadge.matchAll(/<span[^>]*class="rm-flag"[^>]*>([\s\S]*?)<\/span>/g)].map(
    (match) => match[1].trim(),
  );
  assert.deepEqual(stray, ["ORDNING"], "uppslaget hittar inte ens ett märke att mäta");
  assert.ok(
    !MODE_VOCABULARY.some((word) => stray[0].startsWith(word)),
    "mätaren släpper igenom ett kategoriord i lägesmärket",
  );

  // LÖGNSTUBBAR: båda formerna av handstavning måste fällas av samma mätare.
  assert.ok(HAND_SPELLED[0].test('const flag = "SHOWROOM";'), "strängliteralen fälls inte");
  assert.ok(
    HAND_SPELLED[1].test('<span className="rm-flag">SHOWROOM</span>'),
    "JSX-texten fälls inte",
  );
  // NEGATIV KONTROLL: den riktiga formen får aldrig läsas som handstavning.
  for (const pattern of HAND_SPELLED) {
    assert.ok(
      !pattern.test('<span className="rm-flag">{SHOWROOM}</span>'),
      `mätaren fäller konstanten i sin riktiga form (${pattern})`,
    );
  }
});

test("NAV-G: den renderade /loop-sidan bär varken procent, rörelse eller framstegselement", () => {
  const PERCENT = String.fromCharCode(37);
  const html = renderToStaticMarkup(MaskinenPage() as ReactElement);

  assert.ok(!html.includes(PERCENT), "procenttecken i den renderade sidan");
  assert.ok(!/@keyframes|animation:/i.test(html), "rörelse i den renderade sidan");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement i sidan");

  // Väljaren och kompositören är med i samma rendering — mätaren mäter alltså rätt sida.
  const visible = withoutStyles(html);
  assert.ok(visible.includes(SCENARIO_PICKER_LABEL));
  assert.ok(visible.includes('data-work-composer="true"'));
});
