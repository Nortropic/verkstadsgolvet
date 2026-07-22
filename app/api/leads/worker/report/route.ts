import { NextRequest, NextResponse } from "next/server";
import { reportCombo, workerSecretOk } from "@/lib/leads-worker";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/leads/worker/report — n8n rapporterar enrichade leads + anropsantal per kombo. */
export async function POST(req: NextRequest) {
  if (!workerSecretOk(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ ok: false, reason: "unauthorized", message: "Fel eller saknad hemlighet." }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }
  const res = await reportCombo({
    combo_id: String(body.combo_id ?? ""),
    placer_hittade: typeof body.placer_hittade === "number" ? body.placer_hittade : undefined,
    records: Array.isArray(body.records) ? (body.records as Record<string, unknown>[]) : [],
    sok_anrop: typeof body.sok_anrop === "number" ? body.sok_anrop : 0,
    detalj_anrop: typeof body.detalj_anrop === "number" ? body.detalj_anrop : 0,
  });
  const status = res.ok ? 200 : res.reason === "bad-request" ? 400 : 200;
  return NextResponse.json(res, { status });
}
