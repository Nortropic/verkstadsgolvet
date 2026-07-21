import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/claude";
import { createKundRepoAndPush } from "@/lib/github-write";
import type { OnboardingInput } from "@/lib/prompt-research";

/**
 * Onboarding-route (Fas B) — SKRIVANDE/AI. Middleware gatar denna (inloggad).
 * Dubbel-gate: returnerar 403 om ONBOARDING_ENABLED !== "true", så inga Claude-
 * eller GitHub-write-anrop kan avfyras i produktion förrän flaggan slås på och
 * Johnny testar övervakat (invariant 6).
 *
 * Två faser:
 *  - phase "research": kör Claude-research → { kind: "questions" | "research" | "error" }
 *  - phase "create":   skapar privat kund-repo + pushar research.md → STOPP
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Research kan ta tid (webbläsning). Ge routen gott om tid.
export const maxDuration = 300;

function guard(): NextResponse | null {
  if (process.env.ONBOARDING_ENABLED !== "true") {
    return NextResponse.json(
      { ok: false, reason: "disabled", message: "Onboarding är avstängd (ONBOARDING_ENABLED=false)." },
      { status: 403 }
    );
  }
  return null;
}

export async function POST(req: NextRequest) {
  const blocked = guard();
  if (blocked) return blocked;

  let body: {
    phase?: "research" | "create";
    input?: OnboardingInput;
    answers?: string;
    research?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Ogiltig JSON." }, { status: 400 });
  }

  const input = body.input;
  if (!input?.kundnamn?.trim() || !input?.formularsvar?.trim() || !input?.branschOrt?.trim()) {
    return NextResponse.json(
      { ok: false, reason: "bad-request", message: "Kundnamn, formulärsvar och bransch+ort krävs." },
      { status: 400 }
    );
  }

  if (body.phase === "research") {
    const result = await runResearch(input, body.answers);
    return NextResponse.json({ ok: true, ...result });
  }

  if (body.phase === "create") {
    if (!body.research?.trim()) {
      return NextResponse.json(
        { ok: false, reason: "bad-request", message: "Ingen research.md att pusha." },
        { status: 400 }
      );
    }
    const created = await createKundRepoAndPush(input.kundnamn, body.research);
    return NextResponse.json(created);
  }

  return NextResponse.json({ ok: false, reason: "bad-request", message: "Okänd fas." }, { status: 400 });
}
