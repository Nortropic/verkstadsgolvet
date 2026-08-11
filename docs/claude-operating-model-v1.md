# Claude Operating Model v1 — Verkstadsgolvet

**Owner workflow contract.** This document governs Claude-powered development of `Nortropic/verkstadsgolvet`. It is not Nortropic Trust Kernel authority.

## Locked model

```text
CLAUDE_ROLE_SEPARATION=WORKFLOW
CLAUDE_ROLE_SEPARATION_IS_SECURITY_BOUNDARY=NO
CLAUDE_NATIVE_SESSION_CONTEXT_TOOLS=YES
CLAUDE_NATIVE_WORKTREE_ISOLATION=YES
CLAUDE_NATIVE_SUBAGENTS=YES
CLAUDE_AGENT_SDK_SUPERVISOR=YES
CLAUDE_STRUCTURED_OUTPUT=YES
CLAUDE_SESSION_RESUME=YES
CLAUDE_BOUNDED_REMEDIATION=YES
CLAUDE_VISUAL_REVIEW=YES
CLAUDE_TELEMETRY=YES

ARCHITECT_WRITE_AUTHORITY=NO
BUILDER_PRODUCT_WRITE_AUTHORITY=ASSIGNED_WORKTREE_ONLY
REVIEWER_PRODUCT_WRITE_AUTHORITY=NO
VISUAL_REVIEWER_PRODUCT_WRITE_AUTHORITY=NO
BUILDER_SELF_REVIEW_IS_FINAL=NO
MODEL_READY_IS_TRUST_VERDICT=NO

NORTROPIC_TRUST_AUTHORITY=NO
DIRECT_NORTROPIC_STATE_MUTATION=NO
DIRECT_NORTROPIC_PROMOTION=NO
PUBLICATION_CAPABILITY=BUILT_BUT_DEFAULT_DISABLED
NO_FORCE_SEMANTICS=YES
```

## Responsibility split

Claude Code / Agent SDK owns model sessions, context, reasoning, tool loops, structured role output and provider-internal retries. The local Claude Factory supervisor owns workflow bookkeeping: task input, role ordering, bounded cross-role remediation, Git worktree lifecycle, changed-file policy, candidate commit identity, mechanical gates, screenshots, PR identity and optional guarded publication.

Neither layer becomes Nortropic's trust authority. When `/loop` later reads or commands Nortropic, controller-published snapshots and typed controller intents remain the sole authority path defined by `docs/nortropic-control-room-plan-v1.md`.

## Role protocol

### Architect
Read-only. Produce a concrete implementation plan, risks, files expected to change and test plan. It cannot edit product files or publish anything.

### Builder
Works in the task worktree. It may read, edit and run local build/test commands. It does not push, merge, amend, reset, rebase, deploy or declare its work authoritative. The supervisor derives changed files and candidate SHA from Git.

### Reviewer
Independent fresh context. Read-only. Reviews the candidate and returns structured findings. Any blocker/major/minor finding or explicit `NEEDS_REMEDIATION` routes back to the builder session for remediation and then receives a fresh review. `note` findings are advisory only and remain recorded in final run evidence.

### Visual reviewer
Independent fresh context. Read-only. Reviews actual screenshots at configured desktop/tablet/mobile viewports. Findings route back to the builder and trigger recapture plus fresh visual review.

## Retry model

1. Provider-internal turns are Claude's concern.
2. Reviewer/visual findings resume the same builder session when available.
3. Supervisor cross-attempt remediation is bounded by config.
4. Authentication/quota/provider failures become BLOCKED and preserve worktree/state. They never become product PASS.

## Candidate and publication

The supervisor commits only after allowed-write and mechanical gates pass. Each remediation creates a new immutable commit; no amend/rebase/reset repair is allowed.

Publication support exists in v1 but defaults off. When enabled, push is ordinary non-force push, PR base/head are checked, and auto-merge (if separately enabled) uses expected-head guarded rebase merge. A changed base blocks publication rather than silently rewriting history.

## Telemetry

Workflow telemetry is append-only JSONL under the Git common directory and may later be projected into Verkstadsgolvet. It is observability only. Events include role starts/completions, session IDs, attempts, candidate SHA, full independent finding/advisory evidence, gate outcomes, PR creation, publication, blocks and run completion.

## Empirical rule

Keep all capabilities initially. Remove or thin a mechanism only after real runs show it duplicates provider-native behavior or adds no useful signal. The removal decision is empirical, not speculative.
