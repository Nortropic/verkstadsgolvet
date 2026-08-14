/**
 * V2 · Vänsterkolumnen "BACKLOG / IN".
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (kolumnen med grupperade
 * tillstånd och antal) och COMPONENT_PLAN (BacklogColumn).
 *
 * BINDANDE REGLER
 * ---------------
 * · Kolumnen visar EXAKT snapshotens `backlog`-lista. Ingen uppgift flyttas mellan listor,
 *   ingen härleds, ingen hittas på.
 * · Grupperingen följer TASK_LIFECYCLE:s ordning ur V1 — UI:t definierar ingen egen ordning
 *   och inget eget tillstånd.
 * · Antalet per grupp är ett ANTAL. Ingen andel, ingen kvot, ingen stapel, ingen procentsats.
 * · Kolumnen äger ingen datahämtning.
 */
import * as React from "react";
import Link from "next/link";
import { TASK_LIFECYCLE_PRESENTATION } from "@/lib/loop/labels";
import { TASK_LIFECYCLE, type TaskLifecycle, type TaskView } from "@/lib/loop/schema";
import TaskCard from "./TaskCard";
import { countLabel } from "./ui";

/** Grupperar i TASK_LIFECYCLE:s ordning. Tomma tillstånd utelämnas — de påstås aldrig vara 0. */
export function groupByState(tasks: readonly TaskView[]): { state: TaskLifecycle; tasks: TaskView[] }[] {
  return TASK_LIFECYCLE.map((state) => ({
    state,
    tasks: tasks.filter((task) => task.state === state),
  })).filter((group) => group.tasks.length > 0);
}

export default function BacklogColumn({ tasks }: { tasks: readonly TaskView[] }) {
  const groups = groupByState(tasks);

  return (
    <section className="mk-col mk-col-backlog" data-column="backlog" aria-label="Backlog / in">
      <h2 className="mk-col-title">
        <span>Backlog / in</span>
        <span className="mk-col-count">{countLabel(tasks.length)}</span>
      </h2>

      {/*
        V8* · planens primära CTA överst i kolumnen — nu via `next/link`.

        En rå `<a>` tvingar fram en FULL omladdning av kontrollrummet: sidan rivs, klientens
        tillstånd slängs och operatören betalar en kall start för att öppna en intern route.
        `next/link` gör samma navigering på appens egna villkor (klientnavigering + prefetch)
        och renderar fortfarande ett vanligt `<a href>` — samma markup, samma URL, samma
        beteende för mitten-klick och skärmläsare. Länken ÖPPNAR bara intake-ytan; den lämnar
        inte in något.
      */}
      <Link className="mk-link" href="/loop/mata" data-intake-cta="true">
        + Mata maskinen
      </Link>

      {groups.length === 0 && (
        <p className="mk-empty">Snapshoten har ingen uppgift i backlog.</p>
      )}

      {groups.map((group) => (
        <div className="mk-group" key={group.state} data-group-state={group.state}>
          <div className="mk-group-head">
            <span className="mk-group-name">
              {TASK_LIFECYCLE_PRESENTATION[group.state].label} · {group.state}
            </span>
            <span className="mk-group-count" data-group-count={group.tasks.length}>
              {group.tasks.length}
            </span>
          </div>
          {group.tasks.map((task) => (
            <TaskCard key={task.task_id} task={task} variant="compact" />
          ))}
        </div>
      ))}
    </section>
  );
}
