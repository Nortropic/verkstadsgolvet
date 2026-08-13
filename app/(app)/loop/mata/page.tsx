/**
 * V8* · Mata maskinen (/loop/mata) — Markdown-intake i FIXTURLÄGE.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN (`app/(app)/loop/mata/page.tsx`),
 * MARKDOWN_INTAKE_UX och IMPLEMENTATION_ORDER-raden `V8*` ("UI kan byggas mot fixtur här").
 *
 * DENNA SKIVA ÄR INTE LIVE-KOMPLETT
 * ---------------------------------
 * Den levande motsvarigheten (V8) är blockerad på nortropic-system S10 + S13 (B5). Routen
 * skapar därför ingen intake-route, rör ingen transport, hashar ingenting och kompilerar
 * aldrig tasks. Den läser en GENERERAD fixtur och renderar den.
 *
 * BINDANDE REGLER
 * ---------------
 * · FAIL-CLOSED: utan `LOOP_ENABLED=true` finns routen inte (notFound → 404). Samma grind som
 *   resten av /loop-trädet — ingen halv kontrollrumsyta.
 * · `force-dynamic` gör att flaggan läses vid REQUEST, inte bakas in vid build.
 * · Routen äger ingen datahämtning utöver fixturingången, och skickar aldrig något någonstans.
 */
import { notFound } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { isLoopEnabled } from "@/components/loop/flag";
import IntakeShell from "@/components/loop/IntakeShell";
import {
  FIXTURE_MODE,
  fixtureIntakeCandidates,
  fixtureIntakeOutcomes,
  fixtureIntakeOverCountSelection,
} from "@/lib/loop/fixtures";

export const dynamic = "force-dynamic";

export default function MataMaskinenPage() {
  if (!isLoopEnabled()) notFound();

  const outcomes = fixtureIntakeOutcomes();
  const candidates = fixtureIntakeCandidates();
  const overCount = fixtureIntakeOverCountSelection();

  return (
    <>
      <PageHeader
        title="Mata maskinen"
        sub="Markdown-intake i fixturläge — ingen transport, ingen inlämning, ingen hash. Nortropic tolkar källan, aldrig Verkstadsgolvet."
      />
      <IntakeShell
        outcomes={outcomes}
        candidates={candidates}
        overCount={overCount}
        fixture={FIXTURE_MODE}
      />
    </>
  );
}
