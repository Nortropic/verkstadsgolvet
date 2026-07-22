import { NextRequest, NextResponse } from "next/server";
import { enqueueSweep, getSweepStatus, updateSweepConfig } from "@/lib/leads-sweep";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/leads/sweep — status + täckning (per län). */
export async function GET() {
  const res = await getSweepStatus();
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true, ...res.data });
}

/** POST /api/leads/sweep { kommuner:[{lan,kommun}], kategoriIds:[] } — köa kombon. */
export async function POST(req: NextRequest) {
  let body: { kommuner?: unknown; kategoriIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }

  const kommuner = Array.isArray(body.kommuner)
    ? (body.kommuner as unknown[])
        .filter((k): k is { lan: string; kommun: string } => Boolean(k) && typeof (k as { kommun?: unknown }).kommun === "string")
        .map((k) => ({ lan: String(k.lan ?? ""), kommun: String(k.kommun) }))
    : [];
  const kategoriIds = Array.isArray(body.kategoriIds) ? (body.kategoriIds as unknown[]).map(String) : [];

  const res = await enqueueSweep(kommuner, kategoriIds);
  if (!res.ok) return NextResponse.json(res, { status: res.reason === "bad-request" ? 400 : 200 });
  return NextResponse.json({ ok: true, ...res.data });
}

/** PATCH /api/leads/sweep { dygns_budget?, aktiv? } — takt & paus. */
export async function PATCH(req: NextRequest) {
  let body: { dygns_budget?: unknown; aktiv?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }
  const res = await updateSweepConfig({
    dygns_budget: typeof body.dygns_budget === "number" ? body.dygns_budget : undefined,
    aktiv: typeof body.aktiv === "boolean" ? body.aktiv : undefined,
  });
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true });
}
