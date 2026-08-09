# Verkstadsgolvet som kontrollrum — UX-/integrationsplan v1

**Detta är en PLAN, inte en implementation.** Ingen produktionskod ändrades i sessionen som skrev
den. Planen beskriver vad som ska byggas, i vilken ordning, och vilket exit-kriterium varje skiva
mäts mot. Den bygger ingenting.

Vid konflikt gäller backendplanen (`Nortropic/nortropic-system`) över denna fil i allt som rör
trust, domar, promotion och eventkontrakt. Denna fil äger endast Verkstadsgolvets sida.

---

## IDENTITET OCH BINDNING

```text
REPO                          = Nortropic/verkstadsgolvet
PLAN_BASE_SHA                 = ae9d250240e47c40eccf72ff045198f8f5f054ea
PLAN_BRANCH                   = plan/nortropic-control-room-v1
PLAN_PATH                     = docs/nortropic-control-room-plan-v1.md
CODEX_HANDOFF_PATH            = docs/nortropic-control-room-codex-handoff.md

NORTROPIC_REPOSITORY          = Nortropic/nortropic-system
NORTROPIC_PLAN_COMMIT         = 0b3212c991d4227c8df2656465ae2c0252dda39e
NORTROPIC_PLAN_PATH           = docs/loop/autonomous-loop-plan-v1.md
NORTROPIC_CODEX_HANDOFF_PATH  = docs/loop/autonomous-loop-codex-handoff.md
```

### BACKEND_PLAN_IDENTITY — MÄTT, INGEN MISMATCH

De bifogade backendplanfilerna är **byte-identiska** med blobarna i den pinnade commiten. Mätt i
denna session med sha256 mot en lokal klon av backendrepot:

```text
docs/loop/autonomous-loop-plan-v1.md     @0b3212c9
  = d0e1fb2ccda3946f18f4f05cb013da14b6c4c6f89901407b0ba1d2bd9ba5e593
  = sha256(bifogad autonomous-loop-plan-v1.md)                        → IDENTISK

docs/loop/autonomous-loop-codex-handoff.md @0b3212c9
  = 5f0342e09281ff9aaec6da12d9753410a7d63aacb76004ad6d54e8a24898e4d4
  = sha256(bifogad autonomous-loop-codex-handoff.md)                  → IDENTISK

BACKEND_PLAN_IDENTITY_MISMATCH = NEJ
```

Att handoffen i sin egen text bär `PLAN_COMMIT_SHA = a84d84e0…` är **inte** en mismatch: `a84d84e0`
är commiten som bar revision 2, och `0b3212c9` är en senare commit på samma gren
(`0b3212c` ← `eff7fcd` ← `9bc1c61` ← `a84d84e0`). Kedjan är mätt med `git log`.

### HISTORISK NOT: REMOTE-INCIDENTEN — RESOLVED

Revision 1 av denna plan rapporterade att backendrepots planeringsgren låg på fel remote, och att
den lokala `nortropic-system`-klonen hade `origin = Nortropic/verkstadsgolvet`.

**Incidenten är åtgärdad av ägaren. Posten står kvar endast som historik.**

```text
REMOTE_INCIDENT_STATUS = RESOLVED (ägarmätt 2026-08-09)

Nortropic/nortropic-system   plan/autonomous-loop-v1        = 0b3212c991d4227c8df2656465ae2c0252dda39e
Nortropic/verkstadsgolvet    plan/autonomous-loop-v1        = ABSENT
Nortropic/verkstadsgolvet    plan/nortropic-control-room-v1 = a301e1c2bcd63b42abcd5047daf552b5d30d6bb4

Båda lokala `origin` är korrigerade till respektive repo.
```

Ägarens mätning är gjord utanför sandboxen och är den auktoritativa källan. Den är dessutom
**lokalt samstämmig** i denna session, mätt utan nätverk mot klonernas cachade referenser:

```text
verkstadsgolvet   origin                                    = Nortropic/verkstadsgolvet.git      ✓
nortropic-system  origin                                    = Nortropic/nortropic-system.git     ✓
verkstadsgolvet   origin/plan/nortropic-control-room-v1     = a301e1c…                           ✓
verkstadsgolvet   origin/plan/autonomous-loop-v1            = finns inte                          ✓
```

Remote-tracking-referenser är en lokal cache från senaste `fetch`, inte live GitHub-sanning —
därför är ägarens mätning fortsatt den auktoritativa. Ingen credential, remote eller
GitHub-inställning har ändrats av någon planeringssession.

Grennamnet `plan/nortropic-control-room-v1` behålls oförändrat.

---

# CURRENT_APP

Mätt mot `PLAN_BASE_SHA`, inte mot minnet.

```text
Next.js 15 App Router · React 19 · TypeScript 5.7 · next-auth 5.0.0-beta.25
@octokit/rest 21 · @supabase/supabase-js 2.45
Deploy: Railway (`next build` → `next start`)
node_modules SAKNAS lokalt · ingen lockfile i repot · ingen .next-build
34 filer i app/ · 22 komponenter · 21 lib-moduler · 15 innehållsdokument · 5 db-filer
```

Arbetskopian var ren vid start: `git rev-list --left-right --count origin/main...HEAD` = `0 0`,
inga untracked filer. `git status` rapporterar `.env.example` som raderad — det är **sandboxen**
som nekar läsning av `**/.env.*`, inte ett verkligt tillstånd. Filen är spårad i git.

## CURRENT_ROUTES

| Route | Typ | DATA_SOURCE | READS | WRITES | AUTH_BOUNDARY | SECRETS | LIVE/STATIC | REUSED_IN_NEW_UX |
|---|---|---|---|---|---|---|---|---|
| `/login` | page | — | — | — | publik (undantagen i `authorized`) | — | STATIC | NEJ |
| `/` | page | ingen | — | — | middleware | — | STATIC_TEMPLATE + PLACEHOLDER | JA (orörd) |
| `/agenter` | page | ingen | — | — | middleware | — | PLACEHOLDER | NEJ |
| `/dokument` | page | GitHub API | repos/tree/file | — | middleware | `GITHUB_TOKEN_READ` | REAL_LIVE_DATA | JA (mönster) |
| `/youtube-research` | page | statiskt `lib/*-docs.ts` | — | — | middleware | — | STATIC_TEMPLATE | NEJ |
| `/leads` | redirect | — | — | — | middleware | — | — | NEJ |
| `/leads/insamling` | page | Supabase | sweep-status | enqueue/config | middleware | `SUPABASE_SERVICE_KEY` | REAL_LIVE_DATA | JA (mönster) |
| `/leads/lista` | page | Supabase | leads+score | PATCH lead | middleware | dito | REAL_LIVE_DATA | JA (mönster) |
| `/leads/arbetsvy` | page | Supabase | leads | PATCH lead | middleware | dito | REAL_LIVE_DATA | NEJ |
| `/leads/kalibrering` | page | Supabase | kalibrering | POST vikter | middleware | dito | REAL_LIVE_DATA | NEJ |
| `/systemhalsa` (+3) | page | ingen | — | — | middleware | — | PLACEHOLDER | NEJ |
| `/systemkarta` | page | ingen | — | — | middleware | — | PLACEHOLDER | NEJ |
| `/onboarding` | page | env-flagga | — | via API | middleware | `ONBOARDING_ENABLED` | REAL (flaggad) | NEJ |
| `/gbp`, `/statistik`, `/marknadsforing`, `/integrationer`, `/framtiden` | page | statiskt `lib/*-docs.ts` | — | — | middleware | — | STATIC_TEMPLATE | NEJ |
| `/api/auth/[...nextauth]` | route | NextAuth | — | session | **undantagen i matcher** | `AUTH_SECRET` m.fl. | LIVE | NEJ |
| `/api/repos`, `/api/tree`, `/api/file` | route GET | GitHub | ja | nej | middleware | `GITHUB_TOKEN_READ` | LIVE | JA (mönster) |
| `/api/onboarding` | route POST | GitHub | — | **skapar repo + pushar** | middleware + `ONBOARDING_ENABLED` | `GITHUB_TOKEN_WRITE` | LIVE (flaggad) | NEJ |
| `/api/leads` | route GET | Supabase | ja | nej | middleware | service key | LIVE | NEJ |
| `/api/leads/[id]` | route GET/PATCH | Supabase | ja | **whitelistade fält** | middleware | service key | LIVE | JA (mönster) |
| `/api/leads/sweep` | route GET/POST/PATCH | Supabase | ja | **kö + config** | middleware | service key | LIVE | JA (mönster) |
| `/api/leads/kalibrering` | route GET/POST | Supabase | ja | **vikter** | middleware | service key | LIVE | NEJ |
| `/api/leads/worker/run` | route POST | Supabase + Places | ja | **leads + kö + dagslogg** | **UNDANTAGEN i matcher**, skyddad av `x-webhook-secret` | `N8N_WEBHOOK_SECRET`, `PLACES_API_KEY` | LIVE | NEJ (mönstret ja) |

## CURRENT_DATA_FLOWS

```text
A. GitHub-läsning (dashboard)
   browser → /api/{repos,tree,file} → lib/github-read.ts → Octokit → GitHub
   · envelope {ok:true,data} | {ok:false,reason,message}, alltid HTTP 200
   · 20 s in-memory cache (lib/cache.ts), 400 kB filtak
   · allowedRepo(): endast WORKFLOW_REPO eller /^kund-[a-z0-9-]+$/

B. GitHub-skrivning (onboarding, flaggad)
   browser → POST /api/onboarding → lib/github-write.ts → skapa PRIVAT kund-<slug> + push research.md
   · gatad av ONBOARDING_ENABLED !== "true" → 403

C. Leads läs/skriv (Supabase)
   browser → /api/leads/** → lib/leads-*.ts → supabase-js (service_role) → Postgres
   · service_role kringgår RLS; RLS är påslagen utan policies → default deny för anon

D. Leads svep-worker (kö + cron)
   n8n cron → POST /api/leads/worker/run (x-webhook-secret) → claim ur sok_kombinationer
   → Places API → upsert leads → markera jobb klart → dagslogg
   · MIDDLEWARE-UNDANTAG: matcher exkluderar api/leads/worker

E. Statiskt innehåll
   lib/*-docs.ts (in-repo TS-konstanter) → CopyBlock. Ingen I/O.
```

## CURRENT_LIVE_DATA_MODEL — klassificering enligt uppdragets §3

| Komponent | Klass | Bevis |
|---|---|---|
| `ProcessGuide` | **STATIC_TEMPLATE** | `STEPS` är en hårdkodad array av 8 steg; kommentaren säger uttryckligen "renderas som mall" |
| `PipelinePanel` | **STATIC_TEMPLATE + FUTURE_LOG_BASED** | `NODES` hårdkodad; UI-texten säger *"live-läge … läses ur **AUTOBYGG-LOG.md** när ett bygge körs"* |
| `MetricsPanel` | **PLACEHOLDER** | fyra nyckeltal, alla `"—"`, kommentar: "Aldrig fejkade tal" |
| `DoctorPanel` | PLACEHOLDER | 12 idle-rutor, "kunde-ej-köras" skiljs från grön |
| `RetroPanel` | PLACEHOLDER | tre tiers, antal `—` |
| `AgentPanel`, `OvertimePanel`, `NattmanPanel`, `SystemMapPanel`, `EffektPanel` | PLACEHOLDER | alla via `Graceful` |
| `DocPanel` | **REAL_LIVE_DATA** | fetch → `/api/{repos,tree,file}` |
| `LeadsList`, `Arbetsvy`, `Kalibrering`, `SweepPlanner` | **REAL_LIVE_DATA** | fetch → `/api/leads/**` → Supabase |

**Målbeslut som denna plan låser:**

> `Maskinen` bygger **aldrig** state genom att regex-parsa terminalprosa eller `AUTOBYGG-LOG.md`.

`AUTOBYGG-LOG.md` förekommer i dag på fyra ställen: `VERKSTADSGOLVET-BYGGSPEC.md` rad 17,
`components/PipelinePanel.tsx` rad 5 och 33, och `reference/nortropic-verkstadsgolvet.html` rad 39.
Ingen av dem rörs av denna plan — `PipelinePanel` lever kvar på `/` som i dag. Maskinen får en
**egen** datakedja och delar ingen kod med `PipelinePanel`.

## CURRENT_SECURITY_BOUNDARIES

```text
AUTH        NextAuth v5, Credentials-provider, EN användare (AUTH_USERNAME/AUTH_PASSWORD ur env),
            JWT-session, ingen databas, inga lösenord i koden.
MIDDLEWARE  auth.config.ts:authorized() → allt utom /login kräver session.
            matcher exkluderar: api/auth · api/leads/worker · _next/static · _next/image
                                · favicon.ico · nortropic-logo.png
SECRETS     Samtliga server-only. NOLL `process.env.NEXT_PUBLIC_*`-referenser i hela repot (mätt).
            Strängen NEXT_PUBLIC_ förekommer endast i kommentar/dokumentation
            (lib/places.ts rad 3, README, BYGGSPEC, db/LEADS-SETUP.md) — aldrig som variabel.
            AUTH_SECRET · AUTH_URL · AUTH_USERNAME · AUTH_PASSWORD
            GITHUB_TOKEN_READ · GITHUB_OWNER · WORKFLOW_REPO
            GITHUB_TOKEN_WRITE · ONBOARDING_ENABLED
            SUPABASE_URL · SUPABASE_SERVICE_KEY · N8N_WEBHOOK_SECRET · PLACES_API_KEY
CSP         ingen. `next.config.ts` sätter endast reactStrictMode.
ROBOTS      metadata robots: { index:false, follow:false }
```

**Två mätta svagheter som denna plan måste förhålla sig till (inte skapade av den):**

1. **API-routes har ingen egen auth-kontroll.** Ingen route-handler anropar `auth()`. Skyddet är
   *enbart* middleware-matchern. En framtida redigering av matcher-regexen öppnar routes tyst.
   Nya Maskinen-routes ska därför bära **egen** `auth()`-kontroll i handlern (djupförsvar), och
   får **aldrig** läggas till i matcher-undantagen.
2. **`GITHUB_TOKEN_WRITE` är bred.** README föreskriver `Administration: Read and write` på
   *All repositories* för att kunna skapa `kund-*`-repon. Den credentialen ligger redan i Railway.
   Maskinen använder den **inte** och får aldrig använda den. Att smalna den är ett separat
   ägarbeslut utanför denna plan — här rapporteras den bara.

## CURRENT_WRITE_SURFACES — designprecedent

Appen är **inte** read-only i dag, trots `VERKSTADSGOLVET-BYGGSPEC.md` invariant 1. Faktiska
skrivytor vid HEAD:

```text
POST   /api/onboarding            → GitHub: skapa privat repo + push (flaggad)
PATCH  /api/leads/[id]            → Supabase: WHITELIST av fält (PATCHBARA i lib/leads-data.ts)
POST   /api/leads/sweep           → Supabase: köa kommun×kategori (unique-constraint = idempotens)
PATCH  /api/leads/sweep           → Supabase: dygnsbudget + aktiv-flagga
POST   /api/leads/kalibrering     → Supabase: scoring-vikter
POST   /api/leads/worker/run      → Supabase: claim → arbeta → markera klar (secret-skyddad)
```

**Precedenten som återanvänds** (formen, inte kön): en kö-tabell med `status`-fält och
unique-constraint för idempotent enqueue; en worker som *claimar*, arbetar och rapporterar; en
whitelist av skrivbara fält; envelopes i stället för kast; graceful "ej konfigurerad"-läge.

