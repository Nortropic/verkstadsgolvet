/**
 * SHREDDER-01A · SHOWROOM-KONTRAKTET — den reviderade produktacceptansen.
 *
 * KÄLLA: ägarbeslutet i docs/nortropic-factory-room-roadmap-erratum-01.md —
 *   SHOWROOM_BEFORE_BACKEND_COMPLETE=YES
 *   HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO
 *   FIXTURE_DATA_MUST_BE_EXPLICITLY_LABELLED=YES
 * som UPPHÄVER ROUTE_PLAN:s produktsynlighetsregel ("LOOP_ENABLED av → routen finns inte") i
 * docs/nortropic-control-room-plan-v1.md. Upphävandet gäller PRODUKTEN och ingenting annat:
 * inloggning (middleware.ts + auth()), app/api/loop/**-grindarna och varje trust-invariant står
 * kvar oförändrade — och mäts fortfarande av V4/V7/V9/V10 samt tests/loop/security.ts.
 *
 * VAD PROVET ÄGER (och vad det därför måste kunna FÄLLA)
 * -----------------------------------------------------
 *   a · /loop och /loop/mata renderar UTAN någon loop-relaterad env-variabel.
 *   b · Markupen bär `data-room-mode="SHOWROOM"` och SHOWROOM-märket, och ingen lägesyta påstår
 *       LIVE i showroom.
 *   c · Lägesupplösningen är FAIL-CLOSED: varje värde av FACTORY_ROOM_MODE ger "SHOWROOM" så
 *       länge LIVE_MODE_IMPLEMENTED är falskt. En env-variabel kan aldrig förvandla simulerad
 *       fabriksdata till ett live-påstående.
 *   d · Kommandokanalen är fortfarande stängd, med sin ORDAGRANNA orsak — showroom är en
 *       visnings- och läsyta, aldrig en genväg till en kö som inte finns.
 *   e · Ingen fixturburen panel står utan en förfader som bär läget: ett auktoritativt fält får
 *       aldrig renderas omärkt.
 *   f · /api/loop:s route-grindar är oförändrade: auth() före varje effekt, mätt med samma
 *       checkRouteGate som V10 använder (samma mätare, inte en mildare kopia).
 *   g · LÖGNSTUB: mätaren i (c) fäller en upplösare som mappar "live" → LIVE medan live-läget
 *       inte är byggt.
 *
 * HARNESS-NOT: samma som V2 — tsconfig har `jsx: "preserve"`, så delade komponenter (PageHeader,
 * Graceful) behöver en global React när de renderas utanför Next.
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
import MataMaskinenPage from "../../app/(app)/loop/mata/page";
import MaskinShell from "../../components/loop/MaskinShell";
import { isLoopEnabled } from "../../components/loop/flag";
import { fixtureSnapshot } from "../../lib/loop/fixtures";
import {
  COMMAND_QUEUE_BLOCKED_ON,
  COMMAND_QUEUE_DISABLED_REASON,
  COMMAND_QUEUE_TRANSPORT,
  commandChannelEnabled,
} from "../../lib/loop/commands";
import {
  LIVE_MODE_IMPLEMENTED,
  ROOM_MODE_ATTRIBUTE,
  ROOM_MODE_ENV_VAR,
  SHOWROOM,
  SHOWROOM_BADGE,
  SHOWROOM_EXPLANATION,
  SHOWROOM_MODE_LINE,
  factoryRoomMode,
  type FactoryRoomMode,
} from "../../lib/loop/room/mode";
import { checkRouteGate } from "./security";

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** Varje env-variabel som någon gång har styrt /loop-trädets synlighet eller läge. */
const LOOP_ENV_VARS = [
  "LOOP_ENABLED",
  ROOM_MODE_ENV_VAR,
  "LOOP_SUPABASE_URL",
  "LOOP_SUPABASE_KEY",
] as const;

/**
 * Kör `body` med SAMTLIGA loop-relaterade env-variabler borttagna, och återställer dem efteråt.
 * En route som renderar här renderar för en inloggad operatör utan en enda flagga satt.
 */
