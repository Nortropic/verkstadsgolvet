/**
 * Google Business Profile-dokumenten (kopierbara i dashboarden). Läses VERBATIM ur
 * content/gbp/*.md så innehållet (inkl. backticks och [KUND MÅSTE FYLLA I]) bevaras
 * exakt. Server-only (fs) — importeras av server-sidan /gbp, aldrig av klientkod.
 * Läs-only: bara statiskt referensinnehåll, ingen GitHub, inga anrop.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type GbpDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/gbp", file), "utf-8");
}

export const GBP_DOCS: GbpDoc[] = [
  {
    id: "prompt-gbp",
    title: "GBP-prompt",
    description:
      "Klistra in i Claude-i-browsern och fyll INDATA → Claude producerar allt GBP-innehåll fält för fält (primärkategori, beskrivning, tjänster, attribut, första inlägget), redo att saxa in i Google.",
    audience: "dig",
    content: load("PROMPT-GBP.md"),
  },
  {
    id: "kund-lathund",
    title: "Kund-lathund",
    description:
      "Färdig guide att skicka kunden: verifiering (video), håll profilen levande, recensioner och en checklista.",
    audience: "kund",
    content: load("KUND-LATHUND-GBP.md"),
  },
  {
    id: "qr-recension",
    title: "QR + recensionsguide",
    description:
      "Färdig guide till kunden: så får de sin recensions-QR + en färdig lapp att ge sina egna kunder.",
    audience: "kund",
    content: load("QR-RECENSION-GUIDE.md"),
  },
];
