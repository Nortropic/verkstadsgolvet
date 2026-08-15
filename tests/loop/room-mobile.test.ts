/**
 * ROOM-08 · MOBILT FABRIKSRUM — negativa kontroller.
 *
 * Provar de frysta negativa kontrollerna i docs/nortropic-factory-room-master-roadmap-v1.md
 * §ROOM-08: bevisytor som bara går att nå på skrivbordet → FAIL, en dold authority-ändrande
 * handling → FAIL, sidled-scroll på sidnivå → FAIL, en kritisk skillnad som bärs av färg ensam
 * → FAIL, fokus som inte syns → FAIL.
 *
 * VAD PROVET FAKTISKT MÄTER — OCH VAD DET INTE KAN MÄTA
 * -----------------------------------------------------
 * Ett prov utan webbläsare kan inte mäta pixlar. Det kan däremot mäta det som ORSAKAR de fem
 * felen, och det är precis vad varje mätare här gör:
 *
 *   · MARKUPEN ÄR BRYTPUNKTSOBEROENDE. Rummet renderar EN markup, utan en enda breddgren i
 *     koden — alltså finns ingen "mobilvariant" som kan tappa en yta. Media-frågorna får bara
 *     ARRANGERA: varje egenskap som sätts i ett media-block mäts mot en låst lista, och ingen
 *     regel i något stilark får dölja en bevis- eller upplysningsyta.
 *   · ORDNINGEN I DEN ENKLA SPALTEN mäts på DOM-ordningen OCH på de order-regler som faktiskt
 *     gäller vid 390 px — inte på prosan om vad ordningen borde vara.
 *   · TRÄFFYTORNA mäts mot rummets EGEN primära kontroll (`.rm-cta`), läst ur stilarket i
 *     stället för transkriberad till en siffra i provet.
 *   · SIDLED-SCROLL mäts som frånvaro av dess orsaker: ingen bredd i px som spränger en
 *     390 px-vy, ingen bred mono-yta utan egen behållare eller ombrytning, ingen `nowrap`
 *     utanför en låst lista.
 *
 * Skärmklippen är fortfarande den empiriska bekräftelsen (visuell granskning vid 390 / 900 /
 * 1440 px). Det här provet ser till att reglerna inte kan försvinna utan att någon märker det.
 *
 * ÄRLIGHET OM RÄCKVIDDEN: inlämning och kommandon är fortfarande fixtur respektive stängd
 * kanal (backend S10/S13). Provet bevisar därför läsning, inspektion och räckvidd — aldrig att
 * en telefon kan lämna in en källa eller köa ett kommando.
 *
 * TRE MÄTARE SOM MED FLIT SPÄNNER ÖVER ANDRA SKIVORS FILER
 * ---------------------------------------------------------
 * Provet kan fällas av arbete som inte rör rummet. Det är avsiktligt — men bara om den som
 * fälls omedelbart förstår varför och vad som ska göras. Registret står här så att det går att
 * hitta innan man börjar gräva, och varje mätare upprepar sin instruktion i sitt eget
 * felmeddelande:
 *
 *   1. LOOP_CSS:s media-block (ROOM-MOBIL-MARKUP). Varje egenskap som sätts i en media-fråga
 *      måste stå i ARRANGEMENT_PROPERTIES. En ny LOOP_CSS-regel som bara arrangerar löses genom
 *      att lägga till egenskapen i listan; en som kan dölja eller tysta en yta är brottet.
 *   2. components/loop/EventRow.tsx saknar ännu tabIndex på sin rådataruta (ROOM-MOBIL-FOKUS).
 *      Den dagen den får ett faller mätaren — då är ROOM-08:s kvarstående begränsning löst, och
 *      felmeddelandet namnger de exakt två raderingar som hör till den ändringen.
 *   3. ROOM_CSS måste bära stycket «KVARSTÅENDE BEGRÄNSNING» så länge (2) gäller. Försvinner
 *      texten medan begränsningen finns kvar blir den en glömd begränsning.
 *
 * HARNESS-NOT: samma som V2/ROOM-01 — tsconfig har `jsx: "preserve"`, så delade komponenter
 * behöver en global React när de renderas utanför Next.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

(globalThis as unknown as { React: typeof React }).React = React;

import MaskinShell from "../../components/loop/MaskinShell";
import { chainRawLabel } from "../../components/loop/room/CausalChain";
import { rawLabel } from "../../components/loop/room/RoomTimeline";
import { ROOM_CSS } from "../../components/loop/room/ui";
import { LOOP_CSS } from "../../components/loop/ui";
import { fixtureSnapshot } from "../../lib/loop/fixtures";
import {
  COMMAND_QUEUE_BLOCKED_ON,
  COMMAND_QUEUE_DISABLED_REASON,
  COMMAND_QUEUE_TRANSPORT,
  commandChannelEnabled,
} from "../../lib/loop/commands";
import { MISSING } from "../../lib/loop/labels";
import { validateSnapshot, type LoopSnapshot, type TaskView } from "../../lib/loop/schema";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** De tre vyer granskningen ska köra: telefon, surfplatta, skrivbord. */
const VIEWPORTS = { mobile: 390, tablet: 900, desktop: 1440 } as const;

/**
 * Den uppgift fixturens orsakskedja FAKTISKT bär bevisreferenser för.
 *
 * Namnet är ett urval, inte ett antagande: renderar den inte längre en enda bevisreferens
 * faller mätaren nedan med just den orsaken, i stället för att tyst mäta en tom yta.
 */
const TASK_WITH_EVIDENCE = "p-209";

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

function renderRoom(snapshot: LoopSnapshot | null, fixture = true): string {
  return renderToStaticMarkup(createElement(MaskinShell, { snapshot, fixture }));
}

/**
 * Fixturens snapshot med en ANNAN uppgift i blicken.
 *
 * Bevisreferenser finns bara i de kedjor fixturen faktiskt bär dem för. Att mäta ytan på en
 * uppgift utan referenser hade bevisat ingenting; kandidaten körs därför genom V1:s validering
 * så att provet aldrig renderar en handskriven parallellmodell.
 */
function snapshotFocusedOn(taskId: string): LoopSnapshot {
  const base = snapshotOrThrow();
  const task = [base.current_task, ...base.backlog, ...base.completed].find(
    (one): one is TaskView => one !== null && one.task_id === taskId,
  );
  assert.ok(task, `fixturen har ingen uppgift ${taskId} — provet mäter fel data`);
  const validated = validateSnapshot({ ...structuredClone(base), current_task: task });
  assert.equal(validated.ok, true, "provets snapshot bröt mot V1-kontraktet");
  return (validated as { ok: true; data: LoopSnapshot }).data;
}

function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

/** Rummets EGNA filer, rekursivt — samma räckvidd som ROOM-01:s prov. */
function roomSourceFiles(): { path: string; source: string }[] {
  const dirs = [join(REPO_ROOT, "components/loop/room"), join(REPO_ROOT, "lib/loop/room")];
  return dirs.flatMap((dir) =>
    readdirSync(dir, { recursive: true, encoding: "utf8" })
      .map((name) => join(dir, name))
      .filter((path) => /\.(ts|tsx|css)$/.test(path))
      .map((path) => ({ path, source: readFileSync(path, "utf8") })),
  );
}

/**
 * Filerna DEN HÄR skivan ändrar — ALLA, inklusive den enda som inte kan mätas av procentgrepet.
 *
 * Listan är explicit med flit: greparna nedan ska följa med skivans egna ändringar, och en fil
 * som läggs till utan att komma med i listan syns då som en omätt fil i granskningen i stället
 * för att tyst slippa undan.
 *
 * DÄRFÖR STÅR ÄVEN UNDANTAGET I LISTAN, I STÄLLET FÖR UTANFÖR DEN. En lista som påstår sig vara
 * skivans ändrade filer, men tyst utelämnar en av dem, är värre än ingen lista: nästa läsare tror
 * att räckvidden är täckt. Skivan ändrar också `tests/loop/room-shell.test.ts` (prosan om vilket
 * intervall som ordnar om banorna), och den filen BÄR procenttecknet i klartext — på de två rader
 * där den SJÄLV förbjuder tecknet, och i den rörelsesträng den själv letar efter. Att köra
 * mätarna på den hade fällt en mätare för att den stavar ut vad den mäter, vilket är exakt den
 * miss den här filen undviker genom att skriva tecknet som teckenkod.
 *
 * Undantaget är därför EN NAMNGIVEN FIL med utskrivet skäl (`percentExempt`), aldrig ett mönster,
 * och det gäller bara provfiler: en produktfil kan aldrig undantas. Undantaget mäts dessutom
 * självt — slutar filen bära tecknet faller mätaren och undantaget ska tas bort.
 */
type ChangedFile = {
  path: string;
  /** Produktfil: mäts också av rörelse-, framstegs- och loggningsgrepen. */
  product: boolean;
  /** Namngivet undantag från PROCENTGREPET, med skälet utskrivet. Bara för provfiler. */
  percentExempt?: string;
};

const CHANGED_FILES: ChangedFile[] = [
  { path: "components/loop/room/ui.ts", product: true },
  { path: "components/loop/room/RoomStep.tsx", product: true },
  { path: "components/loop/room/RoomTimeline.tsx", product: true },
  { path: "components/loop/room/CausalChain.tsx", product: true },
  /* Skalet ändrades bara i sin bindande-regler-prosa (banornas ordning per vy), men en ändrad
     fil är en ändrad fil: den mäts av samma grep som resten. */
  { path: "components/loop/MaskinShell.tsx", product: true },
  /*
    Provfilen är en ändrad fil och mäts av procentgrepet som allt annat. Rörelse-, framstegs-
    och loggningsmönstren körs däremot bara på PRODUKTFILERNA: en mätare måste stava ut det
    mönster den letar efter, och en fil som fälls av sin egen mätsträng hade mätt sig själv i
    stället för koden. Det är samma resonemang som V2/ROOM-01 gör när de skalar bort
    kommentarer innan de letar efter ett förbud de själva beskriver.
  */
  { path: "tests/loop/room-mobile.test.ts", product: false },
  /*
    ROOM-08 ändrar också ROOM-01:s provfil (kommentaren som säger att ordningstalet döljs i
    intervallet 720–959 px och inte «under 960 px»). Den mäts av samma lista som resten — utom
    av procentgrepet, av det skäl som står ovanför listan och som upprepas här i klartext:
    filen skriver ut procenttecknet i sin egen förbudsmätning, och rörelsemönstret i sin egen
    lögnstub. Undantaget gäller den här enda filen, det är inte ett mönster, och mätaren nedan
    kräver att skälet fortfarande är sant.
  */
  {
    path: "tests/loop/room-shell.test.ts",
    product: false,
    percentExempt:
      "filen bär procenttecknet i klartext i SIN EGEN mätning av samma förbud — samma skäl som " +
      "gör att den här filen skriver tecknet som teckenkod",
  },
];

/* ── En liten CSS-läsare ──────────────────────────────────────────────────────
   Stilarken är strängar i källan; för att kunna påstå något om vad som gäller VID EN VISS
   BREDD måste de läsas som regler och inte som text. Läsaren är avsiktligt enkel och matchar
   husets egen CSS-form (en nivå av media-block, inga nästlade at-regler). Den bär därför en
   egen negativ kontroll längst ned: kan den inte läsa ett känt stycke är varje mätare som
   vilar på den värdelös. */

type CssRule = { selector: string; body: string; media: string | null; index: number };

function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ");
}

function parseRules(css: string): CssRule[] {
  const source = stripCssComments(css);
  const rules: CssRule[] = [];
  let cursor = 0;
  let media: string | null = null;
  let index = 0;

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
      if (trimmed !== "") rules.push({ selector: trimmed, body, media, index: index++ });
    }
    cursor = close + 1;

    // Ett media-block stängs av nästa klammer efter sin sista regel.
    const closing = source.slice(cursor).match(/^\s*\}/);
    if (media !== null && closing) {
      media = null;
      cursor += closing[0].length;
    }
  }
  return rules;
}

