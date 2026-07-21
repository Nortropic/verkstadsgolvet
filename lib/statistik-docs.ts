/**
 * Cookies, GDPR & statistik-dokumenten (kopierbara i dashboarden). Läses VERBATIM ur
 * content/statistik/*.md så innehållet (☐-rutor, rubriker, listor) bevaras exakt.
 * Server-only (fs) — importeras av server-sidan /statistik, aldrig av klientkod.
 * Läs-only: bara statiskt referensinnehåll, ingen GitHub, inga anrop.
 *
 * Checklistan är intern uppsättning (Till dig); de två lathundarna skickas kunden.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type StatistikDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/statistik", file), "utf-8");
}

export const STATISTIK_DOCS: StatistikDoc[] = [
  {
    id: "checklista-analytics",
    title: "Analytics-setup — checklista (internt)",
    description:
      "Intern teknisk uppsättning per kundsajt: två spår (cookiefritt vs Ads-kund), GA4, Enhanced Conversions, Consent Mode v2 och obligatorisk verifiering. Inte till kunden.",
    audience: "dig",
    content: load("CHECKLISTA-ANALYTICS-SETUP.md"),
  },
  {
    id: "kund-lathund-statistik",
    title: "Kund-lathund — webbstatistik",
    description:
      "Färdig guide att skicka kunden: de tre frågorna statistiken svarar på, en 10-minuters månadskoll och vad man inte behöver bry sig om.",
    audience: "kund",
    content: load("KUND-LATHUND-STATISTIK.md"),
  },
  {
    id: "kund-lathund-cookies-gdpr",
    title: "Kund-lathund — cookies & GDPR",
    description:
      "Färdig guide att skicka kunden: när cookie-banner behövs, kundens eget personuppgiftsansvar och vad Nortropic satt upp. Allmän info, ej juridisk rådgivning.",
    audience: "kund",
    content: load("KUND-LATHUND-COOKIES-GDPR.md"),
  },
];