**Precedenten som INTE återanvänds:** Leads-kön och Nortropic-controllerkön blandas aldrig. Se
TRANSPORT_PLAN — de ligger i skilda Supabase-projekt, inte bara skilda tabeller.

## ÄGARBESLUT 1 — INVARIANT 1 ÄR ERSATT. LÅST.

`VERKSTADSGOLVET-BYGGSPEC.md` rad 11 lyder i dag:

> **1. LÄS-ONLY. ALLTID.** Appen läser GitHub, skriver ALDRIG. Inga knappar som ändrar systemet,
> inga writes, ingen styrning. Den speglar, den styr aldrig. *(Motverkar scope-creep till
> kontrollrum/OS.)*

Den regeln är **avsiktligt överspelad för Maskinen** genom ägarbeslut. Den var dessutom redan
delvis överspelad i praktiken (onboarding-skriv, fyra Leads-skrivytor).

```text
INVARIANT_1_PREVIOUS        = "LÄS-ONLY. ALLTID. … ingen styrning."
INVARIANT_1_NEW             = VERKSTADSGOLVET_CONTROL_MODEL
                              = READ_OBSERVE_PLUS_NARROW_TYPED_INTENTS
INVARIANT_1_OWNER_DECISION  = LOCKED
CONTROLLER_LOCAL_STATE      = SOLE_AUTHORITY
```

### Den nya bindande principen, ordagrant

Verkstadsgolvet får läsa controller-publicerade projektioner och skicka **endast** de fem
versionsbundna och typade operator-intentionerna:

```text
intake.submit
run.start
run.pause_at_safe_boundary
run.resume
inspect
```

Verkstadsgolvet får **ALDRIG** direkt:

```text
- mutera controller-authoritative state
- exekvera shell
- exekvera generisk Git
- skriva eller flytta Git refs
- verifiera kandidater
- skriva verdict
- skriva attestation
- promovera main
- manipulera lease
- manipulera breaker
- redigera godtyckliga filer
```

Ett command är **endast en intention**. Controllern validerar intentionen och får alltid avvisa
den. Ingen UI-state ändras optimistiskt före controllerbekräftelse.

### Vad beslutet uttryckligen INTE öppnar

```text
Detta är INTE generell styrning.
Verkstadsgolvet blir INTE Git-exekutor.
Verkstadsgolvet blir INTE shell-exekutor.
Den befintliga GitHub read-token-principen VIDGAS INTE för Maskinen.
GITHUB_TOKEN_WRITE får ALDRIG återanvändas som Maskinens credential.
```

**Skärpning som följer av beslutet:** Maskinen använder **ingen GitHub-credential alls** — inte
heller `GITHUB_TOKEN_READ`. Ingen kodväg under `app/api/loop/**` eller `lib/loop/**` importerar
`lib/github-read.ts` eller `lib/github-write.ts`. Det är ett statiskt mätbart krav (V10).

### Följd för skivordningen

```text
V7-blockeraren ÄGARBESLUT_INVARIANT_1 = BESLUTAD (LOCKED)
V7 är fortfarande BLOCKERAD tills nortropic-system S13 finns OCH är verifierad.
```

Beslutet tar bort styrningsfrågan, inte beroendet. En kommandoyta utan en byggd och verifierad
mottagare i controllern är en kö utan claimer.

---

# BACKEND_DEPENDENCY

Det här är planens viktigaste ärlighet: **nästan ingenting av backendens läs-/kommandoyta finns
i dag.** Mätt ur backendplanens CURRENT_STATE och PROPOSED_SLICES vid `0b3212c9`:

| Backendförmåga | Slice | Status vid `NORTROPIC_PLAN_COMMIT` | Vad Verkstadsgolvet blockeras på |
|---|---|---|---|
| operations/lifecycle-event | **S5** `controller/handelse` | **finns inte, varken spec eller kod** | hela live-läsytan |
| smal read/command-yta | **S13** `controller/lucka` | **finns inte** | transport, kommandoyta, evidence-projektion |
| Markdown-intake / Task IR | **S10** `controller/intag` | **finns inte** | intake-UX, backlog, provenance |
| strukturerad failure-feedback | **S4** `controller/aterkoppling` | **finns inte** | attempts-fliken |
| taskgrind (per-task-dom) | **S1** h-017 | **spec-rad finns, prov och kod saknas** | verifieringsstatus, promotion-eligibility |
| promotion | **S7** `controller/befordran` | **finns inte** | promotion/main-vyer |
| merge-resolution | **S8** `controller/konflikt` | **finns inte** | merge-UX |
| evaluator | **S12** `controller/bedomare` | **finns inte** | evaluatorstatus |
| notis | S6 h-014 | finns inte | — (rör inte UI) |
| lease-heartbeat | S3 | finns inte | liveness-signal |
| återtag | S2 h-015 | finns inte | recovery-vy |

Backendens `MIGRATION_ORDER` sätter **S5 som steg 5** och **S13 som steg 13 av 14**.

**Följd, låst i denna plan:**

```text
MASKINEN_LIVE_BLOCKED_ON        = nortropic-system S5
MASKINEN_COMMANDS_BLOCKED_ON    = nortropic-system S13
MASKINEN_INTAKE_BLOCKED_ON      = nortropic-system S10 (+S13 för submit-verbet)
```

Därför är V1–V3 **fixturbaserade** och kan byggas i dag, medan V4 och framåt kräver att backendens
motsvarande skiva är byggd och grön. En slice i denna plan får aldrig markeras klar mot en
fixtur som inte har den verkliga kanalens form — fixturerna genereras ur schemat i V1, inte ur
handskriven prosa.

## ÄGARBESLUT 2 — B1–B8 ÄR MAPPADE. LÅST.

Följande behövs för att UI:t ska kunna visa det uppdraget kräver. Inget av det **finns byggt** vid
`0b3212c9`. Ägaren har nu låst **vem som äger vad** i backenden. Ingenting av detta får uppfinnas
i frontendplanen, och inget av det får beskrivas som redan implementerat.

| # | Fråga | ÄGARE (backend) | Status |
|---|---|---|---|
| B1 | submission events | **S5 + S10** | LÅST |
| B2 | faktisk liveness | **S3 + S5** | LÅST |
| B3 | seq-scope | **S5** (värdet låst nedan) | LÅST |
| B4 | payload contracts | **S5** | LÅST |
| B5 | `source_ref`-upplösning | **S10 + S13** | LÅST |
| B6 | tokens/kostnad | — | `DEFERRED_NON_BLOCKING` |
| B7 | candidate parent | **S5 + S8** | LÅST |
| B8 | authoritative snapshot | **S13** | LÅST — `BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13` |

### B1 · submission events — `B1_OWNER=S5+S10`

Backendens versionerade eventkontrakt ska reservera en **separat** `submission.*`-familj. Den är
**inte** task lifecycle-state. S10/intake producerar dessa event när intake finns.

`UPLOADED` och `ANALYZING` får fortsatt **aldrig** låtsas vara task-state. UI:ts `submission.*`
-namnrymd (se TASK-LIFECYCLE) avbildas 1:1 mot backendens familj när den finns; tills dess är den
rent UI-lokal och renderas aldrig i task-kolumnerna.

### B2 · faktisk liveness — `B2_OWNER=S3+S5`

S3 äger den riktiga lease-heartbeaten. När S5 finns exponeras den **observerande** som t.ex.
`run.heartbeat` eller motsvarande låst eventtyp.

```text
Eventet är ENDAST observerbarhet.
Det får ALDRIG bli lease-authority.
Det får ALDRIG användas för att avgöra ownership.
UI får inte visa AUTONOM/live-liveness utan faktisk signal.
```

Bindande för UI:t: `RunStatusBar` härleder **aldrig** lease- eller ownershipstatus ur heartbeaten.
Den visar liveness och ingenting annat. Uteblir signalen visas `○ OKÄNT` med ålder — aldrig
"stoppad", aldrig "kör".

### B3 · seq-scope — LÅST VÄRDE

```text
EVENT_SEQ_SCOPE          = GLOBAL_PER_OPERATIONS_EVENT_STORE
EVENT_SEQ_RESETS_PER_RUN = NO
```

`seq` är strikt monoton **inom den versionerade operations-eventbutiken**. `run_id` grupperar
event men skapar **inte** en ny ordering authority. `ts` används aldrig för ordning. Det gör
reconnect och backfill entydiga.

**Följd som rättades i UI-planen (revision 1 antog per-run seq):**

```text
ORDERING_KEY        = seq          (inte (run_id, seq))
RECONNECT_CURSOR    = högsta seq sett i BUTIKEN   (inte per run)
GAP_DETECTION       = ENDAST på den ofiltrerade butiksströmmen.
                      En run-filtrerad vy har LEGITIMA hopp i seq — andra runs event ligger
                      emellan. Gap-detektion på en filtrerad ström hade gett permanent
                      falsklarm. Run-filtrerade vyer gap-detekterar ALDRIG.
UNIKHET             = seq är unik i butiken; unikhetsindex ligger på seq, inte på (run_id, seq).
```

### B4 · payload contracts — `B4_OWNER=S5`

S5 måste äga ett **versionsbundet canonical payload-kontrakt per `event_type`**. Det generiska
`"payload": {}` i EVENT_SCHEMA_PLAN är **inte tillräckligt som frontendkontrakt**.

```text
Verkstadsgolvet får INTE själv hitta på payloadfält.
Frontendens schema och fixturer ska HÄRLEDAS UR eller EXPLICIT PINNAS TILL backendens
canonical kontrakt och dess identitet (version + innehållsidentitet).
```

Praktiskt i `lib/loop/schema.ts`: filen bär ett `PAYLOAD_CONTRACT_ID` och en
`PAYLOAD_CONTRACT_VERSION` som pekar på backendens kontraktsidentitet. Saknas kontraktet renderas
varje odefinierat fält `—`; det uppfinns aldrig ett fält för att fylla ett kort.

### B5 · `source_ref` — `B5_OWNER=S10+S13`

`source_ref` är en **opak transportreferens** till de exakta källbytes användaren skickat.

Controllern ska:

```text
1. resolva source_ref genom den smala intake-transporten
2. läsa bytes
3. SJÄLV beräkna SHA-256
4. kräva match mot source_sha256
5. skapa den lokala immutabla source snapshot som S10 äger
6. FÖRST DÄREFTER starta planner/intake
```

```text
Railway-/Supabase-hash får ALDRIG ensam bli trust-anchor.
```

**Följd som rättades i UI-planen:** Verkstadsgolvets serverberäknade sha256 är ett **påstående** i
kommandots payload, inte ett förtroendeankare. Controllern räknar om och avvisar vid avvikelse.
Den konkreta transportimplementationen bestäms i **S10/S13** och **uppfinns inte här** — revision
1:s `loop_intake_blobs`-tabell är därför nedgraderad från förslag till ren illustration, se
TRANSPORT_PLAN.

### B6 · tokens/kostnad — `B6_STATUS=DEFERRED_NON_BLOCKING`

Tokens/kostnad är **inte trustkritisk** och ska **inte** skapa en ny backend-slice nu. Tills ett
verkligt backendkontrakt finns:

```text
UI_VALUE = —
```

Ingen uppskattning, ingen härledning, ingen fejkad kostnad. `TaskView` har inget fält för det.
Detta blockerar ingen skiva.

### B7 · candidate parent — `B7_OWNER=S5+S8`

Canonical `candidate.created`-payload ska bära:

```text
candidate_sha
parent_sha
```

eller semantiskt exakt motsvarande låsta fält. För merge-resolution måste **S8 bevisa**:

```text
candidate = D
parent_sha = C
```

```text
UI:t får ALDRIG härleda parentskap från GitHub själv.
D:s gamla B-verdict får ALDRIG återanvändas.
```

### B8 · authoritative snapshot — `B8_OWNER=S13`

**Detta är den viktigaste cross-plan-korrigeringen.** Se eget avsnitt
`BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13` nedan.

```text
B8_OWNER                 = S13
SNAPSHOT_WINS            = YES
EVENT_STREAM_IS_AUTHORITY = NO
```

---

## BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13

**Konflikt som denna revision löser.** Backendplanens S13-kriterium vid `0b3212c9` lyder:

> *"Läsytan svarar ur eventströmmen och kan inte skriva."*

```text
BACKEND_S13_EVENT_FOLD_CONFLICT = JA — löst genom ägarbeslut, ändras i backendens spec-rad
```

Den formuleringen får **INTE** tolkas som att authoritative task-state rekonstrueras genom
**event-fold**. Gör man det blir eventströmmen en andra sanning, och varje läsare — controller,
UI, framtida verktyg — måste implementera samma fold korrekt för att komma till samma dom.

### Vad S13 måste producera när den byggs

En **versionerad, controller-genererad read-model snapshot** ur controller-authoritative lokala
stores. Snapshoten ska bära de authoritative fält UI:t behöver, minst semantiskt:

```text
task lifecycle state
verdict / verification identity
attestation
promotion state
authoritative current main
DONE / completion
breaker / budget där authoritative
snapshot schema / version
event watermark / last included seq
```

### Vad eventströmmen används till parallellt

```text
live activity
transient phase display
event inspector
evidence references
reconnect / backfill
```

### Den absoluta gränsen

Ett event-tail får **aldrig ensamt** göra en task:

```text
DONE
ATTESTED
PROMOTED
MAIN_ADVANCED
```

i UI:t. Motsäger snapshot och tail varandra gäller:

```text
SNAPSHOT_WINS
```

Konflikten får **observeras och loggas** — men får aldrig ändra ett controllerbeslut. En
loggad snapshot/tail-divergens är ett *observerbarhetslarm*, inte en dom.

### Status

```text
BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13 = FORMULERAT, EJ BYGGT vid 0b3212c991d4227c8df2656465ae2c0252dda39e
```

Det är **inte** implementerat och får inte beskrivas som implementerat. V4 och framåt är
blockerade på att det byggs och verifieras i backendrepot.

---

# TARGET_ARCHITECTURE

