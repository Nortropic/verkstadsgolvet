import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const hook = path.resolve('.claude/hooks/pre-tool-guard.mjs');
function call(payload: unknown) { return spawnSync('node',[hook],{input:JSON.stringify({cwd:process.cwd(), ...payload as any}),encoding:'utf8'}); }

test('hook blocks git push', () => {
  const r=call({tool_name:'Bash',tool_input:{command:'git push origin x'}}); assert.equal(r.status,2); assert.match(r.stderr,/GUARD_BLOCK/);
});
test('hook allows local build', () => {
  const r=call({tool_name:'Bash',tool_input:{command:'npm run build'}}); assert.equal(r.status,0);
});
test('hook blocks protected relative edits', () => {
  const r=call({tool_name:'Edit',tool_input:{file_path:'CLAUDE.md'}}); assert.equal(r.status,2);
});
test('hook blocks writes outside assigned cwd', () => {
  const r=call({tool_name:'Write',tool_input:{file_path:'../escape.txt'}}); assert.equal(r.status,2);
});
