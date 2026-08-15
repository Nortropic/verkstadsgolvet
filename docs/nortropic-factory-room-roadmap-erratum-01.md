# Nortropic Factory Room — master roadmap ERRATUM 01

## Document identity and correction vehicle

```text
ERRATUM_ID              = nortropic-factory-room-roadmap-erratum-01
ERRATUM_PATH            = docs/nortropic-factory-room-roadmap-erratum-01.md
CORRECTS                = docs/nortropic-factory-room-master-roadmap-v1.md (FROZEN — not edited)
ALSO_UPDATED            = backlog/nortropic-factory-room-master-v1.json
                          docs/nortropic-factory-room-handoff-v1.md
OWNING_REPOSITORY       = Nortropic/verkstadsgolvet
MEASURED_AT             = 2026-08-15
FROZEN_ROADMAP_EDITED   = NO
CORRECTION_MECHANISM    = DEDICATED_ADDENDUM_DOCUMENT
```

The master roadmap's FREEZE SEMANTICS forbid an ordinary builder from rewriting the frozen
requirements portion — including renaming or renumbering slices. This erratum is therefore the
correction vehicle: the frozen file is left byte-identical and history is corrected here, in a
separate document that the frozen roadmap must be read together with.

Reading order where this document and the frozen roadmap could be read as disagreeing: for the two
subjects corrected below (remote operation classification and slice numbering; deployment
verification path) **this erratum wins**. For everything else the frozen roadmap stands unchanged.
`CLAUDE.md`, `docs/nortropic-control-room-plan-v1.md` and `docs/claude-operating-model-v1.md`
remain authoritative above both documents; nothing here weakens an authority boundary, an exit
criterion, a negative control or a security invariant. No slice is dropped, merged or softened —
one previously mandatory external entitlement is reclassified as optional, and one required
deliverable is added.

---

## ERRATUM 1 — REMOTE OPERATION

```text
PREVIOUS_MISCLASSIFICATION=Anthropic Claude Tag entitlement treated as blocker for required Slack
remote operation (roadmap REMOTE-01 conflated Anthropic's managed Claude Tag product with the
required Nortropic-owned Slack interface).
```

```text
CORRECTED_DECISION=Nortropic builds its OWN Slack app/bot above the Remote Operator API. Anthropic
Claude Tag is optional.
ANTHROPIC_CLAUDE_TAG_REQUIRED=NO
CLAUDE_TAG_TEAM_ENTERPRISE_ENTITLEMENT_IS_CORE_BLOCKER=NO
NORTROPIC_SLACK_APP_REQUIRED=YES
REMOTE_OPERATION_FROM_PHONE_REQUIRED=YES
```

The misclassification was a category error, not a scope decision: Anthropic's managed Claude Tag
product (public beta, Team/Enterprise only, conversational only, no custom MCP backends, no inbound
API layer) was treated as *the* way to reach Slack. It is not. Slack is an open platform; a
Nortropic-owned Slack app talking to the Nortropic Remote Operator API needs no Anthropic
entitlement whatsoever. Buying a Team/Enterprise claude.ai plan is therefore not on the critical
path for remote operation from a phone.

### Corrected slice numbering (mapping table)

| Corrected id | Slice | Previous id | Classification |
| --- | --- | --- | --- |
| `REMOTE-00` | Common Nortropic Remote Operator API | `REMOTE-00` (unchanged) | REQUIRED |
| `REMOTE-01` | Nortropic Slack App / "Nortropic Tag" | `REMOTE-01` (scope corrected) | REQUIRED core deliverable |
| `REMOTE-02` | Anthropic Claude Tag optional adapter | NEW SLICE | OPTIONAL |
| `REMOTE-03` | Claude Code Channels adapter | `REMOTE-02` | REQUIRED |
| `REMOTE-04` | Claude Code Routines adapter | `REMOTE-03` | REQUIRED |
| `REMOTE-05` | Remote notifications and mobile operating flow | `REMOTE-04` | REQUIRED |

```text
REMOTE-00 = Common Nortropic Remote Operator API (unchanged)
REMOTE-01 = Nortropic Slack App / "Nortropic Tag" — REQUIRED core deliverable; does NOT depend on
            Anthropic Claude Tag entitlement; depends on REMOTE-00 for LIVE commands only
REMOTE-02 = OPTIONAL adapter for Anthropic's managed Claude Tag product (only if later desired and
            entitlement exists) — NEW slice
REMOTE-03 = Claude Code Channels adapter (previously REMOTE-02)
REMOTE-04 = Claude Code Routines adapter (previously REMOTE-03)
REMOTE-05 = Remote notifications and mobile operating flow (previously REMOTE-04)
```

Renumbering rule: any reference in the frozen roadmap to `REMOTE-02`, `REMOTE-03` or `REMOTE-04`
means, from this erratum onward, `REMOTE-03`, `REMOTE-04` and `REMOTE-05` respectively. The frozen
roadmap text is not edited to say so; this table is the translation. Each renamed slice in
`backlog/nortropic-factory-room-master-v1.json` carries a one-line evidence note
`renumbered per erratum-01: <old id> → <new id>`.

### Nortropic Slack App scope (REMOTE-01)

Conversational verbs, offered as `@nortropic` mentions, slash-commands or Block Kit equivalents:

```text
@nortropic status
@nortropic what needs attention
@nortropic submit <text-source>
@nortropic start
@nortropic pause after current task
@nortropic resume
@nortropic inspect <run-or-task>
@nortropic evidence <run-or-task>
```

