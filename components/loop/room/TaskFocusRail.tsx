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
import RoomStep from "./RoomStep";
import type { TaskView } from "@/lib/loop/schema";

/** Namnet gäller i ALLA vyer. Ordningstalet döljs där layouten inte längre visar den ordningen. */
export const FOCUS_STEP = "arbetet";
export const FOCUS_STEP_ORDINAL = "2";

/**
 * KÄLLAN HÄRLEDS UR LÄGET, REGELN GÖR DET INTE.
 *
 * Vilken KÄLLA mitten läser är olika i fixturläge och live — och en mening som påstår
 * controllerpublicerad härkomst för fixturdata motsäger både statusradens FIXTUR-märke och
 * sidhuvudets egen sanningsrad. REGELN är däremot densamma i båda lägena: tillståndet kommer ur
 * den snapshot vyn fått, aldrig ur strömmen. Därför byter första meningen med läget, medan andra
 * meningen står fast.
 */
export function focusNote(fixture: boolean): string {
  const source = fixture
    ? "Mitten kommer ur den genererade fixturen — inte ur controllern."
    : "Mitten kommer ur controllerns publicerade snapshot.";
  return `${source} Regeln är densamma i båda lägena: tillståndet kommer ur snapshoten, aldrig ur strömmen nedan.`;
}

export default function TaskFocusRail({
  task,
  fixture,
}: {
  task: TaskView | null;
  fixture: boolean;
}) {
  return (
    <div className="rm-lane rm-lane-focus" data-task-focus-rail="true">
      <RoomStep ordinal={FOCUS_STEP_ORDINAL} name={FOCUS_STEP} />
      <CurrentTaskPanel task={task} />
      <p className="rm-head-note" data-focus-source={fixture ? "fixture" : "snapshot"}>
        {focusNote(fixture)}
      </p>
    </div>
  );
}
