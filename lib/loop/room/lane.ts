/**
 * LANE-01 · ARBETSDOMÄNEN — Nortropics två fabriksspår, som TYPAD PRESENTATION.
 *
 * KÄLLA: ägarens frysta förtydligande i docs/nortropic-factory-room-lanes-clarification.md §1–§3
 * och §11. Nortropic tar emot två SLAGS arbete: KUNDPRODUKTION (bygg eller ändra en kunds
 * webbplats) och SYSTEMFÖRBÄTTRINGAR (Nortropic förbättrar sin egen maskin). Ägarens §3 kräver
 * «minsta säkra typade presentationsmodell» och EN kanonisk fältstavning.
 *
 * FÄLTNAMNET, OCH VARFÖR DET BLEV `work_domain`
 * ---------------------------------------------
 * Ägaren lämnade tre kandidater: `work_domain`, `factory_lane`, `project_kind`. Valet är
 * `work_domain`, och skälet är husets egen namnkonvention, inte smak:
 *
 *   · `factory_lane` KROCKAR MED EN BEFINTLIG STAVNING. «Bana» är redan rummets LAYOUTBEGREPP:
 *     `data-room-lane="in|focus|out"` i components/loop/MaskinShell.tsx och klassfamiljen
 *     `.rm-lane*` i components/loop/room/ui.ts betecknar tre SPALTER (in → arbete → ut). Ett
 *     andra «lane» med en helt annan betydelse hade gjort båda oläsbara vid en snabb blick.
 *   · `project_kind` LOVAR ETT PROJEKTOBJEKT som kontraktet inte har. lib/loop/schema.ts känner
 *     `run`, `task`, `attempt`, `candidate` — inget «project». Ett fältnamn får inte antyda en
 *     entitet som ingen snapshot bär.
 *   · `work_domain` ÄR SNAKE_CASE som resten av kontraktsvokabulären (`task_id`, `run_id`,
 *     `seq_watermark`, `confirmed_ts`) och beskriver exakt det ägaren beskriver: vilket SLAGS
 *     arbete det handlar om — inte var det ritas och inte vilket objekt det tillhör.
 *
 * Stavningen bärs som konstant (`WORK_DOMAIN_FIELD`) så att ingen yta stavar den för hand, och
 * så att den dag controllern publicerar sitt eget fält (LANE-08) bytet syns på ett ställe.
 *
 * VAD DEN HÄR FILEN ALDRIG GÖR — DE FYRA HÅRDA REGLERNA
 * -----------------------------------------------------
 *   1. ARBETSDOMÄNEN ÄR INGET TILLSTÅND. Värdena läggs ALDRIG till i TASK_LIFECYCLE och renderas
 *      aldrig som ett uppgiftstillstånd. Elva tillstånd är elva tillstånd; en domän är en annan
 *      axel, precis som ägarens §3 säger.
 *   2. INGEN HÄRLEDNING UR NAMN. SYSTEMFÖRBÄTTRINGAR härleds aldrig ur ett kodförråds namn, en
 *      titelsträng, en sökväg eller något annat mönster. Filen innehåller därför ingen
 *      textmatchning alls utöver EXAKT likhet mot den slutna listan — och ett prov skannar
 *      källan för att det ska förbli sant.
 *   3. INGEN MODELL, INGEN KLASSIFICERARE. Naturligt språk får föreslå (ägarens §6), men
 *      aldrig avgöra. Den här filen frågar ingenting och gissar ingenting.
 *   4. LIVE-YTAN GISSAR ALDRIG. Saknas ett uttryckligt värde returnerar upplösaren `null`, och
 *      ytan renderar em-streck — samma disciplin som resten av rummet (lib/loop/labels.ts).
 *
 * VAD DEN ÄR TILLS BACKENDEN BÄR VÄRDET: en PRESENTATIONSKONTRAKTSFIL. Showroomets scenarier får
 * bära värdet uttryckligen (lib/loop/room/scenarios.ts), och ytorna får visa det de fått. Inget
 * här rör lib/loop/schema.ts, fixturerna eller någon transport.
 */
import { MISSING } from "../labels";

/**
 * Uppslagstabeller UTAN prototypkedja.
 *
 * Samma grepp och samma skäl som lib/loop/labels.ts: en nyckel kan komma från otrodd indata, och
 * i ett vanligt objektliteral svarar `karta["constructor"]` med en ärvd medlem i stället för
 * `undefined`. Hålet stängs i konstruktionen, inte vid varje anropsplats.
 */
function sealed<T extends object>(entries: T): Readonly<T> {
  return Object.freeze(Object.assign(Object.create(null) as T, entries));
}

/* ────────────────────────────────────────────────────────────────────────────
 * DEN SLUTNA LISTAN
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * De ENDA arbetsdomänerna. Två värden, i den ordning ägarens §1 räknar upp dem.
 *
 * Listan är sluten med avsikt: ett tredje värde är ett produktbeslut, inte en påbyggnad, och ska
 * kräva att den här raden ändras.
 */
export const WORK_DOMAINS = ["CUSTOMER_PRODUCTION", "SYSTEM_IMPROVEMENT"] as const;

