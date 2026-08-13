/**
 * V4 · GET /api/loop/events — ett fönster ur kontrollplanets eventbutik.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — IMPLEMENTATION_SLICES §V4 (exit 5),
 * REALTIME (ordning på seq ensamt, gap endast i den OFILTRERADE butiksströmmen) och
 * AUTH_SECURITY (DJUPFÖRSVAR, INGA UNDANTAG).
 *
 * BINDANDE
 * · auth() anropas HÄR. 401 utan session.
 * · Ofiltrerad vy (`?after_seq=&limit=`) = butiksströmmen → gap-detektion PÅ.
 *   Så snart `run_id` eller `task_id` är satt är vyn filtrerad → gap-detektion AV (B3):
 *   andra runs event ligger legitimt emellan och en filtrerad vy hade larmat konstant.
 * · Raderna är AKTIVITET och BEVIS, aldrig authority. Ingen state härleds här.
 * · Ingen skrivning, inget kommando, ingen origin/main-uppslagning.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isLoopEnabled } from "@/components/loop/flag";
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(UNAUTHORIZED_ENVELOPE, { status: 401, headers: LOOP_READ_HEADERS });
  }
  if (!isLoopEnabled()) {
    return NextResponse.json(LOOP_DISABLED_ENVELOPE, { status: 404, headers: LOOP_READ_HEADERS });
  }

  const query = parseEventsQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return NextResponse.json(query, {
      status: httpStatusForReason(query.reason),
      headers: LOOP_READ_HEADERS,
    });
  }

  const result = await loadEvents(query.data);
  return NextResponse.json(result, {
    status: result.ok ? 200 : httpStatusForReason(result.reason),
    headers: LOOP_READ_HEADERS,
  });
}
