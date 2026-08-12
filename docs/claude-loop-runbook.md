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
```

`claude:live-smoke` and `claude:empirical-smoke` consume Claude usage. The empirical smoke uses a disposable Git repository/local bare origin and runs architect → builder → mechanical gate → immutable candidate → independent reviewer without publishing. `doctor`, `selftest` and `status` do not invoke a model.

## Task format

Start from `.claude-loop.example-task.json`. A task defines exact allowed-write patterns, mechanical gates and whether visual review is required. Gates and preview commands are argv arrays, never shell strings. UI tasks with visual review must provide a preview argv and URL.

## Publication

`.claude-loop.example.json` documents publication switches. Both `publish.enabled` and `publish.autoMerge` default to `false`. Enabling them is an explicit operator choice after the first empirical run.

## Recovery

A blocked run preserves its Git worktree and run state. Re-run:

```bash
npm run claude:resume -- <run-id>
```

Do not reset/rebase/amend a blocked worktree. The supervisor resumes from recorded facts and existing immutable candidate commits. Terminal builder errors preserve the recoverable builder session ID in run state. A remediation-budget block does NOT gain another model round by repeated `resume`; it requires an explicit owner extension:

```bash
npx tsx scripts/claude-loop/cli.ts extend-remediation <run-id> 1
```

An extension is runtime workflow state, not publication or trust authority. Keep it bounded and owner-reviewed.

## Visual review

For UI tasks, the supervisor starts `visual.previewCommand`, waits for `visual.previewUrl`, captures configured viewports with Playwright, and asks the independent `visual-reviewer` to inspect those PNGs. Browser screenshots are evidence for workflow review, not Nortropic trust authority.

## Pre-publication runtime checks

After dependency/security changes, run the production build and `npx tsx scripts/claude-loop/auth-runtime-smoke.ts`. The auth smoke starts the built app with disposable credentials, proves anonymous redirect, failed credentials, a real successful Credentials session, middleware-authorized navigation and session reload. Build warnings are not treated as runtime PASS by themselves.
