# Leads-modul — uppsättning steg för steg (nybörjarguide)

Följ delarna i ordning. Det tar ~45–60 min första gången. Du kan pausa mellan delarna.
Bocka av allt eftersom. Fråga om något ser annorlunda ut än beskrivet — menyer flyttar sig ibland.

**Gyllene regel om hemligheter:** `service_role`-nyckeln och webhook-hemligheten är som
huvudnycklar. Klistra dem BARA i n8n och Railway. Aldrig i chatt, kod, GitHub eller en fil.
Råkar du klistra dem fel — byt/rotera dem direkt.

---

## DEL A — Supabase (databasen)

1. Gå till **supabase.com** → **Sign in** (du kan logga in med GitHub).
2. **New project**:
   - *Name:* `verkstadsgolvet`
   - *Database Password:* klicka **Generate a password** → spara den i din lösenordshanterare
     (du behöver den sällan, men spara). Detta är INTE nyckeln vi använder senare.
   - *Region:* **Central EU (Frankfurt)** (eller närmaste EU).
   - **Create new project** → vänta ~2 minuter tills den är klar.
3. **Kör databas-schemat:**
   - Vänster meny → **SQL Editor** → **New query**.
   - Öppna filen `db/leads-schema.sql` (i GitHub: bläddra till den, klicka **Raw**, markera allt,
     kopiera).
   - Klistra in i SQL-editorn → klicka **Run** (eller Ctrl/Cmd + Enter).
   - Förväntat: **"Success. No rows returned."**
   - Kontroll: vänster meny → **Table Editor**. Du ska se `leads`, `score_versioner`,
     `score_vikter`. Öppna `score_vikter` → **24 rader**. `score_versioner` → **1 rad** (version 1).
4. **Hämta URL + nyckel:**
   - Vänster meny → **Project Settings** (kugghjul) → **API** (eller **Data API / API Keys**).
   - Kopiera **Project URL** (`https://xxxxx.supabase.co`) → spara som `SUPABASE_URL`.
   - Hitta nyckeln märkt **`service_role`** (kan stå "secret" / ligga under "Project API keys").
     Klicka **Reveal**, kopiera → detta är `SUPABASE_SERVICE_KEY`. **Huvudnyckel — hantera varsamt.**
   - (Nyckeln "anon/public" behöver vi INTE nu.)

---

## DEL B — Skapa webhook-hemligheten (behövs på två ställen)

Detta är ett långt slumpat lösenord som skyddar din n8n-webhook.
- Enklast: din lösenordshanterare → **generera lösenord**, längd **40**, spara det.
- Eller i en egen terminal (inte i chatten): `openssl rand -base64 32`.

Spara strängen — den ska in på exakt två ställen med SAMMA värde: n8n (Del C) och Railway (Del E).
Detta är värdet vi kallar `N8N_WEBHOOK_SECRET`.

---

## DEL C — n8n (flödet som hämtar leads)

> **Först:** detta förutsätter att din **n8n redan är igång** (self-hostad på Railway). Om du inte
> har n8n uppe än — hoppa detta och säg till, så sätter vi upp n8n som en egen tjänst först.

1. Öppna din n8n i webbläsaren.
2. **Importera flödet:** **Workflows** → **⋯ / Add workflow**-menyn → **Import from File** → välj
   `db/n8n-leads-flow.json`. Sex noder dyker upp, färdigkopplade.
3. **Skapa tre credentials** (meny **Credentials** → **Add credential**):
   - **"Leads webhook secret"** — typ **Header Auth**. *Name:* `x-webhook-secret`.
     *Value:* din sträng från Del B. Spara.
   - **"Google Places API key"** — typ **Header Auth**. *Name:* `X-Goog-Api-Key`.
     *Value:* din Places-nyckel. Spara.
   - **"Supabase (Verkstadsgolvet)"** — typ **Supabase API**. *Host:* din `SUPABASE_URL`.
     *Service Role Secret:* din `SUPABASE_SERVICE_KEY`. Spara.
