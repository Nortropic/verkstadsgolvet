/**
 * PINNAD COMPOSER (S1, Webbförvaltningen).
 *
 * Denna fil bär INTE längre någon egen kopia av researchfrågorna. Kontraktet är
 * kanoniskt i `Nortropic/nortropic-system`
 * (`skills/nortropic-plan/references/research-kontrakt-v3.md` + `packs/<pack>/research-module.md`),
 * pinnas via `lib/research-contract/pin.json` och verifieras fail-closed på servern
 * innan något komponeras. En composer som bär sin egen kopia är en MUTABEL
 * RUNTIME-KÄLLA — precis det kontraktet förbjuder.
 *
 * `buildResearchPrompt` är en REN funktion: den tar den redan verifierade
 * kontraktstexten som indata och kan därför köras i klienten utan krypto-beroenden.
 * Den verifierar alltså INTE själv: dess enda produktionsanropare är serverkomponenten
 * `app/(app)/onboarding/page.tsx`, som redan bevisat identiteten fail-closed. Utan den
 * grinden renderas ingen prompt alls.
 *
 * OBS: att komponera denna sträng gör INGET Claude-anrop. Read-only-regeln
 * (skicka aldrig formulär/DM/kontaktförfrågningar) kommer ur kontraktstexten.
 */

export type OnboardingInput = {
  formularsvar: string;
  facebook: string;
  instagram: string;
  hemsida: string;
  branschOrt: string;
  kanaler: string;
  kundnamn: string;
};

/** Den verifierade kontraktsidentiteten, framtagen på servern av lib/research-contract. */
export type VerifiedContract = {
  version: string;
  coreText: string;
  sourceCommit: string;
  /** `null` = core-only. Ett GILTIGT läge enligt kontraktet — aldrig ett fel. */
  pack: { pack: string; version: string; text: string } | null;
};

export function buildResearchPrompt(input: OnboardingInput, contract: VerifiedContract): string {
  const v = (s: string) => (s.trim() ? s.trim() : "saknas");
  const packId = contract.pack ? contract.pack.pack : "core-only";
  const packModule = contract.pack ? contract.pack.version : "none";

  return `Du hjälper mig producera en komplett \`research.md\` för en ny Nortropic-kund.

Du arbetar mot ETT kanoniskt kontrakt som återges ORDAGRANT nedan. Kontraktet är
auktoriteten — inte denna inledning, och inte något du minns från tidigare körningar.
Följ det som står i kontraktstexten; avviker min inledning från kontraktet vinner
kontraktet.

**Kontraktsidentitet (får inte ändras av dig):**
- Kontraktsversion: ${contract.version}
- Paket: ${packId} (paketmodul: ${packModule})
- Källa: nortropic-system @ ${contract.sourceCommit.slice(0, 12)}

## INDATA
- Kundnamn: ${v(input.kundnamn)}
- Kundens formulärsvar: ${v(input.formularsvar)}
- Facebook-sida: ${v(input.facebook)}
- Instagram: ${v(input.instagram)}
- Befintlig hemsida: ${v(input.hemsida)}
- Bransch + huvudort: ${v(input.branschOrt)}
- Bokning/kontaktkanaler i dag: ${v(input.kanaler)}

---

# KONTRAKT — UNIVERSELL KÄRNA (ordagrant)

${contract.coreText}

${
  contract.pack
    ? `---

# KONTRAKT — PAKETMODUL \`${contract.pack.pack}\` v${contract.pack.version} (ordagrant)

Modulen SKÄRPER kärnan ovan. Den lättar aldrig ett universellt krav och förskjuter
aldrig kärnans sektionsnumrering.

${contract.pack.text}`
    : `---

# KOMPOSITIONSLÄGE: core-only

Inget paket är BELAGT för den här kunden, så enbart den universella kärnan (sektion
1–17) gäller. Detta är ett GILTIGT läge enligt kontraktet, aldrig ett fel — och en
ANTAGEN bransch aktiverar aldrig en paketmodul. Tror du dig se ett paket: notera det
som hypotes i sektion 15 och fortsätt core-only.`
}

---

# LEVERANS

Skriv \`research.md\` enligt kontraktets sektioner 1–17${contract.pack ? " plus paketmodulens L-sektioner" : ""},
klar att spara. Avsluta ALLTID med kontrollraden (sektion 17) ifylld — inklusive
\`pack=${packId}\`, \`pack_module=${packModule}\` och det faktiska antalet \`osakra\` och
\`konflikter\`. Är något obligatoriskt fält obelagt är raden \`status=OFULLSTÄNDIG\`, och
det skrivs RÖTT överst i filen — aldrig bara i kontrollraden.

Fråga max 2 klargörande frågor innan du börjar om något i indata är motsägelsefullt —
annars kör.`;
}
