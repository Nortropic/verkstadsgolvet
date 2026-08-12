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
 * · Datakällan i den här skivan är V1:s GENERERADE fixtur (lib/loop/fixtures). Den är ALDRIG
 *   livedata, märks ut som fixtur i UI:t, och slicen är inte live-komplett i någon mening.
 * · Ingen transport, inget kommando, ingen eventström, ingen Git-, ref-, verifierings- eller
 *   promotionsväg. Routen läser en fixtur och renderar den.
 * · `force-dynamic` gör att flaggan läses vid REQUEST, inte bakas in vid build — annars hade
 *   ett bygge med flaggan på kunnat servera en förrenderad sida efter att den slagits av.
 */
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { isLoopEnabled } from "@/components/loop/flag";
import MaskinShell from "@/components/loop/MaskinShell";
import { FIXTURE_MODE, fixtureSnapshot } from "@/lib/loop/fixtures";

export const dynamic = "force-dynamic";

export default function MaskinenPage() {
  if (!isLoopEnabled()) notFound();

  const snapshot = fixtureSnapshot();

  return (
    <>
      <PageHeader
        title="Maskinen"
        sub="Kontrollrummets läsvy. Fixturläge — ingen livedata, inga kommandon, ingen authority."
      />
      <MaskinShell snapshot={snapshot} fixture={FIXTURE_MODE} />
    </>
  );
}
