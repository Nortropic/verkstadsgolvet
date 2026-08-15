/**
 * V8* · Mata maskinen (/loop/mata) — Markdown-intake i SHOWROOM-läge.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN (`app/(app)/loop/mata/page.tsx`),
 * MARKDOWN_INTAKE_UX och IMPLEMENTATION_ORDER-raden `V8*` ("UI kan byggas mot fixtur här"), med
 * produktsynlighetsregeln UPPHÄVD av docs/nortropic-factory-room-roadmap-erratum-01.md.
 *
 * DENNA SKIVA ÄR INTE LIVE-KOMPLETT
 * ---------------------------------
 * Den levande motsvarigheten (V8) är blockerad på nortropic-system S10 + S13 (B5). Routen
 * skapar därför ingen intake-route, rör ingen transport, hashar ingenting och kompilerar
 * aldrig tasks. Den läser en GENERERAD fixtur och renderar den — märkt som showroom.
 *
 * BINDANDE REGLER
 * ---------------
 * · SYNLIGHET: den INLOGGADE routen renderar alltid. Grinden `LOOP_ENABLED` gäller fortfarande
 *   app/api/loop/** som transportgrind, aldrig produktens synlighet (erratum-01).
 * · LÄGET ÄR EXPLICIT: `factoryRoomMode()` löser ut "SHOWROOM" och skickas in i skalet, som
 *   märker ytan med `data-room-mode`. Ingen env-variabel kan flytta läget.
 * · `force-dynamic` gör att läget läses vid REQUEST, inte bakas in vid build.
 * · Routen äger ingen datahämtning utöver fixturingången, och skickar aldrig något någonstans.
 */
import PageHeader from "@/components/PageHeader";
import IntakeShell from "@/components/loop/IntakeShell";
import {
  FIXTURE_MODE,
  fixtureIntakeCandidates,
  fixtureIntakeOutcomes,
  fixtureIntakeOverCountSelection,
} from "@/lib/loop/fixtures";
import { factoryRoomMode } from "@/lib/loop/room/mode";

export const dynamic = "force-dynamic";

export default function MataMaskinenPage() {
  const mode = factoryRoomMode();
  const outcomes = fixtureIntakeOutcomes();
  const candidates = fixtureIntakeCandidates();
  const overCount = fixtureIntakeOverCountSelection();

  return (
    <>
      <PageHeader
        title="Mata maskinen"
        sub="Markdown-intake i showroom — ingen transport, ingen inlämning, ingen hash. Nortropic tolkar källan, aldrig Verkstadsgolvet."
      />
      <IntakeShell
        outcomes={outcomes}
        candidates={candidates}
        overCount={overCount}
        fixture={FIXTURE_MODE}
        mode={mode}
      />
    </>
  );
}