```text
┌─────────────────────────── FABRIKS-MACEN (AUTHORITY) ────────────────────────────┐
│  nortropic-system controller                                                     │
│    lokalt state = sanning · attest = doneness · taskval = ordning                │
│    S5 eventström (egen butik, append-only, seq-ordnad)                           │
│    S13 controller/lucka: läsprojektion + kommandoklaim                           │
│    S7 promotion-helper (EGEN trust-domän, GitHub App-nyckel i fil 0600)          │
└───────────────┬──────────────────────────────────────────▲──────────────────────┘
      UTGÅENDE  │ publicerar event + snapshots               │ POLL/CLAIM (utgående)
                ▼                                            │
┌──────────────────────────── TRANSPORT (PROJECTION/QUEUE) ────────────────────────┐
│  Control-plane Supabase — EGET projekt, skilt från Leads                         │
│    loop_events      append-only projektion, dedup på event_id                    │
│    loop_snapshots   controller-publicerad read-model per run  ← DISPLAYED TRUTH   │
│    loop_commands    typade intentioner, controllern claimar                      │
│    intake-transport smal yta för källbytes — FORM ÄGD AV S10+S13 (B5)            │
│  ALDRIG controller root of truth. Raderas den ändras ingen dom.                  │
└───────────────▲──────────────────────────────────────────┬──────────────────────┘
   läser (SELECT)│                                          │ skriver (INSERT commands)
                 │                                          ▼
┌────────────────┴────────────── RAILWAY: VERKSTADSGOLVET ─────────────────────────┐
│  READ PLANE                                  NARROW COMMAND PLANE                │
│    /api/loop/snapshot  /api/loop/events        /api/loop/command                 │
│    /api/loop/task/[id] /api/loop/stream (SSE)  fem verb, typad payload           │
│                                                                                  │
│  Browser når ALDRIG Supabase direkt. Ingen nyckel i klienten.                    │
│  Ingen Git. Ingen shell. Ingen attestation. Ingen promotion.                     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Låsta trustbeslut som denna arkitektur ärver oförändrade:**

```text
AUTHORITATIVE_MAIN=origin/main
PROMOTION_MODE=FAST_FORWARD_ONLY
PROMOTION_FORCE_ALLOWED=NO
PROMOTION_REPOSITORY_SCOPE=Nortropic/nortropic-system only
PROMOTION_APP=Nortropic Promoter
BUILDER_CREDENTIAL_ACCESS=NONE
ATTESTATION_WITHOUT_TASK_GATE_PROMOTABLE=NO
MERGE_RESOLUTION_REUSES_OLD_PASS=NO
RESOLVED_CANDIDATE_FULL_REVERIFY=YES
TRUST_CRITICAL_TASK_JUDGED_BY_PRETASK_CONTROL_PLANE=YES
SANDBOX_BYPASS_ALLOWED=NO
```

**Vad Verkstadsgolvet aldrig blir:** Git-exekutor · verifierare · attesterare · promotion-authority
· ref-upplösare · innehavare av promotion-credential.

---

# INFORMATION_ARCHITECTURE

Första versionen **lägger till** Maskinen och designar inte om något annat.

```text
Ny kund            (CTA, oförändrad)
Maskinen      ←── NY, /loop
Översikt           /              (oförändrad — ProcessGuide/PipelinePanel/MetricsPanel står kvar)
Agenter            /agenter
Dokument           /dokument
YouTube research   /youtube-research
Leads ▸            (oförändrad grupp)
Systemhälsa ▸      (oförändrad grupp)
Systemkarta        /systemkarta
Google Business Profile · Cookies/GDPR/statistik · Marknadsföring · Integrationer · Framtiden
```

Placering: `Maskinen` läggs som **första** `nav-item` efter "Ny kund"-CTA:n, före "Översikt".
Motivering: det är kontrollrummets nya tyngdpunkt, och `/` rörs inte. Ingen ny nav-grupp behövs —
backlog, historik och inspector är ytor *inuti* `/loop`, inte egna nav-poster.

**Möjlig framtida konsolidering — uttryckligen UTANFÖR första skivan:** `Agenter`, `Systemhälsa`
och `Systemkarta` överlappar begreppsmässigt med Maskinens evidence-/hälsovyer när backenddata
finns. Att slå ihop dem kräver att deras nuvarande datakällor (Z1-loggar, Graphify) faktiskt
existerar. Ingen sammanslagning planeras i v1. Promotion av Maskinen till startsida (`/`) är ett
separat, senare beslut och ingår inte här.

---

# ROUTE_PLAN

Verifierat mot faktisk App Router-struktur (`app/(app)/…`, ingen `docs/`-route, inga
route-grupper utöver `(app)`).

```text
app/(app)/loop/page.tsx                     Maskinen — tre kolumner + eventström
app/(app)/loop/uppgift/[taskId]/page.tsx    Task inspector (egen route, delbar länk)
app/(app)/loop/mata/page.tsx                Mata maskinen (full sida; modal på /loop öppnar samma UI)
app/(app)/loop/historik/page.tsx            Klart/ut — completed tasks + promotionshistorik

