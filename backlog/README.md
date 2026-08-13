# Canonical backlog

`control-room-v1.json` is the **tracked, canonical** backlog of remaining control-room slices,
derived from `IMPLEMENTATION_SLICES` and `IMPLEMENTATION_ORDER` in
`docs/nortropic-control-room-plan-v1.md`. It is repository data that an operator reviews in a diff.

## What this file is not

- It is **not** runtime state. Claims, the autopilot ledger and owner-measured backend evidence live
  under the Git common directory (`<common-git-dir>/claude-factory/**`) and are never committed.
- It is **not** authority over the backend. A slice's backend dependency is recorded as a
  prerequisite that this repository cannot satisfy on its own.
- It is **not** an authority grant. `authorityClass` here is a declaration; entering the
  owner-author lane still requires an explicit supervisor selection (`--owner-author <taskId>` or
  the operator-local, git-ignored `.claude-loop.json`).
- It is **not** a Nortropic trust artefact. Nothing here verifies, attests or promotes anything.

## Fields

| Field | Meaning |
|---|---|
| `order` | Deterministic scheduling order. Follows the plan's `IMPLEMENTATION_ORDER` verbatim. |
| `declaredStatus` | `DONE` or `PENDING`. A `DONE` claim is believed only while every `completionEvidence` path exists; otherwise the slice evaluates to `BLOCKED`. |
| `dependsOn` | Slice ids that must be complete first. Unmet dependencies keep a slice `WAITING`. |
| `prerequisites` | Mechanical checks: `local_file`, `local_test`, `external_ref`, `external_file`, `external_slice`. |
| `fixtureOnly` | The slice's exit criteria are met against generated fixtures only. Requires `liveCounterpart`. |
| `completionEvidence` | Files that must exist for a `DONE` claim to be believed. |
| `task` | The task body materialized into a `TaskSpec`: description, exact write scope and mechanical gates. |

## Prerequisites are measured, never assumed

`local_file` and `local_test` are measured inside this repository — a file is checked on disk, a
test command is actually executed. `external_ref`, `external_file` and `external_slice` point into
`Nortropic/nortropic-system`, which this repository is not the authority for and cannot read from a
Factory run. Those prerequisites are **unmet until an owner records a measurement** in
`<common-git-dir>/claude-factory/backend-prerequisites.json`, whose entries must carry
`measuredBy: "owner"` and a 40-hex commit sha. No code in this repository writes that file, so a
Factory run can never satisfy its own backend prerequisite, and no amount of model prose about a
backend slice can move a live slice out of `WAITING`.

## Current shape

`V1`–`V3` are complete and carry their evidence. `V8-FIXTURE` is the only slice that can become
`READY` today: it is the intake UI against generated fixtures, it depends only on `V1`–`V3`, and it
is explicitly `fixtureOnly` with `liveCounterpart: "V8"`. **A fixture slice is never live-complete.**
Every backend-live slice (`V4`, `V5`, `V6`, `V7`, `V8`, `V9`) carries the backend slices it waits
for, and `V10`/`V11` wait on their in-repository dependencies.

`OM1` is an owner-authority documentation task. It is declared `owner-author`, so the scheduler
refuses to schedule it from repository data alone.

## Reading the backlog

```bash
npm run claude:backlog            # executed evaluation, including local_test prerequisites
npm run claude:autopilot-status   # evaluation + ledger + claims
```
