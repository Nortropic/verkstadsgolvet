import test from 'node:test';
import assert from 'node:assert/strict';
import { TaskSchema, RoleResultSchema } from '../../scripts/claude-loop/schemas';

test('task requires explicit allowed-write and gates', () => {
  assert.equal(TaskSchema.safeParse({id:'V1',title:'x',description:'x',allowedWrite:['lib/loop/**'],gates:[['npm','run','build']]}).success, true);
  assert.equal(TaskSchema.safeParse({id:'V1',title:'x',description:'x',allowedWrite:[],gates:[]}).success, false);
});

test('role output is structured', () => {
  const x = RoleResultSchema.parse({outcome:'READY',summary:'ok',findings:[],tests:[],changed_files:[],next_action:'DONE'});
  assert.equal(x.outcome, 'READY');
});
