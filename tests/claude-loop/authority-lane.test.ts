import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthorityEscalationError,
  OWNER_AUTHOR_SELF_CLAIM_CODE,
  assertOwnerAuthorPublicationGuard,
  laneForAuthorityClass,
  resolveAuthorityClass,
  type AuthorityClass,
} from '../../scripts/claude-loop/authority';
import {
  OWNER_AUTHOR_SETTINGS_FILE,
  OWNER_AUTHOR_SETTING_SOURCES,
  OWNER_AUTHOR_SYSTEM_PROMPT_FILE,
  OWNER_AUTHOR_SYSTEM_PROMPT_MARKER,
  ORDINARY_SETTING_SOURCES,
  laneQueryOptions,
  ownerAuthorSystemPrompt,
} from '../../scripts/claude-loop/lanes';
import {
  NEVER_WRITABLE_PATHS,
  PROTECTED_AUTHORITY_PATHS,
  WORKTREE_FORBIDDEN_FILES,
  WORKTREE_FORBIDDEN_FILE_BLOCK_PREFIX,
  assertDeclaredScope,
  assertNoForbiddenWorktreeFiles,
  findForbiddenWorktreeFiles,
  unsafeRepoPath,
  validateExactScope,
} from '../../scripts/claude-loop/scope';
import { commonGitDir, mainCheckout } from '../../scripts/claude-loop/util';
import { ConfigSchema, TaskSchema } from '../../scripts/claude-loop/schemas';
import { laneForRole, roleDefinition, WRITE_ROLES } from '../../scripts/claude-loop/claude';
import { supervisorAuthoritySelection } from '../../scripts/claude-loop/supervisor';

/** Predicate for `assert.throws`: any real Error passes; the point is that it fails closed. */
const isError = (e: unknown): e is Error => e instanceof Error;

const repo = process.cwd();
const shipped = ConfigSchema.parse(JSON.parse(fs.readFileSync('.claude-loop.example.json', 'utf8')));

/* ---------------------------------------------------------------- lane isolation */

test('the owner-author lane loads NO settings sources and runs under its own settings and prompt', () => {
  const owner = laneQueryOptions({ lane: 'owner-author', root: repo });

  assert.equal(owner.settingSources.length, 0, 'settingSources must be exactly the empty list');
  assert.equal(owner.settingSources.includes('project'), false, 'the lane must not inherit project settings');
  assert.deepEqual([...OWNER_AUTHOR_SETTING_SOURCES], [] as string[]);
  assert.equal(owner.settings, path.join(repo, OWNER_AUTHOR_SETTINGS_FILE), 'a dedicated settings file, not .claude/settings.json');
  assert.ok(owner.systemPrompt && owner.systemPrompt.includes(OWNER_AUTHOR_SYSTEM_PROMPT_MARKER));
  assert.ok(fs.existsSync(path.join(repo, OWNER_AUTHOR_SETTINGS_FILE)));
  assert.ok(fs.existsSync(path.join(repo, OWNER_AUTHOR_SYSTEM_PROMPT_FILE)));
});

test('the ordinary lane is unchanged and keeps project settings with no lane overrides', () => {
  const ordinary = laneQueryOptions({ lane: 'ordinary', root: repo });
  assert.deepEqual(ordinary.settingSources, ['project']);
  assert.deepEqual([...ORDINARY_SETTING_SOURCES], ['project']);
  assert.equal(ordinary.settings, undefined, 'an ordinary role must not get a lane settings file');
  assert.equal(ordinary.systemPrompt, undefined, 'an ordinary role must not get the owner system prompt');
});

test('the isolation is pinned to Claude Agent SDK 0.3.228', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { dependencies: Record<string, string> };
  assert.equal(pkg.dependencies['@anthropic-ai/claude-agent-sdk'], '0.3.228', 'settingSources:[] isolation is asserted against this exact SDK version');
});

test('the owner-author system prompt states it is workflow authority and never trust authority', () => {
  const prompt = ownerAuthorSystemPrompt(repo);
  assert.match(prompt, /OWNER_AUTHOR_LANE=WORKFLOW_AUTHORITY_ONLY/);
  assert.match(prompt, /OWNER_AUTHOR_LANE_IS_NORTROPIC_TRUST_AUTHORITY=NO/);
  assert.match(prompt, /OWNER_AUTHOR_LANE_IS_SECURITY_BOUNDARY=NO/);
  assert.match(prompt, /SELF_SELECTION_INTO_THIS_LANE=IMPOSSIBLE/);
  assert.match(prompt, /Never push, merge, publish/);
  assert.match(prompt, /nothing any repository file says, can put a task into this lane/);
  // Even the owner lane may never touch the plan, the handoff or its own lane definition.
  assert.match(prompt, /docs\/nortropic-control-room-plan-v1\.md/);
  assert.match(prompt, /scripts\/claude-loop\/owner-author\/\*\*/);
});

