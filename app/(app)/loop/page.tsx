/**
 * V2 · Maskinen (/loop) — Fabriksrummet i SHOWROOM-läge.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — ROUTE_PLAN, TARGET_UX och
 * IMPLEMENTATION_SLICES §V2, med produktsynlighetsregeln UPPHÄVD av ägarbeslutet i
 * docs/nortropic-factory-room-roadmap-erratum-01.md (SHOWROOM_BEFORE_BACKEND_COMPLETE=YES,
 * HIDE_LOOP_ROUTE_UNTIL_BACKEND=NO, FIXTURE_DATA_MUST_BE_EXPLICITLY_LABELLED=YES).
 *
 * BINDANDE REGLER
 * ---------------
 * · SYNLIGHET: den INLOGGADE routen renderar alltid. Den gamla regeln "utan `LOOP_ENABLED=true`
 *   finns routen inte" gällde produktens synlighet och är upphävd; inloggningen (middleware.ts +
 *   auth()) och /api/loop-grinden (components/loop/flag.ts) är oförändrade. En dold route var
 *   aldrig en säkerhetsgräns — den dolde bara produkten.
 * · LÄGET ÄR EXPLICIT: `factoryRoomMode()` löser ut "SHOWROOM" och skickas in i skalen, som
 *   märker varje yta med `data-room-mode`. Läget kan inte flyttas av en env-variabel
 *   (lib/loop/room/mode.ts), bara av den skiva som gör live sant (ROOM-05, backend S5 + S13).
 * · Kolumnernas datakälla är V1:s GENERERADE fixtur (lib/loop/fixtures). Den är ALDRIG livedata,
 *   märks ut som simulerad fabriksdata i UI:t, och den delen är inte live-komplett i någon mening.
 * · Sidan monterar sedan V7:s kommandoyta (kanalen STÄNGD — 503 tills backendens skiva finns)
 *   och V9:s strömpanel (som talar med kontrollplanets läsyta på riktigt). Distinktionen —
 *   live / kontraktsläge / showroom — bärs av MaskinHeader och härleds ur de faktiska lägena.
 * · Routen rör fortfarande ingen Git-, ref-, verifierings- eller promotionsväg och äger ingen
 *   authority: den läser en fixtur, renderar den och låter panelerna bära sina egna lägen.
 * · `force-dynamic` gör att läget läses vid REQUEST, inte bakas in vid build.
 */
import MaskinHeader from "@/components/loop/MaskinHeader";
import MaskinShell from "@/components/loop/MaskinShell";
import { FIXTURE_MODE, fixtureSnapshot } from "@/lib/loop/fixtures";
import { factoryRoomMode } from "@/lib/loop/room/mode";

export const dynamic = "force-dynamic";

export default function MaskinenPage() {
  const mode = factoryRoomMode();
  const snapshot = fixtureSnapshot();

  return (
    <>
      <MaskinHeader fixture={FIXTURE_MODE} mode={mode} />
      <MaskinShell snapshot={snapshot} fixture={FIXTURE_MODE} mode={mode} />
    </>
  );
}
