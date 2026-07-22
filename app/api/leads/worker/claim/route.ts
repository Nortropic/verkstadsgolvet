import { NextRequest, NextResponse } from "next/server";
import { claimCombos, workerSecretOk } from "@/lib/leads-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/leads/worker/claim — n8n hämtar nästa sats jobb. Secret-skyddad (ej session-gatad). */
export async function POST(req: NextRequest) {
  if (!workerSecretOk(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, reason: "unauthorized", message: "Fel eller saknad hemlighet." }, { status: 401 });
  }
  let batch = 8;
  try {
    const b = await req.json();
    if (b && typeof b.batch === "number") batch = b.batch;
  } catch {
    /* ingen body = default batch */
  }
  const res = await claimCombos(batch);
  return NextResponse.json(res);
}
