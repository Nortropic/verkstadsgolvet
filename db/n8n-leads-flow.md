# n8n-flöde — Leads-insamling & enrichment

Detta är kontraktet mellan appen, n8n och Supabase. n8n gör Places-anropen och **upsertar
leads till Supabase på `place_id`**. Appen räknar `score` (ej n8n). Bygg flödet i din
self-hostade n8n (Railway, EU). Places-nyckeln + Supabase service-key ligger i **n8n:s
credentials** — aldrig i appen.

## Snabbväg: importera `db/n8n-leads-flow.json`
Importera JSON-filen i n8n (Workflows → ⋯ → Import from File). Noderna kommer in färdigkopplade.
**Efter import måste du göra fyra saker** (credentials och projekt-URL följer aldrig med en export):
1. **Skapa credential "Leads webhook secret"** (typ *Header Auth*): Name = `x-webhook-secret`,
   Value = din långa slumpade `N8N_WEBHOOK_SECRET`. Koppla den på **Webhook**-noden. (Appen skickar
   samma värde som headern `x-webhook-secret` — det hindrar vem som helst från att posta skräp.)
2. **Skapa credential "Google Places API key"** (typ *Header Auth*): Name = `X-Goog-Api-Key`,
   Value = din Places-nyckel (Places API **New** aktiverat). Koppla på **Places Text Search** +
   **Place Details**.
3. **Skapa credential "Supabase (Verkstadsgolvet)"** (typ *Supabase API*): host = din
   `SUPABASE_URL`, Service Role Secret = `SUPABASE_SERVICE_KEY`. Koppla på **Upsert till Supabase**.
4. **Byt projekt-URL** i **Upsert till Supabase**: ersätt `https://REPLACE-PROJECT.supabase.co`
   med din riktiga Supabase-URL.

Sätt en **budgetgräns/faktureringslarm i Google Cloud** innan första riktiga körningen — ett
buggigt flöde som loopar Details-anrop kan bli dyrt. Kör flödet **inaktivt/manuellt först** på
en (1) bransch och inspektera rådatan (se sista stycket) innan du sätter det aktivt.

Diagrammet nedan beskriver samma flöde nod för nod (referens om du vill bygga/justera för hand).

## Credentials i n8n
- `PLACES_KEY` — Google Places API-nyckel (Places API **New** aktiverat).
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — mot Supabase REST.
- `N8N_WEBHOOK_SECRET` — delad hemlighet som appen skickar (verifieras i nod 1).

## Noder (i ordning)

### 1. Webhook (trigger)
- Metod POST, path `leads-collect`. **Authentication = Header Auth** (credential ovan) → n8n
  avvisar automatiskt anrop utan rätt `x-webhook-secret`-header (401). Ingen manuell koll behövs.
- Appen (Fas 3) skickar: header `x-webhook-secret: <N8N_WEBHOOK_SECRET>` + body
  `{ "bransch": "snickare", "ort": "Luleå" }`.

### 2. (Kostnadskontroll) Har vi redan sökt bransch+ort nyligen?
- Slå upp i en enkel n8n-datastore / Supabase-tabell om `(bransch, ort)` kördes senaste X dagar.
  Om ja → avbryt (spara anrop). Annars fortsätt och logga körningen + tidsstämpel.

### 3. Places **Text Search (New)**
- `POST https://places.googleapis.com/v1/places:searchText`
- Headers: `X-Goog-Api-Key: {{PLACES_KEY}}`,
  `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.businessStatus,places.googleMapsUri`
- Body: `{ "textQuery": "{{bransch}} {{ort}}", "languageCode": "sv", "regionCode": "SE" }`
- Paginering via `pageToken` — **cappa till 1–2 sidor** (kostnad). Logga antal träffar.

### 4. Grundfilter (kör Details bara på de som passerar → kostnad)
- Behåll place där **`websiteUri` saknas** (ingen sajt) **OCH** `userRatingCount >= 1` (har spår).
- Övriga: släng (eller spara som lågprio utan Details).

