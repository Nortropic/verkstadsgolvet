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
import type { TaskView } from "@/lib/loop/schema";

export const FOCUS_STEP = "2 · arbetet";

export const FOCUS_NOTE =
  "Allt i mitten kommer ur controllerns publicerade snapshot. Eventströmmen längst ned kan visa " +
  "att något är på gång, men den flyttar aldrig ett tillstånd här.";

export default function TaskFocusRail({ task }: { task: TaskView | null }) {
  return (
    <div className="rm-lane rm-lane-focus" data-task-focus-rail="true">
      <span className="rm-step">{FOCUS_STEP}</span>
      <CurrentTaskPanel task={task} />
      <p className="rm-head-note">{FOCUS_NOTE}</p>
    </div>
  );
}