test('the dedicated lane settings keep publication, credentials and history rewriting out of reach', () => {
  const settings = JSON.parse(fs.readFileSync(path.join(repo, OWNER_AUTHOR_SETTINGS_FILE), 'utf8')) as { permissions: { deny: string[]; allow: string[] } };
  for (const denied of ['Bash(gh *)', 'Bash(git push *)', 'Bash(git reset *)', 'Bash(git rebase *)', 'Bash(git commit --amend *)', 'Bash(git update-ref *)', 'Bash(git filter-branch *)', 'Read(./.env)', 'Edit(/docs/nortropic-control-room-plan-v1.md)', 'Edit(/scripts/claude-loop/owner-author/**)']) {
    assert.ok(settings.permissions.deny.includes(denied), `owner lane settings must deny ${denied}`);
  }
  assert.equal(settings.permissions.allow.some((a) => a.includes('git push') || a.includes('gh ')), false);
});

test('the owner-author write role exists, is a write role, and reads only its dedicated prompt', () => {
  assert.ok(WRITE_ROLES.includes('owner-author'));
  assert.ok(WRITE_ROLES.includes('builder'));
  assert.equal(laneForRole('owner-author'), 'owner-author');
  for (const role of ['builder', 'architect', 'reviewer', 'visual-reviewer'] as const) {
    assert.equal(laneForRole(role), 'ordinary', `${role} must stay in the ordinary lane`);
  }
  const owner = roleDefinition(repo, 'owner-author');
  assert.ok(owner.prompt.includes(OWNER_AUTHOR_SYSTEM_PROMPT_MARKER), 'the role body is the dedicated lane prompt, not .claude/agents');
  assert.equal(owner.permissionMode, 'acceptEdits');
  assert.ok(owner.tools?.includes('StructuredOutput'));
  for (const readOnly of ['architect', 'reviewer', 'visual-reviewer'] as const) {
    assert.equal(roleDefinition(repo, readOnly).tools?.includes('Edit'), false);
  }
});

/* ------------------------------------------------- model self-claim escalation */

test('a task that declares owner-author without supervisor selection fails closed', () => {
  const attempt = () => resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: { selectedTaskIds: [] }, source: 'tracked backlog' });
  assert.throws(attempt, AuthorityEscalationError);
  assert.throws(attempt, new RegExp(OWNER_AUTHOR_SELF_CLAIM_CODE));
  assert.throws(attempt, /tracked backlog/);
  assert.throws(attempt, /never through repository, task or model data/);
});

test('the escalation guard fires for every model-reachable declaration source', () => {
  for (const source of ['tracked backlog', 'task file V4.json', 'model output', 'chat context']) {
    assert.throws(
      () => resolveAuthorityClass({ taskId: 'V4', declared: 'owner-author', selection: { selectedTaskIds: ['SOMETHING-ELSE'] }, source }),
      (e: unknown) => e instanceof AuthorityEscalationError && e.code === OWNER_AUTHOR_SELF_CLAIM_CODE && e.taskId === 'V4',
      `a declaration from ${source} must not escalate`,
    );
  }
});

test('selection, and only selection, grants the owner lane', () => {
  assert.equal(resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: { selectedTaskIds: ['OM1'] } }), 'owner-author');
  assert.equal(resolveAuthorityClass({ taskId: 'OM1', declared: null, selection: { selectedTaskIds: ['OM1'] } }), 'owner-author', 'the operator decides, not the file');
  assert.equal(resolveAuthorityClass({ taskId: 'OM1', declared: 'ordinary', selection: { selectedTaskIds: ['OM1'] } }), 'owner-author', 'a file cannot decline a real selection either');
  assert.equal(resolveAuthorityClass({ taskId: 'V4', declared: 'ordinary', selection: { selectedTaskIds: ['OM1'] } }), 'ordinary');
  assert.equal(resolveAuthorityClass({ taskId: 'V4', declared: undefined, selection: { selectedTaskIds: [] } }), 'ordinary');
  // Selection is per exact task id: a near-miss id grants nothing.
  assert.throws(() => resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: { selectedTaskIds: ['OM'] } }), AuthorityEscalationError);
  assert.throws(() => resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: { selectedTaskIds: ['om1'] } }), AuthorityEscalationError);
});