### 5. Places **Place Details (New)** — bara på filtrerade
- `GET https://places.googleapis.com/v1/places/{{place_id}}`
- Headers: `X-Goog-Api-Key: {{PLACES_KEY}}`,
  `X-Goog-FieldMask: id,displayName,formattedAddress,nationalPhoneNumber,websiteUri,rating,userRatingCount,businessStatus,googleMapsUri,reviews,regularOpeningHours,photos,editorialSummary`

### 6. Extrahera signaler (Function-nod)
Mappa Details → lead-fält:
| Lead-fält | Källa / regel |
|---|---|
| `namn` | `displayName.text` |
| `adress` | `formattedAddress` |
| `telefon` | `nationalPhoneNumber` |
| `place_id` | `id` |
| `gbp_url` | `googleMapsUri` |
| `har_sajt` | `websiteUri` finns → true (för kandidater alltid false) |
| `sajt_url` | `websiteUri` (om finns) |
| `betyg` | `rating` |
| `recensioner_antal` | `userRatingCount` |
| `senaste_recension_at` | **max** av `reviews[].publishTime` |
| `recensioner_senaste_6man` | antal `reviews[]` med `publishTime` inom 6 mån **(OBS: API ger oftast bara ~5 senaste recensionerna → detta är en approximation; notera det)** |
| `gbp_har_foton` | `photos[]` icke-tom |
| `gbp_har_oppettider` | `regularOpeningHours` finns |
| `gbp_har_beskrivning` | `editorialSummary.text` finns **(proxy — detta är Googles editorial, inte ägarens egen beskrivning; approximation)** |
| `fb_url`, `ig_url` | **`null` i v1** (bedöms manuellt via direktlänk i detaljvyn) |
| `agare_svarar_pa_recensioner` | **`null` (okänd) — Places API exponerar INTE ägarsvar på recensioner. Bedöms manuellt i detaljvyn.** Fabricera aldrig. |
| `bransch`, `ort` | ekas från inkommande sökning |

### 7. Upsert till Supabase (dedup på place_id)
- **Supabase-nod (Upsert)** mot tabell `leads`, konfliktkolumn `place_id`. Eller rå REST:
  `POST {{SUPABASE_URL}}/rest/v1/leads`
  Headers: `apikey: {{SUPABASE_SERVICE_KEY}}`, `Authorization: Bearer {{SUPABASE_SERVICE_KEY}}`,
  `Content-Type: application/json`, `Prefer: resolution=merge-duplicates`
  Query: `?on_conflict=place_id`
- Sätt `status = 'kandidat'`. Lämna `bildmaterial_bedomning`/`social_aktivitet` = `ej_bedomd`
  (default), `agare_svarar_pa_recensioner`/`fb_url`/`ig_url` = `null`, `score` = `null`.

### 8. (Valfritt) Poängsätt direkt
- `POST {{APP_URL}}/api/leads/score` (med app-hemlighet) så appen räknar score på de nya
  kandidaterna. Annars poängsätter appen dem när listan laddas / via "poängsätt"-knapp.

## Sammanfattning av kostnadsstrategi
Text Search på alla · Details bara på (ingen sajt + har recensioner) · cacha bransch+ort ·
cappa paginering · logga anropsantal · **budgetlarm i Google Cloud satt innan skarp körning**.
Fältmasken styr pris-tiern — de dyra fälten (`reviews`, `photos`) begärs bara i Details, aldrig
i Text Search. FB/IG och ägarsvar: manuellt i v1, automatisera bara om det bevisas vara flaskhalsen.

## Verifiera rådatan FÖRST (innan Fas 3 byggs vidare)
Kör flödet manuellt på **en bransch i Luleå** och titta på outputen från **Extrahera signaler**
innan appens vyer byggs. Kontrollera särskilt att antagandena i specen håller:
- **`senaste_recension_at`** — får vi ett datum? (färskhet är en av de starkaste signalerna)
- **`recensioner_senaste_6man`** — rimligt, givet att API:t ofta bara ger ~5 recensioner?
- **`gbp_har_beskrivning`** — sätts den av `editorialSummary`, eller är den nästan alltid tom?
- **`agare_svarar_pa_recensioner`** — bekräftat `null` (Places ger inte detta → manuellt i detaljvyn).

Om färskhet/beskrivning inte ser ut som specen antar vill vi veta det NU och justera scoringen
(vikterna är ju config) innan vi bygger vidare.
