import { NextRequest, NextResponse } from "next/server";
import { createKundRepoAndPush } from "@/lib/github-write";

/**
 * Onboarding-route (Fas B, förenklad). Appen anropar INTE Claude — research görs i
 * Claude-i-browsern (prompten genereras klientsidan). Denna route gör bara det
 * SKRIVANDE steget: skapa PRIVAT kund-<slug> + pusha research.md → STOPP.
 *
 * Gatad av ONBOARDING_ENABLED (403 tills på) — det enda skrivande GitHub-anropet
 * i hela appen. Startar aldrig ett bygge.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (process.env.ONBOARDING_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, reason: "disabled", message: "Onboarding är avstängd (ONBOARDING_ENABLED=false)." },
      { status: 403 }
    );
  }

  let body: { kundnamn?: string; research?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }

  if (!body.kundnamn?.trim()) {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Kundnamn krävs." }, { status: 400 });
  }
  if (!body.research?.trim()) {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ingen research.md att pusha." }, { status: 400 });
  }

  const created = await createKundRepoAndPush(body.kundnamn, body.research);
  return NextResponse.json(created);
}
