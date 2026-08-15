# Nortropic Factory Room — product ERRATUM 02 (V2)

## Document identity and correction vehicle

```text
ERRATUM_ID              = nortropic-factory-room-product-erratum-v2
ERRATUM_PATH            = docs/nortropic-factory-room-product-erratum-v2.md
CORRECTS                = docs/nortropic-factory-room-master-roadmap-v1.md (FROZEN — not edited)
EXTENDS                 = docs/nortropic-factory-room-roadmap-erratum-01.md (REMAINS VALID)
COMPANION_ADDENDUM      = docs/nortropic-factory-room-requirement-addendum-v3.md
                          (owner-authored requirement-completeness addendum V3, recorded verbatim;
                          authoritative over any conflicting omission in this erratum)
ALSO_UPDATED            = backlog/nortropic-factory-room-master-v1.json
                          docs/nortropic-factory-room-handoff-v1.md
OWNING_REPOSITORY       = Nortropic/verkstadsgolvet
MEASURED_AT             = 2026-08-15
FROZEN_ROADMAP_EDITED   = NO
HISTORICAL_REPORTS_EDITED = NO
CORRECTION_MECHANISM    = DEDICATED_ADDENDUM_DOCUMENT
```

The master roadmap's FREEZE SEMANTICS forbid rewriting the frozen requirements portion. This
erratum is therefore a correction vehicle, exactly like erratum-01: the frozen roadmap file and
every historical report under `docs/reports/**` are left byte-identical, and history is superseded
here rather than rewritten. Where this erratum and the frozen roadmap could be read as disagreeing
on the six subjects corrected below, **this erratum wins**; for everything else the frozen roadmap
stands unchanged. Erratum-01 remains valid in full and is not replaced — corrections 2 and 6 below
restate and bind two of its findings rather than superseding them.

`CLAUDE.md`, `docs/nortropic-control-room-plan-v1.md` and `docs/claude-operating-model-v1.md`
remain authoritative above this document. Nothing here weakens an authority boundary, an exit
criterion, a negative control or a security invariant. No slice is dropped, merged or softened.

Reading order for a session picking the programme up: `CLAUDE.md` →
`docs/nortropic-control-room-plan-v1.md` → `docs/claude-operating-model-v1.md` →
`docs/nortropic-factory-room-master-roadmap-v1.md` **together with**
`docs/nortropic-factory-room-roadmap-erratum-01.md`, **this erratum** and
`docs/nortropic-factory-room-requirement-addendum-v3.md` → the handoff → the ledger.

---

## CORRECTION 1 — SHOWROOM VISIBILITY

```text
PREVIOUS_MISINTERPRETATION_1 = The Factory Room could remain hidden until the live backend existed.
CORRECTED_DECISION_1 = The full product UX is visible in SHOWROOM mode now; backend availability
determines the source label, not route visibility.
```

```text
SHOWROOM_BEFORE_BACKEND_COMPLETE=YES
VISIBLE_PRODUCT_NOW=YES
PRODUCTION_VISIBILITY_REQUIRED=YES
BACKEND_MISSING_MEANS_SHOWROOM_NOT_HIDDEN=YES
BACKEND_MISSING_MEANS_FAKE_LIVE=NO
```

A missing backend is a *labelling* fact, not a *visibility* fact. The authenticated route renders,
and what it renders is marked as what it is. The inverse error is equally forbidden: showroom data
is never presented as live, never animated into implied liveness, and never counted as evidence.
This corrects a product rule only — authentication, `middleware.ts`, `app/api/loop/**` transport
gating and every trust invariant are untouched by it. `components/loop/flag.ts` survives as the
`/api/loop/**` transport gate; `lib/loop/room/mode.ts` owns the product mode.

---

## CORRECTION 2 — NORTROPIC TAG (restated from erratum-01 and bound here)

