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
LANES_CLARIFICATION_PATH = docs/nortropic-factory-room-lanes-clarification.md
                        (REQUIRED READING. Owner product clarification recorded VERBATIM and
                        byte-identical to its source: Nortropic has TWO factory lanes.
                        (1) SYSTEM_IMPROVEMENT — Nortropic building and improving itself (S5/S10/S13,
                        verifier, supervisor, Credential Proxy, Nortropic Slack, Factory Room,
                        control-plane capabilities). The current Codex/bootstrap/autopilot loop is
                        primarily THIS lane.
                        (2) CUSTOMER_PRODUCTION — the future customer WEBSITE production factory
                        (build a customer site, hero/service pages, visual/a11y/SEO QA, preview,
                        deploy, smoke, monitoring).
                        It is ONE product with ONE trust kernel, not two dashboards, schedulers or
                        backlogs: the work domain is a first-class CONTEXT, never a task state and
                        never part of TASK_LIFECYCLE. Additive to erratum-02 and addendum-v3: it
                        changes no existing slice status and adds LANE-01..LANE-09 (§11).)
```

Errata are cumulative and none of them rewrites history: the frozen roadmap file and every report
under `docs/reports/**` stay byte-identical, and corrections live only in the errata above.

Authority reading list for a session picking this up: `CLAUDE.md`,
`docs/nortropic-control-room-plan-v1.md`, `docs/claude-operating-model-v1.md`, then
`docs/nortropic-factory-room-master-roadmap-v1.md` **together with**
`docs/nortropic-factory-room-roadmap-erratum-01.md`,
`docs/nortropic-factory-room-product-erratum-v2.md`,
`docs/nortropic-factory-room-requirement-addendum-v3.md` and
`docs/nortropic-factory-room-lanes-clarification.md`, then this handoff and the backlog.

The lanes clarification is the newest owner document in that list. Read it before authoring any
Factory Room UX slice: it decides which of the two work domains a surface is speaking about, and a
surface that cannot answer that question fails independent visual review (§13).

## CURRENT_AUTHORITATIVE_MAIN

Re-measured 2026-08-15 in the STATUS-03_SHREDDER_DONE run worktree, after four further publications
(ERRATUM-02 V2+V3, PR #35; ERRATUM-03 lanes, PR #36; SHREDDER-01C, PR #37; SHREDDER-01B, PR #38).

```text
Nortropic/verkstadsgolvet  origin/main = c86cf2aa24cf2ad2673fff2d252d5b1f91ca7f7e
    measurement: git rev-parse origin/main (STATUS-03_SHREDDER_DONE run worktree, 2026-08-15); the
    value matches the SHREDDER-01B merge commit (PR #38). The previously recorded value was
    ac2ba4ea6eeedf5e3fd78a9785d852d8e5d9ec08 (SHREDDER-01A, PR #34, recorded by ERRATUM-02), and
    main has moved FORWARD from it through four merges, measured with
    git log --oneline --first-parent origin/main (oldest first):
        69e3a6be5300c08f8b54cd82a28bbed7a5112395  ERRATUM-02 V2+V3   PR #35
        e851b49b27020693ff4c4387092a89e01d38fb17  ERRATUM-03 lanes   PR #36
        330457cfa56646d5f56b7746c0e0064009505eb5  SHREDDER-01C       PR #37
        c86cf2aa24cf2ad2673fff2d252d5b1f91ca7f7e  SHREDDER-01B       PR #38
    Merge parentage was verified with git log -1 --format=%P on the two product merges:
    c86cf2aa… = parents 330457cf… (base) + 92d318b3… (candidate); 330457cf… = parents e851b49b…
    (base) + 1c153eeb… (candidate).
Nortropic/nortropic-system origin/main = e56edc08e5f069f16b5bdb853302a0f39c1f7075
    measurement: reported by the supervising session outside this worktree, 2026-08-15 — the
    backend moved to h-032 (host-builder-r2, PR #79). Previous recorded value was
    32b6e076f96d095d32bb7bf9e6c2519632af80a1. This repository cannot and does not measure that
    repository, and this movement is NOT evidence that S5/S10/S13 have been frozen or built: no
    live half may be reclassified without measuring that repository's own roadmap state.
```

Both values are measured-at-date facts, not live truth. Re-measure before relying on them.

```text
PRODUCTION_DEPLOY_RE-MEASURED
  the deployed SHA is now c86cf2aa24cf2ad2673fff2d252d5b1f91ca7f7e — EQUAL to origin/main, not
  behind it. The showroom product is therefore proven present in production as an anonymous
  observation; the AUTHENTICATED production rendering is a separate, still-open owner ceremony.
  See RAILWAY_PRODUCTION_EVIDENCE below and productRequirements P1 and P4 in the ledger.
```

## RAILWAY_PRODUCTION_EVIDENCE

Measured 2026-08-15 by the supervisor/operator outside the model sandbox (the model sandbox has no
network route to Railway and no browser). These are measured-at-date facts, not live truth, and
they are recorded here because erratum-02 `CORRECTED_DECISION_6` makes production observation —
not merge — the evidence that a product activation slice shipped.

```text
deployment         e5246608 SUCCESS
deployed SHA       c86cf2aa24cf2ad2673fff2d252d5b1f91ca7f7e  (= origin/main at measurement)
deployed at        2026-08-15T21:10:16Z
deploy path        GitHub main auto-deploy — the SINGLE deploy path; railway up must NOT be used
                   in parallel
domain             verkstadsgolvet-production.up.railway.app

ANONYMOUS PRODUCTION PROBES — PASS
    /            → 307 to /login
    /loop        → 307 to /login
    /loop/mata   → 307 to /login
    /login       → 200
    reading: the authentication wall is intact in production and the showroom routes are
    reachable-and-protected rather than 404-gated. This is the SHREDDER-01A contract observed in
    production: the routes no longer disappear behind LOOP_ENABLED, they redirect to login.

ANONYMOUS PRODUCTION SCREENSHOTS — CAPTURED
    desktop + mobile of the auth wall, at
    /Users/elinhaggstrom/nortropic/evidence/factory-room/production-20260815/
    (captured outside the model sandbox; this run could not list that directory, which lies
    outside its allowed working directory, and did not verify the file names)
```

```text
PRODUCTION_AUTH_SCREENSHOTS=BLOCKED
  what is missing: a screenshot of the AUTHENTICATED production surface — the deployed
  Kartongförstöraren behind the login wall.
  exact single owner action (either one closes it):
    (a) complete the Claude-in-Chrome extension install and run /chrome in a Claude Code session;
        or
    (b) log in at https://verkstadsgolvet-production.up.railway.app/loop and visually confirm the
        Kartongförstöraren sidebar entry, the home product entry and the showroom render.
  HONESTY RULE — recorded explicitly so the supporting evidence is never promoted:
    the deployed commit's AUTHENTICATED rendering WAS captured at 1440 / 900 / 390 across four
    capture states by the factory's visual harness, on the byte-identical tree. That is
    SUPPORTING EVIDENCE, NOT A SUBSTITUTE for production screenshots: it proves what the code
    renders, never what the production deployment serves to a logged-in operator. No slice may be
    called production-complete on the authenticated surface until (a) or (b) is performed.
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
    also      lands the WAKEUP PRIMITIVE watchForReadyWork in scripts/claude-loop/autopilot.ts —
              recorded here by erratum-02 after re-reading the file at ac2ba4ea…, because it was
              first omitted from this entry. Bounded poll-based observation returning READY /
              RUN_TERMINAL / TIMEOUT, optionally scoped to one taskId (the existing
              dependency-satisfied observation). Takes no claim, writes no state, starts no run,
              mandatory timeout: a wake primitive, NOT a second scheduler. SUPERVISOR-02 extends
              it; it does not rebuild it.

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
              SUPERSEDED BY MEASUREMENT 2026-08-15: production visibility IS now observed
              anonymously at c86cf2aa… — see RAILWAY_PRODUCTION_EVIDENCE. The authenticated
              production surface remains open.

ERRATUM-02   owner product erratum V2 + requirement addendum V3 (docs + ledger only)
    merge     69e3a6be5300c08f8b54cd82a28bbed7a5112395
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/35
    run       erratum-02_product_v2-20260815090127

ERRATUM-03   owner two-lane clarification + LANE-01..LANE-09 ledger rows (docs + ledger only)
    merge     e851b49b27020693ff4c4387092a89e01d38fb17
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/36
    run       erratum-03_lanes-20260815095233

SHREDDER-01C tablet reading order + the page h1 is the product name — SHOWROOM SIDE ONLY
    base      e851b49b27020693ff4c4387092a89e01d38fb17
    candidate 1c153eebe9114b8082b46a67289f06a8c16019c1  (candidate round 2)
    merge     330457cfa56646d5f56b7746c0e0064009505eb5
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/37
    run       shredder-01c_tablet_contract-20260815133707
    scope     3 changed files, measured with git diff --name-only e851b49b… 330457cf…:
              components/loop/MaskinHeader.tsx, components/loop/room/ui.ts,
              tests/loop/room-mobile.test.ts
    lands     the /loop h1 becomes "Kartongförstöraren" — the product's own name — instead of
              "Maskinen", the house word for the machine CONCEPT; two independent review rounds
              had failed that discontinuity. The word "maskinen" survives in running text where it
              means the machine, never as the page's name. And the ENTRY LEADS AT EVERY WIDTH:
              .rm-lane-focus no longer lifts above the composer at 720–959 px (order 0, written
              out rather than omitted), so ≤959 px has ONE reading order — head → attention →
              mata maskinen → queue → work → shelf → timeline → stream.
    LIMIT     the step ordinal .rm-step-n stays hidden at 720–959 px because ROOM-LAYOUT in
              tests/loop/room-shell.test.ts freezes that rule and the measurement lies outside
              this slice's write scope. Omitting a TRUE ordinal is an omission, never an untruth;
              the lane names remain visible in every view and nothing from the snapshot is hidden.

SHREDDER-01B Kartongförstöraren discoverable and polished (showroom exposure) — SHOWROOM ONLY
    base      330457cfa56646d5f56b7746c0e0064009505eb5
    candidate 92d318b37d939753a955286619d626f39cdb87df  (candidate round 6)
    merge     c86cf2aa24cf2ad2673fff2d252d5b1f91ca7f7e
    PR        https://github.com/Nortropic/verkstadsgolvet/pull/38
    run       shredder-01b_showroom_exposure-20260815174428 (the run that published)
    scope     17 changed files, +2735 / -145, measured with git diff --name-only and --stat
              330457cf… c86cf2aa…: app/(app)/loop/page.tsx, app/(app)/page.tsx,
              components/Sidebar.tsx, components/loop/CommandButton.tsx, CommandDeck.tsx,
              MaskinHeader.tsx, MaskinShell.tsx, components/loop/room/CausalChain.tsx,
              FactoryRoomHeader.tsx, IdentityStrip.tsx, RoomStep.tsx, RoomTimeline.tsx,
              ScenarioPicker.tsx (new), WorkComposer.tsx, ui.ts, lib/loop/room/scenarios.ts (new),
              tests/loop/showroom-navigation.test.ts (new, 1386 lines)
    lands     a sidebar entry and a homepage product entry to /loop; the WorkComposer as the
              unmistakable entry at every breakpoint, routing to /loop/mata with honest static
              affordance copy and NO fake submission; the prose diet (defensive paragraphs
              RELOCATED verbatim behind disclosures, never deleted); and a clearly-labelled
              showroom scenario picker selected from a closed allowlist over generated,
              schema-validated fixtures, reachable from inside the room by a same-page anchor.
    visual    final compact run carried a visual PASS, including the 390-wide fold acceptance
              at approximately y730 of 844.
    superseded evidence runs, preserved as evidence, not lost and not silently dropped:
              r1 stopped on the tablet judge conflict — reference candidate
                 89655e13dc60d853f050fca9caedb698298a94f9 ("candidate round 14", 15:00:24)
              r2 stopped blind-stalled, with no candidate commit at all
              r3 stopped on the fold/scope conflict — reference candidate
                 fecc5643670c751ab6bce0e89e6193cd3feb75c8 ("candidate round 3", 18:54:33)
              r4 stopped on architect max-turns
              measured here: NEITHER 89655e13… NOR fecc5643… is an ancestor of the published
              candidate — git log 330457cf…..92d318b3… lists exactly six commits (rounds
              0, 1, 2, 4, 5, 6, 20:22:18 → 22:44:15) and contains neither. They are genuinely
              superseded branches, not earlier rounds of the run that published.
              NOT MEASURED HERE: the run IDS of r1–r4. They live under
              .git/claude-factory/runs/, which is in the shared git directory OUTSIDE this run
              worktree's allowed read scope, so this run could not read them and did not guess
              them. The four descriptions above are operator-supplied; only the two candidate
              SHAs, their round labels, their timestamps and their non-ancestry were measured.
    LIMIT     showroom exposure ONLY. Nothing here submits, dispatches or commands: the composer
              is an affordance, the scenario picker reads generated fixtures, and no typed work
              domain is introduced (that is LANE-01).
```

The two SHREDDER runs above have a production observation behind them, which no earlier programme
slice had: `RAILWAY_PRODUCTION_EVIDENCE` records the deploy of exactly `c86cf2aa…` plus anonymous
probes. That closes the anonymous half of `P1`/`P4` and only that half.

`ROOM-01` is fixture-backed presentation. It is not a live integration claim.
`ROOM-03` and `ROOM-08` are published as explicitly partial slices: their live halves stay blocked
on the backend chain and neither may be reported as live-complete.

## CURRENT_BLOCKERS

```text
BACKEND_CHAIN
  evidence: nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07
  blocks:   ROOM-02 (live intake, S10+S13), ROOM-04 (controller-side identity fields),
            ROOM-05 (live snapshot cutover, S5+S13), ROOM-06 (live commands, S13),
            REMOTE-00 (controller-side interface, S13),
            LANE-08 (live controller work-domain projection — needs ROOM-05 plus a controller
            that publishes a typed work domain; until then the domain is showroom-carried and the
            live value renders —)
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

PRODUCTION_AUTH_SCREENSHOTS
  evidence: RAILWAY_PRODUCTION_EVIDENCE above — the deploy and the ANONYMOUS probes are measured,
            the AUTHENTICATED production rendering is not.
  blocks:   the authenticated sub-item of P1 and P4 ONLY. It blocks NO slice: LANE-01 and every
            other entry in CURRENT_NEXT_ELIGIBLE_SLICES may proceed while it is open, and it must
            not be used to stall the programme.
  owner:    external — one owner action, (a) Claude-in-Chrome + /chrome, or (b) log in at
            https://verkstadsgolvet-production.up.railway.app/loop and confirm the sidebar entry,
            the home product entry and the showroom render.

CLOSED SINCE ERRATUM-02 — no longer a blocker, recorded so it is not re-opened by mistake:
PRODUCTION_DEPLOY_BEHIND_MAIN
  was:      the CLI-verified deployed SHA cb133c53… predated the showroom product, so no merged
            showroom slice was proven visible in production (erratum-02 CORRECTED_DECISION_6)
  now:      CLOSED for the anonymous half. The deployed SHA is c86cf2aa…, EQUAL to origin/main,
            with anonymous probes passing. It re-opens automatically the moment main moves ahead
            of the deployment again — re-measure, never assume.

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

## OPERATIONS NOTES

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

REVIEWER_TURN_BUDGET_TOO_SMALL_FOR_LARGE_SLICES
  measured: during SHREDDER-01B, reviewer role sessions exhausted their turn budget FIVE times on
            the same diff (17 files, +2735/-145, including a 1386-line test file). Each exhaustion
            costs a full role session and produces no verdict, so the slice cannot converge on
            review quality — it converges on whoever runs out of turns first.
  proposed: raise reviewer maxTurns in .claude/agents/reviewer.md for large product slices.
  owner:    OWNER-AUTHOR LANE. .claude/** is denied write for product agents (CLAUDE.md), so no
            product run may make this change. It must be authored as its own owner task; this
            entry is a proposal, never an authorization.

FRESH_RUN_WORKTREES_HAVE_NO_NODE_MODULES
  measured: a fresh run worktree starts without node_modules, and builder sessions repeatedly
            missed the npm ci instruction — so the first gate run failed on a missing toolchain
            rather than on the candidate.
  now:      the operator watcher preinstalls dependencies as a stopgap.
  proposed: durable fix — the supervisor provisions node_modules BEFORE the first gate run
            (factory-infra follow-up, scripts/claude-loop/**). Recorded as a proposal; it is not
            part of any product slice.
```

## CURRENT_NEXT_ELIGIBLE_SLICES

Erratum 02 reopened a large amount of eligible frontend work: showroom visibility, conversation,
room identity, non-authoritative context, website-factory output, telemetry projection and the
standing-work contract do not depend on the backend chain at all.

```text
ELIGIBLE NOW (no backend dependency; each must be labelled showroom / fixture / fake-transport):
LANE-01                work-domain contract — THE NEXT SLICE (deps SHREDDER-01B — merged, PR #38)
CONVERSATION-01        conversational showroom room-timeline interaction (deps SHREDDER-01B — met)
WEBSITE-FACTORY-01     showroom website-factory output surfaces (deps SHREDDER-01B — met)
SHOWROOM-SCENARIOS-01  the required scenario coverage list (deps SHREDDER-01B — met)
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

LANE SLICES (lanes clarification §11 — no backend dependency except LANE-08):
LANE-01 is ELIGIBLE NOW (its only dependency, SHREDDER-01B, merged as PR #38) → then LANE-02,
LANE-03, LANE-04 and LANE-09 (all deps LANE-01 only);
LANE-05 after LANE-01 + SEARCH-HISTORY-01; LANE-06 after LANE-01 + NOTIFICATION-01;
LANE-07 after LANE-01 + the REMOTE-01 shell; LANE-08 is backend-blocked (see below)
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
    LANE-08 (live controller work-domain projection — inherits the ROOM-05 S5/S13 chain and
    additionally needs a controller that actually publishes a typed work domain),
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
(erratum-02 CORRECTED_DECISION_6). That bar has now been MET ONCE, for exactly one commit:
`c86cf2aa…` is CLI-verified as deployed and was probed anonymously (see
RAILWAY_PRODUCTION_EVIDENCE). It is met for that commit only. The next merge makes the recorded
deployed SHA stale again, and the authenticated production surface has still not been observed.

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

Added by the lanes clarification §1 — these EXTEND both blocks above and weaken nothing in them:

```text
FACTORY_LANE_SYSTEM=SYSTEM_IMPROVEMENT
FACTORY_LANE_CUSTOMER=CUSTOMER_PRODUCTION
BOOTSTRAP_AUTOPILOT_PRIMARY_LANE=SYSTEM_IMPROVEMENT
SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY=NO
SHARED_TRUST_KERNEL_BETWEEN_LANES=YES
WORK_DOMAIN_IS_TASK_STATE=NO
WORK_DOMAIN_IN_TASK_LIFECYCLE=NO
LLM_CLASSIFICATION_IS_WORK_DOMAIN_AUTHORITY=NO
SECOND_DASHBOARD_SCHEDULER_BACKLOG_OR_TRUST_KERNEL=NO
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
SUPERSEDED AT      2026-08-15 (this status task): the block above is the ERRATUM-01 measurement and
                   is kept for history only. It has been RE-MEASURED — deployment e5246608 SUCCESS
                   at c86cf2aa…, equal to origin/main, with anonymous probes passing. The current
                   values live in RAILWAY_PRODUCTION_EVIDENCE above; read that section, not this
                   one, for the deployment state. The project/environment/service/domain
                   identifiers above were not re-measured by this run and are carried forward
                   unchanged.
```

## ROADMAP_COVERAGE

```text
ROADMAP_COVERAGE_COMPLETE=YES   (at ROADMAP LEVEL ONLY — coverage, never implementation)
```

Re-measured 2026-08-15 in the STATUS-03_SHREDDER_DONE run worktree, by parsing
`backlog/nortropic-factory-room-master-v1.json` with node:

```text
slices                     56 (55 before this task, plus the SHREDDER-01C row this task added after
                           measuring that no such row existed), every one with exactly one status
                           from the ledger vocabulary
                           (NOT_STARTED, IN_PROGRESS, PROVEN, BLOCKED, DEFERRED_BY_OWNER,
                           REJECTED_WITH_REASON); no duplicate id; every dependency resolves to an
                           id that exists in the same file
slice statuses             8 PROVEN, 1 IN_PROGRESS (LANE-04), 47 NOT_STARTED
productRequirements        34 (P1..P34 with no gap), every one with exactly one valid status;
                           2 PROVEN (P2, P4), 4 IN_PROGRESS (P1, P3, P32, P34), 28 NOT_STARTED.
                           These are the FIRST PROVEN product requirements in the programme: P2 is
                           the showroom UX SHAPE via the PR #24 → #26 → #29 → #38 chain, and P4 is
                           deployment-SHA verification. Both carry an explicit narrowing — P2 is a
                           shape and not the full erratum-02 surface list, P4 records the open
                           authenticated-visual sub-item in its blocker field.
V2 slices present          SHREDDER-01A, SHREDDER-01B, SHREDDER-01C, CONVERSATION-01,
                           ROOM-IDENTITY-01,
                           CONTEXT-01A, WEBSITE-FACTORY-01, TELEMETRY-01, SHOWROOM-SCENARIOS-01,
                           STANDING-01, SUPERVISOR-02, REMOTE-01 (retitled "Nortropic Tag")
V3 slices present          SESSION-01, PARTICIPANT-01, OPERATOR-PROTOCOL-01, SLACK-INBOX-01,
                           NOTIFICATION-01, STANDING-MANAGEMENT-01, RELEASE-RECOVERY-01,
                           DATA-GOVERNANCE-01, OWNER-ACTION-01, PRODUCT-OPS-01, SEARCH-HISTORY-01,
                           plus IDENTITY-01/02/03 re-affirmed (IDENTITY-03 titled
                           CREDENTIAL-PROXY-01, IDENTITY-02 extended with room-scoped binding)
LANE slices present        LANE-01..LANE-09 (lanes clarification §11); LANE-04 is now IN_PROGRESS
                           (presentation half only — the composer's two-lane intent choice landed
                           incidentally with SHREDDER-01B) and the other eight are NOT_STARTED.
                           LANE-08 is the only one carrying a blocker (EXTERNAL_BACKEND_SLICE, the
                           ROOM-05 S5/S13 chain).
lanes top-level keys       currentBootstrapWorkDomain = SYSTEM_IMPROVEMENT;
                           customerProductionLoopStatus recorded per §11
no end-to-end PROVEN       HARDEN-01 and EMPIRICAL-01 are NOT_STARTED; the eight PROVEN rows
                           (MASTER-00, ROOM-01, ROOM-03, ROOM-08, SUPERVISOR-01, SHREDDER-01A,
                           SHREDDER-01B, SHREDDER-01C) are artifact-, fixture-, browser-half or
                           showroom slices and each carries its LIMIT. SHREDDER-01B is the first
                           with a production observation behind it, and even that is the ANONYMOUS
                           half only — no live controller path is proven anywhere in this ledger.
```

Per addendum-v3 §17 this value asserts coverage only: **nothing here is implemented, and no source
requirement may be treated as satisfied by this document existing.** The third condition of §17 —
an independent reviewer confirming that no source requirement was dropped or silently merged into a
weaker requirement — is the reviewer's primary falsification duty on the publishing task, and this
`YES` stands only if that count/coverage check confirms it.

## FACTORY_LANE_STATUS

The status-report keys required by the lanes clarification §15, with honest current values.
Re-measured 2026-08-15 in this run worktree by reading `components/loop/room/WorkComposer.tsx` at
`c86cf2aa…`. The typed two-lane distinction is still NOT implemented: one showroom surface now
*shows* the two lanes, which is presentation, not a contract.

```text
WORK_DOMAIN_CONTRACT_STATUS          = NOT_STARTED   (LANE-01 — the next slice)
CUSTOMER_PRODUCTION_SHOWROOM_STATUS  = NOT_STARTED   (LANE-02)
SYSTEM_IMPROVEMENT_SHOWROOM_STATUS   = NOT_STARTED   (LANE-03)
INTAKE_DOMAIN_SELECTION_STATUS       = IN_PROGRESS   (LANE-04 — PRESENTATION HALF ONLY. SHREDDER-01B
                                       renders "Vad vill du göra?" plus the two lanes with one
                                       example each. Both link to the same /loop/mata; nothing is
                                       classified, stored or typed. NOT a work-domain contract.)
CURRENT_BOOTSTRAP_LANE               = SYSTEM_IMPROVEMENT
CUSTOMER_PRODUCTION_LOOP_STATUS      = separate future production capability using the shared
                                       Nortropic trust kernel; the Codex bootstrap autopilot is not
                                       this loop
LANE_VISUAL_REVIEW                   = PARTIAL        (the SHREDDER-01B visual review saw the two
                                       lane affordances in the composer at desktop/tablet/mobile,
                                       but no LANE-02/03 lane-distinction UX exists yet; §13 stays
                                       blocking for those)
```

The five owner locks, verbatim from §1 of the clarification:

```text
FACTORY_LANE_SYSTEM=SYSTEM_IMPROVEMENT · FACTORY_LANE_CUSTOMER=CUSTOMER_PRODUCTION · BOOTSTRAP_AUTOPILOT_PRIMARY_LANE=SYSTEM_IMPROVEMENT · SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY=NO · SHARED_TRUST_KERNEL_BETWEEN_LANES=YES.
```

`CURRENT_BOOTSTRAP_LANE=SYSTEM_IMPROVEMENT` is a statement about which work domain the current
bootstrap/autopilot loop operates in. It is NOT a claim that the customer-production loop exists,
and the system-improvement loop must never be described as the customer website factory
(`SYSTEM_IMPROVEMENT_LOOP_IS_CUSTOMER_WEBSITE_FACTORY=NO`). The same values are recorded
machine-readably in `backlog/nortropic-factory-room-master-v1.json` as `currentBootstrapWorkDomain`
and `customerProductionLoopStatus`.

## EXACT_NEXT_ACTION

```text
EXACT_NEXT_ACTION = author and run LANE-01 (work-domain contract).
  why now:  its only dependency is SHREDDER-01B, merged as PR #38 and observed deployed at
            c86cf2aa…; steps 1–4 of the order below are published.
  not this: the open PRODUCTION_AUTH_SCREENSHOTS owner ceremony is NOT a prerequisite for LANE-01
            and must not be used to stall the programme. It is one owner action, tracked in
            RAILWAY_PRODUCTION_EVIDENCE and in productRequirements P1/P4.
```

The merged V2 + V3 order (erratum-02 §REQUIRED IMPLEMENTATION ORDER together with addendum-v3 §15),
now carrying the LANE slices from the lanes clarification §11. Dependency-aware execution may
reorder INDEPENDENT slices; **it may not omit any of them**, and no security-sensitive write path is
built before its frozen gate and authority prerequisites exist.

The only ordering change made by the lanes clarification is INSERTION: LANE-01..LANE-04 become the
next eligible bounded slices immediately after SHREDDER-01B and the Railway production
verification, and the remaining LANE slices are inserted directly after the prerequisite each one
depends on. The relative order of every pre-existing V2/V3 item is unchanged; only their numbers
shift because entries were inserted above them. Nothing was dropped, deferred or merged into a
weaker item.

```text
 1. ERRATUM-02 + ADDENDUM-V3 — that document set and its ledger additions (published)
 2. ERRATUM-03_LANES — the verbatim lanes clarification and the LANE-01..LANE-09 ledger additions
    (published, PR #36)
 3. SHREDDER-01B — discoverable, polished showroom exposure above the merged SHREDDER-01A contract
    (published, PR #38; SHREDDER-01C landed the tablet reading order and the h1 alongside it,
    PR #37)
 4. RAILWAY PRODUCTION PROOF (P1/P4) — DONE FOR THE ANONYMOUS HALF: deployment e5246608 SUCCESS at
    c86cf2aa…, equal to origin/main, with anonymous probes and anonymous screenshots recorded in
    RAILWAY_PRODUCTION_EVIDENCE. STILL OPEN: the authenticated production surface
    (PRODUCTION_AUTH_SCREENSHOTS=BLOCKED) — one owner action, and it does NOT block LANE-01.
 5. LANE-01 — **THIS IS THE NEXT SLICE TO AUTHOR AND RUN.** Work-domain contract: the smallest safe
    typed CUSTOMER_PRODUCTION / SYSTEM_IMPROVEMENT
    context, one canonical field name chosen by architect review, never a task state, never in
    TASK_LIFECYCLE, lib/loop/schema.ts unedited, missing live value renders —
 6. LANE-02 — customer-production showroom: the output is the WEBSITE (synthetic "Nisses Måleri
    DEMO" build → visual QA → preview → deploy → smoke). No real customer, domain or deployment.
 7. LANE-03 — system-improvement showroom: Nortropic improving its own machinery (component,
    slice, task, role, candidate, gate, review, publication, authoritative main, dependency)
 8. LANE-04 — intake domain selection: explicit operator choice between "Bygg / ändra kundprojekt"
    and "Förbättra Nortropic"; LLM classification may suggest but is NEVER the authority.
    PARTLY LANDED as PRESENTATION by SHREDDER-01B (PR #38): WorkComposer.tsx renders the question
    "Vad vill du göra?" and the two lanes with a domain-appropriate example each. Measured by
    reading that file at c86cf2aa…, both affordances link to the same built /loop/mata surface,
    no classification runs, no model is consulted and no state is stored — the file says so
    itself. The TYPED work domain is LANE-01's to define; a display surface must never invent
    the contract.
 9. CONVERSATION-01 — conversational showroom room-timeline interaction, typed-intention preview
    cards, NO dispatch in showroom, no LLM required
10. ROOM-IDENTITY-01 — non-authoritative room/conversation/thread/participant identity model,
    client_kind ∈ {web, slack, claude_tag_optional, claude_code_channel, routine, system_observer}
11. SESSION-01 — persistent agent session vs ephemeral workspace lifecycle (addendum-v3 §1)
12. PARTICIPANT-01 — shared room, multi-participant steering, concurrency (§2)
13. CONTEXT-01A — durable NON-AUTHORITATIVE context foundation; storage architecture decided by an
    inventory-first architect; stale memory always loses to the current snapshot
14. OPERATOR-PROTOCOL-01 — one versioned Nortropic operator protocol, contract plus fixture
    implementation (§6); live transport still binds REMOTE-00
15. WEBSITE-FACTORY-01 — showroom website-factory output surfaces (project, build, quality,
    preview, release, after-release), plus SHOWROOM-SCENARIOS-01 alongside it
16. LANE-09 — domain-specific verification profiles over the SHARED trust kernel; website QA
    semantics are never forced onto control-plane tasks and customer production is never reduced
    to generic code gates (lanes §8)
17. TELEMETRY-01 — complete operator read-model surface; lease/generation/heartbeat-age/duration/
    usage rendered em dash until a real controller contract exists
18. SEARCH-HISTORY-01 — read-only search and history across the long-lived room (§14)
19. LANE-05 — lane-aware history/search: per-lane filtering over records that already carry the
    domain; an index is never authority and an uncarried domain renders — (lanes §10)
20. NORTROPIC-TAG-01 (= REMOTE-01) — own Slack app, FAIL-CLOSED SHELL half only
21. LANE-07 — lane-aware Slack/remote UX: "@nortropic status customer" / "status system"; remote
    responses carry the actual work domain or — (lanes §9)
22. SLACK-INBOX-01 — real remote source intake, fixture/fake-transport half (§7)
23. DATA-GOVERNANCE-01 — showroom, context and audit data governance (§11)
24. STANDING-01 — vendor-neutral standing-work and trigger contract (seven trigger classes)
25. STANDING-MANAGEMENT-01 — the narrow management contract, FROZEN before live standing-work
    writes (§9)
26. SUPERVISOR-02 — event-driven and dependency-satisfied wakeups, measured gaps only, no second
    scheduler and no second canonical backlog
27. NOTIFICATION-01 — delivery, acknowledgement and resolution; acknowledgement is never authority
    and never replaces backend h-014 alarm semantics (§8)
28. LANE-06 — lane-aware notifications: "SYSTEM: S13 blocked on S5." vs "CUSTOMER: Nisses Måleri
    post-deploy smoke failed." — never one generic task-failed UX (lanes §10)
29. PRODUCT-OPS-01 — operate Verkstadsgolvet and Nortropic Tag; runbooks, health, rotation (§13)
30. IDENTITY-01 — mechanical principals (owner ceremony: the GitHub App "Nortropic Promoter" is
    required before the promoter principal can exist)
31. IDENTITY-02 — versioned capability bundles WITH room-scoped binding (§4)
32. IDENTITY-03 / CREDENTIAL-PROXY-01 — the Nortropic Credential Proxy; threat model and
    adversarial gates frozen BEFORE implementation (§5)
33. RELEASE-RECOVERY-01 — release, incident and rollback PROJECTION; no rollback execution path is
    authorized by that requirement alone (§10)
34. Newly eligible live/backend integrations (ROOM-02, ROOM-04, ROOM-05, ROOM-06, ROOM-07,
    REMOTE-00, the REMOTE-01 live half, and LANE-08 — the live controller work-domain projection,
    which needs ROOM-05 and a controller that actually publishes the domain) → remote adapters
    (REMOTE-03, REMOTE-04, REMOTE-05, and the OPTIONAL REMOTE-02 last) → HARDEN-01 → EMPIRICAL-01,
    the full remote proof
```

Mapping from the previous numbering, recorded so no reader concludes anything was omitted: old
1 → new 1, old 2 → new 3, old 3 → new 4, old 4–11 → new 9–15 and 17, old 12 → new 18, old 13 → new
20, old 14–20 → new 22–27 and 29, old 21–24 → new 30–33, old 25 → new 34. New entry 2 is this task;
new entries 5–8, 16, 19, 21 and 28 and the LANE-08 clause in 34 are the nine inserted LANE slices.

```text
UNORDERED BY DESIGN
OWNER-ACTION-01  remote attention is not remote authority. Its display half rides on the room
                 surfaces; the remote owner-ACTION write path stays FAIL-CLOSED until it has been
                 separately threat-modelled, test-authored, frozen, mechanically authenticated,
                 replay-protected, candidate/run/task-bound and independently reviewed as its own
                 authority slice. Its presence in the ledger is coverage, never authorization.
```

Owner ceremonies that no Claude run can satisfy, still open and still required where noted:
create the Nortropic-owned Slack app (blocks the LIVE half of step 20, not the shell); advance the
`nortropic-system` chain to S5 / S10 / S13 (blocks every live half); optionally create the GitHub
App "Nortropic Promoter" (blocks backend S7 and the IDENTITY-01 promoter principal); and — OPTIONAL
and deliberately last — a Claude Tag entitlement, only if the optional `REMOTE-02` adapter is later
desired. Per erratum-01 that entitlement is NOT on the critical path for remote operation from a
phone.

The programme no longer waits on the backend: steps 3 and 5–29 above have no backend dependency at
all — including LANE-01..LANE-07 and LANE-09, whose showroom and contract halves need no controller
at all. LANE-08 is the only lane slice that does (step 34). When a backend dependency does land,
re-measure both origin/main values, re-read
CURRENT_NEXT_ELIGIBLE_SLICES against the newly satisfied prerequisite, and author the first slice
whose dependencies and authority prerequisites are then genuinely met. Do not author a blocked
slice in the meantime, and do not convert a showroom, fixture-backed or fake-transport half into a
live claim without the prerequisite actually being present.

Read `docs/nortropic-factory-room-master-roadmap-v1.md` for the frozen exit criteria, negative
controls and visual-review requirements of whichever slice comes next — always together with
`docs/nortropic-factory-room-roadmap-erratum-01.md` (corrected REMOTE numbering, Nortropic Slack App
scope, deployment-verification rule), `docs/nortropic-factory-room-product-erratum-v2.md` (the six
V2 corrections, the P1..P34 requirements ledger, the source-honesty model and the showroom scenario
coverage), `docs/nortropic-factory-room-requirement-addendum-v3.md` (the verbatim owner
completeness addendum) and `docs/nortropic-factory-room-lanes-clarification.md` (the verbatim owner
two-lane clarification and the LANE-01..LANE-09 items) — and
`backlog/nortropic-factory-room-master-v1.json` for the
machine-readable slice and product-requirement records.
