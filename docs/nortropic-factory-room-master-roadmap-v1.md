# Nortropic Factory Room — master roadmap v1

## Document identity and freeze semantics

```text
ROADMAP_ID                 = nortropic-factory-room-master-v1
ROADMAP_PATH               = docs/nortropic-factory-room-master-roadmap-v1.md
HANDOFF_PATH               = docs/nortropic-factory-room-handoff-v1.md
BACKLOG_PATH               = backlog/nortropic-factory-room-master-v1.json
OWNING_REPOSITORY          = Nortropic/verkstadsgolvet
MEASURED_AT                = 2026-08-14
VERKSTADSGOLVET_MAIN       = 4e5e796506599f36d124248652014061f7d3985d (measured 2026-08-14)
NORTROPIC_SYSTEM_MAIN      = 32b6e076f96d095d32bb7bf9e6c2519632af80a1 (measured 2026-08-14 by the supervising session)
```

This roadmap ADDS a programme on top of the existing authority documents. It contradicts none of
them. `docs/nortropic-control-room-plan-v1.md` and `CLAUDE.md` remain authoritative for Maskinen's
authority model; `docs/claude-operating-model-v1.md` remains authoritative for how Claude Factory
work is executed; `Nortropic/nortropic-system` `AGENTS.md` remains authoritative for controller-side
work. Where this document and those documents could be read as disagreeing, they win.

FREEZE SEMANTICS: after independent review and guarded publication of this file, the requirements
portion of this document (product vision, adopted source requirements, trust and authority
boundaries, the slice list and each slice's scope, the source-coverage ledger item list, and the
final-report schema) is FROZEN. Ordinary product builders must not rewrite it. A builder working a
slice may not soften an exit criterion, delete a negative control, merge or rename a slice, or
reclassify a ledger item to make an implementation pass. Changes to the frozen portion require a
separate, explicit roadmap-authority task. The mutable portions are: per-slice status, evidence
references and published SHAs recorded in `backlog/nortropic-factory-room-master-v1.json`, and the
current-state inventory when a later measurement supersedes an earlier one (the superseding
measurement command and date must be recorded with it).

No product implementation for this programme begins before this file, the handoff and the backlog
are published.

---

## 1. Product vision

The Nortropic Factory Room is a persistent room — not a dashboard, not a report page — in which the
operator and the factory share one continuous working surface.

In the Factory Room the operator can:

- **Feed work in.** Drop, select or paste Markdown work descriptions and hand them to the factory
  through a narrow typed intention. The room accepts the material; the controller decides what it
  becomes.
- **Watch the factory work.** See the current task, the current phase, what the factory is doing
  right now, what it just finished, and what it is waiting for — as a narrative, not as a matrix of
  competing status widgets.
- **Inspect exact evidence.** For any task or candidate: source identity and hash, base SHA,
  candidate SHA, attempts, gate verdicts, review findings, attestation existence, promotion state
  and evidence references — the actual identifiers, not a paraphrase.
- **Issue narrow typed intentions.** A closed, versioned set of verbs. Never a command string, never
  a shell, never Git.
- **Do all of it remotely.** From Slack / Claude Tag, from a Claude Code Channel, on a schedule via
  Claude Code Routines, and from a phone — through one Nortropic-owned operator adapter that exposes
  exactly the same typed intentions as the browser room.
- **Leave and come back.** Durable room context carries preferences, summaries, decisions and links
  to canonical evidence across sessions, so the operator does not restart the conversation from zero.

Throughout all of this the controller remains sole authority. The room is where work is *asked for*
and *observed*. It is never where work becomes true. A model in the room may summarize, explain and
propose; it may never mint state. The room's own memory is ergonomics, never truth.

The programme is finished when an operator can, from a phone, submit real work to the factory, watch
it be planned, built, reviewed, remediated and gated, publish it under guard, and read back the
authoritative result — with every step attributable to a mechanically authenticated identity, and
with no interactive terminal handoff required during the ordinary flow.

---

## 2. Adopted source requirements

Two requirement sources are adopted into this programme in full. Their individual requirement items
are carried verbatim in section 6 (source-coverage ledger) and each item carries exactly one status.

```text
SOURCE_A = Claude Tag / persistent teammate / remote conversational workspace.
SOURCE_B = Agent identity / service accounts / access bundles / Agent Proxy / persistent sessions /
           audit and evidence.
```

Adoption rules:

- No adopted item may be dropped, renamed, merged into another item, or silently reclassified.
- Lack of an external account, entitlement or production availability is a `BLOCKED` result with
  exact prerequisite evidence — never permission to remove an item.
- `PROVEN` requires exact implementation plus evidence references. A design document, a plan section,
  a task description or a model's prose is never proof.
- No percentages are used anywhere in this programme's status reporting.

---

## 3. Current-state inventory

Every roadmap item below was MEASURED against `Nortropic/verkstadsgolvet` at
`4e5e796506599f36d124248652014061f7d3985d` on 2026-08-14, from inside the run worktree. Backend
facts come from the supervising session's measurement of `Nortropic/nortropic-system` at
`32b6e076f96d095d32bb7bf9e6c2519632af80a1` on the same date; this repository cannot measure that
repository and does not attempt to.

Classification vocabulary: exactly one of

- `PROVEN_EXISTING` — implemented, present at the cited path, covered by a test or gate.
- `PARTIAL` — some mechanically present material, insufficient for the roadmap item.
- `ABSENT` — measurement returns nothing.
- `OVERIFIERAT` — an implementation exists but the claim it would support is unverified against the
  real counterpart (typically: a live path with no live counterpart to verify against).

### 3.1 Verkstadsgolvet — existing control-room slices

| Item | Measurement | Result | Class |
| --- | --- | --- | --- |
| V1 typed contracts + generated fixtures | `ls lib/loop/fixtures; grep -n "TASK_LIFECYCLE\s*=" -A16 lib/loop/schema.ts` | `lib/loop/schema.ts`, `lib/loop/labels.ts`, `lib/loop/fixtures/{generate.ts,index.ts,snapshot.json,events.json,commands.json,intake-*.json,events-*.json}`; `TASK_LIFECYCLE` at `lib/loop/schema.ts:126-138` lists exactly RAW PLANNING NEEDS_SPEC READY QUEUED WORKING VERIFYING REVIEWING MERGING DONE STOPPED; tests `tests/loop/{schema,fixtures,ordering,labels}.test.ts` | `PROVEN_EXISTING` |
| V2 Maskinen shell | `ls components/loop; grep -n "Shell" "app/(app)/loop/page.tsx"` | `components/loop/MaskinShell.tsx`, `MaskinHeader.tsx`, `TaskCard.tsx`, `BacklogColumn.tsx`, `CompletedColumn.tsx`, `CurrentTaskPanel.tsx`, `PhaseRail.tsx`, `RunStatusBar.tsx`, `StaleBanner.tsx`; page `app/(app)/loop/page.tsx` renders `MaskinShell snapshot={snapshot} fixture={FIXTURE_MODE}`; test `tests/loop/v2-maskinen-shell.test.ts` | `PROVEN_EXISTING` (fixture-backed) |
| V3 read model, SNAPSHOT_WINS | `grep -rn "SNAPSHOT_WINS" lib/` | `lib/loop/snapshot.ts:12` (`SNAPSHOT_WINS = YES`), conflict resolution emitted as `resolution: "SNAPSHOT_WINS"` at `lib/loop/snapshot.ts:402,414,446`; seq-only ordering documented and implemented in `lib/loop/events.ts:14-21`; test `tests/loop/v3-read-model.test.ts` | `PROVEN_EXISTING` |
| V4 live read plane (code) | `ls -R app/api/loop` | the command lists FIVE route directories. Four are the V4 read plane: `app/api/loop/snapshot/route.ts`, `app/api/loop/events/route.ts`, `app/api/loop/task/route.ts`, `app/api/loop/stream/route.ts`, plus `lib/loop/transport.ts`; test `tests/loop/v4-live-read-plane.test.ts`. The fifth, `app/api/loop/command/route.ts`, belongs to the V7 command surface (row below) and its transport is deliberately closed | `PROVEN_EXISTING` |
| V4 live read plane (live behaviour) | supervising session's backend measurement | the controller publishes nothing outward at `32b6e07`: no Supabase/HTTP/socket sender under `controller/`, `scripts/`, `tests/`; no `event_type`, no `seq`, no `event_id` anywhere in backend code | `OVERIFIERAT` |
| V7 command surface | `grep -n "COMMAND_QUEUE" lib/loop/commands.ts; grep -n "intake.submit" -A5 lib/loop/schema.ts; ls app/api/loop/command` | route `app/api/loop/command/route.ts` exists with `COMMAND_ENDPOINT = "/api/loop/command"` at `lib/loop/commands.ts:91`; five verbs at `lib/loop/schema.ts:441-445` (`intake.submit`, `run.start`, `run.pause_at_safe_boundary`, `run.resume`, `inspect`) as a `z.discriminatedUnion("verb", …)` at `lib/loop/schema.ts:453`; `COMMAND_QUEUE_TRANSPORT = "NONE"` at `lib/loop/commands.ts:101`; `COMMAND_QUEUE_BLOCKED_ON = "nortropic-system S13"` at `lib/loop/commands.ts:104`; test `tests/loop/v7-command-surface.test.ts` | `PROVEN_EXISTING` (surface implemented, channel deliberately closed) |
| V8-FIXTURE intake UX | `grep -n "INTAKE_TRANSPORT\|INTAKE_BLOCKED_ON" lib/loop/intake.ts; ls "app/(app)/loop"` | `components/loop/IntakeShell.tsx`, `IntakeDropzone.tsx`, `IntakeResult.tsx`, `IntakeValidationShowcase.tsx`; page `app/(app)/loop/mata/page.tsx`; submission vocabulary at `lib/loop/intake.ts:359-368`; `INTAKE_TRANSPORT = "NONE"` at `lib/loop/intake.ts:61`, `INTAKE_BLOCKED_ON = "nortropic-system S10 + S13 (B5)"` at `lib/loop/intake.ts:76`; test `tests/loop/v8-intake-fixture.test.ts` | `PROVEN_EXISTING` (fixture UX only) |
| V9 realtime / TailStore | `grep -n "export " lib/loop/realtime.ts` | `createTailStore` at `lib/loop/realtime.ts:202`, `TAIL_DEDUP_CAP:74`, `POLL_INTERVAL_MS:77`, backoff `:80-81`, `HIDDEN_PAUSE_AFTER_MS:84`, backfill paging `:87-88`, poll fallback `:95`, gap backfill cap `:107`, transport modes `:333-405`; component `components/loop/LiveEventStream.tsx`; test `tests/loop/v9-realtime.test.ts` | `PROVEN_EXISTING` |
| V10 security hardening | `ls tests/loop; grep -n "export " tests/loop/security.ts` | `tests/loop/security.ts` (client-env secret shapes `:79-121`, import-graph credential detection `:379-393`, plan-base facts `:44-77`) and `tests/loop/v10-security-hardening.test.ts` | `PROVEN_EXISTING` |
| Factory supervisor (claims, heartbeats, breaker, Publication v2) | `ls scripts/claude-loop; ls tests/claude-loop` | `scripts/claude-loop/{supervisor,claims,publication,autopilot,backlog,ledger,scope,review-policy,gates,authority,state,progress,visual-review}.ts`; claims/heartbeat/stale recovery at `scripts/claude-loop/claims.ts:135,173,220,268,306`; no-progress circuit breaker at `scripts/claude-loop/supervisor.ts:199-212`; publication refuses rebase/squash/force/amend/delete-branch/admin at `scripts/claude-loop/publication.ts:35-40`; runbook `docs/claude-loop-runbook.md`; tests `tests/claude-loop/*.test.ts` (20 files, measured with `find tests/claude-loop -name "*.test.ts" \| wc -l`, incl. `autonomy-circuit-breaker`, `production-recovery`, `publication-merge-commit`, `history-rewrite`, `secret-guard`, `role-tools`, `review-policy`, `claims`) | `PROVEN_EXISTING` |

