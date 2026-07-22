# Leads-metoden — test, demo & SMS (manuell outreach)

*Metoden som Leads-modulen stödjer. Kort, konkret, uppdaterad 2026-07. Systemet SAMLAR och
POÄNGSÄTTER; DU bygger demo och skickar SMS för hand. Ingen automatisk utskickning — någonsin.*

---

## PREMISSEN (styr allt)

Vi letar efter företag som **redan visat att de bryr sig om sin synlighet men inte fått sajten
på plats**. Inte de digitalt frånvarande (kanske ointresserade), inte de som redan har allt.
Signalerna i scoringen är byggda för att hitta "har försökt, saknar sista biten": ingen sajt,
men färska recensioner, ägaren svarar på recensioner, halvfylld GBP-profil.

En **halvfylld** profil = "de har försökt men gett upp" = perfekt läge. En **helt tom** = kanske
ointresserade. En **vilande** (30 recensioner, senaste från 2021) = fel läge, hoppa över.

---

## FLÖDET (från lead till svar)

1. **Insamling.** Kör bransch + ort i `/leads/insamling`. n8n hämtar kandidater från Places
   (ingen sajt + har recensioner) och fyller Supabase. Systemet poängsätter automatiskt.

2. **Kvalificering (mål <2 min/lead).** Öppna detaljvyn. Systemet har redan de billiga
   signalerna; du bedömer de dyra snabbt via direktlänkarna:
   - **Bildmaterial** [Bra] [Tunt] [Saknas] — finns tillräckligt med bra bilder (deras FB/IG,
     Google-foton) för att bygga en snygg demo? Utan bilder blir demon svag → kroken svag.
     Detta är nästan en förutsättning, inte bara poäng.
   - **Ägaren svarar på recensioner** [Ja] [Nej] [Okänd] — öppna Google/GBP och kolla. Starkaste
     enskilda köpsignalen (Places API ger inte detta automatiskt, därför manuellt).
   - **FB/IG-aktivitet** [Aktiv] [Sporadisk] [Död].
   - **Helhet** [Kvalificera] [Diskvalificera + skäl] [Senare]. Skriv en rad om VARFÖR — det
     matar kalibreringen med kvalitativ data.

3. **Bygg demo (för de med score ≥85 först).** Ett snabbt, snyggt förslag på hur deras sajt
   skulle kunna se ut — med deras egna bilder och recensioner. Logga `demo_url` (Vercel preview)
   och `demo_byggtid`. Demon ÄR kroken; utan den finns inget att skicka.

4. **Förbered SMS (systemet genererar, du skickar).** I arbetsvyn genereras en SMS-text ur
   lead-fälten (mall nedan). **Kopiera-knapp — systemet skickar ALDRIG.** Läs igenom, anpassa en
   mening om det behövs, skicka från din telefon. Markera `sms_skickat` manuellt.

5. **Logga svar.** När de svarar: `svar` + ton [positiv | neutral | negativ] + fritext. Flytta
   leaden genom flödet (kontaktad → svar → möte → kund / nej).

6. **Kalibrera (första kvartalet, månadsvis).** Granska poängsatta leads mot FAKTISKA utfall i
   `/leads/kalibrering`. Justera vikterna (ny score_version) efter vad datan visar — inte magkänsla.

---

## SMS-MALLEN (utgångspunkt — anpassa alltid en aning)

> Hej{{ ' ' + kontaktnamn }}! Jag heter Johnny och driver Nortropic. Jag såg att {{namn}} har
> {{fina recensioner}} i {{ort}} men ingen egen hemsida — så jag byggde ett snabbt förslag på hur
> en skulle kunna se ut, med era egna bilder: {{demo_url}}
>
> Ingen kostnad, ingen förpliktelse — bara nyfiken på vad du tycker. Hör av dig om det är
> intressant så visar jag mer. Mvh Johnny, Nortropic

Regler för texten:
- **Kort, personligt, konkret.** Nämn något specifikt (recensionerna, orten) så det inte läser
  som massutskick. Länken till DERAS demo är hela grejen.
- **Ingen press.** "Ingen kostnad, ingen förpliktelse" sänker tröskeln.
- **En avsändare, en mottagare, en gång.** Manuellt skickat, aldrig i bulk.

---

## JURIDIK & KVALITET (därför manuellt)

- **Svensk B2B-gråzon.** Marknadsföring via SMS till enskild firma kan räknas som till privatperson
  (samma person). Håll det till **relevanta, individuellt utvalda** mottagare med tydlig avsändare
  och enkel möjlighet att säga ifrån — inte massutskick. Vid tvekan: hör med de nöjda kunderna
  först / rådfråga.
- **Kvalitet slår volym.** Ett personligt SMS med en färdig demo till rätt företag slår hundra
  generiska. Systemet är byggt för att hitta *rätt* företag, inte många.
- **Read-only mot prospekt.** Vi läser bara offentlig data. Vi skickar aldrig DM, formulär eller
  kontaktförfrågningar automatiskt.

---

## KALIBRERINGEN ÄR POÄNGEN PÅ SIKT

Första scoring-modellen (v1) är **fel** — det är väntat och inbyggt. Efter ~15 utfall ser du i
kalibreringsvyn vilka score-intervall som faktiskt svarar och vilka signaler som korrelerar med
positivt svar. Skruva vikterna (ny version), jämför mot den gamla. Efter ~3 månader har du en
modell som faktiskt predicerar. Samma mät→granska→förbättra-loop som resten av Nortropic.
