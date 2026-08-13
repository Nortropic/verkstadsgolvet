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
