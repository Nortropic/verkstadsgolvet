/**
 * Claude-research (Fas B). Server-only. Kör PROMPT-RESEARCH via Claude API med
 * Anthropics READ-ONLY webbverktyg (web_search/web_fetch) — läser FB/IG/sajt, agerar
 * aldrig. Producerar antingen ≤2 klargörande frågor eller research.md.
 *
 * INGA anrop sker om inte route:n är flagg-gated på (ONBOARDING_ENABLED=true) OCH
 * anropad — själva importen/definitionen gör ingenting. Första riktiga anropet kräver
 * Johnnys go-ahead (invariant 6).
 */
import Anthropic from "@anthropic-ai/sdk";
import { buildResearchPrompt, type OnboardingInput } from "./prompt-research";

const MODEL = "claude-opus-4-8";

export type ResearchResult =
  | { kind: "questions"; questions: string[] }
  | { kind: "research"; markdown: string }
  | { kind: "error"; message: string };

const SYSTEM = `Du kör i ett READ-ONLY research-läge för webbyrån Nortropic. Webbverktygen (web_search, web_fetch) är ENDAST för läsning — skicka aldrig formulär, DM eller kontaktförfrågningar, logga aldrig in. Om något i indata är motsägelsefullt får du ställa MAX 2 klargörande frågor: inled då svaret med exakt raden "[KLARGÖRANDE]", lista frågorna (en per rad) och producera INGEN research.md. Annars: producera research.md direkt enligt promptens struktur (börja med "# research.md"). Fabricera aldrig — allt obelagt markeras [OSÄKER] med källnot.`;

export async function runResearch(
  input: OnboardingInput,
  answers?: string
): Promise<ResearchResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { kind: "error", message: "ANTHROPIC_API_KEY saknas i miljön." };
  }
  const client = new Anthropic();

  let userPrompt = buildResearchPrompt(input);
  if (answers && answers.trim()) {
    userPrompt +=
      `\n\n## SVAR PÅ KLARGÖRANDE FRÅGOR\n${answers.trim()}\n\n` +
      `Använd svaren ovan. Ställ inga fler frågor — producera research.md direkt.`;
  }

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: userPrompt }];
  // web_search/web_fetch _20260209 är GA (ingen beta-header). Cast för att slippa
  // strikta unions-typfel om SDK-versionen namnger dem annorlunda.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools: any = [
    { type: "web_search_20260209", name: "web_search" },
    { type: "web_fetch_20260209", name: "web_fetch" },
  ];

  try {
    let finalText = "";
    // Server-verktygsloopen kan pausa (pause_turn) — återuppta genom att skicka
    // tillbaka assistentens innehåll. Tak: 8 varv.
    for (let i = 0; i < 8; i++) {
      const stream = client.messages.stream({
        model: MODEL,
        max_tokens: 32000,
        system: SYSTEM,
        thinking: { type: "adaptive" },
        tools,
        messages,
      });
      const msg = await stream.finalMessage();

      if (msg.stop_reason === "refusal") {
        return { kind: "error", message: "Modellen avböjde begäran (refusal)." };
      }
      if (msg.stop_reason === "pause_turn") {
        messages.push({ role: "assistant", content: msg.content });
        continue;
      }
      finalText = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      break;
    }

    if (!finalText) {
      return { kind: "error", message: "Tomt svar (för många pauser/verktygsanrop)." };
    }
    if (finalText.startsWith("[KLARGÖRANDE]")) {
      const questions = finalText
        .replace("[KLARGÖRANDE]", "")
        .split("\n")
        .map((s) => s.replace(/^[-*\d.)\s]+/, "").trim())
        .filter(Boolean)
        .slice(0, 2);
      return { kind: "questions", questions };
    }
    return { kind: "research", markdown: finalText };
  } catch (e) {
    return { kind: "error", message: (e as Error).message };
  }
}