### 3.2 Verkstadsgolvet — Factory Room material this programme needs

| Roadmap item | Measurement | Result | Class |
| --- | --- | --- | --- |
| ROOM-01 room components | `ls components/loop \| grep -i "room\|composer\|rail\|tray"` | only `PhaseRail.tsx`; no `FactoryRoom*`, `RoomTimeline`, `WorkComposer`, `TaskFocusRail`, `IdentityStrip`, `OutputTray` | `ABSENT` |
| ROOM-01 style namespace | `grep -rn "LOOP_CSS" app components lib` | `LOOP_CSS` defined at `components/loop/ui.ts:195`, injected at `components/loop/MaskinShell.tsx:41` and `components/loop/IntakeShell.tsx:55`; no `ROOM_CSS` anywhere | `PARTIAL` (LOOP_CSS exists and must stay untouched; ROOM_CSS absent) |
| ROOM-01 derived attention wording | `grep -rn -i "attention\|uppm" lib/loop/*.ts components/loop/*.tsx` | no match | `ABSENT` |
| ROOM-01 segmented ordering constants | `grep -rn "LIVE_EVENT_ORDER\|COMMAND_DISPLAY_ORDER\|WALL_CLOCK" lib/ components/` | no match; underlying seq-only rule is implemented and documented in `lib/loop/events.ts:14-21` | `PARTIAL` |
| ROOM-01 single tail connection | `grep -n "export " lib/loop/realtime.ts`; `components/loop/LiveEventStream.tsx` | one `TailStore` implementation exists; no room-level rule or test forbidding a second SSE/poll client | `PARTIAL` |
| ROOM-01 command entry callback | `grep -n "useState\|entries" components/loop/CommandDeck.tsx` | local `useState<CommandLogEntry[]>` at `components/loop/CommandDeck.tsx:62`, rendered by `CommandLog` at `:123`; no `onCommandEntry` prop | `ABSENT` (callback), `PROVEN_EXISTING` (local log) |
| ROOM-02 live intake transport | `grep -n "INTAKE_TRANSPORT" lib/loop/intake.ts` | `"NONE"`, blocked on backend S10 + S13 | `ABSENT` (live), `PROVEN_EXISTING` (fixture UX) |
| ROOM-03 causal chain identifiers | `grep -n "task_id\|candidate_sha\|evidence_refs\|attempt" lib/loop/schema.ts` | `TaskViewSchema` carries `task_id`, `source.{source_id,sha256,locator}`, `attempt.{n,budget}`, `base_sha`, `candidate_sha`, `evidence_refs`, `task_gate.{grind_id,grind_sha256}`; event envelope columns derived from schema at `lib/loop/schema.ts:338`; no run→session→promotion projection | `PARTIAL` |
| ROOM-04 identity fields | `grep -rn "asked_by\|execution_principal\|capability_bundle\|promotion_authority\|workflow_role" lib/ app/ components/` | no match; the only identity material in the contract is `builder: { agent, model }` at `lib/loop/schema.ts:356-359` | `PARTIAL` (two fields exist), `ABSENT` (all others) |
| ROOM-05 live snapshot cutover | backend measurement | no controller publisher exists; backend S5/S13 UNFROZEN | `ABSENT` |
| ROOM-06 live typed commands | `grep -n "COMMAND_QUEUE_TRANSPORT" lib/loop/commands.ts` | `"NONE"` | `ABSENT` (live), `PROVEN_EXISTING` (typed contract) |
| ROOM-07 conversational operator | `grep -rn -i "conversational\|nl\b" lib/loop components/loop` | no match | `ABSENT` |
| ROOM-08 responsive room | `grep -n "viewports" -A6 backlog/control-room-v1.json` | visual-review viewports desktop 1440x1000 / tablet 900x1000 / mobile 390x844 are configured for existing visual slices; no mobile-first room | `PARTIAL` (harness exists), `ABSENT` (room) |

### 3.3 Supervisor, identity, observer, audit, retrospective, remote

| Roadmap item | Measurement | Result | Class |
| --- | --- | --- | --- |
| SUPERVISOR-01 persistent state, claims, heartbeats, breaker, resume | `grep -n "export function" scripts/claude-loop/claims.ts; grep -n "circuitBreaker" scripts/claude-loop/supervisor.ts` | claims + heartbeats + stale recovery + fail-closed liveness checkpoint (`supervisor.ts:294`), no-progress circuit breaker (`supervisor.ts:199-212`), autopilot (`scripts/claude-loop/autopilot.ts`), run state (`scripts/claude-loop/state.ts`), ledger (`scripts/claude-loop/ledger.ts:46,78,95,113`), runbook sections "Claims, ledger and recovery", "Run recovery", "Remediation circuit breaker" | `PROVEN_EXISTING` for the listed mechanisms |
| SUPERVISOR-01 event-driven wakeup, dependency wakeup | `grep -rn "watch\|poll\|sleep" scripts/claude-loop/autopilot.ts` | no wakeup primitive in `autopilot.ts`; continuation is a supervisor-driven loop, `npm run claude:watch` is a CLI entry | `PARTIAL` |
| SUPERVISOR-01 main drift | `grep -rln "drift" scripts/claude-loop/` | `scripts/claude-loop/progress.ts`, `scripts/claude-loop/autopilot.ts` mention drift; no notification path | `PARTIAL` |
| CONTEXT-01 durable room context | `grep -rn -i "room context\|memory" lib/ app/ components/` | no match | `ABSENT` |
| IDENTITY-01 dedicated service principals | `grep -rn "workflow only" CLAUDE.md` | `CLAUDE.md` states `CLAUDE_ROLE_SEPARATION=WORKFLOW` and `CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO`; role separation exists as workflow lanes (`scripts/claude-loop/authority.ts`, `scripts/claude-loop/owner-author/settings.json`), not as separate mechanical principals | `ABSENT` (mechanical principals), `PROVEN_EXISTING` (the lock that forbids claiming otherwise) |
| IDENTITY-02 capability bundles | verkstadsgolvet: `grep -n "allowedWrite\|deniedWrite" backlog/control-room-v1.json`, `scripts/claude-loop/scope.ts`; backend (supervising session): `config/managed-settings.json` (34 permission denies, 13 sandbox write denies, network allowlist `api.anthropic.com` only), `specs/owner-production-paths.v1.json` (versioned authority registry) | real enforced bundles exist for the Claude Code execution environment and for per-task write scope; no versioned per-principal bundle registry for the programme's principals | `PARTIAL` |
| IDENTITY-03 credential proxy | `grep -rn -i "proxy" lib/ scripts/` | no credential proxy; backend `controller/launch/cli` strips `GH_`/`GITHUB_`/`SLACK_` prefixes from worker env and is documented there as NOT sufficient as a privilege boundary | `ABSENT` |
| OBSERVER-01 ambient observer | `grep -rn -i "notification\|observer" lib/ app/ components/ scripts/` | no observer service, no notification transport; backend `h-014` (`controller/notis`) is specced but unbuilt | `ABSENT` |
| AUDIT-01 causal audit | `scripts/claude-loop/ledger.ts`, `scripts/claude-loop/telemetry.ts`, `.claude-loop/hook-events.jsonl` | per-run ledger and hook events exist for the Claude Factory; no cross-repository causal audit with stable identifiers from trigger to publication | `PARTIAL` |
| RETRO-01 retrospective agent | `ls components/ \| grep -i retro` | `components/RetroPanel.tsx` is an unrelated product panel; no retrospective analysis agent | `ABSENT` |
| REMOTE-00 operator adapter | `grep -rn -i "mcp\|adapter" app/api lib/loop` | no match | `ABSENT` |
| REMOTE-01 Slack / Claude Tag | remote-surface verification 2026-08-14 (`/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md`) | Claude Tag is public beta, Team/Enterprise only, conversational only, no custom MCP backends, no inbound API/webhook layer, requires org-Owner pairing and Routines enabled | `ABSENT` (implementation), external entitlement prerequisite recorded |
| REMOTE-02 Claude Code Channels | same evidence file | research preview; channels are LOCAL MCP servers pushing events into a RUNNING session; custom channels allowed behind `--dangerously-load-development-channels`; sender-identity allowlist mandatory; events queue only while a session is open | `ABSENT` |
| REMOTE-03 Claude Code Routines | same evidence file | research preview; account-owned scheduled cloud runs; triggers = schedule / HTTP fire endpoint (`anthropic-beta: experimental-cc-routine-2026-04-01`, fire text explicitly untrusted) / GitHub events; no custom MCP servers; results are claude.ai sessions with no push delivery | `ABSENT` |
| REMOTE-04 remote notifications / mobile | `grep -rn -i "push\|webhook" app/api lib/` | no match | `ABSENT` |
| HARDEN-01 adversarial controls | `ls tests/loop tests/claude-loop` | existing negative controls cover client secret leakage, history rewrite, publication semantics, role tools, visual auth; none of the identity/remote/credential adversarial controls in HARDEN-01 exist | `PARTIAL` |
| EMPIRICAL-01 unattended remote proof | `ls scripts/claude-loop/empirical-smoke.ts` | an empirical smoke entry exists for the Claude Factory (`npm run claude:empirical-smoke`); no remote end-to-end scenario | `PARTIAL` |

