/**
 * V4 · GET /api/loop/snapshot — controllerns publicerade snapshot (DISPLAYED_TRUTH).
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — IMPLEMENTATION_SLICES §V4, AUTH_SECURITY
 * ("DJUPFÖRSVAR: varje /api/loop/**-handler anropar auth() själv → 401 utan session" ·
 * "INGA UNDANTAG: /api/loop/** läggs ALDRIG till i middleware-matcherns undantagslista") och
 * ROUTE_PLAN (hela /loop-trädet bakom LOOP_ENABLED).
 *
 * BINDANDE
 * · auth() anropas HÄR, i handlern. Skyddet hänger aldrig på middleware-regexen ensam.
 * · Routen LÄSER. Den skriver aldrig i loop_events/loop_snapshots, köar inget kommando,
 *   slår aldrig upp origin/main och härleder ingen state ur en event-fold.
 * · Otillgänglig backend → envelope med orsak (planens feltexter), aldrig nollor, aldrig
 *   uppfunnen data. Vyerna renderar "—".
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isLoopEnabled } from "@/components/loop/flag";
import {
  LOOP_DISABLED_ENVELOPE,
  LOOP_READ_HEADERS,
  UNAUTHORIZED_ENVELOPE,
  httpStatusForReason,
  loadSnapshot,
  parseIdParam,
} from "@/lib/loop/transport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // DJUPFÖRSVAR — inte en dubblering av middleware, utan det andra lagret planen kräver.
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(UNAUTHORIZED_ENVELOPE, { status: 401, headers: LOOP_READ_HEADERS });
  }
  // Produktgrind, läses vid REQUEST (force-dynamic) så en avslagen flagga gäller direkt.
  if (!isLoopEnabled()) {
    return NextResponse.json(LOOP_DISABLED_ENVELOPE, { status: 404, headers: LOOP_READ_HEADERS });
  }

  const runId = parseIdParam("run_id", new URL(request.url).searchParams.get("run_id"));
  if (!runId.ok) {
    return NextResponse.json(runId, {
      status: httpStatusForReason(runId.reason),
      headers: LOOP_READ_HEADERS,
    });
  }

  const result = await loadSnapshot({ run_id: runId.data });
  return NextResponse.json(result, {
    status: result.ok ? 200 : httpStatusForReason(result.reason),
    headers: LOOP_READ_HEADERS,
  });
}
