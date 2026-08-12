/**
 * V2 · Feature-grind för hela /loop-trädet.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN ("Hela `/loop`-trädet ligger bakom
 * en env-flagga `LOOP_ENABLED` … Av → nav-posten döljs och routerna svarar 404/403") och
 * ENV-tabellen ("`LOOP_ENABLED=false` | nav-posten dold; direktlänk → routen finns inte").
 *
 * BINDANDE: grinden är EXAKT-MATCHNING mot strängen "true" — precedens ONBOARDING_ENABLED i
 * app/(app)/onboarding/page.tsx. Allt annat (osatt, "1", "TRUE", "yes", tom sträng) är AV.
 * Fail-closed: en okänd eller trasig konfiguration exponerar aldrig kontrollrumsytan.
 *
 * Grinden är en PRODUKTGRIND, aldrig en säkerhetsgräns: middleware.ts + auth() gatar inloggning,
 * och den här filen rör varken sessioner, credentialer eller Nortropics kontrollplan.
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
