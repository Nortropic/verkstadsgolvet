"use client";

/**
 * V9 · En rad i eventströmmen: svensk etikett eller rå typ, plus hela eventet som JSON.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — EVENT_CLIENT ("unknown future event",
 * "raw event inspectability", "stale/out-of-order") och COMPONENT_PLAN (EventRow.tsx).
 *
 * BINDANDE REGLER SOM RADEN BÄR
 * -----------------------------
 * · EN RAD ÄR ALDRIG AUTHORITY. Raden bär `data-authority="NONE"`, visar ingen lifecycle-state,
 *   ingen dom, ingen attestation och ingen promotion. Auktoritativa fält kommer ur controllerns
 *   snapshot (SNAPSHOT_WINS).
 * · OKÄND `event_type` renderas RÅTT: typsträngen som den är, ingen översättning, ingen fas,
 *   ingen semantik — och kraschar aldrig. Etiketten kommer ur V1:s labels.ts, som redan faller
 *   tillbaka på rå typ.
 * · En rad vars `seq` ligger vid eller under snapshotens vattenmärke märks som redan bekräftad
 *   och bidrar med ingenting — den visas ändå, för strömmen är bevis och inte state.
 * · Rådataläget visar eventet i sin helhet. Ingenting kortas bort tyst.
 */
import * as React from "react";
import { useId, useState } from "react";
import { eventLabel } from "@/lib/loop/labels";
import type { ProjectedEventRow } from "@/lib/loop/events";

/** Radens läge mot snapshotens vattenmärke, i klartext. Aldrig en state-etikett. */
const RELATION_TEXT: Readonly<Record<ProjectedEventRow["relation"], string>> = Object.freeze({
  stale: "ingår redan i controllerns snapshot",
  tail: "efter snapshotens vattenmärke",
  no_watermark: "ingen snapshot att jämföra med",
});

export type EventRowProps = {
  row: ProjectedEventRow;
  /** true = global råtypsvisning ([raw event_type]). Växeln ägs av EventStream. */
  raw: boolean;
};

export default function EventRow({ row, raw }: EventRowProps) {
  const [showJson, setShowJson] = useState(false);
  const jsonId = useId();

  const event = row.event;
  const label = eventLabel(event.event_type);
  const unknown = !row.classification.known;
  const text = raw || unknown ? label.raw_type : label.text;

  return (
    <li
      className="mk-event"
      data-event-id={event.event_id}
      data-seq={event.seq}
      data-relation={row.relation}
      data-unknown-type={unknown ? "true" : "false"}
      data-authority={row.authority}
    >
      <div className="mk-event-head">
        <span className="mk-event-seq" title="seq — strömmens enda ordningsnyckel">
          {event.seq}
        </span>
        <span className="mk-event-type" data-raw-type={label.raw_type}>
          {text}
        </span>
        {unknown && (
          <span className="mk-badge mk-tone-warning" data-event-unknown="true">
            okänd typ
          </span>
        )}
        {row.transient_phase !== null && (
          <span className="mk-badge" data-transient-phase={row.transient_phase}>
            {row.transient_phase} pågår — obekräftat
          </span>
        )}
        {row.suggests_terminal_outcome && (
          <span className="mk-badge mk-tone-warning" data-pending-confirmation="true">
            väntar på bekräftelse
          </span>
        )}
        <button
          type="button"
          className="mk-toggle"
          aria-expanded={showJson}
          aria-controls={jsonId}
          data-event-json-toggle={showJson ? "open" : "closed"}
          onClick={() => setShowJson((current) => !current)}
        >
          {"{ }"}
        </button>
      </div>

      <div className="mk-event-meta">
        <span className="mk-mono">{event.ts}</span>
        <span className="mk-mono">{event.run_id}</span>
        {event.task_id !== null && <span className="mk-mono">{event.task_id}</span>}
        <span data-relation-text={row.relation}>{RELATION_TEXT[row.relation]}</span>
        {event.evidence_refs.length > 0 && (
          <span data-evidence-count={event.evidence_refs.length}>
            {event.evidence_refs.length === 1 ? "1 bevisreferens" : `${event.evidence_refs.length} bevisreferenser`}
          </span>
        )}
      </div>

      {unknown && (
        <p className="mk-hint" data-unknown-explanation="true">
          Typen finns inte i gränssnittets ordlista. Raden visas rå, får ingen tolkning och
          flyttar ingen state.
        </p>
      )}

      {showJson && (
        <pre className="mk-raw" id={jsonId} data-event-raw="true">
          {JSON.stringify(event, null, 2)}
        </pre>
      )}
    </li>
  );
}