/** Gäller en media-fråga vid en given vyportsbredd? Bara px-villkor förekommer i huset. */
function mediaMatches(media: string | null, width: number): boolean {
  if (media === null) return true;
  const max = media.match(/max-width:\s*(\d+)px/);
  const min = media.match(/min-width:\s*(\d+)px/);
  if (max && width > Number(max[1])) return false;
  if (min && width < Number(min[1])) return false;
  return true;
}

function declarations(body: string): { property: string; value: string }[] {
  return body
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map((part) => {
      const colon = part.indexOf(":");
      return {
        property: part.slice(0, colon).trim().toLowerCase(),
        value: part.slice(colon + 1).trim(),
      };
    })
    .filter((declaration) => declaration.property !== "");
}

function declaredValue(body: string, property: string): string | null {
  const found = declarations(body).filter((one) => one.property === property);
  return found.length === 0 ? null : found[found.length - 1].value;
}

/**
 * Vad en egenskap FAKTISKT står på för en väljare vid en given bredd.
 *
 * Modellen är medvetet smal: jämförelsen görs bara mellan regler med EXAKT samma väljare, så
 * specificiteten är per definition lika och källordningen avgör — precis som i webbläsaren.
 * Den används därför bara där rummet skriver om sin egen regel i ett annat media-block.
 */
function effective(css: string, selector: string, property: string, width: number): string | null {
  const matching = parseRules(css)
    .filter((rule) => rule.selector === selector && mediaMatches(rule.media, width))
    .filter((rule) => declaredValue(rule.body, property) !== null);
  if (matching.length === 0) return null;
  return declaredValue(matching[matching.length - 1].body, property);
}

function pxValue(body: string, property: string): number | null {
  const value = declaredValue(body, property);
  if (value === null) return null;
  const match = value.match(/^(-?[\d.]+)px$/);
  return match ? Number(match[1]) : null;
}