### 3.4 Backend state (measured 2026-08-14 by the supervising session, `Nortropic/nortropic-system` at `32b6e07`)

These are cited as measured facts. They are not re-derived from the older pinned plan commit
`0b3212c9`, and this repository does not attempt to measure that repository.

- **The controller publishes nothing outward today.** Zero Supabase/HTTP/socket/Slack-sender code
  under `controller/`, `scripts/`, `tests/` at `origin/main`. Controller state is `{task,status}`
  JSONL plus a two-column SQLite projection (`controller/state/cli`), `attestations.json`
  (`controller/attest/cli`, the doneness authority), breaker/lease files, and the autopilot journal
  `.git/nortropic-codex-autopilot/events.jsonl`. There is no `event_type`, no `seq` and no
  `event_id` anywhere in backend code.
- **S5 (`controller/handelse`, event store, task h-019), S10 (`controller/intag`, intake/Task IR,
  h-023) and S13 (`controller/lucka`, read + command surface, h-026) are UNFROZEN** in the backend's
  own machine-readable roadmap (`scripts/nortropic-codex-autopilot.py` ROADMAP): no spec row, no
  gate, no code. The frozen spec text exists only on branch `plan/autonomous-loop-v1` at `0b3212c9`.
  BLOCKER EVIDENCE LINE (verbatim, reused by every backend-blocked item in this programme):
  `nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07`.
- **Backend ordering (its own frozen chain).** Bootstrap `h-035 → h-034 → h-033 → h-032` are ALL DONE
  and merged (the `h-032` merge IS `origin/main` HEAD). NEXT is `h-031` (undefined on main), then
  supervisor resume, then first autonomous launch, then SUB-1..SUB-4 (`h-027`..`h-030`), then S2,
  S4–S13, then L. Every backend-live item in this roadmap therefore sits behind that chain.
- **S7 promotion carries a hard external prerequisite:** GitHub App "Nortropic Promoter"
  (`docs/loop/codex-autopilot-v3-full-roadmap.md`). Only `FULL_ROADMAP_SOFTWARE_COMPLETE` may be set
  until it exists.
- **Controller-side work goes through the backend repo's own operating model.** `AGENTS.md`
  authority ladder; `$nortropic-test-author` writes the spec row and the RED frozen gate in
  `specs/**` and `verify/**` (builder-denied); `$nortropic-gate-reviewer` falsifies; the builder
  implements on `nortropic/loop-<id>`; report schema
  `docs/loop/codex-autopilot-report.schema.json`; status vocabulary
  `PROVEN|OVERIFIERAT|NOT_RUN|PASS|FAIL`; no percentages. **This roadmap creates no tasks inside the
  backend repository.** It records what the programme needs from it and marks those items `BLOCKED`
  with the evidence line above until the backend's own chain delivers them.
- **PROVEN_EXISTING identity/provenance material in the backend** — reuse this instead of
  re-inventing it (ROOM-04, IDENTITY-01, IDENTITY-02, AUDIT-01):
  - `h-032` exact provider identity: `config/codex-provider-identity.json` binds the Codex executable
    by path plus sha256, owner-frozen.
  - `h-033` authenticated runner provenance: `_nortropic_provenance` OS identity, root-owned
    receipts, digest-bound artifact manifest.
  - `h-034` native verifier kernel: signed Mach-O identity manifest.
  - `h-035` owner-author workflow: authority classes `ordinary` / `owner_authority`,
    `controller/authority/cli` typed JSON-on-stdin commands — the closest existing precedent to a
    typed command surface.
  - `specs/owner-production-paths.v1.json`: a real versioned capability/authority registry.
  - `controller/launch/cli` credential stripping (`GH_`/`GITHUB_`/`SLACK_` prefixes removed from
    worker env) — documented there as NOT sufficient as a privilege boundary.
  - `config/managed-settings.json`: a real enforced Claude Code capability bundle — 34 permission
    denies, 13 sandbox write denies, network allowlist `api.anthropic.com` only.
- **Slack.** Backend `h-014` (`controller/notis`) is specced but unbuilt. Owner decision
  `LOOP-AGARHAND-37` (`docs/05-beslutslogg.md`, 2026-08-09): the Slack webhook secret lives at
  `~/.nortropic/slack-webhook` (mode 0600, outside every repository; config carries the PATH, never
  the value), and the Claude Code Slack plugin was explicitly REJECTED as the mechanism for
  controller alarms, because it is model-facing and alarms must fire when no model session survives.
  REMOTE-01 in this programme is a conversational client. It does not replace, absorb or excuse
  `h-014`'s controller-alarm channel, and it respects that owner decision.

### 3.5 Verkstadsgolvet-side consequences (stated explicitly)

- **ROOM-05** (live snapshot cutover) is `BLOCKED` on backend S5 + S13.
- **ROOM-06** (live typed commands) is `BLOCKED` on backend S13.
- **ROOM-02** (live intake) is `BLOCKED` on backend S10 + S13.
- **ROOM-04** (controller-side identity fields) is `BLOCKED` on the backend chain; its UI half may
  render only fields that exist in validated data today (`builder.agent`, `builder.model`, plus the
  workflow-role and asked-by material this repository itself owns).
- **REMOTE-00**'s controller-side interface is `BLOCKED` on backend S13; its Verkstadsgolvet-side
  adapter shape may be designed and fixture-proven earlier.
- Fixture-backed halves of these slices may be built, reviewed and published — and must never be
  called live-complete. `V1–V3` build-availability rules in `CLAUDE.md` continue to apply.

---

## 4. Trust and authority boundaries

The following locks are binding for every slice in this programme. They may never be weakened,
reinterpreted or "temporarily relaxed" to make an implementation pass.

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

Additional binding statements:

- A model, room, Slack thread, Channel, Routine, UI timeline or memory store may provide **context
  and presentation**. None of them may become **canonical state**.
- Canonical state remains: controller-owned state, frozen contracts, candidate identities, verdicts,
  attestations, promotion evidence, and controller-published snapshots.
- **Workflow role is never a security boundary.** A role name never proves a mechanical capability. A
  separation claim requires mechanical evidence (UID, account, app, token, certificate, process
  identity or an enforced platform equivalent), never role-name prose.
- **No frozen test, owner gate, authority file or security invariant may be weakened to make an
  implementation pass.** If an implementation cannot satisfy a frozen gate, the implementation is
  wrong, or the gate needs a separate explicit owner decision — never a builder-side edit.
- Unknown or unavailable backend data renders as an em dash, never as invented data.
- Event streams are activity and evidence. Authority comes from the controller-published snapshot.
- No percentages, no progress bars, and no animation without a real signal, anywhere in this
  programme's UI or reporting.

OWNER-DOC FOLLOW-UP (recorded, not acted on here): `VERKSTADSGOLVET-BYGGSPEC.md` line 11 still reads
"**LÄS-ONLY. ALLTID.** Appen läser GitHub, skriver ALDRIG …". For Maskinen that wording is
superseded by the locked owner decision `VERKSTADSGOLVET_CONTROL_MODEL=READ_OBSERVE_PLUS_NARROW_TYPED_INTENTS`
in `CLAUDE.md`. That file is not edited by this or any product slice; reconciling it is an
owner-document task. Until then, `CLAUDE.md` and `docs/nortropic-control-room-plan-v1.md` govern.

---

## 5. Implementation slices

Every slice below is mandatory. No slice may be dropped, renamed or merged. Per-slice detail may be
refined from repository measurement; the scope of each slice is frozen.

Common definitions used by all slices:

- **Positive exit criteria** — what must be demonstrably true, with evidence, for the slice to pass.
- **Negative controls** — tests that must FAIL the implementation if the forbidden thing happens. A
  negative control that was never run is reported `NOT_RUN`, never `PASS`.
- **Empirical completion criteria** — the observation that proves the slice in reality. A UI demo is
  never sufficient for a slice whose scope includes live behaviour.

---

### MASTER-00 — Roadmap freeze and executable backlog

- **Target repository:** `Nortropic/verkstadsgolvet` (planning authority).
- **Dependencies:** none.
- **Authority prerequisites:** none beyond the existing owner-approved operating model.
- **Positive exit criteria:** the three artifacts exist and cross-reference each other
  (`docs/nortropic-factory-room-master-roadmap-v1.md`,
  `docs/nortropic-factory-room-handoff-v1.md`, `backlog/nortropic-factory-room-master-v1.json`);
  every mandated slice and every ledger item appears; the backlog JSON parses under `node`;
  `npx tsc --noEmit` and `npm run claude:test` pass; an independent reviewer confirms nothing from
  the adopted requirements was dropped, weakened or silently reclassified; guarded publication
  completes with `FORCE_OPERATIONS=0` and `HISTORY_REWRITES=0`.
- **Negative controls:** no product code changes; `backlog/control-room-v1.json` and
  `scripts/claude-loop/**` unchanged (no second scheduler, no competing canonical backlog); no
  authority file edited; no item marked `PROVEN` beyond what the repository mechanically proves.
- **Security requirements:** documentation only; no credential, no network destination, no secret in
  any artifact.
- **Remote-operation requirements:** records remote prerequisites; implements none.
- **Empirical completion criteria:** the three files exist at the published merge commit and the
  gates listed above exited zero in the supervisor's mechanical run.

---

### ROOM-01 — Factory Room shell

- **Target repository:** `Nortropic/verkstadsgolvet`.
- **Dependencies:** MASTER-00.
- **Authority prerequisites:** none — presentation only. Uses existing validated fixtures, existing
  snapshot rules, existing task cards, existing command surfaces, the existing intake link and the
  existing realtime components.
- **Scope:** recompose `/loop` into a Factory Room composed of `FactoryRoomHeader`, `RoomTimeline`,
  `WorkComposer`, `TaskFocusRail`, `IdentityStrip` and `OutputTray`.