test('the supervisor selection is built only from operator-controlled inputs', () => {
  assert.deepEqual(shipped.ownerAuthor.selectedTaskIds, [], 'the shipped config selects nothing');
  assert.deepEqual(supervisorAuthoritySelection(shipped).selectedTaskIds, []);
  assert.deepEqual(supervisorAuthoritySelection(shipped, ['OM1']).selectedTaskIds, ['OM1'], 'the CLI flag is an operator act');
  const local = ConfigSchema.parse({ ...shipped, ownerAuthor: { selectedTaskIds: ['OM1'] } });
  assert.deepEqual(supervisorAuthoritySelection(local, ['OM1']).selectedTaskIds, ['OM1'], 'duplicate selections collapse');
  assert.deepEqual(supervisorAuthoritySelection(local, ['OTHER']).selectedTaskIds, ['OM1', 'OTHER']);
});

test('a task file may declare the class, but the declaration is data and not authority', () => {
  const declared = TaskSchema.parse({
    id: 'V4', title: 'x', description: 'y',
    allowedWrite: ['lib/loop/**'], gates: [['npx', 'tsc', '--noEmit']],
    authorityClass: 'owner-author',
  });
  assert.equal(declared.authorityClass, 'owner-author', 'the declaration is preserved so the escalation attempt stays visible');
  assert.throws(() => resolveAuthorityClass({ taskId: declared.id, declared: declared.authorityClass, selection: { selectedTaskIds: [] } }), AuthorityEscalationError);
  const defaulted = TaskSchema.parse({ id: 'V4', title: 'x', description: 'y', allowedWrite: ['lib/loop/**'], gates: [['npx', 'tsc', '--noEmit']] });
  assert.equal(defaulted.authorityClass, 'ordinary', 'the default is always the ordinary lane');
  assert.throws(() => TaskSchema.parse({ ...defaulted, authorityClass: 'root' }), isError, 'an invented class is not a class');
});

test('resuming a persisted owner-author run without a selection is refused as self-claim', () => {
  // Run state lives under the Git common directory, outside every worktree, so a mutated
  // authorityClass there is structurally invisible to changed-file validation. The resume path
  // therefore re-applies the same guard as a fresh run instead of trusting the persisted field.
  const persisted = { taskId: 'OM1', declared: 'owner-author' as const };
  const attempt = (selected: string[]) => resolveAuthorityClass({
    taskId: persisted.taskId,
    declared: persisted.declared,
    selection: supervisorAuthoritySelection(shipped, selected),
    source: `persisted run state om1-20260813103000`,
  });

  assert.throws(() => attempt([]), AuthorityEscalationError, 'a resume with no selection must fail closed');
  assert.throws(() => attempt([]), /persisted run state om1-20260813103000/, 'the refusal names the data source it refused');
  assert.throws(() => attempt(['V4']), AuthorityEscalationError, 'a selection for another task grants nothing');
  assert.equal(attempt(['OM1']), 'owner-author', 'an explicit selection in THIS invocation is the only way in');
});

test('the production resume path re-resolves the class and can express a selection', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /export async function resumeRun\(runId: string, cliOwnerAuthorTaskIds: readonly string\[\] = \[\]\)/, 'resume must accept an operator selection');
  assert.match(src, /state\.authorityClass = resolveAuthorityClass\(\{/, 'the persisted class must be re-resolved, not trusted');
  assert.match(src, /source: `persisted run state \$\{runId\}`/);
  assert.match(src, /selection: supervisorAuthoritySelection\(config, cliOwnerAuthorTaskIds\)/);
  // The guard must run before the run claim and before any Claude segment.
  assert.ok(src.indexOf('state.authorityClass = resolveAuthorityClass({') < src.indexOf("acquireClaim({ repo, scope: 'run'"), 'the class is resolved before the run is claimed');

  const cli = fs.readFileSync('scripts/claude-loop/cli.ts', 'utf8');
  assert.match(cli, /resumeRun\(id, collectFlag\(args, '--owner-author'\)\)/, 'the CLI must be able to express the selection on resume');
  assert.match(cli, /resume <run-id> \[--owner-author <taskId>\]/, 'the usage string must document it');
});

