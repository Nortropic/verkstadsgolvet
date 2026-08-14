# Nortropic Factory Room — handoff v1

Entrypoint for a future Claude Code session picking up the Factory Room programme.

Updated only through a dedicated, mechanically scoped status task after a published slice. Chat
memory is never continuation authority.

```text
MASTER_ROADMAP_PATH   = docs/nortropic-factory-room-master-roadmap-v1.md
MASTER_ROADMAP_COMMIT = SET_AT_PUBLICATION — the merge commit of this slice
                        (unknowable before merge; the first STATUS task after publication replaces
                        this line with the real SHA)
MASTER_BACKLOG_PATH   = backlog/nortropic-factory-room-master-v1.json
```

## CURRENT_AUTHORITATIVE_MAIN

Measured 2026-08-14.

```text
Nortropic/verkstadsgolvet  origin/main = 4e5e796506599f36d124248652014061f7d3985d
    measurement: git rev-parse origin/main (in the run worktree, 2026-08-14)
Nortropic/nortropic-system origin/main = 32b6e076f96d095d32bb7bf9e6c2519632af80a1
    measurement: git rev-parse origin/main, run by the supervising session outside this worktree,
    2026-08-14. This repository cannot and does not measure that repository.
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

Factory Room programme slices completed: NONE.
`MASTER-00` is `IN_FLIGHT` at authoring time; its merge SHA becomes `MASTER_ROADMAP_COMMIT`.

## CURRENT_BLOCKERS

```text
BACKEND_CHAIN
  evidence: nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07
  blocks:   ROOM-02 (live intake, S10+S13), ROOM-04 (controller-side identity fields),
            ROOM-05 (live snapshot cutover, S5+S13), ROOM-06 (live commands, S13),
            REMOTE-00 (controller-side interface, S13)
  note:     the backend's own next step is h-031, then supervisor resume, then first autonomous
            launch, then SUB-1..SUB-4 (h-027..h-030), then S2, S4–S13, then L.

PROMOTER_APP_MISSING
  evidence: GitHub App "Nortropic Promoter" does not exist
            (nortropic-system docs/loop/codex-autopilot-v3-full-roadmap.md; only
            FULL_ROADMAP_SOFTWARE_COMPLETE may be set until it exists)
  blocks:   IDENTITY-01 promoter principal, promotion-authority projection in ROOM-04

CLAUDE_TAG_ENTITLEMENT
  evidence: Claude Tag is public beta, Team/Enterprise plans only, requires org-Owner pairing and
            Routines enabled; no custom MCP backends, no inbound API layer
            (/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md)
  blocks:   REMOTE-01 empirical proof

ROUTINES_PREVIEW_ENTITLEMENT
  evidence: Claude Code Routines is a research preview, account-owned scheduled cloud runs,
            beta header anthropic-beta: experimental-cc-routine-2026-04-01 (same evidence file)
  blocks:   REMOTE-03 empirical proof
```

No blocker above is permission to drop a deliverable. Fixture-backed and design halves continue.

## CURRENT_NEXT_ELIGIBLE_SLICES

```text
1. ROOM-01  Factory Room shell — presentation only, fixture-backed, no backend prerequisite.
2. SUPERVISOR-01  measured-gap closure in scripts/claude-loop/** (inventory first).
3. ROOM-03  causal timeline and evidence projection (fixture-backed half).
4. ROOM-08  responsive and mobile Factory Room (after ROOM-01).
```

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

Author and run `ROOM-01` (Factory Room shell) through the Claude Factory: write the task file, run
it with `npm run claude:run`, take it through builder, independent reviewer and visual reviewer, and
publish under guard. `ROOM-01` is presentation-only and has no backend prerequisite; it must not
introduce a backend authority, state store, event contract, API route, credential or natural-language
command executor, and must not describe fixture data as live.

Read `docs/nortropic-factory-room-master-roadmap-v1.md` section 5 (ROOM-01) for the frozen exit
criteria, negative controls and visual-review requirements, and
`backlog/nortropic-factory-room-master-v1.json` for the machine-readable slice record.
