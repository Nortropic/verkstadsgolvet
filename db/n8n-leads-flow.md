# n8n-flöde — Leads-insamling & enrichment

Detta är kontraktet mellan appen, n8n och Supabase. n8n gör Places-anropen och **upsertar
leads till Supabase på `place_id`**. Appen räknar `score` (ej n8n). Bygg flödet i din
self-hostade n8n (Railway, EU). Places-nyckeln + Supabase service-key ligger i **n8n:s
credentials** — aldrig i appen.

## Credentials i n8n
- `PLACES_KEY` — Google Places API-nyckel (Places API **New** aktiverat).
- `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` — mot Supabase REST.
- `N8N_WEBHOOK_SECRET` — delad hemlighet som appen skickar (verifieras i nod 1).

## Noder (i ordning)

### 1. Webhook (trigger)
- Metod POST, path t.ex. `/leads-collect`. **Verifiera** att body/headern innehåller rätt
  `N8N_WEBHOOK_SECRET` → annars 401.
- Inkommande body från appen: `{ "bransch": "snickare", "ort": "Luleå", "secret": "..." }`.

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
cappa paginering · logga anropsantal. FB/IG och ägarsvar: manuellt i v1, automatisera bara om
det bevisas vara flaskhalsen.
