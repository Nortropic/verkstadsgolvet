import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function hook(command: string) {
  const p=spawnSync('node',['.claude/hooks/pre-tool-guard.mjs'],{input:JSON.stringify({tool_name:'Bash',tool_input:{command},cwd:process.cwd()}),encoding:'utf8'});
  return {code:p.status,out:`${p.stdout||''}${p.stderr||''}`};
}

test('sandbox declares project secret files and sensitive env vars as denied', () => {
  const s=JSON.parse(fs.readFileSync('.claude/settings.json','utf8'));
  assert.ok(s.sandbox.filesystem.denyRead.includes('./.env'));
  assert.ok(s.sandbox.filesystem.denyRead.includes('./.env.*'));
  assert.ok(s.sandbox.credentials.files.some((x:any)=>x.path==='./.env'&&x.mode==='deny'));
  const names=new Set(s.sandbox.credentials.envVars.map((x:any)=>x.name));
  for(const name of ['AUTH_SECRET','AUTH_PASSWORD','GITHUB_TOKEN','GH_TOKEN','GITHUB_TOKEN_WRITE','SUPABASE_SERVICE_KEY','N8N_WEBHOOK_SECRET','PLACES_API_KEY']) assert.ok(names.has(name),name);
});

test('Bash guard blocks direct and interpreter-mediated secret references', () => {
  assert.notEqual(hook('cat .env').code,0);
  assert.notEqual(hook('git status; cat .env.local').code,0);
  assert.notEqual(hook('node -e "console.log(process.env.AUTH_SECRET)"').code,0);
  assert.equal(hook('git status --short').code,0);
});