4. **Koppla credentials på noderna** (öppna varje nod → fältet *Credential*):
   - **Webhook** → "Leads webhook secret"
   - **Places Text Search** → "Google Places API key"
   - **Place Details** → "Google Places API key"
   - **Upsert till Supabase** → "Supabase (Verkstadsgolvet)"
5. **Byt projekt-URL:** öppna noden **Upsert till Supabase** → fältet *URL* → ersätt
   `https://REPLACE-PROJECT.supabase.co` med din riktiga Supabase-URL (behåll
   `/rest/v1/leads?on_conflict=place_id` på slutet).
6. **Spara** flödet (uppe till höger). Klicka på **Webhook**-noden → kopiera **Production URL** →
   det är `N8N_LEADS_WEBHOOK_URL`.

---

## DEL D — Google Cloud (skydda plånboken)

1. **console.cloud.google.com** → välj projektet där din Places-nyckel finns.
2. **APIs & Services → Library** → sök **"Places API (New)"** → **Enable** (om ej redan aktiv).
3. **Billing → Budgets & alerts → Create budget** → sätt t.ex. **300 kr/mån** med larm vid
   50/90/100 %. Detta stoppar inte anrop automatiskt men mejlar dig direkt om något skenar.

---

## DEL E — Railway (miljövariabler till appen)

1. **railway.app** → projektet **verkstadsgolvet** → tjänsten **verkstadsgolvet** → **Variables**.
2. Lägg till fyra (**New Variable**), server-side (aldrig `NEXT_PUBLIC_`):
   - `SUPABASE_URL` = din Project URL
   - `SUPABASE_SERVICE_KEY` = service_role-nyckeln
   - `N8N_LEADS_WEBHOOK_URL` = webhook-URL:en från n8n (Del C6)
   - `N8N_WEBHOOK_SECRET` = din sträng från Del B (samma värde som i n8n)
3. Railway redeployar automatiskt.

---

## DEL F — Testkör & visa rådatan (innan appens vyer byggs)

Målet: bekräfta att signalerna faktiskt fylls som scoringen antar. Eftersom insamlingsvyn inte är
byggd än matar vi n8n med testdata för hand EN gång:

1. I n8n, i flödet: lägg tillfälligt till en **Manual Trigger**-nod och en **Edit Fields (Set)**-nod
   före **Places Text Search**:
   - I Set-noden: lägg till ett fält, namn `body`, typ **JSON**, värde
     `{"bransch":"snickare","ort":"Luleå"}`.
   - Koppla: Manual Trigger → Edit Fields → Places Text Search.
2. Klicka **Execute Workflow** (uppe). Flödet kör hela vägen till Supabase.
3. **Titta på rådatan** — två sätt:
   - I n8n: öppna noden **Extrahera signaler** och läs outputen, ELLER
   - I Supabase: **Table Editor → `leads`** → de nya raderna ligger där.
4. **Skicka mig ett par rader** (kopiera eller skärmdump). Jag kollar särskilt:
   `senaste_recension_at`, `recensioner_senaste_6man`, `gbp_har_beskrivning`, och att
   `agare_svarar_pa_recensioner` är `null` (den kan Places inte ge — bedöms manuellt sen).
5. När vi är nöjda: ta bort de två test-noderna, koppla **Webhook → Places Text Search** igen, spara.

Om test-triggandet känns krångligt — säg till, så bygger jag den lilla insamlings-knappen i appen
först så du får en riktig knapp att trycka på i stället.

---

## När allt är klart
Pinga mig med rådatan (eller "ser rätt ut"). Då bygger jag Fas 2 (scoring) → 3 (insamling) →
4 (kvalificering) → 5 (arbetsvy/SMS) → 6 (kalibrering), och verifierar varje steg mot din data.
