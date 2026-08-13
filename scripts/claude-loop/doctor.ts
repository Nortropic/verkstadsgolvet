import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, git, sh } from './util';
import { loadConfig } from './supervisor';
import { CANONICAL_BACKLOG_FILE, evaluateBacklog, loadBacklog, loadExternalEvidence } from './backlog';
import { ledgerCompletedIds, ledgerOccupiedIds, loadLedger } from './ledger';
import { OWNER_AUTHOR_SETTINGS_FILE, OWNER_AUTHOR_SYSTEM_PROMPT_FILE, laneQueryOptions } from './lanes';

export function doctor(): void {
  const repo = repoRoot();
  const required = [
    'CLAUDE.md','.claude/settings.json','.claude/agents/architect.md','.claude/agents/builder.md','.claude/agents/reviewer.md','.claude/agents/visual-reviewer.md',
    'docs/nortropic-control-room-plan-v1.md','docs/claude-operating-model-v1.md',
    CANONICAL_BACKLOG_FILE, OWNER_AUTHOR_SETTINGS_FILE, OWNER_AUTHOR_SYSTEM_PROMPT_FILE,
  ];
  const missing = required.filter((f) => !fs.existsSync(path.join(repo, f)));
  if (missing.length) throw new Error(`missing Claude Factory files: ${missing.join(', ')}`);
  const config = loadConfig(repo);

  // The canonical backlog must parse and be structurally sound (unique ids, resolvable
  // dependencies, no cycles, honest fixture slices) before any scheduling is attempted.
  const backlog = loadBacklog(repo);
  const ledger = loadLedger(repo);
  const evaluations = evaluateBacklog(backlog, {
    fileExists: (relativePath) => fs.existsSync(path.join(repo, relativePath)),
    // Doctor never spends minutes running product test suites: local_test prerequisites are
    // reported as not evaluated here, which keeps their slices honestly WAITING in this view.
    runCommand: null,
    externalEvidence: loadExternalEvidence(repo),
    ledgerCompleted: ledgerCompletedIds(ledger),
    ledgerOccupied: ledgerOccupiedIds(ledger),
    ownerAuthorSelection: { selectedTaskIds: config.ownerAuthor.selectedTaskIds },
  });

  // Lane isolation must be constructible: settings file present, system prompt present and marked.
  const ordinaryLane = laneQueryOptions({ lane: 'ordinary', root: repo });
  const ownerLane = laneQueryOptions({ lane: 'owner-author', root: repo });
  if (ownerLane.settingSources.length !== 0) throw new Error('owner-author lane must load no setting sources');

  const claude = sh('claude', ['--version'], repo, true);
  if (claude.code !== 0) throw new Error(`claude unavailable: ${claude.out}`);
  const main = git(repo, 'rev-parse', 'refs/remotes/origin/main');
  console.log('CLAUDE_FACTORY_DOCTOR=PASS');
  console.log(`REPOSITORY=Nortropic/verkstadsgolvet`);
  console.log(`ORIGIN_MAIN=${main}`);
  console.log(`CLAUDE=${claude.out.trim()}`);
  console.log('ROLE_SEPARATION=WORKFLOW_NOT_TRUST_BOUNDARY');
  console.log('PUBLICATION_DEFAULT=DISABLED');
  console.log(`BACKLOG=${CANONICAL_BACKLOG_FILE} items=${backlog.items.length}`);
  console.log(`BACKLOG_DONE=${evaluations.filter((e) => e.status === 'DONE').map((e) => e.id).join(',') || '—'}`);
  console.log(`BACKLOG_READY=${evaluations.filter((e) => e.status === 'READY').map((e) => e.id).join(',') || '—'}`);
  console.log(`BACKLOG_WAITING=${evaluations.filter((e) => e.status === 'WAITING').map((e) => e.id).join(',') || '—'}`);
  console.log(`BACKLOG_BLOCKED=${evaluations.filter((e) => e.status === 'BLOCKED').map((e) => e.id).join(',') || '—'}`);
  console.log('BACKLOG_NOTE=doctor does not execute local_test prerequisites; run npm run claude:backlog for the executed evaluation');
  console.log(`AUTOPILOT_ENABLED=${config.autopilot.enabled}`);
  console.log(`ORDINARY_SETTING_SOURCES=${JSON.stringify(ordinaryLane.settingSources)}`);
  console.log(`OWNER_AUTHOR_SETTING_SOURCES=${JSON.stringify(ownerLane.settingSources)}`);
  console.log(`OWNER_AUTHOR_SELECTED=${config.ownerAuthor.selectedTaskIds.join(',') || '—'}`);
  console.log('OWNER_AUTHOR_LANE=WORKFLOW_AUTHORITY_ONLY');
  console.log('NORTROPIC_TRUST_AUTHORITY=NO');
}
