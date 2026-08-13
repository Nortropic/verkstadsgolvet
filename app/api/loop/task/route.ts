/**
 * V4 · GET /api/loop/task?task_id=… — EN uppgift: snapshotens auktoritativa vy + dess ström.
 *
 * KÄLLA: docs/nortropic-control-room-plan-v1.md — IMPLEMENTATION_SLICES §V4, READ_MODEL
 * (SNAPSHOT_WINS) och AUTH_SECURITY (DJUPFÖRSVAR, INGA UNDANTAG).
 *
 * BINDANDE
 * · auth() anropas HÄR. 401 utan session.
 * · Lifecycle-state kommer UR SNAPSHOTEN. En tail-sekvens som ser ut att avsluta uppgiften
 *   ger "väntar på bekräftelse", aldrig DONE (sammanslagningen är V3:s buildReadModel).
 * · Vyn är per definition task-filtrerad → gap-detektion AV (B3).
 * · Saknas uppgiften i både snapshot och ström är svaret "vet inte" (task: null) — aldrig
 *   ett tomt kort med uppfunna fält.
 */
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { isLoopEnabled } from "@/components/loop/flag";
import {
  LOOP_DISABLED_ENVELOPE,
  LOOP_READ_HEADERS,
  UNAUTHORIZED_ENVELOPE,
  httpStatusForReason,
  loadTask,
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

  // Samma parser som eventfönstret: en task-vy ÄR ett filtrerat eventfönster plus
  // snapshotens vy, och två parallella tolkningar av after_seq/limit hade kunnat glida isär.
  const query = parseEventsQuery(new URL(request.url).searchParams);
  if (!query.ok) {
    return NextResponse.json(query, {
      status: httpStatusForReason(query.reason),
      headers: LOOP_READ_HEADERS,
    });
  }
  if (query.data.task_id === null) {
    return NextResponse.json(
      { ok: false, reason: "invalid-request", message: "task_id saknas." },
      { status: 400, headers: LOOP_READ_HEADERS },
    );
  }

  const result = await loadTask({
    task_id: query.data.task_id,
    run_id: query.data.run_id,
    after_seq: query.data.after_seq,
    limit: query.data.limit,
  });
  return NextResponse.json(result, {
    status: result.ok ? 200 : httpStatusForReason(result.reason),
    headers: LOOP_READ_HEADERS,
  });
}
