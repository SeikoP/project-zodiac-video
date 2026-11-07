import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const web=new URL('../../../zodiac-video-web/SKILL.md',import.meta.url);
const local=new URL('../../../zodiac-video-local/SKILL.md',import.meta.url);

test('web entrypoint owns Phase 1 and exports handoff instead of activating Phase 2',async()=>{
 const s=await readFile(web,'utf8');
 assert.match(s,/name:\s*zodiac-video-web/u);
 assert.match(s,/export-phase1-handoff\.mjs/u);
 assert.match(s,/PHASE1_HANDOFF_READY/u);
 assert.match(s,/must not activate Phase 2/i);
 assert.doesNotMatch(s,/run-phase03-production\.mjs/u);
});

test('local entrypoint automatically bootstraps inbox and owns only Phase 2-3 production',async()=>{
 const s=await readFile(local,'utf8');
 assert.match(s,/name:\s*zodiac-video-local/u);
 assert.match(s,/local-bootstrap\.mjs/u);
 assert.match(s,/phase1-done/u);
 assert.match(s,/PHASE2_LOCAL_READY/u);
 assert.match(s,/Phase 2/i);
 assert.match(s,/Phase 3/i);
 assert.match(s,/ready\//u);
 assert.match(s,/must not rewrite approved narration/i);
});
