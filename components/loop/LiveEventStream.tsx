"use client";

/**
 * V9 · Anslutningen: SSE-tail med reconnect, backfill, dedup och synlig poll-fallback.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — REALTIME, EVENT_CLIENT (reconnect/backfill),
 * "Realtid: SSE från Railway" och IMPLEMENTATION_SLICES §V9.
 *
 * BINDANDE REGLER SOM DENNA FIL BÄR
 * ---------------------------------
 * · ALL POLICY LIGGER I lib/loop/realtime.ts. Den här filen är PORTARNA och ingenting annat:
 *   EventSource, fetch, timers, klocka, slump och Page Visibility. Skälet är mätbarhet — hela
 *   reconnect-, backfill- och fallbackbeteendet provas utan att en socket öppnas.
 * · Cursorn som skickas vid varje (åter)anslutning är butikens högsta sedda `seq` — aldrig per
 *   run. Servern läser den som `?after_seq=`, och webbläsarens egna `Last-Event-ID` betyder
 *   samma sak på serversidan.
 * · ETT ICKE-JSON-SVAR ÄR EN UTGÅNGEN SESSION, inte tom data. Det renderas som planens rad
 *   "Sessionen gick ut — ladda om sidan" och aldrig som en tom ström.
 * · Ingen optimistisk state. Panelen visar strömmen; uppgifternas tillstånd kommer ur
 *   controllerns snapshot.
 */
import * as React from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import EventStream from "./EventStream";
import {
  BACKFILL_PAGE_LIMIT,
  createTailConnection,
  idleSnapshot,
  type TailConnection,
  type TailPorts,
} from "@/lib/loop/realtime";

export const STREAM_ENDPOINT = "/api/loop/stream";
export const EVENTS_ENDPOINT = "/api/loop/events";

/** Ramnamnen servern skickar (lib/loop/stream.ts). En okänd ram tolkas aldrig som ett event. */
const FRAME = { open: "loop.open", event: "loop.event", notice: "loop.notice", closing: "loop.closing" };

const SESSION_EXPIRED = "Sessionen gick ut — ladda om sidan.";
const STREAM_UNSUPPORTED =
  "Den här webbläsaren har ingen direktström (EventSource). Vyn hämtar event med poll i stället.";

function windowUrl(afterSeq: number | null, limit: number): string {
  const params = new URLSearchParams();
  if (afterSeq !== null) params.set("after_seq", String(afterSeq));
  params.set("limit", String(limit));
  return `${EVENTS_ENDPOINT}?${params.toString()}`;
}

function streamUrl(afterSeq: number | null): string {
  const params = new URLSearchParams();
  if (afterSeq !== null) params.set("after_seq", String(afterSeq));
  const query = params.toString();
  return query.length === 0 ? STREAM_ENDPOINT : `${STREAM_ENDPOINT}?${query}`;
}

/** Kuvertets form ur V4:s läsroute — läst defensivt, aldrig antaget. */
function readWindowEnvelope(
  body: unknown,
): { ok: true; events: unknown[]; may_have_more: boolean } | { ok: false; message: string } {
  if (body === null || typeof body !== "object") return { ok: false, message: SESSION_EXPIRED };
  const envelope = body as { ok?: unknown; message?: unknown; data?: unknown };
  if (envelope.ok !== true) {
    const message =
      typeof envelope.message === "string" && envelope.message.length > 0
        ? envelope.message
        : "Kontrollplanets läsyta svarade utan orsak.";
    return { ok: false, message };
  }
  const data = envelope.data as
    | { stream?: { rows?: unknown }; window?: { may_have_more?: unknown } }
    | undefined;
  const rows = Array.isArray(data?.stream?.rows) ? (data?.stream?.rows as unknown[]) : [];
  const events = rows.map((row) =>
    row !== null && typeof row === "object" ? (row as { event?: unknown }).event : row,
  );
  return { ok: true, events, may_have_more: data?.window?.may_have_more === true };
}

/** Webbläsarens portar. Skapas en gång per monterad panel. */
export function browserPorts(): TailPorts {
  return {
    openStream: ({ after_seq, handlers }) => {
      if (typeof EventSource === "undefined") {
        // Ingen ström i den här miljön → ett ärligt fel, som leder till poll-fallback.
        handlers.onError(STREAM_UNSUPPORTED);
        return { close: () => {} };
      }
      const source = new EventSource(streamUrl(after_seq));
      let closed = false;
      const fail = (message: string) => {
        if (closed) return;
        closed = true;
        source.close();
        handlers.onError(message);
      };
      source.onopen = () => handlers.onOpen();
      source.addEventListener(FRAME.event, (raw: Event) => {
        try {
          handlers.onEvent(JSON.parse((raw as MessageEvent<string>).data) as unknown);
        } catch {
          // En oläsbar ram är inte ett event. Den tystas som rad, men får inte fälla strömmen.
        }
      });
      source.addEventListener(FRAME.notice, (raw: Event) => {
        try {
          const notice = JSON.parse((raw as MessageEvent<string>).data) as { message?: unknown };
          fail(typeof notice.message === "string" ? notice.message : "Läsplanet svarade med ett fel.");
        } catch {
          fail("Läsplanet svarade med ett fel.");
        }
      });
      source.addEventListener(FRAME.closing, () =>
        fail("Servern stängde strömmen. Återansluter från senast sedda seq."),
      );
      source.onerror = () => fail("Anslutningen till direktströmmen bröts.");
      return {
        close: () => {
          closed = true;
          source.close();
        },
      };
    },

    fetchWindow: async ({ after_seq, limit }) => {
      try {
        const response = await fetch(windowUrl(after_seq, limit), {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
        });
        let body: unknown = null;
        try {
          body = (await response.json()) as unknown;
        } catch {
          return { ok: false, message: SESSION_EXPIRED };
        }
        const envelope = readWindowEnvelope(body);
        if (!envelope.ok) return { ok: false, message: envelope.message };
        return {
          ok: true,
          page: { events: envelope.events, may_have_more: envelope.may_have_more },
        };
      } catch {
        return { ok: false, message: "Läsplanet gick inte att nå." };
      }
    },

    now: () => Date.now(),
    random: () => Math.random(),
    setTimer: (ms, run) => window.setTimeout(run, ms),
    clearTimer: (id) => window.clearTimeout(id),
  };
}

export type LiveEventStreamProps = {
  /** Snapshotens vattenmärke: rader vid eller under det är redan bekräftade. */
  watermark?: number | null;
  /** Injicerad anslutning. Bara prov och fixturvyer sätter den. */
  connection?: TailConnection;
};

export default function LiveEventStream({ watermark = null, connection }: LiveEventStreamProps) {
  // Konstruktionen rör ingen omvärld: portarna anropas först när maskinen startas i en effekt.
  const [tail] = useState<TailConnection>(
    () =>
      connection ??
      createTailConnection({
        ports: browserPorts(),
        storeOptions: { scope: "store", seq_watermark: watermark },
        backfillPageLimit: BACKFILL_PAGE_LIMIT,
      }),
  );

  const snapshot = useSyncExternalStore(tail.subscribe, tail.snapshot, idleSnapshot);

  useEffect(() => {
    tail.start();
    const onVisibility = () =>
      tail.setVisibility(document.visibilityState === "hidden" ? "hidden" : "visible");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      tail.stop();
    };
  }, [tail]);

  useEffect(() => {
    tail.setWatermark(watermark);
  }, [tail, watermark]);

  return <EventStream snapshot={snapshot} />;
}
