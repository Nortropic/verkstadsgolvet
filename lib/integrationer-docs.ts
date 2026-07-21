/**
 * Integrationer — Nortropics översikt över integrationer & tjänster att känna till
 * (kopierbar i dashboarden). Läses VERBATIM ur content/integrationer/*.md så innehållet
 * (taggar, ★, 🇪🇺/🇸🇪, rubriker) bevaras exakt. Server-only (fs) — importeras av
 * server-sidan /integrationer, aldrig av klientkod. Läs-only: statiskt, ingen GitHub,
 * inga anrop. Internt referensdokument (till dig).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type IntegrationerDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/integrationer", file), "utf-8");
}

export const INTEGRATIONER_DOCS: IntegrationerDoc[] = [
  {
    id: "integrationer-oversikt",
    title: "Integrationer & tjänster att känna till",
    description:
      "Katalog per område (transaktionsmejl, nyhetsbrev, SMS, bokning, betalning, e-handel, automation, CRM, auth, databas) med taggar [gratis]/[freemium]/[betalt], ★ = passar din stack och 🇪🇺/🇸🇪-markering. Avslutas med prioritering: vad som är värt att kolla NU.",
    audience: "dig",
    content: load("NORTROPIC-INTEGRATIONER-OVERSIKT.md"),
  },
];
