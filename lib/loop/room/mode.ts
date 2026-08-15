/**
 * SHREDDER-01A · Fabriksrummets PRODUKTLÄGE (Factory Room mode).
 *
 * KÄLLA: ägarbeslutet i docs/nortropic-factory-room-roadmap-erratum-01.md
 * (SHOWROOM_BEFORE_BACKEND_COMPLETE=YES · HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO ·
 * FIXTURE_DATA_MUST_BE_EXPLICITLY_LABELLED=YES) ovanpå
 * docs/nortropic-factory-room-master-roadmap-v1.md §ROOM-05 (full live snapshot cutover,
 * blockerad på backend S5 + S13).
 *
 * VAD DEN HÄR FILEN ERSÄTTER
 * --------------------------
 * Den gamla produktregeln var "LOOP_ENABLED av → routen finns inte". Den är UPPHÄVD SOM
 * PRODUKTREGEL: den inloggade routen renderar alltid, och den data som visas märks i stället ut
 * som det den är. components/loop/flag.ts finns kvar som TRANSPORTGRIND för app/api/loop/**,
 * och ingen autentisering, ingen middleware och ingen trust-invariant rörs av det här bytet.
 *
 * FAIL-CLOSED, OCH VARFÖR DET INTE ÄR EN ENV-FLAGGA
 * -------------------------------------------------
 * `LIVE` och `DEGRADED` blir nåbara FÖRST när live-skivan (ROOM-05) faktiskt landar. Tills dess
 * löser `factoryRoomMode` ALLTID ut "SHOWROOM" — oavsett vad FACTORY_ROOM_MODE innehåller
 * (osatt, "live", "LIVE", tom sträng, skräp). En env-variabel får aldrig kunna förvandla
 * simulerad fabriksdata till ett live-påstående: etiketten skulle då ljuga utan att en enda
 * rad kod ändrats. Det är samma disciplin som resten av /loop: hellre ett ärligt läge än ett
 * gissat.
 */

/** Rummets produktlägen. Fler lägen införs bara tillsammans med den skiva som gör dem sanna. */
export type FactoryRoomMode = "SHOWROOM" | "LIVE" | "DEGRADED";

/** Det enda läge som finns idag. Bärs som konstant så ingen yta stavar det för hand. */
export const SHOWROOM: FactoryRoomMode = "SHOWROOM";

/**
 * Är live-läget byggt?
 *
 * NEJ, och det är ett MÄTBART faktum, inte en åsikt: den levande snapshotvägen är ROOM-05 i
 * docs/nortropic-factory-room-master-roadmap-v1.md, blockerad på backend S5 + S13. Flaggan är
 * typad som `boolean` (inte som literalen `false`) så att den dagen ROOM-05 landar syns bytet
 * i en enda rad — och tills dess är varje väg efter den här kontrollen otillgänglig.
 */
export const LIVE_MODE_IMPLEMENTED: boolean = false;

/** Env-variabeln som EN DAG kan välja läge. Idag läses den, men den kan aldrig öppna live. */
export const ROOM_MODE_ENV_VAR = "FACTORY_ROOM_MODE";

/** Attributnamnet som bär läget maskinläsbart i markupen. En enda stavning i hela trädet. */
export const ROOM_MODE_ATTRIBUTE = "data-room-mode";

/** Showroomets märke. ENDA källan till strängen — ingen yta skriver av den. */
export const SHOWROOM_BADGE = "SHOWROOM · SIMULERAD FABRIKSDATA";

/** Kompakt lägesrad för sidhuvuden: läget som en produktrad, inte som en varningsvägg. */
export const SHOWROOM_MODE_LINE = "SHOWROOM · simulerad fabriksdata";

/** En rad operatörsförklaring. Kort med avsikt: detaljerna bärs av de tekniska ytorna. */
export const SHOWROOM_EXPLANATION =
  "Simulerad fabriksdata ur genererade, schemavaliderade fixturer. Ingen livedata, inga " +
  "kommandon skickas.";

/**
 * Löser ut rummets produktläge.
 *
 * `env` injiceras så att provet kan mäta grinden utan att mutera processens riktiga miljö —
 * samma form som components/loop/flag.ts.
 *
 * ORDNINGEN ÄR BINDANDE: så länge `LIVE_MODE_IMPLEMENTED` är falskt returneras "SHOWROOM"
 * INNAN något värde tolkas. Läget kan därför inte flyttas av konfiguration, bara av kod.
 */
export function factoryRoomMode(
  env: Record<string, string | undefined> = process.env,
): FactoryRoomMode {
  const requested = (env[ROOM_MODE_ENV_VAR] ?? "").trim();

  if (!LIVE_MODE_IMPLEMENTED) return SHOWROOM;

  // Nås först när ROOM-05 landat. Exakt-matchning, fail-closed för allt annat.
  if (requested === "LIVE") return "LIVE";
  if (requested === "DEGRADED") return "DEGRADED";
  return SHOWROOM;
}
