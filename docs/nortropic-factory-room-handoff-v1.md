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
```

## CURRENT_AUTHORITATIVE_MAIN

Measured 2026-08-15, after five further publications (ROOM-03, UX-SWEEP-RESIDUALS,
FACTORY-VISUAL-CAPTURE-V1, ROOM-08, SUPERVISOR-01).

```text
Nortropic/verkstadsgolvet  origin/main = 851c0b25b7463d616d5c95d94d55245687bf0a8b
    measurement: git rev-parse origin/main (in the STATUS-02 run worktree, 2026-08-15); the value
    matches the SUPERVISOR-01 merge commit, so origin/main has not moved beyond SUPERVISOR-01 at
    measurement time. Previous recorded value was 4701f1c0a46f25e114637efa556fe80411de412e
    (ROOM-01, recorded by STATUS-01).
Nortropic/nortropic-system origin/main = 32b6e076f96d095d32bb7bf9e6c2519632af80a1
    measurement: git rev-parse origin/main, run by the supervising session outside this worktree,
    2026-08-14; unchanged at this status update. This repository cannot and does not measure that
    repository.
```

Both values are measured-at-date facts, not live truth. Re-measure before relying on them.

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

CLAUDE_TAG_ENTITLEMENT
  evidence: Claude Tag is public beta, Team/Enterprise plans only, requires org-Owner pairing and
            Routines enabled; no custom MCP backends, no inbound API layer
            (/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md)
  blocks:   REMOTE-01 empirical proof

ROUTINES_PREVIEW_ENTITLEMENT
  evidence: Claude Code Routines is a research preview, account-owned scheduled cloud runs,
            beta header anthropic-beta: experimental-cc-routine-2026-04-01 (same evidence file)
  blocks:   REMOTE-03 empirical proof

CLOSED SINCE STATUS-01 — no longer a blocker, recorded so it is not re-opened by mistake:
SWEEP_DELTA_RELAND
  was:      run ux-advisory-sweep-v1-20260814064509 BLOCKED on external base drift; its remainder
            had to re-land as a re-measured delta
  now:      FULLY CLOSED. 12 items landed via PR #21 / PR #22 and the 2 residuals via PR #27
            (UX-SWEEP-RESIDUALS, merge 5ab394f3eee2e25df5d112d21e77cea0fbb959f8). The blocked
            candidate d20238bc… stays preserved as evidence only.
```

No blocker above is permission to drop a deliverable. The fixture-backed and design halves that
could be built ahead of the backend have now been built, which is why no eligible frontend work
remains (see CURRENT_NEXT_ELIGIBLE_SLICES); the blocked live halves are deferred, not cancelled.
Every blocker remaining above is owned outside this repository: the backend chain, the backend's
own operating model, or an external entitlement purchase. None of them can be cleared by a
frontend Claude run.

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

```text
NONE.
```

**Terminal condition B of the autonomous programme has been reached.** Every remaining roadmap
slice is blocked, and no eligible frontend work remains. Measured against the published ledger:

```text
blocked on the backend chain (S5 / S10 / S13, UNFROZEN at nortropic-system 32b6e07):
    ROOM-02 (live intake), ROOM-04, ROOM-05, ROOM-06,
    REMOTE-00 and every slice dependent on it — ROOM-07 (needs ROOM-06 + REMOTE-00),
    CONTEXT-01 (needs REMOTE-00), REMOTE-02, REMOTE-04
blocked on control-plane environment work owned by the backend's operating model:
    IDENTITY-01, IDENTITY-02, IDENTITY-03, OBSERVER-01, AUDIT-01, RETRO-01
blocked on external entitlements:
    REMOTE-01 (Claude Tag requires a Team/Enterprise org)
    REMOTE-03 (Claude Code Routines research preview)
transitively blocked by all of the above:
    HARDEN-01 (needs IDENTITY-01..03, REMOTE-00, CONTEXT-01), EMPIRICAL-01 (needs everything)
```

The fixture-backed and browser-side halves that could be built without a live backend have been
built. What is left is not frontend work that has been skipped; it is work whose prerequisites are
owned elsewhere. Terminal condition B is not completion of the programme and is not permission to
mark any blocked slice as done.

Nothing downstream of the backend chain is eligible for a LIVE claim.

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

## REMOTE_INTEGRATION_STATUS

At freeze, all remote integrations are `NOT_STARTED` as implementations. Their empirical proof
carries the entitlement prerequisites listed under CURRENT_BLOCKERS.

```text
REMOTE-00  common remote operator adapter      NOT_STARTED
REMOTE-01  Slack / Claude Tag                  NOT_STARTED
REMOTE-02  Claude Code Channels                NOT_STARTED
REMOTE-03  Claude Code Routines                NOT_STARTED
REMOTE-04  remote notifications and mobile     NOT_STARTED
```

## EXACT_NEXT_ACTION

There is no next frontend slice to author. The next actions are **owner decisions**, not Claude
runs:

```text
1. Advance the nortropic-system chain to unblock the live slices:
       h-031 (currently undefined — the backend's own next step must be defined first)
       → SUB-1..SUB-4 (h-027..h-030)
       → S5 / S10 / S13
   Landing S5 + S13 unblocks the live halves of ROOM-03 and ROOM-05; S10 + S13 unblocks ROOM-02;
   S13 unblocks ROOM-06, REMOTE-00 and the live mobile proof deferred by ROOM-08.

2. Optionally provision the Claude Tag entitlement (Team/Enterprise org, org-Owner pairing,
   Routines enabled) if REMOTE-01 empirical proof is wanted. This is a purchase/administration
   decision, not an implementation gap.

3. Optionally create the GitHub App "Nortropic Promoter" to unblock backend S7 and the
   IDENTITY-01 promoter principal.
```

The frontend programme resumes automatically from this handoff when a dependency lands: re-measure
both origin/main values, re-read CURRENT_NEXT_ELIGIBLE_SLICES against the newly satisfied
prerequisite, and author the first slice whose dependencies and authority prerequisites are then
genuinely met. Do not author a blocked slice in the meantime, and do not convert a fixture-backed
half into a live claim without the backend prerequisite actually being present.

Read `docs/nortropic-factory-room-master-roadmap-v1.md` for the frozen exit criteria, negative
controls and visual-review requirements of whichever slice unblocks first, and
`backlog/nortropic-factory-room-master-v1.json` for the machine-readable slice records.