test('the git-ignored operator config can never decide the lane from inside a worktree', () => {
  // It is git-ignored, so a changed-file set structurally cannot contain it...
  assert.ok(fs.readFileSync('.gitignore', 'utf8').includes('/.claude-loop.json'));
  assert.deepEqual(validateExactScope({ files: [], allowedWrite: ['**'], deniedWrite: [], lane: ORDINARY }), [], 'an invisible file produces no violation from a diff alone');
  // ...so it is BOTH declared never-writable and asserted by existence.
  assert.ok(NEVER_WRITABLE_PATHS.includes('.claude-loop.json'));
  assert.ok(NEVER_WRITABLE_PATHS.includes('.claude-loop/**'));
  assert.deepEqual(validateExactScope({ files: ['.claude-loop.json'], allowedWrite: ['**'], deniedWrite: [], lane: OWNER }).map((v) => v.reason), ['never-writable']);
  assert.throws(() => assertDeclaredScope({ taskId: 'X', allowedWrite: ['.claude-loop.json'], lane: OWNER }), /never-writable allowedWrite pattern/);
  assert.deepEqual(WORKTREE_FORBIDDEN_FILES, ['.claude-loop.json']);
});

test('a .claude-loop.json left in the run worktree blocks the run', () => {
  const worktree = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-scope-worktree-'));
  try {
    assert.deepEqual(findForbiddenWorktreeFiles(worktree), [], 'a clean worktree passes');
    assert.doesNotThrow(() => assertNoForbiddenWorktreeFiles(worktree));

    fs.writeFileSync(path.join(worktree, '.claude-loop.json'), JSON.stringify({ ownerAuthor: { selectedTaskIds: ['V4'] } }), 'utf8');
    assert.deepEqual(findForbiddenWorktreeFiles(worktree), ['.claude-loop.json']);
    assert.throws(() => assertNoForbiddenWorktreeFiles(worktree), (e: unknown) => {
      const message = (e as Error).message;
      assert.ok(message.startsWith(WORKTREE_FORBIDDEN_FILE_BLOCK_PREFIX), message);
      assert.match(message, /git-ignored/);
      return true;
    });
  } finally {
    fs.rmSync(worktree, { recursive: true, force: true });
  }
});

test('the supervisor asserts the forbidden file before gates, candidate and review', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  const executeBody = src.slice(src.indexOf('async function execute('));
  assert.equal((executeBody.match(/assertNoForbiddenWorktreeFiles\(state\.worktree\)/g) ?? []).length, 2, 'checked with the post-write scope validation and again for the cumulative candidate');
  assert.ok(executeBody.indexOf('assertNoForbiddenWorktreeFiles(state.worktree)') < executeBody.indexOf('const gates = await runGates('), 'the check runs before any gate process can read a planted config');
});

test('supervisor configuration is read from the operator checkout, not from a run worktree', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /const root = mainCheckout\(repo\);/, 'loadConfig must resolve from the Git common directory');
  assert.match(src, /const local = path\.join\(root, '\.claude-loop\.json'\);\n\s*if \(fs\.existsSync\(local\)\) return ConfigSchema\.parse\(readJson\(local\)\);/, 'the operator-local override is read only from the operator checkout');
  // mainCheckout answers with the operator checkout even when asked from inside a worktree, and it
  // is derived from Git's own common-dir answer rather than from cwd.
  assert.equal(mainCheckout(repo), path.dirname(commonGitDir(repo)), 'this very worktree resolves to the main checkout');
  assert.notEqual(mainCheckout(repo), repo, 'the factory runs inside a worktree, which is exactly the case that matters');
});

test('a shipped-defaults config can never grant the owner-author lane, wherever it is read from', () => {
  // The example file is TRACKED, so a task with it in allowedWrite could otherwise set
  // ownerAuthor.selectedTaskIds and select its own lane within the very same run.
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /return \{ \.\.\.shipped, ownerAuthor: \{ selectedTaskIds: \[\] \} \};/, 'shipped defaults are documentation, never an authority grant');

  const tampered = ConfigSchema.parse({ ...shipped, ownerAuthor: { selectedTaskIds: ['OM1'] } });
  const asShippedDefaults: typeof tampered = { ...tampered, ownerAuthor: { selectedTaskIds: [] } };
  assert.deepEqual(supervisorAuthoritySelection(asShippedDefaults).selectedTaskIds, [], 'the stripped selection grants nothing');
  assert.throws(
    () => resolveAuthorityClass({ taskId: 'OM1', declared: 'owner-author', selection: supervisorAuthoritySelection(asShippedDefaults), source: 'tracked .claude-loop.example.json' }),
    AuthorityEscalationError,
    'an example file edited inside a candidate cannot select its own lane',
  );
  assert.deepEqual(shipped.ownerAuthor.selectedTaskIds, [], 'and the shipped file itself selects nothing');
});

