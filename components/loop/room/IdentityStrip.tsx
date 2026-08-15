/**
 * ROOM-01 · Identitetsremsan: sju separata fält, inget hopslaget "vem gjorde detta".
 *
 * BINDANDE REGLER SOM REMSAN BÄR
 * ------------------------------
 * · `builder.agent` renderas under sin EGEN etikett — "Registrerad builder-agent" — och aldrig
 *   som workflowsroll, exekverande principal eller behörighet. Ett rollnamn bevisar aldrig en
 *   mekanisk förmåga.
 * · Fält utan källa i kontraktet renderas som exakt "—" med `data-missing`. Ingen grannuppgift
 *   får fylla hålet, och ingen text antyder att svaret "egentligen" är känt.
 * · Remsan bär meningen om workflowsroll ordagrant. Den är inte en brasklapp — den är själva
 *   skälet till att fälten hålls isär.
 */
import * as React from "react";
import RoomField from "./RoomField";
import type { TaskView } from "@/lib/loop/schema";
import {
  IDENTITY_DISCLAIMER,
  IDENTITY_HEADING,
  IDENTITY_WORKFLOW_CAPTION,
  identityFields,
} from "@/lib/loop/room/identity";

export default function IdentityStrip({ task }: { task: TaskView | null }) {
  const fields = identityFields(task);

  return (
    <section className="rm-identity" data-identity-strip="true" aria-label={IDENTITY_HEADING}>
      {/*
        SHREDDER-01B §owner-8 · LÅSTEXTEN STÅR KVAR I VYN — KOMPAKTERAD, INTE UNDANSTOPPAD.

        Meningen om workflowsroll är EN rad på ett femtiotal tecken, och den är remsans själva
        skäl (se filens bindande regler och lib/loop/room/identity.ts: «Den mening remsan MÅSTE
        bära. Ordagrant»). Bakom en upplysningsyta hade den bytt en rad text mot en 38 px hög
        växel vars etikett var längre än meningen — mer krom, inte mindre, och ett obligatoriskt
        påstående borta ur förstaläget. Prosadieten gäller försvarsstycken, inte den här raden.

        Kompakteringen sker därför i FORMEN: samma element, samma märkning och samma ordagranna
        konstant, men som en dämpad rad i rubrikraden i stället för en inramad ruta.
      */}
      <div className="rm-identity-head">
        <h2 className="rm-identity-title">{IDENTITY_HEADING}</h2>
        <span className="rm-identity-caption" data-identity-caption="ui-label">
          {IDENTITY_WORKFLOW_CAPTION}
        </span>
        <p className="rm-identity-lock" data-identity-lock="true">
          {IDENTITY_DISCLAIMER}
        </p>
      </div>

      <div className="rm-identity-grid">
        {fields.map((field) => (
          <div key={field.id} data-identity-field={field.id} data-identity-source={field.source}>
            <RoomField
              fieldId={field.id}
              label={field.label}
              value={field.value}
              note={field.note}
              mono={field.id === "builder_agent" || field.id === "builder_model"}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