function withoutLoopEnv<T>(body: () => T): T {
  const before = new Map<string, string | undefined>();
  for (const name of LOOP_ENV_VARS) {
    before.set(name, process.env[name]);
    delete process.env[name];
  }
  try {
    return body();
  } finally {
    for (const [name, value] of before) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function withoutStyles(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/g, "");
}

/** Alla öppningstaggar som bär ett givet attribut. */
function tagsWith(html: string, attribute: string): string[] {
  return html.match(new RegExp(`<[A-Za-z][^>]*${attribute}[^>]*>`, "g")) ?? [];
}

function attr(fragment: string, name: string): string | null {
  const match = fragment.match(new RegExp(`${name}="([^"]*)"`));
  return match ? match[1] : null;
}

function maskinenHtml(): string {
  return withoutLoopEnv(() => renderToStaticMarkup(MaskinenPage() as ReactElement));
}

function intakeHtml(): string {
  return withoutLoopEnv(() => renderToStaticMarkup(MataMaskinenPage() as ReactElement));
}

/* ────────────────────────────────────────────────────────────────────────────
 * a · ROUTERNA RENDERAR UTAN EN ENDA FLAGGA
 * ──────────────────────────────────────────────────────────────────────────── */

test("SHOWROOM-A: /loop och /loop/mata renderar utan någon loop-env — produkten är inte dold", () => {
  const maskinen = withoutLoopEnv(() => {
    // Grinden är verkligen AV i den här mätningen: annars mäter provet ingenting.
    assert.equal(isLoopEnabled(), false, "LOOP_ENABLED var satt — mätaren mäter fel läge");
    return renderToStaticMarkup(MaskinenPage() as ReactElement);
  });
  assert.ok(maskinen.includes('data-maskin-shell="true"'), "/loop renderade inget kontrollrum");
  assert.ok(maskinen.includes('data-maskin-header="true"'), "/loop renderade inget sidhuvud");

  const intake = withoutLoopEnv(() => {
    assert.equal(isLoopEnabled(), false);
    return renderToStaticMarkup(MataMaskinenPage() as ReactElement);
  });
  assert.ok(intake.includes('data-intake-shell="true"'), "/loop/mata renderade ingen intakeyta");

  /*
    OCH SYNLIGHETEN ÄR EN PRODUKTREGEL, INTE EN SÄKERHETSGRÄNS: routerna 404:ar inte längre på
    en produktflagga, men de ligger kvar under app/(app) — samma inloggade segment som resten av
    appen, gatat av middleware.ts + auth(). Ingen route flyttades ut ur det segmentet.
  */
  for (const relative of ["app/(app)/loop/page.tsx", "app/(app)/loop/mata/page.tsx"]) {
    const source = readFileSync(join(REPO_ROOT, relative), "utf8");
    assert.ok(!/notFound\s*\(/.test(source), `${relative} döljer produkten bakom en 404`);
    assert.match(source, /export const dynamic = "force-dynamic"/, `${relative} är inte dynamisk`);
    assert.ok(existsSync(join(REPO_ROOT, relative)), `${relative} ligger inte kvar i (app)`);
  }

  // Transportgrinden är oförändrad: exakt-matchning mot "true", fail-closed för allt annat.
  assert.equal(isLoopEnabled({ LOOP_ENABLED: "true" }), true);
  for (const value of ["false", "TRUE", "1", "yes", "", undefined]) {
    assert.equal(isLoopEnabled({ LOOP_ENABLED: value }), false, `LOOP_ENABLED=${String(value)}`);
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * b · MÄRKNINGEN — SHOWROOM SYNS, OCH INGET PÅSTÅR LIVE
 * ──────────────────────────────────────────────────────────────────────────── */

test("SHOWROOM-B: båda ytorna bär läget maskinläsbart OCH showroom-märket i klartext", () => {
  for (const [name, html] of [
    ["/loop", maskinenHtml()],
    ["/loop/mata", intakeHtml()],
  ] as const) {
    assert.ok(
      html.includes(`${ROOM_MODE_ATTRIBUTE}="${SHOWROOM}"`),
      `${name} bär inget maskinläsbart produktläge`,
    );
    assert.ok(html.includes(SHOWROOM_BADGE), `${name} saknar showroom-märket i klartext`);
  }

  // Märkets exakta text är ETT ställe i koden, och det är den som når skärmen.
  assert.equal(SHOWROOM_BADGE, "SHOWROOM · SIMULERAD FABRIKSDATA");
  assert.equal(SHOWROOM_MODE_LINE, "SHOWROOM · simulerad fabriksdata");
  assert.match(SHOWROOM_EXPLANATION, /Simulerad fabriksdata/);

  // Sidhuvudets lägesrad står på /loop; intakeytans mening står på /loop/mata.
  assert.ok(maskinenHtml().includes(SHOWROOM_MODE_LINE), "lägesraden saknas på /loop");
  assert.ok(intakeHtml().includes(SHOWROOM_EXPLANATION), "förklaringen saknas på /loop/mata");
});

test("SHOWROOM-B: ingen lägesyta påstår LIVE i showroom", () => {
  for (const [name, html] of [
    ["/loop", maskinenHtml()],
    ["/loop/mata", intakeHtml()],
  ] as const) {
    /*
      Uppslaget binder till attributet MED sitt värde (`data-room-mode="`), aldrig till namnet
      som prefix: `data-room-mode-line` är en annan märkning, och en mätare som blandar ihop dem
      mäter stavning i stället för läge.
    */
    const modeTags = tagsWith(html, `${ROOM_MODE_ATTRIBUTE}="`);
    assert.ok(modeTags.length > 0, `${name} bär ingen lägesmärkning alls`);
    for (const tag of modeTags) {
      assert.equal(
        attr(tag, ROOM_MODE_ATTRIBUTE),
        SHOWROOM,
        `${name}: en yta bär ett annat läge än showroom (${tag})`,
      );
    }
    assert.ok(
      !html.includes(`${ROOM_MODE_ATTRIBUTE}="LIVE"`),
      `${name} påstår LIVE-läge`,
    );
    assert.ok(
      !html.includes(`${ROOM_MODE_ATTRIBUTE}="DEGRADED"`),
      `${name} påstår ett läge som inte är byggt`,
    );

    /*
      Och ingen LÄGESBÄRANDE text säger LIVE. Mätningen är avgränsad till lägesytorna med flit:
      ordet "Live" betecknar på andra ställen KÄLLAN en panel läser (sidhuvudets strömsegment,
      V9:s transportmärke), vilket är ett annat påstående och ägs av de proven. Här mäts att det
      som märker LÄGET aldrig lånar det ordet.
    */
    for (const tag of modeTags) {
      const start = html.indexOf(tag);
      const text = withoutStyles(html.slice(start, start + tag.length + 400)).replace(
        /<[^>]+>/g,
        " ",
      );
      assert.ok(
        !/\bLIVEDATA\b|\bLIVE\b/.test(text.replace(SHOWROOM_EXPLANATION, " ")),
        `${name}: en lägesyta skriver ut LIVE (${text.slice(0, 120)})`,
      );
    }
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * c + g · FAIL-CLOSED LÄGESUPPLÖSNING, MED LÖGNSTUB
 * ──────────────────────────────────────────────────────────────────────────── */

/** Varje värde en env-variabel realistiskt kan bära, inklusive de som SER giltiga ut. */
const MODE_ENV_TABLE: (string | undefined)[] = [
  undefined,
  "live",
  "LIVE",
  "Live",
  " LIVE ",
  "yes",
  "true",
  "",
  "   ",
  "DEGRADED",
  "degraded",
  "SHOWROOM",
  "showroom",
  "{}",
  "SHOWROOM;LIVE",
  "🙂",
];

/** Mätaren: vilka värden som INTE föll till showroom. Delas av det riktiga provet och stubben. */
function notFailingClosed(
  resolve: (env: Record<string, string | undefined>) => FactoryRoomMode,
): string[] {
  const leaks: string[] = [];
  for (const value of MODE_ENV_TABLE) {
    const env = value === undefined ? {} : { [ROOM_MODE_ENV_VAR]: value };
    if (resolve(env) !== SHOWROOM) leaks.push(String(value));
  }
  return leaks;
}

test("SHOWROOM-C: varje värde av FACTORY_ROOM_MODE löser ut SHOWROOM — env kan inte öppna live", () => {
  assert.equal(LIVE_MODE_IMPLEMENTED, false, "live-läget påstås byggt — då gäller ett annat prov");
  assert.equal(ROOM_MODE_ENV_VAR, "FACTORY_ROOM_MODE");

  assert.deepEqual(
    notFailingClosed((env) => factoryRoomMode(env)),
    [],
    "en env-variabel flyttade produktläget bort från showroom",
  );

  // Också med processens riktiga miljö, och med variabeln uttryckligen satt till "LIVE".
  const before = process.env[ROOM_MODE_ENV_VAR];
  try {
    process.env[ROOM_MODE_ENV_VAR] = "LIVE";
    assert.equal(factoryRoomMode(), SHOWROOM, "processens env öppnade live");
    assert.equal(
      renderToStaticMarkup(MaskinenPage() as ReactElement).includes(
        `${ROOM_MODE_ATTRIBUTE}="${SHOWROOM}"`,
      ),
      true,
      "sidan bytte läge på en env-variabel",
    );
  } finally {
    if (before === undefined) delete process.env[ROOM_MODE_ENV_VAR];
    else process.env[ROOM_MODE_ENV_VAR] = before;
  }

  // Läget är dessutom exakt ett av de tre kanoniska — inget fjärde ord smyger in.
  const modes: FactoryRoomMode[] = ["SHOWROOM", "LIVE", "DEGRADED"];
  assert.ok(modes.includes(factoryRoomMode()));
});

test("SHOWROOM-G (LÖGNSTUB): mätaren fäller en upplösare som mappar 'live' till LIVE", () => {
  /*
    Utan den här stubben vore provet ovan bara en avläsning av en konstant. Stubben är exakt den
    regression kontraktet finns för: någon "stödjer" env-variabeln innan ROOM-05 landat, och
    showroomet börjar kunna påstå live utan att en enda etikett skrivits om.
  */
  const lying = (env: Record<string, string | undefined>): FactoryRoomMode => {
    const requested = (env[ROOM_MODE_ENV_VAR] ?? "").trim().toUpperCase();
    if (requested === "LIVE") return "LIVE";
    if (requested === "DEGRADED") return "DEGRADED";
    return SHOWROOM;
  };

  const leaks = notFailingClosed(lying);
  assert.ok(leaks.length > 0, "mätaren fäller inte ens en upplösare som öppnar live");
  for (const value of ["live", "LIVE", "Live", " LIVE "]) {
    assert.ok(leaks.includes(value), `lögnstubben släppte igenom ${value} omärkt`);
  }
  // Och den riktiga upplösaren gör INTE det stubben gör.
  assert.notEqual(factoryRoomMode({ [ROOM_MODE_ENV_VAR]: "LIVE" }), lying({ FACTORY_ROOM_MODE: "LIVE" }));
});

/* ────────────────────────────────────────────────────────────────────────────
 * d · KOMMANDOKANALEN ÄR FORTFARANDE STÄNGD
 * ──────────────────────────────────────────────────────────────────────────── */

test("SHOWROOM-D: showroom öppnar ingen kommandoväg — kanalen är stängd med ordagrann orsak", () => {
  assert.equal(COMMAND_QUEUE_TRANSPORT, "NONE");
  assert.equal(commandChannelEnabled(), false, "kanalen öppnades av en visningsskiva");

  const html = maskinenHtml();
  assert.ok(html.includes(COMMAND_QUEUE_DISABLED_REASON), "den ordagranna orsaken saknas");
  assert.ok(html.includes(COMMAND_QUEUE_BLOCKED_ON), "vad kanalen är blockerad på står inte utskrivet");

  // Varje kommandoknapp är avstängd i MARKUPEN, inte bara i tonen.
  const buttons = tagsWith(html, "data-command-disabled");
  assert.ok(buttons.length > 0, "kommandoytan renderar inga knappar — mätaren mäter ingenting");
  for (const button of buttons) {
    assert.equal(attr(button, "data-command-disabled"), "true", `en knapp är klickbar: ${button}`);
    assert.equal(attr(button, "aria-disabled"), "true", `knappen är inte avstängd för hjälpmedel`);
  }

  // Och intakeytan lämnar fortfarande ingenting någonstans.
  const intake = intakeHtml();
  assert.ok(!/<form\b/i.test(intake), "intakeytan bär en inlämningsväg");
  assert.ok(!/method="post"/i.test(intake), "intakeytan bär en inlämningsmetod");
});

/* ────────────────────────────────────────────────────────────────────────────
 * e · INGET AUKTORITATIVT FÄLT RENDERAS OMÄRKT
 * ──────────────────────────────────────────────────────────────────────────── */

test("SHOWROOM-E: varje fixturburen panel står under en förfader som bär läget", () => {
  /*
    Mätningen är strukturell: rotelementet som bär `data-room-mode` måste OMSLUTA varje
    fixturburen panel. Uppslaget görs på positioner i markupen — panelen ligger efter rotens
    öppningstagg och före dess slut — vilket är precis vad "under en förfader" betyder i en
    serialiserad DOM.
  */
  const html = maskinenHtml();
  const rootTag = tagsWith(html, `${ROOM_MODE_ATTRIBUTE}="${SHOWROOM}"`).find((tag) =>
    tag.includes('data-maskin-shell="true"'),
  );
  assert.ok(rootTag, "rummets rot bär inte läget");
  const rootStart = html.indexOf(rootTag);
  assert.ok(rootStart >= 0);

  const AUTHORITATIVE_PANELS = [
    'data-run-status-bar="true"',
    'data-column="backlog"',
    'data-column="current"',
    'data-column="completed"',
    'data-room-attention="true"',
    'data-room-timeline="true"',
    'data-causal-chain="true"',
  ];
  for (const marker of AUTHORITATIVE_PANELS) {
    const at = html.indexOf(marker);
    assert.ok(at > rootStart, `${marker} renderas utanför den lägesmärkta roten`);
  }

  // Intakeytans utfall likaså: skalets rot bär läget och omsluter resultaten.
  const intake = intakeHtml();
  const intakeRoot = tagsWith(intake, `${ROOM_MODE_ATTRIBUTE}="${SHOWROOM}"`).find((tag) =>
    tag.includes('data-intake-shell="true"'),
  );
  assert.ok(intakeRoot, "intakeytans rot bär inte läget");
  assert.ok(
    intake.indexOf('data-intake-results="true"') > intake.indexOf(intakeRoot),
    "utfallen renderas utanför den lägesmärkta roten",
  );

  // NEGATIV KONTROLL: utan läge i propsen finns ingen omärkt väg — skalet faller till showroom.
  const unlabelled = renderToStaticMarkup(
    createElement(MaskinShell, { snapshot: fixtureSnapshot(), fixture: true }),
  );
  assert.ok(
    unlabelled.includes(`${ROOM_MODE_ATTRIBUTE}="${SHOWROOM}"`),
    "ett skal utan uttryckligt läge renderade omärkt fixturdata",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * f · SÄKERHETSYTAN ÄR ORÖRD AV DEN HÄR SKIVAN
 * ──────────────────────────────────────────────────────────────────────────── */

test("SHOWROOM-F: /api/loop:s grindar står kvar — auth() före varje effekt, samma mätare som V10", () => {
  /*
    Mätningen är avsiktligt GIT-OBEROENDE: den läser inte en diff utan KRAVET självt, med
    tests/loop/security.ts checkRouteGate — exakt den mätare V10 använder. En visningsskiva som
    hade råkat röra en route-grind faller här, oavsett hur diffen ser ut.
  */
  const routeDir = join(REPO_ROOT, "app/api/loop");
  const routes = readdirSync(routeDir, { recursive: true, encoding: "utf8" })
    .filter((name) => name.endsWith("route.ts"))
    .map((name) => join("app/api/loop", name));
  assert.ok(routes.length >= 5, `förväntade hela /api/loop-trädet, fann ${routes.length}`);

  for (const relative of routes) {
    const source = readFileSync(join(REPO_ROOT, relative), "utf8");
    assert.deepEqual(
      checkRouteGate({ path: relative, source }),
      [],
      `${relative}: route-grinden är inte längre hel`,
    );
    // Transportgrinden lever kvar i routarna — den är inte "ersatt" av produktläget.
    assert.match(source, /isLoopEnabled\s*\(/, `${relative} tappade LOOP_ENABLED-grinden`);
    // Och produktläget har ingen plats i en säkerhetsväg.
    assert.ok(
      !source.includes("factoryRoomMode"),
      `${relative} läser produktläget — en visningsflagga hör inte hemma i en route-grind`,
    );
  }

  // Mätaren ska vara VERKLIG: en route utan auth() fälls av samma funktion.
  const lie = {
    path: "app/api/loop/lögn/route.ts",
    source: [
      "export async function GET(request: Request) {",
      "  const data = await loadSnapshot();",
      "  const session = await auth();",
      "  if (!session) return new Response(null, { status: 401 });",
      "  return Response.json(data);",
      "}",
    ].join("\n"),
  };
  assert.ok(
    checkRouteGate(lie).some((finding) => finding.rule === "EFFEKT_FORE_AUTH"),
    "mätaren fäller inte ens en effekt före auth()",
  );
});
