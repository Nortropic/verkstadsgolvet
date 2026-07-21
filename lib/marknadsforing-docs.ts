/**
 * Marknadsförings-dokumenten (kopierbara i dashboarden). Läses VERBATIM ur
 * content/marknadsforing/*.md så innehållet (rubriker, listor, siffror) bevaras
 * exakt. Server-only (fs) — importeras av server-sidan /marknadsforing, aldrig av
 * klientkod. Läs-only: bara statiskt referensinnehåll, ingen GitHub, inga anrop.
 *
 * Alla tre är pedagogiska guider skrivna direkt till företagaren → "Till kunden".
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export type MarknadsforingDoc = {
  id: string;
  title: string;
  description: string;
  audience: "dig" | "kund";
  content: string;
};

function load(file: string): string {
  return readFileSync(join(process.cwd(), "content/marknadsforing", file), "utf-8");
}

export const MARKNADSFORING_DOCS: MarknadsforingDoc[] = [
  {
    id: "annonskanaler",
    title: "Annonskanaler — vad lönar sig?",
    description:
      "Översikt att skicka kunden: vilka kanaler ger mest för pengarna som liten svensk företagare, prioriteringsordning, budget-tumregler och de dyraste misstagen.",
    audience: "kund",
    content: load("ANNONSKANALER-SVENSK-SMAFORETAGARE.md"),
  },
  {
    id: "google-ads",
    title: "Google Ads — från grunden",
    description:
      "Nybörjarguide till kunden: vad Google Ads är, hur det funkar steg för steg, hur man kommer igång utan att bränna pengar och de vanligaste misstagen.",
    audience: "kund",
    content: load("GUIDE-GOOGLE-ADS-NYBORJARE.md"),
  },
  {
    id: "meta-ads",
    title: "Meta (Facebook & Instagram) — från grunden",
    description:
      "Nybörjarguide till kunden: hur Meta-annonser skiljer sig från Google, hur man kommer igång i Ads Manager och varför bilden är själva annonsen.",
    audience: "kund",
    content: load("GUIDE-META-ADS-NYBORJARE.md"),
  },
];