- **Positive exit criteria:**
  1. The room renders from existing validated fixtures with no new backend authority, no new state
     store, no new event contract, no new API route and no new credential.
  2. **Identity fields render SEPARATELY** in `IdentityStrip`: `Asked by` / `Current workflow role` /
     `Recorded builder agent` (`snapshot.builder.agent`, or an em dash) / `Recorded builder model` /
     `Execution principal` / `Capability bundle-evidence` / `Promotion authority`.
     `builder.agent` is NEVER labeled as workflow role. Fields with no data render as an em dash.
  3. **Derived attention** renders `BEHÖVER UPPMÄRKSAMHET` (Swedish diacritics preserved in the UI).
     `ÄGARÅTGÄRD KRÄVS` renders ONLY when an authoritative snapshot or event field states owner
     authority — never as a UI-side inference.
  4. **The timeline is a SEGMENTED presentation projection**, never a merged pseudo-chronology:
     ```text
     LIVE_EVENT_ORDER=seq
     COMMAND_DISPLAY_ORDER=server issued_at (presentation only)
     FIXTURE_OPERATOR_ORDER=fixture-defined
     GLOBAL_CAUSAL_ORDER_NOT_CLAIMED=YES
     WALL_CLOCK_IS_ORDERING_AUTHORITY=NO
     ```
     Every entry preserves all actually available identifiers: `source_kind`, `source_ref`,
     `command_id`, `run_id`, `task_id`, `attempt_id`, `event_id`, `seq`, `candidate_sha`,
     `evidence_refs`. No implied causality without a binding identifier.
  5. `ONE_TAIL_CONNECTION_PER_FACTORY_ROOM=YES` — no duplicate SSE or poll clients anywhere in the
     room.
  6. The timeline does NOT claim `CommandDeck`'s local entries unless a minimal `onCommandEntry`
     callback is explicitly added, without changing command semantics.
  7. `LOOP_CSS` (`components/loop/ui.ts:195`) is untouched; the room adds a separate, namespaced
     `ROOM_CSS` as a second style tag.
  8. Canonical task states remain exactly RAW PLANNING NEEDS_SPEC READY QUEUED WORKING VERIFYING
     REVIEWING MERGING DONE STOPPED. Submission states stay in their separate namespace.
     DONE, verdict, attestation, promotion and current-main come only from a controller-published
     snapshot. No percentages, no progress bars, no animation without a real signal; unknown data is
     an em dash.
- **Negative controls:** fixture data described as live anywhere → FAIL; a natural-language command
  executor present → FAIL; a second tail connection → FAIL; `builder.agent` rendered as workflow role
  → FAIL; `ÄGARÅTGÄRD KRÄVS` derived without an authoritative field → FAIL; `LOOP_CSS` modified →
  FAIL; a new API route or credential introduced → FAIL; a task state outside the eleven → FAIL.
- **Security requirements:** no credential reaches the client; no new network destination; existing
  V10 security tests continue to pass unchanged.
- **Remote-operation requirements:** none (ROOM-08 handles responsiveness; the room must not block
  it structurally).
- **Empirical completion criteria:** visual review of ACTUAL screenshots must prove a **room, not a
  dashboard matrix**: one narrative axis; `WorkComposer` is the primary input; the current task is
  the visual focus; the event log is secondary; no duplicate status; fixture and live visibly
  distinct; desktop, tablet and mobile all usable; visible keyboard focus; no page-level horizontal
  scroll.

---

### ROOM-02 — Integrated intake and submission lifecycle

- **Target repository:** primarily `Nortropic/verkstadsgolvet`; controller work in
  `Nortropic/nortropic-system` where required.
- **Dependencies:** ROOM-01.
- **Authority prerequisites:** live half requires backend S10 (`controller/intag`) and S13
  (`controller/lucka`). Both are UNFROZEN at `32b6e07`.
- **Positive exit criteria:** the full flow — drag / select / paste Markdown → `submission.selected`
  → `submission.uploading` → `submission.stored` → `submission.command_queued` →
  `submission.claimed_by_controller` → `submission.rejected` — is implemented end to end for the
  target mode. Submission states never become task lifecycle states. The frontend never semantically
  compiles tasks. The controller resolves `source_ref`, reads the exact bytes, computes its own hash,
  requires a match, and creates its own immutable source snapshot before planning begins.
- **Negative controls:** a submission state rendered as a task state → FAIL; frontend-computed hash
  treated as trust anchor → FAIL; controller accepting a mismatching hash → FAIL; planning starting
  before the immutable source snapshot exists → FAIL; fixture flow described as live → FAIL.
- **Security requirements:** opaque `source_ref` only; no repository write credential in the browser;
  upload transport authorization is not a service-role key; no secret in any error message.
- **Remote-operation requirements:** the same intake path must be reachable through REMOTE-00 without
  a second semantic implementation.
- **Empirical completion criteria:** fixture UX may precede live transport and is publishable as
  fixture-complete. LIVE completion requires actual backend proof: real bytes stored, controller-side
  hash recomputation, controller-created source snapshot, and a task compiled by the controller.
- **Status at freeze:** live half `BLOCKED` — `nortropic-codex-autopilot roadmap prints UNFROZEN for
  S5/S10/S13 at 32b6e07`.

---

### ROOM-03 — Causal timeline and evidence projection

- **Target repositories:** `Nortropic/verkstadsgolvet`, plus read-model and event contracts in
  `Nortropic/nortropic-system` where required.
- **Dependencies:** ROOM-01.
- **Authority prerequisites:** full chain requires backend S5 (event store) and S13 (read surface).
- **Positive exit criteria:** a traceable presentation of
  operator/source → command → run → task → attempt → agent session → candidate → verification →
  review → attestation → promotion, in which every link is carried by an actual identifier. Raw event
  inspection and raw evidence inspection remain available from the projection.
- **Negative controls:** any inferred relationship without an actual ID → FAIL; a client-side event
  fold presented as authority → FAIL; wall-clock used as ordering authority → FAIL; a projection that
  hides raw events → FAIL.
- **Security requirements:** evidence references are references; no secret material is embedded in an
  evidence payload rendered to a client.
- **Remote-operation requirements:** the same projection must be retrievable through REMOTE-00 so
  remote clients show identical links, not a parallel narrative.
- **Empirical completion criteria:** for one real run, every hop in the chain resolves to a stored
  identifier and the raw event backing each hop can be opened.

---

### ROOM-04 — Live identity projection

- **Target repositories:** `Nortropic/nortropic-system` read model and `Nortropic/verkstadsgolvet`.
- **Dependencies:** ROOM-01, ROOM-03.
- **Authority prerequisites:** controller-side fields require the backend chain (S5/S13 and the
  identity material below). The UI half may render only fields that exist in validated data today.
- **Positive exit criteria:** a versioned, evidence-bound identity contract carrying `asked_by`,
  `workflow_role`, `provider`, `model`, `execution_principal`, `service_identity`,
  `capability_bundle_id`, `session_identity`, `provenance_evidence_ref`, `promotion_authority`. The
  existing provider and authenticated-runner provenance in `nortropic-system` (`h-032`
  `config/codex-provider-identity.json`; `h-033` `_nortropic_provenance` receipts and digest-bound
  artifact manifest; `h-034` signed Mach-O identity manifest; `h-035` authority classes) is
  INVENTORIED FIRST and reused wherever semantically applicable.
- **Negative controls:** an invented name in any identity field → FAIL; provider execution identity
  presented as service-account identity → FAIL; provider execution identity presented as workflow
  role → FAIL; an identity field asserted without a `provenance_evidence_ref` → FAIL; a field
  rendered from model prose → FAIL.
- **Security requirements:** identity assertions carry evidence references; no credential value is
  ever part of an identity field.
- **Remote-operation requirements:** remote clients render the same separated fields with the same
  labels and the same em-dash rule.
- **Empirical completion criteria:** for one real run, each populated field resolves to its evidence
  reference, and each unpopulated field renders as an em dash rather than a guess.
- **Status at freeze:** controller-side half `BLOCKED` — `nortropic-codex-autopilot roadmap prints
  UNFROZEN for S5/S10/S13 at 32b6e07`.

---

### ROOM-05 — Full live snapshot cutover

- **Target repositories:** both, as required.
- **Dependencies:** ROOM-01, ROOM-03, ROOM-04.
- **Authority prerequisites:** backend S5 + S13.
- **Positive exit criteria:** fixture-backed authoritative columns are replaced by
  controller-published snapshots ONLY after schema and transport compatibility are proven. The
  resolution rules are implemented exactly:
  - snapshot missing → NO authoritative task state is rendered;
  - tail only → activity log and transient phase only;
  - snapshot/tail conflict → `SNAPSHOT_WINS`;
  - DONE / ATTESTED / PROMOTED / MAIN_ADVANCED → snapshot only;
  - current main → controller-confirmed only.
  Fixture mode remains available for tests and demos and is always visibly distinct.
- **Negative controls:** a tail event promoting a task to DONE → FAIL; an optimistic authoritative
  column → FAIL; current main inferred from the UI or from a remote client → FAIL; fixture mode
  indistinguishable from live → FAIL.
- **Security requirements:** the read transport uses a least-privilege read credential held
  server-side only; `MASKINEN_GITHUB_CREDENTIAL=NONE` holds.
- **Remote-operation requirements:** remote clients consume the same snapshot semantics; no client
  may compute its own authoritative column.
- **Empirical completion criteria:** with a real controller publishing, a deliberately conflicting
  tail event is shown to lose to the snapshot, and a snapshot outage is shown to remove authoritative
  state rather than freeze a stale one.
- **Status at freeze:** `BLOCKED` — `nortropic-codex-autopilot roadmap prints UNFROZEN for
  S5/S10/S13 at 32b6e07`.

---

### ROOM-06 — Typed operator actions

- **Target repositories:** controller command interface (`Nortropic/nortropic-system`) and
  `Nortropic/verkstadsgolvet`.
- **Dependencies:** ROOM-01, ROOM-05.
- **Authority prerequisites:** backend S13.
- **Positive exit criteria:** exactly `intake.submit`, `run.start`, `run.pause_at_safe_boundary`,
  `run.resume`, `inspect` (unless a separately frozen contract deliberately changes the set). Every
  action carries `command_id`, `dedup_key`, `issued_at`, `expires_at`, `expected_watermark`, a typed
  payload, a status, and a result or rejection. The existing typed union at
  `lib/loop/schema.ts:453` is the starting contract; `COMMAND_QUEUE_TRANSPORT` at
  `lib/loop/commands.ts:101` flips from `"NONE"` only when the controller side exists.
- **Negative controls:** a generic command string accepted → FAIL; shell or Git reachable from the UI
  → FAIL; a direct verdict, attestation, lease, breaker or promotion mutation from the UI → FAIL;
  optimistic authoritative state after dispatch → FAIL; a replayed or expired command accepted →
  FAIL; a stale `expected_watermark` accepted → FAIL.
- **Security requirements:** the controller validates and may always reject; the client never assumes
  success; no credential travels with a command.
- **Remote-operation requirements:** REMOTE-00 accepts exactly this verb set and no other.
- **Empirical completion criteria:** each verb is issued against a real controller and its accepted
  and rejected paths are both observed, with the rejection reason rendered.
- **Status at freeze:** live half `BLOCKED` — `nortropic-codex-autopilot roadmap prints UNFROZEN for
  S5/S10/S13 at 32b6e07`.