export type WorkDomain = (typeof WORK_DOMAINS)[number];

/** Den kanoniska fältstavningen. EN stavning i hela trädet — se filhuvudets motivering. */
export const WORK_DOMAIN_FIELD = "work_domain";

/** Attributet som bär domänen maskinläsbart i markupen. Också det en enda stavning. */
export const WORK_DOMAIN_ATTRIBUTE = "data-work-domain";

/**
 * Ägarens fem lås ur §1, som DATA i stället för som prosa — så att de kan mätas.
 *
 * De beskriver var bootstrap-loopen HÖR HEMMA och vad den INTE är; de är fakta om programmet,
 * aldrig ett förval för en uppgift i en vy.
 */
export const WORK_DOMAIN_LOCKS = {
  FACTORY_LANE_SYSTEM: "SYSTEM_IMPROVEMENT",
  FACTORY_LANE_CUSTOMER: "CUSTOMER_PRODUCTION",
  BOOTSTRAP_AUTOPILOT_PRIMARY_LANE: "SYSTEM_IMPROVEMENT",
  SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY: "NO",
  SHARED_TRUST_KERNEL_BETWEEN_LANES: "YES",
} as const;

/**
 * ÄGARENS DOKUMENTERADE FAKTUM (§11), INTE ETT UI-FÖRVAL.
 *
 * Den nuvarande bootstrap-/autopilotloopen förbättrar Nortropic självt. Konstanten säger exakt
 * det och ingenting mer: den får användas för att märka ett SHOWROOM-scenario som uttryckligen
 * skildrar den loopen, men den får ALDRIG bli det värde en uppgift, en snapshot eller en live-yta
 * antas ha. En uppgift utan uttryckligt värde är okänd, och okänt renderas em-streck.
 */
export const CURRENT_BOOTSTRAP_WORK_DOMAIN: WorkDomain = "SYSTEM_IMPROVEMENT";

/**
 * Kundproduktionsloopen är en SEPARAT framtida förmåga ovanpå den delade tillitskärnan (§11).
 * Bootstrap-autopiloten påstås alltså aldrig redan vara den kompletta kundproduktionsfabriken.
 */
export const CUSTOMER_PRODUCTION_LOOP_STATUS = "SEPARATE_FUTURE_CAPABILITY";

/* ────────────────────────────────────────────────────────────────────────────
 * PRESENTATION
 * ──────────────────────────────────────────────────────────────────────────── */

export type WorkDomainPresentation = {
  /** Svensk etikett, versal som rummets övriga märken. Ägarens ordval i §2. */
  label: string;
  /** EN rad om vad domänen omfattar. Beskriver arbete, aldrig ett systemtillstånd. */
  description: string;
};

/**
 * Etiketterna och deras enda rad.
 *
 * Raderna är skrivna i var sin domäns språk (§4 och §5): kundspåret talar om en webbplats,
 * systemspåret om Nortropics egen maskin. Ingen av dem påstår ett läge, en andel eller ett
 * framsteg — de säger vad slags arbete spåret innehåller.
 */
export const WORK_DOMAIN_PRESENTATION: Readonly<Record<WorkDomain, WorkDomainPresentation>> =
  sealed<Record<WorkDomain, WorkDomainPresentation>>({
    CUSTOMER_PRODUCTION: {
      label: "KUNDPRODUKTION",
      description:
        "Arbete vars resultat är kundens webbplats: brief, research, plan, bygge, visuell och " +
        "teknisk kvalitet, förhandsvisning, driftsättning och eftersmoke.",
    },
    SYSTEM_IMPROVEMENT: {
      label: "SYSTEMFÖRBÄTTRINGAR",
      description:
        "Arbete vars resultat är Nortropic självt: förmågor, grindar, granskning, publicering " +
        "och de invarianter maskinen körs under.",
    },
  });

/**
 * Etiketten över RUMMETS värde. En rad bredvid värdet, aldrig ett eget fält med egen rubrik.
 *
 * DEN NAMNGER SIN ÄGARE, OCH DET ÄR INTE ORDRIKEDOM. Showroomets väljare bär en egen rad några
 * hundra pixlar högre upp («Scenariots arbetsdomän», lib/loop/room/scenarios.ts) medan rummet
 * visar just det scenariots fixtur. Stod den ena raden med ägare och den andra utan blev den
 * generella den svagare halvan av paret: em-strecket kunde då läsas som ett trasigt fält i
 * stället för som «rummets EGEN domän är okänd». Båda raderna säger därför vems domän de visar,
 * och skillnaden mellan dem går att läsa utan att veta hur ytorna hänger ihop.
 */
export const WORK_DOMAIN_CAPTION = "Rummets arbetsdomän";

/**
 * Notisen när ingen domän följer med.
 *
 * Den säger VARFÖR fältet är tomt, i stället för att lämna ett em-streck utan orsak: kontraktet
 * i lib/loop/schema.ts bär inget arbetsdomänfält, och rummet fyller aldrig i controllerns
 * tillstånd åt den. Den dag controllern publicerar värdet (LANE-08) byts notisen mot data.
 */
