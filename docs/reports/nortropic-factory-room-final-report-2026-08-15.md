# NORTROPIC FACTORY ROOM — FINAL AUTONOMOUS BUILD REPORT

REPORT_DATE=2026-08-15
OPERATING_MODE=AUTONOMOUS
TERMINAL_REASON=B — no unblocked eligible task remains: every remaining roadmap slice is blocked on the nortropic-system backend chain (S5/S10/S13 UNFROZEN at its origin/main 32b6e07; next backend step h-031 undefined on main), on control-plane environment work owned by the backend's own operating model, or on external entitlements (Claude Tag requires a Team/Enterprise claude.ai org).

## Canonical roadmap

MASTER_ROADMAP_PATH=docs/nortropic-factory-room-master-roadmap-v1.md
MASTER_ROADMAP_COMMIT=31f20835d7cb6d143609b8174dc04e1ae321b0d6 (merge of PR #23)
HANDOFF_PATH=docs/nortropic-factory-room-handoff-v1.md
BACKLOG_PATH=backlog/nortropic-factory-room-master-v1.json
ROADMAP_REQUIREMENT_COUNT=24 slices; 68 adopted source-requirement ledger items (measured: A1-A11, B1-B8, C1-C11, D1-D13, E1-E11, F1-F14 in the roadmap's source-coverage ledger)
UNCLASSIFIED_LEDGER_ITEMS=0

## Authoritative repository state

VERKSTADSGOLVET_MAIN=be624ad6610dba12fa47c6a2515b87499600efe4 (merge of PR #31)
NORTROPIC_SYSTEM_MAIN=32b6e076f96d095d32bb7bf9e6c2519632af80a1 (h-032 merge; measured 2026-08-14, not modified by this programme)
OPEN_PULL_REQUESTS=0 from this programme (all created PRs merged through guarded publication)
ACTIVE_FACTORY_RUNS=0
STALE_FACTORY_RUNS=preserved as evidence, all non-schedulable: ux-advisory-sweep-v1-20260814064509 (BLOCKED, external base drift), master-00_roadmap_freeze-20260814111538 (operator-stopped first attempt), room-08_mobile_room-20260814181216 / -20260814221227 / -20260815000407 (superseded ROOM-08 attempts), ux-advisory-sweep-delta-20260814153245 (BLOCKED, architect max-turns; superseded by the session-side U1–U14 measurement and UX-SWEEP-RESIDUALS; see blocked/superseded table)

## Completed slices

SLICE_ID=MASTER-00_ROADMAP_FREEZE
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN
BASE_SHA=4e5e796506599f36d124248652014061f7d3985d
CANDIDATE_SHA=fc76bf5043834c8b39c0830405d91ca19a4a59b1
MERGE_SHA=31f20835d7cb6d143609b8174dc04e1ae321b0d6
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/23
CHANGED_FILES=3 (roadmap 1148 lines, handoff 146, machine backlog 973; +2267 insertions)
TEST_COMMANDS=node -e JSON.parse(backlog) ; npx tsc --noEmit ; npm run claude:test
TEST_EXIT_CODES=0;0;0 (rounds 0–1)
DECISIVE_TEST_OUTPUT=gates.passed round=1 failures=0
SCREENSHOT_PATHS=n/a (documentation slice)
VIEWPORTS=n/a
REVIEWER_RESULT=round 0: 5 actionable (incl. a measured-count error 21-vs-20 test files) → remediated; round 1: READY, note advisories only
VISUAL_REVIEWER_RESULT=n/a
EMPIRICAL_RESULT=three canonical artifacts published and frozen; requirements portion locked
EVIDENCE_PATHS=.git/claude-factory/runs/master-00_roadmap_freeze-20260814115054/

SLICE_ID=ROOM-01_FACTORY_ROOM_SHELL
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN
BASE_SHA=31f20835d7cb6d143609b8174dc04e1ae321b0d6
CANDIDATE_SHA=7eda019bc4a9581eed993404c4a36dae8e8974bf
MERGE_SHA=4701f1c0a46f25e114637efa556fe80411de412e
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/24
CHANGED_FILES=15 (components/loop/room/** ×9 (8 components + ui.ts), lib/loop/room/** ×4, MaskinShell.tsx, tests/loop/room-shell.test.ts; app/(app)/loop/page.tsx untouched)
TEST_COMMANDS=npx tsc --noEmit ; npm run build ; npm run loop:test ; npm run claude:test
TEST_EXIT_CODES=0;0;0;0 every round (0–7)
DECISIVE_TEST_OUTPUT=gates.passed round=7 failures=0; all frozen v2/v10 suites green with the room mounted
SCREENSHOT_PATHS=.claude-loop/evidence/room-01_factory_room_shell-20260814122919/round-7/{desktop-1440x1000,tablet-900x1000,mobile-390x844}.png (run worktree)
VIEWPORTS=1440x1000, 900x1000, 390x844 (authenticated loopback)
REVIEWER_RESULT=8 rounds; caught i.a. a tautological base-comparison in a negative control, a LOOP_CSS responsive leak, and an unconditional "allt ur snapshot" honesty defect in fixture mode; final round READY with note advisories only
VISUAL_REVIEWER_RESULT=caught narrative-axis reversal at ≤959px and stage-void imbalance; final round READY (room-not-dashboard criterion met)
EMPIRICAL_RESULT=/loop renders the Factory Room from the validated fixture; all 20 mechanical exit criteria covered by gates + room-shell tests + screenshots; owner corrections (separate identity fields, segmented timeline, one tail connection, option-A command log, ROOM_CSS separation, BEHÖVER UPPMÄRKSAMHET vs ÄGARÅTGÄRD KRÄVS) implemented and test-locked
EVIDENCE_PATHS=.git/claude-factory/runs/room-01_factory_room_shell-20260814122919/

SLICE_ID=STATUS-01_AFTER_ROOM01 (programme bookkeeping)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN
BASE_SHA=4701f1c0a46f25e114637efa556fe80411de412e
CANDIDATE_SHA=6ee9cb2a82e271ce2af46208dde6a133ca9ed0db
MERGE_SHA=bbf945fb21e983cca1c2d1cc6d375ec3b9e8af9a
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/25
CHANGED_FILES=2 (handoff, machine backlog)
TEST_COMMANDS=node -e JSON.parse(backlog)
TEST_EXIT_CODES=0
DECISIVE_TEST_OUTPUT=gates.passed round=0
REVIEWER_RESULT=READY round 0, note advisories only
VISUAL_REVIEWER_RESULT=n/a
EMPIRICAL_RESULT=handoff/ledger reflect published state only
EVIDENCE_PATHS=.git/claude-factory/runs/ (status-01 run)

SLICE_ID=ROOM-03_CAUSAL_TIMELINE (fixture-side)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN (fixture-side; live chain BLOCKED on backend S5+S13 — never claimed live)
BASE_SHA=bbf945fb21e983cca1c2d1cc6d375ec3b9e8af9a
CANDIDATE_SHA=89558802283dc19be802bed2ff11c31afab098e0
MERGE_SHA=087ca6604b34f77ac78058f76f72fba1c5a1ac8b
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/26
CHANGED_FILES=6 (lib/loop/room/causality.ts, components/loop/room/CausalChain.tsx, tests/loop/room-causality.test.ts, room mounts)
TEST_COMMANDS=npx tsc --noEmit ; npm run build ; npm run loop:test ; npm run claude:test
TEST_EXIT_CODES=0;0;0;0 (rounds 2–6)
DECISIVE_TEST_OUTPUT=gates.passed round=6 failures=0
SCREENSHOT_PATHS=.claude-loop/evidence/room-03_causal_timeline-20260814154026/round-6/ (3 viewports)
VIEWPORTS=1440x1000, 900x1000, 390x844
REVIEWER_RESULT=caught orphan-binding to absent hops and non-identity fields in the id surface; final round READY, advisories only
VISUAL_REVIEWER_RESULT=READY round 6, advisories only
EMPIRICAL_RESULT=every rendered chain link carried by an actual identifier; absent hops (agent session, review — no schema identity exists) render honestly as "—"; raw JSON disclosure at every hop; ordering by semantic chain + seq, never wall-clock
EVIDENCE_PATHS=.git/claude-factory/runs/room-03_causal_timeline-20260814154026/

SLICE_ID=UX-SWEEP-RESIDUALS (operational debt closure)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN — with this, the superseded UX-ADVISORY-SWEEP-V1 debt is fully closed: 12 of 14 items landed via PR #21/#22 (measured per-item with file:line evidence), 2 residuals via this slice
BASE_SHA=087ca6604b34f77ac78058f76f72fba1c5a1ac8b
CANDIDATE_SHA=af5647e1d064a11f7b574b300bc165099c50911a
MERGE_SHA=5ab394f3eee2e25df5d112d21e77cea0fbb959f8
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/27
CHANGED_FILES=4 (EventStream.tsx digit grouping, PhaseRail.tsx + RunStatusBar.tsx stale stream prose, tests/loop/ux-sweep-residuals.test.ts)
TEST_COMMANDS=npx tsc --noEmit ; npm run build ; npm run loop:test ; npm run claude:test
TEST_EXIT_CODES=0;0;0;0 (round 0)
DECISIVE_TEST_OUTPUT=single-round green
REVIEWER_RESULT=READY round 0, advisories only
VISUAL_REVIEWER_RESULT=READY round 0, advisories only
EMPIRICAL_RESULT=U1–U14 measurement table produced (12 MET_ON_MAIN with locks, 2 residuals fixed+locked); blocked candidate d20238bc… preserved as evidence only
EVIDENCE_PATHS=.git/claude-factory/runs/ux-sweep-residuals-20260814174825/ ; U-measurement in programme evidence trail

SLICE_ID=FACTORY-VISUAL-CAPTURE-V1 (workflow infrastructure)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet (Claude Factory)
STATUS=PROVEN
BASE_SHA=5ab394f3eee2e25df5d112d21e77cea0fbb959f8
CANDIDATE_SHA=64695be26b683c0875deebe1b29f75ef9f068568
MERGE_SHA=cdb638e9875410ad2d53617b3596c3e58ecca617
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/28
CHANGED_FILES=5 (visual-review.ts, schemas.ts additive VisualCaptureStateSchema, supervisor wiring, hermetic tests, runbook)
TEST_COMMANDS=npm run claude:test ; cli selftest ; npx tsc --noEmit ; npm run build
TEST_EXIT_CODES=0;0;0;0 (round 0)
DECISIVE_TEST_OUTPUT=single-round green; legacy tasks byte-compatible
REVIEWER_RESULT=READY round 0, advisories only
VISUAL_REVIEWER_RESULT=n/a (infrastructure)
EMPIRICAL_RESULT=proven in production by ROOM-08 r4: 24 evidence PNGs across 4 declared capture states × 3 viewports × {fullPage, clip}; loopback policy enforced per navigated URL
EVIDENCE_PATHS=.git/claude-factory/runs/factory-visual-capture-v1-20260814214556/

SLICE_ID=ROOM-08_MOBILE_ROOM (browser-half of remote operation)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN (browser-half; live submit/command mobile proof BLOCKED on backend S13 — the closed command channel's verbatim reason is what mobile shows, honestly)
BASE_SHA=cdb638e9875410ad2d53617b3596c3e58ecca617
CANDIDATE_SHA=e37a2cee207008d50b7a42866b1f4fd1e79e1107
MERGE_SHA=d2ea9d59f7724242b095116a3fd30d59f698aa2c
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/29
CHANGED_FILES=7 (room components + ROOM_CSS + tests/loop/room-mobile.test.ts)
TEST_COMMANDS=npx tsc --noEmit ; npm run build ; npm run loop:test ; npm run claude:test
TEST_EXIT_CODES=0;0;0;0 (final run rounds 0–1)
DECISIVE_TEST_OUTPUT=gates.passed round=1 failures=0
SCREENSHOT_PATHS=.claude-loop/evidence/room-08_mobile_room-20260815004053/round-1/ — 24 PNGs: {base,evidence-open,focus-parked,mata} × {desktop-1440x1000,tablet-900x1000,mobile-390x844} × {fullPage,-clip}
VIEWPORTS=1440x1000, 900x1000, 390x844; capture states: evidence-open (all disclosures opened + scrolled into frame), focus-parked (keyboard focus parked), mata (/loop/mata)
REVIEWER_RESULT=READY final round, advisories only (incl. deliberate cross-slice tripwires documented in-file)
VISUAL_REVIEWER_RESULT=READY final round, advisories only: evidence surfaces reachable at all widths, no page-level horizontal scroll, no colour-only distinction, focus visible, ≥38px touch targets at all widths
EMPIRICAL_RESULT=mobile pass proven by framed captures: read status → open task → open raw JSON evidence → reach intake entry → see the command deck's honest disabled reason; three superseded attempts preserved (see blocked table)
EVIDENCE_PATHS=.git/claude-factory/runs/room-08_mobile_room-20260815004053/

SLICE_ID=SUPERVISOR-01_ASYNC_OWNERSHIP
TARGET_REPOSITORY=Nortropic/verkstadsgolvet (Claude Factory)
STATUS=PROVEN (inventory-first; measured gaps closed, remainder recorded)
BASE_SHA=d2ea9d59f7724242b095116a3fd30d59f698aa2c
CANDIDATE_SHA=22ef5dbec29e01232b3d6f6b53fcdaa36d7840bb
MERGE_SHA=851c0b25b7463d616d5c95d94d55245687bf0a8b
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/30
CHANGED_FILES=7 (autopilot.ts recover/classification, cli.ts, state/telemetry wiring, tests/claude-loop, runbook)
TEST_COMMANDS=npm run claude:test ; cli selftest ; npm run loop:test ; npx tsc --noEmit ; npm run build
TEST_EXIT_CODES=0;0;0;0;0 (rounds 1–2)
DECISIVE_TEST_OUTPUT=gates.passed round=2 failures=0
REVIEWER_RESULT=caught a task-claim-masks-stale-run-claim liveness bias in round 1; final round READY, advisories only
VISUAL_REVIEWER_RESULT=n/a
EMPIRICAL_RESULT=the G1 gap (killed direct runs left REMEDIATE-on-disk, invisible to recover — observed three times live this programme) closed with recovery + stale-run classification; claims/heartbeats/resume/breaker/autopilot inventoried PROVEN_EXISTING with citations; no second scheduler, no second backlog
EVIDENCE_PATHS=.git/claude-factory/runs/supervisor-01_async_ownership-20260815011935/

SLICE_ID=STATUS-02_TERMINAL_B (programme bookkeeping)
TARGET_REPOSITORY=Nortropic/verkstadsgolvet
STATUS=PROVEN
BASE_SHA=851c0b25b7463d616d5c95d94d55245687bf0a8b
CANDIDATE_SHA=b6bd3fa9098fb237a8fa26000f202ae2e60919c0
MERGE_SHA=be624ad6610dba12fa47c6a2515b87499600efe4
PR_URL=https://github.com/Nortropic/verkstadsgolvet/pull/31
CHANGED_FILES=2 (handoff, machine backlog)
TEST_COMMANDS=node -e JSON.parse(backlog)
TEST_EXIT_CODES=0
REVIEWER_RESULT=READY round 0, note advisories only
VISUAL_REVIEWER_RESULT=n/a
EMPIRICAL_RESULT=handoff records terminal condition B, next eligible = none, exact owner actions
EVIDENCE_PATHS=.git/claude-factory/runs/ (status-02 run)

## Blocked slices

SLICE_ID=ROOM-02 (live intake & submission lifecycle)
STATUS=BLOCKED (fixture UX half PROVEN pre-programme as V8-FIXTURE; live half blocked)
EXACT_BLOCKER=backend S10 (controller/intag, task h-023) and S13 (controller/lucka, h-026) are UNFROZEN: no spec row, no gate, no code at nortropic-system origin/main 32b6e07
BLOCKER_CLASS=backend dependency
COMMAND_OR_PATH_EVIDENCE=scripts/nortropic-codex-autopilot.py ROADMAP tuple; `roadmap_status()` prints UNFROZEN for S10/S13; exhaustive grep: zero hits for intake.submit/loop_commands/Supabase in backend code
OWNER_OR_EXTERNAL_PREREQUISITE=advance backend chain h-031 → supervisor resume → SUB-1..4 → S5/S10/S13
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=ROOM-04 (live identity projection)
STATUS=BLOCKED
EXACT_BLOCKER=no controller read-model exists to carry identity fields; backend state is {task,status} JSONL + attestations.json only — no event_type/seq/event_id anywhere in backend code
BLOCKER_CLASS=backend dependency
COMMAND_OR_PATH_EVIDENCE=controller/state/cli giltigt_event() validates only {task,status}; controller/loop/cli:60-64 states the chain writes no richer events
OWNER_OR_EXTERNAL_PREREQUISITE=backend S5 + S13; identity fields draw on PROVEN backend provenance material (h-032 provider identity, h-033 authenticated runner provenance, h-035 authority classes, owner-production-paths.v1.json)
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=ROOM-05 (live snapshot cutover) / ROOM-06 (live typed operator actions) / ROOM-07 (conversational operator)
STATUS=BLOCKED
EXACT_BLOCKER=ROOM-05/06: controller publishes nothing outward (no snapshot publication, no command claiming, no transport client at backend origin/main); ROOM-07 depends on ROOM-06 + REMOTE-00
BLOCKER_CLASS=backend dependency
COMMAND_OR_PATH_EVIDENCE=exhaustive grep at 32b6e07: zero hits for loop_snapshots/loop_commands/HTTP server/socket under controller/, scripts/, tests/
OWNER_OR_EXTERNAL_PREREQUISITE=backend S5 (h-019) + S13 (h-026) built and verified
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=IDENTITY-01/02/03, OBSERVER-01, AUDIT-01, RETRO-01
STATUS=BLOCKED
EXACT_BLOCKER=control-plane execution environment work owned by nortropic-system's own operating model (test-author RED-frozen gates in specs/** + verify/** which are builder-denied there); its own frozen chain has h-031 as next step, still undefined on main
BLOCKER_CLASS=backend operating-model dependency
COMMAND_OR_PATH_EVIDENCE=AGENTS.md:79 chain "H-035 → H-034 → H-033 → H-032 → H-031 → supervisor resume → first real autonomous launch"; h-031 has no spec row/gate/description at origin/main (only a negative control in verify/bin/h-032-exit:167)
OWNER_OR_EXTERNAL_PREREQUISITE=owner drives the backend chain; PROVEN existing material to reuse is inventoried in the roadmap (h-032/033/034/035, managed-settings.json capability bundle, KANSLIGA_PREFIX stripping)
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=REMOTE-00 (common remote operator adapter)
STATUS=BLOCKED
EXACT_BLOCKER=depends on ROOM-05/ROOM-06 (controller snapshots + typed intents live) which are blocked on S5/S13
BLOCKER_CLASS=backend dependency
COMMAND_OR_PATH_EVIDENCE=as ROOM-05/06 above
OWNER_OR_EXTERNAL_PREREQUISITE=backend S13
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=REMOTE-01 (Slack/Claude Tag)
STATUS=BLOCKED
EXACT_BLOCKER=(a) REMOTE-00 blocked; (b) external entitlement: Claude Tag is Public Beta, Team/Enterprise plans only, no custom MCP backends (Anthropic-managed connectors only), org-Owner pairing required
BLOCKER_CLASS=backend dependency + external entitlement
COMMAND_OR_PATH_EVIDENCE=pinned verification 2026-08-14: https://claude.com/docs/claude-tag/overview.md, /admins/setup-overview (evidence file /Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md); additional owner decision LOOP-ÄGARHAND-37 (docs/05-beslutslogg.md 2026-08-09): controller alarms use the webhook at ~/.nortropic/slack-webhook, Claude Code Slack plugin explicitly rejected for alarms — REMOTE-01 must not absorb h-014's alarm channel
OWNER_OR_EXTERNAL_PREREQUISITE=Team/Enterprise claude.ai org with Claude Tag enabled; backend S13
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=REMOTE-02 (Claude Code Channels) / REMOTE-03 (Routines) / REMOTE-04 (mobile notifications half)
STATUS=BLOCKED (REMOTE-02/03 adapters are locally implementable but purposeless before REMOTE-00 exists; REMOTE-04's notification half depends on OBSERVER-01)
EXACT_BLOCKER=REMOTE-00 chain; Channels is Research Preview (local MCP servers pushing into a RUNNING session; custom channels behind --dangerously-load-development-channels; mandatory sender allowlist); Routines is Research Preview (account-owned cloud runs, no custom MCP, fire-text explicitly untrusted, beta header experimental-cc-routine-2026-04-01)
BLOCKER_CLASS=dependency + external preview status (feature-flag + version-pin required per roadmap)
COMMAND_OR_PATH_EVIDENCE=pinned verification 2026-08-14: https://code.claude.com/docs/en/channels.md, channels-reference.md, routines.md, scheduled-tasks.md (same evidence file)
OWNER_OR_EXTERNAL_PREREQUISITE=backend S13 → REMOTE-00; preview access as available
INDEPENDENT_WORK_CONTINUED=YES

SLICE_ID=CONTEXT-01, HARDEN-01, EMPIRICAL-01
STATUS=BLOCKED
EXACT_BLOCKER=CONTEXT-01 depends on REMOTE-00; HARDEN-01 depends on IDENTITY-01..03 + REMOTE-00 + CONTEXT-01 + SUPERVISOR-01 (only the last is PROVEN); EMPIRICAL-01 depends on the full programme
BLOCKER_CLASS=dependency chain
COMMAND_OR_PATH_EVIDENCE=dependency table in backlog/nortropic-factory-room-master-v1.json
OWNER_OR_EXTERNAL_PREREQUISITE=as above
INDEPENDENT_WORK_CONTINUED=YES (until the eligible set emptied — terminal condition B)

SUPERSEDED/OPERATIONAL RUNS (evidence, not roadmap slices):
- UX-ADVISORY-SWEEP-V1 run 20260814064509: BLOCKED on external base drift (owner merged PR #21 during its publication); 16-round candidate d20238bc… preserved; debt fully closed by PR #21/#22/#27 per measured U1–U14 table.
- UX-ADVISORY-SWEEP-DELTA run 20260814153245: BLOCKED (architect session hit its turn budget on the full re-measurement workload); superseded by the session-side U1–U14 measurement that shrank the work to UX-SWEEP-RESIDUALS.
- MASTER-00 first attempt 20260814111538: operator-stopped to yield a publication race with the parallel session's ux-loop-header-v2; superseded by 20260814115054.
- ROOM-08 r1 20260814181216: operator-stopped after 12 gates-green rounds — visual DoD unprovable with then-current capture infra (finding recurred 5×, finally self-attributed to visual-review.ts outside product scope); root cause fixed by FACTORY-VISUAL-CAPTURE-V1.
- ROOM-08 r2 20260814221227: blocked by provider 529 outage; builder session became unresumable (3 identical resume failures) — fresh-run policy applied.
- ROOM-08 r3 20260815000407: operator-stopped; capture-state task config lacked scrollToSelector (clip framed top-of-page); corrected in r4 task data.

## Source coverage ledger

Statuses per adopted requirement (SOURCE_A = Claude Tag / persistent teammate / remote conversational workspace; SOURCE_B = agent identity / service accounts / access bundles / Agent Proxy / persistent sessions / audit and evidence). PROVEN cites implementation; everything else carries its blocker in the tables above and in the machine ledger.

Factory-room and interaction model (SOURCE_A):
- persistent Factory Room — PROVEN — components/loop/room/** @ 4701f1c0 (PR #24)
- operator can feed work into the room — PROVEN (fixture path) — WorkComposer → /loop/mata (PR #24); live submit BLOCKED (S10/S13)
- shared durable context — BLOCKED (CONTEXT-01)
- context survives ordinary sessions — BLOCKED (CONTEXT-01)
- context is editable and auditable — BLOCKED (CONTEXT-01)
- context is never canonical authority — PROVEN as invariant in frozen roadmap + enforced today (MEMORY_IS_AUTHORITY=NO; no context store exists yet to violate it)
- current work, backlog and output are visible — PROVEN — TaskFocusRail/BacklogColumn/OutputTray (PR #24)
- technical evidence remains inspectable — PROVEN — raw JSON disclosures in RoomTimeline/CausalChain (PR #24/#26), mobile-usable (PR #29)
- natural-language operator UX — BLOCKED (ROOM-07)
- NL resolves only to typed intentions — BLOCKED (ROOM-07; invariant frozen in roadmap)
- no model-generated generic command execution — PROVEN as enforced negative control — tests/loop/room-shell.test.ts static scans + v7/v10 suites
Autonomous ownership (SOURCE_A):
- persistent task/supervisor state — PROVEN_EXISTING (state.ts, cited in SUPERVISOR-01 inventory)
- autonomous continuation across ordinary slices — PROVEN — 9 slices published this programme without per-slice approvals
- event-driven wakeups — recorded OPEN gap (G3) with evidence; minimal closure judged to risk second-scheduler violation — NOT_STARTED by measured decision
- bounded remediation loops — PROVEN_EXISTING (progress.ts circuit breaker)
- reviewer findings return to builder — PROVEN_EXISTING (supervisor remediation loop; exercised ~40 rounds today)
- no ordinary manual handoff between green slices — PROVEN (this programme's run log)
- safe recovery after process death — PROVEN — SUPERVISOR-01 G1 closure (PR #30) + live demonstrations (sweep resume; ROOM-08 resumes)
- continue until no eligible task remains — PROVEN (terminal condition B reached mechanically)
Agent identity (SOURCE_B):
- asked-by identity — PROVEN (UI half renders "—" honestly; command issued_by exists server-side) / controller half BLOCKED (ROOM-04)
- workflow role — PROVEN (IdentityStrip renders separately, labeled workflow-not-security; PR #24)
- model provider / model identity — PARTIAL→PROVEN for display (snapshot.builder.{agent,model} rendered or "—"); live values BLOCKED (backend B4)
- authenticated execution principal — BLOCKED (ROOM-04/IDENTITY-01); PROVEN_EXISTING backend material inventoried (h-033 _nortropic_provenance)
- service-account identity / session identity / capability-bundle identity — BLOCKED (IDENTITY-01/02, ROOM-04)
- evidence reference for every asserted identity — PROVEN as rule (IdentityStrip invents nothing; absent → "—", test-locked)
- promotion authority shown separately — PROVEN (IdentityStrip row, "—" until backend carries it)
- workflow role never treated as a security boundary — PROVEN (visible copy + locks; CLAUDE.md invariant)
Capability and credential architecture (SOURCE_B):
- dedicated builder/reviewer/owner-author/promoter identities — BLOCKED (IDENTITY-01); PROVEN_EXISTING partial material: owner-author lane (h-035 backend; owner-author lane in verkstadsgolvet factory), Nortropic Promoter app named but not created (backend S7 external prerequisite)
- exact repository/operation scopes — PROVEN_EXISTING in both factories (allowedWrite/deniedWrite + exact post-write scope validation)
- default-deny external destinations — PROVEN_EXISTING for worker env (backend KANSLIGA_PREFIX strip; managed-settings network allowlist); full bundle model BLOCKED (IDENTITY-02)
- capability bundles / revocation / rotation / credential proxy / minimum-credential brokering — BLOCKED (IDENTITY-02/03; threat-model-first requirement frozen in roadmap)
- no secrets in browser/model output/logs/repo/evidence — PROVEN for the product surface (v10 suite: bundle scans, secret-env patterns, server-log rules; exercised green every slice)
Observer, audit and learning (SOURCE_B):
- signal-based ambient observer + the seven notification classes — BLOCKED (OBSERVER-01); consumable conditions prepared (SUPERVISOR-01 stale-run classification, no-ready-work marker)
- main-drift block and notification — PROVEN_EXISTING (publication base-drift guard; demonstrated live twice this programme)
- full causal chain — PROVEN fixture-side end-to-end presentation (PR #26); live chain BLOCKED (S5/S13); workflow-side chain PROVEN_EXISTING (telemetry + ledger + PR identity per run)
- retrospective agent — BLOCKED (RETRO-01); this programme performed one retrospective loop manually: capture-infra defect → improvement task through normal pipeline (PR #28) — the pattern RETRO-01 will automate
- no spontaneous self-modification of control rules — PROVEN (all control changes via reviewed publications; owner-gates untouched)
Required remote operation (SOURCE_A+B):
- common remote operator API — BLOCKED (REMOTE-00, on S13)
- real Slack / Claude Tag integration — BLOCKED (entitlement + REMOTE-00; docs pinned 2026-08-14)
- Claude Code Channels integration — BLOCKED (REMOTE-00; preview contract pinned; local custom-MCP path verified feasible)
- Claude Code Routines integration — BLOCKED (REMOTE-00; beta header pinned experimental-cc-routine-2026-04-01)
- mobile-readable status / remote inspect / remote evidence links — PROVEN browser-half (PR #29: status, task, evidence, honest command state at 390px); notification/non-browser half BLOCKED (REMOTE-04)
- remote intake / run start / pause / resume / command-status visibility / notifications / session recovery — BLOCKED (REMOTE-00/04 on S13; UI surfaces exist fixture-side with honest closed-channel labeling)

## Remote operation

REMOTE_OPERATOR_API=NOT built (blocked on backend S13; design constraints frozen in roadmap)
SLACK_CLAUDE_TAG_STATUS=BLOCKED — Public Beta, Team/Enterprise only, no custom backends; entitlement absent; owner decision LOOP-ÄGARHAND-37 boundary recorded
CHANNELS_STATUS=BLOCKED pending REMOTE-00 — Research Preview verified; custom local MCP channel is the feasible adapter path; flags/pins recorded
ROUTINES_STATUS=BLOCKED pending REMOTE-00 — Research Preview verified; fire-API + beta header pinned; routine output = proposals into normal pipeline
MOBILE_REMOTE_STATUS=browser-half PROVEN (PR #29, framed mobile evidence); notification half blocked
REMOTE_LIVE_TESTS=NOT_RUN (no live remote surface exists to test — recorded, never converted to PASS)
REMOTE_BLOCKERS=backend S13 chain; Claude Tag entitlement; preview availability
REMOTE_SECURITY_NEGATIVE_TESTS=NOT_RUN for remote surfaces (deferred with HARDEN-01); existing v7/v10 negative suites cover the browser command surface (sixth verb 400, shell-string canary, origin/auth gates) — green

## Security and authority

SNAPSHOT_WINS_PROVEN=YES — lib/loop/snapshot.ts + v3 suite; room reuses the fold (never re-implements); room tests re-prove tail-cannot-DONE at room level
EVENT_STREAM_NOT_AUTHORITY_PROVEN=YES — authority:"NONE" on every projected row; v3/v9 suites; room timeline segments labeled, never merged into pseudo-chronology
MEMORY_NOT_AUTHORITY_PROVEN=YES — no context store exists; invariant frozen; chat/session memory never used as continuation authority (handoff file is)
WORKFLOW_ROLE_NOT_SECURITY_IDENTITY_PROVEN=YES — visible UI copy + IdentityStrip separation + CLAUDE.md/roadmap locks
NO_GENERIC_SHELL_PROVEN=YES — v7 canary + static executor scans; room-shell/room-mobile scans extend to room tree
NO_GENERIC_GIT_PROVEN=YES — v10 GIT_SURFACE rules + transitive import closure; MASKINEN_GITHUB_CREDENTIAL=NONE re-proven every slice
NO_DIRECT_MAIN_PROVEN=YES — every merge this programme is a guarded two-parent merge with post-merge proof (parents = frozen base + reviewed candidate); base drift blocked twice and was honored fail-closed
NO_SECRET_IN_CLIENT_PROVEN=YES — v10 bundle scans green on every slice
CREDENTIAL_PROXY_STATUS=NOT_STARTED (IDENTITY-03; threat-model-first frozen)
REVOCATION_STATUS=NOT_STARTED (IDENTITY-02)
REPLAY_PROTECTION_STATUS=PROVEN_EXISTING for the browser command surface (command_id PK + TTL + expected_watermark, v7 suite); remote surfaces deferred with REMOTE-00/HARDEN-01

## Remaining work

NOT_STARTED=CONTEXT-01, IDENTITY-01/02/03, OBSERVER-01, AUDIT-01, RETRO-01, REMOTE-00/01/02/03, REMOTE-04 (notification half), HARDEN-01, EMPIRICAL-01, ROOM-02 (live half), ROOM-04, ROOM-05, ROOM-06, ROOM-07 — each recorded in the machine ledger: 9 with populated blocker objects (backend-chain / operating-model / external-entitlement classes) and 10 blocked purely through their dependency chains (blocker: null by design — ROOM-07, CONTEXT-01, IDENTITY-02/03, AUDIT-01, RETRO-01, REMOTE-02, REMOTE-04, HARDEN-01, EMPIRICAL-01)
BLOCKED=the same set; blocker classes: backend chain (S5/S10/S13 via h-031→SUB-1..4), backend operating-model ownership, external entitlements (Claude Tag Team/Enterprise; Nortropic Promoter GitHub App), preview availability
DEFERRED_BY_OWNER=none declared
REJECTED_WITH_REASON=none
NEXT_EXACT_ACTION=owner: advance nortropic-system chain (author h-031 through its own test-author/gate-reviewer flow → supervisor resume → SUB-1..4 → S2,S4–S13); optionally provision Claude Tag entitlement. The frontend programme resumes automatically from docs/nortropic-factory-room-handoff-v1.md when any dependency lands.

## Publication summary

PUSHES=9 before this report's own publication (all ordinary non-force branch pushes by the supervisor); the report slice adds one more guarded publication, recorded in the run ledger
PRS=9 (#23–#31) before this report's own publication, all created and auto-merged through Publication v2 guards with post-merge two-parent proofs
MERGES=9 before this report's own publication
FORCE_OPERATIONS=0
HISTORY_REWRITES=0

## Final evidence classification

PROVEN=MASTER-00, ROOM-01, ROOM-03 (fixture-side), ROOM-08 (browser-half), SUPERVISOR-01, UX-SWEEP-RESIDUALS, FACTORY-VISUAL-CAPTURE-V1, STATUS-01, STATUS-02; plus the ledger rows marked PROVEN above
OVERIFIERAT=deploy-state of merged slices on Railway (not measured this programme); backend seq-monotonicity and payload contracts (unbuilt, unmeasurable); Supabase restricted-role feasibility (inherited open question from the control-room plan)
NOT_RUN=remote live tests; remote security negative tests; EMPIRICAL-01 unattended remote end-to-end (no live remote surface exists) — recorded as NOT_RUN, never as PASS
BLOCKERS=backend chain S5/S10/S13 (h-031 next, undefined); Claude Tag Team/Enterprise entitlement; GitHub App "Nortropic Promoter" (backend S7); Channels/Routines preview availability
