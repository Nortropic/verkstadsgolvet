"use client";

/**
 * V9 · Eventströmmens panel: transportläge, banner, [sv]/[raw], pausad autoskroll och raderna.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — TARGET_UX (strömpanelen), EVENT_CLIENT,
 * REALTIME och COMPONENT_PLAN (EventStream.tsx).
 *
 * BINDANDE REGLER SOM PANELEN BÄR
 * -------------------------------
 * · PANELEN PÅSTÅR ALDRIG REALTID NÄR DEN POLLAR. Etiketten kommer ur transportläget
 *   (lib/loop/realtime.ts) och `data-realtime` är sant i exakt ett läge: öppen ström. Ordet
 *   "direktström" står bara där en ström faktiskt är öppen.
 * · Panelen HÄMTAR INGENTING och äger ingen anslutning. Den får ett läge in och renderar det.
 *   Anslutningen ligger i LiveEventStream, policyn i lib/loop/realtime.ts.
 * · Strömmen är AKTIVITET OCH BEVIS, aldrig authority. Inga lifecycle-tillstånd, ingen dom,
 *   ingen attestation och ingen promotion renderas här.
 * · Avkortning rapporteras ÄRLIGT: visas de senaste raderna står det utskrivet hur många av
 *   hur många. Ingen rad försvinner tyst.
 * · Ingen animation, ingen framstegsindikator. En "pågår"-signal kräver ett faktiskt event.
 */
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import EventRow from "./EventRow";
import StaleBanner from "./StaleBanner";
import { toneClass } from "./ui";
import { MISSING, orMissing } from "@/lib/loop/labels";
import {
  TRANSPORT_PRESENTATION,
  tailNotices,
  visibleRows,
  type TailSnapshot,
} from "@/lib/loop/realtime";

/** Hur många rader som renderas. Butiken behåller fler; avkortningen är ren presentation. */
export const STREAM_VISIBLE_ROWS = 200;

export type EventStreamProps = {
  snapshot: TailSnapshot;
  maxRows?: number;
  /** Startläge för den globala växeln [sv] / [raw event_type]. */
  initialRaw?: boolean;
  /** Startläge för autoskroll. Provet sätter den; operatören växlar med knappen. */
  initialAutoscroll?: boolean;
};

export default function EventStream({
  snapshot,
  maxRows = STREAM_VISIBLE_ROWS,
  initialRaw = false,
  initialAutoscroll = true,
}: EventStreamProps) {
  const [raw, setRaw] = useState(initialRaw);
  const [autoscroll, setAutoscroll] = useState(initialAutoscroll);
  const listRef = useRef<HTMLDivElement | null>(null);

  const { connection, stream, stats } = snapshot;
  const transport = TRANSPORT_PRESENTATION[connection.mode];
  const notices = tailNotices(snapshot);
  const rows = visibleRows(stream, maxRows);
  const truncated = stream.rows.length - rows.length;

  // Autoskroll utan animation: behållaren ställs längst ned när nya rader kommit in. Är
  // autoskroll pausad rör vi ingenting alls — då äger läsaren sin position.
  useEffect(() => {
    if (!autoscroll) return;
    const node = listRef.current;
    if (node === null) return;
    node.scrollTop = node.scrollHeight;
  }, [autoscroll, stream.rows.length]);

  return (
    <section className="mk-panel mk-stream" data-event-stream="true" aria-label="Eventström">
      <h2 className="mk-panel-title">
        <span>Eventström</span>
        <span
          className={`mk-badge ${toneClass(transport.tone)}`}
          data-transport-mode={connection.mode}
          data-realtime={transport.realtime ? "true" : "false"}
        >
          {transport.label}
        </span>
      </h2>

      <p className="mk-hint" data-transport-detail="true">
        {transport.detail}
      </p>

      <StaleBanner notices={notices} />

      <div className="mk-actions" data-stream-controls="true">
        <button
          type="button"
          className="mk-toggle"
          aria-pressed={!raw}
          data-stream-language={raw ? "raw" : "sv"}
          onClick={() => setRaw(false)}
        >
          [sv]
        </button>
        <button
          type="button"
          className="mk-toggle"
          aria-pressed={raw}
          data-stream-raw-toggle={raw ? "on" : "off"}
          onClick={() => setRaw(true)}
        >
          [raw event_type]
        </button>
        <button
          type="button"
          className="mk-toggle"
          aria-pressed={!autoscroll}
          data-stream-autoscroll={autoscroll ? "on" : "paused"}
          onClick={() => setAutoscroll((current) => !current)}
        >
          {autoscroll ? "⏸ pausa autoskroll" : "▶ återuppta autoskroll"}
        </button>
      </div>

      {stream.rows.length === 0 ? (
        <p className="mk-empty" data-stream-empty="true">
          Ingen händelse i strömmen ännu. {transport.detail}
        </p>
      ) : (
        <>
          {truncated > 0 && (
            <p className="mk-hint" data-stream-truncated={truncated}>
              Visar de {rows.length} senaste raderna av {stream.rows.length} i minnet. Äldre
              rader finns kvar i kontrollplanets eventbutik.
            </p>
          )}
          <div className="mk-stream-rows" ref={listRef} data-stream-rows={rows.length}>
            <ol className="mk-events">
              {rows.map((row) => (
                <EventRow key={row.event.event_id} row={row} raw={raw} />
              ))}
            </ol>
          </div>
        </>
      )}

      {/*
        Leveransens egen bokföring. Den finns här för att dedupen ska gå att SE: en dubblerad
        leverans syns som ett räknarsteg, aldrig som en extra rad.
      */}
      <p className="mk-hint" data-stream-ledger="true">
        <span data-ledger-cursor={orMissing(connection.cursor)}>
          senast sedda seq {orMissing(connection.cursor)}
        </span>
        {" · "}
        <span data-ledger-rows={stats.retained}>{stats.retained} rader i minnet</span>
        {" · "}
        <span data-ledger-duplicates={stats.duplicates}>
          {stats.duplicates} dubbletter avvisade
        </span>
        {" · "}
        <span data-ledger-invalid={stats.invalid}>{stats.invalid} ogiltiga rader</span>
        {stats.low_water_seq !== null && (
          <>
            {" · "}
            <span data-ledger-low-water={stats.low_water_seq}>
              äldre än seq {stats.low_water_seq} har lämnat minnet
            </span>
          </>
        )}
      </p>

      <p className="mk-hint" data-stream-authority="NONE">
        Strömmen är aktivitet och bevis. Uppgifternas tillstånd, domar, attestation och
        promotion kommer ur controllerns snapshot — aldrig härifrån.
        {stream.gap_detection === "disabled_filtered_view" &&
          " Vyn är filtrerad: hopp i seq är legitima och larmas därför aldrig som lucka."}
      </p>

      {connection.next_retry_in_ms !== null && (
        <p className="mk-hint" data-stream-retry-in={connection.next_retry_in_ms}>
          Nästa försök om {Math.round(connection.next_retry_in_ms / 1000)} s (försök{" "}
          {connection.attempt}).
        </p>
      )}

      {connection.cursor === null && stream.rows.length === 0 && (
        <p className="mk-hint" data-stream-no-cursor={MISSING}>
          Ingen cursor ännu — vyn har inte sett något event i den här butiken.
        </p>
      )}
    </section>
  );
}