/** Alla element som bär ett givet attribut, som hela öppningstaggar. */
function tagsWith(html: string, attribute: string): string[] {
  return html.match(new RegExp(`<[A-Za-z][^>]*${attribute}[^>]*>`, "g")) ?? [];
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

/* ── 0 · Mätaren mäter något ──────────────────────────────────────────────── */

test("ROOM-MOBIL-MÄTARE: CSS-läsaren läser husets egna stilark, med media-blocken genomskådade", () => {
  const stub = `
    .a { color: red; }
    @media (max-width: 719px) {
      .b { display: none; }
      .c, .d { gap: 4px; }
    }
    .e { gap: 8px; }
  `;
  const parsed = parseRules(stub);
  assert.deepEqual(
    parsed.map((rule) => [rule.selector, rule.media === null ? "-" : "mobil"]),
    [
      [".a", "-"],
      [".b", "mobil"],
      [".c", "mobil"],
      [".d", "mobil"],
      [".e", "-"],
    ],
    "läsaren tappar bort media-blockens gränser — varje mätare som vilar på den blir osann",
  );
  assert.equal(declaredValue(parsed[1].body, "display"), "none");

  // Media-frågorna utvärderas mot verkliga bredder, inte mot sin text.
  assert.equal(mediaMatches("@media (max-width: 719px)", VIEWPORTS.mobile), true);
  assert.equal(mediaMatches("@media (max-width: 719px)", VIEWPORTS.tablet), false);
  assert.equal(mediaMatches("@media (min-width: 960px)", VIEWPORTS.desktop), true);
  assert.equal(mediaMatches("@media (min-width: 960px)", VIEWPORTS.tablet), false);
  assert.equal(mediaMatches(null, VIEWPORTS.mobile), true);

  // Och läsaren hittar rummets och Maskinens verkliga regler.
  const room = parseRules(ROOM_CSS);
  const loop = parseRules(LOOP_CSS);
  assert.ok(room.length > 40, `hittade bara ${room.length} regler i ROOM_CSS`);
  assert.ok(loop.length > 40, `hittade bara ${loop.length} regler i LOOP_CSS`);
  assert.ok(
    room.some((rule) => rule.selector === ".rm-stage" && rule.media === null),
    "läsaren hittar inte scenen — ROOM_CSS läses fel",
  );
  assert.ok(
    room.some((rule) => rule.media !== null),
    "läsaren hittar inga media-regler — brytpunktsmätarna mäter ingenting",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * 1 · INGEN BRYTPUNKT DÖLJER EN BEVIS- ELLER UPPLYSNINGSYTA
 * ──────────────────────────────────────────────────────────────────────────── */

/** De sätt en yta kan försvinna på utan att raden syns i markupen. */
const HIDING_DECLARATIONS: { property: string; value: RegExp }[] = [
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
    HIDING_DECLARATIONS.some((hide) => {
      const value = declaredValue(rule.body, hide.property);
      return value !== null && hide.value.test(value);
    }),
  );
}

/**
 * De ENDA väljare som får dölja något i /loop-trädet, var och en med sitt skäl.
 *
 * Listan är avsiktligt kort. En post här är ett påstående om att det som döljs INTE är
 * information ur snapshoten, ur en validerad post eller ur controllerns svar.
 */
const HIDING_ALLOWED: { selector: string; why: string }[] = [
  {
    selector: ".rm-step-n",
    why:
      "ordningstalet är ett PÅSTÅENDE OM LAYOUTEN och döljs bara i de vyer där banorna inte " +
      "längre står i den ordningen. Namnet på steget står kvar i varje vy.",
  },
  {
    selector: ".rm-details > summary::-webkit-details-marker",
    why:
      "webbläsarens egen triangel, ersatt av upplysningsytans egen etikett «{ } rådata». " +
      "Summaryn själv döljs aldrig.",
  },
];

test("ROOM-MOBIL-DÖLJ: ingen regel — i något media-block — döljer en bevis- eller upplysningsyta", () => {
  const sheets = [
    { name: "ROOM_CSS", css: ROOM_CSS },
    { name: "LOOP_CSS", css: LOOP_CSS },
  ];

  const seen = new Set<string>();
  for (const sheet of sheets) {
    for (const rule of hidingRules(sheet.css)) {
      const allowed = HIDING_ALLOWED.find((entry) => entry.selector === rule.selector);
      assert.ok(
        allowed,
        `${sheet.name}: «${rule.selector}» döljs (${rule.body}) i ${rule.media ?? "basen"} — ` +
          "en yta som försvinner vid en brytpunkt är per definition skrivbordsbunden",
      );
      seen.add(rule.selector);
    }
  }

  // Ingen död post i listan: en tillåtelse utan verklig regel är en tillåtelse ingen har läst.
  for (const entry of HIDING_ALLOWED) {
    assert.ok(
      seen.has(entry.selector),
      `«${entry.selector}» står som tillåten att döljas men ingen regel gör det längre`,
    );
  }

  /*
    OCH DE YTOR SOM BÄR BEVISEN NÄMNS ALDRIG I EN DÖLJANDE REGEL — mätt på namnen, så att en
    framtida regel på en NY väljare i samma familj fälls även om den inte står i listan.
  */
  const EVIDENCE_TOKENS = [
    "rm-details",
    "rm-scroll-x",
    "mk-raw",
    "rm-ids",
    "rm-id",
    "rm-chain",
    "rm-entry",
    "rm-segment",
    "rm-attention",
    "rm-identity",
    "mk-event",
    "mk-note",
    "mk-hint",
    "mk-card",
    "mk-fields",
    "data-command-reason",
    "data-chain-evidence",
  ];
  for (const sheet of sheets) {
    for (const rule of hidingRules(sheet.css)) {
      if (rule.selector === ".rm-details > summary::-webkit-details-marker") continue;
      for (const token of EVIDENCE_TOKENS) {
        assert.ok(
          !rule.selector.includes(token),
          `${sheet.name}: «${rule.selector}» döljer en yta i bevisfamiljen «${token}»`,
        );
      }
    }
  }

  // LÖGNSTUB: exakt det brott mätaren finns för måste fällas av samma mätare.
  const stub = "@media (max-width: 719px) { .rm-details { display: none; } }";
  assert.deepEqual(
    hidingRules(stub).map((rule) => rule.selector),
    [".rm-details"],
    "mätaren ser inte ens en dold upplysningsyta i ett media-block",
  );
  const alsoCaught = "@media (max-width: 719px) { .rm-chain-hop { visibility: hidden; } }";
  assert.equal(hidingRules(alsoCaught).length, 1, "mätaren ser bara display: none");
  // NEGATIV KONTROLL: en vanlig layoutregel får aldrig läsas som ett döljande.
  assert.equal(hidingRules(".rm-x { display: grid; opacity: 1; max-height: 420px; }").length, 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 2 · MARKUPEN ÄR BRYTPUNKTSOBEROENDE — MEDIA-CSS ARRANGERAR, TAR ALDRIG BORT
 * ──────────────────────────────────────────────────────────────────────────── */

/** Egenskaper ett media-block får sätta. Allt annat är mer än en omarrangering. */
const ARRANGEMENT_PROPERTIES = [
  "display",
  "order",
  "height",
  "grid-column",
  "grid-template-columns",
  "gap",
  "padding",
  "align-items",
  "min-height",
  "min-width",
  "max-width",
  "flex-direction",
  "white-space",
  "overflow-wrap",
];

test("ROOM-MOBIL-MARKUP: samma markup i varje vy — media-CSS ordnar om, aldrig bort", () => {
  /*
    Steg 1: det finns ingen breddgren i koden. Utan en sådan KAN ingen yta väljas bort per vy,
    och påståendet "samma markup vid 390 som vid 1440" blir strukturellt sant i stället för
    ett löfte som måste kontrolleras med ögat.
  */
  const files = [
    ...roomSourceFiles(),
    {
      path: "components/loop/MaskinShell.tsx",
      source: readFileSync(join(REPO_ROOT, "components/loop/MaskinShell.tsx"), "utf8"),
    },
  ];
  assert.ok(files.length >= 8, `hittade inte rummets träd — mätaren mäter inget (${files.length})`);

  const WIDTH_BRANCHES: { pattern: RegExp; why: string }[] = [
    { pattern: /matchMedia/, why: "vy-fråga i skript" },
    { pattern: /innerWidth|outerWidth|clientWidth|offsetWidth/, why: "breddavläsning" },
    { pattern: /useMediaQuery|useBreakpoint/, why: "brytpunktskrok" },
    { pattern: /isMobile|isDesktop|isTablet/i, why: "vy-gren i data" },
    { pattern: /navigator\.userAgent/, why: "enhetsgissning" },
    { pattern: /"resize"|'resize'/, why: "omritning per bredd" },
  ];
  for (const { path, source } of files) {
    const code = stripComments(source);
    for (const rule of WIDTH_BRANCHES) {
      assert.ok(!rule.pattern.test(code), `${path}: ${rule.why} (${rule.pattern})`);
    }
  }
  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  const stubs = [
    "const wide = window.matchMedia('(min-width: 720px)').matches;",
    "const w = window.innerWidth;",
    "const cols = useMediaQuery();",
    "const isMobile = true;",
    "if (navigator.userAgent.includes('iPhone')) return null;",
    'window.addEventListener("resize", onResize);',
  ];
  for (let i = 0; i < WIDTH_BRANCHES.length; i += 1) {
    assert.ok(
      WIDTH_BRANCHES[i].pattern.test(stubs[i]),
      `mönstret för ${WIDTH_BRANCHES[i].why} fäller inte ens sin egen stubbe`,
    );
  }

  /*
    Steg 2: media-blocken sätter bara egenskaper som ARRANGERAR. En `content`-injektion, en
    `position: fixed` eller en `font-size: 0` hade kunnat ändra vad som FINNS eller läses i en
    vy utan att röra markupen — och då hade steg 1 inte längre räckt som bevis.
  */
  for (const sheet of [
    { name: "ROOM_CSS", css: ROOM_CSS },
    { name: "LOOP_CSS", css: LOOP_CSS },
  ]) {
    const inMedia = parseRules(sheet.css).filter((rule) => rule.media !== null);
    assert.ok(inMedia.length > 0, `${sheet.name} har inga media-regler — mätaren mäter ingenting`);
    for (const rule of inMedia) {
      for (const { property } of declarations(rule.body)) {
        /*
          MEDDELANDET ÄR DET FÖRSTA EN FRAMTIDA SKIVA LÄSER, så det säger vad som ska göras.
          Mätaren är en TRIPWIRE ÖVER EN ANNAN SKIVAS FIL (LOOP_CSS) och kan därför fällas av
          arbete som inte rör rummet alls — det är avsikten, men bara om den som fälls får veta
          vilket av två svar som gäller.
        */
        assert.ok(
          ARRANGEMENT_PROPERTIES.includes(property),
          `${sheet.name}: «${rule.selector}» sätter «${property}» i ${rule.media}.\n` +
            "ROOM-08 kräver att en brytpunkt ARRANGERAR om rummet, aldrig ändrar vad det " +
            "innehåller eller om något går att läsa.\n" +
            "GÖR SÅ HÄR — välj ett av två:\n" +
            `  1. Egenskapen bara arrangerar (som gap, order, padding): lägg till "${property}" ` +
            "i ARRANGEMENT_PROPERTIES i tests/loop/room-mobile.test.ts och skriv i samma commit " +
            "varför den inte kan dölja, kapa eller tysta en yta.\n" +
            "  2. Egenskapen kan ändra vad som FINNS eller LÄSES vid en viss bredd (display: none, " +
            "content, font-size: 0, position: fixed): då är det brottet mätaren finns för — flytta " +
            "regeln ut ur media-blocket i stället.",
        );
      }
    }
  }
  // LÖGNSTUB: en injicerad text i ett media-block ska fällas av samma mätare.
  const injected = parseRules('@media (max-width: 719px) { .rm-head::after { content: "mobil"; } }');
  assert.equal(injected.length, 1);
  assert.ok(
    !ARRANGEMENT_PROPERTIES.includes(declarations(injected[0].body)[0].property),
    "listan över arrangerande egenskaper släpper igenom en textinjektion",
  );

  /*
    Steg 3: alla rummets ytor finns i EN och samma markup. Listan är rummets fulla ytuppsättning
    — status, aktuell uppgift, orsakskedja, uppmärksamhet, kommandon, inlämningsingång, händelser
    och bevis — och den renderas en gång, inte en gång per vy.
  */
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  const SURFACES: { marker: string; what: string }[] = [
    { marker: 'data-factory-room-header="true"', what: "status (rummets huvud)" },
    { marker: 'data-run-status-bar="true"', what: "statusraden" },
    { marker: 'data-room-attention="true"', what: "BEHÖVER UPPMÄRKSAMHET" },
    { marker: 'data-work-composer="true"', what: "inlämningsingången" },
    { marker: 'data-room-composer-cta="true"', what: "vägen till /loop/mata" },
    { marker: 'data-column="backlog"', what: "kön" },
    { marker: 'data-task-focus-rail="true"', what: "aktuell uppgift" },
    { marker: 'data-column="current"', what: "uppgiftens kort" },
    { marker: 'data-identity-strip="true"', what: "identitetsremsan" },
    { marker: 'data-causal-chain="true"', what: "orsakskedjan" },
    { marker: 'data-chain-identifiers="true"', what: "kedjans identifierare" },
    { marker: 'data-chain-raw="true"', what: "kedjans rådata" },
    { marker: 'data-command-deck="true"', what: "kommandoytan" },
    { marker: 'data-output-tray="true"', what: "hyllan" },
    { marker: 'data-room-timeline="true"', what: "tidslinjen" },
    { marker: 'data-room-raw="true"', what: "tidslinjens rådata" },
    { marker: 'data-room-identifiers="true"', what: "identifierarna" },
    { marker: 'data-stream-source-boundary="true"', what: "gränsen mot live-ytan" },
    { marker: 'data-event-stream="true"', what: "strömpanelen" },
  ];
  for (const surface of SURFACES) {
    assert.ok(markup.includes(surface.marker), `${surface.what} (${surface.marker}) saknas i markupen`);
  }

  /*
    Och ytorna bärs inte av en klass som råkar finnas i CSS:en: varje `rm-`-klass som stilarket
    känner till och som rummet FAKTISKT använder finns i markupen. Det gör steg 1 mätbart även
    om någon i framtiden lägger till en yta utan dataattribut.
  */
  const usedClasses = new Set(
    [...markup.matchAll(/class="([^"]*)"/g)].flatMap((match) => match[1].split(/\s+/)),
  );
  for (const key of ["rm-room", "rm-head", "rm-attention", "rm-stage", "rm-lane", "rm-composer",
    "rm-identity", "rm-chain", "rm-timeline", "rm-details", "rm-scroll-x", "rm-step"]) {
    assert.ok(usedClasses.has(key), `klassen ${key} finns i stilarket men inte i markupen`);
  }

  /*
    BEVISREFERENSERNA ÄR EN AV DE YTOR ROOM-08 NAMNGER. Fixturens förvalda blick (p-205) bär
    inga referenser, och att mäta ytan där hade bevisat ingenting. Mätaren flyttar därför
    blicken till den uppgift fixturen FAKTISKT bär referenser för — samma rum, samma markup,
    bara en annan aktuell uppgift ur samma validerade snapshot.
  */
  const withEvidence = withoutStyles(renderRoom(snapshotFocusedOn(TASK_WITH_EVIDENCE)));
  assert.ok(
    withEvidence.includes('data-chain-evidence="true"'),
    `fixturens ${TASK_WITH_EVIDENCE} bär inga bevisreferenser längre — mätaren mäter fel uppgift`,
  );
  assert.ok(
    /data-chain-evidence-ref="[^"]+"/.test(withEvidence),
    "bevisreferensernas värden renderas inte",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * 3 · DEN ENKLA SPALTEN FÖLJER BERÄTTELSEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-ORDNING: vid 390 px är spalten huvud → uppmärksamhet → mata → arbete → hylla → ström", () => {
  /*
    Vid ≤719 px finns ingen scen kvar att ordna om i sidled: läsordningen ÄR layouten, och den
    ska vara rummets axel. `order: -1` från 959-blocket gäller även vid 390 px, så mätaren
    kontrollerar att rummet nollställer den — annars visar telefonen en tredje ordning som
    varken DOM:en eller stegetiketterna påstår.
  */
  assert.equal(effective(ROOM_CSS, ".rm-lane-focus", "order", VIEWPORTS.tablet), "-1",
    "arbetet ligger inte först på surfplattan — 959-regeln är borta och mätaren mäter fel sak");
  assert.equal(effective(ROOM_CSS, ".rm-lane-focus", "order", VIEWPORTS.mobile), "0",
    "fokusbanan ordnas om vid 390 px: inlämningen hamnar under en orsakskedja med elva hopp");
  assert.equal(effective(ROOM_CSS, ".rm-lane-focus", "order", VIEWPORTS.desktop), null,
    "scenen ordnas om på skrivbordet, där banorna redan står sida vid sida");

  /*
    Ingen ANNAN väljare får sätta order. En order på ett direkt barn till rummet ordnar om HELA
    rummet — det var så hyllan en gång hamnade efter live-panelen på mobilen. Samma lås som
    ROOM-01:s prov bär, mätt igen här eftersom det är exakt den här skivan som rör ordningen.
  */
  const ORDER_ALLOWED = [".rm-lane-focus", ".rm-lane > .mk-col"];
  const ordering = parseRules(ROOM_CSS).filter((rule) => declaredValue(rule.body, "order") !== null);
  assert.ok(ordering.length > 0, "stilarket sätter ingen order alls — mätaren mäter ingenting");
  for (const rule of ordering) {
    assert.ok(
      ORDER_ALLOWED.includes(rule.selector),
      `«${rule.selector}» sätter order utanför scenens egna barn (${rule.media ?? "basen"})`,
    );
  }

  /*
    Ordningstalet följer sanningen: dolt där arbetet lyfts först (720–959 px), synligt igen där
    spalten står i berättelsens ordning (≤719 px) och på skrivbordet.
  */
  assert.equal(effective(ROOM_CSS, ".rm-step-n", "display", VIEWPORTS.desktop), null);
  assert.equal(effective(ROOM_CSS, ".rm-step-n", "display", VIEWPORTS.tablet), "none");
  assert.equal(effective(ROOM_CSS, ".rm-step-n", "display", VIEWPORTS.mobile), "inline",
    "ordningstalet är dolt i den vy där ordningen FAKTISKT är 1, 2, 3");

  // Och DOM-ordningen — den ENDA ordningen som gäller när spalten är enkel — är axeln.
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  const at = (needle: string) => {
    const index = markup.indexOf(needle);
    assert.ok(index >= 0, `hittade inte «${needle}» i rummets markup`);
    return index;
  };
  const NARRATIVE = [
    'data-factory-room-header="true"',
    'data-run-status-bar="true"',
    'data-room-attention="true"',
    'data-work-composer="true"',
    'data-column="backlog"',
    'data-task-focus-rail="true"',
    'data-column="current"',
    'data-causal-chain="true"',
    'data-command-deck="true"',
    'data-output-tray="true"',
    'data-room-timeline="true"',
    'data-stream-source-boundary="true"',
    'data-event-stream="true"',
  ];
  const positions = NARRATIVE.map(at);
  for (let i = 1; i < positions.length; i += 1) {
    assert.ok(
      positions[i - 1] < positions[i],
      `${NARRATIVE[i]} ligger före ${NARRATIVE[i - 1]} — berättelsens ordning bryts i spalten`,
    );
  }

  // Scenen är fortfarande EN spalt vid 390 px och vid 900 px.
  for (const width of [VIEWPORTS.mobile, VIEWPORTS.tablet]) {
    assert.equal(
      effective(ROOM_CSS, ".rm-stage", "grid-template-columns", width),
      "minmax(0, 1fr)",
      `scenen är inte en enkel spalt vid ${width} px`,
    );
  }

  /*
    ETT PÅSTÅENDE OM LAYOUTEN FÅR INTE ÖVERLEVA DEN LAYOUT DET BESKRIVER.

    Samma doktrin som ordningstalet lyder under gäller filhuvudenas prosa: en bindande regel som
    säger "vid ≤959 px lägger sig rummets blick först" blev osann i samma commit som gav ≤719 px
    sin egen ordning, och en osann regel i ett filhuvud är värre än ingen — nästa läsare tror på
    den. Fragmenten nedan är EXAKT de formuleringar som blev osanna; mätaren är samma sort som
    ux-sweep-residuals R2 använder mot föråldrade påståenden om strömmen.
  */
  const STALE_LAYOUT_CLAIMS: { text: string; why: string }[] = [
    {
      text: "Vid ≤959 px lägger sig rummets blick först",
      why: "falskt vid ≤719 px, där ingången står först",
    },
    {
      text: "Under 960 px lägger sig ARBETET FÖRST",
      why: "falskt vid ≤719 px, där DOM-ordningen är återställd",
    },
    /*
      Samma drift, men inne i stilarket självt — och därför lättast att missa, eftersom prosan
      står bredvid regeln den beskriver.
    */
    {
      text: "Regeln som döljer det under 960 px står i media-blocket längst ned",
      why:
        "fel intervall (talet döljs bara i 720–959 px) OCH fel block: 959-blocket är inte längre " +
        "det sista sedan 719-blocket lades under det",
    },
    { text: "Arbetet först på smala vyer", why: "osant i den smalaste vyn av alla" },
    /*
      Den tredje sorten är den svåraste: en RIKTIG regel med en PÅHITTAD motivering. Regeln
      (order: -1 vid 720–959 px) är rätt, men skälet påstod ett rutnät som inte finns — scenen är
      EN spalt redan vid ≤959 px, vilket mätaren strax ovanför kräver vid 900 px. Ett påhittat
      skäl i ett filhuvud är det nästa läsare bygger vidare på.
    */
    {
      text: "ligger scenens två banor kvar som ett rutnät",
      why: "scenen är EN spalt vid ≤959 px — se mätningen av grid-template-columns vid 900 px",
    },
    {
      text: "vid sidan om blicken i ett halvbrett rutnät",
      why: "det finns inget halvbrett rutnät vid 720–959 px; spalten är hel",
    },
  ];
  /*
    RÄCKVIDDEN ÄR RUMMETS HELA TEXT, INTE BARA DESS PRODUKTFILER.

    Första versionen av den här mätaren läste bara components/loop/room/** och MaskinShell —
    och missade därmed att ROOM-01:s eget prov bar samma osanna mening om 960 px. Ett prov är
    också dokumentation: den som läser mätaren för att förstå regeln tror på dess kommentar.
    Räckvidden omfattar därför rummets prov med.

    UNDANTAGET ÄR DEN HÄR FILEN, och bara den: en mätare måste få stava ut de meningar den
    förbjuder. Samma resonemang som procent-/rörelsegrepet gör för sin egen provfil. Undantaget
    är en enda namngiven fil, inte ett mönster, så nästa provfil som skriver en osann mening
    fälls.
  */
  const roomTestFiles = readdirSync(join(REPO_ROOT, "tests/loop"), { encoding: "utf8" })
    .filter((name) => /^room.*\.test\.ts$/.test(name))
    .filter((name) => name !== "room-mobile.test.ts")
    .map((name) => ({
      path: `tests/loop/${name}`,
      source: readFileSync(join(REPO_ROOT, "tests/loop", name), "utf8"),
    }));
  assert.ok(
    roomTestFiles.some((file) => file.path === "tests/loop/room-shell.test.ts"),
    "rummets övriga prov hittades inte — prosamätaren mäter bara sig själv",
  );

  const prose = [
    ...roomSourceFiles(),
    ...roomTestFiles,
    {
      path: "components/loop/MaskinShell.tsx",
      source: readFileSync(join(REPO_ROOT, "components/loop/MaskinShell.tsx"), "utf8"),
    },
  ];
  /*
    JÄMFÖRELSEN ÄR SKIFTLÄGESOKÄNSLIG — OCH DET ÄR INTE EN DETALJ.

    Listan frös «Under 960 px lägger sig ARBETET FÖRST» ur RoomStep.tsx. Exakt samma påstående
    stod i ROOM-01:s prov med gemener («… lägger sig arbetet först») och gled rakt igenom en
    skiftlägeskänslig `includes`. En mätare som bara fäller den stavning den råkade se först
    mäter en stavning, inte ett påstående.
  */
  const says = (source: string, claim: string) =>
    source.toLocaleLowerCase("sv").includes(claim.toLocaleLowerCase("sv"));

  for (const { path, source } of prose) {
    for (const claim of STALE_LAYOUT_CLAIMS) {
      assert.ok(!says(source, claim.text), `${path} påstår «${claim.text}» — ${claim.why}`);
    }
  }
  // LÖGNSTUB: kontrollen måste fälla exakt den mening den finns för …
  for (const claim of STALE_LAYOUT_CLAIMS) {
    assert.ok(
      says(` * · ${claim.text} och banorna staplas i planens ordning.`, claim.text),
      "kontrollen fäller inte sin egen lögnstub",
    );
  }
  // … OCH samma mening i ett annat skiftläge, som är precis så den slank igenom en gång.
  assert.ok(
    says("Under 960 px lägger sig arbetet först, och då får etiketten inte påstå 1, 2, 3.",
      "Under 960 px lägger sig ARBETET FÖRST"),
    "mätaren fäller fortfarande bara en enda stavning av påståendet",
  );
  /*
    Och den nya prosan säger BÅDA intervallen: en fil som bara nämner det ena hade beskrivit
    halva sanningen lika tyst som den gamla beskrev fel sanning.
  */
  const shell = readFileSync(join(REPO_ROOT, "components/loop/MaskinShell.tsx"), "utf8");
  assert.match(shell, /720–959 px/, "skalet beskriver inte längre surfplattans ordning");
  assert.match(shell, /≤719 px/, "skalet beskriver inte telefonens ordning");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 4 · UPPLYSNINGSYTORNA GÅR ATT TRÄFFA MED EN TUMME
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-TRÄFFYTA: bevisens växlar är minst lika stora som rummets primära kontroll", () => {
  /*
    Måttet transkriberas inte: det LÄSES ur rummets egen primära kontroll. Byter `.rm-cta` höjd
    följer kravet med, och provet kan aldrig godkänna en träffyta som är mindre än den knapp
    rummet självt anser vara rätt storlek.
  */
  const cta = parseRules(ROOM_CSS).find((rule) => rule.selector === ".rm-cta" && rule.media === null);
  assert.ok(cta, "rummets primära kontroll finns inte — mätaren har inget mått att jämföra mot");
  const target = pxValue(cta.body, "height");
  assert.ok(target !== null && target >= 30, `.rm-cta har ingen läsbar höjd: ${cta.body}`);

  /** Den EFFEKTIVA träffytan för en väljare vid en bredd: största höjdmått som gäller där. */
  const hitArea = (css: string, selector: string, width: number): number | null => {
    const sizes = parseRules(css)
      .filter((rule) => rule.selector === selector && mediaMatches(rule.media, width))
      .flatMap((rule) => [pxValue(rule.body, "min-height"), pxValue(rule.body, "height")])
      .filter((value): value is number => value !== null);
    return sizes.length === 0 ? null : Math.max(...sizes);
  };

  /*
    NIVÅ 1 · RUMMETS EGNA VÄGAR TILL BEVISEN — RUMMETS KONTROLLHÖJD I VARJE VY.

    Växeln «{ } rådata» är för flera ytor den ENDA vägen till rådata, bevisreferenser och
    identifierare, och köns genväg är en av två vägar till inlämningen. En bevisytas åtkomlighet
    får inte bero på fönstrets bredd: måttet stod först bara i 959-blocket, och då fick en
    pekskärmsbärbar vid ≥960 px kvar 24 px för samma bevis. Kravet mäts därför vid ALLA TRE
    vyerna — och dessutom mäts att regeln är en BASREGEL, så att den inte kan smygas tillbaka
    in i en brytpunkt utan att mätaren säger till.
  */
  const ROOM_OWN_SURFACES = [
    { selector: ".rm-details > summary", what: "rådataväxeln i tidslinjen och kedjan" },
    { selector: '.rm-lane-in .mk-col [data-intake-cta="true"]', what: "köns genväg till inlämningen" },
  ];
  for (const surface of ROOM_OWN_SURFACES) {
    const base = parseRules(ROOM_CSS).filter(
      (rule) => rule.selector === surface.selector && rule.media === null,
    );
    const baseHeights = base
      .flatMap((rule) => [pxValue(rule.body, "min-height"), pxValue(rule.body, "height")])
      .filter((value): value is number => value !== null);
    assert.ok(
      baseHeights.length > 0 && Math.max(...baseHeights) >= target,
      `${surface.what} (${surface.selector}) har sin träffyta i en BRYTPUNKT i stället för i ` +
        "basregeln — då beror åtkomsten till ett bevis på fönstrets bredd",
    );
    for (const width of Object.values(VIEWPORTS)) {
      const size = hitArea(ROOM_CSS, surface.selector, width);
      assert.ok(size !== null, `${surface.what} har ingen mätbar träffyta vid ${width} px`);
      assert.ok(
        size >= target,
        `${surface.what} är ${size}px vid ${width} px — mindre än rummets egen kontroll (${target}px)`,
      );
    }
  }

  /*
    NIVÅ 2 · HUSETS EGNA KOMPONENTER INUTI RUMMET — LYFTA I DE SMALA VYERNA, GOLV I ALLA.

    Väljarna träffar i rummet kommandoytans tre typade knappar (CommandButton ur V7:s
    kommandoyta) och strömpanelens växlar (V9) — de senare både panelens egen kontrollrad
    (språkparet [sv] / [raw event_type] och pausa/återuppta autoskroll, som väljer visning och
    filtrerar ingenting) OCH varje rads egen {}-växel, som är den enda dörren till händelsens
    råa nyttolast. Att en av dem bär ett bevis skrivs ut i stället för att rundas av: rummet
    lyfter dem där pekdonet sannolikt är en tumme, men skriver INTE om deras skrivbordsform från
    sitt eget stilark — samma gräns som gäller strömmens rådataruta.

    Att det ändå är säkert mäts i stället för att påstås: skrivbordshöjden LÄSES UR LOOP_CSS och
    jämförs med WCAG 2.5.8:s golv, så en framtida förtätning av husets knapp fäller den här
    mätaren i stället för att tyst ta med sig rummet — och radens väg till rådatan — under kravet.
  */
  const WCAG_MIN_TARGET_PX = 24;
  const HOUSE_SURFACES = [
    { room: ".rm-room .mk-button", house: ".mk-button", what: "kommandoytans typade knappar" },
    {
      room: ".rm-room .mk-toggle",
      house: ".mk-toggle",
      what: "strömpanelens kontrollrad och radernas {}-växlar",
    },
  ];
  for (const surface of HOUSE_SURFACES) {
    for (const width of [VIEWPORTS.mobile, VIEWPORTS.tablet]) {
      const size = hitArea(ROOM_CSS, surface.room, width);
      assert.ok(
        size !== null && size >= target,
        `${surface.what} är ${size}px vid ${width} px — mindre än rummets egen kontroll (${target}px)`,
      );
    }
    const desktop = hitArea(LOOP_CSS, surface.house, VIEWPORTS.desktop);
    assert.ok(
      desktop !== null,
      `${surface.house} har ingen mätbar höjd i LOOP_CSS — skrivbordsgolvet kan inte prövas`,
    );
    assert.ok(
      desktop >= WCAG_MIN_TARGET_PX,
      `${surface.what} är ${desktop}px på skrivbordet (ur LOOP_CSS) — under WCAG 2.5.8:s golv ` +
        `${WCAG_MIN_TARGET_PX}px.\nRummet lyfter husets komponenter bara i de smala vyerna, med ` +
        "flit. Sjunker husets egen höjd under golvet måste antingen LOOP_CSS rättas av den skiva " +
        "som äger komponenten, eller lyftet flyttas till rummets basregel.",
    );
    assert.ok(
      hitArea(ROOM_CSS, surface.room, VIEWPORTS.desktop) === null,
      `rummet skriver om ${surface.house} även på skrivbordet — det är en annan skivas provade yta`,
    );
  }

  // De ytorna renderas också — annars vore regeln en regel om ingenting.
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  assert.ok(markup.includes("<summary>"), "rådataväxeln renderas inte");
  assert.ok(markup.includes('data-intake-cta="true"'), "köns genväg renderas inte");
  assert.ok(markup.includes('class="mk-button"'), "kommandoytans knappar renderas inte");

  /*
    VÄLJARNAS RÄCKVIDD MÄTS, DEN PÅSTÅS INTE.

    ROOM_CSS:s 959-block skriver ut VILKA ytor «.rm-room .mk-button, .rm-room .mk-toggle»
    faktiskt når. En sådan uppräkning är en påstådd räckvidd, och en påstådd räckvidd ruttnar
    tyst: monteras en fjärde komponent med husets knappklass i rummet, eller flyttar strömmens
    kontrollrad, blir kommentaren fel utan att något faller. Räckvidden läses därför ur
    RENDERAD markup: varje mk-knapp i rummet ska bära kommandoknappens egen krok, och varje
    mk-växel ska bära strömpanelens.
  */
  const houseTags = tagsWith(markup, 'class="[^"]*mk-(?:button|toggle)').filter((tag) => {
    const classes = (attr(tag, "class") ?? "").split(/\s+/);
    return classes.includes("mk-button") || classes.includes("mk-toggle");
  });
  assert.ok(houseTags.length > 0, "rummet renderar ingen av husets knappar — mätaren mäter tomt");
  for (const tag of houseTags) {
    const classes = (attr(tag, "class") ?? "").split(/\s+/);
    if (classes.includes("mk-button")) {
      assert.ok(
        attr(tag, "data-command-sending") !== null,
        "en «.mk-button» i rummet kommer INTE ur kommandoytans CommandButton — då är 959-blockets " +
          "uppräkning av vad väljaren når inte längre sann, och lyftet gäller en yta ingen granskat:\n" +
          tag,
      );
    } else {
      const streamHooks = [
        "data-stream-language",
        "data-stream-raw-toggle",
        "data-stream-autoscroll",
        "data-event-json-toggle",
      ];
      assert.ok(
        streamHooks.some((hook) => attr(tag, hook) !== null),
        "en «.mk-toggle» i rummet sitter utanför strömpanelen — 959-blockets uppräkning stämmer " +
          "inte längre:\n" +
          tag,
      );
    }
  }

  /*
    RADENS EGEN «{ }»-VÄXEL MÄTS I KÄLLAN, INTE I MARKUPEN — OCH SKÄLET SKRIVS UT.

    Strömmen är tom i en serverrendering (raden kommer ur tail-anslutningen i webbläsaren), så
    ingen EventRow finns i markupen ovan. Att uppräkningens andra växel FINNS, bär husets klass
    och är händelsens rådatadörr läses därför ur EventRow.tsx. Byter den fil klass eller krok
    faller mätaren i stället för att kommentaren tyst blir fel.
  */
  const eventRowSource = readFileSync(join(REPO_ROOT, "components/loop/EventRow.tsx"), "utf8");
  assert.match(
    eventRowSource,
    /className="mk-toggle"[\s\S]{0,240}data-event-json-toggle/,
    "EventRow:s rådataväxel bär inte längre husets «.mk-toggle» med sin egen krok — 959-blockets " +
      "andra uppräknade yta stämmer då inte, och radens väg till rådatan lyfts inte längre i de " +
      "smala vyerna",
  );

  // LÖGNSTUB: en för liten träffyta ska fällas av samma jämförelse.
  const tooSmall = pxValue("min-height: 20px;", "min-height");
  assert.ok(tooSmall !== null && tooSmall < target, "jämförelsen skulle godta en 20px-yta");
  assert.ok(tooSmall !== null && tooSmall < WCAG_MIN_TARGET_PX, "golvmätaren skulle godta 20px");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 5 · INGEN SIDLED-SCROLL PÅ SIDNIVÅ — BRED TEKNISK TEXT BÄR SIN EGEN BEHÅLLARE
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-BREDD: bred mono-text bryts eller scrollar i sin egen behållare", () => {
  /*
    MÄTAREN GÄLLER ÖPPNAT LÄGE, INTE BARA HOPFÄLLT — OCH DET ÄR INTE EN TILLFÄLLIGHET.

    Ett <details> renderar sina barn i markupen oavsett om det är öppet: `open` styr visningen,
    inte trädet. Rådatan nedan är alltså EXAKT den text som blir synlig när granskningens
    «evidence-open»-läge slår upp ytorna, och de mätningar som följer — varje <pre> i sin egen
    behållare, ombrytning vid 390 px, inga fasta bredder, ingen «nowrap» utanför en låst lista —
    gäller därför det öppnade rummet lika mycket som det hopfällda.

    VAD DEN HÄR MÄTAREN ÄNDÅ INTE KAN: den läser regler, inte pixlar. Att ingen faktisk
    sidled-scroll uppstår i en webbläsare med alla ytor öppna är ett EMPIRISKT påstående, och det
    prövas först när «evidence-open»-klippen finns. Mätaren tar bort ORSAKERNA till felet; den
    ersätter inte observationen av att felet uteblir.
  */
  const rules = parseRules(ROOM_CSS);

  // Behållaren finns, och den scrollar bara sig själv.
  const scroll = rules.find((rule) => rule.selector === ".rm-scroll-x" && rule.media === null);
  assert.ok(scroll, "behållaren för bred teknisk text finns inte längre");
  assert.equal(declaredValue(scroll.body, "overflow-x"), "auto");
  assert.equal(declaredValue(scroll.body, "min-width"), "0");

  /*
    ALLT som renderas med `white-space: pre` (Maskinens `.mk-raw`) ligger i den behållaren.
    Annars hade en bred JSON-rad tryckt ut sidan i sidled i stället för sig själv.
  */
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  const pres = markup.match(/<pre\b[^>]*>/g) ?? [];
  assert.ok(pres.length > 0, "rummet renderar ingen rådata — mätaren mäter ingenting");
  for (const pre of pres) {
    assert.ok(
      (attr(pre, "class") ?? "").split(/\s+/).includes("rm-scroll-x"),
      `en rådatayta saknar egen behållare: ${pre}`,
    );
  }

  // Vid 390 px BRYTS rådatan i stället: ingen horisontell scroll inuti en vertikal.
  for (const selector of ['.rm-details > .mk-raw', '.rm-room .mk-raw[data-event-raw="true"]']) {
    assert.equal(
      effective(ROOM_CSS, selector, "white-space", VIEWPORTS.mobile),
      "pre-wrap",
      `${selector} bryts inte vid 390 px`,
    );
    assert.equal(
      effective(ROOM_CSS, selector, "overflow-wrap", VIEWPORTS.mobile),
      "anywhere",
      `${selector} bryter inte långa tecken vid 390 px`,
    );
    assert.equal(
      effective(ROOM_CSS, selector, "white-space", VIEWPORTS.desktop),
      null,
      `${selector} ändrar Maskinens form även på skrivbordet — skivan rör mer än mobilen`,
    );
  }

  /*
    ALL RÅDATA BRYTS REDAN VID 900 PX, INTE FÖRST VID 390 — OCH BÅDA RUTORNA VID SAMMA BREDD.

    Rummet är en enda spalt redan vid ≤959 px (mätt ovan på grid-template-columns), och då finns
    ingen bredd kvar att panorera i. En horisontell panorering inuti en vertikal scroll är den
    sämsta vägen genom ett bevis som finns, och den ska upphöra där rummet blir smalt — inte en
    brytpunkt senare.

    ATT RUTORNA HAR OLIKA VÄGAR UT ÄR INTE ETT SKÄL ATT GE DEM OLIKA BRYTPUNKT. Rummets egna
    rutor är fokuserbara och scrollar med tangentbord; strömmens ägs av EventRow (utanför
    skrivrätten) och kan inte få ett tabindex, så för den är en kvarvarande panorering värre.
    Den skillnaden avgör hur allvarligt ett kvarstående behov är, inte var behovet upphör.
    Mätaren låser därför fast SAMMA brytpunkt för båda: den asymmetri som lämnade surfplattan
    med en pekarpanorering genom kedjans rådata (granskningens ROOM08-VIS-TABLET-RAW-CLIP) kan
    inte komma tillbaka utan att fällas här.
  */
  for (const selector of ['.rm-details > .mk-raw', '.rm-room .mk-raw[data-event-raw="true"]']) {
    assert.equal(
      effective(ROOM_CSS, selector, "white-space", VIEWPORTS.tablet),
      "pre-wrap",
      `${selector} kräver pekarpanorering vid 900 px, där rummet redan är en spalt`,
    );
    assert.equal(
      effective(ROOM_CSS, selector, "overflow-wrap", VIEWPORTS.tablet),
      "anywhere",
      `${selector} bryter inte långa tecken vid 900 px`,
    );
  }

  /*
    Ingen bredd i rummets stilark kan spränga en 390 px-vy. Måtten är fr/minmax/ch/px, och de
    px-mått som finns är kontrollhöjder och hårfina kanter — aldrig en fast bredd.
  */
  for (const rule of rules) {
    for (const property of ["width", "min-width"]) {
      const value = pxValue(rule.body, property);
      if (value === null) continue;
      assert.ok(
        value < VIEWPORTS.mobile - 40,
        `«${rule.selector}» sätter ${property}: ${value}px — sidan scrollar i sidled vid 390 px`,
      );
    }
  }

  /*
    `nowrap` är den andra vägen till sidled-scroll. Den tillåts bara på ett kort märke som per
    definition inte kan bli bredare än sin egen etikett.
  */
  const NOWRAP_ALLOWED = [".rm-id-origin"];
  for (const rule of rules) {
    if (declaredValue(rule.body, "white-space") !== "nowrap") continue;
    assert.ok(
      NOWRAP_ALLOWED.includes(rule.selector),
      `«${rule.selector}» förbjuder radbrytning — bred text trycker då ut sidan`,
    );
  }

  /*
    OCH DET ÄRVDA `nowrap`:et SLÄPPS DÄR DET INTE LÄNGRE HÅLLER.

    Husets märke bär nowrap i LOOP_CSS — riktigt för korta tillstånd, men rummet renderar också
    tidslinjens statusetiketter. Den längsta i fixturen mäts här i stället för att antas: ett
    märke som varken får brytas eller krympa trycker ut sin rad, sin behållare och till slut
    sidan vid 390 px.
  */
  const badgeTexts = [...markup.matchAll(/<span[^>]*class="[^"]*mk-badge[^"]*"[^>]*>([\s\S]*?)<\/span>/g)]
    .map((match) => match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
  assert.ok(badgeTexts.length > 0, "rummet renderar inga märken — mätaren mäter ingenting");
  const longest = badgeTexts.reduce((a, b) => (b.length > a.length ? b : a));
  assert.ok(
    longest.length > 30,
    `längsta märket är bara ${longest.length} tecken («${longest}») — mätaren mäter fel risk`,
  );
  assert.match(
    LOOP_CSS,
    /\.mk-badge\s*\{[^}]*white-space:\s*nowrap/,
    "Maskinens märke bär inte längre nowrap — rummets nollställning är då onödig och ska bort",
  );
  assert.equal(
    effective(ROOM_CSS, ".rm-room .mk-badge", "white-space", VIEWPORTS.mobile),
    "normal",
    `märket «${longest}» får inte brytas vid 390 px och trycker då ut sidan i sidled`,
  );
  assert.equal(
    effective(ROOM_CSS, ".rm-room .mk-badge", "white-space", VIEWPORTS.desktop),
    null,
    "rummet skriver om Maskinens märke även på skrivbordet — skivan rör mer än mobilen",
  );

  /*
    Och de ytor som BÄR de långa strängarna (identifierare, SHA:er, uppgiftstitlar) bryter dem.
    Utan det hade en enda oavbruten sträng varit bredare än en telefon.
  */
  for (const selector of [".rm-id-value", ".rm-attention-ids", ".rm-entry-title",
    ".rm-chain-hop-title", ".rm-head-intro"]) {
    const rule = rules.find((one) => one.selector === selector && one.media === null);
    assert.ok(rule, `${selector} finns inte längre — mätaren mäter fel yta`);
    assert.equal(
      declaredValue(rule.body, "overflow-wrap"),
      "anywhere",
      `${selector} bryter inte långa strängar`,
    );
  }

  /*
    EN ÖPPNAD UPPLYSNINGSYTA FÅR INTE KLIPPAS AV NÅGON FÖRÄLDER.

    Rådatan ligger flera behållare in (li → ul → div → section). Sätter någon av dem
    overflow: hidden försvinner slutet av en bred rad tyst — ingen scroll, ingen antydan, bara
    borta. Rummet sätter därför ingen klippning alls; strömmens egen (.mk-stream-rows i
    LOOP_CSS) är en annan skivas yta och har sin egen vertikala väg genom raderna.
  */
  for (const rule of rules) {
    for (const property of ["overflow", "overflow-x", "overflow-y"]) {
      const value = declaredValue(rule.body, property);
      if (value === null) continue;
      assert.ok(
        value !== "hidden" && value !== "clip",
        `«${rule.selector}» klipper innehåll (${property}: ${value}) — en öppnad bevisyta kan tystna`,
      );
    }
  }
  // LÖGNSTUB: samma mätare måste fälla en klippande regel.
  const clipping = parseRules(".rm-entry { overflow: hidden; }")[0];
  assert.equal(declaredValue(clipping.body, "overflow"), "hidden", "mätaren ser inte en klippning");

  // Strömmens metarad kan inte klippas bort i rummets smala vy.
  const meta = rules.find((one) => one.selector === ".rm-room .mk-event-meta > *");
  assert.ok(meta, "strömmens identifierare saknar räckviddsregel i rummet");
  assert.equal(declaredValue(meta.body, "overflow-wrap"), "anywhere");
  assert.equal(declaredValue(meta.body, "min-width"), "0");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6 · FOKUS SYNS PÅ ALLT RUMMET GÖR FOKUSERBART
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-FOKUS: varje fokuserbar yta rummet inför bär en synlig ring", () => {
  const escapeSelector = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const selector of [".rm-cta", ".rm-details > summary", ".rm-scroll-x",
    '.rm-lane-in .mk-col [data-intake-cta="true"]']) {
    assert.match(
      ROOM_CSS,
      new RegExp(`${escapeSelector(selector)}:focus-visible\\s*\\{[^}]*box-shadow:\\s*var\\(--focus-ring\\)`),
      `${selector} saknar synlig fokusring`,
    );
  }
  // Husets egna kontroller i rummet bär sin ring i LOOP_CSS — den får inte tappas bort där.
  for (const selector of [".mk-button", ".mk-toggle"]) {
    assert.match(
      LOOP_CSS,
      new RegExp(`${escapeSelector(selector)}:focus-visible\\s*\\{[^}]*box-shadow:\\s*var\\(--focus-ring\\)`),
      `${selector} saknar synlig fokusring`,
    );
  }

  /*
    EKVIVALENS, INTE BARA IMPLIKATION.

    En scrollyta utan tabindex går bara att nå med pekare — och en fokuserbar yta som inte är
    en scrollyta är en tom station i tabbordningen. Båda riktningarna mäts därför:

      · VARJE `.rm-scroll-x` i markupen är fokuserbar. Den riktningen saknades först, och då
        slapp controllerns ordagranna avslag (data-rejection-verbatim) igenom: `.mk-raw` bär
        max-height + overflow-y: auto, så ett långt avslag scrollar VERTIKALT i sin egen
        behållare i varje vy — bevis som krävde mus, i alla bredder.
      · VARJE fokuserbar yta rummet inför är en `.rm-scroll-x` med ring, så ingen fokusfälla
        smyger in bakvägen.

    Mätningen görs på TVÅ renderingar, eftersom de bär olika bevisytor: förvald blick (avslaget
    i tidslinjen) och den uppgift vars kedja bär bevisreferenser.
  */
  for (const snapshot of [snapshotOrThrow(), snapshotFocusedOn(TASK_WITH_EVIDENCE)]) {
    const markup = withoutStyles(renderRoom(snapshot));

    const scrollContainers = markup.match(/<[A-Za-z][^>]*class="[^"]*rm-scroll-x[^"]*"[^>]*>/g) ?? [];
    assert.ok(scrollContainers.length > 0, "rummet renderar ingen egen scrollbehållare");
    for (const tag of scrollContainers) {
      assert.equal(
        attr(tag, "tabindex"),
        "0",
        `en scrollbehållare går bara att nå med pekare: ${tag}`,
      );
    }

    const focusable = tagsWith(markup, 'tabindex="0"');
    assert.equal(
      focusable.length,
      scrollContainers.length,
      "antalet fokuserbara ytor och scrollbehållare skiljer sig — någon av dem är fel yta",
    );
    for (const tag of focusable) {
      assert.ok(
        (attr(tag, "class") ?? "").split(/\s+/).includes("rm-scroll-x"),
        `en fokuserbar yta är inte en scrollbehållare: ${tag}`,
      );
    }
    assert.equal(
      (markup.match(/tabindex="-1"/g) ?? []).length,
      0,
      "en yta har tagits ur tabbordningen",
    );
  }

  /*
    FOKUSLÄGET SKILJER SIG I FORM, INTE BARA I FÄRG.

    Husets --focus-ring är en 1px kantlinje plus ett sken, och rådatarutans VILOLÄGE är redan en
    1px kantlinje. Hade rummet nöjt sig med ringen vore skillnaden mellan fokuserad och
    ofokuserad ruta bara kantens kulör — och «en kritisk skillnad som bärs av färg ensam» är en
    frusen negativ kontroll i ROOM-08, precis som «fokus syns inte». Mätaren jämför därför
    TJOCKLEKEN i vila (ur LOOP_CSS) med tjockleken i fokus (ur ROOM_CSS).
  */
  const insetWidths = (body: string) =>
    [...body.matchAll(/inset\s+0\s+0\s+0\s+(\d+)px/g)].map((match) => Number(match[1]));
  const restingRaw = parseRules(LOOP_CSS).find((rule) => rule.selector === ".mk-raw" && rule.media === null);
  assert.ok(restingRaw, "Maskinens rådataruta finns inte — mätaren har inget viloläge att jämföra mot");
  const focusedRaw = parseRules(ROOM_CSS).find(
    (rule) => rule.selector === ".rm-scroll-x:focus-visible" && rule.media === null,
  );
  assert.ok(focusedRaw, "scrollbehållarens fokusregel finns inte");
  const resting = Math.max(0, ...insetWidths(restingRaw.body));
  const focused = Math.max(0, ...insetWidths(focusedRaw.body));
  assert.ok(
    focused > resting,
    `fokusringen är ${focused}px mot vilolägets ${resting}px — skillnaden bärs då av färg ensam`,
  );
  assert.match(
    focusedRaw.body,
    /var\(--focus-ring\)/,
    "fokusläget använder inte husets egen ring",
  );
  assert.match(
    focusedRaw.body,
    /var\(--border-stronger\)|var\(--border-strong\)/,
    "tjockleksmarkeringen använder en färg utanför husets tokens",
  );

  /*
    ETT FOKUSSTOPP UTAN NAMN ÄR EN TYST STATION.

    Varje fokuserbar bevisyta bär roll OCH namn, och namnet kommer ur postens eget id respektive
    hoppets art — aldrig ur en handskriven sträng. Mätaren bygger de förväntade namnen med
    komponenternas EGNA namnfunktioner, så att en ändrad formulering inte kan glida isär från
    provet utan att någon ser det.
  */
  const labelled = withoutStyles(renderRoom(snapshotOrThrow()));
  for (const tag of tagsWith(labelled, 'tabindex="0"')) {
    assert.equal(attr(tag, "role"), "group", `en fokuserbar bevisyta saknar roll: ${tag}`);
    const label = attr(tag, "aria-label");
    assert.ok(label !== null && label.trim() !== "", `en fokuserbar bevisyta saknar namn: ${tag}`);
    assert.match(label, /rullbar/, `namnet säger inte att ytan rullar: ${label}`);
  }
  const someEntry = tagsWith(labelled, 'data-room-entry="')
    .map((tag) => attr(tag, "data-room-entry"))
    .find((id): id is string => id !== null);
  assert.ok(someEntry, "tidslinjen renderar ingen post — namnmätaren mäter ingenting");
  assert.ok(
    labelled.includes(rawLabel(someEntry)),
    `rådatans namn bär inte postens id: ${rawLabel(someEntry)}`,
  );
  const someHop = tagsWith(labelled, "data-chain-raw-json=")
    .map((tag) => attr(tag, "data-chain-raw-json"))
    .find((kind): kind is string => kind !== null);
  assert.ok(someHop, "kedjan renderar ingen rådata — namnmätaren mäter ingenting");
  assert.ok(
    labelled.includes(chainRawLabel(someHop)),
    `kedjans rådata bär inte hoppets art: ${chainRawLabel(someHop)}`,
  );
  const rejection = tagsWith(labelled, 'data-rejection-verbatim="true"')[0];
  assert.ok(rejection, "fixturen bär inget ordagrant avslag — namnmätaren mäter ingenting");
  assert.match(
    attr(rejection, "aria-label") ?? "",
    /^Controllerns svar ordagrant/,
    "avslagsytan presenterar sig inte som controllerns eget svar",
  );

  /*
    Och avslagsytan mäts VID NAMN, inte bara som en i mängden: den är controllerns ordagranna
    svar, den enda scrollytan som inte ligger bakom ett <details>, och därför den som lättast
    glöms bort nästa gång någon rör tidslinjen.
  */
  const verbatim = tagsWith(withoutStyles(renderRoom(snapshotOrThrow())), 'data-rejection-verbatim="true"');
  assert.ok(verbatim.length > 0, "fixturen bär inget ordagrant avslag — mätaren mäter ingenting");
  for (const tag of verbatim) {
    assert.equal(attr(tag, "tabindex"), "0", `controllerns avslag kräver mus: ${tag}`);
    assert.ok((attr(tag, "class") ?? "").includes("rm-scroll-x"), `avslaget saknar egen behållare: ${tag}`);
  }

  /*
    DEN ENDA BEVISYTAN SOM ÄNNU INTE ÄR TANGENTBORDSNÅBAR — OCH EN MÄTARE SOM PENSIONERAR SIG
    SJÄLV NÄR DEN BLIR DET.

    Strömmens rådataruta (EventRow) ligger utanför skivans skrivrätt. Rummet tog bort BEHOVET av
    panorering vid ≤959 px, men vid ≥960 px behåller rutan Maskinens form och kan bara panoreras
    med pekare. Det är en känd, utskriven begränsning — inte en glömd.

    Mätaren nedan låser fast NULÄGET i stället för att beskriva det i prosa: den fäller så snart
    EventRow får sitt tabindex. Då är begränsningen borta, och texten i ROOM_CSS som beskriver
    den blir osann i samma stund — vilket är precis när någon ska tvingas radera den. En
    kvarstående-begränsning som ingen städar bort blir nästa slice's falska påstående.
  */
  const eventRow = readFileSync(join(REPO_ROOT, "components/loop/EventRow.tsx"), "utf8");
  assert.match(
    eventRow,
    /data-event-raw="true"/,
    "TRIPWIRE ÖVER EN ANNAN SKIVAS FIL: components/loop/EventRow.tsx renderar ingen rådataruta " +
      "längre. Ändrades strömraden med flit? Ta då bort både den här mätaren och stycket " +
      "«KVARSTÅENDE BEGRÄNSNING» i components/loop/room/ui.ts, som beskriver en yta som inte finns.",
  );
  const rawBox = eventRow.slice(eventRow.indexOf("<pre"), eventRow.indexOf("</pre>"));
  assert.ok(
    !/tabIndex/.test(rawBox),
    "TRIPWIRE ÖVER EN ANNAN SKIVAS FIL — OCH DET ÄR GODA NYHETER: EventRow.tsx har fått " +
      "tabIndex på sin rådataruta, alltså är ROOM-08:s kvarstående begränsning löst.\n" +
      "GÖR EXAKT TVÅ ÄNDRINGAR:\n" +
      "  1. Radera stycket «KVARSTÅENDE BEGRÄNSNING …» i components/loop/room/ui.ts (det påstår " +
      "från och med nu något osant om strömmens ruta).\n" +
      "  2. Radera den här mätaren och dess ROOM_CSS-kontroll i tests/loop/room-mobile.test.ts.\n" +
      "Inget annat behöver röras: rummets egna rutor är redan fokuserbara och namngivna.",
  );
  assert.match(
    ROOM_CSS,
    /KVARSTÅENDE BEGRÄNSNING/,
    "Stycket «KVARSTÅENDE BEGRÄNSNING» är borta ur ROOM_CSS medan strömmens rådataruta " +
      "fortfarande saknar tabIndex i components/loop/EventRow.tsx.\n" +
      "En begränsning som slutar stå utskriven blir en glömd begränsning.\n" +
      "GÖR SÅ HÄR — välj ett av två:\n" +
      "  1. Begränsningen finns kvar: skriv tillbaka stycket i components/loop/room/ui.ts.\n" +
      "  2. Den är löst: ge EventRow.tsx:s <pre data-event-raw> tabIndex={0}, role=\"group\" och " +
      "aria-label — då faller mätaren ovan i stället och talar om vad som ska raderas.",
  );
  /*
    LÖGNSTUB: EventRow ligger utanför skrivrätten och får inte muteras ens tillfälligt för att
    prova mätaren, så uppslaget provas mot en stubbe med exakt den form lösningen kommer att ha.
  */
  const solved = '<pre className="mk-raw" id={jsonId} data-event-raw="true" tabIndex={0}>x</pre>';
  assert.ok(
    /tabIndex/.test(solved.slice(solved.indexOf("<pre"), solved.indexOf("</pre>"))),
    "mätaren skulle inte märka att begränsningen blivit löst",
  );

  /*
    Att behållaren FAKTISKT kan scrolla vertikalt är LOOP_CSS:s sak, och det är hela skälet till
    att den måste vara fokuserbar. Slutar `.mk-raw` scrolla ska den här mätaren skrivas om — inte
    tystas.
  */
  assert.match(
    LOOP_CSS,
    /\.mk-raw\s*\{[^}]*max-height:\s*\d+px[^}]*\}/,
    "`.mk-raw` har ingen höjdgräns längre — kravet på fokuserbar scroll ska då omprövas",
  );
  assert.match(LOOP_CSS, /\.mk-raw\s*\{[^}]*overflow-y:\s*auto/, "`.mk-raw` scrollar inte längre vertikalt");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6b · BEVISFÅNGSTENS KONTRAKT — de lägen skärmklippen måste kunna visa
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Väljarna en skärmklippsomgång behöver för att visa de två lägen som de frusna kontrollerna
 * är känsligast för: en ÖPPNAD upplysningsyta och en FOKUSERAD rådataruta.
 *
 * Varför de står i ett prov och inte bara i en rapport: en granskning som bara ser hopfällda
 * ytor kan inte uttala sig om «bevis på mobilen» alls. Fångstsidan av det problemet är löst
 * utanför rummet (FACTORY-VISUAL-CAPTURE-V1 i scripts/claude-loop/**: varje vy fotograferas
 * numera både som hel sida och som vyklipp, och en uppgift får deklarera `captureStates` som
 * öppnar alla `details` och parkerar tangentbordsfokus på en namngiven väljare). Kvar för
 * rummet står den enda halva rummet FAKTISKT äger: att de väljarna fortsätter träffa. Byter
 * någon namn på en krok, eller skjuter in en behållare mellan upplysningsytan och dess summary,
 * ska provet säga det — i stället för att nästa omgång tyst fångar fel yta.
 */
const CAPTURE_HOOKS = [
  {
    selector: '[data-room-raw="true"] > summary',
    what: "tidslinjens rådataväxel — öppnad före klippet så att JSON:en syns ombruten",
  },
  {
    selector: '[data-chain-raw="true"] > summary',
    what: "orsakskedjans rådataväxel — samma sak, för ett hopp med SHA:er och bevisreferenser",
  },
  {
    selector: "pre.rm-scroll-x",
    what: "rådatarutan bakom växeln: den fokuserbara ytan vars ring klippet ska visa",
  },
] as const;

test("ROOM-MOBIL-BEVISFÅNGST: de lägen granskningen behöver går att nå med stabila krokar", () => {
  /*
    VAD SKÄRMKLIPPEN SKA VISA — OCH VEM SOM GÖR VAD.

    Fångstsidan ägs av scripts/claude-loop/visual-review.ts och är utanför den här skivans
    skrivrätt. Den bär sedan FACTORY-VISUAL-CAPTURE-V1 tre saker den här skivan förlitar sig på:

      · ETT VYKLIPP PER VY vid sidan av helsidan («<vy>-<b>x<h>-clip.png»). Helsidan blir
        390x13000-och-något och skalas ned till några få bildpunkter per rad när någon tittar på
        den; läsbarhet, träffytor och fokusring kan bara bedömas i klippet. Helsidan bevisar
        layout och ordning, klippet bevisar allt annat.
      · `captureStates.openDisclosures`, som sätter `open` på VARJE `details` före klippet — det
        är så ytorna nedan fotograferas öppna i stället för hopfällda.
      · `captureStates.focusSelector`, som ger verkligt tangentbordsfokus på en namngiven väljare,
        så att klippet bär ett äkta `:focus-visible` i stället för en fokusring ingen kan se.

    Rummet lovar bara det rummet äger: att krokarna finns i markupen och har den form väljarna
    förutsätter. Att de fotograferas — och att bilderna visar det de ska — är granskningens sak,
    och tills den granskningen är gjord är «bevis på mobilen» prövat statiskt, inte visuellt.
  */
  const markup = withoutStyles(renderRoom(snapshotFocusedOn(TASK_WITH_EVIDENCE)));

  for (const hook of CAPTURE_HOOKS) {
    if (hook.selector === "pre.rm-scroll-x") {
      const boxes = markup.match(/<pre[^>]*class="[^"]*rm-scroll-x[^"]*"[^>]*>/g) ?? [];
      assert.ok(boxes.length > 0, `bevisfångsten tappade kroken «${hook.selector}» (${hook.what})`);
      continue;
    }
    /*
      Klickmålet är summaryn som är DIREKT BARN till upplysningsytan. Uppslaget mäter just den
      relationen — inte bara att båda taggarna finns någonstans — eftersom en inskjuten behållare
      hade brutit «>»-kombinatorn i receptet utan att någon märkte det.
    */
    const marker = hook.selector.slice(0, hook.selector.indexOf(" >"));
    const start = markup.indexOf(marker.replace(/^\[|\]$/g, ""));
    assert.ok(start >= 0, `bevisfångsten tappade kroken «${hook.selector}» (${hook.what})`);
    const afterTag = markup.indexOf(">", start) + 1;
    assert.ok(
      markup.slice(afterTag).trimStart().startsWith("<summary"),
      `«${hook.selector}» träffar inte längre: summaryn är inte direkt barn till upplysningsytan`,
    );
  }

  /*
    VARJE UPPLYSNINGSYTA ÄR ETT ÄKTA `details` — ANNARS NÅR «öppna allt» INTE ALLA.

    Fångstläget öppnar ytorna med en FAST fråga (`document.querySelectorAll('details')`). En
    egenbyggd växel — en knapp som slår om en klass, ett `aria-expanded` på en div — hade sett
    likadan ut i markupen och i granskningen, men blivit osynlig för den frågan: klippet hade
    då visat den ytan hopfälld och ingen hade vetat att just den inte öppnats. Mätaren låser
    därför fast att rummets bevisytor och `details`-elementen är EN och samma mängd.
  */
  const detailsTags = markup.match(/<details\b[^>]*>/g) ?? [];
  const disclosureTags = markup.match(/<[A-Za-z][^>]*class="[^"]*rm-details[^"]*"[^>]*>/g) ?? [];
  assert.ok(detailsTags.length > 0, "rummet renderar ingen upplysningsyta alls");
  assert.equal(
    disclosureTags.length,
    detailsTags.length,
    "en bevisyta är en egenbyggd växel i stället för ett <details> — fångstlägets «öppna alla " +
      "details» når den inte, och klippet visar den hopfälld utan att någon får veta det",
  );
  for (const tag of disclosureTags) {
    assert.ok(
      tag.startsWith("<details"),
      `en yta med klassen rm-details är inte ett <details>-element: ${tag}`,
    );
  }
  /*
    Och de är STÄNGDA i utgångsläget: det är ett medvetet val (bevisen ska inte dränka rummet),
    och det är just därför fångstläget «evidence-open» finns. Skulle någon lösa granskningens
    problem genom att öppna ytorna som standard vore det en produktändring smugen in genom en
    bevisdörr — mätaren gör den ändringen synlig i stället för tyst.
  */
  for (const tag of detailsTags) {
    assert.ok(!/\bopen\b/.test(tag), `en upplysningsyta är öppen som standard: ${tag}`);
  }

  // Och den vy receptet pekar ut bär FAKTISKT det svåraste innehållet: långa SHA:er i rådatan.
  const longToken = markup.match(/[0-9a-f]{40,}/);
  assert.ok(
    longToken,
    `${TASK_WITH_EVIDENCE} bär ingen lång oavbruten sträng — klippet skulle inte pröva ombrytningen`,
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * 6c · EN KORTAD SHA ÄR PRESENTATION — HELA VÄRDET MÅSTE FINNAS UTAN MUS
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-SHA: varje kortad identifierare har hela sitt värde i samma hopps rådata", () => {
  /*
    Kedjan visar SHA:er kortade och bär hela strängen i `title` (ROOM-03: trunkering är
    presentation, aldrig identitet). En TOUCH-enhet kan inte hovra fram en title — och «bevis
    som bara går att nå på skrivbordet» är en frusen negativ kontroll.

    Ytan räddas av att hela värdet står i hoppets EGEN rådata, som viker sig vid 390 px och är
    fokuserbar. Men det är ett PÅSTÅENDE tills det mäts: skulle rådatan någon gång kortas, eller
    en identifierare renderas utan att finnas i posten bakom sig, vore den kortade strängen det
    enda en telefon får se. Mätaren nedan gör mitigeringen till en mätbar invariant i stället för
    en observation i ett granskningsprotokoll.

    Den ersätter INTE en eventuell framtida förbättring (hela SHA:n ombruten i listan i stället
    för kortad). Den säkrar det som gäller idag: ingenting som visas kortat saknar sin fulla form
    utan mus.
  */
  const markup = withoutStyles(renderRoom(snapshotFocusedOn(TASK_WITH_EVIDENCE)));

  /** Ett hopps hela markup, från dess egen li fram till nästa hopps. */
  const hopBlocks = () => {
    const kinds = [...markup.matchAll(/data-chain-hop="([a-z_]+)"/g)];
    return kinds.map((match, index) => {
      const start = markup.lastIndexOf("<li", match.index);
      const next = kinds[index + 1];
      const end = next === undefined ? markup.length : markup.lastIndexOf("<li", next.index);
      return { kind: match[1], html: markup.slice(start, end) };
    });
  };

  const blocks = hopBlocks();
  assert.ok(blocks.length > 0, "kedjan renderar inga hopp — mätaren mäter ingenting");

  let measured = 0;
  for (const block of blocks) {
    /*
      Kortade värden känns igen på att det UTSKRIVNA värdet är en äkta förkortning av det värde
      elementet bär i data-value. Uppslaget läser alltså det UI:t faktiskt visar, inte en lista
      över vilka nycklar som brukar kortas.
    */
    for (const item of block.html.match(/<li[^>]*data-chain-id="[^"]*"[\s\S]*?<\/li>/g) ?? []) {
      const full = attr(item, "data-value");
      if (full === null || full.length < 12) continue;
      const shown = item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (shown.includes(full)) continue; // Värdet visas oavkortat: ingen risk.

      measured += 1;
      const rawStart = block.html.indexOf("data-chain-raw-json=");
      assert.ok(
        rawStart >= 0,
        `hoppet ${block.kind} visar ett kortat värde men har ingen rådata som bär hela: ${full}`,
      );
      assert.ok(
        block.html.slice(rawStart).includes(full),
        `hela värdet ${full} finns bara i title på hoppet ${block.kind} — en telefon kan inte ` +
          "hovra, och då är beviset skrivbordsbundet",
      );
      // Och title bär det fortfarande, för den som HAR en mus.
      assert.ok(item.includes(`title="${full}"`), `${full} tappade sin title på ${block.kind}`);
    }
  }
  assert.ok(
    measured > 0,
    "ingen identifierare renderas kortad i fixturen — mätaren mäter ingenting och måste skrivas om",
  );

  /*
    Rådatan är dessutom läsbar på en telefon: den bryter sina rader vid ≤959 px (mätt i
    ROOM-MOBIL-BREDD) och går att nå med tangentbord (ROOM-MOBIL-FOKUS). Här mäts bara det som
    är den här kontrollens egen sak — att värdet FINNS där.
  */
});

test("ROOM-MOBIL-LÄSBARHET: kedjans inledande notiser är egna stycken, inte ett textblock", () => {
  /*
    Notiserna ligger i en behållare inne i .rm-chain och bär margin: 0. Utan en egen spaltform
    får de ingen luft alls, och vid 390 px blir ingressen, ordningsnotisen och bevisnotisen ett
    femtontal solida rader före kedjans första hopp — sett i granskningens skärmklipp, inte
    gissat. Regeln är en BASREGEL: stycken ska vara stycken i varje vy.
  */
  const rule = parseRules(ROOM_CSS).find(
    (one) => one.selector === ".rm-chain > [data-chain-source]" && one.media === null,
  );
  assert.ok(rule, "kedjans inledning har ingen egen spaltform — notiserna rinner ihop igen");
  assert.equal(declaredValue(rule.body, "display"), "flex");
  assert.equal(declaredValue(rule.body, "flex-direction"), "column");
  const gap = pxValue(rule.body, "gap");
  const section = parseRules(ROOM_CSS).find(
    (one) => one.selector === ".rm-chain" && one.media === null,
  );
  assert.ok(section, "kedjans sektion finns inte");
  assert.equal(
    gap,
    pxValue(section.body, "gap"),
    "inledningens luft skiljer sig från sektionens — samma yta får inte ha två rytmer",
  );

  // Och behållaren finns FAKTISKT i markupen, som ett direkt barn till sektionen.
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));
  const chainStart = markup.indexOf('data-causal-chain="true"');
  assert.ok(chainStart >= 0, "orsakskedjan renderas inte");
  assert.ok(
    markup.indexOf('data-chain-source="fixture"', chainStart) > chainStart,
    "inledningens behållare renderas inte — regeln ovan träffar ingenting",
  );
  const notes = (markup.match(/<p class="rm-chain-note"/g) ?? []).length;
  assert.ok(notes >= 3, `kedjan renderar ${notes} notiser — mätaren mäter fel yta`);
});

/* ────────────────────────────────────────────────────────────────────────────
 * 7 · INGEN KRITISK SKILLNAD BÄRS AV FÄRG ENSAM
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-FÄRG: varje färgroll i rummet bärs också av text", () => {
  const markup = withoutStyles(renderRoom(snapshotOrThrow()));

  // Uppmärksamhetsposterna: färgrollen är ett tillägg till ett utskrivet märke och en klartext.
  const items = markup.match(/<li[^>]*data-attention-item="[^"]*"[\s\S]*?<\/li>/g) ?? [];
  assert.ok(items.length > 0, "fixturen ger ingen uppmärksamhetspost — mätaren mäter ingenting");
  const tones = new Set<string>();
  for (const item of items) {
    const tone = attr(item, "data-tone");
    assert.ok(tone !== null, `en uppmärksamhetspost saknar maskinläsbar färgroll: ${item}`);
    tones.add(tone);
    const text = item.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    assert.ok(text.length > 20, `posten bär ingen klartext, bara färg: ${item}`);
    assert.ok(
      /BEHÖVER SPEC|STOPPAD|NEEDS_SPEC|STOPPED/.test(text),
      `posten säger inte i text vad färgen betyder: ${text}`,
    );
  }
  assert.ok(tones.size > 1, "alla poster delar färgroll — skillnaden kan inte bäras av något");

  // Kedjans hopp: närvaro och frånvaro skiljs av ORD (ROT/BUNDEN/—), inte av ton.
  const badges = tagsWith(markup, "data-chain-badge");
  assert.ok(badges.length > 0, "kedjan renderar inga hopp");
  const present = badges.filter((tag) => attr(tag, "data-chain-badge") === "present");
  assert.ok(present.length > 0, "inget närvarande hopp — mätaren mäter ingenting");
  assert.ok(markup.includes(MISSING), "det frånvarande hoppets em-streck saknas i markupen");
  assert.ok(/>ROT<|>BUNDEN</.test(markup), "bindningen står bara som färg, aldrig som ord");

  // Fixtur mot live: skillnaden står som ord, inte som nyans.
  assert.ok(markup.includes("FIXTUR"), "fixturmärket saknas");

  // Och den avstängda knappen är avstängd i markupen, inte bara i tonen.
  assert.ok(markup.includes('aria-disabled="true"'), "den stängda kanalen syns bara som färg");
});

/* ────────────────────────────────────────────────────────────────────────────
 * 8 · INGEN DOLD AUTHORITY-ÄNDRANDE HANDLING — KANALEN ÄR STÄNGD, ORDAGRANT
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-SÄKERHET: mobilen når samma stängda kanal, med samma ordagranna orsak", () => {
  /*
    ROOM-08:s säkerhetskrav är att ingen authority-ändrande handling går att nå utan samma
    bekräftelseyta som skrivbordet visar. Idag finns ingen sådan handling alls: kommandokanalen
    är stängd (COMMAND_QUEUE_TRANSPORT = NONE, backend S13 saknas). Kravet uppfylls därför genom
    att det INTE FINNS någon väg — och den här mätaren finns för att det ska förbli så när
    rummet blir mobilt.
  */
  assert.equal(COMMAND_QUEUE_TRANSPORT, "NONE");
  assert.equal(commandChannelEnabled(), false);

  const markup = withoutStyles(renderRoom(snapshotOrThrow()));

  // Orsaken står ORDAGRANT i den markup mobilen får — inte i en skrivbordsvariant.
  assert.ok(
    markup.includes(COMMAND_QUEUE_DISABLED_REASON),
    "den ordagranna orsaken till att kanalen är stängd saknas i rummets markup",
  );
  assert.ok(markup.includes(COMMAND_QUEUE_BLOCKED_ON), "vad kanalen är blockerad på står inte utskrivet");

  /*
    Varje KOMMANDOKNAPP är blockerad, och orsaken är kopplad till knappen för hjälpmedel.
    Mätaren räknar knapparna via `data-command-disabled` — strömpanelens filterväxlar är
    presentationskontroller utan authority och hör inte hit, medan varje knapp som bär en
    kommandointention fälls om den blir klickbar mot en kö som inte finns.
  */
  const intents = tagsWith(markup, "data-command-button");
  const commandButtons = tagsWith(markup, "data-command-disabled");
  assert.ok(intents.length > 0, "kommandoytan renderar inga intentioner — mätaren mäter ingenting");
  assert.equal(
    commandButtons.length,
    intents.length,
    "en typad intention saknar knapp med mätbart blockeringsläge",
  );
  for (const button of commandButtons) {
    assert.equal(attr(button, "data-command-disabled"), "true", `en knapp är öppen: ${button}`);
    assert.equal(attr(button, "aria-disabled"), "true", `en knapp är klickbar mot en stängd kö: ${button}`);
    assert.ok(attr(button, "aria-describedby") !== null, `knappen bär ingen orsak: ${button}`);
  }

  /*
    Och ingen ANNAN knapp i rummet bär en kommandointention. Strömpanelens växlar är
    presentation (språk, rådata, autoscroll) — de ändrar ingen authority, och de får inte börja
    göra det bara för att rummet blivit mobilt.
  */
  const otherButtons = (markup.match(/<button[^>]*>/g) ?? []).filter(
    (tag) => attr(tag, "data-command-disabled") === null,
  );
  for (const button of otherButtons) {
    assert.ok(
      /data-stream-(language|raw-toggle|autoscroll)=/.test(button),
      `en okänd knapp finns i rummet — är den en authority-väg? ${button}`,
    );
  }

  // Och orsaksytan kan inte döljas av en brytpunkt.
  for (const rule of hidingRules(ROOM_CSS).concat(hidingRules(LOOP_CSS))) {
    assert.ok(
      !rule.selector.includes("mk-note") && !rule.selector.includes("command"),
      `«${rule.selector}» döljer orsaken till att kanalen är stängd`,
    );
  }

  // Rummet lägger ingen egen inlämnings- eller kommandoväg vid sidan om de byggda ytorna.
  for (const { path, source } of roomSourceFiles()) {
    const code = stripComments(source);
    assert.ok(!/<form|method="post"|method='post'/i.test(code), `${path} bär en egen inlämningsväg`);
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|navigator\.sendBeacon/.test(code), `${path} bär en nätverksväg`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * 9 · SKIVANS EGNA FILER — PROCENT, RÖRELSE OCH LOGGNING
 * ──────────────────────────────────────────────────────────────────────────── */

test("ROOM-MOBIL-NEG: skivans ändrade filer bär varken procent, rörelse eller loggning", () => {
  const files = CHANGED_FILES.map((entry) => ({
    ...entry,
    source: readFileSync(join(REPO_ROOT, entry.path), "utf8"),
  }));
  assert.ok(files.some((file) => file.product), "skivan ändrar ingen produktfil — grepet mäter inget");

  /** Procenttecknet skrivs som teckenkod: provfilen mäts av sitt eget grep. */
  const PERCENT = String.fromCharCode(37);
  const MOTION = /@keyframes|animation:|animate-|\bpulse\b|\bblink\b/i;
  const CONSOLE = /console\.(log|info|warn|error|debug|trace)\s*\(/;
  const PROGRESS = /<progress|role=["']progressbar|aria-valuenow|<meter\b/i;

  for (const { path, source, product, percentExempt } of files) {
    if (percentExempt === undefined) {
      assert.ok(!source.includes(PERCENT), `procenttecken i ${path}`);
    } else {
      /*
        ETT UNDANTAG SOM INTE LÄNGRE ÄR SANT ÄR ETT HÅL, INTE ETT UNDANTAG.

        Den undantagna filen måste FAKTISKT bära tecknet av det utskrivna skälet. Slutar den göra
        det har undantaget överlevt sin orsak, och då ska det bort — inte ligga kvar som en
        tyst dörr en framtida ändring kan gå igenom.
      */
      assert.ok(
        !product,
        `${path} är en produktfil — en produktfil får aldrig undantas från procentgrepet`,
      );
      assert.ok(
        source.includes(PERCENT),
        `${path} är undantagen från procentgrepet med skälet «${percentExempt}», men bär inget ` +
          "procenttecken längre. Ta bort undantaget i stället för att låta det stå kvar som en " +
          "öppen dörr.",
      );
    }
    if (!product) continue;
    assert.ok(!MOTION.test(source), `fabricerad liveness-rörelse i ${path}`);
    assert.ok(!CONSOLE.test(stripComments(source)), `loggning i ${path}`);
    assert.ok(!PROGRESS.test(source), `framstegselement i ${path}`);
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  assert.ok(MOTION.test(".rm-x { animation: pulse 1s infinite; }"));
  assert.ok(CONSOLE.test("console.warn('x');"));
  assert.ok(PROGRESS.test('<progress value="1" max="2" />'));
  assert.ok(`width: 50${PERCENT};`.includes(PERCENT));

  // Och markupen i alla tre lägen är fri från samma saker.
  const html = [renderRoom(snapshotOrThrow()), renderRoom(snapshotOrThrow(), false), renderRoom(null)].join("\n");
  assert.ok(!html.includes(PERCENT), "procenttecken i rummets markup");
  assert.ok(!MOTION.test(html), "rörelse i rummets markup");
  assert.ok(!PROGRESS.test(html), "framstegselement i rummets markup");
});
