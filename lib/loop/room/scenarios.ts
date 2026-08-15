/**
 * SHREDDER-01B · SHOWROOM-SCENARIER — ett SLUTET urval bland GENERERADE fixturer.
 *
 * KÄLLA: ägarbeslutet i docs/nortropic-factory-room-roadmap-erratum-01.md §owner-11
 * (showroomet ska kunna visa fabriken både full och tom) ovanpå SHREDDER-01A:s lägeskontrakt
 * i lib/loop/room/mode.ts.
 *
 * VAD EN SCENARIO ÄR — OCH INTE ÄR
 * --------------------------------
 * En scenario är ett VAL MELLAN REDAN GENERERADE, SCHEMAVALIDERADE fixturer. Den är inte en
 * inställning i produkten, inte ett kommando och inte ett läge: den byter bara vilken av
 * fixturkatalogens ögonblicksbilder showroomet visar upp.
 *
 * BINDANDE REGLER
 * ---------------
 * · SLUTEN LISTA. Varje värde som inte står i `SHOWROOM_SCENARIO_IDS` faller till förvalet.
 *   En okänd parameter kan därför aldrig välja en fjärde datakälla, och aldrig tomma rummet av
 *   misstag: fail-closed mot det förvalda, fulla scenariot.
 * · ALDRIG HANDSKRIVEN DATA. Båda ögonblicksbilderna kommer ur lib/loop/fixtures, alltså ur
 *   generatorn, och går genom V1:s validering innan de når en yta. Den här filen bygger ingen
 *   egen snapshot och redigerar aldrig en fixtur.
 * · INGEN AUTHORITY. Valet ändrar ingenting i controllern, köar ingenting och skickar ingenting.
 *   Det är en visning av simulerad fabriksdata, och ytan som renderar valet märker det som sådant.
 * · MERGE_CONFLICT KAN INTE VISAS I NÅGON SCENARIO. Fixturens `merge` är null i hela katalogen
 *   (opaka kontrakt läses aldrig fältvis), så ingen scenario får påstå en merge-konflikt. Den
 *   dagen kontraktet bär ett merge-utfall är det generatorns sak att lägga in det — inte den
 *   här filens att hitta på.
 */
import { fixtureEmptySnapshot, fixtureSnapshot } from "@/lib/loop/fixtures";
import type { LoopSnapshot } from "@/lib/loop/schema";

/** Frågeparametern som bär valet. EN stavning i hela trädet. */
export const SCENARIO_PARAM = "scenario";

/** Rubriken över valet. Den säger vad valet ÄR, så att det aldrig läses som en körkontroll. */
export const SCENARIO_PICKER_LABEL = "Showroom-scenario";

/**
 * Ankaret till väljaren. EN stavning, delad av ytan som BÄR ankaret och ytan som PEKAR på det,
 * så att de två inte kan glida isär den dag namnet ändras.
 */
export const SCENARIO_ANCHOR_ID = "showroom-scenario";

/**
 * Etiketten på pekaren i rummet.
 *
 * Den är MED FLIT riktningslös. Vid ≥720 px står väljaren ovanför rummet, vid ≤719 px under det:
 * en text som sa «längst ned» hade varit osann i den ena vyn, och en yta som ljuger om var en
 * kontroll finns är värre än ingen pekare alls. Ett ankare hittar väljaren i båda fallen.
 */
export const SCENARIO_POINTER_LABEL = "Byt showroom-scenario";

/**
 * VALETS GRÄNS, SOM EN EGEN MENING — DÄRFÖR ATT DEN IBLAND MÅSTE STÅ FRAMME.
 *
 * Väljer man «Tom fabrik» töms kön, blicken och hyllan medan tidslinjen står kvar full av
 * fixturposter. Det är sant och ofarligt, men det SYNS som en motsägelse på skärmen, och en
 * motsägelse vars förklaring ligger bakom en stängd lucka är en förklaring som inte finns. Meningen
 * bor därför här, används både i den kompakta raden vid valet och i den fulla notisen nedan, och
 * kan inte drifta isär mellan de två ställena.
 */
export const SCENARIO_TIMELINE_SCOPE_NOTE =
  "Tidslinjens fixturposter längre ned följer inte valet.";

/**
 * Notisen under valet. Kort med avsikt: den säger vad valet gör OCH vad det inte rör.
 *
 * RÄCKVIDDEN STÅR UTSKRIVEN, EFTERSOM DEN ÄR MINDRE ÄN NAMNET ANTYDER. Valet byter EN sak:
 * snapshoten, alltså kön, blicken och hyllan. Tidslinjen monteras av skalet med sin egen
 * fixturflagga och läser fixturkatalogens inlämningar och kvitton direkt — den följer alltså
 * inte valet, och en «tom fabrik» med kvarstående poster i tidslinjen vore en motsägelse på
 * samma skärm om ingen skrev ut det.
 */
export const SCENARIO_PICKER_NOTE =
  "Väljer vilken genererad, schemavaliderad ögonblicksbild kön, blicken och hyllan visar. " +
  `${SCENARIO_TIMELINE_SCOPE_NOTE} Ingenting skickas, ingenting ändras i controllern och ingen ` +
  "körning berörs.";

/** De ENDA tillåtna scenarierna. Listan är stängd, och ordningen är den som visas. */
export const SHOWROOM_SCENARIO_IDS = ["full", "tom"] as const;

export type ShowroomScenarioId = (typeof SHOWROOM_SCENARIO_IDS)[number];

/** Förvalet. Ingen parameter, ett okänt värde eller flera värden ger ALLTID det här. */
export const DEFAULT_SCENARIO: ShowroomScenarioId = "full";

