/**
 * ROOM-01 · Fabriksrummets huvud — rena visningsvärden ur controllerns snapshot.
 *
 * KÄLLA: docs/nortropic-factory-room-master-roadmap-v1.md §5 (ROOM-01) och
 * docs/nortropic-control-room-plan-v1.md (TARGET_UX, SNAPSHOT_WINS).
 *
 * BINDANDE REGLER SOM FILEN BÄR
 * -----------------------------
 * · Rummet är INGEN authority. Varje värde här kommer ur den snapshot controllern publicerat,
 *   eller ur ingenting alls — och "ingenting alls" renderas som em-streck, aldrig som en gissning.
 * · ÅLDER ÄR INTE LIVENESS. `ageText` räknar ut hur gammal en TIDSSTÄMPEL är; den säger inget om
 *   att något rör sig just nu. Liveness-märket ägs fortfarande av statusraden och står kvar på
 *   "okänt" tills en skiva har en FAKTISK signal.
 * · Rummet öppnar ingen egen anslutning: ONE_TAIL_CONNECTION_PER_FACTORY_ROOM. Den enda
 *   transporten är strömpanelens, och dess läge ägs och renderas av panelen — inte av huvudet.
 * · Ingen klocka läses här. Anroparen skickar in sitt `now`, så värdet är mätbart i prov.
 */
import { MISSING } from "../labels";
import type { LoopSnapshot } from "../schema";

/** Låsen rummet bär, som DATA så att de kan mätas i stället för att bara läsas i prosa. */
export const ROOM_FACTS = {
  ROOM_IS_AUTHORITY: "NO",
  SNAPSHOT_WINS: "YES",
  EVENT_STREAM_IS_AUTHORITY: "NO",
  ONE_TAIL_CONNECTION_PER_FACTORY_ROOM: "YES",
  OPTIMISTIC_AUTHORITATIVE_STATE: "NO",
  /** Kontraktet har inget fält som säger att ägarens behörighet krävs. Se ./attention.ts. */
  OWNER_AUTHORITY_FIELD_IN_SCHEMA: "NONE",
  /** Rummets identitetsremsa uppfinner ingen principal. Se ./identity.ts. */
  EXECUTION_PRINCIPAL_FIELD_IN_SCHEMA: "NONE",
} as const;

export const ROOM_TITLE = "Fabriksrummet";

/**
 * Rummets ingress: EN sats om KÄLLAN, renderad på samma rad som rubriken.
 *
 * KÄLLAN HÄRLEDS, DEN SKRIVS INTE FÖR HAND. Samma disciplin som `maskinHeaderTruth()` i
 * components/loop/ui.ts: är vyn matad med den genererade fixturen SÄGER ingressen fixtur, annars
 * säger den controllerns snapshot. En mening som påstår controllerpublicerad härkomst medan
 * statusraden två rader ned bär märket "FIXTUR · INTE LIVEDATA" är två motstridiga påståenden om
 * samma data — och det är precis det en fixturbaserad skiva aldrig får göra.
 *
 * AXELN STÅR INTE HÄR. Banornas egna etiketter (1 · IN, 2 · ARBETET, 3 · UT) säger redan i vilken
 * ordning rummet läses; en mening som upprepar det kostar bara höjd ovanför arbetsytorna.
 */
export function roomIntro(fixture: boolean): string {
  return fixture
    ? "allt här kommer ur den genererade fixturen, aldrig ur livedata"
    : "allt här kommer ur controllerns publicerade snapshot";
}

/**
 * Rummets ENDA mening om anslutningen, renderad VID STRÖMMEN.
 *
 * Den säger bara det som är rummets eget att säga: rummet öppnar ingen egen anslutning
 * (ONE_TAIL_CONNECTION_PER_FACTORY_ROOM). VEM som äger transportläget står redan i sidhuvudet
 * och i panelen själv — att upprepa det en tredje gång är dubblerad statusinformation, inte
 * extra tydlighet.
 */
export const ROOM_TRANSPORT_NOTE =
  "Rummet öppnar ingen egen anslutning — panelen nedan är rummets enda.";

/**
 * Åldern är en visning av en tidsstämpel, aldrig ett påstående om aktivitet.
 *
 * Texten är kort med avsikt: den står som BILDTEXT till statusradens egen bekräftelse, inte som
 * ett eget stycke. Statusraden äger fortfarande sha och tidsstämpel — åldern är det enda nya.
 */
export const AGE_IS_LIVENESS_SIGNAL = false;
export const AGE_NOTE = "ren visning, ingen liveness-signal";
/**
 * Bildtexten PEKAR på statusradens rad, den påstår ingen härkomst: raden ovan bär redan sin egen
 * etikett och rummet vet i det här läget att värdet kommer ur en fixtur.
 */
export const AGE_CAPTION_LEAD = "Bekräftelsen ovan:";

const MS_MINUTE = 60_000;
const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;

function unit(value: number, one: string, many: string): string {
  return value === 1 ? `1 ${one} sedan` : `${value} ${many} sedan`;
}

/**
 * Hur gammal en tidsstämpel är, i klartext. `null` när stämpeln saknas eller inte går att läsa —
 * en oläslig stämpel blir aldrig "0" och aldrig en uppskattning.
 */
export function ageText(ts: string | null | undefined, now: Date): string | null {
  if (ts === null || ts === undefined) return null;
  const parsed = Date.parse(ts);
  if (!Number.isFinite(parsed)) return null;
  const elapsed = now.getTime() - parsed;
  if (elapsed < 0) return "tidsstämpeln ligger i framtiden";
  if (elapsed < MS_MINUTE) return "under en minut sedan";
  if (elapsed < MS_HOUR) return unit(Math.floor(elapsed / MS_MINUTE), "minut", "minuter");
  if (elapsed < MS_DAY) return unit(Math.floor(elapsed / MS_HOUR), "timme", "timmar");
  return unit(Math.floor(elapsed / MS_DAY), "dygn", "dygn");
}

export type MainConfirmationView = {
  /** Controllerns BEKRÄFTADE main-SHA. Verkstadsgolvet slår aldrig upp något själv. */
  sha: string | null;
  confirmed_ts: string | null;
  /** Klartext, eller null när stämpeln saknas. Vyn renderar då em-streck. */
  age_text: string | null;
};

export function mainConfirmation(
  snapshot: LoopSnapshot | null,
  now: Date,
): MainConfirmationView {
  if (snapshot === null) return { sha: null, confirmed_ts: null, age_text: null };
  const { sha, confirmed_ts } = snapshot.current_main;
  return { sha, confirmed_ts, age_text: ageText(confirmed_ts, now) };
}

/** Bekvämlighet för vyerna: samma em-streck som resten av Maskinen. */
export const ROOM_MISSING = MISSING;
