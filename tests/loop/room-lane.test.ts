/**
 * LANE-01 · ARBETSDOMÄNENS KONTRAKT — negativa kontroller.
 *
 * Provar ägarens frysta förtydligande i docs/nortropic-factory-room-lanes-clarification.md §1–§3
 * och §11: Nortropic har TVÅ arbetsdomäner (CUSTOMER_PRODUCTION / SYSTEM_IMPROVEMENT), de är
 * FÖRSTKLASSIG PRESENTATION och ALDRIG tillstånd, de härleds aldrig ur ett namn, och en live-yta
 * som saknar värdet visar em-streck i stället för att gissa.
 *
 * DE SEX REGRESSIONERNA PROVET FINNS FÖR
 * --------------------------------------
 *   1. Ett tredje domänvärde smyger in, eller en av de två byter stavning.
 *   2. Domänen läggs till i TASK_LIFECYCLE eller renderas som ett uppgiftstillstånd.
 *   3. En saknad domän fylls med en gissning i stället för em-streck.
 *   4. Någon börjar HÄRLEDA SYSTEM_IMPROVEMENT ur ett kodförrådsnamn, en titel eller ett annat
 *      mönster — eller ur en modell.
 *   5. Showroomets domänmärkning blir implicit (ett förval i en vy) i stället för uttrycklig
 *      metadata i scenariot.
 *   6. Skivans egna filer börjar bära andel, rörelse, loggning eller framstegselement.
 *
 * VAD PROVET INTE PÅSTÅR: ingenting här är ett bevis för att en LEVANDE körning bär en
 * arbetsdomän. Kontraktet i lib/loop/schema.ts har inget sådant fält, och det är precis därför
 * rummets rad står på em-streck. Den levande projektionen är LANE-08 och mäts inte här.
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
import FactoryRoomHeader from "../../components/loop/room/FactoryRoomHeader";
import ScenarioPicker from "../../components/loop/room/ScenarioPicker";
import WorkComposer, { COMPOSER_LANES } from "../../components/loop/room/WorkComposer";
import WorkDomainIndicator from "../../components/loop/room/WorkDomainIndicator";
import { fixtureSnapshot } from "../../lib/loop/fixtures";
import { MISSING, TASK_LIFECYCLE_PRESENTATION } from "../../lib/loop/labels";
import { TASK_LIFECYCLE, type LoopSnapshot } from "../../lib/loop/schema";
import {
  COMPOSER_INTENT_WORK_DOMAIN,
  CURRENT_BOOTSTRAP_WORK_DOMAIN,
  CUSTOMER_PRODUCTION_LOOP_STATUS,
  WORK_DOMAINS,
  WORK_DOMAIN_ABSENT_NOTE,
  WORK_DOMAIN_ATTRIBUTE,
  WORK_DOMAIN_CAPTION,
  WORK_DOMAIN_FIELD,
  WORK_DOMAIN_LOCKS,
  WORK_DOMAIN_PRESENTATION,
  intentWorkDomain,
  isWorkDomain,
  resolveWorkDomain,
  workDomainAttribute,
  workDomainCoverage,
  workDomainLabel,
  workDomainNote,
  type WorkDomain,
} from "../../lib/loop/room/lane";
import {
  DEFAULT_SCENARIO,
  SCENARIO_WORK_DOMAIN_CAPTION,
  SHOWROOM_SCENARIOS,
  SHOWROOM_SCENARIO_IDS,
  scenarioWorkDomain,
} from "../../lib/loop/room/scenarios";

/* ── Hjälpare ─────────────────────────────────────────────────────────────── */

const REPO_ROOT = new URL("../../", import.meta.url).pathname;

/** Filen som ÄGER kontraktet. Den statiska skanningen nedan gäller exakt den. */
const LANE_PATH = "lib/loop/room/lane.ts";

