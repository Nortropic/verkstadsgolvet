/**
 * V8* · Intakens skal: fixturbanner + dropzon + de renderade utfallen.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — MARKDOWN_INTAKE_UX och ROUTE_PLAN
 * (`app/(app)/loop/mata/page.tsx`). Skalet speglar MaskinShell: det ÄGER INGEN DATAHÄMTNING.
 *
 * BINDANDE REGLER
 * ---------------
 * · Utfallen skickas in av routen. Skalet läser varken transport, env eller fixturkatalog.
 * · Fixturläget märks ut SYNLIGT. Den här skivan är aldrig live-komplett: den levande V8 är
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
  type IntakeOutcome,
} from "@/lib/loop/intake";
import IntakeDropzone from "./IntakeDropzone";
import IntakeResult from "./IntakeResult";
import { LOOP_CSS } from "./ui";

export default function IntakeShell({
  outcomes,
  fixture = false,
}: {
  outcomes: readonly IntakeOutcome[];
  fixture?: boolean;
}) {
  return (
    <div
      className="mk-shell mk-intake"
      data-intake-shell="true"
      data-fixture={fixture ? "true" : "false"}
      data-intake-mode={INTAKE_MODE}
      data-intake-transport={INTAKE_TRANSPORT}
      data-client-hashes={INTAKE_CLIENT_COMPUTES_SHA256 ? "true" : "false"}
      data-trust-anchor={INTAKE_TRUST_ANCHOR}
    >
      <style dangerouslySetInnerHTML={{ __html: LOOP_CSS }} />

      <p className="mk-note mk-tone-warning" data-fixture-banner="true">
        FIXTUR · Ingen livedata, ingen transport och ingen inlämning. Källbytes lämnar aldrig
        webbläsaren i den här skivan, och Verkstadsgolvet beräknar ingen sha256. Den levande
        intaken är blockerad på {INTAKE_BLOCKED_ON}, som äger transportens form. Controllern
        läser alltid bytes själv, räknar om hashen och avvisar vid avvikelse — appens värde är
        ett påstående, aldrig ett förtroendeankare.
      </p>

      <IntakeDropzone />

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
