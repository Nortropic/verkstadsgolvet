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

Each iteration re-reads `origin/main`, the backlog, the owner evidence, the claims and the ledger **from disk**, picks the lowest-`order` `READY` slice, takes an atomic claim, records `RUNNING` before the run starts, and then runs the ordinary supervised pipeline: architect → write role → post-write exact scope validation → mechanical gates → immutable candidate → independent review → [progress-gated remediation](#remediation-circuit-breaker).

Because every decision is a pure function of files, a killed and restarted autopilot makes the same next decision instead of duplicating work. Chat context, model summaries and terminal output are never operational state.

Afterwards the scheduler re-reads `origin/main` and decides mechanically:

- **merged** — `origin/main` moved and Git proves it is a two-parent merge of the frozen base and the exact reviewed candidate. The ledger records `DONE`, and the next slice is based on that merged main (`autopilot.continueAfterMerge`).
- **unmerged** — `origin/main` is unchanged. The ledger records `AWAITING_PUBLICATION` and the pass stops rather than stacking candidates on a base that lacks the previous one. Slices depending on it stay unschedulable.
- **base drift** — `origin/main` moved to something that is not this candidate's merge. The ledger records `BLOCKED` and the pass stops. Nothing is published, rewritten or retried.
- **blocked run** — including a [no-progress circuit-breaker](#remediation-circuit-breaker) stop. The ledger records `BLOCKED` with the reason and the pass stops. A restart never retries it and never manufactures fresh remediation entitlement; that needs an explicit owner decision.
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

## Run recovery

A blocked run preserves its Git worktree and run state. Re-run:

```bash
npm run claude:resume -- <run-id>
npm run claude:resume -- <run-id> --owner-author <taskId>   # only for an owner-authority run
```

A resume takes an atomic **run claim** and keeps it heartbeating for the whole resume, so two operators cannot put two model sessions on the same recorded run and the same candidate however long the resume takes; a second resume is refused with the current owner's identity. If a resume is killed, its claim stops beating and becomes recoverable through `npm run claude:autopilot-recover`.

`claude:run --task` takes the same run claim for the whole run and releases it when the run ends, completed or blocked. A run that is **killed** never reaches that release, so its claim keeps the last heartbeat it wrote and expires: that expiry is the only evidence the Factory accepts that a supervisor process is gone.

### Process death

A killed supervisor cannot write its own epitaph: nothing else was ever going to move `state.json` out of `BUILD`/`REMEDIATE`/`REVIEW`, so the run sat in a non-terminal phase forever while `claude:autopilot-recover` printed `NOTHING_TO_RECOVER` — it swept claims and autopilot ledger rows, never run states. Recovery now also classifies every persisted run:

| Classification | What proves it | What recovery does |
|---|---|---|
| `LIVE` | a claim covering the run (its own run claim, or the autopilot's task claim) beat inside its TTL | nothing, ever — a live supervisor is never declared lost |
| `LOST` | such a claim exists but stopped beating beyond its TTL | releases the claim and demotes the non-terminal run to `BLOCKED` |
| `UNPROVEN` | no claim covers the run, or only a released one | **nothing**: it is listed as `RUN_UNRECOVERED` and waits for an explicit operator decision |
| `UNREADABLE` | the run state does not parse | nothing: it is listed, never written over |

```bash
npm run claude:autopilot-recover                 # sweep: stale claims, ledger rows, LOST run states
npx tsx scripts/claude-loop/cli.ts autopilot-recover --run <run-id>   # the explicit operator decision
```

The demotion writes exactly two fields — `phase` and `blockedReason` — on a run state re-read from disk at that moment. The reason begins with the stable prefix `supervisor process lost (recovered)`. Nothing else is touched: the candidate commit, its branch, its worktree, the recorded session identities, `attempt`, the pending findings and the append-only `progressHistory` all survive byte-identically, which is what makes the recovered run resumable rather than restartable. No ledger row is invented for a task that never had one.

A recovered run is **not** an entitlement. `supervisor process lost (recovered)` is not a breaker reason and not a budget reason, so `resume` continues through the ordinary path and `extend-remediation` still refuses it: recovery restores an accurate record, it never grants another model round. `--run` fails closed on a live claim, on an already-terminal run, on an unreadable state and on an unknown run id, and validates every named id **before** it writes anything.

### Telling live runs from abandoned ones

`npm run claude:status` and `npm run claude:autopilot-status` carry the classification and the heartbeat age of the claim it came from, so the judgement is mechanical instead of a manual read of claim files. Unknown ages render as `—`, never as an invented number:

```text
room-08_mobile_room-20260815000407  ROOM-08_MOBILE_ROOM  REMEDIATE  6831fbd…  UNPROVEN  heartbeat_age=—
```

`UNPROVEN` on an unfinished run means exactly one thing: that run was started before run claims covered the direct path, so nothing on disk proves anything about its process. It is reported rather than swept.

Do not reset/rebase/amend a blocked worktree. The supervisor resumes from recorded facts and existing immutable candidate commits. Terminal builder errors preserve the recoverable builder session ID in run state. A circuit-breaker block does NOT gain another model round by repeated `resume`; it requires an explicit owner re-open:

```bash
npx tsx scripts/claude-loop/cli.ts extend-remediation <run-id> 1
```

An extension is runtime workflow state, not publication or trust authority. Keep it bounded and owner-reviewed.

## Waiting for work

There is exactly **one** scheduler (`runAutopilot`) and exactly **one** canonical backlog. `watch-ready` adds neither: it blocks until there is something to wake up *for*, prints what woke it, and exits. It takes no claim, starts no run, writes no state and chooses between no slices — the caller decides what to do next.

```bash
npx tsx scripts/claude-loop/cli.ts watch-ready                       # any slice becomes READY
npx tsx scripts/claude-loop/cli.ts watch-ready --task ROOM-09        # that slice becomes READY (its dependencies are satisfied)
npx tsx scripts/claude-loop/cli.ts watch-ready --run <run-id>        # …or that run reaches DONE/BLOCKED
```

The observation is the same canonical evaluation the scheduler makes its own decisions on, so a slice becomes wake-worthy through the ordinary dependency and ledger rules and through nothing else. The wait is bounded by a mandatory timeout (`--timeout-ms`, default one hour; `--interval-ms` default 15s) so a wakeup can never drift into an unattended daemon. `WATCH_WAKE=READY|RUN_TERMINAL|TIMEOUT` is the marker; a timeout also exits non-zero, so a caller can branch without parsing prose. An unreadable or missing watched run is `—`, never a terminal verdict.

A pass that ends because there is nothing left to do now says so explicitly: `autopilot.no_ready_work` (with the number of slices completed in that pass) followed by `autopilot.stopped`. Every other stop reason emits `autopilot.stopped` alone — "awaiting publication" is not the same statement as "no work". Both are telemetry: no scheduling decision is taken, deferred or repeated by either.

## Remediation circuit breaker

The remediation loop is bounded by **progress**, not by a round count. A run that keeps genuinely closing work continues on its own, however many rounds that takes, with no operator involvement at all; a run that repeats itself stops on the evidence of that repetition.

`maxRemediationRounds` is **superseded**. It stays in `ConfigSchema` because operator configuration files carry it, and the legacy arithmetic for runs persisted before the breaker is still defined in terms of it, but it no longer bounds a progressing loop. There is deliberately **no configuration knob for the breaker**: the rules are code, reviewed like code.

A round is PROGRESS when the actionable finding set changed, shrank or disappeared, when the candidate advanced through a new immutable descendant commit, or when a failing gate moved on. Continuation requires progress; every other verdict throws and fails the run closed.

### Fingerprints

Findings are compared mechanically and phrasing-tolerantly. A per-finding fingerprint is `severity + file + normalized message` (lowercase, whitespace collapsed, digit runs replaced by `#`); the reviewer-assigned `id` and `line` are **excluded**, because both are unstable across rounds and either would let a materially identical repeat present itself as fresh work. The set fingerprint is the SHA-256 of the sorted per-finding fingerprints. A gate fingerprint is the exact gate argv plus the first non-empty output line, normalized the same way. Severity `note` findings are advisory: they flow to `advisoryFindings`, never start a remediation round, and are excluded from every fingerprint.

### Verdicts

Every stage that produces actionable findings is classified before the next remediation round starts. A block reason always begins with a stable prefix.

| Rule | Blocks when | Reason prefix |
|---|---|---|
| `identical-repeat` | The same stage repeats the finding-set fingerprint the preceding remediation was asked to fix, and that remediation changed no file the finding set names. Blocks on the **first** repeat. | `no-progress circuit breaker: ` |
| `churn-cap` | The same fingerprint from the same source occurs a **third** time in one run, however much changed in between. | `no-progress circuit breaker: ` |
| `oscillation` | A round produces a candidate whose **tree** already appeared in this run — including the frozen base, i.e. the work was undone. | `no-progress circuit breaker: ` |
| `no-change-ready` | The write role reports READY without creating any change while findings are pending. The first one still gets **one** fresh independent review (a fresh reviewer may legitimately withdraw its own finding); a second consecutive one blocks without another review. | `no-progress circuit breaker: ` |
| `gate-repeat` | The same gate fingerprint fails in two consecutive rounds with the judged tree unchanged, or in three consecutive rounds regardless of change. | `no-progress circuit breaker: ` |
| `absolute-backstop` | The run reaches the frozen `ABSOLUTE_ROUND_BACKSTOP = 30` rounds — the terminal defense against pathological always-different churn. | `absolute round backstop: ` |

A finding that names files is answered only by a change to one of those exact files. A finding that names no file cannot be located, so any candidate change counts as relevant: the breaker fails open on ambiguity and closed only on evidence.

### Evidence and restart

Verdicts are computed by `scripts/claude-loop/progress.ts`, which is **pure over persisted data** — no clock, no randomness, no Git call inside a classifier. The evidence is an append-only `progressHistory` on the run state: each record carries the round, the source stage, the candidate SHA and tree SHA the stage judged, the finding-set fingerprint, the files those findings named, and whether the remediation leading into the stage changed any of them. Records are never rewritten, removed or reordered, and the blocking record is appended before the run stops.

So a killed and restarted supervisor re-derives the **identical** verdict from the identical history. `resume` refuses a breaker-blocked run exactly as it refuses a legacy budget-blocked one, and never truncates, resets or re-fingerprints the history: **a restart cannot manufacture fresh retry entitlement.**

### Owner re-open

`extend-remediation` re-opens a run blocked by the breaker, and still re-opens runs blocked before the breaker existed (the retired `remediation budget exhausted after ` reason stays extendable, so old persisted runs remain loadable, extendable and resumable). The extension appends an explicit `owner-extension` marker to the history; the classifier reads the window after that marker, which is what gives the re-opened run a genuine fresh chance instead of re-deriving the same stale verdict. `attempt` is never reset and history is never truncated.

The absolute backstop is **never** extendable. At 30 rounds the run id is terminally blocked and the only escape is a fresh sequential run.

The breaker is a stop condition only. It never widens a permission, never upgrades a lane, and leaves authority resolution, exact scope validation, claims and fencing, candidate lineage and the Publication v2 guards exactly as they were. Telemetry adds `progress.recorded` and `circuit_breaker.blocked`; no existing event was renamed. Regression coverage lives in `tests/claude-loop/autonomy-circuit-breaker.test.ts`, which runs real supervised runs against disposable Git repositories with injected role results and never touches the real repository.

## Visual review

For UI tasks, the supervisor starts `visual.previewCommand`, waits for `visual.previewUrl`, captures configured viewports with Playwright, and asks the independent `visual-reviewer` to inspect those PNGs. Browser screenshots are evidence for workflow review, not Nortropic trust authority.

### What is captured

Per viewport, every run now writes two images:

- `<viewport>-<w>x<h>.png` — the fullPage shot (unchanged filename and unchanged behavior).
- `<viewport>-<w>x<h>-clip.png` — the viewport-sized top-of-page clip. A tall fullPage image is downscaled to a few percent when a reviewer looks at it, so legibility, touch-target and focus judgements are made from the clip.

### `visual.captureStates` (optional)

`visual.captureStates` declares additional capture situations. It is optional and additive: a task without it keeps exactly the previous evidence set (plus the clips above), and existing task JSON keeps validating unchanged. Each entry produces both a fullPage shot and a clip per viewport, named `<state>-<viewport>-<w>x<h>.png` and `<state>-<viewport>-<w>x<h>-clip.png`.

| Field | Meaning |
| --- | --- |
| `name` (required) | Evidence filename segment. Filename-safe alphabet only (`[A-Za-z0-9][A-Za-z0-9._-]*`), so a state can never steer a screenshot out of the run's evidence directory. |
| `url` | URL to capture for this state. Defaults to `previewUrl`. Declaring several states with different URLs captures several routes in one run — the fix for "the task's `previewUrl` points at the wrong route", which a builder cannot repair because task data is frozen for the run. |
| `openDisclosures` | Opens every `<details>` on the page before the shot, so collapsed content is actually reviewable. |
| `focusSelector` | Parks real keyboard focus on the element before the shot, so the screenshot carries genuine focus-ring evidence. |
| `scrollToSelector` | Scrolls the named element into view before the shot, which frames the clip on the region under review. |

Applied in that order (disclosures, then focus, then scroll), so a declared scroll target wins the final framing.

Example:

```json
"visual": {
  "previewCommand": ["npm", "run", "dev"],
  "previewUrl": "http://localhost:3000/loop",
  "authenticated": true,
  "captureStates": [
    { "name": "loop-expanded", "openDisclosures": true },
    { "name": "loop-focus", "focusSelector": "#primary-action" },
    { "name": "mata", "url": "http://localhost:3000/loop/mata", "openDisclosures": true }
  ]
}
```

### Capture-state limits and security

- **Selectors only, never task-supplied code.** `focusSelector` and `scrollToSelector` are passed as CSS selectors to the standard Playwright selector APIs, and `openDisclosures` runs a fixed `details` query written in `scripts/claude-loop/visual-review.ts`. No task field is ever evaluated as JavaScript in the preview: a task says WHICH element to open, focus or scroll to, never WHAT code runs there.
- **Loopback-only applies to every captured URL.** With `authenticated: true`, each `captureStates[].url` carries exactly the same loopback restriction as `previewUrl`, refused both by the task schema and again at runtime before the preview child starts or any navigation happens. Anonymous (`authenticated: false`, the default) remote previews are unchanged.
- Each captured URL is reached by a real same-origin login with fresh, disposable, preview-only credentials injected into the preview child only — no cookie fabrication — and the exact-target assertion is applied per navigated URL, so an off-origin redirect fails closed.

Coverage: `tests/claude-loop/visual-capture-states.test.ts` (capture states, clips, multi-URL, filename safety, legacy compatibility) alongside the unchanged `visual-auth*.test.ts` and `visual-preview-child-env.test.ts` suites.

## Pre-publication runtime checks

After dependency/security changes, run the production build and `npx tsx scripts/claude-loop/auth-runtime-smoke.ts`. The auth smoke starts the built app with disposable credentials, proves anonymous redirect, failed credentials, a real successful Credentials session, middleware-authorized navigation and session reload. Build warnings are not treated as runtime PASS by themselves.
