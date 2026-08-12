/**
 * V2 · Fasraden PLAN → BUILD → VERIFY → REVIEW → MERGE.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX ("Fasradens ✓ / ● / — / ✗ kommer
 * ur event, aldrig ur gissning. — = inte inträffat") och COMPONENT_PLAN (PhaseRail).
 *
 * BINDANDE REGLER FÖR JUST DEN HÄR SKIVAN
 * ---------------------------------------
 * V2 har INGEN eventström och ingen fold — den byggs i V3/V5. Fasraden får därför bara läsa
 * snapshotens `phase`, och gör exakt två saker:
 *
 *   1. Markerar snapshotens fas som PÅGÅENDE — men BARA när snapshotens task state säger att
 *      uppgiften faktiskt är i arbete (WORKING · VERIFYING · REVIEWING · MERGING). En STOPPAD
 *      eller köad uppgift får aldrig se ut som om något pågår.
 *   2. Lämnar alla andra faser omarkerade ("—").
 *
 * Den härleder ALDRIG "✓" ur ett tillstånd. Ett klart-märke kräver evidens ur eventströmmen
 * (V3+), och ett icke-avslutat arbete får aldrig se avslutat ut. "—" här betyder "inte känt i
 * den här skivan", vilket sägs i klartext under raden — aldrig ett påstått utfall.
 */
import * as React from "react";
import { PHASES, type Phase, type PhaseMark, type TaskLifecycle, type TaskView } from "@/lib/loop/schema";

/** De tillstånd där snapshoten säger att arbete PÅGÅR. Ur TASK_LIFECYCLE, aldrig utökade. */
export const IN_FLIGHT_STATES: readonly TaskLifecycle[] = [
  "WORKING",
  "VERIFYING",
  "REVIEWING",
  "MERGING",
];

/**
 * Vilken fas får märkas som pågående? Endast snapshotens egen `phase`, och endast för en
 * uppgift som snapshoten säger är i arbete. Allt annat → null (ingen fas markeras).
 */
export function activePhaseFromSnapshot(task: TaskView): Phase | null {
  if (task.phase === null) return null;
  return IN_FLIGHT_STATES.includes(task.state) ? task.phase : null;
}

/** Markörernas tecken och text. `done`/`failed` produceras inte i V2 — de kräver event. */
const MARK_PRESENTATION: Record<PhaseMark, { symbol: string; note: string }> = {
  done: { symbol: "✓", note: "klar" },
  active: { symbol: "●", note: "pågår" },
  not_reached: { symbol: "—", note: "—" },
  failed: { symbol: "✗", note: "fällde" },
};

export function phaseMarks(task: TaskView): { phase: Phase; mark: PhaseMark }[] {
  const active = activePhaseFromSnapshot(task);
  return PHASES.map((phase) => ({
    phase,
    mark: phase === active ? ("active" as PhaseMark) : ("not_reached" as PhaseMark),
  }));
}

export default function PhaseRail({ task }: { task: TaskView }) {
  const marks = phaseMarks(task);
  return (
    <div data-phase-rail="true">
      <div className="mk-phases">
        {marks.map(({ phase, mark }) => {
          const shown = MARK_PRESENTATION[mark];
          return (
            <div
              key={phase}
              className={`mk-phase mk-mark-${mark}`}
              data-phase={phase}
              data-mark={mark}
            >
              <span className="mk-phase-mark" aria-hidden="true">
                {shown.symbol}
              </span>
              <span className="mk-phase-name">{phase}</span>
              <span className="mk-phase-note">{shown.note}</span>
            </div>
          );
        })}
      </div>
      <p className="mk-hint">
        Fasmarkörer kommer ur eventströmmen, som inte är kopplad i den här skivan. Här visas
        endast den fas snapshoten anger, och bara när uppgiften är i arbete. Övriga faser står
        som — (inte känt här) — aldrig som klara.
      </p>
    </div>
  );
}
