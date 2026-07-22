import { NextRequest, NextResponse } from "next/server";
import { getLead, updateLead } from "@/lib/leads-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/leads/[id] — enskild lead med score-uppdelning. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const res = await getLead(id);
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true, lead: res.data });
}

/** PATCH /api/leads/[id] — uppdaterar manuell bedömning/status (whitelistade fält), räknar om score. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }
  const res = await updateLead(id, body);
  if (!res.ok) {
    return NextResponse.json(res, { status: res.reason === "bad-request" ? 400 : 200 });
  }
  return NextResponse.json({ ok: true, lead: res.data });
}