app/api/loop/snapshot/route.ts        GET   read-model-snapshot (en eller flera runs)
app/api/loop/events/route.ts          GET   ?run_id=&after_seq=&limit=  (pull/backfill)
app/api/loop/stream/route.ts          GET   SSE-tail
app/api/loop/task/[taskId]/route.ts   GET   inspector-projektion (attempts, evidence-refs …)
app/api/loop/command/route.ts         POST  de fem verben, typad payload
app/api/loop/intake/route.ts          POST  ta emot .md/inklistrad text → blob + sha256
```

**Bindande routeregler:**

- Ingen av dessa läggs till i `middleware.ts` matcher-undantagen. Undantagslistan förblir exakt:
  `api/auth`, `api/leads/worker`, `_next/static`, `_next/image`, `favicon.ico`,
  `nortropic-logo.png`.
- Varje `/api/loop/**`-handler anropar `auth()` **själv** och returnerar 401 utan session.
- `/` rivs inte. `ProcessGuide`, `PipelinePanel`, `MetricsPanel` står orörda.
- Hela `/loop`-trädet ligger bakom en env-flagga `LOOP_ENABLED` (precedent: `ONBOARDING_ENABLED`).
  Av → nav-posten döljs och routerna svarar 404/403. Det gör V1–V3 deploybara utan att exponera
  en halvfärdig kontrollrumsyta.

---

# TARGET_UX

## Desktop — `/loop`

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ NORTROPIC   ● AUTONOM · senaste event 3 s   main a1b2c3d · bekräftad 14:02   │
├───────────────────┬───────────────────────────┬──────────────────────────────┤
│ BACKLOG / IN      │        MASKINEN           │ KLART / UT                   │
│                   │                           │                              │
│ [+ MATA MASKINEN] │  current task             │ completed tasks              │
│                   │  p-014 · Lägg till …      │  p-013 ✓ main → a1b2c3d      │
│ RÅKÄLLOR      3   │  försök 2 av 3            │  p-012 ✓ main → 9f8e7d6      │
│ ├ backlog-aug.md  │  bas 4c5d6e7              │                              │
│ RAW           1   │  kandidat —               │ EJ PROMOVERADE               │
│ PLANNING      2   │                           │  p-011 · STOPPED (brytare)   │
│ NEEDS_SPEC    1 ⚠ │  ▸ PLAN        ✓          │                              │
│ READY         4   │  ▸ BUILD       ● pågår    │                              │
│ QUEUED        2   │  ▸ VERIFY      —          │                              │
│                   │  ▸ REVIEW      —          │                              │
│                   │  ▸ MERGE       —          │                              │
│                   │  [öppna inspector]        │                              │
├───────────────────┴───────────────────────────┴──────────────────────────────┤
│ LIVE EVENT STREAM        [sv] [raw event_type]   ⏸ pausa autoskroll          │
│ 14:02:11  seq 418  attempt.started       p-014 försök 2                      │
│ 14:01:58  seq 417  workspace.created     p-014                               │
│ 14:01:57  seq 416  feedback.created      p-014 → artefakt #2                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Regler för den här vyn, alla mätbara:**

- `● AUTONOM` visas bara när det finns en faktisk liveness-signal (B2, eller eventålder under
  tröskel). Annars `○ OKÄNT` med ålder. Aldrig en animation utan signal.
- `main <sha>` är **controllerns bekräftade** värde med tidsstämpel. Verkstadsgolvet slår aldrig
  upp `origin/main` själv — det vore en andra sanning och skulle kräva GitHub-scope mot
  `nortropic-system`.
- Fasradens `✓ / ● / — / ✗` kommer ur event, aldrig ur gissning. `—` = inte inträffat.
- Ingen procentsats någonstans. Ingen framstegsstapel för agentarbete.

## Responsiv

Befintliga brytpunkter i `app/globals.css` är 960 px, 720 px och 600 px. Maskinen följer dem:

```text
≥1280 px   tre kolumner + eventström under
960–1279  tre kolumner, smalare; eventströmmen kollapsbar
720–959   TVÅ kolumner: [Maskinen] [Backlog/Klart som flikar]; eventström som utfällbar sektion
<720 px   EN kolumn, i ordningen: statusrad → Maskinen (current task) → flikrad
          (Backlog · Klart · Events) → innehåll. Sidebaren blir redan horisontell scroller
          vid ≤720 px (mätt, globals.css rad 171–182) — Maskinen ärver det utan ändring.
```

Task inspector på mobil: flikarna blir en horisontellt scrollbar flikrad; DIFF-fliken får
`overflow-x: auto` i egen behållare så sidan aldrig scrollar i sidled.

Visuellt språk bevaras oförändrat: `--bg-panel`, `--border`, clay-accenten `--brand: #d97757`,
Fraunces för rubriker, JetBrains Mono för SHA/ID/event. Inventeringen gav inget skäl att ändra det.

---

# TASK-LIFECYCLE OCH STATUSVOKABULÄR

## FYND: uppdragets statuslista matchar inte backendens kontrakt

```text
Backendens kanoniska mängd (målbild §4 och MARKDOWN_INTAKE_PLAN, identiska):
  RAW  PLANNING  NEEDS_SPEC  READY  QUEUED  WORKING  VERIFYING  REVIEWING  MERGING  DONE  STOPPED

Uppdragets lista:
  RAW  PLANNING  VERIFYING_SPEC  NEEDS_SPEC  READY  QUEUED  WORKING  VERIFYING  REVIEWING  MERGING  DONE

Differens:
  VERIFYING_SPEC  finns i uppdraget, INTE i backendkontraktet   → får inte uppfinnas av UI:t
  STOPPED         finns i backendkontraktet, INTE i uppdraget    → MÅSTE finnas i UI:t
```

Uppdragets §5 listar dessutom `UPLOADED` och `ANALYZING` som "backend states". De finns inte i
backendkontraktet heller.

**Låst lösning — två skilda namnrymder:**

```text
TASK_LIFECYCLE (backendens, återges ordagrant, aldrig utökad av UI:t)
  RAW · PLANNING · NEEDS_SPEC · READY · QUEUED · WORKING · VERIFYING · REVIEWING · MERGING
  · DONE · STOPPED

SUBMISSION_LIFECYCLE (UI-lokal, gäller webbläsarens inlämning — ALDRIG en task)
  submission.selected · submission.uploading · submission.stored
  · submission.command_queued · submission.claimed_by_controller · submission.rejected
```

`VERIFYING_SPEC` renderas som en **härledd underetikett** på `PLANNING` — och bara när backendens
S11 (verifier author/challenger) faktiskt emitterar en händelse som visar att verifieringsförberedelse
pågår. Finns ingen sådan händelse visas enbart `PLANNING`. UI:t hittar aldrig på tillståndet.

Om ägaren vill ha `VERIFYING_SPEC` som ett riktigt tillstånd är det en **spec-radsfråga i
backendrepot**, inte ett frontendbeslut. Registrerat under OVERIFIERAT.

## Statuspresentation

| Tillstånd | Svensk etikett | Färgroll | Får se ut som "klart"? |
|---|---|---|---|
| RAW | Rå källa | neutral | nej |
| PLANNING | Planeras | neutral | nej |
| NEEDS_SPEC | Behöver spec | **warning** (inte danger) | nej — legitimt utfall, inte ett UI-fel |
| READY | Redo | neutral | nej |
| QUEUED | I kö | neutral | nej |
| WORKING | Arbetar | accent | nej |
| VERIFYING | Verifieras | accent | nej |
| REVIEWING | Granskas | accent | nej |
| MERGING | Slås ihop | accent | nej |
| DONE | Klar | **success** | ja — men bara ur snapshot, aldrig ur tail |
| STOPPED | Stoppad | **danger** | nej |

`NEEDS_SPEC` får egen förklaringstext i UI:t: *"Nortropic kunde inte göra den här uppgiften
tillräckligt verifierbar. Ingen builder startades."* — och en knapp *"Komplettera källan"* som
öppnar intake med originalkällan förifylld. Det är inte ett fel, det är ett arbetsläge.

---

# READ_MODEL

## Grundregel — SNAPSHOT_WINS

Uppdraget kräver att ingen projektion blir controller authority, och att event-disorder aldrig
visar falskt DONE. Båda löses av samma regel:

```text
DISPLAYED_TRUTH           = controller-publicerad snapshot (loop_snapshots)
LIVE_TAIL                 = event med seq > snapshot.seq_watermark
SNAPSHOT_WINS             = YES
EVENT_STREAM_IS_AUTHORITY = NO
B8_OWNER                  = S13   (BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13)
```

Snapshoten genereras av **controllern ur dess authoritative lokala stores** — den är inte en
fold av eventströmmen, varken hos controllern eller hos UI:t.

- **Auktoritativa fält renderas ENDAST ur snapshot:** task lifecycle-state, attestation, verdict,
  promotion-utfall, `current main`, candidate-identiteter, DONE.
- **Tail får bara flytta en task till transienta fas-etiketter** (`● BUILD pågår`) och lägga rader
  i eventströmmen. En task blir aldrig DONE, ATTESTED eller PROMOTED av ett tail-event.
- Kommer ett tail-event som pekar på ett terminalt utfall visas en neutral markör
  *"väntar på bekräftelse"* tills en snapshot med tillräcklig `seq_watermark` bekräftar det.
- Konflikt mellan tail-fold och snapshot: **snapshot vinner alltid**. Divergensen får
  **observeras och loggas** som ett observerbarhetslarm — men får aldrig ändra ett
  controllerbeslut och aldrig ändra det som visas.

Det gör UI:ts egen fold strukturellt oförmögen att bli en andra sanning, och det gör "falskt DONE
vid disorder" omöjligt utan att UI:t behöver vara smart.

Eventströmmen används parallellt till: **live activity · transient phase display · event
inspector · evidence references · reconnect/backfill** — och till ingenting annat.

Om backenden inte publicerar snapshots (B8/S13) kan live-läget inte tas i drift. Det är
blockerande, inte något UI:t får kompensera för genom att folda själv.

## Typer (skiss — de slutgiltiga låses mot backendens schema i V1)

```ts
type SchemaVersion = `${number}.${number}.${number}`;

type LoopEvent = {
  schema_version: SchemaVersion;
  event_id: string;
  seq: number;                 // GLOBALT monoton i operations-eventbutiken (B3).
                               // run_id grupperar, seq ordnar. ts är ALDRIG ordning.
  ts: string;                  // wall-clock, endast för människan
  run_id: string;
  task_id: string | null;
  attempt_id: string | null;
  event_type: string;          // valideras mot känd mängd; okänd → bevaras rått
  payload: Record<string, unknown>;
  evidence_refs: string[];     // referenser, aldrig innehåll
};

type Verdict = "PASS" | "FAIL" | "NOT_RUN" | "UNKNOWN";

type TaskView = {
  task_id: string;
  title: string | null;
  state: TaskLifecycle;                 // ur snapshot
  source: { source_id: string; sha256: string; locator: string | null } | null;
  attempt: { n: number | null; budget: number | null };
  phase: Phase | null;                  // ur snapshot; tail får flytta den
  builder: { agent: string | null; model: string | null };   // B4 → ofta null
  risk_class: "low" | "normal" | "high" | null;              // S10 → ofta null
  base_sha: string | null;
  candidate_sha: string | null;
  first_seen_ts: string | null;         // för "förfluten tid", display-only
  policy: Verdict;
  verification: Verdict;
  task_gate: { verdict: Verdict; grind_id: string | null; grind_sha256: string | null };
  evaluation: { required: boolean | null; verdict: Verdict; findings: number | null };
  attestation: { exists: boolean; promotion_eligible: boolean | null } | null;
  merge: MergeView | null;
  promotion: { state: PromotionState; from_sha: string | null; to_sha: string | null } | null;
  evidence_refs: string[];
};

type LoopSnapshot = {
  schema_version: SchemaVersion;
  run_id: string;
  seq_watermark: number;
  published_ts: string;
  run: { state: RunState; breaker: BreakerView; budget: BudgetView };
  current_main: { sha: string | null; confirmed_ts: string | null };  // controllerns värde
  current_task: TaskView | null;
  backlog: TaskView[];
  completed: TaskView[];
};
```

**Regel för saknade fält:** varje `null` renderas `—`. Aldrig 0, aldrig "okänd", aldrig en gissning.
`TaskView` har inget fält för procent, tokens eller kostnad — `B6_STATUS=DEFERRED_NON_BLOCKING`
per ägarbeslut. Fälten läggs till först när ett verkligt backendkontrakt finns.

## Vyer som läsplanet ska täcka (uppdragets §11, avbildade)

| Vy | Källa | Blockerad på |
|---|---|---|
| runs | snapshot-index | S5+S13 |
| backlog | `snapshot.backlog` | S10 (+B1) |
| raw sources | `TaskView.source` + intake-blob | S10, B5 |
| compiled tasks | `snapshot.backlog` med `verification_contract` | S10 |
| current task | `snapshot.current_task` | S5 |
| attempts | `/api/loop/task/[id]` | S4 |
| phase | snapshot + tail | S5 |
| events | `loop_events` | S5 |
| candidate identities | `TaskView.base_sha/candidate_sha` | B4 |
| verification | `TaskView.policy/verification/task_gate` | S1 |
| evaluation | `TaskView.evaluation` | S12 |
| breaker / budget | `snapshot.run` | S5 |
| promotion | `TaskView.promotion` | S7 |
| merge resolution | `TaskView.merge` | S8 |
| current main | `snapshot.current_main` | S7 |
| completed tasks | `snapshot.completed` | S5 |
| evidence | `evidence_refs` | S13 |

---

# EVENT_CLIENT

## Krav och lösning

| Krav | Lösning |
|---|---|
| schema versioning | `schema_version` läses per event. Major > stödd → global banner *"Nyare eventschema än detta gränssnitt känner till"*, tail slutar härleda fas, snapshot fortsätter renderas. Aldrig krasch. |
| event identity | `event_id` är dedup-nyckel. Klienten håller ett `Set` per run med tak (t.ex. 5 000 senaste) + `seq`-baserad low-water för äldre. |
| seq-baserad ordering | All ordning på **`seq` ensamt** — globalt monoton i operations-eventbutiken (B3, `EVENT_SEQ_RESETS_PER_RUN=NO`). `run_id` grupperar men är ingen ordering authority. `ts` används **aldrig** till ordning. Ett prov med bakåtgående klocka ska ge oförändrad läsordning. |
| reconnect | SSE med `Last-Event-ID` = högsta sedda `seq` **i butiken**, aldrig per run. Vid återanslutning: `GET /api/loop/events?after_seq=` för backfill, sedan tail. Exponentiell backoff 1 s → 30 s med jitter. |
| dedup | på `event_id`, inte på `seq` (två event kan aldrig dela `event_id`; delar de `seq` är det ett backendfel som ska synas som varning, inte som tyst overwrite). |
| unknown future event | okänd `event_type` renderas som en rad i strömmen med rå typsträng och payload, får **ingen** semantisk tolkning och flyttar **ingen** state. Kraschar aldrig. |
| evidence references | visas som identifierare + kopieringsknapp. Innehåll hämtas endast om läsplanet exponerar det. |
| raw event inspectability | varje rad har ett `{ }`-läge som visar hela eventet som formaterad JSON. Växlingen `[sv] / [raw event_type]` är global. |
| stale/out-of-order | gap i `seq` → markören *"lucka i strömmen (seq 412–417)"* och automatisk backfill. Event med `seq ≤ snapshot.seq_watermark` ignoreras för state men visas i strömmen. |
| **gap-detektion, avgränsad** | Gap-detektion sker **endast på den ofiltrerade butiksströmmen**. En vy filtrerad på `run_id` eller `task_id` har **legitima** hopp i `seq` — andra runs event ligger emellan (B3). En filtrerad vy som gap-detekterar hade larmat konstant. Filtrerade vyer gap-detekterar **aldrig**. |

## Översättningstabell (svenska ↔ rå typ)

UI:t översätter till läsbar svenska men kan alltid visa rå `event_type`. Kartan täcker backendens
familjer och **ingenting mer**:

```text
run.started → "Körning startad"          task.claimed → "Uppgift tagen"
attempt.started → "Försök startat"        workspace.created → "Arbetsyta skapad"
agent.started → "Builder startad"         candidate.created → "Kandidat skapad"
policy.failed → "Policy fällde"           verification.failed → "Verifiering fällde"
feedback.created → "Återkoppling skapad"  evaluation.finding → "Evaluator-fynd"
attestation.created → "Attestation skriven"
promotion.started → "Promotion inledd"    promotion.completed → "Promotion klar"
promotion.failed → "Promotion misslyckades"
merge.conflict → "Mergekonflikt"          merge.resolution.started → "Konfliktlösare arbetar"
merge.resolution.completed → "Konfliktlösning klar"
main.advanced → "main flyttad"            breaker.opened → "Brytare öppnad"
budget.exhausted → "Kvot slut"
```

Saknas en översättning visas rå typ. Det är rätt beteende, inte ett fel.

---

# COMMAND_CLIENT

## De fem verben — ingenting mer

Exakt backendens `COMMAND_SCHEMA_PLAN`:

```ts
type Command =
  | { verb: "intake.submit";              payload: { source_ref: string; source_sha256: string } }
  | { verb: "run.start";                  payload: { config_ref: string } }
  | { verb: "run.pause_at_safe_boundary"; payload: { run_id: string } }
  | { verb: "run.resume";                 payload: { run_id: string } }
  | { verb: "inspect";                    payload: { task_id: string } | { run_id: string } };
```

**Förbjudet, i kod och i datamodell:** generisk shell · generisk Git · force merge · godtycklig
filredigering · direkt attestation-skrivning · direkt promotion. Det finns ingen `command`-tabellrad
som kan bära en sträng som blir ett kommando: `verb` är en enum-kolumn med `CHECK`-villkor, och
`payload` valideras mot verbet både i route-handlern och i controllerns claim.

## Idempotens och replay

Varje kommando bär:

```text
command_id        klientgenererad UUIDv4 — PRIMARY KEY. Samma id två gånger = ett kommando.
dedup_key         verb + naturlig nyckel (t.ex. "run.start:<config_ref>") — UNIQUE bland
                  icke-terminala rader. Stoppar dubbelklick och dubbelflik.
issued_at         serverstämpel (aldrig klientens klocka)
expires_at        issued_at + TTL (förslag 120 s). Utgången rad claimas aldrig.
expected_watermark  seq_watermark UI:t såg när användaren tryckte
status            pending | claimed | applied | rejected | expired
```

**Replayskydd i tre lager:**

1. `command_id` som PK → en insert, inte två.
2. `expires_at` → ett kommando som legat kvar över en nätdelning blir `expired`, inte utfört
   långt senare mot ett annat läge.
3. `expected_watermark` → controllern avvisar ett kommando vars antagande om läget är föråldrat.
   Ett `run.start` som skickas när körningen redan startat blir `rejected` med orsak, inte en
   andra start.

Backenden är dessutom sista instans: **controllern får alltid avvisa.** UI:t visar avvisningen.

## `run.pause_at_safe_boundary`

Backendens definition är bindande: **mellan tasks, aldrig mitt i ett försök.** UI:t skriver det
rakt ut i knappen och i bekräftelsen:

> *"Pausa efter aktuell uppgift"* — Nortropic avslutar den uppgift som pågår och stannar sedan.
> Ingenting avbryts mitt i.

UI:t har ingen egen tolkning av "säker gräns" och ingen knapp som påstår omedelbart stopp.

## Kommandostatus i UI:t

Varje utskickat kommando får en rad i en liten "senaste kommandon"-lista: verb, tidpunkt, status
(`köad` → `hämtad av controllern` → `utförd` / `avvisad: <orsak>` / `utgången`). Ingen optimistisk
UI-uppdatering av task state — kommandot ändrar ingenting förrän controllern har agerat och det
syns i en snapshot.

---

# TRANSPORT_PLAN

## Riktning: utgående-först

```text
Controller (Mac) ──utgående HTTPS──▶ Supabase (events, snapshots)
Controller (Mac) ──utgående HTTPS──▶ Supabase (poll/claim commands)
Verkstadsgolvet  ──SELECT──────────▶ Supabase (events, snapshots)
Verkstadsgolvet  ──INSERT──────────▶ Supabase (commands)
```

Ingen inkommande port öppnas mot fabriks-Macen. Ingen tunnel. Controllern initierar allt.

## Supabase-projekt: SKILT FRÅN LEADS

Kravet *"blanda inte ihop Leads-kön med Nortropic-controller-kön"* uppfylls **fysiskt**, inte med
namngivningsdisciplin:

```text
LEADS            SUPABASE_URL / SUPABASE_SERVICE_KEY            (befintligt projekt, orört)
CONTROL PLANE    LOOP_SUPABASE_URL / LOOP_SUPABASE_KEY          (EGET projekt)
```

Skälet är mekaniskt: Supabases `service_role`-nyckel kringgår RLS **projektbrett**. Delas projektet
kan Verkstadsgolvets Leads-nyckel skriva i eventtabellen, och en bugg i Leads-koden kan röra
kontrollplanet. Skilda projekt gör det omöjligt.

## Behörighetskrav på Verkstadsgolvets kontrollplansnyckel

```text
loop_events        SELECT           (aldrig INSERT/UPDATE/DELETE)
loop_snapshots     SELECT           (aldrig skriv)
loop_commands      SELECT, INSERT   (aldrig UPDATE — status ägs av controllern)
intake-transport   INSERT (+ läsa tillbaka egen referens) — ytans form ägs av S10/S13 (B5),
                   append-only, aldrig UPDATE eller DELETE
```

**Detta får INTE vara en `service_role`-nyckel**, eftersom den kringgår RLS och därmed kan skriva
i eventströmmen. Krävs en dedikerad databasroll med exakt dessa grants. Att det går att göra i
Supabase på ett sätt som fungerar med `@supabase/supabase-js` är **inte mätt i denna session** →
OVERIFIERAT. Går det inte, är rätt svar en tunn läs-/skriv-proxy hos controllern (S13), inte att
ge appen service_role.

## Tabellskiss (plan — ingen migration körs här)

```sql
-- append-only projektion. Controllern skriver. Appen läser.
create table loop_events (
  event_id        text primary key,
  schema_version  text not null,
  run_id          text not null,
  seq             bigint not null,
  ts              timestamptz not null,
  task_id         text,
  attempt_id      text,
  event_type      text not null,
  payload         jsonb not null default '{}'::jsonb,
  evidence_refs   jsonb not null default '[]'::jsonb,
  ingested_at     timestamptz not null default now()
);
create unique index on loop_events (seq);           -- B3: seq är GLOBALT monoton i butiken
create index on loop_events (run_id, seq);          -- endast för run-filtrerade UPPSLAG,
                                                    -- inte en andra ordningsnyckel

-- controllerns publicerade read-model. DISPLAYED TRUTH.
create table loop_snapshots (
  run_id          text primary key,
  schema_version  text not null,
  seq_watermark   bigint not null,
  published_ts    timestamptz not null,
  snapshot        jsonb not null
);

-- typade intentioner. Appen INSERTar. Controllern claimar och uppdaterar.
create table loop_commands (
  command_id          uuid primary key,
  verb                text not null check (verb in
                        ('intake.submit','run.start','run.pause_at_safe_boundary',
                         'run.resume','inspect')),
  payload             jsonb not null,
  dedup_key           text not null,
  issued_by           text not null,
  issued_at           timestamptz not null default now(),
  expires_at          timestamptz not null,
  expected_watermark  bigint,
  status              text not null default 'pending'
                        check (status in ('pending','claimed','applied','rejected','expired')),
  claimed_at          timestamptz,
  result              jsonb
);
create unique index on loop_commands (dedup_key) where status = 'pending';

-- ILLUSTRATION, INTE KONTRAKT. B5_OWNER=S10+S13 — den konkreta intake-transporten
-- bestäms i backendens S10/S13 och uppfinns INTE i frontendplanen. Formen nedan visar
-- bara vad UI-sidan behöver av en sådan transport: en opak referens tillbaka, och
-- bytes som controllern själv kan hämta och hasha om.
-- create table loop_intake_blobs ( blob_id uuid primary key, transit_sha256 text,
--   filename text, bytes bytea not null, size_bytes integer not null, created_at timestamptz );

alter table loop_events       enable row level security;
alter table loop_snapshots    enable row level security;
alter table loop_commands     enable row level security;
-- intake-transportens tabell(er) ägs av S10/S13 och RLS-sätts där, med samma default-deny-mönster
-- inga policies → default deny för anon/authenticated (samma mönster som Leads-schemat)
```

## Realtid: SSE från Railway, inte Supabase Realtime i browsern

Supabase Realtime i webbläsaren skulle kräva en klientnyckel + RLS-policies i klienten. Det bryter
mot "inga nycklar i browsern" och gör RLS till appens säkerhetsgräns. **Beslut:**

```text
browser ──SSE──▶ /api/loop/stream (Next.js, Railway)  ──▶ Supabase (server-side nyckel)
```

Serverrutten pollar Supabase (eller använder Supabase Realtime *server-side*) och multiplexerar ut
som SSE. Fallback vid SSE-fel: klientpoll mot `/api/loop/events?after_seq=` var 5:e sekund, med
tydlig markering i UI:t att läget är poll och inte ström.

## Failure semantics — ingen av dem ändrar en controllerdom

| Fel | Controller | Verkstadsgolvet | UI-läge |
|---|---|---|---|
| Supabase nere | kör vidare oförändrat; buffrar utgående event lokalt | kan varken läsa eller köa | **fail-closed på kommandon**: knappar avaktiveras med orsak. Läsytan visar sista kända snapshot + "transport nere sedan HH:MM". Aldrig tom vy utan förklaring. |
| Railway nere | kör vidare oförändrat | otillgänglig | inget UI. Controllern märker det inte. |
| Nätet nere hos Macen | kör vidare (lokal authority) | ser en frusen ström | "senaste event 14 min gammalt" + `○ OKÄNT`. Aldrig "stoppad" — UI:t vet inte det. |
| duplicate command | claimar en gång (`command_id` PK) | insert nr 2 → konflikt | "kommandot är redan köat" |
| stale command | avvisar på `expected_watermark`/`expires_at` | — | "avvisad: läget hade ändrats" |
| delayed events | oförändrad | gap-detektion + backfill | "lucka i strömmen (seq …)" tills backfill fyllt den |

**Bindande:** ingen av dessa vägar får ändra en PASS/FAIL, en attestation eller en promotion.
Verkstadsgolvet nere = controllern kör exakt som förut. Det är backendens S13-kriterium och den
här planen antar det, den ersätter det inte.

---

# MARKDOWN_INTAKE_UX

## Primär CTA

`[+ MATA MASKINEN]` överst i BACKLOG-kolumnen, och som egen route `/loop/mata`.

## Tre inmatningssätt

```text
1. Dra .md-fil till dropzonen
2. Välj .md-fil (filväljare, accept=".md,text/markdown")
3. Klistra in text (textarea; sparas som en källa med genererat filnamn)
```

## Validering i klienten (endast formell, aldrig semantisk)

```text
FILTYP        filändelse .md eller .markdown, OCH MIME text/markdown|text/plain|tom
              server: innehållet måste vara giltig UTF-8 utan NUL-byte
STORLEK       max 1 MiB per fil, max 20 filer per inlämning  (förslag — låses av ägaren)
FLERA FILER   varje fil blir en EGEN källa med eget sha256. Ingen sammanslagning.
```

**Frontend semantiskt-tolkar aldrig Markdown.** Ingen rubrikparsning, ingen uppgiftsdelning, ingen
uppskattning av antal tasks. Klienten räknar tecken och rader — inget annat.

## Flödet

```text
Originalkälla
   ↓  POST /api/loop/intake   → bytes till den smala intake-transporten (form ägd av S10/S13)
   ↓                            → OPAK source_ref tillbaka
   ↓                            → transit-sha256 beräknas server-side som PÅSTÅENDE
   ↓  POST /api/loop/command  → intake.submit { source_ref, source_sha256 }
   ↓
   ↓  CONTROLLERN (auktoritativ, B5):
   ↓    1. resolvar source_ref  2. läser bytes  3. beräknar SJÄLV SHA-256
   ↓    4. kräver match mot source_sha256  5. skapar S10:s immutabla source snapshot
   ↓    6. FÖRST därefter startar planner/intake
   ↓
Nortropics tolkning        ← kommer ur snapshot, aldrig ur UI:t
   ↓
N tasks · N dependencies · N acceptance criteria
```

**Trust-anchor-regeln (B5, låst):** Verkstadsgolvets sha256 är ett **påstående**, inte ett
förtroendeankare. Controllern räknar om och avvisar vid avvikelse.

```text
Railway-/Supabase-hash får ALDRIG ensam bli trust-anchor.
```

Källans immutabilitet ägs av controllerns lokala snapshot (S10) — inte av transporttabellen.
Muteras transporten upptäcks det av hash-omräkningen, och inlämningen avvisas.

Tills controllern har svarat visas *"Inlämnad — väntar på Nortropics tolkning"*. Inga siffror,
ingen förhandstolkning, ingen spinner som antyder framsteg.

## `source_ref` — ägd av S10+S13, uppfinns inte här

`source_ref` är en **opak transportreferens** till de exakta källbytes användaren skickat. Den
konkreta transportimplementationen bestäms i backendens **S10/S13** och specificeras **inte** av
denna plan. Revision 1:s `loop_intake_blobs`-tabell är nedgraderad till illustration.

Vad UI-sidan behöver av transporten, och ingenting mer:

```text
1. en väg att lämna bytes
2. en OPAK source_ref tillbaka, som kan bäras i intake.submit
3. att controllern kan hämta samma bytes utgående och hasha om dem
```

Intake är blockerad tills S10 + S13 finns — inte fejkad, inte gissad.

## Provenance och inspektion

Varje genererad task visar `källa → sektion → sha256` och en knapp *"Visa originalkällan"* som
öppnar den lagrade blobben oförändrad (renderad Markdown + råläge). Ändras källan aldrig, kan den
alltid jämföras med det controllern faktiskt läste.

## `NEEDS_SPEC`

Ett legitimt slututfall, inte ett fel. UI:t visar det som ett **arbetsläge** i warning-färg med:
orsak från controllern, vilka acceptance criteria som saknades, och *"Komplettera källan"* som
öppnar intake med originalet förifyllt. Ingen röd feldialog. Ingen "försök igen"-knapp som bara
skickar samma sak igen.

## Backend-avslag

Avvisar controllern en inlämning visas dess orsakssträng ordagrant plus rå `command_id` och
`status`. UI:t skriver aldrig om orsaken till något vänligare.

---

# TASK_INSPECTOR

Route: `/loop/uppgift/[taskId]`. Elva flikar, i uppdragets ordning.

| Flik | Innehåll | Källa | Blockerad på |
|---|---|---|---|
| **OVERVIEW** | id, titel, state, källa, försök N av budget, fas, riskklass, base-SHA, kandidat-SHA, förfluten tid | snapshot | S5 |
| **SOURCE** | originalkällan renderad + rå, sha256, sektion, länk till alla tasks ur samma källa | intake-blob + provenance | S10, B5 |
| **PLAN / CONTRACT** | frozen task contract: goal, scope, `allowed_write`/`denied_write`, acceptance criteria, `verification_contract` (grind_id + grind_sha256 — **aldrig grindens kod**) | snapshot | S10, S11 |
| **ATTEMPTS** | en rad per försök: `attempt_id`, start/slut, utfall, **failure stage**, **failure class**, exit code, timeout/signal, och **vilken feedbackartefakt nästa försök fick** | `/api/loop/task/[id]` → S4-artefakt (redigerad) | **S4** |
| **DIFF** | kandidatens diff. Endast om läsplanet exponerar den. Egen `overflow-x:auto`, aldrig sidscroll. | S13 | S13 |
| **VERIFICATION** | tre skilda domar: policy · global verifierare · **taskgrind** (med `grind_id`, `grind_sha256`). Var och en `PASS/FAIL/NOT_RUN`. `NOT_RUN` visas **skilt från grön** (samma regel som DoctorPanel redan bär). | snapshot | **S1** |
| **EVALUATION** | krävdes evaluator? utfall, antal findings, vilka som blev feedback → ny kandidat | snapshot | S12 |
| **ATTESTATION** | vilken kandidat som faktiskt attesterades, `grind_id`, `grind_sha256`, `invalidates_on`, `stale`, och **`promotion_eligible: JA/NEJ` med orsak** | snapshot | S1, S7 |
| **MERGE / PROMOTION** | se MERGE_CONFLICT_UX | snapshot | S7, S8 |
| **EVIDENCE** | evidence-referenser per hård dom, som identifierare + kopieringsknapp. Innehåll endast om läsplanet serverar det. | S13 | S13 |
| **EVENTS** | hela strömmen filtrerad på `task_id`, med rå-läge | `loop_events` | S5 |

## De åtta frågorna inspectorn måste besvara

Uppdragets §7 kräver att inspectorn tydligt visar följande. Var och en har en utpekad yta:

```text
varför ett attempt föll                → ATTEMPTS: failure stage + failure class + exit code
vilken feedback nästa attempt fick     → ATTEMPTS: artefaktreferens per försök, redigerad
vilken base som användes               → OVERVIEW: base_sha (samma för alla försök inom en task)
vilken candidate som verifierades      → VERIFICATION: candidate_sha bunden till varje dom
om merge-resolution skapade ny candidate → MERGE: D med parent(D)=C, egen identitet
vilken candidate som faktiskt attesterades → ATTESTATION: candidate_sha ur attestationen
vilken SHA som blev authoritative main → MERGE/PROMOTION: main.advanced → to_sha
evidence för varje hård dom            → EVIDENCE + inline-referens vid varje verdict
```

**Bindande läckageregel:** inspectorn visar `grind_id` och `grind_sha256` — **aldrig** grindens
innehåll, dess kontrollnamn eller registret. Backendens S4-kriterium mäter att feedbackartefakten
inte bär grindens kod; UI:t får inte återinföra läckan genom en annan väg. Visar läsplanet
någonsin ett fält som innehåller grindtext är det ett **backendfel som ska rapporteras**, inte
något UI:t renderar.

---

# MERGE_CONFLICT_UX

## Grundhållning

En mergekonflikt är ett **agentiskt arbetsläge**, inte ett stopp. Human-attention visas först när
controllern faktiskt har fail-closed stoppat.

## Tillståndsavbildning mot backendens event

| UI-tillstånd | Härleds ur | Färgroll |
|---|---|---|
| `MERGE_CONFLICT` | `merge.conflict` | neutral/info — **inte** danger |
| `RESOLVER_WORKING` | `merge.resolution.started` | accent, "Konfliktlösare arbetar" |
| `RESOLUTION_CANDIDATE_CREATED` | `merge.resolution.completed` + `candidate.created` | neutral |
| `FULL_REVERIFY` | `policy.started` / `verification.started` / `evaluation.started` mot D | accent |
| `ATTESTED` | `attestation.created` för D | neutral (ännu inte klart) |
| `PROMOTING` | `promotion.started` | accent |
| `MAIN_ADVANCED` | `main.advanced` | **success** |
| `STOPPED / KRÄVER MÄNNISKA` | `breaker.opened`, `budget.exhausted`, `promotion.failed` utan fortsättning, eller controllerns egen stoppsignal | **danger** |

## Den låsta semantiken, renderad

```text
  kandidat B (verifierad mot bas A)
      +
  aktuell main C
      ↓  konfliktlösare
  NY kandidat D · parent(D) = C · single-parent, ingen merge-commit
      ↓  FULL OMVERIFIERING FRÅN NOLL
  policy → global verifierare → taskgrind → krävd evaluator
      ↓
  NY attestation för D
      ↓  non-force fast-forward C → D
  main = D
```

**Absolut UI-regel:** B:s gamla PASS får **aldrig** renderas som D:s dom. Mekaniskt löst så här:

- Varje verdict i UI:t bär `candidate_sha`. En verdict renderas **endast** i en vy vars
  kandidat-SHA är identisk. Skiljer de sig visas `NOT_RUN`, inte det gamla värdet.
- När D skapas nollställs D:s domar visuellt (`—`) tills D:s egna verdict-event kommer.
- B:s historik ligger kvar i en hopfälld sektion *"Tidigare kandidat B (ej promoverad)"* med en
  explicit etikett: *"B:s resultat gäller inte D."*

## Vad UI:t aldrig får erbjuda

Ingen "lös konflikten"-knapp. Ingen "merga ändå". Ingen "force". Ingen redigeringsyta för filer.
Konfliktlösning är controllerns arbete; Verkstadsgolvet visar det och kan i värsta fall pausa vid
säker gräns.

---

# REALTIME

```text
TRANSPORT      SSE från /api/loop/stream. Fallback: poll var 5 s mot /api/loop/events.
ORDNING        seq ensamt, globalt monoton i butiken (B3). run_id grupperar men ordnar inte.
               ts används aldrig till ordning.
DEDUP          event_id. Set med tak + seq low-water.
RECONNECT      Last-Event-ID = högsta sedda seq I BUTIKEN → backfill → tail.
               Backoff 1→30 s med jitter.
GAP            saknad seq i den OFILTRERADE butiksströmmen → synlig markör + automatisk backfill.
               Run-/task-filtrerade vyer gap-detekterar ALDRIG (legitima hopp, B3).
STALE          event med seq ≤ snapshot.seq_watermark påverkar ingen state.
OKÄND TYP      renderas rå, flyttar ingen state, kraschar aldrig.
SCHEMA-BUMP    major > stödd → banner, tail slutar härleda, snapshot renderas vidare.
SYNLIGHET      dokumentet dolt (Page Visibility) → strömmen pausas efter 60 s, återupptas med
               backfill vid fokus. Sparar Railway-resurser utan att tappa event.
```

**Ingen animation utan signal.** En "pågår"-indikator kräver ett faktiskt event nyare än tröskeln
eller en liveness-signal (B2). Saknas den visas åldern i klartext.

---

# ERROR_EMPTY_RECONNECT_STATES

Alla lägen återanvänder befintliga `Graceful`- och envelope-mönstren.

| Läge | Vad användaren ser | Vad UI:t INTE gör |
|---|---|---|
| `LOOP_ENABLED=false` | nav-posten dold; direktlänk → "Maskinen är inte aktiverad" | inget halvfärdigt kontrollrum |
| transport ej konfigurerad | "Kontrollplanets transport är inte konfigurerad (LOOP_SUPABASE_URL saknas)" | kraschar inte, visar inga nollor |
| ingen run ännu | "Ingen körning registrerad ännu" + `[Mata maskinen]` | ingen fejkad tom pipeline |
| snapshot finns, ström nere | full snapshot + "Live-strömmen är nere sedan HH:MM — visar senast bekräftade läge" | påstår aldrig realtid |
| snapshot saknas, ström uppe | "Väntar på controllerns första snapshot" — tail visas som ren logg | härleder ingen task state |
| lucka i seq | "Lucka i strömmen (seq 412–417) — hämtar" | hoppar inte tyst över |
| okänt schema | banner + rå ström | tolkar inte |
| kommandot avvisat | orsaken ordagrant + `command_id` | skriver inte om orsaken |
| sessionen utgången | samma mönster som `DocPanel` redan bär: icke-JSON-svar/redirect → "Sessionen gick ut — ladda om sidan" | visar inte tom vy |
| controller tyst > tröskel | `○ OKÄNT` + ålder | säger aldrig "stoppad" |

Grundregeln som redan gäller i repot består: **hellre `—` än fejkad data.**

---

# AUTH_SECURITY

## Bevaras oförändrat

```text
NextAuth v5 · Credentials · JWT · en användare · middleware gatar allt utom /login
matcher-undantagen förblir EXAKT: api/auth · api/leads/worker · _next/static · _next/image
                                  · favicon.ico · nortropic-logo.png
Alla hemligheter server-only. NOLL NEXT_PUBLIC_* (mätt vid HEAD, ska mätas igen per skiva).
```

## Nytt, och skärpning

```text
DJUPFÖRSVAR       varje /api/loop/**-handler anropar auth() själv → 401 utan session.
                  Skyddet får inte hänga på matcher-regexen ensam.
INGA UNDANTAG     /api/loop/** läggs ALDRIG till i middleware-matcherns undantagslista.
NYA VARIABLER     LOOP_ENABLED · LOOP_SUPABASE_URL · LOOP_SUPABASE_KEY
                  (LOOP_SUPABASE_KEY = begränsad DB-roll, INTE service_role — se TRANSPORT_PLAN)
CSRF              kommandorutten kräver same-origin (Origin/Sec-Fetch-Site) utöver session.
                  Endast POST med JSON; ingen form-post-väg.
RATE LIMIT        enkel per-session-räknare på /api/loop/command och /api/loop/intake.
                  Intake dessutom storleks- och antalsbegränsad.
LOGGNING          inga payload-värden, inga evidence-innehåll och inga nycklar i serverloggar.
                  Fel loggas som verb + command_id + felklass.
```

## Vad Maskinen ALDRIG kräver i Railway

```text
GitHub App private key (Nortropic Promoter)     → NEJ
Nortropic Promoter installation token           → NEJ
controller shell credential                     → NEJ
generisk GitHub admin/PAT i browsern            → NEJ
någon credential som kan flytta origin/main      → NEJ
GITHUB_TOKEN_WRITE som Maskinens credential      → NEJ (uttryckligt ägarbeslut)
GITHUB_TOKEN_READ vidgad för Maskinen            → NEJ (read-token-principen vidgas inte)

PROMOTION_CREDENTIAL_IN_RAILWAY = NO
GENERIC_GITHUB_WRITE_TO_UI      = NO
MASKINEN_GITHUB_CREDENTIAL      = NONE
```

**Skärpning enligt ägarbeslut 1:** Maskinen använder **ingen GitHub-credential alls**. Ingen
kodväg under `app/api/loop/**` eller `lib/loop/**` importerar `lib/github-read.ts` eller
`lib/github-write.ts`. Statiskt mätbart krav i V10.

Befintlig `GITHUB_TOKEN_WRITE` (onboarding, `Administration: R/W` på alla repon) används **inte**
av Maskinen och nås inte från någon `/api/loop/**`-väg. Att smalna den är ett separat ägarärende
som inte blockerar någon skiva här.

**Credential-räkning efter ägarbeslut 1** (kontroll att beslutet inte öppnade en ny yta):

```text
credentialer FÖRE beslutet i Railway  = AUTH_* · GITHUB_TOKEN_READ · GITHUB_TOKEN_WRITE
                                        · SUPABASE_* · N8N_WEBHOOK_SECRET · PLACES_API_KEY
credentialer EFTER beslutet           = samma + LOOP_SUPABASE_URL/KEY (begränsad DB-roll)
NETTO NY CREDENTIAL-YTA               = 1 transport-nyckel utan GitHub-, Git- eller
                                        shell-behörighet, utan skrivrätt på events/snapshots
NETTO NY AUTHORITY                    = 0
```

## Minsta behörighet, sammanfattat

| Credential | Var | Behörighet | Rör kontrollplanet? |
|---|---|---|---|
| `LOOP_SUPABASE_KEY` | Railway, server-only | SELECT på events/snapshots, INSERT på commands/blobs | läser projektion, köar intentioner |
| `GITHUB_TOKEN_READ` | Railway | Contents: Read på WORKFLOW_REPO + kund-* | nej — Maskinen använder den inte |
| controllerns Supabase-nyckel | fabriks-Macen | INSERT/UPDATE på alla loop-tabeller | ja, men bor aldrig i Railway |
| GitHub App-nyckel | fabriks-Macen, fil 0600 | promotion | ja, aldrig i Railway |

---

# COMPONENT_PLAN

```text
components/loop/
  MaskinShell.tsx           tre kolumner + responsiv kollaps; äger ingen datahämtning
  RunStatusBar.tsx          ● AUTONOM/○ OKÄNT · eventålder · main <sha> + bekräftad-tid
  BacklogColumn.tsx         råkällor + grupperade tillstånd med antal
  CurrentTaskPanel.tsx      current task + faslista (PLAN/BUILD/VERIFY/REVIEW/MERGE)
  CompletedColumn.tsx       klara + ej promoverade
  TaskCard.tsx              taskkortet (nedan)
  PhaseRail.tsx             faserna; ✓ ● — ✗ ur event, aldrig gissning
  EventStream.tsx           virtualiserad lista, [sv]/[raw], pausa autoskroll, gap-markör
  EventRow.tsx              en rad + JSON-råläge
  TaskInspector.tsx         elva flikar
  inspector/*.tsx           en fil per flik
  MergeTimeline.tsx         B → konflikt → D → omverifiering → promotion
  VerdictBadge.tsx          PASS/FAIL/NOT_RUN — NOT_RUN visuellt SKILT från PASS
  EvidenceRefList.tsx       referenser + kopiering
  IntakeDropzone.tsx        dra/välj/klistra, formell validering
  IntakeResult.tsx          källa → tolkning → N tasks
  CommandButton.tsx         typat verb, dedup_key, avaktiverad vid fail-closed
  CommandLog.tsx            senaste kommandon + status
  StaleBanner.tsx           transport nere / okänt schema / lucka i ström

lib/loop/
  schema.ts                 typer + runtime-validering av event och snapshot
  events.ts                 dedup, seq-ordning, gap-detektion, fold av tail
  snapshot.ts               SNAPSHOT_WINS-sammanslagning
  labels.ts                 event_type → svenska; okänd → rå
  commands.ts               de fem verben, payload-validering, dedup_key, TTL
  transport.ts              server-only Supabase-klient för kontrollplanet
  fixtures/*.json           genererade ur schema.ts, aldrig handskrivna
```

**Delas med befintlig kod:** `PageHeader`, `Graceful`, `CopyBlock`, `globals.css`-tokens,
envelope-mönstret från `lib/github-read.ts`, den lazy/graceful klientformen från `lib/supabase.ts`.
Inget i `components/loop/**` importerar `PipelinePanel`, `ProcessGuide` eller `MetricsPanel`.

## Taskkortets fält (uppdragets §6)

```text
task id / titel        ur snapshot
källa                  provenance → källnamn + sha256-prefix
status                 TASK_LIFECYCLE, aldrig UI-uppfunnen
försök / budget        attempt.n / attempt.budget    (budget saknas i kontraktet → "2 av —")
aktuell fas            PLAN/BUILD/VERIFY/REVIEW/MERGE
builder / modell       B4 → "—" tills payload-kontraktet finns
riskklass              S10 → "—" tills Task IR finns
base-SHA               kort SHA, mono, kopierbar
kandidat-SHA           dito; "—" innan kandidat finns
förfluten tid          ur ts, DISPLAY-ONLY, aldrig ordning; visas som "~12 min"
verifieringsstatus     tre skilda badges: policy · global · taskgrind
evaluatorstatus        krävd/ej krävd + utfall
merge/promotion        kompakt tillstånd + main-SHA vid MAIN_ADVANCED
```

**Ingen animation eller liveness utan faktisk signal.** Ett kort som inte fått event på länge
visar ålder i klartext i stället för att pulsera.

---

# IMPLEMENTATION_SLICES

Elva skivor. Var och en har ett exit-kriterium som går att pröva, och en explicit uppgift om vad
den blockeras på. Kommandoskrivningar kommer **efter** en stabil läsyta.

### V1 · Typade backendkontrakt och schemavalidering

```text
BEROENDE          inget (bygger mot backendplanens EVENT_SCHEMA_PLAN + COMMAND_SCHEMA_PLAN)
YTA               lib/loop/schema.ts, lib/loop/labels.ts, lib/loop/fixtures/**
EXIT              (1) Varje event_type i backendens sexton familjer har en typ, och ett event med
                  okänd typ passerar validering som "okänd" utan att kasta.
                  (2) Fixturer GENERERAS ur schema.ts — en handskriven fixtur som avviker från
                  schemat fälls av ett prov.
                  (3) Ett event utan seq, event_id eller schema_version avvisas.
                  (4) Ordningsprov: hundra event med bakåtgående ts ger identisk läsordning som
                  med stigande ts.
NEG. KONTROLL     fixtur som saknar den verkliga kanalens form men ändå går grön ·
                  ts-baserad sortering som råkar ge rätt svar på testdata
BLOCKERAD PÅ      inget
```

### V2 · Fixturbaserad Maskinen-shell

```text
BEROENDE          V1
YTA               app/(app)/loop/page.tsx, components/loop/{MaskinShell,RunStatusBar,
                  BacklogColumn,CurrentTaskPanel,CompletedColumn,TaskCard,PhaseRail}
EXIT              (1) /loop renderar tre kolumner ur fixtur, bakom LOOP_ENABLED.
                  (2) Alla elva TASK_LIFECYCLE-tillstånd (inkl. STOPPED) har distinkt rendering.
                  (3) Ett fixturfält satt till null renderar "—", aldrig 0 eller tomt.
                  (4) Ingen route utanför /loop ändrad; / renderar byte-identiskt.
NEG. KONTROLL     NEEDS_SPEC renderat som fel · fallet försök som ser ut som klart ·
                  procentsats eller framstegsstapel någonstans i trädet
BLOCKERAD PÅ      inget
```

### V3 · Read model + SNAPSHOT_WINS

```text
BEROENDE          V1, V2
YTA               lib/loop/{events,snapshot}.ts
EXIT              (1) En tail-eventsekvens som "avslutar" en task ändrar INTE state till DONE —
                  DONE kräver snapshot. Mätt med en fixtur där tail säger klart och snapshot inte.
                  (2) Out-of-order och dubblerade event ger identiskt sluttillstånd som en
                  perfekt ordnad ström (mätt: samma serialiserade read model).
                  (3) Gap i seq detekteras och rapporteras.
                  (4) Snapshot och tail som säger olika → snapshot vinner.
NEG. KONTROLL     fold som blir authority · dedup på seq i stället för event_id ·
                  disorder som ger falskt DONE · snapshot som skrivs över av tail
BLOCKERAD PÅ      inget (fixturer). Verklig drift kräver B8.
```

### V4 · Live läsyta

```text
BEROENDE          V3 · nortropic-system S5 byggd och grön (bär B3:s låsta seq-scope och B4:s
                  canonical payload-kontrakt) · S13 bygger B8-snapshoten
                  (BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13)
YTA               lib/loop/transport.ts, app/api/loop/{snapshot,events,task}/route.ts
EXIT              (1) /loop visar verkliga snapshots och event ur kontrollplanets Supabase.
                  (2) Verkstadsgolvet gör noll skrivningar mot loop_events/loop_snapshots —
                  mätt genom att appens DB-roll saknar INSERT/UPDATE på dem.
                  (3) Appen nere → controllerns attestationer och exitkod identiska (backendens
                  S13-kriterium; mäts av backenden, refereras här).
                  (4) Ingen /api/loop/**-route finns i middleware-undantagen.
                  (5) Gap-detektion körs ENDAST på den ofiltrerade butiksströmmen — en
                  run-filtrerad vy larmar aldrig om legitima seq-hopp (B3).
NEG. KONTROLL     appen skriver i eventtabellen · service_role-nyckel i Railway ·
                  UI som slår upp origin/main själv · authoritative state rekonstruerat
                  genom event-fold i stället för ur snapshot · falsklarm om lucka i en
                  run-filtrerad vy
BLOCKERAD PÅ      S5 (B3, B4) · S13 (B8) — inget av dem byggt vid 0b3212c9
```

### V5 · Task inspector

```text
BEROENDE          V4 · S1 för verifieringsflikarna · S4 för ATTEMPTS
YTA               app/(app)/loop/uppgift/[taskId]/page.tsx, components/loop/inspector/**
EXIT              (1) Alla elva flikar finns; en flik utan backenddata visar "—" med orsak,
                  aldrig en tom ruta.
                  (2) NOT_RUN renderas visuellt SKILT från PASS (mätt i DOM/klassnamn).
                  (3) De åtta frågorna i §"De åtta frågorna" har var sin utpekade yta.
                  (4) Ingen flik visar grindens kod, kontrollnamn eller registret — mätt med en
                  fixtur där ett fält bär en unik markörsträng: markören får inte nå DOM.
NEG. KONTROLL     verdict renderad mot fel candidate_sha · grindtext i DOM ·
                  NOT_RUN som ser grön ut
BLOCKERAD PÅ      S1, S4, S13 (DIFF/EVIDENCE)
```

### V6 · Merge-resolution-UX

```text
BEROENDE          V5 · S8 · B7
YTA               components/loop/MergeTimeline.tsx + inspector/Merge.tsx
EXIT              (1) De sju merge-tillstånden renderas ur sina event_type.
                  (2) B:s PASS visas ALDRIG som D:s dom — mätt med en fixtur där B är grön och D
                  saknar verdict: D:s vy måste visa "—".
                  (3) MERGE_CONFLICT och RESOLVER_WORKING renderas INTE som human-stop.
                  (4) Fail-closed stopp renderas tydligt skilt från konfliktlösning.
NEG. KONTROLL     konflikt som ser ut som fel · resolver-working som larmar ·
                  ärvd verdict · "lös konflikten"-knapp
BLOCKERAD PÅ      S8, B7
```

### V7 · Smal kommandoyta

```text
BEROENDE          V4 · nortropic-system S13 byggd OCH verifierad
                  (ÄGARBESLUT_INVARIANT_1 = LOCKED — inte längre en blockerare)
YTA               app/api/loop/command/route.ts, lib/loop/commands.ts,
                  components/loop/{CommandButton,CommandLog}
EXIT              (1) Exakt fem verb accepteras; ett sjätte ger 400 utan sidoeffekt.
                  (2) En payload som bär en shell-sträng exekveras aldrig — mätt med en payload
                  vars innehåll skulle skapat en kanariefil om den tolkats.
                  (3) Oautentiserad → 401. Fel origin → 403.
                  (4) Samma command_id två gånger ger EN rad. Dubbelklick ger ETT kommando.
                  (5) Utgånget eller stale kommando avvisas med orsak och visas som avvisat.
                  (6) run.pause_at_safe_boundary presenteras som "efter aktuell uppgift".
                  (7) Ingen optimistisk state-uppdatering: task state ändras först ur snapshot.
                  (8) Statiskt: noll kodvägar under app/api/loop/** och lib/loop/** som rör
                  lease, breaker, Git-refs, verdict, attestation eller promotion.
NEG. KONTROLL     generisk shell/Git-yta · godtycklig filredigering · force merge ·
                  direkt attestation- eller promotion-skrivning · lease- eller
                  breaker-manipulation · replay som utför två gånger ·
                  UI som visar "startad" innan controllern svarat
BLOCKERAD PÅ      S13 (byggd och verifierad). Ägarbeslutet är LÅST och blockerar inte.
```

### V8 · Markdown-intake

```text
BEROENDE          V7 · S10 · B5 (source_ref-kontraktet)
YTA               app/(app)/loop/mata/page.tsx, app/api/loop/intake/route.ts,
                  components/loop/{IntakeDropzone,IntakeResult}
EXIT              (1) .md accepteras; annan filtyp avvisas i klienten OCH på servern.
                  (2) Storleks- och antalsgräns hålls; överskridande avvisas med tydlig orsak.
                  (3) Bytes lämnas till den smala intake-transporten och en OPAK source_ref
                  returneras. Verkstadsgolvets sha256 skickas som PÅSTÅENDE i payloaden;
                  controllern räknar om och avvisar vid avvikelse (B5). Appens hash är
                  aldrig trust-anchor — mätt genom att en manipulerad transportbyte ger
                  avslag från controllern, inte en accepterad källa.
                  (4) Frontend kompilerar ALDRIG tasks — mätt genom att en källa med två
                  arbetsmål ger noll UI-genererade tasks före controllerns svar.
                  (5) Backend-avslag visas ordagrant.
                  (6) NEEDS_SPEC renderas som arbetsläge, inte som fel.
NEG. KONTROLL     klientsidig rubrikparsning · sha256 beräknad i klienten och betrodd ·
                  Railway-/Supabase-hash behandlad som trust-anchor · muterad källa som
                  ändå accepteras · uppskattat antal tasks före svar
BLOCKERAD PÅ      S10 + S13 (B5 — transportens form ägs där, inte här)
```

### V9 · Realtid, reconnect, dedup

```text
BEROENDE          V4
YTA               app/api/loop/stream/route.ts, lib/loop/events.ts
EXIT              (1) SSE levererar tail; avbrott återansluter och backfillar utan dubbletter.
                  (2) Dubblerat event ger ingen andra rad och ingen state-ändring.
                  (3) Out-of-order ger samma sluttillstånd som ordnat.
                  (4) Okänd framtida event_type visas rått och kraschar inte.
                  (5) Nyare major schema_version ger banner, inte krasch.
                  (6) SSE nere → poll-fallback med synlig markering.
NEG. KONTROLL     reconnect som tappar event · dedup som släpper igenom dubblett ·
                  UI som påstår realtid när det pollar
BLOCKERAD PÅ      S5
```

### V10 · Säkerhetshärdning

```text
BEROENDE          V7
YTA               middleware.ts (OFÖRÄNDRAD matcher), alla /api/loop/**, next.config.ts
EXIT              (1) Bundle-analys: noll förekomster av LOOP_SUPABASE_KEY, SUPABASE_SERVICE_KEY,
                  GITHUB_TOKEN_* och AUTH_* i klientbundlen — mätt statiskt över .next/static.
                  (2) Noll NEXT_PUBLIC_*-variabler i repot.
                  (3) Oinloggad når ingen /loop-route och ingen /api/loop-route.
                  (4) Serverloggar och event-rendering bär inga hemligheter eller payload-värden.
                  (5) middleware-matchern är byte-identisk med den vid PLAN_BASE_SHA.
                  (6) Statiskt: NOLL import av lib/github-read.ts eller lib/github-write.ts
                  under app/api/loop/** och lib/loop/** (MASKINEN_GITHUB_CREDENTIAL=NONE).
                  (7) Statiskt: NOLL kodvägar under app/api/loop/** och lib/loop/** som rör
                  lease, breaker, Git-refs, verdict, attestation eller promotion.
NEG. KONTROLL     nyckel i bundle · /api/loop tillagd i matcher-undantag ·
                  hemlighet i felmeddelande · promotion-credential i Railway ·
                  GITHUB_TOKEN_WRITE eller GITHUB_TOKEN_READ nådd från en loop-väg
BLOCKERAD PÅ      inget
```

### V11 · Responsivt och regressioner

```text
BEROENDE          V2–V10
YTA               app/globals.css (additiv), regressionsprov
EXIT              (1) /loop och inspectorn fungerar vid 1280/960/720/375 px utan horisontell
                  sidscroll; breda ytor (diff, tabeller) scrollar i EGEN behållare.
                  (2) prefers-reduced-motion respekteras (globals.css rad 99 gäller redan).
                  (3) Regressioner gröna: Leads (lista/arbetsvy/kalibrering/insamling),
                  onboarding, systemhälsa, dokument, auth, login-redirect.
                  (4) / renderar identiskt med PLAN_BASE_SHA.
NEG. KONTROLL     Leads-flöde brutet av delad CSS · sidebar trasig vid 720 px ·
                  ändrad klass som slår mot befintliga paneler
BLOCKERAD PÅ      inget
```

---

# IMPLEMENTATION_ORDER

```text
1.  V1   typade backendkontrakt / schemas
2.  V2   fixturbaserad Maskinen-shell
3.  V3   read model (SNAPSHOT_WINS)
4.  V4   live läsyta                       ⟵ KRÄVER nortropic-system S5
5.  V5   task inspector                    ⟵ KRÄVER S1, S4 för full nytta
6.  V8*  Markdown-intake UI (fixturläge)   ⟵ UI kan byggas mot fixtur här
7.  V7   smal kommandoyta                  ⟵ KRÄVER S13 byggd OCH verifierad
                                              (ägarbeslut invariant 1 = LOCKED, ej blockerare)
8.  V8   Markdown-intake live              ⟵ KRÄVER S10 + S13 (B5)
9.  V9   realtid / reconnect
10. V10  säkerhetshärdning
11. V11  responsivt / polish / regressioner
12. V6   merge-resolution-UX               ⟵ KRÄVER S8; kan flyttas fram när S8 finns
```

Avvikelsen mot uppdragets föreslagna ordning är **V6**: merge-UX flyttas sist därför att backendens
S8 ligger på plats 8 av 14 i backendens egen `MIGRATION_ORDER` och inte kan visas dessförinnan.
Att bygga merge-UX mot fixturer tidigare är tillåtet men får inte räknas som klart.

`V8*` är UI:t mot fixtur; `V8` är samma UI mot verklig backend. De är samma kod, två exit-grindar.

**Kommandoskrivningar (V7) kommer efter stabil läsyta (V4) och stabilt schema (V1).** Det är
uppdragets krav och backendens beroendeordning i samma riktning.

---

# MIGRATION

```text
STEG 0   plan/nortropic-control-room-v1 (denna gren) — endast docs
STEG 1   V1–V3 mergas bakom LOOP_ENABLED=false. Deploybart. Ingen synlig ändring.
STEG 2   LOOP_ENABLED=true i en icke-produktionsmiljö → fixturläge granskas av ägaren
STEG 3   nortropic-system S5 klar → LOOP_SUPABASE_* sätts → V4 aktiveras
STEG 4   V5, V9, V10, V11 rullar in en skiva i taget
STEG 5   nortropic-system S13 byggd och verifierad → V7 aktiveras
         (ägarbeslut invariant 1 är redan LÅST och blockerar inte)
STEG 6   nortropic-system S10 + S13:s intake-transport (B5) → V8 aktiveras
STEG 7   nortropic-system S8 → V6 aktiveras
```

Ingen megadiff. En skiva = en gren = en PR. `/` rörs inte i något steg. Rullbakåt är att sätta
`LOOP_ENABLED=false` — ingen datamigrering behöver ångras, eftersom Verkstadsgolvet aldrig äger
kontrollplansdata.

**Framtida promotion av Maskinen till startsida** planeras separat och ingår inte i v1.

---

# TEST_MATRIX

Formen följer husets: baslinje utan komponent (rött av rätt skäl) → ärlig referens som kastas före
commit → lögnstubbar med EN lögn var och förutsagd fällningskarta skriven FÖRE körning → hela
batteriet → körning i ägarens miljö.

### Auth
```text
A1  oinloggad → /loop redirectas till /login                                  (V2)
A2  oinloggad → /api/loop/{snapshot,events,stream,task,command,intake} → 401  (V4/V7)
A3  inloggad → /loop svarar 200                                                (V2)
A4  middleware-matchern byte-identisk med PLAN_BASE_SHA                        (V10)
A5  regression: /leads, /dokument, /onboarding, /systemhalsa gatade som förut  (V11)
A6  route-handler utan session → 401 ÄVEN om matchern manipuleras (djupförsvar) (V10)
```

### Events
```text
E1  deterministisk render: samma ström → samma read model, två körningar        (V3)
E2  duplicate event → ingen andra rad, ingen state-ändring                      (V3/V9)
E3  out-of-order → identiskt sluttillstånd som ordnat                           (V3)
E4  unknown future event_type → rå rad, ingen state, ingen krasch               (V1/V9)
E5  reconnect efter avbrott → backfill utan dubbletter, ingen tappad seq        (V9)
E6  stale run: event med seq ≤ watermark ändrar ingen state                     (V3)
E7  missing evidence: evidence_refs tom → "—", inget trasigt UI                 (V5)
E8  bakåtgående ts ändrar inte läsordningen                                     (V1)
E9  gap i seq → synlig markör + backfill                                        (V3/V9)
E10 nyare major schema_version → banner, ingen krasch                           (V9)
E11 B3: två interfolierande runs (seq 1..6 fördelade på A och B) ger korrekt
    global ordning, NOLL gap-larm i den run-filtrerade vyn, och gap-larm när ett
    seq faktiskt saknas i den ofiltrerade strömmen                              (V3/V9)
E12 B2: heartbeat-event ger liveness men ALDRIG lease-/ownershipstatus i UI:t    (V4)
E13 B8: authoritative fält renderas ur snapshot; en ren eventström utan snapshot
    ger ingen task lifecycle-state alls (bara ström + transienta faser)         (V3/V4)
```

### States
```text
S1t failed attempt renderas ALDRIG som complete                                 (V2/V5)
S2t resolver-working renderas ALDRIG som human-stop                             (V6)
S3t fail-closed stopp syns tydligt och skilt från konflikt                      (V6)
S4t NEEDS_SPEC syns som arbetsläge i warning, inte som fel                      (V2/V8)
S5t saknad metrik → "—", aldrig 0 eller uppskattning                            (V2)
S6t STOPPED finns och renderas i danger                                          (V2)
S7t tail som säger "klart" ger INTE DONE utan snapshot                          (V3)
S8t NOT_RUN visuellt skilt från PASS                                             (V5)
S9t B:s PASS visas aldrig som D:s dom                                            (V6)
S10t ingen procentsats eller framstegsstapel i hela /loop-trädet (statiskt grep) (V2)
```

### Intake
```text
I1  .md accepteras; .txt/.pdf/.exe avvisas i klient OCH server                   (V8)
I2  storleksgräns och antalsgräns hålls; överskridande avvisas med orsak         (V8)
I3  originalkällan bevaras byte-identisk och kan visas efteråt                   (V8)
I4  sha256 beräknas server-side; klientens värde betros aldrig                   (V8)
I5  backend rejection visas ordagrant med command_id                            (V8)
I6  frontend kompilerar ALDRIG tasks själv: källa med två arbetsmål ger noll
    UI-genererade tasks före controllerns svar                                  (V8)
I7  inklistrad text ger samma väg som fil (transport + påstådd sha256)           (V8)
I8  B5: manipulerade bytes i transporten → controllern avvisar vid hash-omräkning;
    appens sha256 accepteras aldrig som trust-anchor                            (V8)
```

### Commands
```text
C1  unauthenticated → 401                                                       (V7)
C2  fel origin / cross-site → 403                                               (V7)
C3  sjätte verb → 400, ingen rad skriven                                         (V7)
C4  duplicate/replay: samma command_id två gånger → EN rad                       (V7)
C5  dubbelklick → ETT kommando (dedup_key)                                       (V7)
C6  stale command (expected_watermark passerad) → avvisat med orsak              (V7)
C7  utgånget kommando (expires_at) → aldrig claimat                              (V7)
C8  safe-boundary pause presenteras som "efter aktuell uppgift"                   (V7)
C9  payload med shell-sträng → ingen exekvering (kanariefil skapas aldrig)       (V7)
C10 statiskt grep: noll shell-, Git- eller filredigeringsanrop i /api/loop/**     (V7/V10)
C11 ingen optimistisk state-uppdatering före snapshot                            (V7)
```

### Secrets
```text
X1  klientbundle: noll träffar på LOOP_SUPABASE_KEY, SUPABASE_SERVICE_KEY,
    GITHUB_TOKEN_READ, GITHUB_TOKEN_WRITE, AUTH_SECRET, AUTH_PASSWORD           (V10)
X2  noll `process.env.NEXT_PUBLIC_*`-referenser i kod (kommentarer räknas inte)  (V10)
X3  inga hemligheter i serverloggar eller felmeddelanden                        (V10)
X4  inga promotion-/controller-credentials i Railway-miljön                      (V10)
X5  grindtext/registerinnehåll når aldrig DOM (markörsträng-prov)                (V5)
X6  statiskt: NOLL import av lib/github-read.ts eller lib/github-write.ts under
    app/api/loop/** och lib/loop/** (MASKINEN_GITHUB_CREDENTIAL=NONE)           (V10)
X7  statiskt: NOLL kodvägar under app/api/loop/** och lib/loop/** som rör lease,
    breaker, Git-refs, verdict, attestation eller promotion                     (V7/V10)
```

### Regression
```text
R1  Leads: lista, arbetsvy, kalibrering, insamling — oförändrat beteende         (V11)
R2  onboarding: flaggad, 403 när av, skapar repo när på                          (V11)
R3  systemhälsa: doktorn/retro/nattmannen renderar som förut                     (V11)
R4  dokument: repos/tree/file fungerar, cache oförändrad                         (V11)
R5  / renderar byte-identiskt med PLAN_BASE_SHA                                  (V11)
R6  sidebar: befintliga poster och grupper oförändrade; endast Maskinen tillkommer (V11)
R7  globals.css: befintliga selektorer oförändrade (endast additiva regler)      (V11)
```

---

# RISKS

1. **Backenden finns inte än.** Elva av tretton backendslices som denna plan läser ur är obyggda,
   och de två UI:t mest behöver (S5, S13) ligger på plats 5 och 13 av 14. Största risken är att
   någon bygger "live"-läget mot fixturer och kallar det klart. Motmedel: V4 och framåt har
   backendberoendet skrivet i exit-kriteriet, och fixturerna genereras ur schemat.
2. **Fixturer utan mätt form bevisar ingenting.** En grön grind mot en fixtur som inte bär den
   verkliga kanalens form är ett falskt kvitto. V1:s exit-kriterium kräver därför genererade
   fixturer och ett prov som fäller en handskriven avvikande fixtur.
3. **UI-folden kan bli en andra sanning.** Motmedel är SNAPSHOT_WINS. Men den kräver att
   backenden faktiskt publicerar snapshots (B8). Gör den inte det finns ingen säker live-väg —
   och frestelsen att låta UI:t folda hela strömmen blir stor.
4. **Kommandokön är den största nya angreppsytan.** Fem verb och typade payloads är svaret, men
   `payload jsonb` är fritt format. Skyddet ligger i validering på båda sidor och i att
   controllern alltid får avvisa. En payload som råkar tolkas någonstans är ett tyst fel.
5. **Supabase service_role kringgår RLS.** Om kontrollplanet läggs i Leads-projektet, eller om
   appen får service_role, kan Verkstadsgolvet skriva i eventströmmen. Planens svar är skilda
   projekt plus en begränsad DB-roll — men att den rollen går att skapa är **inte mätt**.
6. **Invariant 1 är ersatt — men BYGGSPEC-filen bär fortfarande den gamla texten.**
   `VERKSTADSGOLVET-BYGGSPEC.md` rad 11 säger alltjämt "LÄS-ONLY. ALLTID." Ägarbeslutet är låst i
   denna plan, men tills BYGGSPEC uppdateras finns två motstridiga texter i repot och en läsare
   kan dra fel slutsats. Att uppdatera BYGGSPEC är ägarhand och görs inte i en planeringssession.
7. **Två pipelines i samma app.** Leads är kundflöde, Maskinen är kontrollplan. De delar
   NextAuth-session, Railway-instans och CSS. En bugg i den ena kan störa den andra i drift även
   om datalagren är skilda. Regressionsmatrisen är motmedlet, inte en garanti.
8. **`GITHUB_TOKEN_WRITE` är redan bred.** `Administration: R/W` på alla repon ligger i Railway i
   dag. Maskinen använder den inte, men dess existens gör påståendet "inga generiska GitHub-skriv
   i denna app" osant på appnivå. Bör smalnas i separat ägarärende.
9. ~~Backendplanens gren ligger på fel remote.~~ **ÅTGÄRDAD.** Se `REMOTE_INCIDENT_STATUS =
   RESOLVED`. Kvarstående lärdom: en felriktad `origin` i en systerklon är tyst tills någon
   pushar, och båda repona bär grenar med prefixet `plan/`. Grennamnen hålls därför åtskilda.
10. **Statusvokabulären driver isär.** Uppdraget och backendkontraktet skiljer sig redan på två
    tillstånd. Utan en enda kanonisk lista i backenden kommer UI:t att uppfinna tillstånd.
11. **Tokens/kostnad visas som `—` tills vidare.** `B6_STATUS=DEFERRED_NON_BLOCKING` är ett
    medvetet ägarbeslut: metriken är inte trustkritisk och ska inte skapa en backend-slice nu.
    Restrisken är kosmetisk — `—` kan läsas som ett fel av den som inte läst planen. UI:t bör
    därför förklara `—` i tooltip, inte tystna.
12. **Elapsed ur wall-clock kan hoppa.** `ts` är uttryckligen inte ordningsbärande. Förfluten tid
    visas därför som ungefärlig och används aldrig till sortering eller till att avgöra liveness.

---

# PLAN_REVIEW — adversariell granskning mot faktisk kod och backendplan

## Runda 1 — mot uppdragets tolv frågor i §21

Kördes före första commit (`a301e1c`).

| # | Fråga | Utfall | Åtgärd i planen |
|---|---|---|---|
| 1 | Antar UI:t backendfält som inte finns i designkontraktet? | **FYND.** Uppdraget kräver `VERIFYING_SPEC`, `UPLOADED`, `ANALYZING`, tokens/kostnad, riskklass, builder/modell, budget — inget av dem finns i backendkontraktet vid `0b3212c9`. | B1–B8 skrivna som backendkrav. `VERIFYING_SPEC` degraderad till härledd underetikett. `UPLOADED`/`ANALYZING` flyttade till en egen `submission.*`-namnrymd som aldrig renderas som task state. Alla odefinierade fält renderar `—`. |
| 2 | Saknas något tillstånd? | **FYND.** `STOPPED` finns i backendkontraktet men saknades i uppdragets lista. | `STOPPED` tillagt i TASK_LIFECYCLE, i tabellen och som provrad S6t. |
| 3 | Dupliceras controller authority i Supabase? | **FYND (formulering).** Första utkastet lät UI:t folda hela strömmen till task state. | SNAPSHOT_WINS infört: auktoritativa fält renderas endast ur controller-publicerad snapshot; tail får bara flytta transienta faser. Appens DB-roll saknar skrivrätt på events/snapshots. |
| 4 | Kan UI:t råka bli Git-exekutor? | **Nej — men en väg fanns.** Att låta `RunStatusBar` verifiera `origin/main` mot GitHub hade gjort appen till ref-upplösare och krävt repo-scope mot `nortropic-system`. | Uttryckligt förbud: `current_main` visas endast som controllerns bekräftade värde med tidsstämpel. Ingen GitHub-läsning mot backendrepot. |
| 5 | Kan kommandokön replaya en farlig handling? | **FYND.** Ett `run.start` som ligger kvar i kön över en nätdelning kunde utföras långt senare mot ett annat läge. | Tre lager: `command_id` som PK, `expires_at` (TTL), `expected_watermark`. Plus controllerns rätt att avvisa. Prov C4–C7. |
| 6 | Kan event-disorder visa falskt DONE? | **Nej, med SNAPSHOT_WINS.** DONE/ATTESTED/PROMOTED renderas aldrig ur tail. | Prov S7t och E3. |
| 7 | Blandas kundpipeline med control-plane-loop? | **FYND.** Att återanvända Leads Supabase-projekt hade gett Leads service_role-nyckel skrivrätt i eventströmmen (service_role kringgår RLS projektbrett). | Skilda Supabase-**projekt**, inte bara skilda tabeller. Egna env-variabler. |
| 8 | Kräver planen promotioncredential i Railway? | **Nej.** | Uttryckligt: `PROMOTION_CREDENTIAL_IN_RAILWAY=NO`. Nyckeln bor på Macen i fil 0600 enligt backendens PROMOTION_PLAN. Rapporterat separat: befintlig `GITHUB_TOKEN_WRITE` är bred, men Maskinen rör den inte. |
| 9 | Förstör planen befintlig Leads/onboarding? | **Nej, om regressionerna körs.** Delad CSS och delad session är de verkliga riskvägarna. | R1–R7 i testmatrisen; `globals.css` endast additiv; V11 kräver att `/` renderar identiskt. |
| 10 | Finns två sanningar för task state? | **Nej.** Controllerns snapshot är displayed truth; tail är provisorisk och visuellt märkt. | SNAPSHOT_WINS + appens saknade skrivrätt. |
| 11 | Bygger Maskinen på `AUTOBYGG-LOG.md`? | **Nej.** Filen förekommer på fyra ställen i repot, alla utanför Maskinens träd. | `components/loop/**` importerar aldrig `PipelinePanel`/`ProcessGuide`/`MetricsPanel`. `/` lämnas orörd. |
| 12 | Finns fejkad progress? | **FYND.** Uppdragets ASCII-skiss antyder faslampor; utan regel hade de kunnat animeras utan signal. | `PhaseRail` renderar `✓ ● — ✗` endast ur event. Liveness kräver B2 eller eventålder under tröskel. Statiskt grep-prov S10t mot procentsatser och framstegsstaplar. |
| 13 | *(extra)* Har varje skiva ett prövbart exit-kriterium? | **FYND i första utkastet.** V4 och V7 saknade mätbar formulering. | Varje skiva V1–V11 har numerade exit-punkter och negativa kontroller. |
| 14 | *(extra)* Är UI:ts okända-event-hantering förenlig med backendens? | **Skenbar konflikt, löst.** Backendens S5 **avvisar** okänd `event_type` vid skrivning; uppdraget kräver att UI:t **inte kraschar** på okänd typ. | De gäller olika sidor: backenden avvisar vid skrivning, UI:t degraderar vid läsning (en nyare controller kan emittera typer detta UI-bygge inte känner). Skrivet i EVENT_CLIENT. |
| 15 | *(extra)* Kan feedbackinnehåll läcka grindens kod till UI:t? | **Risk finns.** S4 förbjuder det i artefakten, men UI:t kunde återinföra läckan via en annan projektion. | V5 exit-punkt 4: markörsträng-prov som mäter att grindtext aldrig når DOM. Sker det ändå är det ett backendfel att rapportera. |

## PLAN_REVIEW — runda 2: adversariell kontroll av ägarbesluten

Frågan som styrde rundan: **skapar ägarbeslut 1 och 2 en ny authority eller en ny credential-yta?**

| # | Falsifieringsfråga | Utfall |
|---|---|---|
| 1 | Gör den nya kontrollmodellen Verkstadsgolvet till en authority? | **Nej.** `CONTROLLER_LOCAL_STATE=SOLE_AUTHORITY` står kvar. De fem verben är *intentioner*; controllern validerar och får alltid avvisa. Ingen UI-state ändras före bekräftelse. Ett kommando kan inte mutera controller-state — det kan bara be om något. |
| 2 | Öppnar beslutet en Git- eller shell-yta? | **Nej.** Förbudslistan är utökad och gjord statiskt mätbar i V7 punkt 8: noll kodvägar mot lease, breaker, Git-refs, verdict, attestation eller promotion. |
| 3 | Skapar beslutet en ny credential-yta? | **Nej netto.** Enda tillkommande credentialen är transportnyckeln (begränsad DB-roll, ingen GitHub-, Git- eller shell-behörighet, ingen skrivrätt på events/snapshots). Se credential-räkningen i AUTH_SECURITY. |
| 4 | Kan `GITHUB_TOKEN_WRITE` bli Maskinens credential? | **Nej — och nu skärpt.** Maskinen använder **ingen** GitHub-credential alls, inte heller läs-token. Statiskt mätbart i V10. |
| 5 | Gör `run.heartbeat` (B2) UI:t till lease-authority? | **Nej, men risken var verklig.** Ett heartbeat-event ser ut som ownership-information. Låst: eventet är endast observerbarhet, och `RunStatusBar` härleder aldrig lease- eller ownershipstatus ur det. |
| 6 | Gör B3:s globala seq något osäkert? | **Fynd — rättat.** Revision 1 antog per-run seq och gap-detekterade per run. Med globalt monoton seq hade en run-filtrerad vy larmat om "luckor" konstant, eftersom andra runs event ligger emellan. Rättat: gap-detektion sker **endast** på den ofiltrerade butiksströmmen; unikhetsindex flyttat från `(run_id, seq)` till `seq`; reconnect-markören är butiksglobal. |
| 7 | Gör B5 Verkstadsgolvet till trust-anchor för källan? | **Fynd — rättat.** Revision 1 skrev "sha256 beräknas SERVER-SIDE" utan att säga att controllern räknar om. Nu låst: appens hash är ett *påstående*, controllern resolvar, läser bytes, hashar själv och kräver match innan planner startar. Railway-/Supabase-hash är aldrig ensam trust-anchor. |
| 8 | Uppfinner planen fortfarande intake-transporten? | **Fynd — rättat.** `loop_intake_blobs` var skriven som en tabellskiss bland de bindande. Nedgraderad till utkommenterad illustration; formen ägs av S10/S13. |
| 9 | Kan B8 misstolkas som redan byggt? | **Fynd — rättat.** Eget avsnitt `BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13` med explicit status `FORMULERAT, EJ BYGGT vid 0b3212c9`, och backendens S13-formulering ("läsytan svarar ur eventströmmen") markerad som en konflikt som måste rättas i backendens spec-rad. |
| 10 | Blir snapshot/tail-divergens en ny beslutsväg? | **Nej.** Divergens får observeras och loggas — aldrig ändra ett controllerbeslut och aldrig ändra det som visas. Snapshot vinner. |
| 11 | Tar B6 (deferred) bort något trustkritiskt? | **Nej.** Tokens/kostnad är inte trustkritisk. Ingen skiva blockeras; `TaskView` bär inget fält. `—` består. |
| 12 | Blev V7 lättare att bygga för tidigt nu när ägarbeslutet är låst? | **Risk — adresserad.** Beslutet tar bort styrningsfrågan men inte beroendet. V7 är fortfarande blockerad tills S13 är **byggd och verifierad**; det står nu i skivan, i ordningen, i migrationen och i handoffens STOP_CONDITIONS. |
| 13 | Finns någon kvarvarande väg där UI:t härleder parentskap eller main själv? | **Nej.** B7 låser `parent_sha` i payloaden och förbjuder GitHub-härledning; `current_main` kommer enbart ur snapshot. Båda förbuden är negativa kontroller. |

**Korrigeringar som runda 2 gjorde:** invariant 1 ersatt av `VERKSTADSGOLVET_CONTROL_MODEL`
(LOCKED) · B1–B8 fått explicita backendägare · seq-scope låst globalt och gap-detektionen
avgränsad till den ofiltrerade strömmen · unikhetsindex flyttat till `seq` · B4:s
payload-kontraktsidentitet inskriven i `lib/loop/schema.ts` · B5:s hash-omräkning hos controllern
låst och appens hash nedgraderad till påstående · intake-transporten nedgraderad till illustration
· B6 satt till `DEFERRED_NON_BLOCKING` · B7:s `candidate_sha`/`parent_sha` låsta ·
`BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13` skrivet som eget avsnitt med explicit ej-byggt-status ·
V7:s blockerare omformulerad från ägarbeslut till S13-verifiering · Maskinens GitHub-credential
satt till `NONE` · credential-räkning tillagd · remote-incidenten stängd som RESOLVED.

---

**Korrigeringar som runda 1 gjorde i planen:** `STOPPED` tillagt · `VERIFYING_SPEC` och
`UPLOADED`/`ANALYZING` flyttade ur task-vokabulären · SNAPSHOT_WINS infört som bärande regel ·
förbud mot egen `origin/main`-uppslagning · treskiktat replayskydd · skilda Supabase-projekt i
stället för skilda tabeller · B1–B8 formulerade som backendkrav i stället för antaganden ·
exit-kriterier omskrivna för V4 och V7 · markörsträng-provet mot grindläckage · ägarbeslutet om
invariant 1 gjort till en blockerande förutsättning för V7.

---

# PROVEN

Mätt i denna session, med kommando och utfall.

```text
verkstadsgolvet HEAD              = ae9d250240e47c40eccf72ff045198f8f5f054ea   (git rev-parse)
verkstadsgolvet branch vid start  = main
verkstadsgolvet origin            = git@github.com:Nortropic/verkstadsgolvet.git
arbetskopian ren                  = JA (0 0 mot origin/main; inga untracked)
                                    .env.example rapporteras raderad — SANDBOX nekar läsning av
                                    **/.env.*, filen är spårad
