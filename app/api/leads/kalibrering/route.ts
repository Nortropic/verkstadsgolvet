import { NextResponse } from "next/server";
import { getKalibrering } from "@/lib/leads-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/leads/kalibrering — svarsfrekvens per score-intervall + modellvikter. */
export async function GET() {
  const res = await getKalibrering();
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true, ...res.data });
}
