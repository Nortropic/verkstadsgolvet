# P2 — Inventering av persisterade Places-härledda fält

Acquisition-remedieringens **steg 2** enligt masterplanens Part 12 (parallellbanan
"acquisition remediation"). Steg 1 — containment — är utfört och publicerat (PR #42).

Senast verifierad mot koden: 2026-08-26, `main = 91c4862`.

**Vad "verifierad" betyder här:** varje fältmappning, skrivväg och radantal är läst i
källfilen och citerad med fil och rad. Påståenden om **driftsatta system** — n8n-instansen,
Supabase-innehållet, `sok_config.aktiv` — var vid författandet obevisbara härifrån och
stod i §3 som just det.

**AVLÄST 2026-08-26 (ägaren, mot driftsatta system): §4b bär utfallet.** De tre frågorna
är besvarade och §3a är därmed avgjord snarare än öppen. Kärnan: senaste lead-raden är
från 22 juli, containmenten skedde 24 augusti — **ingenting har skrivits efter stoppet**.

Självständig granskning har prövat varje faktapåstående mot koden i fyra rundor och fällt
**åtta blockerande fel**. Alla är rättade. Fyra namnges i texten, fördelade på tre avsnitt,
därför att felet i sig är upplysande: §1d räknade fel på samma tabell, §3b utelämnade en av
två begärda ägaråtgärder, och §4 besvarade en fråga innan den ställts. Fyra är rättade utan
not, eftersom den korrigerade texten där säger allt en läsare behöver.

**Tre av de åtta infördes av rättelser av tidigare fel:** talet "två" i §1d, påståendet att
alla tre kolumnerna skrevs i samma uppdatering, och påståendet i §1a/§4 att den lagrade
mängden var filtrerad till verksamma företag. Två av dem satt i §1d, det tredje i §1a och
spred sig därifrån till §4.

Mönstret är att varje rättelse grep efter en prydligare mening än koden bar. Det värsta av
de tre var det sista: det påstod en känd egenskap hos driftsatt data i just det avsnitt som
finns till för att säga att driftsatt data inte kan läsas härifrån. Det rättades genom att
strykas, inte formuleras om — en försiktigare version hade varit fjärde varvet av samma
misstag.

Detta noteras därför att en läsare som ska lita på §1d förtjänar att veta att det avsnittet
krävde flest omtag, och att talet "åtta" ovan självt är en uppräkning som kan bli fel igen.

---

## VAD DETTA DOKUMENT ÄR — OCH INTE ÄR

Detta är en **FAKTAINVENTERING AV KODEN**: vilka fält som skrivs varaktigt, varifrån de
kommer, vem som skriver dem och vilka vägar som fortfarande kan skriva.

**Det är INTE en juridisk klassificering.** Steg 3 (klassificera lagring/användning mot
gällande avtal), steg 5 (outreach-policy-matrisen) och steg 6 (GDPR-mekaniken: ändamål,
rättslig grund/LIA, art. 14, minimering, gallring, proveniens, invändningsrätt, global
suppression) är **juridiska bedömningar och är människans ensak i ALLA lägen** — samma
regel som Gate 6 bär i nortropic-system (§A4). Ingen rad nedan ska läsas som ett påstående
om vad som är tillåtet.

Inventeringen finns för att steg 3–6 ska kunna göras mot **verkliga fält**, inte mot minnet
av vilka fält som en gång byggdes.

---

## 1. FÄLTEN — vad som faktiskt persisteras

Tabellen `leads` (`db/leads-schema.sql`) har **38 kolumner**: 14 Places-härledda,
8 inmatade av operatören, 16 systemets egna. Ursprunget är det som betyder något för
steg 3, inte kolumnnamnet.

### 1a. PLACES-HÄRLEDDA — hämtade ur Place Details och skrivna varaktigt

Mappningen står i `db/n8n-leads-flow.json`, i noden vars `name` är **`Extrahera signaler`**
(strängen "Mappa Place Details -> leads-rad" är kommentarens första rad inuti nodens
`jsCode`, inte nodens namn — sök på `Extrahera signaler`). Fälttyperna står i
`lib/leads-types.ts`.

Fältmasken nedan är den som Place Details-noden i flödet skickar som
`X-Goog-FieldMask`. `lib/places.ts` deklarerar samma sträng i `DETAILS_MASK`, men den
modulen har efter containmenten **inga anropare kvar** — auktoriteten för vad som faktiskt
begärs är flödesnoden, inte modulen.

| Kolumn | Places-fält (Details-maskens `X-Goog-FieldMask`) | Karaktär |
|---|---|---|
| `place_id` | `id` | Identifierare |
| `namn` | `displayName.text` | Verksamhetsuppgift |
| `adress` | `formattedAddress` | Verksamhetsuppgift |
| `telefon` | `nationalPhoneNumber` | **Kontaktuppgift** |
| `gbp_url` | `googleMapsUri` | Länk |
| `har_sajt` | härlett ur `websiteUri` | Härlett booleskt |
| `sajt_url` | `websiteUri` | Länk |
| `betyg` | `rating` | Aggregerat omdöme |
| `recensioner_antal` | `userRatingCount` | Aggregerat omdöme |
| `senaste_recension_at` | härlett ur `reviews[].publishTime` | Härlett datum |
| `recensioner_senaste_6man` | härlett ur `reviews[].publishTime` | Härlett antal |
| `gbp_har_foton` | härlett ur `photos.length > 0` | Härlett booleskt |
| `gbp_har_oppettider` | härlett ur `regularOpeningHours` | Härlett booleskt |
| `gbp_har_beskrivning` | härlett ur `editorialSummary.text` | Härlett booleskt |

**14 kolumner.** Fyra av dem (`namn`, `adress`, `telefon`, `sajt_url`) är råa
uppgiftsvärden; resten är antingen identifierare, länkar eller värden härledda ur
Places-svaret.

**Notera skillnaden mellan RÅ och HÄRLEDD.** Ett booleskt `gbp_har_foton` är inte samma
sak som en lagrad bild, och `recensioner_senaste_6man` är inte samma sak som lagrade
recensioner. Om steg 3 kommer fram till att härledda aggregat behandlas annorlunda än
råa fältvärden går den gränsen här. Om den kommer fram till att de behandlas lika spelar
uppdelningen ingen roll. Inventeringen tar inte ställning — den gör skillnaden synlig.

**Vad som INTE persisteras.** Tre fält begärs i masken utan att nå någon kolumn:

- `reviews` — endast `publishTime` läses, för att räkna fram `senaste_recension_at` och
  `recensioner_senaste_6man`. **Ingen recensionstext, författare eller betyg per
  recension** skrivs någonstans.
- `photos` — endast `photos.length > 0` läses. Ingen bild och ingen bildreferens lagras.
- `businessStatus` — begärs i båda fältmaskerna men **läses inte av någon kodnod i det
  versionerade flödet**; de två förekomsterna i flödesfilen är masksträngar, inte logik.
  Flödets enda urval är `!hasSite && reviews >= 1`.
  App-workern läste det däremot före containment:
  `if (d.businessStatus && d.businessStatus !== "OPERATIONAL") continue`
  (`leads-worker.ts:115`). **Notera villkorets form** — en post där fältet saknas faller
  igenom `&&` och behålls. Guarden uteslöt alltså det som var *känt stängt*, inte allt som
  inte var känt öppet. Fältet nådde aldrig en kolumn, via någon av vägarna.

Detta är en verklig begränsning i vad som ligger lagrat, och den är värd att veta innan
steg 3 antar att allt som hämtats också finns kvar.

**Sökstegets mask är bredare än vad som används.** Text Search-noden i det versionerade
flödet begär `formattedAddress`, `nationalPhoneNumber`, `rating`, `userRatingCount`,
`businessStatus` och `googleMapsUri` — trots att `lib/places.ts:15` håller `SEARCH_MASK`
till `id, displayName, websiteUri` med kommentaren "Lägg ALDRIG till rating/reviews här".
Noden `Filtrera kandidater` behåller bara `place_id`, `bransch` och `ort`, så **inget från
sökstegets breda mask persisteras** och fälttabellen ovan påverkas inte. Skillnaden noteras
för att modulens kostnadsdisciplin och flödets faktiska mask inte är samma sak.

### 1b. INMATADE AV OPERATÖREN — inte Places-härledda

Åtta kolumner. `bransch` och `ort` sätts av söktermen (webhook-body), inte av
Places-svaret. `bildmaterial_bedomning`, `social_aktivitet`, `bedomning_anteckning`,
`agare_svarar_pa_recensioner` (n8n skriver alltid `null`; sätts för hand) samt
`fb_url` / `ig_url` (n8n skriver alltid `null`).

### 1c. SYSTEMETS EGNA — beräknade eller processfält

Sexton kolumner: `id`, `skapad_at`, `uppdaterad_at`, `score`, `score_version`, `status`,
`diskvalificerings_skal`, `demo_url`, `demo_byggd_at`, `demo_byggtid_min`,
`sms_text`, `sms_skickat_at`, `svar_at`, `svar_ton`, `svar_text`, `anteckningar`.

`score` är beräknad ur Places-härledda signaler men bär inga fältvärden vidare.

**`sms_text` är den viktigaste raden i hela inventeringen.** `buildSms()` i
`lib/leads-sms.ts:8` interpolerar `lead.namn` — ett Places-härlett fält — i löptext, och
kolumnen persisteras. **Den är systemets egen till sitt ursprung men bär Places-härlett
innehåll**, och detta syns inte i kolumnnamnet, inte i schemat och inte i typen. Det är
alltså **en andra lagringsplats för verksamhetsnamnet**, i ostrukturerad form. Vägen dit
är aktiv och beskrivs i §2. Om steg 3 skiljer på strukturerade fält och fritext går den
gränsen här.

**Tre kolumner är döda.** `score`, `score_version` och `demo_byggd_at` fylls av ingen
skrivväg alls: de saknas i `PATCHBARA` och i n8n-mappningen **och saknar både default och
trigger i schemat** (`db/leads-schema.sql:75–76, 82`). Alla tre villkoren behövs — utan det
sista skulle regeln felaktigt döma ut `id`, `skapad_at`, `status` och de fält som fylls av
kolumndefault eller av `leads_set_uppdaterad_at`. `lib/leads-data.ts:112` säger dessutom
uttryckligen att score är "live, ej persisterad". De hör hemma i schemapartitionen ovan
men innehåller inga data.

### 1d. ÖVRIGA TABELLER — och tre kolumner som ÄR Places-härledda

`sok_config`, `sok_dagslogg`, `score_versioner` och `score_vikter` bär takt, budget,
anropsräknare och scoring-konfiguration. Ingen av dem innehåller Places-data.

**`sok_kombinationer` är ett undantag som inte får glidas förbi.** Tre av dess kolumner är
Places-härledda enligt exakt samma regel som §1a tillämpar:

| Kolumn | Ursprung | Klass |
|---|---|---|
| `placer_hittade` | antal Places-träffar i sökningen | Härlett antal |
| `kandidater` | antal utan sajt som gick vidare till Details | Härlett antal |
| `fel_text` | **råa svarsbytes från ett misslyckat Places-anrop** | Ordagrann text |

De två första är samma härledningsklass som `recensioner_senaste_6man` och
`gbp_har_foton`, vilka §1a placerar i Places-hinken.

**`fel_text` är av en annan och strängare sort.** Överallt annars i schemat lagras
utvunna eller härledda värden; här lagras **ordagranna bytes ur Googles HTTP-svar**:

```
lib/places.ts:46   throw new Error(`Text Search ${res.status}: ${(await res.text()).slice(0, 200)}`)
lib/places.ts:80   throw new Error(`Place Details ${res.status}: ${(await res.text()).slice(0, 200)}`)
(app-workern, före containment)   .update({ status: "fel", …, fel_text: …message.slice(0, 300) })
```

Upp till 200 tecken av ett rått Places-svar kan alltså ligga varaktigt i en omodellerad,
otypad textkolumn. Sagt rakt: det sker **bara på felvägen**, kroppen i ett icke-2xx-svar
är normalt Googles felkuvert snarare än verksamhetsdata, och skrivaren var app-workern som
nu är stoppad. Men rader med `status='fel'` kan redan bära innehållet, n8n-cronens beteende
är okänt enligt §3a, och vad kolumnen faktiskt innehåller går bara att avgöra genom att
läsa den.

**En tidigare version av detta dokument skrev "inget av detta innehåller Places-data" och
tillämpade därmed motsatt regel i §1d mot §1a**, vilket dolde alla tre kolumnerna för
steg 3. Den första rättelsen fick med två av dem och skrev ut antalet "två" — och
underskattade därmed på nytt, i just det avsnitt som fanns till för att den här tabellen
räknats fel en gång. Vad kolumnerna betyder rättsligt är steg 3:s bedömning, inte
inventeringens.

Alla tre sattes av app-workern (numera stoppad), men **i ömsesidigt uteslutande grenar av
samma try/catch**: räknarna på framgångsvägen (`status='klar'`), `fel_text` på felvägen
(`status='fel'`). En kombination kan alltså inte bära bådadera från samma körning. Det är
den ömsesidigheten som motiverar `status = 'fel'`-ledet i §4:s fråga — och just därför att
den bara gäller per körning behöver den frågan sitt andra led.

`db/leads-sweep-schema.sql:5–7` beskriver n8n-cronen som den som markerar kombon `klar`
och ökar dagsloggen; **den säger ingenting om vem som fyller räknarna**, så huruvida cronen
också gör det är obekräftat härifrån.

---

## 2. SKRIVVÄGARNA — vilka som kan skapa eller uppdatera raderna

| Väg | Vad den gör | Läge 2026-08-26 |
|---|---|---|
| `lib/leads-worker.ts` → `runWorkerBatch()` | Drev tidigare insamlingen | **STOPPAD, OVILLKORLIGT.** Returnerar `step0a-containment` utan gren och utan miljöberoende |
| n8n-flödet `leads-collect` | Anropar Places och upsertar `leads` på `place_id` | **Repot kan inte avgöra läget** — se §3 |
| `updateLead()` i `lib/leads-data.ts` | Operatörens patchar i detaljvyn | **Aktiv.** Kan inte skriva Places-KOLUMNER — men se `sms_text` nedan |
| `enqueueSweep()` i `lib/leads-sweep.ts` | Lägger kommun×kategori i kön | **Aktiv.** Skriver inga Places-fält — se §3 |
| `updateSweepConfig()` i `lib/leads-sweep.ts` | Sätter `sok_config.aktiv` och dygnsbudget | **Aktiv.** Är svepets paus-spak — se §3 |
| `createScoreVersion()` i `lib/leads-data.ts` | Ny scoring-version + vikter | **Aktiv.** Bär ingen Places-data |

Tabellen är uttömmande för applikationskoden: varje PostgREST-skrivning mot `leads`,
`sok_*` och `score_*` i repot är en av de sex raderna. `sok_dagslogg` har efter
containmenten **ingen skrivare kvar alls** — app-workern var dess enda.

Två skrivare finns utanför applikationskoden och bär ingen Places-data: kolumndefaulterna
i schemat, som fyller bland annat `uppdaterad_at` vid INSERT, samt triggern
`leads_set_uppdaterad_at` (`db/leads-schema.sql:98–107`), som är det enda som underhåller
`uppdaterad_at` vid UPDATE.

Containmenten i `runWorkerBatch()` är fail-closed på rätt sätt: funktionen har ingen gren
och läser ingen miljövariabel, så det finns ingen flagga som kan vända den. Den hävs bara
genom en granskad kodändring. Det är den starkare formen, och den är korrekt vald.
(Modulen läser `N8N_WEBHOOK_SECRET` på rad 19, men bara för `workerSecretOk` — inte i
containment-vägen.)

### Den aktiva vägen som ändå flyttar Places-innehåll

`updateLead()` kan inte skriva en Places-**kolumn** ens om klienten skickar en:
`PATCHBARA` i `lib/leads-data.ts:26` är en vitlista på 16 fält och **ingen av dem är
Places-härledd**. Patchen byggs genom att kopiera **ur** vitlistan
(`for (const key of PATCHBARA) if (key in patch)`), inte genom att filtrera bort förbjudna
nycklar — så ett nytt Places-fält i schemat blir inte patchbart av misstag. Vitlistan är
inte skriven som ett containment-skydd, men den fungerar som ett, och den fungerar åt
rätt håll när schemat växer.

**Men `sms_text` står i vitlistan**, och kedjan dit är live:

```
components/Arbetsvy.tsx:88   buildSms({ namn: lead.namn, … })
components/Arbetsvy.tsx:90   patcha({ sms_text: t })
app/api/leads/[id]/route.ts  PATCH → updateLead()
lib/leads-data.ts:192        .from("leads").update(rent)
```

Ett knapptryck på "Generera SMS" kopierar alltså ett redan lagrat Places-härlett värde
till **en andra persisterad kolumn, som ostrukturerad fritext**. Det gör inget nytt
Places-anrop och skapar ingen ny rad — men det skapar en ny lagringsplats för
verksamhetsnamnet, på en plats där ingen fältinventering hittar det.

**Det är därför raden ovan säger "Places-KOLUMNER" och inte "Places-data".** Skillnaden
är hela poängen: containment på kolumnnivå är intakt, spridning på innehållsnivå är det
inte.

---

## 3. TRE LÄGEN SOM REPOT INTE KAN BEVISA

Detta är inventeringens viktigaste innehåll och det enda som kräver en ägaråtgärd.

**(a) Det driftsatta n8n-flödet är en extern kontrollyta.** `db/n8n-leads-flow.json` är en
mall (`https://REPLACE-PROJECT.supabase.co/...`); den driftsatta instansen är en annan
artefakt som repot varken läser eller styr.

Den versionerade filen är **inte** vidöppen, och det ska sägas rakt: webhook-noden bär
`"authentication": "headerAuth"`, och `db/n8n-leads-flow.md:36–37` beskriver att n8n avvisar
anrop utan rätt `x-webhook-secret` med 401. Filen bär dessutom `"active": false`. Att
trigga flödet kräver alltså **både hemligheten och ett aktivt driftsatt flöde** — inte
enbart URL:en.

Det som ändå inte går att bevisa härifrån är den driftsatta instansens läge: den kan ha
redigerats utanför repot, dess `active`-flagga är inte den versionerade filens flagga, och
hemligheten kan vara spridd. `db/leads-sweep-schema.sql:5–6` säger dessutom uttryckligen
"n8n cron läser kön" — en cron som **inte finns som nod i den versionerade filen** (flödet
har sex noder och ingen schemaläggare). Antingen är den kommentaren inaktuell, eller så
finns cronen bara i den driftsatta instansen. Repot kan inte skilja de fallen åt.

Containment-noteringen i `content/leads/LEADS-TEST-SMS-DEMO.md:14` ber redan ägaren stänga
av n8n-cronen. **Att det är begärt är inte samma sak som att det är gjort.** Åtgärden är
en driftshandling på ett externt system: ägarens.

**(b) Paus-spaken finns i appen men dess läge är okänt.** Samma containment-notering ber om
**två** saker, och den första har det här dokumentet tidigare utelämnat: "Pausa svepet
(`/leads/insamling` → 'Pausa svepet')". Den spaken är live —
`components/SweepPlanner.tsx:179` → `PATCH /api/leads/sweep` → `updateSweepConfig()` →
`sok_config.aktiv`. Kolumnen **defaultar till `true`** (`db/leads-sweep-schema.sql:35`),
och dess nuvarande värde ligger i databasen, inte i repot.

Detta är den billigaste kontrollen i hela banan: en spak som redan finns, i appen, och som
kan läsas av på `/leads/insamling` utan att någon rör vare sig n8n eller SQL.

**(c) Kön fylls fortfarande.** `enqueueSweep()` är oförändrat aktiv och lägger nya
kommun×kategori-kombon med status `ko`. Kön i sig bär ingen Places-data. Men dess
dokumenterade konsument är n8n-cronen i (a). Så länge (a) är obevisad matar en aktiv
enqueue en väg vars läge vi inte känner.

**Ordningen spelar roll.** Att strypa enqueue vore att laga fel ände: konsumenten är
problemet, kön är bara maten. Om n8n är avstängd är (c) ofarlig. Om n8n inte är avstängd
räcker det inte att strypa enqueue, eftersom kön redan innehåller obetade rader. Därför är
(a) och (b) åtgärderna, och (c) en observation som blir irrelevant när de är avgjorda.

**Avläsningsordning, billigast först:** läs (b) i appen på `/leads/insamling`; läs (a) i
n8n-konsolen. Båda är avläsningar, inte ändringar. Vad som ska göras åt lägena är ägarens
beslut.

---

## 4. BEFINTLIG DATA — vad som redan ligger lagrat

**Containmenten raderade ingenting.** Det är verifierat i koden, inte antaget: commitarna
`d1e1ffc`, `056aef2` och `8c80a42` rör enbart `lib/leads-worker.ts` och en markdown-fil —
ingen SQL, ingen datamigrering.

Att containmenten inte raderade något är däremot inte samma sak som att allt ligger kvar.
Vad som faktiskt finns i den driftsatta databasen — inklusive om rader tagits bort för hand
— går inte att avgöra härifrån.

**Vad den däremot inte bevisar är att nyskrivning upphört.** Containmenten stängde
`runWorkerBatch()` — app-vägen. Om det driftsatta n8n-flödet fortfarande upsertar (§3a) har
rader tillkommit efter 2026-08-24. Detta dokument kan inte avgöra vilket, och en tidigare
version av det påstod ändå att "containmenten stoppade nyskrivning". Det var att svara på
frågan innan den ställts.

**Hur många rader och från vilken tid går inte att avgöra ur repot** — det kräver en
läsning mot den driftsatta Supabase-instansen. Den läsningen är en produktionshandling mot
ett externt system med tjänstenyckel och görs inte härifrån.

Frågan nedan ger steg 3–6 sitt underlag och **avgör samtidigt frågan ovan**: om
`senaste` ligger efter 2026-08-24 har något skrivit efter containmenten, och då är §3a
inte bara obevisad utan negativt besvarad.

```sql
select count(*)                                    as rader,
       min(skapad_at)                              as forsta,
       max(skapad_at)                              as senaste,
       count(*) filter (where telefon is not null) as med_telefon,
       count(*) filter (where adress  is not null) as med_adress,
       count(*) filter (where sms_text is not null) as med_sms_text
from leads;
```

`med_sms_text` är med därför att den kolumnen bär verksamhetsnamnet i fritext (§1c) och
alltså är en andra plats där uppgiften ligger lagrad.

**Ingen egenskap som beror på URVALET är känd utan att frågan körs.** (Schemats egna
garantier gäller förstås ändå: `namn` och `place_id` är `not null`, `status` är begränsad
till nio värden, och så vidare. De säger något om varje rads FORM, aldrig om vilka rader
som finns.)

Det kan frestande tyckas att `businessStatus`-guarden i §1a skulle göra mängden filtrerad
till verksamma företag, men det håller inte i någon riktning: guarden fanns bara i
app-workern, n8n-vägen har inget motsvarande urval, guarden släppte igenom poster där
fältet saknades, och `leads` bär ingen kolumn som skiljer skrivarna åt — så vilka rader som
kom från vilken väg går inte att avgöra ur repot.

Och en andra fråga, för `fel_text` enligt §1d — den enda kolumn i schemat som kan bära
ordagranna Places-svarsbytes:

```sql
select count(*)                                     as rader,
       count(*) filter (where fel_text is not null) as med_fel_text
from sok_kombinationer
where status = 'fel' or fel_text is not null;
```

**Villkorets andra led är avsiktligt.** `status='fel'` ensamt skulle räcka så länge ingen
rör raderna för hand: ingen kodväg återställer status, och framgångsgrenen nollar aldrig
`fel_text`. Men en rad som satts tillbaka till `ko` manuellt och körts om till `klar`
behåller sin gamla `fel_text` och vore osynlig för ett rent statusfilter. Dokumentet
vägrar anta manuell orördhet överallt annars, och gör det inte här heller.

Är `med_fel_text` noll är hela frågan avförd. Är den inte det avgör en blick på innehållet
om det rör sig om Googles felkuvert eller om något mer.

---

## 4b. AVLÄSNINGEN ÄR GJORD — 2026-08-26

De tre avläsningarna i §3 och §4 är utförda av ägaren mot driftsatta system. Detta är
mätning, inte uppskattning, och den ersätter varje "går inte att avgöra härifrån" ovan.

| Fråga | Utfall |
|---|---|
| Svepets läge (`sok_config.aktiv`) | **PAUSAT** |
| `leads` — antal rader | **39** |
| `leads` — tidsstämpel | **22 juli 2026** (en enda testkörning) |
| `leads` — med `telefon` | **32** |
| `leads` — med `adress` | **39** |
| `leads` — med `sms_text` | **0** |
| `sok_kombinationer` — rader med `fel_text` | **0** |

### Vad detta avgör

**§3a är avgjord, inte bara obevisad.** Den senaste raden är från 22 juli; containmenten
skedde 24 augusti. **Ingenting har skrivits efter stoppet.** Den driftsatta n8n-instansen
har alltså inte producerat en rad sedan dess — vilket är det starkare beskedet än att den
bara *borde* respektera pausflaggan.

**§3b är avgjord:** svepet är pausat. Kön matas inte vidare.

**§1c:s `sms_text`-oro är tom.** Noll rader bär fritext, så den andra lagringsplatsen för
verksamhetsnamnet existerar inte i praktiken. Vägen dit är fortfarande live (§2) — men
ingen har gått den.

**§1d:s `fel_text` är tom.** Noll rader. Den enda kolumn i hela schemat som kunde bära
ORDAGRANNA Places-svarsbytes bär ingenting. Det var inventeringens strängaste post och den
visade sig oanvänd.

### Vad detta INTE avgör

Mängden är **liten och sluten**: 39 rader från en testkörning, inte ett växande korpus.
Men den är inte tom. **32 rader bär telefonnummer och 39 bär adress** — och för en enskild
firma är telefonnumret en fysisk persons kontaktuppgift. Vad den lagringen kräver är
fortfarande steg 3:s juridiska bedömning, inte inventeringens.

Avläsningen är ett ÖGONBLICK. Skulle något börja skriva igen ändras bilden, och `senaste`
är den kolumn som visar det.

## 5. VAD SOM ÄR KVAR I BANAN

| Steg | Vad | Vem |
|---|---|---|
| 1 | Stoppa icke-följsam kall outreach | **KLART** (PR #42) |
| 2 | Inventera persisterade Places-härledda fält | **DETTA DOKUMENT** |
| 2b | Avläsning mot driftsatta system | **KLART 2026-08-26** — se §4b |
| 3 | Klassificera lagring/användning mot gällande avtal | **ÄGAREN — juridik** |
| 4 | Rebasa durabla verksamhetsfakta till laglig/kanonisk källa (P1, Bolagsverket) | Bygge efter steg 3 |
| 5 | Outreach-policy-matris innan någon ersättningskanal förklaras tillåten | **ÄGAREN — juridik** |
| 6 | GDPR-mekaniken | **ÄGAREN — juridik** |
| 7 | Ersättningsspel i skugga/manuellt först | **ÄGAREN — extern handling** |
| 8 | Skala eller återuppta autonom outreach | **ÄGAREN** |

**Steg 4 är byggbart men beror på steg 3.** Vilka fält som ska rebasas till Bolagsverket
och vilka som ska bli en `place_id`-pekare med färskhämtning vid användning är precis den
fråga steg 3 avgör. Att bygga rebasen innan klassificeringen vore att gissa svaret på den
juridiska frågan och sedan bygga fast gissningen i ett schema.

Ingen ersättningskanal antas laglig bara för att den gamla stoppades.

### Tre avläsningar som inte kräver något beslut — UTFÖRDA 2026-08-26

Steg 3 kan inte börja på ett tomt underlag. Dessa tre är rena avläsningar — de ändrar
ingenting och binder ingenting:

1. **`/leads/insamling`** — visar `sok_config.aktiv`, alltså om svepet är pausat (§3b).
   Billigast av de tre: ingen konsol, ingen SQL.
2. **`leads`-frågan i §4** — radantal, tidsspann och hur många rader som bär `telefon`,
   `adress` respektive `sms_text`. `senaste` avgör dessutom om något skrivit efter
   containmenten.
3. **`sok_kombinationer`-frågan i §4** — om `fel_text` faktiskt bär något.

Alla tre görs mot driftsatta system och ligger därför hos ägaren.
