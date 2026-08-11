import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gitRun, sh } from './util';
import { startRun } from './supervisor';

function copyTree(src: string, dst: string): void {
  fs.cpSync(src, dst, { recursive: true });
}

export async function empiricalSmoke(): Promise<void> {
  const sourceRepo = sh('git', ['rev-parse', '--show-toplevel'], process.cwd()).out.trim();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-factory-empirical-'));
  const repo = path.join(root, 'repo');
  const bare = path.join(root, 'origin.git');
  const taskPath = path.join(root, 'task.json');
  fs.mkdirSync(repo, { recursive: true });
  let taskWorktree: string | null = null;
  const oldCwd = process.cwd();
  try {
    copyTree(path.join(sourceRepo, '.claude'), path.join(repo, '.claude'));
    copyTree(path.join(sourceRepo, 'CLAUDE.md'), path.join(repo, 'CLAUDE.md'));
    fs.mkdirSync(path.join(repo, 'docs'), { recursive: true });
    copyTree(path.join(sourceRepo, 'docs', 'nortropic-control-room-plan-v1.md'), path.join(repo, 'docs', 'nortropic-control-room-plan-v1.md'));
    copyTree(path.join(sourceRepo, 'docs', 'claude-operating-model-v1.md'), path.join(repo, 'docs', 'claude-operating-model-v1.md'));
    copyTree(path.join(sourceRepo, '.claude-loop.example.json'), path.join(repo, '.claude-loop.example.json'));
    fs.writeFileSync(path.join(repo, '.gitignore'), '.claude-loop/\n.claude/worktrees/\n', 'utf8');
    fs.writeFileSync(path.join(repo, 'README.md'), '# Disposable Claude Factory empirical fixture\n', 'utf8');

    gitRun(repo, ['init', '-b', 'main']);
    gitRun(repo, ['add', '--all']);
    gitRun(repo, ['-c', 'user.name=Claude Factory Smoke', '-c', 'user.email=smoke@nortropic.local', 'commit', '-m', 'fixture base']);
    gitRun(root, ['init', '--bare', bare]);
    gitRun(repo, ['remote', 'add', 'origin', bare]);
    gitRun(repo, ['push', '-u', 'origin', 'main']);

    const task = {
      id: 'EMPIRICAL-SMOKE',
      title: 'Claude Factory disposable end-to-end smoke',
      description: 'Create exactly fixture-output.txt containing the single line CLAUDE_FACTORY_EMPIRICAL_OK. Do not modify any other tracked product file.',
      allowedWrite: ['fixture-output.txt'],
      deniedWrite: ['.claude/**', 'CLAUDE.md', 'docs/**'],
      gates: [[process.execPath, '-e', "const fs=require('fs'); const v=fs.readFileSync('fixture-output.txt','utf8'); if(v!=='CLAUDE_FACTORY_EMPIRICAL_OK\\n') process.exit(1)"]],
      visualReview: false,
    };
    fs.writeFileSync(taskPath, JSON.stringify(task, null, 2) + '\n', 'utf8');
    process.chdir(repo);
    const state = await startRun(taskPath);
    taskWorktree = state.worktree;
    if (state.phase !== 'DONE' || !state.candidateSha) throw new Error(`empirical run not DONE: phase=${state.phase}`);
    if (state.findings.length) throw new Error(`empirical run retained actionable findings: ${JSON.stringify(state.findings)}`);
    const value = fs.readFileSync(path.join(state.worktree, 'fixture-output.txt'), 'utf8');
    if (value !== 'CLAUDE_FACTORY_EMPIRICAL_OK\n') throw new Error('empirical candidate content mismatch');
    const files = sh('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', state.candidateSha], state.worktree).out.trim().split('\n').filter(Boolean);
    if (JSON.stringify(files) !== JSON.stringify(['fixture-output.txt'])) throw new Error(`empirical candidate scope mismatch: ${files.join(',')}`);
    console.log('CLAUDE_FACTORY_EMPIRICAL_SMOKE=PASS');
    console.log(`RUN_ID=${state.runId}`);
    console.log(`CANDIDATE=${state.candidateSha}`);
    console.log(`ARCHITECT_SESSION=${state.sessions.architect}`);
    console.log(`BUILDER_SESSION=${state.sessions.builder}`);
    console.log(`REVIEWER_SESSION=${state.sessions.reviewer}`);
    console.log(`ADVISORY_FINDINGS=${JSON.stringify(state.advisoryFindings)}`);
  } finally {
    process.chdir(oldCwd);
    if (taskWorktree && fs.existsSync(repo)) gitRun(repo, ['worktree', 'remove', taskWorktree], true);
    fs.rmSync(root, { recursive: true, force: true });
  }
}
