/**
 * ROOM-01 · Rummets blick: den uppgift som faktiskt arbetas på.
 *
 * VAD DEN ÄR — OCH INTE ÄR
 * ------------------------
 * Skenan är ARRANGEMANG och inramning. Kortet, fasraden, försöksfältet, bas- och kandidat-SHA,
 * domarna och em-strecken renderas fortfarande av `CurrentTaskPanel` → `TaskCard`/`PhaseRail`.
 * Ingen av dem byggs om här: det som redan är provat ska förbli provat, och en andra rendering
 * av samma fält hade varit en andra sanning.
 *
 * BINDANDE REGLER
 * ---------------
 * · Aktuell uppgift är EXAKT snapshotens `current_task`. Ingen uppgift lyfts hit ur backlog.
 * · Tillstånd, domar, attestation och promotion kommer ur controllerns snapshot — aldrig ur
 *   strömmen och aldrig ur ett klick.
 * · Ingen procentsats, ingen framstegsstapel och ingen rörelse: skenan har ingen liveness-signal.
 */
import * as React from "react";
import CurrentTaskPanel from "../CurrentTaskPanel";
import IdentityStrip from "./IdentityStrip";
import RoomStep from "./RoomStep";
import type { TaskView } from "@/lib/loop/schema";

/** Namnet gäller i ALLA vyer. Ordningstalet döljs där layouten inte längre visar den ordningen. */
export const FOCUS_STEP = "arbetet";
export const FOCUS_STEP_ORDINAL = "2";

/**
 * NOTISEN SÄGER BARA DET SOM BARA DEN KAN SÄGA.
 *
 * Härkomsten (fixtur eller controllerns snapshot) står EN gång, i rummets ingress, och bärs
 * dessutom av statusradens FIXTUR-märke. Att upprepa den här hade varit samma påstående i två
 * intilliggande stycken. Kvar står det som är MITTENS eget och som gäller i båda lägena:
 * tillståndet kommer ur snapshoten, aldrig ur strömmen nedan.
 */
export const FOCUS_NOTE = "Tillståndet kommer ur snapshoten, aldrig ur strömmen nedan.";

export default function TaskFocusRail({
  task,
  children,
}: {
  task: TaskView | null;
  /**
   * Ytor som hör till det fokuserade arbetet och som skalet äger monteringen av (V7:s
   * kommandoyta). De läggs SIST i banan, under identiteten.
   */
  children?: React.ReactNode;
}) {
  return (
    <div className="rm-lane rm-lane-focus" data-task-focus-rail="true">
      <RoomStep ordinal={FOCUS_STEP_ORDINAL} name={FOCUS_STEP} />
      <CurrentTaskPanel task={task} />
      <p className="rm-head-note">{FOCUS_NOTE}</p>
      {/*
        Identitetsremsan handlar om DEN HÄR uppgiften — vem/vad som registrerats, och allt det
        rummet inte vet. Den hör därför hemma i fokusbanan, inte som ett eget fullbrett band
        under scenen: där låg den både längre från sitt föremål och lämnade mitten så kort att
        scenen blev ett halvtomt rutnät.
      */}
      <IdentityStrip task={task} />
      {children}
    </div>
  );
}
