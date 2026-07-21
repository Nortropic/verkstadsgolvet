/**
 * Research-prompten (PROMPT-RESEARCH.md v2) som onboarding-flödet automatiserar.
 * buildResearchPrompt() fyller INDATA-blocket med formulärvärdena; resten är verbatim.
 *
 * OBS: att DEFINIERA denna sträng gör INGET Claude-anrop. Det första riktiga anropet
 * sker först i Fas B, bakom ONBOARDING_ENABLED och efter Johnnys go-ahead (invariant 6).
 * Read-only-regeln (skicka aldrig formulär/DM/kontaktförfrågningar) är inbyggd i texten.
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

export function buildResearchPrompt(input: OnboardingInput): string {
  const v = (s: string) => (s.trim() ? s.trim() : "saknas");

  return `Du hjälper mig producera en komplett \`research.md\` för en ny Nortropic-kund — en svensk egenföretagare eller ett lokalt småföretag (snickare, hunddagis, blomsterhandel, frisör, elektriker...) som ska få en sajt. Filen matas in i min byggpipeline där en planner syntetiserar strategi och kalibreringsprofil ur den — **din uppgift är fakta med belägg, inte slutsatser**: fabricera aldrig; allt du inte kan belägga markeras \`[OSÄKER]\`, och varje faktapåstående får en källnot i parentes (formulär / FB / IG / sajt / sökning) så jag kan verifiera. Read-only överallt: skicka aldrig formulär, DM eller kontaktförfrågningar.

## INDATA
- Kundnamn: ${v(input.kundnamn)}
- Kundens formulärsvar: ${v(input.formularsvar)}
- Facebook-sida: ${v(input.facebook)}
- Instagram: ${v(input.instagram)}
- Befintlig hemsida: ${v(input.hemsida)}
- Bransch + huvudort: ${v(input.branschOrt)}
- Bokning/kontaktkanaler i dag: ${v(input.kanaler)}

## ARBETSGÅNG

**1. Formuläret.** Extrahera och strukturera allt kunden uppgett. Det kunden själv sagt är facit — motsäger andra källor det, notera konflikten i stället för att välja.

**2. Primärhandlingen (matar profilens arketyp).** Hur konverterar kunder FAKTISKT i dag, med belägg: ringer de (nummer synligt var?), bokar de (vilket system?), DM:ar de (svarsmönster?), eller kommer de till en fysisk plats? Vad *önskar* kunden som primär handling enligt formuläret? En rads slutsats: trolig primärhandling = ring nu | boka tid | platsförfrågan | offert | besök — med källa per observation. Gissa inte; två motstridiga signaler = notera båda.

**3. Facebook-sidan.** Exakt företagsnamn, NAP (adress/telefon), öppettider, omdömen (betyg + EXAKT antal + plattform), org-info i Om-sektionen, inläggsfrekvens och tonalitet, inlägg som visar utförda jobb, samt vilka kontaktvägar sidan faktiskt erbjuder.

**4. Instagram — bildinventeringen (viktigast).** Avgör sajtens premium-tak: antal inlägg; uppskattat antal ANVÄNDBARA foton (skarpa, dagsljus, visar arbete/resultat); motivtyper; finns liggande bilder som klarar hero? highlights? bio-rösten? **Finns ett bra ansiktsporträtt av ägaren?** Avsluta med bedömning: "räcker materialet för foto-först-design, eller behövs ny fotografering?" — och flagga alltid rättighetsfrågan.

**5. Befintlig sajt (om finns).** Vad ska bevaras (URL:er med SEO-värde, texter kunden gillar), vad är problemen, vilken plattform.

**6. Kvitton-inventeringen (ELLER nystartad-läget).** Kartlägg förtroendekvitton med belägg: F-skatt, certifikat med namn, utbildningar med skola+datum, försäkring, garanti, omdömen, portfolio, fysisk plats, år i branschen. **Om nystartad och kvitton saknas:** växla till person-först — ägarens bakgrund/utbildning (med datum), startår, ansiktsporträtt, rimliga löften från dag ett. Markera tydligt: **"NYSTARTAD — kvitton saknas, person-först gäller."** Kudda aldrig med lånade meriter.

**7. Juridik- och scope-spaning (rå observation).** Rapportera med citat/källa om något förekommer: hälsa/kropp/medicin · livsmedel · finans/försäkring · barn som primär målgrupp · alkohol/tobak · **vill kunden sälja online** (e-handel) · **vill kunden ha bokning/inloggning/medlemsdata** (notera om extern bokningstjänst redan används). Bara observationer — inga bedömningar.

**8. Konkurrentkoll.** 2–3 lokala konkurrenter i branschen + orten. Per konkurrent: URL, en mening om styrka/svaghet, synliga betyg. Ingen djupanalys.

**9. Designreferensjakt.** Omdömesjakten först (Reco/Google Maps → företag med betyg ≥4,7 → deras sajter → footer-jakt). Komplettera: SiteInspire, Land-book, One Page Love, Httpster, Mobbin. Varning: Awwwards/Godly/FWA endast filtrerat. Recept: 3 × verkliga branschsajter · 1–2 × SiteInspire/Land-book · max 2 × Dribbble-koncept (märk "koncept"). Per referens: URL + 2–3 meningars motivering kopplad till DENNA kunds material och röst.

**10. Skriv \`research.md\`** i denna struktur, klar att spara:
   - Företag & kontakt (namn, org-form, telefon, NAP, öppettider)
   - Tjänster (kundens egna ord)
   - Orter & läge (belagda arbetsområden; åker vi ut / kunden kommer hit / varumärke — med belägg)
   - **Primärhandling & kanaler** (steg 2)
   - **Kvitton — eller NYSTARTAD-inventering** (steg 6)
   - Priser / ROT-läge (om ROT-relevant)
   - Bildmaterial (steg 4 + rättighetsläget + ansiktsporträtt)
   - **Bild-URL:er för nedladdning** — lista de användbara bildernas URL:er STRUKTURERAT per sektion (hero-kandidater, galleri/projekt, porträtt, övrigt), en URL per rad med en kort not per bild (motiv + varför den passar). Extrahera exakta URL:er där du kan (särskilt från befintlig sajt via web_fetch). För bilder bakom FB/IG-inloggning eller där exakt URL ej kan extraheras: skriv "kräver original från kund" istället för en gissad URL. Dessa laddas hem vid BYGGET, efter kundens publiceringsgodkännande — aldrig i detta steg.
   - Röst & ton (1–2 exempel ur egna inlägg + 2–3 exempel på branschens eget språk)
   - **Juridik-/scope-observationer** (steg 7, rått med citat)
   - Konkurrenter (steg 8)
   - Designreferenser (steg 9, med motiveringar)
   - **Öppna frågor till kunden** — allt \`[OSÄKER]\` + standardfrågor (omdömen vi får publicera med namn+ort? högupplösta original + godkännande? domänönskemål? bokningskanal? vid nystartad: vilka löften vågar du stå för?)
   - Kontrollrad sist: bekräfta de 5 obligatoriska fälten (namn, telefon, ≥1 tjänst, ≥1 ort, ≥1 USP *eller* markerat nystartad-läge). Saknas något: säg det RÖTT överst i stället för att gissa.

Fråga max 2 klargörande frågor innan du börjar om något i indata är motsägelsefullt — annars kör.`;
}