test('an owner-author run may never be armed for auto-merge', () => {
  assert.throws(() => assertOwnerAuthorPublicationGuard({ authorityClass: 'owner-author', autoMerge: true }), /may never auto-merge/);
  assert.doesNotThrow(() => assertOwnerAuthorPublicationGuard({ authorityClass: 'owner-author', autoMerge: false }));
  assert.doesNotThrow(() => assertOwnerAuthorPublicationGuard({ authorityClass: 'ordinary', autoMerge: true }));
  assert.equal(shipped.publish.autoMerge, false);
  assert.equal(shipped.publish.enabled, false);
});

/* ------------------------------------------------ owner / ordinary scope separation */

const ORDINARY = laneForAuthorityClass('ordinary');
const OWNER = laneForAuthorityClass('owner-author');

test('an ordinary run can never write a workflow-authority path, whatever its task file says', () => {
  for (const file of ['CLAUDE.md', '.claude/settings.json', '.claude/agents/builder.md', 'docs/claude-operating-model-v1.md']) {
    // Even with the path explicitly allowed by the task, the ordinary lane refuses it.
    const violations = validateExactScope({ files: [file], allowedWrite: [file, '**'], deniedWrite: [], lane: ORDINARY });
    assert.equal(violations.length, 1, `${file} must be refused for an ordinary run`);
    assert.equal(violations[0].reason, 'protected-authority');
    assert.match(violations[0].detail, /supervisor-selected owner-author/);
  }
  // And it cannot even declare it: the run stops before a model starts.
  assert.throws(() => assertDeclaredScope({ taskId: 'V4', allowedWrite: ['CLAUDE.md'], lane: ORDINARY }), /workflow-authority allowedWrite pattern/);
  assert.throws(() => assertDeclaredScope({ taskId: 'V4', allowedWrite: ['.claude/**'], lane: ORDINARY }), /workflow-authority allowedWrite pattern/);
});

test('the owner-author lane may write workflow-authority paths, but only the ones its task names', () => {
  assert.deepEqual(validateExactScope({ files: ['docs/claude-operating-model-v1.md'], allowedWrite: ['docs/claude-operating-model-v1.md'], deniedWrite: [], lane: OWNER }), []);
  assert.doesNotThrow(() => assertDeclaredScope({ taskId: 'OM1', allowedWrite: ['docs/claude-operating-model-v1.md'], lane: OWNER }));

  // Not named by the task: still out of scope. The lane widens WHICH paths may be named, never the
  // requirement that the exact task names them.
  const unnamed = validateExactScope({ files: ['CLAUDE.md'], allowedWrite: ['docs/claude-operating-model-v1.md'], deniedWrite: [], lane: OWNER });
  assert.deepEqual(unnamed.map((v) => v.reason), ['outside-allowed']);
  // A task deny always wins, in both lanes.
  assert.deepEqual(validateExactScope({ files: ['CLAUDE.md'], allowedWrite: ['CLAUDE.md'], deniedWrite: ['CLAUDE.md'], lane: OWNER }).map((v) => v.reason), ['denied']);
});

test('no lane may ever write the plan, the handoff, secrets or the Git directory', () => {
  for (const file of [
    'docs/nortropic-control-room-plan-v1.md',
    'docs/nortropic-control-room-codex-handoff.md',
    '.env',
    '.env.local',
    'app/.env.production',
    '.git/config',
    '.git/refs/heads/main',
  ]) {
    for (const lane of [ORDINARY, OWNER] as const) {
      const violations = validateExactScope({ files: [file], allowedWrite: ['**'], deniedWrite: [], lane });
      assert.equal(violations.length, 1, `${file} must be refused in the ${lane} lane`);
      assert.equal(violations[0].reason, 'never-writable', `${file} in lane ${lane}`);
    }
    assert.throws(() => assertDeclaredScope({ taskId: 'X', allowedWrite: [file], lane: OWNER }), /never-writable allowedWrite pattern/);
  }
  assert.ok(NEVER_WRITABLE_PATHS.includes('docs/nortropic-control-room-plan-v1.md'));
  assert.ok(PROTECTED_AUTHORITY_PATHS.includes('CLAUDE.md'));
});

