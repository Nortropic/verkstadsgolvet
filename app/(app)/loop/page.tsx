/**
 * V2 · Maskinen (/loop) — fixturbaserad shell.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN, TARGET_UX och
 * IMPLEMENTATION_SLICES §V2.
 *
 * BINDANDE REGLER
 * ---------------
 * · FAIL-CLOSED: utan `LOOP_ENABLED=true` finns routen inte (notFound → 404). Ingen halv
 *   kontrollrumsyta, ingen förklarande stubbe som läcker funktionen.
 * · Kolumnernas datakälla är V1:s GENERERADE fixtur (lib/loop/fixtures). Den är ALDRIG livedata,
 *   märks ut som fixtur i UI:t, och den delen är inte live-komplett i någon mening.
 * · Sidan monterar sedan V7:s kommandoyta (kanalen STÄNGD — 503 tills backendens skiva finns)
 *   och V9:s strömpanel (som talar med kontrollplanets läsyta på riktigt). Sidhuvudet påstår
 *   därför inte längre att sidan saknar kommandoyta och eventström: den distinktionen —
 *   live / kontraktsläge / fixtur — bärs av MaskinHeader och härleds ur de faktiska lägena.
 * · Routen rör fortfarande ingen Git-, ref-, verifierings- eller promotionsväg och äger ingen
 *   authority: den läser en fixtur, renderar den och låter panelerna bära sina egna lägen.
 * · `force-dynamic` gör att flaggan läses vid REQUEST, inte bakas in vid build — annars hade
 *   ett bygge med flaggan på kunnat servera en förrenderad sida efter att den slagits av.
 */
import { notFound } from "next/navigation";
import { isLoopEnabled } from "@/components/loop/flag";
import MaskinHeader from "@/components/loop/MaskinHeader";
import MaskinShell from "@/components/loop/MaskinShell";
import { FIXTURE_MODE, fixtureSnapshot } from "@/lib/loop/fixtures";

export const dynamic = "force-dynamic";

export default function MaskinenPage() {
  if (!isLoopEnabled()) notFound();

  const snapshot = fixtureSnapshot();

  return (
    <>
      <MaskinHeader fixture={FIXTURE_MODE} />
      <MaskinShell snapshot={snapshot} fixture={FIXTURE_MODE} />
    </>
  );
}
