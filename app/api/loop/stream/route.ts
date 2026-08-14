/**
 * V9 · GET /api/loop/stream — SSE-tail ur kontrollplanets eventbutik.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — "Realtid: SSE från Railway, inte Supabase
 * Realtime i browsern", REALTIME, AUTH_SECURITY (DJUPFÖRSVAR, INGA UNDANTAG) och
 * IMPLEMENTATION_SLICES §V9.
 *
 * BINDANDE
 * · auth() anropas HÄR, före varje läsning. 401 utan session — samma kropp som läsroutarna.
 * · LOOP_ENABLED gatar hela trädet. 404 när flaggan är av.
 * · Nyckeln stannar på servern: webbläsaren får eventkuvert, aldrig transportkonfiguration.
 * · Ordning på `seq` ensamt. Ramens `id` ÄR seq, och `Last-Event-ID` läses som butiksglobal
 *   cursor vid återanslutning (aldrig per run).
 * · Ingen skrivning, inget kommando, ingen state, ingen origin/main-uppslagning.
 * · Klientens nedkoppling avbryter slingan: ingen tail lever vidare utan mottagare.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isLoopEnabled } from "@/components/loop/flag";
import {
  SSE_HEADERS,
  streamCursor,
  tailFrames,
  type TailPorts,
} from "@/lib/loop/stream";
import {
  LOOP_DISABLED_ENVELOPE,
  LOOP_READ_HEADERS,
  UNAUTHORIZED_ENVELOPE,
  httpStatusForReason,
  loadEvents,
  parseEventsQuery,
} from "@/lib/loop/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // DJUPFÖRSVAR: grinden hänger inte på middleware-matchern.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(UNAUTHORIZED_ENVELOPE, { status: 401, headers: LOOP_READ_HEADERS });
  }
  if (!isLoopEnabled()) {
    return NextResponse.json(LOOP_DISABLED_ENVELOPE, { status: 404, headers: LOOP_READ_HEADERS });
  }

  const url = new URL(request.url);
  // Samma frågeparser som läsroutens: ett ogiltigt värde AVVISAS i stället för att tyst falla
  // tillbaka på ett default som ger ett annat fönster än det anroparen bad om.
  const query = parseEventsQuery(url.searchParams);
  if (!query.ok) {
    return NextResponse.json(query, {
      status: httpStatusForReason(query.reason),
      headers: LOOP_READ_HEADERS,
    });
  }

  const cursor = streamCursor(request.headers, url.searchParams);

  const ports: TailPorts = {
    load: (window) => loadEvents(window),
    now: () => Date.now(),
    sleep: (ms: number) =>
      new Promise<void>((resolve) => {
        // Nedkoppling ska väcka slingan DIREKT, inte efter hela väntan — och lyssnaren tas
        // bort när väntan är över, så en lång anslutning inte samlar på sig en lyssnare per varv.
        const listenerScope = new AbortController();
        const done = () => {
          clearTimeout(timer);
          listenerScope.abort();
          resolve();
        };
        const timer = setTimeout(done, ms);
        request.signal.addEventListener("abort", done, {
          once: true,
          signal: listenerScope.signal,
        });
      }),
  };

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const frame of tailFrames(
          {
            after_seq: cursor,
            run_id: query.data.run_id,
            task_id: query.data.task_id,
            limit: query.data.limit,
            signal: request.signal,
          },
          ports,
        )) {
          controller.enqueue(encoder.encode(frame));
        }
      } catch {
        // En bruten socket är inte ett fel som ska loggas eller läcka en orsak till klienten.
      } finally {
        try {
          controller.close();
        } catch {
          // Redan stängd av mottagaren.
        }
      }
    },
  });

  return new Response(body, { status: 200, headers: SSE_HEADERS });
}