```text
PREVIOUS_MISINTERPRETATION_2 = Anthropic Claude Tag entitlement treated as the blocker for required
Slack remote operation.
CORRECTED_DECISION_2 = Nortropic builds its own Slack app/bot ("Nortropic Tag") above a
Nortropic-owned remote operator interface; Anthropic Claude Tag is an optional additional adapter.
```

```text
ANTHROPIC_CLAUDE_TAG_REQUIRED=NO
CLAUDE_TAG_TEAM_ENTERPRISE_ENTITLEMENT_IS_CORE_BLOCKER=NO
NORTROPIC_SLACK_APP_REQUIRED=YES
REMOTE_OPERATION_FROM_PHONE_REQUIRED=YES
DIRECT_SLACK_TO_MAIN=NO
```

Already recorded in erratum-01 §ERRATUM 1; restated here so that the V2 programme binds to it. The
slice keeps the id `REMOTE-01` (renaming a frozen id is itself forbidden) and is retitled
**"Nortropic Tag — own Slack app"**. Its fail-closed shell — client, own bot identity, request
signature and timestamp-freshness verification or authenticated Socket Mode, workspace/user/channel
allowlists, Slack event-id dedup, typed-intent adapter contract with translation tests, rejection
UX, message and notification design — depends on nothing and is buildable now. Only LIVE dispatch
depends on `REMOTE-00` (backend S13). A fake-transport slice is never described as live-complete.

---

## CORRECTION 3 — CONVERSATION AND CONTEXT ARE NOT DEFERRED

```text
PREVIOUS_MISINTERPRETATION_3 = Persistent context and conversational UX were deferred behind
REMOTE-00/S13.
CORRECTED_DECISION_3 = The complete room/conversation UX and a non-authoritative context foundation
may be built before live controller transport; live dispatch remains fail-closed.
```

The conversational room, typed-intention preview cards, room/conversation/thread/participant
identity and a durable but non-authoritative context store are frontend and service work whose
prerequisites are owned here. What S13 blocks is *dispatch*, and dispatch alone. Until it lands, a
composed intention is previewed, never sent: no optimistic success, no queued-looking state that no
controller has seen, no client-side fold presented as authority.

```text
ROOM_CONTEXT_IS_AUTHORITY=NO
MEMORY_IS_AUTHORITY=NO
SHOWROOM_FIXTURE_IS_AUTHORITY=NO
```

Stale memory always loses to the current snapshot: every canonical claim shown from context
resolves to a current snapshot or an evidence reference before it is displayed as fact.

---

## CORRECTION 4 — STANDING WORK IS A NORTROPIC CONTRACT, NOT A VENDOR FEATURE

```text
PREVIOUS_MISINTERPRETATION_4 = Claude Code Routines represented standing work itself.
CORRECTED_DECISION_4 = Nortropic owns a vendor-neutral standing-work and trigger contract;
Routines, Slack scheduling, the web UI and GitHub events are adapters to it.
```

Trigger classes, frozen as a closed set:

```text
schedule
controller_event
dependency_satisfied
github_event
operator_request
observer_condition
external_webhook
```

Binding rules:

- Standing work creates **proposals, typed intake sources or ordinary pipeline tasks** — never
  candidates, verdicts, attestations, promotions or mutations of authoritative main.
- The five intention verbs are **never** overloaded with schedule payloads. A schedule is not an
  `intake.submit` with a timestamp field.
- A **separate narrow management contract** (`standing_work.create / inspect / update / enable /
  disable / delete`, versioned independently of the five run/task intentions) is frozen **before**
  any live standing-work write path exists — see addendum-v3 §9 and slice `STANDING-MANAGEMENT-01`.
- An adapter's absence (for example the Claude Code Routines research-preview entitlement) blocks
  that adapter only, never the contract, the design, the gates or the other trigger classes.

---

## CORRECTION 5 — THE PRODUCT IS A WEBSITE FACTORY