export type ShowroomScenario = {
  id: ShowroomScenarioId;
  /** Etiketten på länken. */
  label: string;
  /** En rad om vad fixturen innehåller. Beskriver data, aldrig ett systemtillstånd. */
  description: string;
};

/**
 * Scenarierna, i visningsordning.
 *
 * "Full fabrik" är V1:s genererade snapshot: den bär EN uppgift i varje kanoniskt tillstånd, så
 * kön, blicken och hyllan går alla att inspektera. "Tom fabrik" är den genererade tomma
 * snapshoten: ingen uppgift i någon av de tre.
 *
 * BESKRIVNINGARNA BESKRIVER BARA DET VALET FAKTISKT BYTER. Den tomma fixturen tömmer snapshoten,
 * inte skärmen: tidslinjen läser fixturkatalogen direkt och står kvar. En rad som lovade «hur
 * rummet ser ut innan något matats in» hade därför motsagts av posterna längre ned på samma
 * skärm — precis den sortens oförtjänta påstående rummet finns för att undvika.
 */
export const SHOWROOM_SCENARIOS: readonly ShowroomScenario[] = [
  {
    id: "full",
    label: "Full fabrik",
    description: "Kö, pågående arbete och hylla — en uppgift i varje kanoniskt tillstånd.",
  },
  {
    id: "tom",
    label: "Tom fabrik",
    description: "Ingen uppgift i kön, blicken eller hyllan.",
  },
] as const;

/**
 * Scenariot bakom ett id. Listan är sluten och id:t är typat, så uppslaget kan inte missa; skulle
 * det ändå göra det är förvalet det ärliga svaret, aldrig ett tomt fält.
 */
export function scenarioById(id: ShowroomScenarioId): ShowroomScenario {
  return SHOWROOM_SCENARIOS.find((scenario) => scenario.id === id) ?? SHOWROOM_SCENARIOS[0];
}

/** Är strängen ett av de tillåtna scenarierna? Exakt-matchning, inget skiftlägestrick. */
export function isScenarioId(value: unknown): value is ShowroomScenarioId {
  return (
    typeof value === "string" && (SHOWROOM_SCENARIO_IDS as readonly string[]).includes(value)
  );
}

/**
 * Löser ut scenariot ur ett rått parametervärde.
 *
 * FAIL-CLOSED MOT FÖRVALET: undefined, tom sträng, skräp, ett annat skiftläge eller en upprepad
 * parameter (som Next levererar som en lista) ger `DEFAULT_SCENARIO`. En okänd parameter får
 * aldrig ge en tom vy — det hade sett ut som en fabrik utan arbete.
 */
export function resolveScenario(raw: string | string[] | undefined | null): ShowroomScenarioId {
  if (Array.isArray(raw)) return DEFAULT_SCENARIO;
  return isScenarioId(raw) ? raw : DEFAULT_SCENARIO;
}

/**
 * Ögonblicksbilden för ett scenario — ALLTID ur den genererade katalogen, alltid validerad.
 *
 * Returnerar `null` precis som fixturingången gör när en fixtur inte validerar. Skalet renderar
 * då sitt synliga tomläge med orsak, i stället för en gissad vy.
 */
export function scenarioSnapshot(id: ShowroomScenarioId): LoopSnapshot | null {
  return id === "tom" ? fixtureEmptySnapshot() : fixtureSnapshot();
}

/**
 * Länken till ett scenario.
 *
 * Förvalet har INGEN parameter: den omärkta adressen /loop ska fortsätta betyda exakt samma sak
 * som den alltid gjort, så att en delad länk aldrig bär ett dolt urval.
 *
 * ETT VAL SOM INTE ÄR FÖRVALET BÄR OCKSÅ ETT ANKARE — OCH SKÄLET ÄR MÄTT.
 *
 * Vid ≤719 px målas väljaren efter hela rummet, alltså tusentals pixlar ned. Utan ankaret ledde
 * ett klick på «Tom fabrik» till sidans TOPP, och operatören mötte då en tom fabrik ovanför en
 * full tidslinje medan meningen som förklarar just den motsägelsen — SCENARIO_TIMELINE_SCOPE_NOTE,
 * som renderas i väljaren — stod kvar längst ned. Det är precis den motsägelse den synliga
 * räckviddsraden finns för att förhindra, återinförd av returvägen.
 *
 * Med ankaret landar man KVAR VID KONTROLLEN man nyss använde: det valda chipet står markerat och
 * räckviddsraden läses i samma ögonblick som valet görs, vilket är det enda ögonblick den
 * verkligen behövs.
 *
 * FÖRVALET FÅR MED FLIT INGET ANKARE. Två skäl, båda konkreta: den omärkta adressen ska förbli
 * byte-identisk med den som alltid gällt (en delad länk får varken bära ett urval eller en
 * scrollposition), och förvalet har ingen motsägelse att förklara — kön, blicken och hyllan är
 * fulla precis som tidslinjen, så räckviddsraden renderas inte ens.
 *
 * ANKARET NÅR ALDRIG SERVERN. Ett fragment skickas inte i förfrågan, så routens urval, den
 * slutna listan och «utan parameter renderas exakt fixtureSnapshot()» är oberörda av den här
 * raden. Den styr var i sidan webbläsaren ställer sig, ingenting annat.
 */
export function scenarioHref(id: ShowroomScenarioId): string {
  return id === DEFAULT_SCENARIO
    ? "/loop"
    : `/loop?${SCENARIO_PARAM}=${id}#${SCENARIO_ANCHOR_ID}`;
}
