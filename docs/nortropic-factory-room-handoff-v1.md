# Nortropic Factory Room — handoff v1

Entrypoint for a future Claude Code session picking up the Factory Room programme.

Updated only through a dedicated, mechanically scoped status task after a published slice. Chat
memory is never continuation authority.

```text
MASTER_ROADMAP_PATH   = docs/nortropic-factory-room-master-roadmap-v1.md
MASTER_ROADMAP_COMMIT = 31f20835d7cb6d143609b8174dc04e1ae321b0d6
                        (merge commit of PR #23, the MASTER-00 roadmap freeze; the requirements
                        portion of the roadmap is frozen at this commit and may only be changed by a
                        separate explicit roadmap-authority task)
MASTER_BACKLOG_PATH   = backlog/nortropic-factory-room-master-v1.json
ERRATUM_01_PATH       = docs/nortropic-factory-room-roadmap-erratum-01.md
                        (REQUIRED READING alongside the frozen roadmap. The roadmap is frozen and is
                        corrected only through errata, never by editing it. Erratum 01 corrects two
                        misclassifications: the required Slack interface is a NORTROPIC-OWNED Slack
                        app and the Anthropic Claude Tag entitlement is NOT a core blocker — which
                        renumbers REMOTE-02/03/04 to REMOTE-03/04/05 and adds an optional REMOTE-02;
                        and the connected Railway CLI is the required production discovery and
                        empirical verification path. Where this erratum and the frozen roadmap could
                        be read as disagreeing on those two subjects, the erratum wins.
                        STILL VALID IN FULL — extended by erratum 02, never replaced.)
ERRATUM_02_PATH       = docs/nortropic-factory-room-product-erratum-v2.md
                        (REQUIRED READING. Owner product erratum V2, six corrections:
                        (1) the product is VISIBLE in SHOWROOM mode now — backend availability
                        determines the source label, not route visibility;
                        (2) "Nortropic Tag" is Nortropic's OWN Slack app above a Nortropic-owned
                        remote operator interface, Anthropic Claude Tag is an optional adapter;
                        (3) the room/conversation UX and a non-authoritative context foundation are
                        NOT deferred behind REMOTE-00/S13 — only live dispatch is;
                        (4) standing work is a vendor-neutral NORTROPIC contract with seven trigger
                        classes; Routines/Slack/web/GitHub are adapters to it;
                        (5) the operator product is a WEBSITE FACTORY — project, build, quality,
                        preview, release and after-release are first-class output surfaces;
                        (6) merged is not shipped: production deployment SHA plus visible production
                        behaviour are required evidence for product activation slices.
                        It also carries the P1..P34 product requirements ledger, the region-level
                        source honesty model and the required showroom scenario coverage.)
ADDENDUM_V3_PATH      = docs/nortropic-factory-room-requirement-addendum-v3.md
                        (REQUIRED READING. Owner-authored requirement-completeness addendum V3,
                        recorded VERBATIM and byte-identical to its source. Authoritative over any
                        conflicting omission in erratum 02, the frozen roadmap, prior SHREDDER
                        prompts, prior final reports and prior handoffs. It adds SESSION-01,
                        PARTICIPANT-01, OPERATOR-PROTOCOL-01, SLACK-INBOX-01, NOTIFICATION-01,
                        STANDING-MANAGEMENT-01, RELEASE-RECOVERY-01, DATA-GOVERNANCE-01,
                        OWNER-ACTION-01, PRODUCT-OPS-01 and SEARCH-HISTORY-01, re-affirms
                        IDENTITY-01/02/03 as REQUIRED, retitles IDENTITY-03 as CREDENTIAL-PROXY-01
                        and supplies the merged implementation order in its §15.)
```

Errata are cumulative and none of them rewrites history: the frozen roadmap file and every report
under `docs/reports/**` stay byte-identical, and corrections live only in the errata above.

Authority reading list for a session picking this up: `CLAUDE.md`,
`docs/nortropic-control-room-plan-v1.md`, `docs/claude-operating-model-v1.md`, then
`docs/nortropic-factory-room-master-roadmap-v1.md` **together with**
`docs/nortropic-factory-room-roadmap-erratum-01.md`,
`docs/nortropic-factory-room-product-erratum-v2.md` and
`docs/nortropic-factory-room-requirement-addendum-v3.md`, then this handoff and the backlog.

## CURRENT_AUTHORITATIVE_MAIN

