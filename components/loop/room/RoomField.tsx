/**
 * ROOM-01 · Ett fält i rummet: etikett + värde, med saknat värde som EXAKT em-streck.
 *
 * Formen är Maskinens egen (samma `mk-label` / `mk-value` / `data-missing` som TaskCard och
 * RunStatusBar) — rummet bygger ingen parallell fältmodell och uppfinner ingen egen märkning.
 *
 * BINDANDE: null, undefined och tom sträng blir "—" via V1:s `orMissing`. Aldrig 0, aldrig
 * tomt, aldrig "okänd" och aldrig en gissning.
 */
import * as React from "react";
import { MISSING, orMissing } from "@/lib/loop/labels";

export type RoomFieldProps = {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
  /** Full sträng bakom en trunkerad visning (t.ex. hela SHA:t). */
  title?: string;
  /** Klartext under värdet — varför fältet ser ut som det gör. */
  note?: string;
  /** Extra data-attribut, t.ex. fältets id i identitetsremsan. */
  fieldId?: string;
  className?: string;
};

export default function RoomField({
  label,
  value,
  mono = false,
  title,
  note,
  fieldId,
  className = "rm-identity-cell",
}: RoomFieldProps) {
  const text = orMissing(value);
  const isMissing = text === MISSING;
  const classes = ["mk-value"];
  if (mono) classes.push("mk-mono");
  if (isMissing) classes.push("mk-missing");

  return (
    <div className={className} data-room-field={fieldId}>
      <div className="mk-label">{label}</div>
      <div className={classes.join(" ")} data-missing={isMissing ? "true" : "false"} title={title}>
        {text}
      </div>
      {note !== undefined && <div className="rm-identity-note">{note}</div>}
    </div>
  );
}
