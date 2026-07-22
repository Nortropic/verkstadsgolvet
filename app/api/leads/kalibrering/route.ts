import { NextRequest, NextResponse } from "next/server";
import { getKalibrering, createScoreVersion } from "@/lib/leads-data";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/leads/kalibrering — svarsfrekvens per score-intervall + modellvikter. */
export async function GET() {
  const res = await getKalibrering();
  if (!res.ok) return NextResponse.json(res);
  return NextResponse.json({ ok: true, ...res.data });
}

/** POST /api/leads/kalibrering — skapa & aktivera en ny score_version (kalibrera vikterna). */
export async function POST(req: NextRequest) {
  let body: { vikter?: unknown; bygg_demo_min?: unknown; kvalificerad_min?: unknown; kommentar?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }
  const vikter = Array.isArray(body.vikter)
    ? (body.vikter as unknown[])
        .filter((v): v is { signal: string; poang: number } => Boolean(v) && typeof (v as { signal?: unknown }).signal === "string")
        .map((v) => ({ signal: String(v.signal), poang: Number((v as { poang?: unknown }).poang), beskrivning: (v as { beskrivning?: string | null }).beskrivning ?? null }))
    : [];
  const res = await createScoreVersion({
    vikter,
    bygg_demo_min: Number(body.bygg_demo_min ?? 85),
    kvalificerad_min: Number(body.kvalificerad_min ?? 60),
    kommentar: typeof body.kommentar === "string" ? body.kommentar : undefined,
  });
  if (!res.ok) return NextResponse.json(res, { status: res.reason === "bad-request" ? 400 : 200 });
  return NextResponse.json({ ok: true, ...res.data });
}
