import { NextRequest, NextResponse } from "next/server";
import { listLeads } from "@/lib/leads-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/leads?status=&bransch=&ort= — lista med beräknad score. Alltid 200 + envelope. */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const res = await listLeads({
    status: searchParams.get("status") || undefined,
    bransch: searchParams.get("bransch") || undefined,
    ort: searchParams.get("ort") || undefined,
  });
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true, leads: res.data.leads, config: res.data.config });
}