---

### ROOM-07 — Conversational operator

- **Target repositories:** `Nortropic/verkstadsgolvet` conversational layer plus the shared operator
  adapter.
- **Dependencies:** ROOM-01, ROOM-06, REMOTE-00.
- **Authority prerequisites:** the typed verb set must be frozen before any NL layer may target it.
- **Positive exit criteria:** natural language MAY: summarize snapshots and events; explain a
  blocker; suggest ONE typed intention; prepare intake text; suggest a task or run to inspect;
  explain a controller rejection. Before dispatch, the layer SHOWS the exact typed intention, the
  payload target and the expected watermark, and the operator confirms.
- **Negative controls:** NL creating a verb outside the frozen set → FAIL; NL executing shell or Git
  → FAIL; NL moving a ref → FAIL; NL writing a verdict or attestation → FAIL; NL promoting → FAIL;
  NL output stored as canonical memory → FAIL; dispatch without showing the exact typed intention →
  FAIL; more than one suggested intention presented as a batch to auto-execute → FAIL.
- **Security requirements:** prompt injection in task text, event text or remote input must not reach
  tool routing; the NL layer holds no credential.
- **Remote-operation requirements:** the same rules bind remote conversational clients (REMOTE-01,
  REMOTE-02).
- **Empirical completion criteria:** an adversarial transcript attempting to make NL invent a verb,
  run a shell command and mark a task DONE is shown to fail on all three, with the refusal recorded.

---

### ROOM-08 — Responsive and mobile Factory Room

- **Target repository:** `Nortropic/verkstadsgolvet`.
- **Dependencies:** ROOM-01.
- **Authority prerequisites:** none.
- **Positive exit criteria:** a mobile-first remote control-room covering status, current task,
  attention, commands, intake, events, evidence and notifications. Every evidence surface reachable
  on desktop is reachable on mobile.
- **Negative controls:** desktop-only evidence access → FAIL; a hidden authority-changing action →
  FAIL; page-level horizontal scroll → FAIL; a critical distinction carried by colour alone → FAIL;
  focus not visible → FAIL.
- **Security requirements:** no authority-changing action reachable without the same confirmation the
  desktop room requires.
- **Remote-operation requirements:** this is the browser half of remote operation; REMOTE-04 covers
  the notification and non-browser half.
- **Empirical completion criteria:** visual review of actual screenshots at desktop, tablet and
  mobile viewports, plus a real mobile pass over: read status, open a task, open evidence, submit
  intake, issue a command, read its result.

---

### SUPERVISOR-01 — Persistent sessions and asynchronous ownership

- **Target repository:** the current supervisor/controller implementation
  (`scripts/claude-loop/**` in `Nortropic/verkstadsgolvet`, plus controller-side equivalents where
  the backend owns them).
- **Dependencies:** MASTER-00.
- **Authority prerequisites:** none for the measured-gap work; controller-side items follow the
  backend's own operating model.
- **Positive exit criteria:** INVENTORY FIRST. Claims, heartbeats, resume, the no-progress circuit
  breaker and autopilot already exist (`scripts/claude-loop/claims.ts:135,173,220,268,306`;
  `scripts/claude-loop/supervisor.ts:199-212,294`; `scripts/claude-loop/autopilot.ts`;
  `docs/claude-loop-runbook.md`). Only MEASURED gaps are closed, in: persistent run/task state,
  process-death recovery, session reconstruction, event-driven wakeups,
  continue-until-no-ready-work, bounded remediation, dependency wakeup, exact candidate retention,
  stale-run classification. Each closed gap cites the measurement that showed it open.
- **Negative controls:** a second scheduler introduced → FAIL; a second canonical backlog introduced
  → FAIL; `backlog/control-room-v1.json` repurposed → FAIL; a re-implementation of an existing proven
  mechanism instead of a gap closure → FAIL; a recovery path that silently discards a candidate →
  FAIL.
- **Security requirements:** claim ownership stays fail-closed; a supervisor that lost its claim
  stops rather than continuing.
- **Remote-operation requirements:** none directly; OBSERVER-01 and REMOTE-04 consume its stale-run
  and no-ready-work conditions.
- **Empirical completion criteria:** a killed supervisor process is shown to recover, reconstruct
  session state, retain the exact candidate, and continue until no eligible work remains — without a
  human handoff.

---

### CONTEXT-01 — Durable room context, never authority

- **Target repositories:** an operator/context service plus its clients.
- **Dependencies:** ROOM-01, REMOTE-00.
- **Authority prerequisites:** none — context is explicitly non-authoritative.
- **Positive exit criteria:** persistent operator preferences, room summaries, UI state, decisions
  and rationale, links to canonical evidence, and previous interaction context. Context is editable,
  auditable, versioned, deletable and scope-bound. Every canonical claim SHOWN from memory resolves
  to a current snapshot or an evidence reference before it is displayed as fact.
- **Negative controls:** `MEMORY_IS_AUTHORITY` violated → FAIL; a memory conflict overriding
  controller truth → FAIL; a canonical claim rendered from memory without resolution → FAIL; context
  leaking across rooms or channels → FAIL; context that cannot be deleted → FAIL.
- **Security requirements:** context stores no secret; context is scoped per room and per principal;
  deletion is real deletion.
- **Remote-operation requirements:** remote clients read the same context store through REMOTE-00 and
  are bound by the same non-authority rule.
- **Empirical completion criteria:** a deliberately stale memory claim is shown to be corrected by
  the current snapshot at render time, and the correction is auditable.

---

### IDENTITY-01 — Dedicated service principals

- **Target:** the control-plane execution environment.
- **Dependencies:** MASTER-00.
- **Authority prerequisites:** owner decision on which principals the platform can actually
  materialize.
- **Positive exit criteria:** distinct MECHANICAL identities, where the architecture supports them,
  for: `factory-builder`, `factory-reviewer`, `factory-owner-author`, `nortropic-promoter`,
  `remote-operator-adapter`, `observer`, `retrospective-agent`. Each separation claim is backed by
  mechanical evidence: UID, account, app, token, certificate, process identity, or an enforced
  platform equivalent.
- **Negative controls:** a separation claimed from role-name prose → FAIL; a shared credential
  presented as two principals → FAIL; a principal asserted without evidence → FAIL; workflow role
  presented as a security boundary → FAIL.
- **Security requirements:** each principal's credential class is distinct; no broad personal
  operator credential stands in for a principal.
- **Remote-operation requirements:** `remote-operator-adapter` is its own principal, never the
  operator's personal identity.
- **Empirical completion criteria:** for each materialized principal, a command executed under it
  shows that principal's mechanical identity in the audit record; a cross-principal attempt is
  rejected.
- **Status at freeze:** `nortropic-promoter` carries a hard external prerequisite — GitHub App
  "Nortropic Promoter" does not exist (`docs/loop/codex-autopilot-v3-full-roadmap.md`).

---

### IDENTITY-02 — Capability and access bundles

- **Target:** control-plane policy.
- **Dependencies:** IDENTITY-01.
- **Authority prerequisites:** owner approval of each bundle's contents.
- **Positive exit criteria:** each principal is bound to an explicit, VERSIONED bundle naming:
  repositories, read paths, write paths, tools, network destinations, external API operations,
  credential classes, task classes, and expiry/revocation. DEFAULT DENY. Existing enforced bundles
  are reused as precedent and, where applicable, as implementation:
  `config/managed-settings.json` (34 permission denies, 13 sandbox write denies, network allowlist
  `api.anthropic.com` only) and `specs/owner-production-paths.v1.json` in `nortropic-system`, and
  per-task `allowedWrite`/`deniedWrite` enforcement via `scripts/claude-loop/scope.ts` in this
  repository.
- **Negative controls:** a capability inferred from role prose → FAIL; a broad personal operator
  credential used → FAIL; an unlisted network destination reachable → FAIL; a stale bundle version
  accepted → FAIL; default-allow anywhere → FAIL.
- **Security requirements:** bundles are versioned data, not code comments; expiry and revocation are
  enforced, not documented.
- **Remote-operation requirements:** remote adapters carry their own bundle; a remote request can
  never widen a bundle.
- **Empirical completion criteria:** for one principal, an operation inside the bundle succeeds and
  the same operation against an unlisted destination is denied, both with audit evidence.

---

### IDENTITY-03 — Nortropic Credential Proxy

- **Target:** a separately threat-modelled control-plane component.
- **Dependencies:** IDENTITY-01, IDENTITY-02.
- **Authority prerequisites:** the threat model and its adversarial gates are FROZEN BEFORE
  production implementation begins.
- **Positive exit criteria:** the request path is implemented exactly as: agent request →
  authenticate execution principal → bind current task/run/candidate → validate destination →
  validate operation → validate capability bundle → inject or broker the minimum credential →
  execute or request → emit auditable evidence. Requirements: default-deny destinations, secret
  redaction, rotation, revocation, short-lived grants, no secret in model context, browser,
  repository or generic logs, replay protection, and task/run binding.
- **Negative controls:** proxy bypass reaching a destination directly → FAIL; a secret appearing in
  model context, browser, repository or a generic log → FAIL; a replayed grant accepted → FAIL; a
  grant used outside its bound task/run → FAIL; a revoked credential still working → FAIL; an
  expired grant still working → FAIL.
- **Security requirements:** the proxy is the only holder of the broad credential; agents receive a
  permitted capability, never a broad raw secret. Note the measured precedent and its limit:
  `controller/launch/cli` strips `GH_`/`GITHUB_`/`SLACK_` prefixes from worker env and is documented
  in the backend as NOT sufficient as a privilege boundary.
- **Remote-operation requirements:** remote adapters obtain credentials only through the proxy.
- **Empirical completion criteria:** the frozen adversarial gates run against the real component and
  each negative control is observed failing the attack, with `NOT_RUN` reported for any control that
  could not be executed.

---

### OBSERVER-01 — Signal-based ambient observer

- **Target repositories:** controller projections, an observer service, and clients.
- **Dependencies:** SUPERVISOR-01, REMOTE-00.
- **Authority prerequisites:** the conditions must be derivable from controller-published state, not
  from prose.
- **Positive exit criteria:** MACHINE-SIGNAL notifications for: task blocked beyond a policy
  threshold; no eligible ready work; owner authority explicitly required; the same gate failing
  repeatedly; a backend dependency now satisfied; main drift; transport outage; stale run; credential
  expiry or revocation; a remote command rejected. A model may summarize a mechanically triggered
  condition ONLY AFTER the trigger fired.
