import fs from 'node:fs';
import path from 'node:path';
import { repoRoot, git, sh } from './util';
import { loadConfig } from './supervisor';

export function doctor(): void {
  const repo = repoRoot();
  const required = ['CLAUDE.md','.claude/settings.json','.claude/agents/architect.md','.claude/agents/builder.md','.claude/agents/reviewer.md','.claude/agents/visual-reviewer.md','docs/nortropic-control-room-plan-v1.md','docs/claude-operating-model-v1.md'];
  const missing = required.filter((f) => !fs.existsSync(path.join(repo, f)));
  if (missing.length) throw new Error(`missing Claude Factory files: ${missing.join(', ')}`);
  loadConfig(repo);
  const claude = sh('claude', ['--version'], repo, true);
  if (claude.code !== 0) throw new Error(`claude unavailable: ${claude.out}`);
  const main = git(repo, 'rev-parse', 'refs/remotes/origin/main');
  console.log('CLAUDE_FACTORY_DOCTOR=PASS');
  console.log(`REPOSITORY=Nortropic/verkstadsgolvet`);
  console.log(`ORIGIN_MAIN=${main}`);
  console.log(`CLAUDE=${claude.out.trim()}`);
  console.log('ROLE_SEPARATION=WORKFLOW_NOT_TRUST_BOUNDARY');
  console.log('PUBLICATION_DEFAULT=DISABLED');
}
