/**
 * V2 · Mittkolumnen "MASKINEN" — aktuell uppgift + fasrad.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (mittkolumnen) och
 * COMPONENT_PLAN (CurrentTaskPanel).
 *
 * BINDANDE REGLER
 * ---------------
 * · Aktuell uppgift är EXAKT snapshotens `current_task`. Saknas den visas det i klartext —
 *   ingen uppgift plockas ur backlog och kallas aktuell.
 * · Ingen animation och ingen liveness-markör utan faktisk signal: panelen pulserar aldrig.
 * · Ingen procentsats och ingen framstegsstapel. "Försök 1 av —" är ett försöksantal mot en
 *   budget som saknas i kontraktet, inte ett framsteg.
 */
import * as React from "react";
import type { TaskView } from "@/lib/loop/schema";
import PhaseRail from "./PhaseRail";
import TaskCard from "./TaskCard";

export default function CurrentTaskPanel({ task }: { task: TaskView | null }) {
  return (
    <section className="mk-col mk-col-current" data-column="current" aria-label="Maskinen">
      <h2 className="mk-col-title">
        <span>Maskinen</span>
        <span className="mk-col-count">aktuell uppgift</span>
      </h2>

      {task === null ? (
        <p className="mk-empty" data-current-task="none">
          Snapshoten redovisar ingen aktuell uppgift. Ingen uppgift lyfts hit ur backlog.
        </p>
      ) : (
        <>
          <TaskCard task={task} variant="full" />
          <PhaseRail task={task} />
        </>
      )}
    </section>
  );
}
