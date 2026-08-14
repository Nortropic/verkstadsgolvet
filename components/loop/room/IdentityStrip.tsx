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
      <div className="rm-identity-head">
        <h2 className="rm-identity-title">{IDENTITY_HEADING}</h2>
        <span className="rm-identity-caption" data-identity-caption="ui-label">
          {IDENTITY_WORKFLOW_CAPTION}
        </span>
      </div>

      <p className="rm-identity-lock" data-identity-lock="true">
        {IDENTITY_DISCLAIMER}
      </p>

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
