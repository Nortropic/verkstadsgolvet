# Företags-e-post & ekosystem (Microsoft 365 / Google Workspace)

*Tillägg till Nortropics erbjudande-dokument. Om professionell e-post på kundens domän, och var gränsen går mellan "webbyrå" och "IT-leverantör". Med enkel förklaring att ge kunder.*

---

## VARFÖR DETTA HÖR (DELVIS) TILL NORTROPIC

När du bygger en kunds sajt på `kundens-firma.se` vill kunden nästan alltid också ha
mejl på samma domän: `info@kundens-firma.se` istället för en Gmail. Kunder litar på
en domän-adress långt mer än en gratis-inkorg — det är en trovärdighetssak. Och det
kopplar till domänen du ändå hjälper koppla. Så mejl-på-domän hör ihop med sajt-på-domän.

MEN: Microsoft 365 och Google Workspace är inte bara "mejl" — de är HELA företags-
ekosystem (dokument, kalkyl, kalender, videomöten, molnlagring). Att sätta upp och
SKÖTA dem är att bli kundens IT-LEVERANTÖR, inte deras webbyrå. Det är en annan roll.

## TRE NIVÅER — VÄLJ MEDVETET
1. **Peka ut & guida (RÄTT för Nortropic):** "din sajt ligger på firma.se — för mejl
   rekommenderar vi Google Workspace eller Microsoft 365, här är en enkel guide."
   Du pekar rätt, kunden sätter upp själv. Passar "bygg grunden, ge verktygen".
2. **Avgränsad engångstjänst (möjligt tillägg):** du kopplar domänen, sätter DNS/MX-
   poster för mejlen, skapar första kontona. EN gång, lämna över. Rimligt eftersom du
   ändå rör deras DNS för sajten.
3. **IT-leverantör (FÄLLAN — undvik):** löpande användarhantering, support, säkerhet,
   migreringar, "min Outlook funkar inte"-samtal. Kräver bemanning, annan business.
   Samma fälla som fullservice-byrå, i IT-tappning.

**Nortropics läge:** nivå 1, med nivå 2 som möjligt avgränsat tillägg. Guida och peka
rätt, eventuellt sätt upp en gång, bli ALDRIG kundens IT-avdelning.

## TEKNISK BEST PRACTICE (stödjer att hålla det avgränsat)
Håll sajt och mejl på SEPARATA system. Dedikerad webbhost (Vercel) för sajten,
dedikerad e-posthost (Google/Microsoft) för mejlen. Då tar ett problem i det ena
(trafiktopp på sajten) inte ner det andra. Sajt och mejl ÄR naturligt åtskilda —
din roll (sajt) och mejl-ekosystemet är olika system även tekniskt.

---

## FÖRKLARAT ENKELT (att ge kunden — "som för en nybörjare")

**Vad är Google Workspace / Microsoft 365?**
Tänk dig ett paket med verktyg för att driva företag digitalt: en professionell
mejladress på ditt eget företagsnamn (info@dittforetag.se), plus kalender, ett ställe
att spara filer, och program för att skriva dokument och göra kalkyler. Google
Workspace och Microsoft 365 är de två stora — de gör ungefär samma sak.

**Behöver jag det?**
Om du vill ha en mejladress som slutar på ditt företagsnamn (info@dittforetag.se) i
stället för en gmail.com-adress — ja. Det ser proffsigare ut och kunder litar mer på
det. Det kostar ungefär 60–120 kr per person och månad.

**Vilket ska jag välja?**
- **Google Workspace** — om du gillar Gmail och vill jobba enkelt i webbläsaren.
  Smidigast för de flesta småföretag. Billigaste ingången.
- **Microsoft 365** — om du redan använder Word, Excel och Outlook på datorn och vill
  ha dem i fullversion.
För de flesta hantverkare/tjänsteföretag: **Google Workspace är oftast enklast.**

**Hur kommer jag igång?**
1. Välj Google Workspace eller Microsoft 365.
2. Ange ditt företags domän (den vi kopplat till din sajt).
3. Följ deras steg för att koppla mejlen till domänen (några DNS-inställningar —
   Nortropic kan hjälpa till med den biten en gång).
4. Skapa dina mejladresser (info@, ditt-namn@, osv).
Klart — nu har du proffsig mejl på ditt eget företagsnamn.

---

## VAR DETTA HÖR I ERBJUDANDET
- Nämn det som del av "få kunden professionellt online" (mejl på egen domän hör ihop
  med sajt på egen domän).
- EJ som IT-tjänste-åtagande. Guide + eventuell engångs-DNS-hjälp, inte löpande support.
- Kandidat att lägga i onboarding: "vill du ha proffsig mejl på din domän också?" →
  peka på guide, erbjud engångs-setup.
