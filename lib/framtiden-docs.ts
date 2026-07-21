/**
 * Framtiden — Nortropics strategi- och roadmap-dokument (kopierbara i dashboarden).
 * Läses VERBATIM ur content/framtiden/*.md så innehållet bevaras exakt. Server-only
 * (fs) — importeras av server-sidan /framtiden, aldrig av klientkod. Läs-only: bara
 * statiskt referensinnehåll, ingen GitHub, inga anrop.
 *
 * Båda är interna positionerings-/strategidokument (till dig) — inte kund-deliverables.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FramtidenDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/framtiden", file), "utf-8");
}

export const FRAMTIDEN_DOCS: FramtidenDoc[] = [
  {
    id: "digital-narvaro-erbjudande",
    title: "Digital närvaro — erbjudande, strategi & luckor",
    description:
      "Samlad överblick: kärnpositionering (ägandeskap), vad som är byggt, vad som medvetet valts bort, genuina luckor (e-post, llms.txt, NAP) och vad som är framtida. Din strategikarta.",
    audience: "dig",
    content: load("NORTROPIC-DIGITAL-NARVARO-ERBJUDANDE.md"),
  },
  {
    id: "foretags-ekosystem-epost",
    title: "Företags-e-post & ekosystem (M365 / Workspace)",
    description:
      "Var gränsen går mellan webbyrå och IT-leverantör: de tre nivåerna, varför nivå 1–2 är rätt för Nortropic, teknisk best practice — plus en enkel förklaring att ge kunden.",
    audience: "dig",
    content: load("FORETAGS-EKOSYSTEM-EPOST.md"),
  },
];