test('post-write validation measures the real changed set, including traversal and absolute paths', () => {
  const violations = validateExactScope({
    files: ['scripts/claude-loop/autopilot.ts', '../outside.ts', '/etc/passwd', 'app/page.tsx', 'tests/claude-loop/x.test.ts'],
    allowedWrite: ['scripts/claude-loop/**', 'tests/claude-loop/**'],
    deniedWrite: ['app/**'],
    lane: ORDINARY,
  });
  assert.deepEqual(violations.map((v) => `${v.file}:${v.reason}`), [
    '../outside.ts:unsafe-path',
    '/etc/passwd:unsafe-path',
    'app/page.tsx:denied',
  ]);
  assert.equal(unsafeRepoPath('scripts/claude-loop/a.ts'), null);
  assert.equal(unsafeRepoPath('~/secret'), 'home-relative path');
  assert.equal(unsafeRepoPath('C:/windows'), 'drive-qualified path');
  assert.equal(unsafeRepoPath('a/../../b'), 'parent traversal');
});

test('this very task obeys the ordinary lane it was run in', () => {
  // The FACTORY_BACKLOG_SUPERVISOR_V1 scope, asserted as data rather than as a promise.
  const allowedWrite = ['package.json', '.claude-loop.example.json', '.claude-loop.example-task.json', 'backlog/**', 'docs/claude-loop-runbook.md', 'scripts/claude-loop/**', 'tests/claude-loop/**'];
  assert.doesNotThrow(() => assertDeclaredScope({ taskId: 'FACTORY_BACKLOG_SUPERVISOR_V1'.replaceAll('_', '-'), allowedWrite, lane: ORDINARY }));
  const violations = validateExactScope({
    files: ['CLAUDE.md', '.claude/settings.json', 'docs/claude-operating-model-v1.md', 'docs/nortropic-control-room-plan-v1.md', 'app/api/loop/route.ts', 'lib/loop/schema.ts'],
    allowedWrite,
    deniedWrite: ['CLAUDE.md', '.claude/**', 'docs/claude-operating-model-v1.md', 'docs/nortropic-control-room-plan-v1.md', 'docs/nortropic-control-room-codex-handoff.md', 'app/**', 'components/**', 'lib/loop/**'],
    lane: ORDINARY,
  });
  assert.equal(violations.length, 6, 'every denied path of this task is mechanically refused');
});

test('authority class maps to exactly one lane, with no third state', () => {
  const classes: AuthorityClass[] = ['ordinary', 'owner-author'];
  assert.deepEqual(classes.map(laneForAuthorityClass), ['ordinary', 'owner-author']);
});

test('the production supervisor really resolves the class, derives the lane and validates after the writes', () => {
  const src = fs.readFileSync('scripts/claude-loop/supervisor.ts', 'utf8');
  assert.match(src, /const authorityClass = resolveAuthorityClass\(\{/, 'startRun must resolve the class through the guard');
  assert.match(src, /const lane = laneForAuthorityClass\(state\.authorityClass\)/, 'the lane comes from persisted run state, not from task data');
  assert.match(src, /const writeRole: RoleName = lane === 'owner-author' \? 'owner-author' : 'builder'/);
  assert.match(src, /runBuilderSegment: \(seg\) => runRole\(\{ role: writeRole/, 'the owner lane replaces the builder role, it does not widen it');
  assert.match(src, /const violations = validateExactScope\(\{ files, allowedWrite: state\.task\.allowedWrite, deniedWrite: state\.task\.deniedWrite, lane \}\)/);
  assert.match(src, /const candidateViolations = validateExactScope\(/, 'the cumulative candidate scope is validated too');
  assert.match(src, /assertOwnerAuthorPublicationGuard\(\{ authorityClass: state\.authorityClass/);
  assert.match(src, /assertDeclaredScope\(\{ taskId: state\.task\.id/);

  const claude = fs.readFileSync('scripts/claude-loop/claude.ts', 'utf8');
  assert.match(claude, /settingSources: lane\.settingSources/, 'the SDK query must take its setting sources from the lane');
  assert.match(claude, /if \(lane\.settings\) options\.settings = lane\.settings/);
  assert.match(claude, /if \(lane\.systemPrompt\) options\.systemPrompt = lane\.systemPrompt/);
  assert.equal(/settingSources: \['project'\]/.test(claude), false, 'the setting sources may no longer be hard-coded');
});