Re-measured 2026-08-15 in the ERRATUM-02_PRODUCT_V2 run worktree, after two further publications
(ERRATUM-01, PR #33; SHREDDER-01A, PR #34).

```text
Nortropic/verkstadsgolvet  origin/main = ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08
    measurement: git rev-parse origin/main (ERRATUM-02_PRODUCT_V2 run worktree, 2026-08-15); the
    value matches the SHREDDER-01A merge commit (PR #34). Previous recorded values were
    851c0b25b7463d616d5c95d94d55245687bf0a8b (SUPERVISOR-01, recorded by STATUS-02) and before it
    cb133c53e189a14255faefceaeb459cd21165d2c (REPORT-01, PR #32) and
    5accd9e533e9280de52c17e91b31a1c1aea2e5e3 (ERRATUM-01, PR #33).
Nortropic/nortropic-system origin/main = e56edc08e5f069f16b5bdb853302a0f39c1f7075
    measurement: reported by the supervising session outside this worktree, 2026-08-15 — the
    backend moved to h-032 (host-builder-r2, PR #79). Previous recorded value was
    32b6e076f96d095d32bb7bf9e6c2519632af80a1. This repository cannot and does not measure that
    repository, and this movement is NOT evidence that S5/S10/S13 have been frozen or built: no
    live half may be reclassified without measuring that repository's own roadmap state.
```

Both values are measured-at-date facts, not live truth. Re-measure before relying on them.

```text
PRODUCTION_DEPLOY_NOT_RE-MEASURED
  the last CLI-verified deployed SHA is cb133c53e189a14255faefceaeb459cd21165d2c (erratum-01,
  2026-08-15). It PREDATES ac2ba4ea… (SHREDDER-01A), so the showroom product is NOT proven visible
  in production. Per erratum-02 CORRECTED_DECISION_6 a merged slice is not a shipped slice; see
  productRequirements P1 and P4 in the ledger.
```

## CURRENT_COMPLETED_SLICES

From the `Nortropic/verkstadsgolvet` ledger (merge commits on `main`, measured 2026-08-14 with
`git log --merges` plus a full-SHA format). These are the pre-existing control-room slices this
programme builds on; they are not Factory Room programme slices.

```text
V1              typed contracts + generated fixtures      merge aa5bbf1eee1bb48d3b6305fc8c5217069d96fb55 (PR #4)
V2              Maskinen shell (fixture-backed)           merge 8312ff80c6c0a636923079a1da850af000ab88b2 (PR #7)
V3              read model, SNAPSHOT_WINS                 merge 4a7548804b44bdc460339722748b25a5b7a04773 (PR #9)
V8-FIXTURE      intake UX (fixture-backed)                merge 72e7f8fc9644d20aba30e6145c05850620e341d1 (PR #15)
V4              live read plane (code; live OVERIFIERAT)  merge 49a9f82de786342ad53ed686fdd3edd56803f3b6 (PR #17)
V7              typed command surface (channel closed)    merge 40ed01234516ae7e8e04b2433231fc11bfdf24be (PR #18)
V9              realtime / TailStore                      merge 42094986f2623a70841113c31193dd1329d28991 (PR #19)
V10             security hardening                        merge a8285c4190b1ac8b0bea4977451fb820cd21d534 (PR #20)
UX-INTAKE-POLISH-V2                                       merge d3e3e6d417c46a8be328982309d7e71235bfd07c (PR #21)
UX-LOOP-HEADER-V2                                         merge 4e5e796506599f36d124248652014061f7d3985d (PR #22)

Factory infrastructure (supervisor, claims, publication v2, autonomy policy, backlog supervisor):
                merges 2319af3396fdda6c588c4fd346988e8e70098548 (PR #11),
                       da544d257852b7e1838405813751fe9544c6488d (PR #10),
                       c643347ead14e51156156e7d7829b75a62a91e62 (PR #16),
                       ad218ec6ed3038de65ca3902d11bf3936929a203 (PR #8)
```

Factory Room programme slices published and `PROVEN` (MASTER-00 and ROOM-01 measured 2026-08-14 in
the STATUS-01 run worktree; the five entries after them measured 2026-08-15 in the STATUS-02 run
worktree with `git rev-parse`, `git rev-list --parents` and `git diff --name-only` — every
base/candidate/merge triple below was confirmed against actual merge-commit parentage):

```text
MASTER-00  master roadmap freeze (docs + backlog artifacts only)
    base      4e5e796506599f36d124248652014061f7d3985d
    candidate fc76bf5043834c8b39c0830405d91ca19a4a59b1
    merge     31f20835d7cb6d143609b8174dc04e1ae321b0d6
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/23
    run       master-00_roadmap_freeze-20260814115054
    gates     backlog JSON parse, npx tsc --noEmit, npm run claude:test — 0 failures, rounds 0-1
    review    reviewer clean at round 1 (note-severity advisories only)

ROOM-01    Factory Room shell (presentation only, fixture-backed)
    base      31f20835d7cb6d143609b8174dc04e1ae321b0d6
    candidate 7eda019bc4a9581eed993404c4a36dae8e8974bf
    merge     4701f1c0a46f25e114637efa556fe80411de412e
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/24
    run       room-01_factory_room_shell-20260814122919
    gates     npx tsc --noEmit, npm run build, npm run loop:test, npm run claude:test — 0 failures,
              rounds 0-7
    review    reviewer clean at round 7 (advisories only); visual reviewer READY at round 7
              (advisories only)
    visual    desktop-1440x1000.png, tablet-900x1000.png, mobile-390x844.png under
              .claude-loop/evidence/room-01_factory_room_shell-20260814122919/round-7/
              in the run worktree
    scope     15 changed files: components/loop/room/** (9), lib/loop/room/** (4),
              components/loop/MaskinShell.tsx, tests/loop/room-shell.test.ts;
              app/(app)/loop/page.tsx untouched

ROOM-03    causal timeline and evidence projection — FIXTURE-SIDE HALF ONLY
    base      bbf945fb21e983cca1c2d1cc6d375ec3b9e8af9a
    candidate 89558802283dc19be802bed2ff11c31afab098e0
    merge     087ca6604b34f77ac78058f76f72fba1c5a1ac8b
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/26
    run       room-03_causal_timeline-20260814154026
    gates     all green rounds 2-6
    review    reviewer clean and visual reviewer clean at round 6
    scope     6 changed files: components/loop/room/CausalChain.tsx, TaskFocusRail.tsx, ui.ts,
              components/loop/MaskinShell.tsx, lib/loop/room/causality.ts,
              tests/loop/room-causality.test.ts
    LIMIT     fixture-side only. The live event/evidence half remains BLOCKED on backend S5 + S13
              and must not be described as live-complete.

UX-SWEEP-RESIDUALS   final residuals of the superseded advisory sweep
    base      087ca6604b34f77ac78058f76f72fba1c5a1ac8b
    candidate af5647e1d064a11f7b574b300bc165099c50911a
    merge     5ab394f3eee2e25df5d112d21e77cea0fbb959f8
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/27
    run       ux-sweep-residuals-20260814174825
    NOTE      with this publication the superseded UX-ADVISORY-SWEEP-V1 debt is FULLY CLOSED:
              12 items landed via PR #21 / PR #22, the 2 residuals via PR #27. The blocked
              candidate d20238bc… is preserved as evidence only and is never re-run against its
              stale base. This is no longer an open item anywhere in this handoff.

FACTORY-VISUAL-CAPTURE-V1   factory capture infrastructure (supervisor-side)
    base      5ab394f3eee2e25df5d112d21e77cea0fbb959f8
    candidate 64695be26b683c0875deebe1b29f75ef9f068568
    merge     cdb638e9875410ad2d53617b3596c3e58ecca617
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/28
    run       factory-visual-capture-v1-20260814214556
    adds      viewport clips; declarative captureStates (openDisclosures, focusSelector,
              scrollToSelector, url); multi-URL capture. The loopback policy is preserved per
              navigated URL.

ROOM-08    responsive and mobile Factory Room — BROWSER-HALF ONLY
    base      cdb638e9875410ad2d53617b3596c3e58ecca617
    candidate e37a2cee207008d50b7a42866b1f4fd1e79e1107
    merge     d2ea9d59f7724242b095116a3fd30d59f698aa2c
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/29
    run       room-08_mobile_room-20260815004053 (r4, the run that published)
    scope     7 changed files: components/loop/room/CausalChain.tsx, RoomStep.tsx,
              RoomTimeline.tsx, ui.ts, components/loop/MaskinShell.tsx,
              tests/loop/room-mobile.test.ts, tests/loop/room-shell.test.ts
    visual    captureStates-framed screenshots (viewport + clip) for the default,
              evidence-open, focus-parked and mata states at 1440x1000 / 900x1000 / 390x844,
              under .claude-loop/evidence/room-08_mobile_room-20260815004053/round-1/
    superseded attempts, preserved as evidence, not lost and not silently dropped:
              r1 20260814181216 — operator-stopped; capture infrastructure was insufficient
              r2 20260814221227 — blocked; unresumable builder session after a provider 529
              r3 20260815000407 — operator-stopped; capture-state task-config lacked
                                  scrollToSelector
    LIMIT     browser-half only. Live submit/command mobile proof remains BLOCKED on backend S13.

SUPERVISOR-01   measured-gap closure in scripts/claude-loop/**
    base      d2ea9d59f7724242b095116a3fd30d59f698aa2c
    candidate 22ef5dbec29e01232b3d6f6b53fcdaa36d7840bb
    merge     851c0b25b7463d616d5c95d94d55245687bf0a8b
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/30
    run       supervisor-01_async_ownership-20260815011935
    closes    measured gaps in recover / stale-run classification, per that run's summary
              (inventory-first: each closed gap cites the measurement that showed it open)

ERRATUM-01   remote-operation and Railway corrections (docs only)
    merge     5accd9e533e9280de52c17e91b31a1c1aea2e5e3
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/33
    run       erratum-01_remote_railway-20260815074829

SHREDDER-01A showroom visibility contract + FACTORY_ROOM_MODE — SHOWROOM SIDE ONLY
    base      5accd9e533e9280de52c17e91b31a1c1aea2e5e3
    candidate 59269e6735c718f9e7a3fb1db0f322c3cd3226ee
    merge     ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/34
    run       shredder-01a_showroom_contract-20260815080309 (candidate rounds 0-2)
    scope     15 changed files, measured with git diff --name-only 5accd9e5… ac2ba4ea…:
              app/(app)/loop/page.tsx, app/(app)/loop/mata/page.tsx, components/loop/IntakeShell.tsx,
              MaskinHeader.tsx, MaskinShell.tsx, RunStatusBar.tsx, flag.ts, ui.ts,
              components/loop/room/FactoryRoomHeader.tsx, lib/loop/room/mode.ts and five test files
    lands     the authenticated /loop and /loop/mata routes no longer 404-gate on LOOP_ENABLED;
              lib/loop/room/mode.ts resolves SHOWROOM fail-closed for every value of
              FACTORY_ROOM_MODE while LIVE_MODE_IMPLEMENTED is false; showroom label vocabulary has
              one source. components/loop/flag.ts survives as the app/api/loop/** transport gate.
    LIMIT     a merged product-visibility change is NOT a production observation. Production
              visibility is P1/P4 and remains unproven at this measurement.
```

`ROOM-01` is fixture-backed presentation. It is not a live integration claim.
`ROOM-03` and `ROOM-08` are published as explicitly partial slices: their live halves stay blocked
on the backend chain and neither may be reported as live-complete.

## CURRENT_BLOCKERS

```text
BACKEND_CHAIN
  evidence: nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07
  blocks:   ROOM-02 (live intake, S10+S13), ROOM-04 (controller-side identity fields),
            ROOM-05 (live snapshot cutover, S5+S13), ROOM-06 (live commands, S13),
            REMOTE-00 (controller-side interface, S13)
  note:     the backend's own next step is h-031, which is itself still UNDEFINED and must be
            defined before the chain can move; then supervisor resume, then first autonomous
            launch, then SUB-1..SUB-4 (h-027..h-030), then S2, S4–S13, then L.

PROMOTER_APP_MISSING
  evidence: GitHub App "Nortropic Promoter" does not exist
            (nortropic-system docs/loop/codex-autopilot-v3-full-roadmap.md; only
            FULL_ROADMAP_SOFTWARE_COMPLETE may be set until it exists)
  blocks:   backend S7, IDENTITY-01 promoter principal, promotion-authority projection in ROOM-04
  owner:    external — the app must be created by the owner; no Claude run can satisfy this

ROUTINES_PREVIEW_ENTITLEMENT
  evidence: Claude Code Routines is a research preview, account-owned scheduled cloud runs,
            beta header anthropic-beta: experimental-cc-routine-2026-04-01
            (/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md)
  blocks:   REMOTE-04 empirical proof (Claude Code Routines adapter; previously numbered REMOTE-03)
  narrowed by erratum-02 CORRECTED_DECISION_4: Routines are an ADAPTER to the Nortropic
            standing-work contract, never standing work itself. This entitlement therefore blocks
            the Routines adapter ONLY — it does not block STANDING-01, STANDING-MANAGEMENT-01,
            SUPERVISOR-02, the schedule trigger class or any other trigger class.

NOT A CORE BLOCKER — reclassified by erratum-01, recorded so it is not re-promoted by mistake:
CLAUDE_TAG_ENTITLEMENT
  evidence: Claude Tag is public beta, Team/Enterprise plans only, requires org-Owner pairing and
            Routines enabled; no custom MCP backends, no inbound API layer (same evidence file)
  blocks:   ONLY the OPTIONAL slice REMOTE-02 (Anthropic Claude Tag adapter). It blocks nothing
            required. The required Slack interface is REMOTE-01, a NORTROPIC-OWNED Slack app above
            the Remote Operator API, which needs no Anthropic entitlement at all
            (ANTHROPIC_CLAUDE_TAG_REQUIRED=NO;
            CLAUDE_TAG_TEAM_ENTERPRISE_ENTITLEMENT_IS_CORE_BLOCKER=NO).
  see:      docs/nortropic-factory-room-roadmap-erratum-01.md

CLOSED SINCE STATUS-01 — no longer a blocker, recorded so it is not re-opened by mistake:
SWEEP_DELTA_RELAND
  was:      run ux-advisory-sweep-v1-20260814064509 BLOCKED on external base drift; its remainder
            had to re-land as a re-measured delta
  now:      FULLY CLOSED. 12 items landed via PR #21 / PR #22 and the 2 residuals via PR #27
            (UX-SWEEP-RESIDUALS, merge 5ab394f3eee2e25df5d112d21e77cea0fbb959f8). The blocked
            candidate d20238bc… stays preserved as evidence only.
```

No blocker above is permission to drop a deliverable, and no blocker above may be widened beyond
what its evidence supports — erratum-01 exists because exactly that happened to the Claude Tag
entitlement. The blocked live halves are deferred, not cancelled. Every blocker remaining above is
owned outside this repository: the backend chain, the backend's own operating model, or an external
entitlement purchase; none of them can be cleared by a frontend Claude run. They do not, however,
cover the whole programme: the REMOTE-01 fake-transport half is eligible frontend work now (see
CURRENT_NEXT_ELIGIBLE_SLICES).

## OPERATIONS NOTE

```text
SUPERVISOR_WORKTREE_MUST_BE_FAST_FORWARDED
  rule:     after every merge that touches scripts/claude-loop/**, the operator supervisor
            worktree (~/nortropic/worktrees/autopilot-supervisor-v1) must be fast-forwarded to
            origin/main BEFORE new supervisor features can be relied on as live. A supervisor
            feature is only live once the checkout actually running it contains that merge.
  incident: measured 2026-08-15 — captureStates was silently stripped by a stale supervisor
            checkout. The feature had merged (FACTORY-VISUAL-CAPTURE-V1, PR #28) but the running
            supervisor predated it, so the task-config field was dropped without an error. The
            failure was silent: nothing reported that the requested capture states were ignored.
  lesson:   a merged supervisor capability is not an operating capability. Verify the running
            checkout, not the merge, before treating supervisor behaviour as available.
```

## CURRENT_NEXT_ELIGIBLE_SLICES

Erratum 02 reopened a large amount of eligible frontend work: showroom visibility, conversation,
room identity, non-authoritative context, website-factory output, telemetry projection and the
standing-work contract do not depend on the backend chain at all.

```text
ELIGIBLE NOW (no backend dependency; each must be labelled showroom / fixture / fake-transport):
SHREDDER-01B           discoverable, polished showroom exposure (deps SHREDDER-01A — merged)
CONVERSATION-01        conversational showroom room-timeline interaction (deps SHREDDER-01B)
WEBSITE-FACTORY-01     showroom website-factory output surfaces (deps SHREDDER-01B)
SHOWROOM-SCENARIOS-01  the required scenario coverage list (deps SHREDDER-01B)
STANDING-01            vendor-neutral standing-work and trigger contract (no deps)
SUPERVISOR-02          event-driven + dependency wakeups, measured gaps only (deps SUPERVISOR-01)
REMOTE-01              "Nortropic Tag — own Slack app" — FAIL-CLOSED SHELL HALF ONLY
                       (client shell, app identity, request signature/timestamp authentication,
                       workspace/user/channel allowlists, Slack event-id dedup, UX and message
                       design, typed-intent adapter contract, translation tests, rejection UX,
                       notification design)
OWNER-ACTION-01        display half only — the remote owner-ACTION write path stays fail-closed
                       until separately threat-modelled and frozen

ELIGIBLE ONCE THEIR NON-BACKEND PREDECESSOR LANDS (still no backend dependency):
ROOM-IDENTITY-01 → SESSION-01, PARTICIPANT-01 → CONTEXT-01A → OPERATOR-PROTOCOL-01 (contract plus
fixture implementation), DATA-GOVERNANCE-01, SEARCH-HISTORY-01; TELEMETRY-01 and
RELEASE-RECOVERY-01 after WEBSITE-FACTORY-01; STANDING-MANAGEMENT-01 after STANDING-01;
NOTIFICATION-01 after SUPERVISOR-02; SLACK-INBOX-01 and PRODUCT-OPS-01 above the REMOTE-01 shell
```

**Terminal condition B no longer holds.** It was recorded when REMOTE-01 was believed to be blocked
on an Anthropic entitlement. Erratum 01 corrects that: the required Slack interface is a
Nortropic-owned Slack app, and its non-live half depends on nothing. A missing backend S13 blocks
LIVE command execution ONLY. Any REMOTE-01 slice built before S13 must be labelled fake-transport
and must never be described as live-complete.

Measured against the published ledger, with erratum-01 numbering:

```text
blocked on the backend chain (S5 / S10 / S13, UNFROZEN at nortropic-system 32b6e07 when last
measured there; the backend has since moved to e56edc08 (h-032) but that movement is NOT evidence
that S5/S10/S13 are frozen or built and must be re-measured in that repository before any live
half is reclassified):
    ROOM-02 (live intake), ROOM-04, ROOM-05, ROOM-06,
    REMOTE-00 and every slice dependent on it — ROOM-07 (needs ROOM-06 + REMOTE-00),
    CONTEXT-01 (needs REMOTE-00), REMOTE-03, REMOTE-05,
    and the LIVE half of REMOTE-01 only (its fake-transport half is eligible now)
blocked on control-plane environment work owned by the backend's operating model:
    IDENTITY-01, IDENTITY-02, IDENTITY-03, OBSERVER-01, AUDIT-01, RETRO-01
blocked on external entitlements:
    REMOTE-04 (Claude Code Routines research preview)
    REMOTE-02 (OPTIONAL only — Claude Tag Team/Enterprise org; blocks no required deliverable)
transitively blocked by all of the above:
    HARDEN-01 (needs IDENTITY-01..03, REMOTE-00, CONTEXT-01), EMPIRICAL-01 (needs everything
    except the optional REMOTE-02)
```

The list above is the LIVE-half classification and is unchanged as such. What erratum 02 corrects is
the false conclusion drawn from it: the statement that "the fixture-backed and browser-side halves
that could be built without a live backend have been built" was wrong. It was true only of the
slices the frozen roadmap had already named. The showroom product, the conversational room, room
identity, non-authoritative context, the whole website-factory output model, the telemetry
projection, the standing-work contract and the Nortropic Tag shell are all buildable now, and the
programme must never stop at a blocked live backend while such work remains
(addendum-v3 §15). Neither a terminal condition nor a blocker is completion of the programme, and
neither is permission to mark any blocked slice as done.

Nothing downstream of the backend chain is eligible for a LIVE claim, and nothing above is eligible
for a PRODUCTION claim without a CLI-verified deployed SHA plus observed production behaviour
(erratum-02 CORRECTED_DECISION_6).

## LOCKED_INVARIANTS

```text
CONTROLLER_LOCAL_STATE=SOLE_AUTHORITY
SNAPSHOT_WINS=YES
EVENT_STREAM_IS_AUTHORITY=NO
CLAUDE_ROLE_SEPARATION=WORKFLOW
CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO
MODEL_READY_IS_TRUST_VERDICT=NO
MASKINEN_GITHUB_CREDENTIAL=NONE
DIRECT_MODEL_TO_MAIN=NO
DIRECT_UI_TO_MAIN=NO
DIRECT_REMOTE_CLIENT_TO_MAIN=NO
PROMOTION_FORCE_ALLOWED=NO
GENERIC_SHELL_FROM_UI=NO
GENERIC_GIT_FROM_UI=NO
GENERIC_COMMAND_STRING=NO
OPTIMISTIC_AUTHORITATIVE_STATE=NO
MEMORY_IS_AUTHORITY=NO
ROOM_CONTEXT_IS_AUTHORITY=NO
REMOTE_CLIENT_IS_AUTHORITY=NO
```

Added by erratum 02 — these EXTEND the block above and weaken nothing in it:

```text
SHOWROOM_FIXTURE_IS_AUTHORITY=NO
DIRECT_SLACK_TO_MAIN=NO
DIRECT_NORTROPIC_STATE_MUTATION=NO
DIRECT_NORTROPIC_PROMOTION=NO
NORTROPIC_TRUST_AUTHORITY=NO
STANDING_WORK_WRITES_MAIN=NO
SHOWROOM_BEFORE_BACKEND_COMPLETE=YES
VISIBLE_PRODUCT_NOW=YES
PRODUCTION_VISIBILITY_REQUIRED=YES
BACKEND_MISSING_MEANS_SHOWROOM_NOT_HIDDEN=YES
BACKEND_MISSING_MEANS_FAKE_LIVE=NO
```

The five canonical intention verbs are unchanged and remain a closed set: `intake.submit`,
`run.start`, `run.pause_at_safe_boundary`, `run.resume`, `inspect`. No adapter, standing-work
trigger, conversational surface or showroom scenario invents a sixth verb, overloads one of the five
with a schedule payload, or invents an alternative command-status vocabulary.

## REMOTE_INTEGRATION_STATUS

All remote integrations are still `NOT_STARTED` as implementations. The numbering below is the
corrected numbering from `docs/nortropic-factory-room-roadmap-erratum-01.md`; the frozen roadmap
still carries the old numbers and is translated through that erratum, not edited.

```text
id         slice                                    old id     status       classification
REMOTE-00  common Nortropic Remote Operator API     REMOTE-00  NOT_STARTED  REQUIRED (unchanged)
REMOTE-01  "Nortropic Tag — own Slack app"          REMOTE-01  NOT_STARTED  REQUIRED (core, rescoped)
REMOTE-02  Anthropic Claude Tag optional adapter    NEW SLICE  NOT_STARTED  OPTIONAL
REMOTE-03  Claude Code Channels adapter             REMOTE-02  NOT_STARTED  REQUIRED
REMOTE-04  Claude Code Routines adapter             REMOTE-03  NOT_STARTED  REQUIRED
REMOTE-05  remote notifications and mobile flow     REMOTE-04  NOT_STARTED  REQUIRED
```

```text
ANTHROPIC_CLAUDE_TAG_REQUIRED=NO
CLAUDE_TAG_TEAM_ENTERPRISE_ENTITLEMENT_IS_CORE_BLOCKER=NO
NORTROPIC_SLACK_APP_REQUIRED=YES
REMOTE_OPERATION_FROM_PHONE_REQUIRED=YES
```

REMOTE-01 resolves ALL Slack input to exactly the five canonical typed intentions
(`intake.submit`, `run.start`, `run.pause_at_safe_boundary`, `run.resume`, `inspect`); no Slack
input becomes shell, generic Git, a file edit, a verdict, an attestation, a promotion, a main
mutation or lease-breaker manipulation; the controller may always reject; and Slack reports only
actual command state (`queued`/`claimed`/`applied`/`rejected`/`expired`), never optimistic success.
Its REMOTE-00 dependency binds the LIVE half only — see CURRENT_NEXT_ELIGIBLE_SLICES.

`REMOTE-01` is retitled **"Nortropic Tag — own Slack app"** by erratum 02; the id is unchanged
because renaming a frozen id is forbidden, and `NORTROPIC-TAG-01` in the erratum-02 and addendum-v3
implementation orders is an ALIAS for `REMOTE-01`, not a second slice. Addendum-v3 adds three
slices above it: `SLACK-INBOX-01` (§7, real remote source intake), `OPERATOR-PROTOCOL-01` (§6, the
single versioned protocol every client speaks) and `PRODUCT-OPS-01` (§13, operating the service).

### Deployment facts (erratum-01 §ERRATUM 2 — the Railway CLI is the verification path)

Measured 2026-08-15 via the Railway CLI 5.41.0. Measured-at-date facts, not live truth.

```text
deploy mechanism   GitHub main auto-deploy (RAILPACK, reason=deploy) — the SINGLE deploy path;
                   railway up must NOT be used in parallel
project            verkstadsgolvet (27b6eb8a-e43e-41f3-a324-c06e83b0f56d)
environment        production (6866bf05-7148-4397-9844-11056838e3a9)
service            verkstadsgolvet (7ba0575d-5c74-4bde-a417-2d5f54ecb5de)
domain             verkstadsgolvet-production.up.railway.app
latest deployment  f328ebee-f9f6-4bf0-9e76-281032735ddf SUCCESS
deployed SHA       cb133c53e189a14255faefceaeb459cd21165d2c (= origin/main at measurement)
environment        LOOP_ENABLED=true present in production
rule               production completion claims require a CLI-verified deployed SHA plus an
                   observed production URL; deploy state is not recorded as unverified while
                   connected CLI access exists and has not been exhausted
STALE AT           2026-08-15 (erratum 02): origin/main has since moved to ac2ba4ea… via PR #33 and
                   PR #34. The deployed SHA above therefore no longer equals origin/main, and the
                   showroom product is NOT proven visible in production. Re-measure before any
                   production claim — this is exactly CORRECTED_DECISION_6.
```

## ROADMAP_COVERAGE

```text
ROADMAP_COVERAGE_COMPLETE=YES   (at ROADMAP LEVEL ONLY — coverage, never implementation)
```

Measured 2026-08-15 in the ERRATUM-02_PRODUCT_V2 run worktree, by parsing
`backlog/nortropic-factory-room-master-v1.json` with node:

```text
slices                     46, every one with exactly one status from the ledger vocabulary
                           (NOT_STARTED, IN_PROGRESS, PROVEN, BLOCKED, DEFERRED_BY_OWNER,
                           REJECTED_WITH_REASON); no duplicate id; every dependency resolves to an
                           id that exists in the same file
productRequirements        34 (P1..P34 with no gap), every one with exactly one valid status;
                           5 IN_PROGRESS (P1, P2, P3, P32, P34), 29 NOT_STARTED, 0 PROVEN
V2 slices present          SHREDDER-01A, SHREDDER-01B, CONVERSATION-01, ROOM-IDENTITY-01,
                           CONTEXT-01A, WEBSITE-FACTORY-01, TELEMETRY-01, SHOWROOM-SCENARIOS-01,
                           STANDING-01, SUPERVISOR-02, REMOTE-01 (retitled "Nortropic Tag")
V3 slices present          SESSION-01, PARTICIPANT-01, OPERATOR-PROTOCOL-01, SLACK-INBOX-01,
                           NOTIFICATION-01, STANDING-MANAGEMENT-01, RELEASE-RECOVERY-01,
                           DATA-GOVERNANCE-01, OWNER-ACTION-01, PRODUCT-OPS-01, SEARCH-HISTORY-01,
                           plus IDENTITY-01/02/03 re-affirmed (IDENTITY-03 titled
                           CREDENTIAL-PROXY-01, IDENTITY-02 extended with room-scoped binding)
no end-to-end PROVEN       HARDEN-01 and EMPIRICAL-01 are NOT_STARTED; the six PROVEN rows
                           (MASTER-00, ROOM-01, ROOM-03, ROOM-08, SUPERVISOR-01, SHREDDER-01A) are
                           artifact-, fixture- or browser-half slices and each carries its LIMIT
```

Per addendum-v3 §17 this value asserts coverage only: **nothing here is implemented, and no source
requirement may be treated as satisfied by this document existing.** The third condition of §17 —
an independent reviewer confirming that no source requirement was dropped or silently merged into a
weaker requirement — is the reviewer's primary falsification duty on the publishing task, and this
`YES` stands only if that count/coverage check confirms it.

## EXACT_NEXT_ACTION

The merged V2 + V3 order (erratum-02 §REQUIRED IMPLEMENTATION ORDER together with addendum-v3 §15).
Dependency-aware execution may reorder INDEPENDENT slices; it may not omit any of them, and no
security-sensitive write path is built before its frozen gate and authority prerequisites exist.

```text
 1. ERRATUM-02 + ADDENDUM-V3 — this document set and the ledger additions (THIS TASK; publication
    is the supervisor's, not the model's)
 2. SHREDDER-01B — discoverable, polished showroom exposure above the merged SHREDDER-01A contract
 3. RAILWAY PRODUCTION PROOF (P1/P4) — supervisor or owner runs the connected Railway CLI outside
    the model sandbox and records a deployed SHA at or after ac2ba4ea…, the observed production URL
    and the observed behaviour. Merged is not shipped (CORRECTED_DECISION_6).
 4. CONVERSATION-01 — conversational showroom room-timeline interaction, typed-intention preview
    cards, NO dispatch in showroom, no LLM required
 5. ROOM-IDENTITY-01 — non-authoritative room/conversation/thread/participant identity model,
    client_kind ∈ {web, slack, claude_tag_optional, claude_code_channel, routine, system_observer}
 6. SESSION-01 — persistent agent session vs ephemeral workspace lifecycle (addendum-v3 §1)
 7. PARTICIPANT-01 — shared room, multi-participant steering, concurrency (§2)
 8. CONTEXT-01A — durable NON-AUTHORITATIVE context foundation; storage architecture decided by an
    inventory-first architect; stale memory always loses to the current snapshot
 9. OPERATOR-PROTOCOL-01 — one versioned Nortropic operator protocol, contract plus fixture
    implementation (§6); live transport still binds REMOTE-00
10. WEBSITE-FACTORY-01 — showroom website-factory output surfaces (project, build, quality,
    preview, release, after-release), plus SHOWROOM-SCENARIOS-01 alongside it
11. TELEMETRY-01 — complete operator read-model surface; lease/generation/heartbeat-age/duration/
    usage rendered em dash until a real controller contract exists
12. SEARCH-HISTORY-01 — read-only search and history across the long-lived room (§14)
13. NORTROPIC-TAG-01 (= REMOTE-01) — own Slack app, FAIL-CLOSED SHELL half only
14. SLACK-INBOX-01 — real remote source intake, fixture/fake-transport half (§7)
15. DATA-GOVERNANCE-01 — showroom, context and audit data governance (§11)
16. STANDING-01 — vendor-neutral standing-work and trigger contract (seven trigger classes)
17. STANDING-MANAGEMENT-01 — the narrow management contract, FROZEN before live standing-work
    writes (§9)
18. SUPERVISOR-02 — event-driven and dependency-satisfied wakeups, measured gaps only, no second
    scheduler and no second canonical backlog
19. NOTIFICATION-01 — delivery, acknowledgement and resolution; acknowledgement is never authority
    and never replaces backend h-014 alarm semantics (§8)
20. PRODUCT-OPS-01 — operate Verkstadsgolvet and Nortropic Tag; runbooks, health, rotation (§13)
21. IDENTITY-01 — mechanical principals (owner ceremony: the GitHub App "Nortropic Promoter" is
    required before the promoter principal can exist)
22. IDENTITY-02 — versioned capability bundles WITH room-scoped binding (§4)
23. IDENTITY-03 / CREDENTIAL-PROXY-01 — the Nortropic Credential Proxy; threat model and
    adversarial gates frozen BEFORE implementation (§5)
24. RELEASE-RECOVERY-01 — release, incident and rollback PROJECTION; no rollback execution path is
    authorized by that requirement alone (§10)
25. Newly eligible live/backend integrations (ROOM-02, ROOM-04, ROOM-05, ROOM-06, ROOM-07,
    REMOTE-00, the REMOTE-01 live half) → remote adapters (REMOTE-03, REMOTE-04, REMOTE-05, and the
    OPTIONAL REMOTE-02 last) → HARDEN-01 → EMPIRICAL-01, the full remote proof
```

```text
UNORDERED BY DESIGN
OWNER-ACTION-01  remote attention is not remote authority. Its display half rides on the room
                 surfaces; the remote owner-ACTION write path stays FAIL-CLOSED until it has been
                 separately threat-modelled, test-authored, frozen, mechanically authenticated,
                 replay-protected, candidate/run/task-bound and independently reviewed as its own
                 authority slice. Its presence in the ledger is coverage, never authorization.
```

Owner ceremonies that no Claude run can satisfy, still open and still required where noted:
create the Nortropic-owned Slack app (blocks the LIVE half of step 13, not the shell); advance the
`nortropic-system` chain to S5 / S10 / S13 (blocks every live half); optionally create the GitHub
App "Nortropic Promoter" (blocks backend S7 and the IDENTITY-01 promoter principal); and — OPTIONAL
and deliberately last — a Claude Tag entitlement, only if the optional `REMOTE-02` adapter is later
desired. Per erratum-01 that entitlement is NOT on the critical path for remote operation from a
phone.

The programme no longer waits on the backend: steps 2 and 4–20 above have no backend dependency at
all. When a backend dependency does land, re-measure both origin/main values, re-read
CURRENT_NEXT_ELIGIBLE_SLICES against the newly satisfied prerequisite, and author the first slice
whose dependencies and authority prerequisites are then genuinely met. Do not author a blocked
slice in the meantime, and do not convert a showroom, fixture-backed or fake-transport half into a
live claim without the prerequisite actually being present.

Read `docs/nortropic-factory-room-master-roadmap-v1.md` for the frozen exit criteria, negative
controls and visual-review requirements of whichever slice comes next — always together with
`docs/nortropic-factory-room-roadmap-erratum-01.md` (corrected REMOTE numbering, Nortropic Slack App
scope, deployment-verification rule), `docs/nortropic-factory-room-product-erratum-v2.md` (the six
V2 corrections, the P1..P34 requirements ledger, the source-honesty model and the showroom scenario
coverage) and `docs/nortropic-factory-room-requirement-addendum-v3.md` (the verbatim owner
completeness addendum) — and `backlog/nortropic-factory-room-master-v1.json` for the
machine-readable slice and product-requirement records.
