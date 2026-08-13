# Claude Factory v1 — runbook

## Commands

```bash
npm run claude:doctor
npm run claude:selftest
npm run claude:status
npm run claude:live-smoke
npm run claude:empirical-smoke
npm run claude:run -- --task path/to/task.json
npm run claude:watch

npm run claude:backlog             # executed evaluation of the canonical backlog
npm run claude:autopilot           # deterministic backlog scheduler (disarmed by default)
npm run claude:autopilot-status    # evaluation + ledger + claims
npm run claude:autopilot-recover   # release stale claims; optionally clear a ledger entry
```

`claude:live-smoke` and `claude:empirical-smoke` consume Claude usage. The empirical smoke uses a disposable Git repository/local bare origin and runs architect → builder → mechanical gate → immutable candidate → independent reviewer without publishing. `doctor`, `selftest` and `status` do not invoke a model.

## Task format

Start from `.claude-loop.example-task.json`. A task defines exact allowed-write patterns, mechanical gates and whether visual review is required. Gates and preview commands are argv arrays, never shell strings. UI tasks with visual review must provide a preview argv and URL. `authorityClass` defaults to `ordinary` and is only a declaration — see [Owner-author lane](#owner-author-lane).

## Canonical backlog

`backlog/control-room-v1.json` is the tracked backlog of remaining control-room slices, derived from the plan's `IMPLEMENTATION_SLICES` and ordered by its `IMPLEMENTATION_ORDER`. `backlog/README.md` documents every field. It is repository data an operator reviews in a diff; it is never runtime state and never backend authority.

A slice's effective status is computed, never read from the file:

| Status | Meaning |
|---|---|
| `DONE` | Declared complete **and** every `completionEvidence` path exists **and** every slice it depends on is itself complete. |
| `READY` | Dependencies complete and every prerequisite measured as met. Schedulable. |
| `WAITING` | An unmet dependency, an unmet prerequisite, an existing ledger entry, or an unselected owner-author declaration. |
| `BLOCKED` | A `DONE` claim that its own evidence or its dependencies do not support. Nothing downstream becomes schedulable. |

Prerequisites are measured, not assumed. `local_file` is checked on disk and `local_test` is actually executed (cheap checks run first, and a failure short-circuits the expensive ones). `external_ref`, `external_file` and `external_slice` name things in `Nortropic/nortropic-system`, which this repository is not the authority for and cannot read: they are unmet until an owner records a measurement in `<common-git-dir>/claude-factory/backend-prerequisites.json` with `measuredBy: "owner"` and a 40-hex sha. No code here writes that file, so a Factory run can never satisfy its own backend prerequisite, and no model prose about a backend slice moves a live slice out of `WAITING`.

Today `V1`–`V3` are `DONE`, `V8-FIXTURE` is the only `READY` slice — the intake UI against generated fixtures, explicitly `fixtureOnly` with `liveCounterpart: "V8"` — and every backend-live slice waits on the backend slices it names. **A fixture slice is never live-complete**; its materialized task says so in words.

## Autopilot

`npm run claude:autopilot` schedules backlog work. It is disarmed in the shipped configuration (`autopilot.enabled=false`) and then touches nothing at all: no fetch, no claim, no ledger write. `--force` runs a single explicit operator-driven pass.

Each iteration re-reads `origin/main`, the backlog, the owner evidence, the claims and the ledger **from disk**, picks the lowest-`order` `READY` slice, takes an atomic claim, records `RUNNING` before the run starts, and then runs the ordinary supervised pipeline: architect → write role → post-write exact scope validation → mechanical gates → immutable candidate → independent review → bounded remediation.

Because every decision is a pure function of files, a killed and restarted autopilot makes the same next decision instead of duplicating work. Chat context, model summaries and terminal output are never operational state.

Afterwards the scheduler re-reads `origin/main` and decides mechanically:

- **merged** — `origin/main` moved and Git proves it is a two-parent merge of the frozen base and the exact reviewed candidate. The ledger records `DONE`, and the next slice is based on that merged main (`autopilot.continueAfterMerge`).
- **unmerged** — `origin/main` is unchanged. The ledger records `AWAITING_PUBLICATION` and the pass stops rather than stacking candidates on a base that lacks the previous one. Slices depending on it stay unschedulable.
- **base drift** — `origin/main` moved to something that is not this candidate's merge. The ledger records `BLOCKED` and the pass stops. Nothing is published, rewritten or retried.
- **blocked run** — including an exhausted remediation budget. The ledger records `BLOCKED` with the reason and the pass stops. A restart never retries it and never widens the budget; that needs an explicit owner decision.
- **claim lost** — this supervisor was taken over while running. It records nothing for the slice and stops; the outcome belongs to whoever holds the claim now.

The autopilot never publishes and never moves `main`. Its entire Git vocabulary is `fetch`, `rev-parse` and `rev-list`; publication stays behind the unchanged Publication v2 guards below.

### Claims, ledger and recovery

Claims and the ledger live only under the Git common directory, shared by every worktree of the repository:

```text
<common-git-dir>/claude-factory/claims/<task|run>/<key>/<epoch>.json
<common-git-dir>/claude-factory/autopilot/ledger/<taskId>.json
<common-git-dir>/claude-factory/autopilot/ledger.json      (aggregate view; merged on read)
<common-git-dir>/claude-factory/backend-prerequisites.json
```

A claim epoch is a file name, and creating that file is an exclusive create — that single kernel operation is the whole mutual exclusion, so two supervisors can never both own a slice and never both produce a candidate for it. Epochs are append-only, so a takeover preserves the evidence of the previous owner.

**Liveness is a heartbeat, not an age.** A held claim is refreshed for the whole lifetime of its run: a background ticker beats at `min(60s, claimTtlSeconds/3)`, and the supervisor beats again at every checkpoint — each phase transition, each remediation round, each builder continuation and every run-state write. A claim is stale only when that heartbeat is older than `autopilot.claimTtlSeconds`, so a run that legitimately takes hours is never mistaken for an abandoned one, and `claimTtlSeconds` bounds *silence*, not run length.

The beat is also a fail-closed checkpoint. If a supervisor discovers that its claim was taken over, it raises `ClaimLostError` and stops: it writes no further run state, records no ledger outcome for the slice, and leaves both to the supervisor that now holds the claim.

Every ledger mutation writes exactly **one** file — the task id the writing supervisor holds the claim for — through a temp file and `rename`. A supervisor therefore cannot drop another supervisor's record from a stale snapshot (a lost `DONE` record would make already merged work schedulable again), and a concurrent reader never sees a partially written file. `loadLedger` merges the aggregate view with the per-task files, which win.

```bash
npm run claude:autopilot-status
npm run claude:autopilot-recover
npm run claude:autopilot-recover -- --clear V8-FIXTURE
```

Recovery releases **only** claims that stopped heartbeating and demotes the `RUNNING` entries they abandoned to `BLOCKED` with an explicit reason. It never invents a completion: the abandoned run's worktree and run state are preserved for inspection, and rescheduling requires the deliberate `--clear`. A `DONE` entry is evidence and cannot be cleared.

## Owner-author lane

An owner-authority task edits the owner's workflow-authority documents (`CLAUDE.md`, `.claude/**`, `docs/claude-operating-model-v1.md`) that the ordinary product builder may never touch. It is **workflow authority only** — never a security boundary, never Nortropic Trust Kernel authority, never publication or promotion authority.

The lane is entered **only** by an explicit supervisor selection:

```bash
npm run claude:autopilot -- --owner-author OM1
npm run claude:run -- --task path/to/task.json --owner-author OM1
npm run claude:resume -- <run-id> --owner-author OM1
```

or the operator-local, git-ignored `.claude-loop.json` (`ownerAuthor.selectedTaskIds`). A backlog entry, a task file, persisted run state and model output can only ever *declare* `authorityClass: "owner-author"`; a declaration without a selection is an escalation attempt and fails the run closed with `OWNER_AUTHOR_SELF_CLAIM`. The scheduler additionally refuses to schedule an owner-author slice from repository data alone.

**A resume is not a shortcut into the lane.** Run state lives under the Git common directory, outside every worktree, so a mutated `authorityClass` there is invisible to changed-file validation. `claude:resume` therefore re-resolves the class against the selection given in *that* invocation — exactly like a fresh run — rather than trusting the persisted field, and refuses without one.

The selection is only ever read from the **operator's checkout**: `loadConfig` resolves `.claude-loop.json` through the Git common directory, never relative to the current working directory, because supervisor steps (mechanical gates among them) legitimately run with `cwd` inside a candidate worktree. The tracked `.claude-loop.example.json` is shipped *defaults*, not an authority grant: whenever the configuration comes from it, `ownerAuthor.selectedTaskIds` is forced empty, so a task that is allowed to edit that file cannot select its own lane. On top of that, `.claude-loop.json` and `.claude-loop/**` are never-writable paths, and — since a git-ignored file appears in no diff and no changed-file set — the supervisor asserts by **existence** that no `.claude-loop.json` sits in the run worktree, before gates, candidate and review. Finding one blocks the run.

When selected, the write role becomes `owner-author` and runs isolated under Claude Agent SDK 0.3.228:

- `settingSources: []` — no project, user or local settings are loaded, so the lane cannot be widened by a file the same lane is allowed to rewrite;
- `settings: scripts/claude-loop/owner-author/settings.json` — a dedicated, supervisor-owned settings file that denies `gh`, push, reset, rebase, amend, `update-ref`, `filter-branch`, all credentials and all network domains;
- `systemPrompt: scripts/claude-loop/owner-author/system-prompt.md` — a dedicated prompt that states the lane is workflow authority only and that self-selection is impossible.

Ordinary roles are unchanged (`settingSources: ['project']`). An owner-author run may never be armed for auto-merge: authority documents are not promoted by a model turn.

## Write scope

Scope is validated **after** the writes, on the changed-file set the supervisor derives from Git (tracked and untracked), and again cumulatively over the whole candidate against the frozen base. A single file outside the exact scope blocks the run before any gate, candidate or reviewer. The rules fail closed in order: unsafe path (absolute, traversal, home-relative, drive-qualified) → never-writable → task `deniedWrite` → workflow-authority path → not matched by any `allowedWrite` pattern.

`docs/nortropic-control-room-plan-v1.md`, `docs/nortropic-control-room-codex-handoff.md`, every `.env*`, `.git/**`, `.claude-loop.json` and `.claude-loop/**` are never writable by **any** lane. `CLAUDE.md`, `.claude/**` and `docs/claude-operating-model-v1.md` are writable only by a supervisor-selected owner-author run whose task names them explicitly; an ordinary task may not even declare them.

## Publication

`.claude-loop.example.json` documents publication switches. `publish.enabled` and `publish.autoMerge` both default to `false` and `publish.mergeMethod` is `merge`. Enabling publication is an explicit operator choice after the first empirical run. `/.claude-loop.json` is the operator-local runtime override, is git-ignored, and is never task or product authority.

### Merge method

The only supported Factory auto-merge is a **normal GitHub merge commit**. `publish.mergeMethod` accepts `merge` and nothing else: a configuration asking for `rebase` or `squash` fails configuration validation instead of silently selecting another method. Rebase and squash would put a NEW commit on `main`, so the object that lands would not be the object an independent reviewer read. The supervisor passes the configured method explicitly into publication; it is never an unused config field.

### `publish.enabled=true`, `autoMerge=false`

Ordinary non-force branch push, PR creation, exact verification of PR state, base ref/SHA, head ref/SHA and the mechanically derived changed-file set — then stop. Nothing is merged.

### `publish.enabled=true`, `autoMerge=true`

Immediately before merging, every fact is re-locked; nothing observed earlier in the run is trusted:

- `origin/main` is re-fetched and must still equal the run's frozen `baseSha`;
- the worktree HEAD must still be the exact independently reviewed `candidateSha`;
- the remote candidate branch must still be that same `candidateSha`;
- the PR is re-read and must still be open, with `base.ref=main`, `base.sha=baseSha`, `head.ref` the exact Factory branch and `head.sha=candidateSha`;
- the PR's changed files must exactly equal the mechanically derived candidate changed-file set.

The merge is then performed through GitHub's merge API with the expected head SHA and `merge_method=merge`. `gh pr merge --rebase`/`--squash`, `--delete-branch`, `--admin`, force push, amend, reset and rebase are never used and are rejected by argument guards before any process is spawned.

### Post-merge proof

An API response is not proof. A merge counts as successful only when GitHub explicitly reports `merged=true` with a valid merge SHA **and** Git then confirms all of:

- freshly fetched `origin/main` equals that merge SHA;
- the merge commit has exactly two parents;
- parent 1 is the frozen `baseSha`;
- parent 2 is the exact reviewed `candidateSha`;
- the merge tree equals the reviewed candidate tree.

A tree-equivalent but wrongly parented or history-rewritten result is a BLOCK, not a success. Any refusal, conflict or drift is a BLOCK. The candidate commit and its remote branch are immutable publication evidence and are never deleted by publication.

Regression coverage lives in `tests/claude-loop/publication-merge-commit.test.ts`, which runs against disposable local Git repositories with an injected GitHub seam and never touches the real repository.

### Operating-model supersession (pending operator edit)

`docs/claude-operating-model-v1.md` still carries the pre-merge-commit wording in its "Candidate and publication" section:

> Publication support exists in v1 but defaults off. When enabled, push is ordinary non-force push, PR base/head are checked, and auto-merge (if separately enabled) uses expected-head guarded rebase merge. A changed base blocks publication rather than silently rewriting history.

That sentence is **superseded by this Publication section and no longer describes the implementation**: expected-head guarded rebase merge no longer exists in the Factory, and `publish.mergeMethod` rejects `rebase` at configuration validation. The operating model is a protected authority path that product agents may not edit — `CLAUDE.md`, `.claude/settings.json` (`Edit(/docs/claude-operating-model-v1.md)`) and `.claude/hooks/pre-tool-guard.mjs` all block it — so the correction must be applied by an operator with settings authority, using exactly this replacement paragraph:

> Publication defaults off. When enabled, push is ordinary non-force push and PR base, head and file scope are verified exactly. Auto-merge, separately enabled, is a normal GitHub merge commit performed through the merge API with the expected head SHA and `merge_method=merge`; rebase, squash, force push, amend and reset are never used. A merge succeeds only when GitHub reports `merged=true` and Git then proves that `origin/main` is a two-parent merge commit whose first parent is the frozen base and whose second parent is the exact reviewed candidate, carrying the reviewed tree. A changed base, any drift or any refusal blocks publication rather than rewriting history. The candidate commit and its remote branch stay immutable evidence. See `docs/claude-loop-runbook.md` for the full guard list.

Once that edit is applied, this supersession subsection can be deleted. `tests/claude-loop/publication-merge-commit.test.ts` mechanically enforces the pair: while the stale wording is present the notice above must quote it verbatim and carry the replacement, and once the operating model is corrected the test requires the corrected merge-commit semantics there instead.

## Run recovery

A blocked run preserves its Git worktree and run state. Re-run:

```bash
npm run claude:resume -- <run-id>
npm run claude:resume -- <run-id> --owner-author <taskId>   # only for an owner-authority run
```

A resume takes an atomic **run claim** and keeps it heartbeating for the whole resume, so two operators cannot put two model sessions on the same recorded run and the same candidate however long the resume takes; a second resume is refused with the current owner's identity. If a resume is killed, its claim stops beating and becomes recoverable through `npm run claude:autopilot-recover`.

Do not reset/rebase/amend a blocked worktree. The supervisor resumes from recorded facts and existing immutable candidate commits. Terminal builder errors preserve the recoverable builder session ID in run state. A remediation-budget block does NOT gain another model round by repeated `resume`; it requires an explicit owner extension:

```bash
npx tsx scripts/claude-loop/cli.ts extend-remediation <run-id> 1
```

An extension is runtime workflow state, not publication or trust authority. Keep it bounded and owner-reviewed.

## Visual review

For UI tasks, the supervisor starts `visual.previewCommand`, waits for `visual.previewUrl`, captures configured viewports with Playwright, and asks the independent `visual-reviewer` to inspect those PNGs. Browser screenshots are evidence for workflow review, not Nortropic trust authority.

## Pre-publication runtime checks

After dependency/security changes, run the production build and `npx tsx scripts/claude-loop/auth-runtime-smoke.ts`. The auth smoke starts the built app with disposable credentials, proves anonymous redirect, failed credentials, a real successful Credentials session, middleware-authorized navigation and session reload. Build warnings are not treated as runtime PASS by themselves.