/** Skivans egna filer — de mätarna i avsnitt F gäller. */
const SLICE_FILES = [
  LANE_PATH,
  "lib/loop/room/scenarios.ts",
  "components/loop/room/WorkDomainIndicator.tsx",
  "components/loop/room/FactoryRoomHeader.tsx",
  "components/loop/room/ScenarioPicker.tsx",
  "components/loop/room/WorkComposer.tsx",
  "components/loop/room/ui.ts",
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

function snapshotOrThrow(): LoopSnapshot {
  const snapshot = fixtureSnapshot();
  assert.ok(snapshot, "V1-fixturen validerade inte mot V1-kontraktet");
  return snapshot;
}

function renderRoom(): string {
  return renderToStaticMarkup(
    createElement(MaskinShell, { snapshot: snapshotOrThrow(), fixture: true }),
  );
}

function renderIndicator(domain: WorkDomain | null): string {
  return renderToStaticMarkup(createElement(WorkDomainIndicator, { domain }));
}

/** Den ENDA elementet i en markup som bär arbetsdomänens rad. */
function indicatorTags(html: string): string[] {
  return tagsWith(html, 'data-work-domain-indicator="true"');
}

/* ────────────────────────────────────────────────────────────────────────────
 * A · TYPMÄNGDEN ÄR EXAKT TVÅ VÄRDEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("LANE-TYP: arbetsdomänerna är exakt de två ägaren namngav — varken fler eller färre", () => {
  assert.deepEqual(
    [...WORK_DOMAINS],
    ["CUSTOMER_PRODUCTION", "SYSTEM_IMPROVEMENT"],
    "listan över arbetsdomäner är inte längre ägarens två",
  );
  assert.equal(WORK_DOMAINS.length, 2);

  // Varje värde har en presentation, och etiketterna är ägarens svenska ord.
  assert.equal(workDomainCoverage(), true, "en domän saknar presentation");
  assert.equal(WORK_DOMAIN_PRESENTATION.CUSTOMER_PRODUCTION.label, "KUNDPRODUKTION");
  assert.equal(WORK_DOMAIN_PRESENTATION.SYSTEM_IMPROVEMENT.label, "SYSTEMFÖRBÄTTRINGAR");
  const labels = WORK_DOMAINS.map((domain) => WORK_DOMAIN_PRESENTATION[domain].label);
  assert.equal(new Set(labels).size, 2, "de två spåren delar etikett — skillnaden syns inte");
  for (const domain of WORK_DOMAINS) {
    const one = WORK_DOMAIN_PRESENTATION[domain];
    assert.ok(one.description.length > 20, `${domain} saknar en beskrivande rad`);
    assert.ok(!one.description.includes(MISSING), `${domain}:s rad bär ett em-streck som text`);
  }
  assert.notEqual(
    WORK_DOMAIN_PRESENTATION.CUSTOMER_PRODUCTION.description,
    WORK_DOMAIN_PRESENTATION.SYSTEM_IMPROVEMENT.description,
  );

  // Fältstavningen är EN, och den är den valda.
  assert.equal(WORK_DOMAIN_FIELD, "work_domain");
  assert.equal(WORK_DOMAIN_ATTRIBUTE, "data-work-domain");

  // Ägarens fem lås ur §1 bärs som data, inte som prosa.
  assert.deepEqual(
    { ...WORK_DOMAIN_LOCKS },
    {
      FACTORY_LANE_SYSTEM: "SYSTEM_IMPROVEMENT",
      FACTORY_LANE_CUSTOMER: "CUSTOMER_PRODUCTION",
      BOOTSTRAP_AUTOPILOT_PRIMARY_LANE: "SYSTEM_IMPROVEMENT",
      SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY: "NO",
      SHARED_TRUST_KERNEL_BETWEEN_LANES: "YES",
    },
    "ett av ägarens fem lås har ändrats",
  );
  assert.equal(CURRENT_BOOTSTRAP_WORK_DOMAIN, "SYSTEM_IMPROVEMENT");
  assert.equal(CUSTOMER_PRODUCTION_LOOP_STATUS, "SEPARATE_FUTURE_CAPABILITY");
  assert.ok(
    isWorkDomain(CURRENT_BOOTSTRAP_WORK_DOMAIN),
    "faktakonstanten står utanför den slutna listan",
  );

  // Grinden är EXAKT likhet: inget skiftlägestrick, ingen trimning, ingen delsträng.
  for (const value of [
    undefined,
    null,
    "",
    "   ",
    "system_improvement",
    "System_Improvement",
    " SYSTEM_IMPROVEMENT ",
    "SYSTEM_IMPROVEMENTS",
    "CUSTOMER",
    "KUNDPRODUKTION",
    "BOTH",
    0,
    1,
    true,
    {},
    ["SYSTEM_IMPROVEMENT"],
  ]) {
    assert.equal(isWorkDomain(value), false, `«${String(value)}» godtogs som arbetsdomän`);
  }
  for (const domain of WORK_DOMAINS) assert.equal(isWorkDomain(domain), true);
});

/* ────────────────────────────────────────────────────────────────────────────
 * B · ARBETSDOMÄNEN ÄR ALDRIG ETT TILLSTÅND
 * ──────────────────────────────────────────────────────────────────────────── */

/** Backendens elva kanoniska tillstånd, ordagrant. Ett tolfte här är hela poängen med låset. */
const FROZEN_TASK_LIFECYCLE = [
  "RAW",
  "PLANNING",
  "NEEDS_SPEC",
  "READY",
  "QUEUED",
  "WORKING",
  "VERIFYING",
  "REVIEWING",
  "MERGING",
  "DONE",
  "STOPPED",
];

test("LANE-LIFECYCLE: TASK_LIFECYCLE är orörd, och ingen yta renderar en domän som tillstånd", () => {
  // 1 · Listan är byte-för-byte densamma som före skivan — samma värden, samma ordning.
  assert.deepEqual(
    [...TASK_LIFECYCLE],
    FROZEN_TASK_LIFECYCLE,
    "TASK_LIFECYCLE har ändrats — en arbetsdomän får ALDRIG bli ett tillstånd",
  );
  assert.equal(TASK_LIFECYCLE.length, 11);

  // 2 · Mängderna är disjunkta åt båda håll.
  for (const state of TASK_LIFECYCLE) {
    assert.equal(isWorkDomain(state), false, `${state} är både tillstånd och arbetsdomän`);
  }
  for (const domain of WORK_DOMAINS) {
    assert.ok(
      !(TASK_LIFECYCLE as readonly string[]).includes(domain),
      `${domain} står i TASK_LIFECYCLE`,
    );
    assert.ok(
      !Object.hasOwn(TASK_LIFECYCLE_PRESENTATION, domain),
      `${domain} har fått en tillståndspresentation`,
    );
  }

  // 3 · Det frusna kontraktet känner inte vokabulären alls.
  const schema = read("lib/loop/schema.ts");
  for (const pattern of [/CUSTOMER_PRODUCTION/, /SYSTEM_IMPROVEMENT/, /work_domain/]) {
    assert.ok(!pattern.test(schema), `lib/loop/schema.ts bär ${pattern} — kontraktet är inte orört`);
  }

  /*
    4 · OCH INGEN TILLSTÅNDSYTA I RUMMET BÄR EN DOMÄN. Mätt på den renderade markupen: varken
    korten, statusmärkena eller färgrollerna får någonsin bära ett domänvärde, och inget
    uppgiftskort får bära domänattributet — då hade domänen blivit en egenskap på en uppgift
    utan att ett enda kontrakt sagt det.
  */
  const html = withoutStyles(renderRoom());
  for (const name of ["data-state", "data-state-badge", "data-tone", "data-column", "data-phase"]) {
    const tags = tagsWith(html, `${name}="`);
    for (const tag of tags) {
      assert.equal(
        isWorkDomain(attr(tag, name)),
        false,
        `${name} bär ett domänvärde — arbetsdomänen har blivit ett tillstånd: ${tag}`,
      );
    }
  }
  const cards = html.match(/<article\b[^>]*>[\s\S]*?<\/article>/g) ?? [];
  assert.ok(cards.length > 0, "rummet renderar inga uppgiftskort — mätaren mäter ingenting");
  for (const card of cards) {
    assert.ok(
      !card.includes(WORK_DOMAIN_ATTRIBUTE),
      `ett uppgiftskort bär arbetsdomänen som fält: ${card.slice(0, 120)}`,
    );
    for (const label of WORK_DOMAINS.map((domain) => WORK_DOMAIN_PRESENTATION[domain].label)) {
      assert.ok(!card.includes(label), `ett uppgiftskort renderar «${label}» som om det vore status`);
    }
  }

  // LÖGNSTUB: en utökad lista fälls av samma jämförelse — annars mäter låset ingenting.
  assert.notDeepEqual(
    [...TASK_LIFECYCLE, "SYSTEM_IMPROVEMENT"],
    FROZEN_TASK_LIFECYCLE,
    "jämförelsen skulle inte se ett tolfte värde",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * C · UPPLÖSAREN: BARA ETT UTTRYCKLIGT VÄRDE — ALLT ANNAT BLIR EM-STRECK
 * ──────────────────────────────────────────────────────────────────────────── */

test("LANE-UPPLÖSNING: saknat, okänt och skräpvärde ger null — och null renderas som em-streck", () => {
  // Det uttryckliga värdet accepteras, och bara det.
  for (const domain of WORK_DOMAINS) {
    assert.equal(resolveWorkDomain({ work_domain: domain }), domain);
  }

  const GARBAGE: unknown[] = [
    undefined,
    null,
    "",
    "SYSTEM_IMPROVEMENT",
    42,
    true,
    [],
    ["SYSTEM_IMPROVEMENT"],
    {},
    { work_domain: null },
    { work_domain: undefined },
    { work_domain: "" },
    { work_domain: "system_improvement" },
    { work_domain: " SYSTEM_IMPROVEMENT" },
    { work_domain: ["SYSTEM_IMPROVEMENT"] },
    { work_domain: { value: "SYSTEM_IMPROVEMENT" } },
    { WORK_DOMAIN: "SYSTEM_IMPROVEMENT" },
  ];
  for (const value of GARBAGE) {
    const shown = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
    assert.equal(resolveWorkDomain(value), null, `«${shown}» gav en domän i stället för null`);
  }

  /*
    ETT ÄRVT FÄLT ÄR INGET BURET FÄLT. Utan `Object.hasOwn` hade en prototyp kunnat leverera ett
    värde ingen skrev — en gissning genom bakdörren, och exakt det slags hål lib/loop/labels.ts
    stänger i sin egen uppslagstabell.
  */
  const inherited = Object.create({ work_domain: "SYSTEM_IMPROVEMENT" }) as object;
  assert.equal(resolveWorkDomain(inherited), null, "ett ärvt fält lästes som ett buret värde");

  /*
    OCH BARA DEN KANONISKA STAVNINGEN RÄKNAS. De två förkastade kandidatnamnen (factory_lane,
    project_kind) får inte fungera som en andra ingång: två stavningar av samma sanning glider
    isär, och den som glider är den som ingen läser.
  */
  assert.equal(
    resolveWorkDomain({ factory_lane: "SYSTEM_IMPROVEMENT", project_kind: "SYSTEM_IMPROVEMENT" }),
    null,
    "en alternativ fältstavning accepterades — kontraktet har då två ingångar",
  );

  // Presentationen av null är em-streck, i BÅDA riktningarna: text och maskinläsbart värde.
  assert.equal(workDomainLabel(null), MISSING);
  assert.equal(workDomainAttribute(null), MISSING);
  assert.equal(MISSING, "—");
  assert.equal(workDomainNote(null), WORK_DOMAIN_ABSENT_NOTE);
  for (const domain of WORK_DOMAINS) {
    assert.equal(workDomainLabel(domain), WORK_DOMAIN_PRESENTATION[domain].label);
    assert.equal(workDomainAttribute(domain), domain);
    assert.equal(workDomainNote(domain), WORK_DOMAIN_PRESENTATION[domain].description);
  }

  // Och ytan gör samma sak: em-streck som text, em-streck i attributet, märkt som saknat.
  const absent = renderIndicator(null);
  const absentTag = indicatorTags(absent)[0];
  assert.ok(absentTag, "ytan renderar ingen arbetsdomänsrad alls");
  assert.equal(attr(absentTag, WORK_DOMAIN_ATTRIBUTE), MISSING);
  assert.match(absent, /data-missing="true"[^>]*>—</, "det saknade värdet renderades inte som —");
  assert.ok(absent.includes(WORK_DOMAIN_CAPTION), "raden saknar sin etikett");
  assert.ok(
    !/>\s*(null|undefined|NaN|okänd|unknown)\s*</i.test(absent),
    "ett hål fylldes med ett gissat ord",
  );

  const present = renderIndicator("CUSTOMER_PRODUCTION");
  const presentTag = indicatorTags(present)[0];
  assert.ok(presentTag, "ytan renderar ingen arbetsdomänsrad för ett känt värde");
  assert.equal(attr(presentTag, WORK_DOMAIN_ATTRIBUTE), "CUSTOMER_PRODUCTION");
  assert.ok(present.includes("KUNDPRODUKTION"), "den kända domänen renderades inte");
  assert.match(present, /data-missing="false"/, "ett känt värde märktes som saknat");
});

test("LANE-UPPLÖSNING: rummets egen rad står på em-streck — live-ytan gissar aldrig", () => {
  /*
    Rummet får ingen arbetsdomän inskickad, eftersom kontraktet i lib/loop/schema.ts inte bär
    något sådant fält. Då ska raden vara ETT EM-STRECK och orsaken stå utskriven — aldrig ett
    värde som «råkar stämma» för dagens bootstrap-arbete. Att det värdet vore sant idag är
    irrelevant: en yta som fyller i ett fält den inte fått är en yta som ljuger i morgon.
  */
  const html = withoutStyles(renderRoom());
  const tags = indicatorTags(html);
  assert.equal(tags.length, 1, "rummet renderar inte exakt en arbetsdomänsrad");
  assert.equal(attr(tags[0], WORK_DOMAIN_ATTRIBUTE), MISSING, "rummet gissade en arbetsdomän");
  assert.ok(html.includes(WORK_DOMAIN_ABSENT_NOTE), "orsaken till em-strecket står inte utskriven");
  /*
    OCH DE ENDA YTOR I RUMMET SOM BÄR ETT VERKLIGT DOMÄNVÄRDE ÄR KOMPOSITÖRENS TVÅ AFFORDANSER.

    De beskriver ett VAL — «vad vill du göra?» — och inte ett pågående arbete. Skillnaden mäts i
    stället för att antas: varje annan bärare av attributet vore ett påstående om verkligt arbete,
    alltså exakt den gissning kontraktet finns för att förhindra.
  */
  const carriers = tagsWith(html, `${WORK_DOMAIN_ATTRIBUTE}="`).filter(
    (tag) => attr(tag, WORK_DOMAIN_ATTRIBUTE) !== MISSING,
  );
  assert.ok(carriers.length > 0, "ingen yta bär ett domänvärde alls — mätaren mäter ingenting");
  for (const tag of carriers) {
    assert.ok(
      attr(tag, "data-composer-lane") !== null,
      `en yta utanför kompositörens två val påstår en arbetsdomän: ${tag}`,
    );
  }

  // Huvudet som FÅR ett värde visar det, och byter samtidigt notis: ytan är inte hårdkodad.
  const snapshot = snapshotOrThrow();
  const carried = withoutStyles(
    renderToStaticMarkup(
      createElement(FactoryRoomHeader, {
        snapshot,
        fixture: true,
        workDomain: "CUSTOMER_PRODUCTION",
        now: new Date("2026-01-02T00:00:23.000Z"),
      }),
    ),
  );
  const carriedTag = indicatorTags(carried)[0];
  assert.ok(carriedTag, "huvudet renderar ingen arbetsdomänsrad");
  assert.equal(
    attr(carriedTag, WORK_DOMAIN_ATTRIBUTE),
    "CUSTOMER_PRODUCTION",
    "huvudet visar inte den domän det fått",
  );
  assert.ok(carried.includes("KUNDPRODUKTION"), "etiketten renderades inte i huvudet");
  assert.ok(
    carried.includes(WORK_DOMAIN_PRESENTATION.CUSTOMER_PRODUCTION.description),
    "notisen beskriver inte den domän som bärs",
  );
  assert.ok(
    !carried.includes(WORK_DOMAIN_ABSENT_NOTE),
    "huvudet påstår att domänen saknas trots att den bärs",
  );

  // Och utan värde faller huvudet tillbaka till em-strecket, inte till ett förval.
  const empty = withoutStyles(
    renderToStaticMarkup(
      createElement(FactoryRoomHeader, {
        snapshot,
        fixture: true,
        now: new Date("2026-01-02T00:00:23.000Z"),
      }),
    ),
  );
  const emptyTag = indicatorTags(empty)[0];
  assert.ok(emptyTag, "huvudet utan värde renderar ingen arbetsdomänsrad");
  assert.equal(attr(emptyTag, WORK_DOMAIN_ATTRIBUTE), MISSING);
  assert.ok(
    !empty.includes("KUNDPRODUKTION") && !empty.includes("SYSTEMFÖRBÄTTRINGAR"),
    "huvudet renderade en domänetikett utan att ha fått ett värde",
  );
});

/* ────────────────────────────────────────────────────────────────────────────
 * D · INGEN HÄRLEDNING — VARKEN UR ETT NAMN ELLER UR EN MODELL
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * LÖGNSTUBBEN: exakt den regression kontraktet finns för.
 *
 * Någon «råkar veta» att systemarbetet ligger i ett visst kodförråd och låter ytan läsa domänen
 * ur namnet. Det ser harmlöst ut, är rätt i nio fall av tio — och gör den tionde till ett
 * påhittat påstående om vad Nortropic håller på med. Stubben lever här, i provet, så att
 * skanningen kan visa att den FAKTISKT fälls.
 */
const LIE_STUB = [
  "export function workDomainFromRepository(repository: string): string | null {",
  '  if (repository.includes("nortropic-system")) return "SYSTEM_IMPROVEMENT";',
  '  return repository.startsWith("kund-") ? "CUSTOMER_PRODUCTION" : null;',
  "}",
].join("\n");

/** Mönster som INTE får finnas i kontraktsfilens kod. Varje rad har ett skäl. */
const NO_DERIVATION: { pattern: RegExp; why: string }[] = [
  { pattern: /\brepo\w*/i, why: "kodförrådsnamn i koden" },
  { pattern: /\.(startsWith|endsWith|match|search|split)\s*\(/, why: "strängmatchning" },
  { pattern: /new RegExp|\.test\s*\(/, why: "reguljärt uttryck" },
  { pattern: /toLowerCase|toUpperCase|normalize\s*\(/, why: "normalisering före en matchning" },
  {
    pattern: /\b(classif|infer|guess|heuristic|llm|prompt|anthropic|openai|completion)/i,
    why: "modell- eller klassificerarväg",
  },
];

test("LANE-INGEN-HÄRLEDNING: kontraktsfilen matchar inga namn, och lögnstubben fälls", () => {
  const raw = read(LANE_PATH);
  const code = stripComments(raw);
  assert.ok(code.length > 400, "kontraktsfilen är tom efter kommentarsskalning — mätaren mäter inget");

  /*
    1 · KODFÖRRÅDSNAMNET FINNS INTE ENS I EN KOMMENTAR. Här mäts RÅ källa med flit: strängen är
    det som gör en härledning möjlig att skriva av misstag, och en fil som redan bär den är ett
    klipp-och-klistra bort från regressionen.
  */
  assert.ok(
    !/nortropic-system/i.test(raw),
    `${LANE_PATH} bär ett kodförrådsnamn — härledningen är då en rad bort`,
  );

  // 2 · Och koden bär ingen matchningsväg alls.
  for (const rule of NO_DERIVATION) {
    assert.ok(!rule.pattern.test(code), `${LANE_PATH}: ${rule.why} (${rule.pattern})`);
  }

  /*
    3 · DEN ENDA JÄMFÖRELSEN ÄR MEDLEMSKAP I DEN SLUTNA LISTAN. `includes` är tillåtet exakt där
    det står på WORK_DOMAINS — varje annan användning vore en delsträngsmatchning mot något annat,
    alltså början på en härledning.
  */
  const includeLines = code.split("\n").filter((line) => line.includes(".includes("));
  assert.ok(includeLines.length > 0, "filen jämför inte mot listan alls — mätaren mäter fel fil");
  for (const line of includeLines) {
    assert.ok(
      line.includes("WORK_DOMAINS") || line.includes("COMPOSER_INTENT_WORK_DOMAIN"),
      `en delsträngsmatchning utanför den slutna listan: ${line.trim()}`,
    );
  }

  /*
    4 · SKANNINGEN ÄR VERKLIG: lögnstubben fälls av flera av mätarna ovan. Ett mönster som inte
    kan fälla sitt eget brott mäter ingenting.
  */
  assert.ok(/nortropic-system/i.test(LIE_STUB), "stubben bär inte namnet den påstås härleda ur");
  const caught = NO_DERIVATION.filter((rule) => rule.pattern.test(LIE_STUB));
  assert.ok(caught.length >= 2, `skanningen fäller bara ${caught.length} mönster i lögnstubben`);
  assert.ok(
    LIE_STUB.split("\n")
      .filter((line) => line.includes(".includes("))
      .every((line) => !line.includes("WORK_DOMAINS")),
    "stubben skulle passera medlemskapsregeln — den provar då inte rätt regression",
  );

  /*
    5 · OCH SEMANTIKEN SKILJER SIG, INTE BARA STAVNINGEN. Den riktiga upplösaren svarar `null` på
    exakt den indata stubben skulle svara SYSTEM_IMPROVEMENT på.
  */
  assert.equal(resolveWorkDomain({ repository: "Nortropic/nortropic-system" }), null);
  assert.equal(resolveWorkDomain({ title: "Förbättra Nortropic", source: "nortropic-system" }), null);
  assert.equal(resolveWorkDomain({ task_id: "p-205", state: "WORKING" }), null);
});

test("LANE-INGEN-HÄRLEDNING: intentionsbindningen är deklarerad, sluten och fail-closed", () => {
  /*
    Kompositörens två affordanser är ägarens §6-väg: ett UTTRYCKLIGT operatörsval. Bindningen är
    därför en handskriven tabell — men den måste vara SLUTEN, annars är den en gissningsmaskin
    med ett annat namn.
  */
  assert.deepEqual(
    Object.keys({ ...COMPOSER_INTENT_WORK_DOMAIN }).sort(),
    COMPOSER_LANES.map((lane) => lane.id).sort(),
    "tabellen och kompositörens affordanser har glidit isär",
  );
  assert.equal(intentWorkDomain("kundproduktion"), "CUSTOMER_PRODUCTION");
  assert.equal(intentWorkDomain("systemforbattringar"), "SYSTEM_IMPROVEMENT");

  for (const stranger of ["", "KUNDPRODUKTION", "kund", "kundproduktion ", "constructor",
    "__proto__", "toString", "nortropic-system"]) {
    assert.equal(
      intentWorkDomain(stranger),
      null,
      `«${stranger}» fick en arbetsdomän utan att stå i tabellen`,
    );
  }

  // Och de två affordanserna bär var sin domän i markupen — aldrig samma, aldrig gissad.
  const composer = renderToStaticMarkup(createElement(WorkComposer, {}));
  const lanes = tagsWith(composer, "data-composer-lane");
  assert.equal(lanes.length, 2, "kompositören renderar inte två affordanser");
  const carried = lanes.map((lane) => attr(lane, WORK_DOMAIN_ATTRIBUTE));
  assert.deepEqual(
    carried,
    COMPOSER_LANES.map((lane) => intentWorkDomain(lane.id)),
    "affordansernas märkning följer inte den deklarerade tabellen",
  );
  assert.deepEqual([...carried].sort(), [...WORK_DOMAINS].sort(), "de två spåren delar domän");
});

/* ────────────────────────────────────────────────────────────────────────────
 * E · SHOWROOMETS SCENARIER BÄR DOMÄNEN UTTRYCKLIGEN
 * ──────────────────────────────────────────────────────────────────────────── */

test("LANE-SCENARIO: varje scenario bär sin domän i metadatan, och väljaren renderar den", () => {
  assert.equal(SHOWROOM_SCENARIOS.length, SHOWROOM_SCENARIO_IDS.length);

  for (const scenario of SHOWROOM_SCENARIOS) {
    /*
      VÄRDET STÅR I POSTEN — det är hela poängen. En domän som bara fanns i en vy hade varit ett
      förval; här är den metadata på scenariot, läst genom samma upplösare som allt annat.
    */
    assert.ok(
      Object.hasOwn(scenario, WORK_DOMAIN_FIELD),
      `scenariot ${scenario.id} bär ingen arbetsdomän i sin metadata`,
    );
    assert.equal(resolveWorkDomain(scenario), scenario.work_domain);
    assert.equal(
      scenarioWorkDomain(scenario.id),
      scenario.work_domain,
      `${scenario.id}: uppslaget och metadatan säger olika saker`,
    );
    /*
      OCH BÅDA DAGENS SCENARIER SKILDRAR SYSTEMFÖRBÄTTRINGSSPÅRET — ärligt, per ägarens §11:
      fixturkatalogen ÄR bootstrap-loopen som bygger Nortropic självt. Den dagen ett
      kundproduktionsscenario finns (LANE-02) faller den här raden och ska skrivas om.
    */
    assert.equal(
      scenario.work_domain,
      CURRENT_BOOTSTRAP_WORK_DOMAIN,
      `${scenario.id} märks som ett annat spår än det fixturen faktiskt visar`,
    );
  }

  // Väljaren renderar det valda scenariots domän — etikett OCH maskinläsbart värde.
  for (const id of SHOWROOM_SCENARIO_IDS) {
    const html = withoutStyles(renderToStaticMarkup(createElement(ScenarioPicker, { current: id })));
    const tags = indicatorTags(html);
    assert.equal(tags.length, 1, `${id}: väljaren renderar inte exakt en domänrad`);
    assert.equal(
      attr(tags[0], WORK_DOMAIN_ATTRIBUTE),
      scenarioWorkDomain(id),
      `${id}: väljarens märkning följer inte scenariots metadata`,
    );
    assert.ok(
      html.includes(WORK_DOMAIN_PRESENTATION.SYSTEM_IMPROVEMENT.label),
      `${id}: domänetiketten renderas inte i klartext`,
    );
    assert.ok(html.includes(SCENARIO_WORK_DOMAIN_CAPTION), `${id}: raden säger inte vems domän det är`);
  }
  assert.equal(SCENARIO_WORK_DOMAIN_CAPTION.length > 0, true);
  assert.notEqual(
    SCENARIO_WORK_DOMAIN_CAPTION,
    WORK_DOMAIN_CAPTION,
    "scenariots rad och rummets rad har samma etikett — de påstår då samma sak om olika saker",
  );
  assert.equal(DEFAULT_SCENARIO, "full");

  /*
    ETT SCENARIO UTAN VÄRDE FÅR INGEN DOMÄN. Mätt på en post av samma FORM som en riktig, fast
    utan fältet: upplösaren svarar null och ytan em-streck — ingen etikett härleds ur id eller
    rubrik.
  */
  const withoutDomain = { id: "tom", label: "Tom fabrik", description: "…" };
  assert.equal(resolveWorkDomain(withoutDomain), null);
  assert.match(renderIndicator(resolveWorkDomain(withoutDomain)), /data-missing="true"[^>]*>—</);
});

test("LANE-SCENARIO: domänen är rumsnivå-presentation — schema och fixturer är orörda", () => {
  /*
    Ägarens §3 och §14 tillåter scenariometadata, aldrig kontraktsdata. Fixturkatalogen är
    dessutom GENERERAD: ett domänfält där hade varit handskriven data i en generator, alltså
    exakt det lib/loop/room/scenarios.ts:s egna bindande regler förbjuder.
  */
  const fixtureDir = join(REPO_ROOT, "lib/loop/fixtures");
  const files = readdirSync(fixtureDir, { recursive: true, encoding: "utf8" })
    .filter((name) => /\.(ts|json)$/.test(name))
    .map((name) => ({ path: `lib/loop/fixtures/${name}`, source: read(`lib/loop/fixtures/${name}`) }));
  assert.ok(files.length >= 2, `hittade bara ${files.length} fixturfiler — mätaren mäter ingenting`);

  for (const { path, source } of files) {
    for (const pattern of [/work_domain/, /CUSTOMER_PRODUCTION/, /SYSTEM_IMPROVEMENT/]) {
      assert.ok(!pattern.test(source), `${path} bär ${pattern} — domänen har läckt in i kontraktsdata`);
    }
  }

  // Och scenariomodulen bygger fortfarande ingen egen snapshot: den väljer bland genererade.
  const module = stripComments(read("lib/loop/room/scenarios.ts"));
  assert.ok(!/schema_version|backlog:\s*\[|current_task:/.test(module), "modulen skriver egen data");
  assert.match(module, /fixtureSnapshot|fixtureEmptySnapshot/, "modulen läser inte fixturingången");
});

/* ────────────────────────────────────────────────────────────────────────────
 * F · SKIVANS EGNA FILER — ANDEL, RÖRELSE, LOGGNING, FRAMSTEG
 * ──────────────────────────────────────────────────────────────────────────── */

test("LANE-NEG: skivans filer bär varken andel, rörelse, loggning eller framstegselement", () => {
  /*
    Samma grepp och samma räckviddsdisciplin som V2/ROOM-01: tecknet skrivs som teckenkod så att
    den här filen inte fäller sig själv om den någon gång kommer med i en rekursiv mätning, och
    mönstren körs på KOD med kommentarerna bortskalade — en fil som i klartext förbjuder en
    framstegsstapel får inte fällas av sitt eget förbud.
  */
  const PERCENT = String.fromCharCode(37);
  const MOTION = /@keyframes|animation:|animate-/i;
  const CONSOLE = /console\.(log|info|warn|error|debug|trace)\s*\(/;
  const PROGRESS = /<progress|role=["']progressbar|aria-valuenow|<meter\b/i;
  const NETWORK = /\bfetch\s*\(|XMLHttpRequest|EventSource|WebSocket|child_process/;

  for (const path of SLICE_FILES) {
    const code = stripComments(read(path));
    assert.ok(!code.includes(PERCENT), `andelstecken i ${path}`);
    assert.ok(!MOTION.test(code), `fabricerad rörelse i ${path}`);
    assert.ok(!CONSOLE.test(code), `loggning i ${path}`);
    assert.ok(!PROGRESS.test(code), `framstegselement i ${path}`);
    assert.ok(!NETWORK.test(code), `nätverks- eller exekveringsväg i ${path}`);
  }

  // LÖGNSTUBBAR: varje mönster måste fälla sitt eget brott.
  assert.ok(MOTION.test(".x { animation: none; }"));
  assert.ok(CONSOLE.test("console.warn('x');"));
  assert.ok(PROGRESS.test('<progress value="1" max="2" />'));
  assert.ok(NETWORK.test("const r = await fetch('/api/loop/snapshot');"));
  assert.ok(`width: 100${PERCENT}`.includes(PERCENT));

  // Och den renderade markupen bär inget av det heller.
  const html = [
    renderRoom(),
    renderToStaticMarkup(createElement(ScenarioPicker, { current: DEFAULT_SCENARIO })),
    renderIndicator(null),
    renderIndicator("SYSTEM_IMPROVEMENT"),
  ].join("\n");
  assert.ok(!html.includes(PERCENT), "andelstecken i den renderade markupen");
  assert.ok(!/<progress|<meter\b|progressbar|aria-valuenow/i.test(html), "framstegselement i markupen");
  assert.ok(!/@keyframes|animation:/i.test(html), "rörelse i den renderade markupen");
});