ALL input resolves ONLY to the five canonical typed intentions:

```text
intake.submit
run.start
run.pause_at_safe_boundary
run.resume
inspect
```

No Slack input may become a shell command, a generic Git operation, a file edit, a verdict, an
attestation, a promotion, a mutation of authoritative main, or manipulation of lease/fencing
("lease-breaker") state. The verb surface is a translation layer, never an execution layer. The
controller may always reject any command, and rejection is a normal outcome, not an error to be
retried around. Slack reports only actual command state — `queued`, `claimed`, `applied`,
`rejected`, `expired` — and never optimistic success: no message may claim a result before the
controller has confirmed it.

### Identity and security requirements (REMOTE-01)

- Own bot identity. The Slack app authenticates as itself; the owner's personal credential is never
  the execution identity.
- Record separately, never collapsed into one another:
  `ASKED_BY_SLACK_USER`, `SLACK_TEAM_ID`, `SLACK_CHANNEL_ID`, `SLACK_THREAD_TS`, `SLACK_EVENT_ID`,
  `REMOTE_COMMAND_ID`, `CONTROLLER_RUN_ID`, `CONTROLLER_TASK_ID`, `EXECUTION_PRINCIPAL`,
  `CAPABILITY_BUNDLE`, `PROMOTION_AUTHORITY`.
- Verify Slack request signatures and timestamp freshness on every inbound request, or use
  authenticated Socket Mode.
- Explicit allowlists for workspace, user and channel.
- Slack event-id deduplication: a redelivered or replayed event executes at most once.
- Every write intention is bound to `command_id` + `expected_watermark` + an expiry.
- Credentials live server-side only; the Slack client never holds one.
- No logging of tokens, secrets or message content beyond the approved audit fields above.
- Revocation and rotation paths exist and are exercised.
- Fail closed on an unknown sender, workspace, channel or an invalid signature.
- The causal link Slack thread/event → command → run → task → evidence is preserved end to end.

### Timing relative to backend S13 (REMOTE-01)

Before backend S13 exists, the following MAY be built and tested against a fail-closed fake
transport: the Slack client shell, app identity, request authentication, allowlists, UX and message
design, and the typed-intent adapter contract. A missing S13 blocks LIVE command execution ONLY. It
never blocks the architecture, provisioning, verification, dedup, UX, translation tests, rejection
UX or notification-design work. Consequently REMOTE-01 is not wholly blocked: only its live half
depends on `REMOTE-00`, and a fake-transport slice that is honestly labelled as such is buildable
now. A fixture- or fake-transport-backed slice must still never be described as live-complete.

---

## ERRATUM 2 — RAILWAY

```text
PREVIOUS_DEPLOYMENT_ASSUMPTION=Railway deploy state treated as unknown (OVERIFIERAT) without
exhausting connected CLI access.
```

```text
CORRECTED_DECISION=The connected Railway CLI is the required production discovery and empirical
verification path.
```

Measured 2026-08-15 via the Railway CLI, version 5.41.0:

```text
project              verkstadsgolvet (27b6eb8a-e43e-41f3-a324-c06e83b0f56d)
environment          production (6866bf05-7148-4397-9844-11056838e3a9)
service              verkstadsgolvet (7ba0575d-5c74-4bde-a417-2d5f54ecb5de)
domain               verkstadsgolvet-production.up.railway.app
deploy mechanism     GitHub main auto-deploy (RAILPACK, reason=deploy)
latest deployment    f328ebee-f9f6-4bf0-9e76-281032735ddf  SUCCESS
deployed commit      cb133c53e189a14255faefceaeb459cd21165d2c (= origin/main at measurement)
environment variable LOOP_ENABLED=true present in the production environment
```

Operating consequences:

- GitHub merge is the single deploy path. `railway up` must NOT be used in parallel; a manual
  upload would make the deployed artifact diverge from authoritative main.
- Production completion claims require a CLI-verified deployed SHA plus an observed production URL.
  "It merged" is not "it is deployed".
- Deploy state must not be recorded as `OVERIFIERAT` while connected CLI access exists and has not
  been exhausted. Unknown remains a legitimate answer only after the available measurement has
  actually been attempted.

These are measured-at-date facts, not live truth. Re-measure before relying on them.

---

## Corrections applied by this erratum

```text
backlog/nortropic-factory-room-master-v1.json
    REMOTE-01 rewritten to the Nortropic Slack App scope; Claude Tag Team/Enterprise entitlement
              removed from remotePrerequisites (only a Slack workspace + app provisioning owner
              ceremony remains); blocker reduced to the REMOTE-00 dependency for LIVE commands,
              with fake-transport work explicitly unblocked
    REMOTE-02 NEW optional slice — Anthropic Claude Tag optional adapter
    REMOTE-03 renumbered from REMOTE-02 (Claude Code Channels)
    REMOTE-04 renumbered from REMOTE-03 (Claude Code Routines)
    REMOTE-05 renumbered from REMOTE-04 (remote notifications and mobile)
    every dependencies[] reference updated consistently; no status changed except the new slice's
    own NOT_STARTED

docs/nortropic-factory-room-handoff-v1.md
    REMOTE_INTEGRATION_STATUS uses the corrected numbering and records the deployment facts above;
    this erratum added to the authority reading list; CURRENT_BLOCKERS no longer carries the Claude
    Tag entitlement as a core blocker — it survives only inside optional REMOTE-02

docs/nortropic-factory-room-master-roadmap-v1.md
    NOT TOUCHED. Frozen. This erratum is the correction vehicle.
```
