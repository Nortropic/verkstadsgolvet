/**
 * V2 · Högerkolumnen "KLART / UT" med sektionen "EJ PROMOVERADE".
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (högerkolumnen: klara tasks samt
 * "EJ PROMOVERADE" med t.ex. STOPPED) och COMPONENT_PLAN (CompletedColumn).
 *
 * BINDANDE REGLER
 * ---------------
 * · Kolumnen visar EXAKT snapshotens `completed`-lista, delad efter tillstånd — inte efter en
 *   gissning. DONE hamnar under "Klart / ut"; ALLT ANNAT hamnar under "Ej promoverade".
 * · Endast DONE får bära success-färg (`may_look_done` i V1:s presentation). Ett stoppat eller
 *   på annat sätt icke-avslutat arbete får aldrig se klart ut — det är hela poängen med att
 *   dela listan här i stället för att rendera den rakt av.
 * · Kolumnen flyttar aldrig en uppgift mellan snapshotens listor och hittar aldrig på en
 *   promotion. `promotion`-fältet är ett OLÖST kontrakt (S7) och renderas som "—" i kortet.
 */
import * as React from "react";
import { TASK_LIFECYCLE_PRESENTATION } from "@/lib/loop/labels";
import type { TaskView } from "@/lib/loop/schema";
import TaskCard from "./TaskCard";
import { countLabel } from "./ui";

/** DONE åt ena hållet, allt annat åt det andra. Ingen tredje väg, ingen härledning. */
export function splitCompleted(tasks: readonly TaskView[]): {
  done: TaskView[];
  notPromoted: TaskView[];
} {
  return {
    done: tasks.filter((task) => task.state === "DONE"),
    notPromoted: tasks.filter((task) => task.state !== "DONE"),
  };
}

export default function CompletedColumn({ tasks }: { tasks: readonly TaskView[] }) {
  const { done, notPromoted } = splitCompleted(tasks);

  return (
    <section className="mk-col mk-col-completed" data-column="completed" aria-label="Klart / ut">
      <h2 className="mk-col-title">
        <span>Klart / ut</span>
        <span className="mk-col-count">{countLabel(tasks.length)}</span>
      </h2>

      <div className="mk-group" data-section="done">
        <div className="mk-group-head">
          <span className="mk-group-name">
            {TASK_LIFECYCLE_PRESENTATION.DONE.label} · DONE
          </span>
          <span className="mk-group-count" data-done-count={done.length}>
            {done.length}
          </span>
        </div>
        {done.length === 0 ? (
          <p className="mk-empty">Snapshoten redovisar ingen klar uppgift.</p>
        ) : (
          done.map((task) => <TaskCard key={task.task_id} task={task} variant="compact" />)
        )}
      </div>

      <div className="mk-group" data-section="not-promoted">
        <div className="mk-group-head">
          <span className="mk-group-name">Ej promoverade</span>
          <span className="mk-group-count" data-not-promoted-count={notPromoted.length}>
            {notPromoted.length}
          </span>
        </div>
        {notPromoted.length === 0 ? (
          <p className="mk-empty">Snapshoten redovisar ingen avslutad uppgift utan promotion.</p>
        ) : (
          notPromoted.map((task) => (
            <TaskCard key={task.task_id} task={task} variant="compact" />
          ))
        )}
      </div>
    </section>
  );
}