export const WORK_DOMAIN_ABSENT_NOTE =
  "Arbetsdomänen står som em-streck: kontraktet bär inget sådant fält ännu, och rummet " +
  "härleder den aldrig ur namn, titlar eller något annat mönster.";

/* ────────────────────────────────────────────────────────────────────────────
 * UPPLÖSNING — BARA ETT UTTRYCKLIGT BURET VÄRDE RÄKNAS
 * ──────────────────────────────────────────────────────────────────────────── */

/** Är värdet en av de två domänerna? EXAKT likhet mot den slutna listan, inget skiftlägestrick. */
export function isWorkDomain(value: unknown): value is WorkDomain {
  return typeof value === "string" && (WORK_DOMAINS as readonly string[]).includes(value);
}

/**
 * Domänen ur en bärare — eller `null`.
 *
 * BÄRAREN ÄR EN VALIDERAD SHOWROOM-SCENARIO-BESKRIVNING (lib/loop/room/scenarios.ts), och
 * upplösaren accepterar ENBART ett uttryckligt, egenägt `work_domain` med ett av de två värdena.
 * Allt annat — `undefined`, `null`, en tom sträng, fel skiftläge, en siffra, en lista, ett
 * ÄRVT fält ur en prototyp — ger `null`, och ytan renderar em-streck.
 *
 * `Object.hasOwn` är inte dekoration: `Object.create({ work_domain: "…" })` hade annars läckt in
 * ett värde ingen skrev, alltså exakt en gissning genom bakdörren.
 */
export function resolveWorkDomain(carrier: unknown): WorkDomain | null {
  if (typeof carrier !== "object" || carrier === null) return null;
  if (!Object.hasOwn(carrier, WORK_DOMAIN_FIELD)) return null;
  const carried = (carrier as Record<string, unknown>)[WORK_DOMAIN_FIELD];
  return isWorkDomain(carried) ? carried : null;
}

/** Etiketten för en domän, eller em-streck. Ingen yta stavar em-strecket för hand. */
export function workDomainLabel(domain: WorkDomain | null): string {
  return domain === null ? MISSING : WORK_DOMAIN_PRESENTATION[domain].label;
}

/** Raden under värdet: domänens egen beskrivning, eller orsaken till att den saknas. */
export function workDomainNote(domain: WorkDomain | null): string {
  return domain === null ? WORK_DOMAIN_ABSENT_NOTE : WORK_DOMAIN_PRESENTATION[domain].description;
}

/**
 * Det maskinläsbara värdet.
 *
 * Attributet finns ALLTID, också när domänen är okänd — då bär det em-strecket. En yta där
 * attributet ibland saknas gör «okänd» oskiljbar från «omätt», och det är precis den skillnad
 * märkningen finns för att bevara.
 */
export function workDomainAttribute(domain: WorkDomain | null): string {
  return domain === null ? MISSING : domain;
}

/** Mätbart: båda domänerna har en presentation, så ingen kan glömmas bort. */
export function workDomainCoverage(): boolean {
  return WORK_DOMAINS.every((domain) => Boolean(WORK_DOMAIN_PRESENTATION[domain]));
}

/* ────────────────────────────────────────────────────────────────────────────
 * INTENTIONSAFFORDANSERNA — EN DEKLARERAD BINDNING, ALDRIG EN TOLKNING
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Kompositörens två val (components/loop/room/WorkComposer.tsx) bundna till var sin domän.
 *
 * DET HÄR ÄR INGEN HÄRLEDNING. Tabellen är en HANDSKRIVEN bindning mellan två ytor och två
 * värden: «Bygg / ändra kundprojekt» ÄR kundproduktion, «Förbättra Nortropic» ÄR
 * systemförbättring — det är vad affordansen betyder, inte något som räknats fram ur data. Det
 * är också exakt den väg ägarens §6 pekar ut som legitim: uttryckligt operatörsval, aldrig en
 * modell som avgör.
 *
 * Ytorna leder fortfarande båda till samma byggda inlämning, och ingenting lämnas härifrån: det
 * enda den här tabellen tillför är att märkningen på de två länkarna säger vilken domän var och
 * en STÅR FÖR, i stället för att skillnaden bara finns i etikettens text.
 */
export const COMPOSER_INTENT_WORK_DOMAIN: Readonly<Record<string, WorkDomain>> = sealed<
  Record<string, WorkDomain>
>({
  kundproduktion: "CUSTOMER_PRODUCTION",
  systemforbattringar: "SYSTEM_IMPROVEMENT",
});

/**
 * Domänen bakom en intentionsaffordans — eller `null` för en okänd krok.
 *
 * FAIL-CLOSED: ett id som inte står i tabellen får ingen domän. En ny affordans måste alltså
 * skrivas in här av en människa, och kan aldrig få en domän gissad åt sig.
 */
export function intentWorkDomain(intentId: string): WorkDomain | null {
  if (!Object.hasOwn(COMPOSER_INTENT_WORK_DOMAIN, intentId)) return null;
  const bound: unknown = COMPOSER_INTENT_WORK_DOMAIN[intentId];
  return isWorkDomain(bound) ? bound : null;
}
