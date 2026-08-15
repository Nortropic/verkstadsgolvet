/**
 * V8* · Intakens skal: fixturbanner + dropzon + de renderade utfallen.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — MARKDOWN_INTAKE_UX och ROUTE_PLAN
 * (`app/(app)/loop/mata/page.tsx`). Skalet speglar MaskinShell: det ÄGER INGEN DATAHÄMTNING.
 *
 * BINDANDE REGLER
 * ---------------
 * · Utfallen skickas in av routen. Skalet läser varken transport, env eller fixturkatalog.
 * · SHOWROOM MÄRKS UT SYNLIGT, och kort. Märket plus EN mening står överst; den fulla tekniska
 *   sanningen (ingen transport, ingen sha256, vad den levande vägen är blockerad på, vem som är
 *   förtroendeankare) står kvar ORDAGRANT i en öppningsbar detalj under märket. Ingenting är
 *   borttaget — den långa försvarstexten är flyttad dit den granskas, i stället för att vara
 *   det första en operatör möter. Den här skivan är aldrig live-komplett: den levande V8 är
 *   blockerad på nortropic-system S10 + S13 (B5), som äger intake-transportens form.
 * · Ett utfall som inte validerar renderas aldrig — routens fixturingång släpper bara igenom
 *   det som har den verkliga kanalens form, och en tom lista visas som ett SYNLIGT läge.
 * · Samma namnrymdade stilark (`mk-`) som resten av /loop. app/globals.css rörs inte.
 */
import * as React from "react";
import Graceful from "@/components/Graceful";
import {
  INTAKE_BLOCKED_ON,
  INTAKE_CLIENT_COMPUTES_SHA256,
  INTAKE_MODE,
  INTAKE_TRANSPORT,
  INTAKE_TRUST_ANCHOR,
  type IntakeCandidate,
  type IntakeOutcome,
} from "@/lib/loop/intake";
import {
  SHOWROOM_BADGE,
  SHOWROOM_EXPLANATION,
  factoryRoomMode,
  type FactoryRoomMode,
} from "@/lib/loop/room/mode";
import IntakeDropzone from "./IntakeDropzone";
import IntakeResult from "./IntakeResult";
import IntakeValidationShowcase from "./IntakeValidationShowcase";
import { LOOP_CSS } from "./ui";

export default function IntakeShell({
  outcomes,
  candidates,
  overCount,
  fixture = false,
  mode = factoryRoomMode(),
}: {
  outcomes: readonly IntakeOutcome[];
  /** Fixturens kandidatfiler för den formella valideringens synliga panel. */
  candidates: readonly IntakeCandidate[];
  /** Ett urval över antalsgränsen — fail-closed-banderollen ska gå att SE, inte bara prova. */
  overCount: readonly IntakeCandidate[];
  fixture?: boolean;
  /** Produktläget (lib/loop/room/mode.ts). Skickas in av routen; skalet läser aldrig env. */
  mode?: FactoryRoomMode;
}) {
  return (
    <div
      className="mk-shell mk-intake"
      data-intake-shell="true"
      data-fixture={fixture ? "true" : "false"}
      data-room-mode={mode}
      data-intake-mode={INTAKE_MODE}
      data-intake-transport={INTAKE_TRANSPORT}
      data-client-hashes={INTAKE_CLIENT_COMPUTES_SHA256 ? "true" : "false"}
      data-trust-anchor={INTAKE_TRUST_ANCHOR}
    >
      <style dangerouslySetInnerHTML={{ __html: LOOP_CSS }} />

      <p className="mk-note mk-tone-warning" data-fixture-banner="true" data-room-mode={mode}>
        <span className="mk-badge mk-tone-warning" data-showroom-badge="true">
          {SHOWROOM_BADGE}
        </span>{" "}
        {SHOWROOM_EXPLANATION}
      </p>

      {/*
        DEN FULLA SANNINGEN ÄR KVAR — den är flyttad, inte kortad. Detaljen är en <details>
        utan egen klass: stilarket (LOOP_CSS) ligger utanför den här skivan, och en klass utan
        regel hade varit en tyst stilskuld. Innehållet är ordagrant det som tidigare stod som
        banner: ingen transport, ingen hash i appen, vad den levande vägen är blockerad på, och
        vem som är förtroendeankare.
      */}
      <details data-intake-backend-detail="true">
        <summary>Vad som gäller tekniskt i den här skivan</summary>
        <p className="mk-hint" data-intake-backend-detail-text="true">
          Ingen transport och ingen inlämning. Källbytes lämnar aldrig webbläsaren i den här
          skivan, och Verkstadsgolvet beräknar ingen sha256. Den levande intaken är blockerad på{" "}
          {INTAKE_BLOCKED_ON}, som äger transportens form. Controllern läser alltid bytes själv,
          räknar om hashen och avvisar vid avvikelse — appens värde är ett påstående, aldrig ett
          förtroendeankare.
        </p>
      </details>

      <IntakeDropzone />

      <IntakeValidationShowcase candidates={candidates} overCount={overCount} />

      <div className="mk-intake-results" data-intake-results="true">
        {outcomes.length === 0 ? (
          <Graceful
            title="Inga inlämningar att visa"
            hint="Ett utfall utan den verkliga kanalens form renderas aldrig."
          >
            Fixturkatalogen innehåller inget utfall som validerar mot kontraktet i
            lib/loop/intake.ts. Verkstadsgolvet visar hellre ingenting än ett gissat utfall.
          </Graceful>
        ) : (
          outcomes.map((outcome) => (
            <IntakeResult key={outcome.submission_id} outcome={outcome} />
          ))
        )}
      </div>
    </div>
  );
}