bifogade backendplaner            = BYTE-IDENTISKA med blobarna i 0b3212c9 (sha256, båda filerna)
pinnad plancommit finns lokalt    = JA, och bär båda plansökvägarna
commitkedja                       = 0b3212c ← eff7fcd ← 9bc1c61 ← a84d84e ← b644824
backendplangren på fel remote     = JA VID REVISION 1 — ÅTGÄRDAD, se revision 2 nedan
                                    (REMOTE_INCIDENT_STATUS = RESOLVED)
process.env.NEXT_PUBLIC_*         = NOLL referenser i kod (grep över app/ components/ lib/ +
                                    auth*.ts, next.config.ts). Strängen NEXT_PUBLIC_ finns i
                                    lib/places.ts rad 3 som KOMMENTAR ("får ALDRIG nå klienten /
                                    NEXT_PUBLIC_") samt i README, BYGGSPEC och db/LEADS-SETUP.md.
                                    Ett rått grep ger alltså träffar — noll av dem är variabler.
API-routes med egen auth()        = NOLL (skyddet är enbart middleware)
middleware-undantag               = api/auth · api/leads/worker · _next/static · _next/image ·
                                    favicon.ico · nortropic-logo.png
skrivytor vid HEAD                = 6 (onboarding, leads/[id], sweep POST, sweep PATCH,
                                    kalibrering POST, worker/run)
ProcessGuide / PipelinePanel / MetricsPanel = STATIC_TEMPLATE / STATIC_TEMPLATE+FUTURE_LOG_BASED /
                                    PLACEHOLDER (lästa i sin helhet)
AUTOBYGG-LOG.md-referenser        = 4 (BYGGSPEC rad 17, PipelinePanel rad 5 och 33,
                                    reference/*.html rad 39)
invariant 1 i BYGGSPEC            = "LÄS-ONLY. ALLTID." — ERSATT av ägarbeslut 1, men filens
                                    text är ännu inte uppdaterad (ägarhand)
GITHUB_TOKEN_WRITE                = README föreskriver Administration:R/W på ALL repositories
node_modules / lockfile / .next   = SAKNAS → build/lint/typecheck går inte att köra
```

**Mätt i revision 2 (denna session), utan nätverk:**

```text
plan/nortropic-control-room-v1 lokal tip före revisionen = a301e1c2bcd63b42abcd5047daf552b5d30d6bb4
arbetskopian ren före revisionen                          = JA
verkstadsgolvet origin                                    = git@github.com:Nortropic/verkstadsgolvet.git
nortropic-system origin                                   = git@github.com:Nortropic/nortropic-system.git   ← KORRIGERAD
verkstadsgolvet origin/plan/nortropic-control-room-v1     = a301e1c2bcd63b42abcd5047daf552b5d30d6bb4
verkstadsgolvet origin/plan/autonomous-loop-v1            = finns inte (git rev-parse --verify fail)
nortropic-system HEAD                                     = 0b3212c991d4227c8df2656465ae2c0252dda39e
```

Dessa fyra rader är **lokala remote-tracking-referenser** ur senaste `fetch` (2026-08-09 20:32),
inte live GitHub-avläsning. De **samstämmer med** ägarens mätning men ersätter den inte.
Ingen sandbox-bypass gjordes; inget nätverk användes.

# OVERIFIERAT

```text
- **B1–B8 är MAPPADE men INGET av dem är BYGGT** vid 0b3212c9. Ägarskapet är låst; koden finns
  inte. Ingen skiva får kallas klar mot ett mappat men obyggt kontrakt.
- **BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13 (B8)** — FORMULERAT, EJ BYGGT. Hela SNAPSHOT_WINS vilar
  på att S13 producerar en controller-genererad snapshot ur authoritative lokala stores.
  Backendens nuvarande S13-text ("läsytan svarar ur eventströmmen") måste rättas i dess spec-rad.
- Att en begränsad Supabase-DB-roll (SELECT på events/snapshots, INSERT på commands) fungerar med
  @supabase/supabase-js utan service_role. Inte mätt. Går det inte krävs en proxy hos S13.
- Den konkreta intake-transporten (B5). Ägs av S10+S13; illustrationen här är inte ett kontrakt.
- Payload-kontraktet per event_type och dess IDENTITET att pinna mot (B4). Ägs av S5. Alla
  taskkortsfält utanför EVENT_SCHEMA_PLAN renderas "—" tills kontraktet finns.
- Den låsta eventtypen för liveness (B2). `run.heartbeat` är exempel; S5 låser namnet.
- submission.*-familjens exakta typer (B1). Ägs av S5+S10.
- candidate_sha/parent_sha-fältens exakta namn (B7). Ägs av S5+S8.
- VERIFYING_SPEC som riktigt tillstånd. Kräver spec-rad i backendrepot; inte begärt av ägaren.
- Tokens/kostnad (B6) = DEFERRED_NON_BLOCKING per ägarbeslut. Ingen slice väntar på det.
- Att B3:s globala seq faktiskt implementeras strikt monotont av S5. Värdet är låst i planen;
  efterlevnaden är inte mätt.
- Railway-miljöns faktiska variabler. .env.example går inte att läsa i sandboxen; env-listan är
  rekonstruerad ur README och kod, inte ur den deployade miljön.
- Om GITHUB_TOKEN_READ har scope mot Nortropic/nortropic-system. allowedRepo() släpper bara
  WORKFLOW_REPO och kund-*; WORKFLOW_REPO:s värde är inte känt i sandboxen.
- Build/lint/typecheck. node_modules och lockfile saknas och nätet är stängt mot npm.
- Att SSE håller genom Railways proxy över lång tid. Inte mätt; poll-fallback är därför krav.
- Storleks- och antalsgränserna för intake (1 MiB / 20 filer) är förslag, inte ägarbeslut.
```

---

*Ingen produktionskod ändrades. Inga GitHub-inställningar ändrades. Ingen sandbox-, permission-
eller nätverkskonfiguration ändrades. Inga procentsatser. Inget "klart" utan bevis.*
