# Codex-handoff — Verkstadsgolvet som kontrollrum v1

Kort och exekverbart. `docs/nortropic-control-room-plan-v1.md` är auktoritativ; detta är ingången.

```text
REPO                          = Nortropic/verkstadsgolvet
PLAN_BASE_SHA                 = ae9d250240e47c40eccf72ff045198f8f5f054ea
PLAN_BRANCH                   = plan/nortropic-control-room-v1
PLAN_PATH                     = docs/nortropic-control-room-plan-v1.md

NORTROPIC_REPOSITORY          = Nortropic/nortropic-system
NORTROPIC_PLAN_COMMIT         = 0b3212c991d4227c8df2656465ae2c0252dda39e
NORTROPIC_PLAN_PATH           = docs/loop/autonomous-loop-plan-v1.md
NORTROPIC_CODEX_HANDOFF_PATH  = docs/loop/autonomous-loop-codex-handoff.md
BACKEND_PLAN_IDENTITY_MISMATCH = NEJ   (sha256 mätt mot blobarna i 0b3212c9)

START_SLICE                   = V1 · typade backendkontrakt och schemavalidering
NEW_PRIMARY_SECTION           = Maskinen
PROPOSED_ROUTE                = /loop
```

---

## LÅSTA VÄRDEN

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

