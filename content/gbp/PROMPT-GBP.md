# PROMPT — Google Business Profile-uppsättning (Claude i webbläsaren)

*Fristående. Johnny skapar profilen manuellt i Google, klistrar sedan in denna prompt + fyller INDATA-blocket. Claude producerar allt ifyllningsbart enligt 2026 best practices, redo att saxa in fält för fält. Read-only: Claude läser/söker men fyller aldrig i något åt Google, skickar inget. Modulär för dashboard-inbäddning.*

---

Du hjälper mig fylla i en svensk kunds Google Business Profile (GBP) enligt 2026 best practices. Jag har redan skapat själva profilen manuellt; din uppgift är att producera det optimala INNEHÅLLET för varje fält, redo för mig att klistra in. Fabricera aldrig fakta om kunden — allt du inte fått i indata markeras `[KUND MÅSTE FYLLA I]`. Read-only: sök gärna konkurrenter och kategorier, men fyll aldrig i något åt Google och skicka inga förfrågningar.

## INDATA (jag fyller i)
- Företagsnamn (exakt): [ ]
- Bransch + huvudort: [t.ex. "snickeri, Luleå"]
- Adress (om fysisk plats kunder besöker) ELLER serviceområden (om kunden åker ut): [ ]
- Telefon: [ ]
- Webbplats: [ ]
- Tjänster (kundens egna ord, lista): [ ]
- Öppettider: [ ]
- Kort om kunden / röst (1-2 meningar eller klipp ur deras egna texter): [ ]
- Särskilt (ROT? nystartad? kvinnodriven? tillgänglighet? online-bokning? — allt relevant): [ ]

## ARBETSGÅNG

**1. Konkurrentkalibrering (gör först).** Sök 1-2 topprankade företag i samma bransch + ort på Google Maps. Observera (read-only): vilken PRIMÄRKATEGORI de valt, vilka tjänster de listar, vilka attribut de har. Detta kalibrerar dina förslag mot vad som faktiskt rankar lokalt — kopiera inte, men lär av mönstret. Notera kort vad du såg.

**2. PRIMÄRKATEGORI (det viktigaste — lägg störst omsorg här).** Den enskilt största rankingfaktorn i local pack (2026: väger tyngre än recensioner, länkar, närhet). Google har ~4 000 kategorier. Välj den SMALASTE korrekta — "Takläggare" slår "Byggentreprenör", "Möbelsnickare" slår "Snickare". Ge mig: din rekommenderade primärkategori + 1-2 alternativ med motivering, kalibrerat mot vad konkurrenterna valt och vad kunden FAKTISKT gör mest.

**3. SEKUNDÄRKATEGORIER (upp till 9).** Lägg bara till för tjänster kunden GENUINT erbjuder — varje kategori ska mappa mot något en kund kan boka/köpa. Irrelevanta extrakategorier är en vanlig trigger för kvalitetsgranskning/avstängning. Föreslå de relevanta, motivera kort.

**4. BESKRIVNING (max 750 tecken).** Förklara vad kunden gör, vem de hjälper, vad som skiljer dem, var de verkar. Väv in primär-sökordet naturligt 1-2 ggr. UNDVIK floskler ("vi brinner för kvalitet") — varje mening ska säga något en kund kan använda. Skriv i kundens röst (från indata). Producera färdig text, redo att klistra in.

**5. TJÄNSTER (kritiskt — ofta missad).** Google matchar dig mot tjänstefrågor bara om du listar tjänsterna. 2026: Google korsrefererar dessa mot kundens WEBBPLATS tjänste-sektion — håll dem i linje. Producera en strukturerad tjänstelista med korta beskrivningar per tjänst (kundens ord + sökordsvänligt). Flagga om något bör matcha sajten.

**6. ATTRIBUT (väger tyngre 2026, matar AI-sök).** Föreslå relevanta attribut i tre grupper: tillgänglighet (rullstol, parkering, toalett), identitet (kvinnodriven, veterandriven — om tillämpligt), tjänstedetalj (online-bokning, hembesök, offert, wifi). Google matar dessa i AI-svar på frågor som "hantverkare med hembesök nära mig". Lista bara sanna attribut.

**7. ÖVRIGA FÄLT.** Öppettider (inkl. helgdagar — inkonsekvens sänker Googles förtroende), tjänsteområden om kunden åker ut, bokningslänk om extern tjänst finns, produkter om relevant.

**8. FÖRSTA GOOGLE-INLÄGGET.** Producera ett färdigt "välkommen"-inlägg (Google Post) kunden kan publicera direkt vid lansering — kort, konkret, med en handlingsuppmaning.

## OUTPUT-STRUKTUR (saxbar fält för fält)
Ge allt i denna ordning, tydligt rubriksatt så jag kan kopiera ett fält i taget:
1. Konkurrentnoteringar (kort)
2. **Primärkategori** (rekommendation + alternativ)
3. Sekundärkategorier
4. Beskrivning (färdig text)
5. Tjänster (lista med beskrivningar)
6. Attribut (per grupp)
7. Övriga fält (öppettider-format, tjänsteområden, bokningslänk)
8. Första Google-inlägget (färdig text)
9. `[KUND MÅSTE FYLLA I]`-lista (allt som saknades i indata)
10. Påminnelse: verifiering (video) gör kunden själv — se kund-lathunden.

Fråga mig max 2 klargörande frågor om indata är motsägelsefullt — annars kör.
