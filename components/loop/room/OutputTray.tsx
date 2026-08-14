/**
 * ROOM-01 · Utmatningen: det som lämnat maskinen.
 *
 * VAD DEN ÄR
 * ----------
 * Inramning kring `CompletedColumn`, som redan delar snapshotens `completed`-lista i KLART (DONE)
 * och EJ PROMOVERADE (allt annat) och ger endast DONE success-färgen. Rummet bygger ingen egen
 * uppdelning: skulle den här filen räkna om listan hade det blivit en andra sanning om vad som
 * är klart.
 *
 * BINDANDE REGLER
 * ---------------
 * · DONE kommer ENDAST ur controllerns snapshot. Ingen tail-rad, ingen animation och inget klick
 *   kan flytta en uppgift hit.
 * · STOPPED är fail-closed: den bär `danger`, ligger under "Ej promoverade" och ser aldrig ut
 *   som klart.
 * · NEEDS_SPEC hör hemma i backlog som ett ARBETSLÄGE (warning), aldrig här och aldrig som fel.
 */
import * as React from "react";
import CompletedColumn from "../CompletedColumn";
import RoomStep from "./RoomStep";
import type { TaskView } from "@/lib/loop/schema";

/** Namnet gäller i ALLA vyer. Ordningstalet döljs där layouten inte längre visar den ordningen. */
export const TRAY_STEP = "ut";
export const TRAY_STEP_ORDINAL = "3";

export const TRAY_NOTE =
  "Klart betyder att controllern skrivit DONE i sin snapshot. Ett stoppat arbete står kvar som " +
  "stoppat — det ser aldrig klart ut, och rummet flyttar det aldrig.";

export default function OutputTray({ tasks }: { tasks: readonly TaskView[] }) {
  return (
    <div className="rm-lane rm-lane-out" data-output-tray="true">
      <RoomStep ordinal={TRAY_STEP_ORDINAL} name={TRAY_STEP} />
      <CompletedColumn tasks={tasks} />
      <p className="rm-head-note">{TRAY_NOTE}</p>
    </div>
  );
}
