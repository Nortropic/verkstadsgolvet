import { NextRequest, NextResponse } from "next/server";
import { runWorkerBatch, workerSecretOk } from "@/lib/leads-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/leads/worker/run — n8n cron pingar denna. Secret-skyddad (x-webhook-secret),
 * undantagen session-gaten i middleware. Betar av en liten sats jobb ur kön.
 */
export async function POST(req: NextRequest) {
  if (!workerSecretOk(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, reason: "unauthorized", message: "Fel eller saknad hemlighet." }, { status: 401 });
  }
  let batch = 2;
  try {
    const b = await req.json();
    if (b && typeof b.batch === "number") batch = b.batch;
  } catch {
    /* ingen body = default batch */
  }
  const res = await runWorkerBatch(batch);
  return NextResponse.json(res);
}