PROMOTION_CREDENTIAL_IN_RAILWAY=NO
GENERIC_GITHUB_WRITE_TO_UI=NO
SUPABASE_ROLE=TRANSPORT_PROJECTION_QUEUE_ONLY
CONTROLLER_LOCAL_STATE=AUTHORITY
DISPLAYED_TRUTH=CONTROLLER_PUBLISHED_SNAPSHOT
```

---

## DO_NOT_REDESIGN

- **Verkstadsgolvet blir aldrig Git-exekutor, verifierare, attesterare eller promotion-authority.**
  Ingen shell-yta, ingen Git-yta, ingen force, ingen filredigering, ingen direkt attestation- eller
  promotion-skrivning.
- **SNAPSHOT_WINS.** Auktoritativa fält (task lifecycle-state, attestation, verdict, promotion,
  `current main`, DONE) renderas **endast** ur controller-publicerad snapshot. Live-tail får bara
  flytta transienta fasetiketter och skriva rader i eventströmmen. En task blir aldrig DONE av ett
  tail-event. Detta är svaret på både "två sanningar" och "falskt DONE vid disorder" — bygg inte om
  det till en klientfold.
- **UI:t slår aldrig upp `origin/main` själv.** `main <sha>` är controllerns bekräftade värde med
  tidsstämpel. Ingen GitHub-läsning mot `nortropic-system`.
- **Ordning läses ur `seq`, aldrig ur `ts`.** `ts` är wall-clock för människan. Förfluten tid ur
  `ts` är display-only och används aldrig till sortering eller liveness.
- **Dedup på `event_id`, inte på `seq`.**
- **Okänd `event_type` renderas rått och flyttar ingen state.** Backenden avvisar okända typer vid
  *skrivning* (S5); UI:t degraderar vid *läsning*. Det är inte samma regel och de motsäger inte
  varandra.
- **Exakt fem kommandoverb:** `intake.submit` · `run.start` · `run.pause_at_safe_boundary` ·
  `run.resume` · `inspect`. Typad payload. Aldrig en sträng som blir ett kommando.
- **`run.pause_at_safe_boundary` betyder backendens gräns: mellan tasks, aldrig mitt i ett försök.**
  Knappen heter "Pausa efter aktuell uppgift". Ingen egen tolkning.
- **Replayskydd i tre lager:** `command_id` som PK · `expires_at` (TTL) · `expected_watermark`.
  Controllern får alltid avvisa; UI:t visar avvisningen ordagrant.
- **Ingen optimistisk state-uppdatering.** Ett kommando ändrar ingenting i vyn förrän controllern
  agerat och det syns i en snapshot.
- **Kontrollplanet ligger i ett EGET Supabase-projekt**, inte i Leads-projektet. `service_role`
  kringgår RLS projektbrett — delat projekt vore en delad skrivrätt. Appens nyckel får **inte**
  vara `service_role`.
- **Maskinen bygger aldrig state ur `AUTOBYGG-LOG.md` eller terminalprosa.** `components/loop/**`
  importerar aldrig `PipelinePanel`, `ProcessGuide` eller `MetricsPanel`.
- **`/` rivs inte.** `ProcessGuide`, `PipelinePanel`, `MetricsPanel` står orörda. Promotion av
  Maskinen till startsida är ett senare, separat beslut.
- **Hellre `—` än fejkad data.** Ingen procentsats, ingen framstegsstapel, ingen animation utan
  faktisk signal. `NOT_RUN` renderas visuellt SKILT från `PASS`.
- **Statusvokabulären är backendens, inte uppdragets.** Elva tillstånd:
  `RAW PLANNING NEEDS_SPEC READY QUEUED WORKING VERIFYING REVIEWING MERGING DONE STOPPED`.
  `VERIFYING_SPEC`, `UPLOADED` och `ANALYZING` finns **inte** i backendkontraktet — de förra blir
  härledd underetikett, de senare lever i en egen `submission.*`-namnrymd som aldrig renderas som
  task state.
- **`NEEDS_SPEC` är ett arbetsläge i warning-färg, inte ett fel.**
- **Grindens kod, kontrollnamn och registret når aldrig DOM.** `grind_id` och `grind_sha256` visas;
  innehållet aldrig.
- **`/api/loop/**` läggs ALDRIG till i middleware-matcherns undantagslista**, och varje handler
  anropar `auth()` själv.

---

## VERIFY_BEFORE_CHANGE

Innan en rad ändras:

```bash
git rev-parse HEAD
git status --short
git diff --name-only main..HEAD
# noll VARIABLER — kommentarträffar i lib/places.ts, README, BYGGSPEC, db/LEADS-SETUP.md är OK
grep -rn "process\.env\.NEXT_PUBLIC_" app components lib auth*.ts next.config.ts
sed -n '14,20p' middleware.ts        # matcher-undantagen ska vara oförändrade
```

Läs dessutom, i sin helhet:

```text
docs/nortropic-control-room-plan-v1.md      (denna plans auktoritativa version)
VERKSTADSGOLVET-BYGGSPEC.md                 (invariant 1 — se STOP_CONDITIONS)
middleware.ts · auth.ts · auth.config.ts
lib/github-read.ts · lib/supabase.ts · lib/leads-worker.ts   (envelope- och kö-precedenten)
components/{ProcessGuide,PipelinePanel,MetricsPanel,Graceful}.tsx
app/globals.css                             (tokens + brytpunkter 960/720/600)
```

Och i backendrepot vid `0b3212c9`: `docs/loop/autonomous-loop-plan-v1.md` avsnitten
`EVENT_SCHEMA_PLAN`, `COMMAND_SCHEMA_PLAN`, `PROMOTION_PLAN`, `MERGE_RESOLUTION_PLAN`,
`MARKDOWN_INTAKE_PLAN`, samt S5, S10 och S13.

**Börja med en plan-vs-code-review.** Du får korrigera mindre plan/kod-konflikter **med bevis**.
Du får **inte** ändra de låsta värdena ovan.

**`npm install` behövs** — `node_modules` och lockfile saknas i repot. Det är en normal
utvecklingsåtgärd, men lockfilen ska då committas som en egen ändring, inte smygas in i en skiva.

---

## SLICE_ORDER

```text
V1   typade backendkontrakt / schemas + genererade fixturer     ← BÖRJA HÄR, inget beroende
V2   fixturbaserad Maskinen-shell (/loop, bakom LOOP_ENABLED)   inget beroende
V3   read model + SNAPSHOT_WINS                                  inget beroende
V4   live läsyta                                                 KRÄVER nortropic-system S5 + B3 + B8
V5   task inspector                                              KRÄVER S1, S4, S13
V6   merge-resolution-UX                                         KRÄVER S8 + B7   (sist i praktiken)
V7   smal kommandoyta                                            KRÄVER S13 + ÄGARBESLUT invariant 1
V8   Markdown-intake                                             KRÄVER S10 + B5
V9   realtid / reconnect / dedup                                 KRÄVER S5
V10  säkerhetshärdning                                           inget beroende
V11  responsivt + regressioner                                   inget beroende
```

**V1–V3 kan byggas i dag.** Allt därefter är blockerat på att motsvarande backendskiva finns och
är grön. En skiva får aldrig markeras klar mot en fixtur i stället för mot den verkliga kanalen.

---

## BLOCKERAT PÅ BACKENDEN — B1..B8

Dessa saknas i backendkontraktet vid `0b3212c9` och är **spec-radsfrågor i `nortropic-system`**,
inte något Verkstadsgolvet får lösa själv. Tills de finns renderas berörda fält `—`.

```text
B1  intake.*-eventfamilj saknas (S10 säger DEPENDS_ON S5, men familjelistan har ingen intake.*)
B2  liveness-/heartbeat-event saknas → "● AUTONOM" kan bara vara eventålder
B3  seq-monotonicitetens omfattning odefinierad (global vs per run_id)
B4  payload-kontrakt per event_type saknas → builder/modell, riskklass, budget, SHA:n odefinierade
B5  source_ref-upplösning för intake.submit odefinierad — var ligger källans bytes?
B6  tokens/kostnad finns inte som event eller snapshot-fält
B7  parent-identitet saknas i candidate.created → merge-UX kan inte visa parent(D)=C
B8  controller-publicerad read-model-snapshot krävs — hela SNAPSHOT_WINS vilar på den
```

---

## TESTS_REQUIRED

Husets form gäller: baslinje utan komponent (rött av rätt skäl) → ärlig referens som kastas före
commit → lögnstubbar med EN lögn var och förutsagd fällningskarta skriven FÖRE körning → hela
batteriet → körning i ägarens miljö före merge.

**Fixturregeln (viktigast i detta repo):** fixturer **genereras ur `lib/loop/schema.ts`**, aldrig
handskrivs. Ett prov ska fälla en handskriven fixtur som avviker från schemat. En grön grind mot en
fixtur utan den verkliga kanalens form bevisar ingenting.

De skarpaste negativa kontrollerna per skiva:

```text
V1  ts-baserad sortering som råkar ge rätt svar på testdata
V2  procentsats eller framstegsstapel någonstans i /loop-trädet (statiskt grep)
V3  tail-event som gör en task DONE utan snapshot
V4  appen skriver i loop_events · service_role-nyckel i Railway · UI som läser origin/main
V5  grindtext i DOM (markörsträng-prov) · NOT_RUN som ser grön ut
V6  B:s PASS renderad som D:s dom · konflikt som ser ut som human-stop
V7  payload med shell-sträng som skapar kanariefil · samma command_id utfört två gånger
V8  klientsidig rubrikparsning · sha256 beräknad i klienten och betrodd
V9  reconnect som tappar event · UI som påstår realtid när det pollar
V10 hemlighet i klientbundlen · /api/loop tillagd i matcher-undantag
V11 / renderar inte längre identiskt med PLAN_BASE_SHA · Leads brutet av delad CSS
```

Full matris (Auth · Events · States · Intake · Commands · Secrets · Regression) står i planens
`TEST_MATRIX`.

---

## COMMIT_PER_SLICE

En skiva = en gren `nortropic/kontrollrum-<id>` = en PR. Commit per delsteg. Stanna vid öppnad PR.
Planartefakter ligger på `plan/nortropic-control-room-v1` och blandas aldrig med kodskivor.

---

## STOP_CONDITIONS

Stanna och fråga ägaren när något av detta inträffar:

- **Invariant 1 i `VERKSTADSGOLVET-BYGGSPEC.md` säger "LÄS-ONLY. ALLTID. … ingen styrning."**
  V7 (kommandoytan) bryter mot den som den är skriven. `ÄGARBESLUT_INVARIANT_1` krävs **före V7**.
  V1–V6 rör den inte. Skriv inte om invarianten själv.
- **En backendskiva som en V-skiva beror på är inte byggd och grön.** Bygg inte "live" mot fixturer
  och kalla det klart.
- **B1–B8 dyker upp som ett behov mitt i en skiva.** Det är en spec-radsfråga i `nortropic-system`,
  inte något du löser i frontenden. Rendera `—` och rapportera.
- **En begränsad Supabase-DB-roll visar sig inte gå att skapa** och enda vägen blir `service_role`.
  Då är rätt svar en proxy hos controllerns S13-yta, inte att ge appen service_role. Fråga.
- **Backendplangrenen ligger på fel remote.** `Nortropic/verkstadsgolvet` bär i dag
  `origin/plan/autonomous-loop-v1` med hela `nortropic-system`-trädet, och den lokala klonen
  `~/nortropic/nortropic-system` har `origin = Nortropic/verkstadsgolvet`. **Ändra ingenting** —
  det är ägarhand.
- **`GITHUB_TOKEN_WRITE` är bred** (`Administration: R/W` på alla repon, enligt README). Maskinen
  ska aldrig röra den. Att smalna den är ett separat ägarärende.
- **Något frestar dig att låta UI:t verifiera, attestera, promovera eller lösa Git-refs.** Stopp.
- **Två misslyckade fixförsök på samma fel.**

---

## CODEX_START_HERE

**V1 · `lib/loop/schema.ts`.** Bygg typerna och runtime-valideringen ur backendens
`EVENT_SCHEMA_PLAN` (sexton familjer: `run.* task.* attempt.* workspace.* agent.* candidate.*
policy.* verification.* feedback.* evaluation.* attestation.* promotion.* merge.* main.* breaker.*
budget.*`) och `COMMAND_SCHEMA_PLAN` (fem verb).

Klart att bygga på, mätt vid `PLAN_BASE_SHA`:

- Envelope-mönstret finns redan och ska återanvändas: `{ok:true,data} | {ok:false,reason,message}`,
  alltid HTTP 200, graceful-läge i vyn (`lib/github-read.ts`, `lib/leads-data.ts`).
- Lazy/graceful klientform för server-only-transport finns i `lib/supabase.ts` — kopiera formen för
  `lib/loop/transport.ts`, men mot **det andra Supabase-projektet**.
- Kö-precedenten finns i `db/leads-sweep-schema.sql` + `lib/leads-worker.ts`: `status`-kolumn,
  unique-constraint för idempotent enqueue, claim → arbeta → rapportera, RLS på utan policies.
  Formen återanvänds för `loop_commands`; **kön delas aldrig med Leads**.
- Sessionsutgång hanteras redan rätt i `DocPanel.tsx` (icke-JSON/redirect → "Sessionen gick ut").
  Återanvänd exakt det mönstret i loop-klienterna.
- Designtokens finns i `app/globals.css` (`--bg-panel`, `--border`, `--brand: #d97757`, Fraunces,
  JetBrains Mono) och brytpunkterna 960/720/600 px. Lägg endast **additiva** regler.
- `Graceful.tsx` är den delade tomma-läge-rutan. Använd den; skriv ingen ny.

**Första provet att skriva, före kod:** ordningsprovet. Hundra event med bakåtgående `ts` ska ge
exakt samma läsordning som med stigande `ts`. Det fäller den vanligaste genvägen — att sortera på
tid — och det går att skriva innan en enda komponent finns.
