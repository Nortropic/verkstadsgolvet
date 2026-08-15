/**
 * V2 · Transportgrind för app/api/loop/**.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN ("Hela `/loop`-trädet ligger bakom
 * en env-flagga `LOOP_ENABLED` … Av → nav-posten döljs och routerna svarar 404/403") och
 * ENV-tabellen ("`LOOP_ENABLED=false` | nav-posten dold; direktlänk → routen finns inte").
 *
 * UPPHÄVD SOM PRODUKTGRIND — OCH BARA SOM DET
 * -------------------------------------------
 * ROUTE_PLAN:s SYNLIGHETSREGEL ("routen finns inte") är upphävd av ägarbeslutet i
 * docs/nortropic-factory-room-roadmap-erratum-01.md: SHOWROOM_BEFORE_BACKEND_COMPLETE=YES och
 * HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO. Produktens läge ägs sedan dess av lib/loop/room/mode.ts
 * (FACTORY_ROOM_MODE, fail-closed till "SHOWROOM"), och de inloggade sidorna /loop och
 * /loop/mata renderar utan den här flaggan.
 *
 * DEN HÄR FILEN LEVER VIDARE OFÖRÄNDRAD som grind för app/api/loop/** — läsytan, kommandoytan
 * och strömmen — ända till live-skivan (ROOM-05, blockerad på backend S5 + S13). Ingenting i
 * upphävandet rör transportgrinden, dess fail-closed-form eller någon route-grind.
 *
 * BINDANDE: grinden är EXAKT-MATCHNING mot strängen "true" — precedens ONBOARDING_ENABLED i
 * app/(app)/onboarding/page.tsx. Allt annat (osatt, "1", "TRUE", "yes", tom sträng) är AV.
 * Fail-closed: en okänd eller trasig konfiguration öppnar aldrig transporten.
 *
 * Grinden är en PRODUKT-/TRANSPORTGRIND, aldrig en säkerhetsgräns: middleware.ts + auth() gatar
 * inloggning, och den här filen rör varken sessioner, credentialer eller Nortropics kontrollplan.
 */

/** Det enda värde som slår på Maskinen. Bärs som konstant så ingen läsare behöver gissa. */
export const LOOP_ENABLED_TRUE = "true";

/**
 * Läser flaggan. `env` injiceras för att provet ska kunna mäta grinden utan att mutera
 * processens riktiga miljö.
 */
export function isLoopEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.LOOP_ENABLED === LOOP_ENABLED_TRUE;
}