```text
PREVIOUS_MISINTERPRETATION_5 = Factory Room output was primarily task/candidate output.
CORRECTED_DECISION_5 = The operator product is a WEBSITE FACTORY. Project/customer, build, quality
(visual/a11y/SEO/business-data/no-leak/domain), preview (URL/screenshots/age), release
(promotion/PR/merge/main/production SHA/URL) and after-release (smoke/health/monitoring) are
first-class output surfaces.
```

Tasks, candidates and verdicts remain true and remain visible — they stop being the *point*. The
operator's question is "what did the factory ship, is it good, is it live, is it healthy", and the
product answers it directly. Rules:

- Showroom scenarios demonstrate the **shape** of these surfaces; they are not evidence that any of
  them is wired to a live source.
- Unknown live fields render as an em dash `—`. Never zero, never a guess, never a placeholder that
  reads as data.
- Showroom preview URLs are **visibly synthetic** and can never be mistaken for a real deployment,
  and a preview is never presented as production (addendum-v3 §10).
- Website-factory states have no representation in the frozen loop snapshot contract today. They
  are carried by clearly-non-authoritative showroom view-model schemas in later slices — never by
  edits to `lib/loop/schema.ts`.

---

## CORRECTION 6 — MERGED IS NOT SHIPPED

```text
PREVIOUS_MISINTERPRETATION_6 = A merged code slice could be considered sufficient while the real
Railway product remained unverified.
CORRECTED_DECISION_6 = Production deployment SHA and visible production behaviour are required
empirical evidence for product activation slices; the connected Railway CLI is the verification
path.
```

Erratum-01 §ERRATUM 2 facts, restated (measured 2026-08-15 via Railway CLI 5.41.0; measured-at-date
facts, not live truth):

```text
project              verkstadsgolvet (27b6eb8a-e43e-41f3-a324-c06e83b0f56d)
environment          production (6866bf05-7148-4397-9844-11056838e3a9)
service              verkstadsgolvet (7ba0575d-5c74-4bde-a417-2d5f54ecb5de)
domain               verkstadsgolvet-production.up.railway.app
deploy mechanism     GitHub main auto-deploy (RAILPACK, reason=deploy) — the SINGLE deploy path;
                     railway up must NOT be used in parallel
latest deployment    f328ebee-f9f6-4bf0-9e76-281032735ddf SUCCESS
deployed commit      cb133c53e189a14255faefceaeb459cd21165d2c
environment variable LOOP_ENABLED=true present in the production environment
```