- **Negative controls:** a model-invented notification → FAIL; a notification without a mechanical
  trigger record → FAIL; a summary emitted before the trigger → FAIL; a notification carrying a
  secret → FAIL.
- **Security requirements:** notification payloads carry references, not secrets; delivery respects
  the transport's own credential rules.
- **Remote-operation requirements:** notifications reach REMOTE-04 clients including phones.
- **Empirical completion criteria:** each of the ten conditions is provoked and observed producing
  exactly one mechanically triggered notification.
- **Relationship to `h-014`:** this observer does not replace the controller-alarm channel specced as
  backend `h-014` (`controller/notis`) and does not move its secret handling
  (`~/.nortropic/slack-webhook`, owner decision `LOOP-AGARHAND-37`).

---

### AUDIT-01 — Complete causal audit and attribution

- **Target repositories:** control-plane evidence and read model.
- **Dependencies:** ROOM-03, ROOM-04, IDENTITY-01, IDENTITY-02.
- **Authority prerequisites:** the identity contract from ROOM-04.
- **Positive exit criteria:** every operation is traceable by STABLE IDENTIFIERS from trigger to
  publication: source identity and hash; asked-by; remote/client identity; command identity; run,
  task and attempt identity; workflow role; execution principal; provider and model identity;
  capability bundle; workspace; base SHA; candidate SHA; gate identity; review identity; evidence
  references; PR identity; merge/promotion identity; authoritative main result. The audit
  DISTINGUISHES: workflow claim / mechanically authenticated identity / model output / gate result /
  owner authority.
- **Negative controls:** an audit record manufacturing a trust verdict → FAIL; a workflow claim
  recorded as a mechanically authenticated identity → FAIL; model output recorded as a gate result →
  FAIL; a chain hop without a stable identifier → FAIL.
- **Security requirements:** audit records contain no secret values; they are append-only evidence.
- **Remote-operation requirements:** remote-issued operations carry remote/client identity into the
  same audit chain.
- **Empirical completion criteria:** one real end-to-end operation is reconstructed from the audit
  alone, from trigger to authoritative main, with each hop's class correctly labelled.

---

### RETRO-01 — Retrospective improvement agent

- **Target:** evidence analysis plus the ordinary task pipeline.
- **Dependencies:** AUDIT-01.
- **Authority prerequisites:** none beyond the ordinary pipeline; the agent has no authority of its
  own.
- **Positive exit criteria:** the agent analyzes completed runs for recurring review findings,
  builder failures, gate blind spots, excess remediation rounds, prompt weaknesses, missing skills,
  transport failures and remote usability failures, and MAY CREATE PROPOSED IMPROVEMENT TASKS.
- **Negative controls:** the agent modifying its own rules → FAIL; modifying gates → FAIL; modifying
  permissions → FAIL; modifying authority → FAIL; an improvement reaching main without the normal
  test-author/builder/reviewer/publication process → FAIL.
- **Security requirements:** runs under its own principal (IDENTITY-01) with a read-oriented bundle.
- **Remote-operation requirements:** none.
- **Empirical completion criteria:** one proposed improvement is shown travelling the ordinary
  pipeline end to end, and one attempted self-modification is shown blocked by write scope.

---

### REMOTE-00 — Common remote operator adapter

- **Target repositories:** the controller read/command interface plus a shared adapter.
- **Dependencies:** ROOM-05, ROOM-06.
- **Authority prerequisites:** backend S13 for the controller-side interface. The
  Verkstadsgolvet-side adapter SHAPE may be designed and fixture-proven earlier.
- **Positive exit criteria:** ONE stable, Nortropic-owned remote interface used by ALL clients,
  exposing: controller snapshots; events and backfill; task inspection; evidence references; command
  submission; command status; notifications. It accepts ONLY the authoritative typed intentions.
  Remote sessions are authenticated, scoped and replay-resistant.
- **Negative controls:** an incoming generic shell payload accepted → FAIL; incoming generic Git →
  FAIL; a remote owner-authority operation performed without a separately designed, frozen and
  explicitly authorized path → FAIL; a second parallel remote semantic implementation → FAIL; a
  replayed remote session accepted → FAIL.
- **Security requirements:** own principal (`remote-operator-adapter`), own capability bundle,
  credentials via IDENTITY-03, default-deny destinations.
- **Remote-operation requirements:** this slice IS the remote contract; REMOTE-01..04 are clients of
  it and add no verbs.
- **Empirical completion criteria:** two different clients drive the same operation through the same
  adapter and produce identical audit records apart from client identity.
- **Status at freeze:** controller-side half `BLOCKED` — `nortropic-codex-autopilot roadmap prints
  UNFROZEN for S5/S10/S13 at 32b6e07`.

---

### REMOTE-01 — Real Slack / Claude Tag integration (REQUIRED deliverable)

- **Target:** a Slack / Claude Tag adapter plus the remote operator interface.
- **Dependencies:** REMOTE-00.
- **Authority prerequisites:** owner authorization for remote operation; the typed verb set frozen.
- **Positive exit criteria:** at least these operations work from the conversational client: status;
  what-needs-attention; submit Markdown or text; start an eligible run; inspect a run or task; pause
  after the current task; resume; show command status; show evidence links; receive observer
  notifications. Claude Tag is a CONVERSATIONAL CLIENT, not the controller: it calls the same adapter
  and the same typed intentions as Verkstadsgolvet, and Claude memory is ergonomic context only.
- **Negative controls:** Claude Tag receiving the owner freeze secret → FAIL; receiving an
  unrestricted production credential → FAIL; receiving the promoter credential → FAIL; generic shell
  → FAIL; generic Git → FAIL; direct main mutation → FAIL; a wrong Slack user or channel accepted →
  FAIL; a duplicate or replayed message executing twice → FAIL.
- **Security requirements:** sender identity is verified and allowlisted; the adapter holds the
  credentials, the conversational client never does.
- **Remote-operation requirements:** empirical proof uses the REAL Slack / Claude Tag product when
  account access is available. Before implementing, current behaviour is verified against current
  official Anthropic documentation and the version, availability and contract are pinned in evidence.
- **Pinned verification (2026-08-14, `/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md`):**
  Claude Tag (Claude in Slack) is PUBLIC BETA, Team/Enterprise plans only; conversational only; NO
  custom MCP backends (Anthropic-managed connectors only); no inbound API or webhook layer; per-scope
  Access bundles; requires org-Owner pairing and Routines enabled. The adapter design must therefore
  route through the stable Nortropic operator API and NEVER through a direct Claude-Tag backend
  attachment — none exists.
- **Empirical completion criteria:** the ten listed operations are performed from the real product
  and produce correct controller-confirmed results. External entitlement prerequisite: a
  Team/Enterprise claude.ai organization with Claude Tag enabled — recorded as a remote prerequisite;
  its absence is `BLOCKED`, never a reason to drop the deliverable.
- **Relationship to `h-014`:** REMOTE-01 does not replace or absorb the controller-alarm channel
  specced as backend `h-014`, and respects owner decision `LOOP-AGARHAND-37`, which explicitly
  REJECTED the Claude Code Slack plugin as the alarm mechanism because it is model-facing and alarms
  must fire when no model session survives.

---

### REMOTE-02 — Claude Code Channels integration (REQUIRED deliverable)

- **Target:** a feature-flagged Channel adapter plus the remote operator interface.
- **Dependencies:** REMOTE-00.
- **Authority prerequisites:** owner authorization for preview infrastructure.
- **Positive exit criteria:** Channel events and requests translate ONLY into read requests, typed
  intentions and non-authoritative context. No Channel event becomes canonical task state by itself.
  If preview: a feature flag is required; the protocol and version are pinned; a fallback path
  exists; preview removal is non-destructive; preview infrastructure is never canonical authority.
- **Negative controls:** a Channel event alone changing task state → FAIL; an unauthorized sender
  accepted → FAIL; a duplicate event executing twice → FAIL; a stale session accepted → FAIL; a
  reconnect losing or duplicating an intention → FAIL; preview removal destroying canonical data →
  FAIL.
- **Security requirements:** sender-identity allowlist gating is MANDATORY; the channel server holds
  no broad credential.
- **Remote-operation requirements:** implementable locally as a feature-flagged CUSTOM MCP CHANNEL
  SERVER fronting the operator API.
- **Pinned verification (2026-08-14, same evidence file):** Claude Code Channels is a RESEARCH
  PREVIEW; channels are LOCAL MCP servers pushing `notifications/claude/channel` events into a
  RUNNING session; custom channels are allowed behind the preview flag
  `--dangerously-load-development-channels`; sender-identity allowlist gating is mandatory; events
  queue only while a session is open. The preview status and flags are pinned in evidence.
- **Empirical completion criteria:** empirical tests for reconnect, duplicate event, stale session
  and unauthorized sender all observed.

---

### REMOTE-03 — Claude Code Routines integration (REQUIRED deliverable)

- **Target:** a feature-flagged Routines adapter plus Nortropic triggers.
- **Dependencies:** REMOTE-00, OBSERVER-01.
- **Authority prerequisites:** owner authorization; the ordinary task pipeline for anything a Routine
  proposes.
- **Positive exit criteria:** candidate uses implemented as PROPOSAL generators: scheduled drift
  audit; dependency research; PR/review triage; documentation drift detection; market and environment
  monitoring; observer follow-up; remote scheduled status summaries. Trigger semantics, repository
  identity, connector identity and resulting evidence are PINNED.
- **Negative controls:** a Routine replacing candidate, gate, review, attestation or promotion
  machinery → FAIL; a Routine-proposed code or control-plane change reaching main outside the
  ordinary task pipeline → FAIL; untrusted fire-endpoint text treated as a command → FAIL.
- **Security requirements:** fire-endpoint text is explicitly untrusted input and is never routed to
  a tool; the Routine holds no broad credential.
- **Remote-operation requirements:** results are proposals; they enter the ordinary pipeline.
- **Pinned verification (2026-08-14, same evidence file):** Claude Code Routines is a RESEARCH
  PREVIEW; account-owned scheduled cloud runs; triggers are schedule, an HTTP fire endpoint
  (`anthropic-beta: experimental-cc-routine-2026-04-01`; fire text explicitly untrusted) and GitHub
  events; NO custom MCP servers (connectors only); results are claude.ai sessions with no push
  delivery. The dated beta header is pinned as the version.
- **Empirical completion criteria:** one scheduled trigger and one fire-endpoint trigger produce
  evidence-linked proposals that are then carried by the ordinary pipeline.

---

### REMOTE-04 — Remote notifications and mobile operation

