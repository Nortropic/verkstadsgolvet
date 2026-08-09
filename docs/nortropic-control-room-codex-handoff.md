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
MASKINEN_GITHUB_CREDENTIAL=NONE
SUPABASE_ROLE=TRANSPORT_PROJECTION_QUEUE_ONLY
DISPLAYED_TRUTH=CONTROLLER_PUBLISHED_SNAPSHOT
```

## ÄGARBESLUT — LÅSTA I REVISION 2

```text
VERKSTADSGOLVET_CONTROL_MODEL=READ_OBSERVE_PLUS_NARROW_TYPED_INTENTS
CONTROLLER_LOCAL_STATE=SOLE_AUTHORITY
INVARIANT_1_OWNER_DECISION=LOCKED

B1_OWNER=S5+S10                 submission.*-familj, ALDRIG task lifecycle-state
B2_OWNER=S3+S5                  liveness endast observerbarhet, ALDRIG lease-authority
B3  EVENT_SEQ_SCOPE=GLOBAL_PER_OPERATIONS_EVENT_STORE
    EVENT_SEQ_RESETS_PER_RUN=NO
B4_OWNER=S5                     canonical payload-kontrakt PER event_type, versionsbundet
B5_OWNER=S10+S13                source_ref opak; CONTROLLERN hashar om och kräver match
B6_STATUS=DEFERRED_NON_BLOCKING UI_VALUE=—
B7_OWNER=S5+S8                  candidate_sha + parent_sha i candidate.created
B8_OWNER=S13                    SNAPSHOT_WINS=YES · EVENT_STREAM_IS_AUTHORITY=NO

BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13 = FORMULERAT, EJ BYGGT vid 0b3212c9
REMOTE_INCIDENT_STATUS = RESOLVED (ägarmätt)
```

---

## DO_NOT_REDESIGN

- **Kontrollmodellen är `READ_OBSERVE_PLUS_NARROW_TYPED_INTENTS`, och den är LÅST.** Den gamla
  invarianten "LÄS-ONLY. ALLTID." i `VERKSTADSGOLVET-BYGGSPEC.md` är avsiktligt överspelad för
  Maskinen genom ägarbeslut. Det är **inte** generell styrning. Verkstadsgolvet får ALDRIG direkt:
  mutera controller-authoritative state · exekvera shell · exekvera generisk Git · skriva eller
  flytta Git refs · verifiera kandidater · skriva verdict · skriva attestation · promovera main ·
  manipulera lease · manipulera breaker · redigera godtyckliga filer.
- **Ett command är endast en intention.** Controllern validerar och får alltid avvisa. Ingen
  UI-state ändras optimistiskt före controllerbekräftelse.
- **Maskinen använder INGEN GitHub-credential alls.** GitHub read-token-principen vidgas inte, och
  `GITHUB_TOKEN_WRITE` får aldrig återanvändas som Maskinens credential. Ingen fil under
  `app/api/loop/**` eller `lib/loop/**` importerar `lib/github-read.ts` eller `lib/github-write.ts`.
- **Verkstadsgolvet blir aldrig Git-exekutor, verifierare, attesterare eller promotion-authority.**
  Ingen shell-yta, ingen Git-yta, ingen force, ingen filredigering, ingen direkt attestation- eller
  promotion-skrivning.
- **SNAPSHOT_WINS · EVENT_STREAM_IS_AUTHORITY=NO.** Auktoritativa fält (task lifecycle-state,
  attestation, verdict, promotion, `current main`, DONE) renderas **endast** ur en
  controller-**genererad** snapshot ur controllerns authoritative lokala stores — inte ur en fold
  av eventströmmen, varken hos controllern eller hos UI:t. Live-tail får bara flytta transienta
  fasetiketter och skriva rader i strömmen. Ett event-tail gör aldrig ensamt en task `DONE`,
  `ATTESTED`, `PROMOTED` eller `MAIN_ADVANCED`. Divergens mellan snapshot och tail får
  **observeras och loggas** men aldrig ändra ett controllerbeslut. Bygg inte om detta till en
  klientfold.
- **UI:t slår aldrig upp `origin/main` själv.** `main <sha>` är controllerns bekräftade värde med
  tidsstämpel. Ingen GitHub-läsning mot `nortropic-system`.
- **Ordning läses ur `seq` ensamt, aldrig ur `ts`.** `seq` är **globalt monoton i
  operations-eventbutiken** (`EVENT_SEQ_RESETS_PER_RUN=NO`). `run_id` grupperar men är ingen
  ordering authority. `ts` är wall-clock för människan; förfluten tid ur `ts` är display-only och
  används aldrig till sortering eller liveness.
- **Gap-detektion sker ENDAST på den ofiltrerade butiksströmmen.** En vy filtrerad på `run_id`
  eller `task_id` har legitima hopp i `seq` — andra runs event ligger emellan. Filtrerade vyer
  gap-detekterar aldrig. Reconnect-markören är butiksglobal, inte per run.
- **Dedup på `event_id`, inte på `seq`.** Unikhetsindex ligger på `seq` globalt.
- **Liveness är endast observerbarhet.** Härled aldrig lease- eller ownershipstatus ur ett
  heartbeat-event.
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
V4   live läsyta                                                 KRÄVER S5 (B3,B4) + S13 (B8)
V5   task inspector                                              KRÄVER S1, S4, S13
V6   merge-resolution-UX                                         KRÄVER S8 + B7   (sist i praktiken)
V7   smal kommandoyta                                            KRÄVER S13 BYGGD OCH VERIFIERAD
                                                                 (ägarbeslut invariant 1 = LOCKED,
                                                                  inte längre en blockerare)
V8   Markdown-intake                                             KRÄVER S10 + S13 (B5)
V9   realtid / reconnect / dedup                                 KRÄVER S5
V10  säkerhetshärdning                                           inget beroende
V11  responsivt + regressioner                                   inget beroende
```

**V1–V3 kan byggas i dag.** Allt därefter är blockerat på att motsvarande backendskiva finns och
är grön. En skiva får aldrig markeras klar mot en fixtur i stället för mot den verkliga kanalen.

---

## B1..B8 — MAPPADE AV ÄGAREN, INGET BYGGT

Ägarskapet är **låst**. Koden finns **inte** vid `0b3212c9`. Detta är spec-radsfrågor i
`nortropic-system` — inte något Verkstadsgolvet får lösa själv. Tills de är byggda renderas
berörda fält `—`, och ingen skiva får kallas klar mot ett mappat men obyggt kontrakt.

```text
B1  S5+S10   separat submission.*-familj. INTE task lifecycle-state.
             UPLOADED/ANALYZING låtsas aldrig vara task-state.
B2  S3+S5    S3 äger lease-heartbeaten. S5 exponerar den observerande (t.ex. run.heartbeat).
             ENDAST observerbarhet — aldrig lease-authority, aldrig ownership-beslut.
B3  S5       EVENT_SEQ_SCOPE=GLOBAL_PER_OPERATIONS_EVENT_STORE
             EVENT_SEQ_RESETS_PER_RUN=NO   (run_id grupperar, ordnar inte)
B4  S5       versionsbundet canonical payload-kontrakt PER event_type.
             "payload": {} räcker INTE som frontendkontrakt.
             schema.ts pinnas mot kontraktets identitet — hitta aldrig på fält.
B5  S10+S13  source_ref är en OPAK transportreferens. Controllern resolvar, läser bytes,
             beräknar SJÄLV SHA-256, kräver match mot source_sha256, skapar S10:s immutabla
             source snapshot, och startar planner/intake FÖRST därefter.
             Railway-/Supabase-hash är ALDRIG ensam trust-anchor.
             Transportens form bestäms i S10/S13 — uppfinn den inte i frontenden.
B6  —        DEFERRED_NON_BLOCKING. UI_VALUE=—. Ingen ny backend-slice nu. Blockerar inget.
B7  S5+S8    candidate.created bär candidate_sha + parent_sha (eller exakt motsvarande).
             S8 måste bevisa candidate=D, parent_sha=C.
             UI härleder ALDRIG parentskap från GitHub. D ärver aldrig B:s verdict.
B8  S13      se BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13 nedan.
```

## BACKEND_CROSS_PLAN_REQUIREMENT_FOR_S13

```text
BACKEND_S13_EVENT_FOLD_CONFLICT = JA
```

Backendens S13-kriterium säger i dag *"Läsytan svarar ur eventströmmen och kan inte skriva."* Det
får **INTE** tolkas som att authoritative task-state rekonstrueras genom **event-fold**.

S13 måste när den byggs producera en **versionerad, controller-genererad read-model snapshot ur
controller-authoritative lokala stores**, som minst semantiskt bär:

```text
task lifecycle state · verdict/verification identity · attestation · promotion state
authoritative current main · DONE/completion · breaker/budget där authoritative
snapshot schema/version · event watermark / last included seq
```

Eventströmmen används parallellt till **live activity · transient phase display · event inspector
· evidence references · reconnect/backfill** — och till ingenting annat. Ett event-tail får aldrig
ensamt göra en task `DONE`, `ATTESTED`, `PROMOTED` eller `MAIN_ADVANCED`. Vid motsägelse:
`SNAPSHOT_WINS`. Divergensen får observeras och loggas, men aldrig ändra ett controllerbeslut.

```text
STATUS = FORMULERAT, EJ BYGGT vid 0b3212c991d4227c8df2656465ae2c0252dda39e
```

Beskriv det aldrig som implementerat.

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
V4  appen skriver i loop_events · service_role-nyckel i Railway · UI som läser origin/main ·
    authoritative state rekonstruerat genom event-fold · falsklarm om "lucka" i en
    run-filtrerad vy (B3: legitima seq-hopp)
V5  grindtext i DOM (markörsträng-prov) · NOT_RUN som ser grön ut
V6  B:s PASS renderad som D:s dom · konflikt som ser ut som human-stop · parentskap härlett
    från GitHub i stället för ur parent_sha
V7  payload med shell-sträng som skapar kanariefil · samma command_id utfört två gånger ·
    kodväg mot lease, breaker, Git-refs, verdict, attestation eller promotion ·
    import av lib/github-*.ts under app/api/loop/** eller lib/loop/**
V8  klientsidig rubrikparsning · sha256 beräknad i klienten och betrodd ·
    Railway-/Supabase-hash behandlad som trust-anchor · manipulerad transportbyte som
    ändå accepteras av controllern
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

- **`VERKSTADSGOLVET-BYGGSPEC.md` rad 11 bär fortfarande den GAMLA texten** ("LÄS-ONLY. ALLTID.").
  Den är ersatt av ägarbeslut (`INVARIANT_1_OWNER_DECISION=LOCKED`), men filen är inte uppdaterad.
  **Skriv inte om BYGGSPEC själv** — det är ägarhand. Läser du de två texterna som motstridiga:
  planens `VERKSTADSGOLVET_CONTROL_MODEL` gäller.
- **V7 är fortfarande blockerad tills S13 är byggd OCH verifierad.** Ägarbeslutet tog bort
  styrningsfrågan, inte beroendet. En kommandokö utan byggd claimer är en kö utan mottagare.
- **En backendskiva som en V-skiva beror på är inte byggd och grön.** Bygg inte "live" mot fixturer
  och kalla det klart. B1–B8 är **mappade men obyggda** — mappning är inte implementation.
- **Något i B1–B8 behöver en form som inte är låst.** Det är en spec-radsfråga i `nortropic-system`,
  inte något du löser i frontenden. Rendera `—` och rapportera. Uppfinn särskilt aldrig
  intake-transporten (B5) eller payloadfält (B4).
- **En begränsad Supabase-DB-roll visar sig inte gå att skapa** och enda vägen blir `service_role`.
  Då är rätt svar en proxy hos controllerns S13-yta, inte att ge appen service_role. Fråga.
- **`GITHUB_TOKEN_WRITE` är bred** (`Administration: R/W` på alla repon, enligt README). Maskinen
  ska aldrig röra den — och ska över huvud taget inte ha någon GitHub-credential. Att smalna
  token är ett separat ägarärende som inte blockerar någon skiva.
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

**Andra provet, direkt efter:** B3-provet. En butiksström där två runs interfolierar
(`seq` 1,2,3,4,5,6 fördelade på run A och run B) ska ge (a) korrekt global ordning, (b) **noll**
gap-larm i den run-filtrerade vyn, och (c) gap-larm när ett `seq` faktiskt saknas i den
ofiltrerade strömmen. Det provet fäller den näst vanligaste genvägen — att gap-detektera på en
filtrerad ström — och den genvägen såg helt rimlig ut i revision 1 av denna plan.