Consequence measured for this erratum: `cb133c53` **predates** the showroom-contract merge
`ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08` (SHREDDER-01A, PR #34). "It merged" is therefore not
"it is visible in production", and P1/P4 below are recorded accordingly. A product activation slice
is complete only when a CLI-verified deployed SHA at or after the slice's merge commit is recorded
together with an observed production URL and observed production behaviour.

---

## TRUST AND AUTHORITY INVARIANTS — UNCHANGED

Nothing in V2 or V3 moves an authority boundary. The full lock block:

```text
CONTROLLER_LOCAL_STATE=SOLE_AUTHORITY
SNAPSHOT_WINS=YES
EVENT_STREAM_IS_AUTHORITY=NO
SHOWROOM_FIXTURE_IS_AUTHORITY=NO
ROOM_CONTEXT_IS_AUTHORITY=NO
MEMORY_IS_AUTHORITY=NO
REMOTE_CLIENT_IS_AUTHORITY=NO
CLAUDE_ROLE_SEPARATION=WORKFLOW
CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO
MODEL_READY_IS_TRUST_VERDICT=NO
NORTROPIC_TRUST_AUTHORITY=NO
MASKINEN_GITHUB_CREDENTIAL=NONE
DIRECT_MODEL_TO_MAIN=NO
DIRECT_UI_TO_MAIN=NO
DIRECT_REMOTE_CLIENT_TO_MAIN=NO
DIRECT_SLACK_TO_MAIN=NO
DIRECT_NORTROPIC_STATE_MUTATION=NO
DIRECT_NORTROPIC_PROMOTION=NO
PROMOTION_FORCE_ALLOWED=NO
GENERIC_SHELL_FROM_UI=NO
GENERIC_GIT_FROM_UI=NO
GENERIC_COMMAND_STRING=NO
OPTIMISTIC_AUTHORITATIVE_STATE=NO
STANDING_WORK_WRITES_MAIN=NO
```

## THE FIVE CANONICAL INTENTION VERBS — UNCHANGED

```text
intake.submit
run.start
run.pause_at_safe_boundary
run.resume
inspect
```

No client, adapter, standing-work trigger, conversational surface or showroom scenario may invent a
sixth verb, overload one of the five with a schedule payload, or invent an alternative
command-status vocabulary. Command status stays `pending` / `claimed` / `applied` / `rejected` /
`expired`, owned by the controller, reported and never predicted.

## REGION-LEVEL SOURCE HONESTY MODEL

Source truth is a property of a **region**, not of a page and not of the whole app.

```text
per REGION, exactly one of:
  SHOWROOM     generated, schema-validated fixture data; no live source is attached
  LIVE         a live source answered and the region renders what it answered
  DEGRADED     a live source is attached but partial, stale or reduced; the reduction is stated
  UNAVAILABLE  the source could not be read; the region renders — and nothing is invented
```

Rules:

- Each region carries one compact badge (`SHOWROOM` / `LIVE` / `DEGRADED` / `OFFLINE` / `—`), never
  a paragraph of defensive prose on the primary surface.
- The full technical detail — source, watermark, age, reason, contract id — moves into disclosures
  and inspector layers. Honesty is never reduced; only its layout changes.
- A page never averages its regions into one global claim. A LIVE header above SHOWROOM content is
  a lie, and so is a SHOWROOM badge over live data.
- `UNAVAILABLE` renders `—`. Unknown or unavailable backend data is never invented.

## REQUIRED SHOWROOM SCENARIO COVERAGE

```text
EMPTY_FACTORY            INTAKE_SELECTED          PLANNING
NEEDS_SPEC               READY_QUEUE              WORKING
VERIFYING                REVIEWING                MERGE_CONFLICT
RESOLUTION_WORKING       PROMOTING                DONE
STOPPED                  PREVIEW_READY            DEPLOYING
POST_DEPLOY_SMOKE_FAILED PRODUCTION_HEALTHY
```

Measured against the current frozen loop contracts (`lib/loop/schema.ts`, `lib/loop/fixtures/**`, at
`ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08`):

```text
REACHABLE from the generated, schema-validated fixtures today:
    EMPTY_FACTORY        lib/loop/fixtures/snapshot-empty.json
    PLANNING, NEEDS_SPEC, READY_QUEUE (READY + QUEUED), WORKING, VERIFYING, REVIEWING, DONE,
    STOPPED              lib/loop/fixtures/snapshot.json carries one task in every one of the
                         eleven canonical TASK_LIFECYCLE states (RAW, PLANNING, NEEDS_SPEC, READY,
                         QUEUED, WORKING, VERIFYING, REVIEWING, MERGING, DONE, STOPPED)
    INTAKE_SELECTED      SUBMISSION_LIFECYCLE submission.selected — a UI-local namespace that is
                         never rendered as a task state

IMPOSSIBLE under the current frozen loop contracts — a showroom view-model schema is required:
    MERGE_CONFLICT       TaskView.merge is an opaque nullable map owned by backend S8 + B7 and is
                         null in every generated fixture; the merge.* event types exist but no
                         conflict payload contract does
    RESOLUTION_WORKING   same contract gap (merge.resolution.started / .completed carry no
                         projectable payload today)
    PROMOTING            the canonical lifecycle has MERGING, not PROMOTING; promotion authority is
                         a controller-side field the frontend cannot synthesise
    PREVIEW_READY, DEPLOYING, POST_DEPLOY_SMOKE_FAILED, PRODUCTION_HEALTHY
                         website-factory release states have no representation whatsoever in
                         LoopSnapshot
```

Binding rule for the impossible set: they are carried by **clearly-non-authoritative showroom
view-model schemas**, introduced in `SHOWROOM-SCENARIOS-01` / `WEBSITE-FACTORY-01` and separate from
the loop contract. **Never** by extending `lib/loop/schema.ts`, never by hand-authored data
masquerading as a snapshot, and never in a way that lets a showroom view-model reach a live render
path. Every scenario is selected server-side from a closed allowlist, must not look like a
controller command, and must not fetch.

## REQUIRED IMPLEMENTATION ORDER (V2)

```text
erratum (this document + addendum-v3)
  → SHREDDER-01 (01A merged; 01B next)
  → Railway production proof
  → CONVERSATION-01
  → ROOM-IDENTITY-01
  → CONTEXT-01A
  → WEBSITE-FACTORY-01
  → TELEMETRY-01
  → NORTROPIC-TAG-01 (REMOTE-01 shell)
  → STANDING-01
  → SUPERVISOR-02
  → live/backend slices
  → adapters
  → full remote proof
```

Addendum-v3 §15 extends this into the merged 25-step order that the handoff's `EXACT_NEXT_ACTION`
carries. Dependency-aware execution may reorder independent slices; it may not omit them, and no
security-sensitive write path is built before its frozen gate and authority prerequisites exist.
`SHOWROOM-SCENARIOS-01` runs alongside the website-factory step. `OWNER-ACTION-01` is deliberately
unordered: it is fail-closed until separately threat-modelled and frozen.

---

## PRODUCT REQUIREMENTS LEDGER P1–P34

The same 34 rows exist machine-readably in `backlog/nortropic-factory-room-master-v1.json` under the
additive top-level array `productRequirements`. Statuses use the roadmap's ledger vocabulary
(`NOT_STARTED`, `IN_PROGRESS`, `PROVEN`, `BLOCKED`, `DEFERRED_BY_OWNER`, `REJECTED_WITH_REASON`) and
never a percentage. Where a requirement has a display half and a live half, the split is carried by
`showroomEvidence` and `liveEvidence` — never collapsed into one false `PROVEN`.

Measurement basis: `git rev-parse origin/main` = `ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08` in this
run's worktree, 2026-08-15; `git diff --name-only` against the SHREDDER-01A merge parentage; and
the file contents of `lib/loop/**` at that commit. Nothing below is assumed from prose.

```text
P1  production-visible Kartongförstöraren
    status    IN_PROGRESS
    showroom  SHREDDER-01A (merge ac2ba4ea…, PR #34) removed the LOOP_ENABLED 404 product gate from
              app/(app)/loop/page.tsx and app/(app)/loop/mata/page.tsx; lib/loop/room/mode.ts
              resolves SHOWROOM fail-closed
    live      NONE at this measurement: the last CLI-verified deployed SHA is cb133c53…, which
              predates ac2ba4ea…; no production observation of /loop was made by this run
    blocker   none technical — an unperformed production measurement
    next      P4: re-verify with the Railway CLI (deployed SHA at or after ac2ba4ea…) and observe
              /loop in production

P2  showroom-first final UX
    status    IN_PROGRESS
    showroom  FactoryRoomMode contract, showroom label constants and the revised product-acceptance
              tests (tests/loop/showroom-contract.test.ts) landed with SHREDDER-01A
    live      n/a by design — showroom is a labelling mode, never a live claim
    blocker   none
    next      SHREDDER-01B (discoverability, composer dominance, prose diet), then CONVERSATION-01,
              WEBSITE-FACTORY-01 and SHOWROOM-SCENARIOS-01

P3  showroom-to-live source substitution map
    status    IN_PROGRESS
    showroom  one fail-closed resolver factoryRoomMode() with LIVE_MODE_IMPLEMENTED=false and one
              machine-readable data-room-mode attribute — a single substitution point, not many
    live      NONE — LIVE/DEGRADED become reachable only with the ROOM-05 cutover (backend S5+S13)
    blocker   the per-REGION source model (SHOWROOM/LIVE/DEGRADED/UNAVAILABLE) does not exist yet
    next      TELEMETRY-01 region model; ROOM-05 for the live half

P4  production Railway deployment proof
    status    NOT_STARTED
    showroom  n/a
    live      erratum-01 recorded project/environment/service/domain and deployment f328ebee… at
              SHA cb133c53…; that SHA predates the showroom product, so no proof exists for the
              current product
    blocker   the measurement is outside this model sandbox (no network route to Railway); it is
              not blocked by any missing capability
    next      supervisor/owner runs the Railway CLI outside the sandbox and records deployed SHA,
              observed production URL and observed behaviour

P5  own Nortropic Slack app
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   live install needs the owner ceremony (create the app, hold signing secret and bot
              token server-side, install, set allowlists); the fail-closed shell is NOT blocked
    next      NORTROPIC-TAG-01 (id REMOTE-01) fail-closed shell

P6  optional Anthropic Claude Tag adapter
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   OPTIONAL: Claude Tag public beta, Team/Enterprise only, org-Owner pairing, Routines
              enabled. Blocks no required deliverable (erratum-01)
    next      REMOTE-02 only if later desired; deliberately last

P7  shared room identity
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      ROOM-IDENTITY-01

P8  shared thread/conversation identity
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none for the model; Slack thread mapping needs the Nortropic Tag shell
    next      ROOM-IDENTITY-01, then SLACK-INBOX-01 for slack_thread_ts mapping

P9  participant and asked-by identity
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   authorization may only be claimed where mechanically enforced (IDENTITY-01/02);
              display labels are never identity evidence
    next      ROOM-IDENTITY-01 → PARTICIPANT-01

P10 operator correction memory
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      CONTEXT-01A (corrections are a first-class context class)

P11 durable context across sessions
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   storage architecture is an inventory-first architect decision, not a builder guess
    next      CONTEXT-01A; SESSION-01 for the session/workspace lifecycle it must survive

P12 context edit/delete/audit
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      CONTEXT-01A (edit/delete/audit/versioning) with DATA-GOVERNANCE-01 retention

P13 Nortropic standing-work contract
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none for the contract, design and gates
    next      STANDING-01; STANDING-MANAGEMENT-01 frozen before any live standing-work write

P14 event-driven wakeups
    status    NOT_STARTED
    showroom  none
    live      SUPERVISOR-01 closed measured recover/stale-run gaps only; no event-driven wakeup
              exists in scripts/claude-loop/** at this measurement
    blocker   none
    next      SUPERVISOR-02 — measured-gap only, no second scheduler, no second canonical backlog

P15 dependency-satisfied wakeups
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      SUPERVISOR-02 (dependency_satisfied trigger class, STANDING-01 contract)

P16 scheduled work
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none for the schedule trigger class; the Routines adapter is entitlement-blocked and
              that blocks the adapter only
    next      STANDING-01 schedule trigger class, then adapters

P17 GitHub/event-triggered work
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   credential path: product code under app/api/loop/** and lib/loop/** may never use
              GITHUB_TOKEN_WRITE or any generic GitHub write credential (CLAUDE.md hard rule);
              github_event intake is read/webhook-verify only
    next      STANDING-01 github_event trigger class

P18 website project output
    status    NOT_STARTED
    showroom  none — measured: SHREDDER-01A changed mode/label/route plumbing only; no
              project/customer surface exists in components/loop/**
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01

P19 preview URL and screenshots
    status    NOT_STARTED
    showroom  none; when built, showroom preview URLs must be visibly synthetic
    live      none
    blocker   none for the showroom shape; live preview identity needs the release read model
    next      WEBSITE-FACTORY-01 + SHOWROOM-SCENARIOS-01, then RELEASE-RECOVERY-01

P20 responsive/visual QA
    status    NOT_STARTED
    showroom  none — this is QA of the websites the factory ships, distinct from this repository's
              own visual review of its own UI
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface

P21 accessibility QA
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface

P22 SEO QA
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface

P23 business/contact-data QA
    status    NOT_STARTED
    showroom  none; showroom business data must be synthetic and clearly non-customer
              (addendum-v3 §11)
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface

P24 client-secret/leak QA
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface; adversarial coverage in HARDEN-01

P25 domain/config QA
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      WEBSITE-FACTORY-01 quality surface

P26 deployment state
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none for the projection; a rollback execution path is a separately frozen contract
    next      WEBSITE-FACTORY-01 then RELEASE-RECOVERY-01

P27 post-deploy smoke
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      RELEASE-RECOVERY-01 (POST_DEPLOY_SMOKE_FAILED is a first-class UI state)

P28 monitoring/maintenance state
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none
    next      RELEASE-RECOVERY-01 health/incident projection + PRODUCT-OPS-01 service health

P29 lease/generation/liveness operator projection
    status    NOT_STARTED
    showroom  none
    live      none — no controller-side lease/generation/heartbeat contract is readable here
    blocker   controller-side contract absent (backend chain); the fields render em dash until a
              real contract exists, and are never synthesised
    next      TELEMETRY-01 placeholders

P30 usage/tokens/cost/duration projection
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   no usage/budget contract is readable here; budget is an event family, not a read model
    next      TELEMETRY-01 placeholders rendered em dash

P31 blockers/failures/history projection
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   none for the projection shape
    next      TELEMETRY-01, then SEARCH-HISTORY-01 for the long-lived room

P32 production mobile operation
    status    IN_PROGRESS
    showroom  ROOM-08 (merge d2ea9d59…, PR #29) landed the responsive room browser-half with
              captured screenshots at 390x844
    live      NONE — live submit/command mobile proof stays blocked on backend S13, and no
              production observation on a real device has been recorded
    blocker   backend S13 for the live half; P4 for the production observation
    next      P4 production observation; ROOM-06/REMOTE-00 for live mobile commands

P33 Slack mobile operation
    status    NOT_STARTED
    showroom  none
    live      none
    blocker   owner Slack app ceremony (P5) for install; REMOTE-00/S13 for live dispatch
    next      NORTROPIC-TAG-01 shell, then the live half after REMOTE-00

P34 operator-to-command-to-run causal attribution
    status    IN_PROGRESS
    showroom  ROOM-03 (merge 087ca660…, PR #26) landed the fixture-side causal chain
              command → run → task → evidence in lib/loop/room/causality.ts
    live      NONE — the live event/evidence half is blocked on backend S5 + S13
    blocker   the operator leg is missing entirely: asked_by/participant/client_kind and remote
              command ids do not exist yet
    next      ROOM-IDENTITY-01 + PARTICIPANT-01 for the operator leg, NORTROPIC-TAG-01 for remote
              command ids, then the live half
```

---

## LEDGER SLICES ADDED OR CHANGED BY THIS ERRATUM

Added by V2 (all `NOT_STARTED` unless measured otherwise):

```text
SHREDDER-01A            showroom visibility contract + FACTORY_ROOM_MODE      PROVEN (measured)
SHREDDER-01B            discoverable, polished showroom exposure              NOT_STARTED (measured)
CONVERSATION-01         conversational showroom room-timeline interaction     deps SHREDDER-01B
ROOM-IDENTITY-01        room/conversation/thread/participant identity model   deps CONVERSATION-01
CONTEXT-01A             durable non-authoritative context foundation          deps ROOM-IDENTITY-01
WEBSITE-FACTORY-01      showroom website-factory output surfaces              deps SHREDDER-01B
TELEMETRY-01            complete operator read-model surface                  deps WEBSITE-FACTORY-01
SHOWROOM-SCENARIOS-01   the scenario coverage list above                      deps SHREDDER-01B
STANDING-01             vendor-neutral standing-work and trigger contract     deps none
SUPERVISOR-02           event-driven + dependency wakeups (measured gaps)     deps SUPERVISOR-01
REMOTE-01               RETITLED "Nortropic Tag — own Slack app"              id unchanged
CONTEXT-01              superseded-by note → CONTEXT-01A chain (not deleted)
```

Added by addendum-v3 (all `NOT_STARTED`):

```text
SESSION-01              session/workspace lifecycle projection      (§1)  deps ROOM-IDENTITY-01
PARTICIPANT-01          shared room, multi-participant steering     (§2)  deps ROOM-IDENTITY-01
OPERATOR-PROTOCOL-01    one versioned remote operator protocol      (§6)  deps CONTEXT-01A
SLACK-INBOX-01          real remote source intake                   (§7)  deps REMOTE-01
NOTIFICATION-01         delivery, acknowledgement, resolution       (§8)  deps SUPERVISOR-02
STANDING-MANAGEMENT-01  narrow standing-work management contract    (§9)  deps STANDING-01
RELEASE-RECOVERY-01     release, incident and rollback projection   (§10) deps WEBSITE-FACTORY-01
DATA-GOVERNANCE-01      showroom, context and audit data governance (§11) deps CONTEXT-01A
OWNER-ACTION-01         remote attention is not remote authority    (§12) fail-closed, no deps
PRODUCT-OPS-01          operate Verkstadsgolvet and Nortropic Tag   (§13) deps REMOTE-01 shell
SEARCH-HISTORY-01       operable long-lived room search/history     (§14) deps CONTEXT-01A
```

Retitled or extended by addendum-v3, ids unchanged (renaming a frozen id is forbidden):

```text
IDENTITY-03  → titled "CREDENTIAL-PROXY-01 (Nortropic Credential Proxy)"; goal updated per §5
IDENTITY-02  → goal extended with room-scoped capability binding per §4
IDENTITY-01/02/03 remain REQUIRED — §3's re-affirmation is recorded in their evidence arrays
```

## CORRECTIONS APPLIED BY THIS ERRATUM

```text
backlog/nortropic-factory-room-master-v1.json
    additive top-level "productRequirements" array with P1..P34
    21 new slices (10 from V2 incl. SHREDDER-01A/B, 11 from addendum-v3)
    REMOTE-01 retitled "Nortropic Tag — own Slack app" (id unchanged)
    IDENTITY-02 goal extended, IDENTITY-03 titled CREDENTIAL-PROXY-01, §3 re-affirmation recorded
    CONTEXT-01 marked superseded-by CONTEXT-01A chain with a note — NOT deleted, status unchanged
    errata array and errataNote extended; measuredMain re-measured

docs/nortropic-factory-room-handoff-v1.md
    authority reading list extended with this erratum and addendum-v3
    CURRENT_AUTHORITATIVE_MAIN re-measured; nortropic-system value updated
    EXACT_NEXT_ACTION replaced by the merged V2+V3 25-step order
    LOCKED_INVARIANTS extended with the V2 lock block
    ROADMAP_COVERAGE_COMPLETE recorded per addendum-v3 §17

docs/nortropic-factory-room-requirement-addendum-v3.md
    NEW — verbatim owner text, byte-identical to its source

docs/nortropic-factory-room-master-roadmap-v1.md
    NOT TOUCHED. Frozen. This erratum is the correction vehicle.

docs/nortropic-factory-room-roadmap-erratum-01.md
    NOT TOUCHED. Still valid. Extended, never replaced.

docs/reports/**
    NOT TOUCHED. History is superseded here, never rewritten.
```
