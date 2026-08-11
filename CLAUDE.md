# Verkstadsgolvet — Claude Factory v1

## Product and authority

`Nortropic/verkstadsgolvet` is the operator-facing control room for the Nortropic autonomous website factory.
The authoritative control-room plan is `docs/nortropic-control-room-plan-v1.md`.

Nortropic controller state, verification, attestation, lease/fencing, promotion and authoritative-main truth are **not** owned by this repository or by Claude. Claude role separation is workflow only, never a security or trust boundary.

```text
CLAUDE_ROLE_SEPARATION=WORKFLOW
CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO
MODEL_READY_IS_TRUST_VERDICT=NO
NORTROPIC_TRUST_AUTHORITY=NO
DIRECT_NORTROPIC_STATE_MUTATION=NO
DIRECT_NORTROPIC_PROMOTION=NO
VERKSTADSGOLVET_CONTROL_MODEL=READ_OBSERVE_PLUS_NARROW_TYPED_INTENTS
CONTROLLER_LOCAL_STATE=SOLE_AUTHORITY
```

## Required workflow

For product work use separate roles and independent contexts:

1. `architect` — read/plan only.
2. `builder` — edits only inside its assigned worktree and task scope.
3. `reviewer` — independent read-only code review.
4. `visual-reviewer` — independent read-only review of actual screenshots for UI work.

The supervisor, not model prose, materializes commits, evaluates allowed-write scope, runs mechanical gates, creates PRs and optionally executes guarded publication.

## Hard rules

- Never use force push, `git reset`, `git rebase`, commit amend, ref rewriting or history-repair shortcuts.
- Never read or expose `.env*`, credential stores, SSH keys or Claude credentials.
- Never directly mutate `Nortropic/nortropic-system` state, refs, attestations, lease/fencing or promotion state.
- Never use `GITHUB_TOKEN_WRITE` or any generic GitHub write credential from product code under `app/api/loop/**` or `lib/loop/**`.
- Never infer authoritative state from terminal prose, `AUTOBYGG-LOG.md`, timestamps, animations, percentages or a client-side event fold.
- `SNAPSHOT_WINS`; event streams are activity/evidence, not authority.
- Unknown or unavailable backend data renders as `—`, not invented data.
- Product agents must not edit this file, `.claude/**`, `docs/claude-operating-model-v1.md`, or the authoritative control-room plan.

## Build availability

V1–V3 from the control-room plan may be built before the corresponding live backend exists, but a fixture-backed slice must never be described as live-complete. V4+ backend prerequisites must be proven before a live integration slice is called complete.
