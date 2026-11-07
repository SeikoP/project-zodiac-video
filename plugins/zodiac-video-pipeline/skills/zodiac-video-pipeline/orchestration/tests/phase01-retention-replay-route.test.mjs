import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Phase 01 commit replays the retention validator with workspace-root argument',async()=>{
  const script=await readFile(new URL('../../phases/phase01/commit-phase01-step.mjs',import.meta.url),'utf8');
  const start=script.indexOf('const workspaceValidators=new Set(');
  assert.ok(start>=0,'workspace-validator allowlist must exist');
  const end=script.indexOf(']);',start);
  assert.ok(end>start);
  const names=script.slice(start,end);
  assert.ok(names.includes("'features/retention/retention-structure.mjs'"),
    'Retention Structure requires <workspace> --write, not a nested artifact path');
});