- **Target:** a shared notification layer and its clients.
- **Dependencies:** OBSERVER-01, ROOM-08, REMOTE-00.
- **Authority prerequisites:** none beyond OBSERVER-01's triggers.
- **Positive exit criteria:** safe phone operation for: status; attention notification; task
  inspection; evidence inspection; intake; start; pause at safe boundary; resume; command result;
  transport status.
- **Negative controls:** a critical distinction carried by colour alone → FAIL; a remote action
  claiming success before controller confirmation → FAIL; a notification without a mechanical trigger
  → FAIL; an authority-changing action reachable without confirmation → FAIL.
- **Security requirements:** notification content carries references, not secrets; device delivery
  uses no broad credential.
- **Remote-operation requirements:** this slice is the mobile and notification half of remote
  operation.
- **Empirical completion criteria:** a real phone session performs the ten listed operations and each
  result is shown to be controller-confirmed.

---

### HARDEN-01 — Identity, remote and credential adversarial hardening

- **Target repositories:** all affected repositories and components.
- **Dependencies:** IDENTITY-01, IDENTITY-02, IDENTITY-03, REMOTE-00, CONTEXT-01, SUPERVISOR-01.
- **Authority prerequisites:** the adversarial gates are FROZEN before the implementations they test
  are declared complete.
- **Positive exit criteria:** negative controls frozen AND RUN for every one of: forged role; forged
  execution principal; stale capability bundle; revoked credential; wrong remote user or channel;
  duplicate command; replayed command; expired command; stale expected watermark; cross-room context
  leak; cross-channel context leak; secret exfiltration; destination bypass; generic command
  smuggling; prompt injection into tool routing; event disorder; snapshot/tail divergence; transport
  outage; process death; stale supervisor; provider drift; credential proxy bypass; direct main
  attempt.
- **Negative controls:** the list above IS the negative-control set. `NOT_RUN` remains DISTINCT from
  `PASS` in every report; a control that could not be executed is reported `NOT_RUN` with its exact
  blocker.
- **Security requirements:** each control asserts the attack fails, not merely that the happy path
  works.
- **Remote-operation requirements:** the remote-specific controls run against the real transports
  where entitlement exists, and are reported `BLOCKED` with prerequisite evidence where it does not.
- **Empirical completion criteria:** a single report enumerates all twenty-three controls with a
  status each, and no control is silently omitted.

---

### EMPIRICAL-01 — Unattended remote end-to-end proof

- **Target:** the full system.
- **Dependencies:** every other slice.
- **Authority prerequisites:** guarded publication authorization; a real controller; real remote
  entitlements for the remote leg.
- **Positive exit criteria — the minimum scenario, all thirteen steps:**
  1. submit real work remotely;
  2. the controller validates the exact source;
  3. tasks are compiled by the controller;
  4. an eligible run starts;
  5. the builder works autonomously;
  6. reviewer findings are remediated;
  7. gates run;
  8. guarded publication occurs when authorized;
  9. the remote client receives accurate status;
  10. pause and resume are tested at a safe boundary;
  11. evidence is inspectable remotely;
  12. final authoritative main is controller-confirmed;
  13. no local interactive terminal handoff is required during the ordinary flow.
  Additionally exercised: network interruption; client restart; controller/worker restart; duplicate
  remote request; rejected stale request; observer notification; and the no-ready-work terminal
  condition.
- **Negative controls:** the scenario declared complete because a UI demo worked → FAIL; a step
  simulated rather than executed and reported as `PASS` → FAIL; an interactive terminal handoff
  required in the ordinary flow → FAIL; main advanced without controller confirmation → FAIL.
- **Security requirements:** no step requires a broad credential in a model context or a browser.
- **Remote-operation requirements:** the submission and the status read happen through a real remote
  client.
- **Empirical completion criteria:** the run is reported with base SHA, candidate SHA, merge SHA, PR
  URL, gate exit codes, decisive test output and evidence paths, and the authoritative main result is
  read back from the controller.

---

## 6. Source-coverage ledger

Status vocabulary, exactly one per item:
`NOT_STARTED` / `IN_PROGRESS` / `PROVEN` / `BLOCKED` / `DEFERRED_BY_OWNER` / `REJECTED_WITH_REASON`.

`PROVEN` requires exact implementation AND evidence references. A design document alone is not proof.
No percentages. Lack of an external account, entitlement or production availability is `BLOCKED` with
exact prerequisite evidence — never permission to remove an item.

```text
SOURCE_A = Claude Tag / persistent teammate / remote conversational workspace.
SOURCE_B = Agent identity / service accounts / access bundles / Agent Proxy / persistent sessions /
           audit and evidence.
```

### 6.1 Factory-room and interaction model

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| A1 | persistent Factory Room | `NOT_STARTED` | no room components (`ls components/loop`); ROOM-01 |
| A2 | operator can feed work into the room | `IN_PROGRESS` | fixture intake UX exists (`components/loop/IntakeShell.tsx`, `app/(app)/loop/mata/page.tsx`); live transport `INTAKE_TRANSPORT="NONE"` (`lib/loop/intake.ts:61`); ROOM-02 |
| A3 | shared durable context | `NOT_STARTED` | no context store measured; CONTEXT-01 |
| A4 | context survives ordinary sessions | `NOT_STARTED` | CONTEXT-01 |
| A5 | context is editable and auditable | `NOT_STARTED` | CONTEXT-01 |
| A6 | context is never canonical authority | `NOT_STARTED` | lock `ROOM_CONTEXT_IS_AUTHORITY=NO` is stated here; no implementation exists to enforce it yet; CONTEXT-01 |
| A7 | current work, backlog and output are visible | `IN_PROGRESS` | `components/loop/{MaskinShell,CurrentTaskPanel,BacklogColumn,CompletedColumn}.tsx` render this from fixtures; ROOM-01 recomposes it |
| A8 | technical evidence remains inspectable | `IN_PROGRESS` | `evidence_refs` and gate fields carried in `TaskViewSchema` (`lib/loop/schema.ts`); no inspector projection; ROOM-03 |
| A9 | natural-language operator UX | `NOT_STARTED` | ROOM-07 |
| A10 | natural language resolves only to typed intentions | `NOT_STARTED` | no NL layer exists to constrain; ROOM-07 |
| A11 | no model-generated generic command execution | `PROVEN` | the only command surface is a typed discriminated union of five verbs (`lib/loop/schema.ts:441-445,453`) with `COMMAND_QUEUE_TRANSPORT="NONE"` (`lib/loop/commands.ts:101`); asserted by `tests/loop/v7-command-surface.test.ts`. Scope: the surface that exists today; re-proved per slice as surfaces are added |

### 6.2 Autonomous ownership

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| B1 | persistent task/supervisor state | `PROVEN` | `scripts/claude-loop/state.ts`, `scripts/claude-loop/ledger.ts:46,78,95,113`, claims records `scripts/claude-loop/claims.ts:34-95`; tests `tests/claude-loop/{claims,config,schemas}.test.ts` |
| B2 | autonomous continuation across ordinary slices | `IN_PROGRESS` | `scripts/claude-loop/autopilot.ts` + `tests/claude-loop/autopilot.test.ts` prove it for the Claude Factory; controller-side equivalent unbuilt; SUPERVISOR-01 |
| B3 | event-driven wakeups | `NOT_STARTED` | no wakeup primitive measured in `scripts/claude-loop/autopilot.ts`; SUPERVISOR-01 |
| B4 | bounded remediation loops | `PROVEN` | no-progress circuit breaker `scripts/claude-loop/supervisor.ts:156-212`; test `tests/claude-loop/autonomy-circuit-breaker.test.ts`; runbook section "Remediation circuit breaker" |
| B5 | reviewer findings return to builder | `PROVEN` | `scripts/claude-loop/review-policy.ts`; test `tests/claude-loop/review-policy.test.ts` |
| B6 | no ordinary manual handoff between green slices | `IN_PROGRESS` | autopilot + claims cover the Claude Factory; the remote and controller legs are unproven; EMPIRICAL-01 step 13 |
| B7 | safe recovery after process death | `PROVEN` | stale-claim recovery `scripts/claude-loop/claims.ts:306`, fail-closed liveness checkpoint `scripts/claude-loop/supervisor.ts:294`, `npm run claude:resume`; test `tests/claude-loop/production-recovery.test.ts` |
| B8 | continue until no eligible task remains | `IN_PROGRESS` | `scripts/claude-loop/backlog.ts` eligibility + autopilot loop; the terminal no-ready-work condition is not yet a signalled, remotely observable state; SUPERVISOR-01, OBSERVER-01 |

### 6.3 Agent identity

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| C1 | asked-by identity | `NOT_STARTED` | `grep asked_by lib/ app/ components/` → no match; ROOM-04 |
| C2 | workflow role | `IN_PROGRESS` | roles exist as workflow lanes (`scripts/claude-loop/authority.ts`, `scripts/claude-loop/owner-author/`); not projected as an evidence-bound contract field; ROOM-04 |
| C3 | model provider | `IN_PROGRESS` | backend `h-032` `config/codex-provider-identity.json` binds the provider executable by path plus sha256 (owner-frozen); no projection into the read model; ROOM-04 |
| C4 | model identity/version | `IN_PROGRESS` | `builder.model` exists in the contract (`lib/loop/schema.ts:356-359`); no version binding or evidence reference; ROOM-04 |
| C5 | authenticated execution principal | `IN_PROGRESS` | backend `h-033` `_nortropic_provenance` OS identity, root-owned receipts, digest-bound artifact manifest; no principal field in the read model; ROOM-04, IDENTITY-01 |
| C6 | service-account identity | `NOT_STARTED` | no dedicated service principals measured; IDENTITY-01 |
| C7 | session identity | `NOT_STARTED` | ROOM-04, AUDIT-01 |
| C8 | capability/access-bundle identity | `IN_PROGRESS` | real enforced bundles exist (`config/managed-settings.json`, `specs/owner-production-paths.v1.json`, `scripts/claude-loop/scope.ts`); no bundle IDENTITY carried as a field; IDENTITY-02 |
| C9 | evidence reference for every asserted identity | `NOT_STARTED` | ROOM-04 |
| C10 | promotion authority shown separately | `BLOCKED` | GitHub App "Nortropic Promoter" does not exist (`docs/loop/codex-autopilot-v3-full-roadmap.md`); backend S7 gated; IDENTITY-01, ROOM-04 |
| C11 | workflow role never treated as a security boundary | `PROVEN` | `CLAUDE.md` locks `CLAUDE_ROLE_SEPARATION=WORKFLOW` and `CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO`; mechanical write scope is enforced independently of role prose (`scripts/claude-loop/scope.ts`); test `tests/claude-loop/role-tools.test.ts` |

### 6.4 Capability and credential architecture

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| D1 | dedicated builder identity | `NOT_STARTED` | role separation is workflow-only today; IDENTITY-01 |
| D2 | dedicated reviewer identity | `NOT_STARTED` | IDENTITY-01 |
| D3 | dedicated owner-author identity where required | `IN_PROGRESS` | owner-author LANE exists (`scripts/claude-loop/authority.ts`, `scripts/claude-loop/owner-author/settings.json`; backend `h-035` authority classes `ordinary`/`owner_authority`, `controller/authority/cli`); no separate mechanical principal; IDENTITY-01 |
| D4 | dedicated promoter identity | `BLOCKED` | GitHub App "Nortropic Promoter" not created (`docs/loop/codex-autopilot-v3-full-roadmap.md`); only `FULL_ROADMAP_SOFTWARE_COMPLETE` may be set until it exists |
| D5 | exact repository scopes | `IN_PROGRESS` | per-task `allowedWrite`/`deniedWrite` enforced by `scripts/claude-loop/scope.ts`; backend `config/managed-settings.json` sandbox write denies; not yet per-principal; IDENTITY-02 |
| D6 | exact operation scopes | `IN_PROGRESS` | publication forbids rebase/squash/force/amend/delete-branch/admin (`scripts/claude-loop/publication.ts:35-40`); Git argv safety guards exist; not yet a per-principal operation scope; IDENTITY-02 |
| D7 | default-deny external destinations | `IN_PROGRESS` | backend `config/managed-settings.json` network allowlist is `api.anthropic.com` only; no programme-wide default-deny for all principals; IDENTITY-02, IDENTITY-03 |
| D8 | capability bundles | `IN_PROGRESS` | `specs/owner-production-paths.v1.json` is a real versioned authority registry; no per-principal bundle registry; IDENTITY-02 |
| D9 | revocation | `NOT_STARTED` | IDENTITY-02, IDENTITY-03 |
| D10 | credential rotation | `NOT_STARTED` | IDENTITY-03 |
| D11 | Agent Proxy / credential-proxy model | `NOT_STARTED` | no proxy measured; IDENTITY-03 |
| D12 | agent receives a permitted capability rather than broad raw secrets | `NOT_STARTED` | closest precedent is backend `controller/launch/cli` env stripping of `GH_`/`GITHUB_`/`SLACK_`, documented there as NOT sufficient as a privilege boundary; IDENTITY-03 |
| D13 | no secrets in browser, model output, logs, repository or evidence payloads | `IN_PROGRESS` | mechanically asserted for this repository by `tests/loop/security.ts` (client env shapes `:79-121`, credential import graph `:379-393`), `tests/loop/v10-security-hardening.test.ts` and `tests/claude-loop/secret-guard.test.ts`; not yet asserted across proxy, remote transports and evidence payloads; HARDEN-01 |

### 6.5 Observer, audit and learning

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| E1 | signal-based ambient observer | `NOT_STARTED` | no observer service; backend `h-014` specced but unbuilt; OBSERVER-01 |
| E2 | blocked-task notification | `NOT_STARTED` | OBSERVER-01 |
| E3 | no-ready-work notification | `NOT_STARTED` | OBSERVER-01 |
| E4 | repeated-gate-failure notification | `NOT_STARTED` | breaker fingerprints exist (`docs/claude-loop-runbook.md` "Fingerprints") but no notification path; OBSERVER-01 |
| E5 | owner-attention-required notification | `NOT_STARTED` | OBSERVER-01 |
| E6 | dependency-satisfied wakeup | `NOT_STARTED` | SUPERVISOR-01, OBSERVER-01 |
| E7 | main-drift block and notification | `IN_PROGRESS` | drift handling exists in `scripts/claude-loop/progress.ts` and `scripts/claude-loop/autopilot.ts`; no notification path; OBSERVER-01 |
| E8 | full causal chain (operator/source → command → run → task → attempt → agent session → candidate → gate → reviewer → evidence → PR → merge/promotion) | `IN_PROGRESS` | partial identifiers in `TaskViewSchema` and the run ledger; no end-to-end chain; ROOM-03, AUDIT-01 |
| E9 | retrospective agent | `NOT_STARTED` | RETRO-01 |
| E10 | retrospective changes travel through normal task/gate/review authority | `NOT_STARTED` | no retrospective agent exists yet; the pipeline it must use is proven (`docs/claude-operating-model-v1.md`, `scripts/claude-loop/**`); RETRO-01 |
| E11 | no spontaneous self-modification of control rules | `PROVEN` | product agents are denied `.claude/**`, `CLAUDE.md` and the authority documents by `CLAUDE.md` and by mechanical write scope (`scripts/claude-loop/scope.ts`, per-task `deniedWrite`); tests `tests/claude-loop/{policy,role-tools,history-rewrite}.test.ts` |

### 6.6 Required remote operation

| # | Item (verbatim) | Status | Evidence / prerequisite |
| --- | --- | --- | --- |
| F1 | common remote operator API/MCP or equivalent narrow adapter | `BLOCKED` | controller-side interface needs backend S13: `nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07`; adapter shape may be fixture-proven earlier; REMOTE-00 |
| F2 | real Slack / Claude Tag integration | `BLOCKED` | external entitlement: Team/Enterprise claude.ai organization with Claude Tag enabled, org-Owner pairing and Routines enabled (public beta; no custom MCP backends, no inbound API layer) — `/Users/elinhaggstrom/nortropic/evidence/factory-room/remote-surfaces-verification-2026-08-14.md`; REMOTE-01 |
| F3 | Claude Code Channels integration | `NOT_STARTED` | implementable locally as a feature-flagged custom MCP channel server behind `--dangerously-load-development-channels` (research preview) — same evidence file; REMOTE-02 |
| F4 | Claude Code Routines integration | `BLOCKED` | external entitlement: claude.ai account with the Routines research preview enabled; beta header `anthropic-beta: experimental-cc-routine-2026-04-01` — same evidence file; REMOTE-03 |
| F5 | mobile-readable status | `NOT_STARTED` | visual-review viewports exist (mobile 390x844) but no mobile room; ROOM-08 |
| F6 | remote intake | `BLOCKED` | backend S10 + S13: `nortropic-codex-autopilot roadmap prints UNFROZEN for S5/S10/S13 at 32b6e07`; ROOM-02, REMOTE-00 |
| F7 | remote inspect | `BLOCKED` | backend S13 for live inspection data; fixture-mode inspect may precede it; ROOM-03, REMOTE-00 |
| F8 | remote run start | `BLOCKED` | backend S13; `COMMAND_QUEUE_TRANSPORT="NONE"` (`lib/loop/commands.ts:101`); ROOM-06 |
| F9 | remote safe-boundary pause | `BLOCKED` | backend S13; verb exists in the typed contract (`lib/loop/schema.ts:443`) with no transport; ROOM-06 |
| F10 | remote resume | `BLOCKED` | backend S13; ROOM-06 |
| F11 | remote notifications | `NOT_STARTED` | no notification layer; OBSERVER-01, REMOTE-04 |
| F12 | remote command-status visibility | `BLOCKED` | backend S13; command status presentation exists locally (`lib/loop/commands.ts:749`) with no live source; ROOM-06, REMOTE-00 |
| F13 | remote evidence links | `NOT_STARTED` | `evidence_refs` carried in the contract; no remote projection; ROOM-03, REMOTE-00 |
| F14 | remote session recovery | `NOT_STARTED` | REMOTE-00, HARDEN-01 |

---

## 7. Final-report schema

Every programme report uses this structure. Status vocabulary is
`PROVEN | OVERIFIERAT | NOT_RUN | PASS | FAIL` plus the ledger vocabulary in section 6. No
percentages.

```text
REPORT HEADER
  REPORT_DATE=<ISO date>
  OPERATING_MODE=<mode the session ran in>
  TERMINAL_REASON=<why the session stopped>

CANONICAL ROADMAP IDENTITY
  ROADMAP_PATH=docs/nortropic-factory-room-master-roadmap-v1.md
  ROADMAP_COMMIT=<sha>
  HANDOFF_PATH=docs/nortropic-factory-room-handoff-v1.md
  BACKLOG_PATH=backlog/nortropic-factory-room-master-v1.json

AUTHORITATIVE REPOSITORY STATE
  NORTROPIC_VERKSTADSGOLVET_MAIN=<sha> (measured <date>)
  NORTROPIC_SYSTEM_MAIN=<sha> (measured <date>)

PER-SLICE COMPLETED BLOCK (repeat per completed slice)
  SLICE_ID=
  TARGET_REPOSITORY=
  STATUS=
  BASE_SHA=
  CANDIDATE_SHA=
  MERGE_SHA=
  PR_URL=
  CHANGED_FILES=
  TEST_COMMANDS=
  TEST_EXIT_CODES=
  DECISIVE_TEST_OUTPUT=
  SCREENSHOT_PATHS=
  VIEWPORTS=
  REVIEWER_RESULT=
  VISUAL_REVIEWER_RESULT=
  EMPIRICAL_RESULT=
  EVIDENCE_PATHS=

PER-SLICE BLOCKED BLOCK (repeat per blocked slice)
  SLICE_ID=
  EXACT_BLOCKER=
  BLOCKER_CLASS=
  COMMAND_OR_PATH_EVIDENCE=
  OWNER_OR_EXTERNAL_PREREQUISITE=
  INDEPENDENT_WORK_CONTINUED=

SOURCE-COVERAGE LEDGER
  <every row from section 6, with its single status and evidence or prerequisite>

REMOTE-OPERATION STATUS
  <REMOTE-00..REMOTE-04 with status, pinned versions and entitlement prerequisites>

SECURITY AND AUTHORITY PROOF LINES
  <one line per lock in section 4, each with the mechanical evidence that it held>

REMAINING WORK
  <exact next eligible slices and their prerequisites>

PUBLICATION SUMMARY
  FORCE_OPERATIONS=0
  HISTORY_REWRITES=0
  <merge commits produced, with PR identity>

FINAL EVIDENCE CLASSIFICATION
  PROVEN=<list>
  OVERIFIERAT=<list>
  NOT_RUN=<list>
  BLOCKERS=<list>
```

---

## 8. Frozen-scope restatement

After independent review and guarded publication:

- The requirements portion of this document is FROZEN.
- Ordinary product builders must not rewrite it.
- Changing it requires a separate, explicit roadmap-authority task.
- No frozen test, owner gate, authority file or security invariant may be weakened to make an
  implementation pass.
- Nothing in this programme is described as live-complete while it is fixture-backed.
- Nothing in this programme is marked `PROVEN` beyond what the repository mechanically proves.
