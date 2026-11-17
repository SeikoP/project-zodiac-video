import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const web=new URL('../../../zodiac-video-web/SKILL.md',import.meta.url);
const local=new URL('../../../zodiac-video-local/SKILL.md',import.meta.url);

test('web entrypoint owns Phase 1 and exports handoff instead of activating Phase 2',async()=>{
 const s=await readFile(web,'utf8');
 assert.match(s,/name:\s*zodiac-video-web/u);
 const manifest=JSON.parse(await readFile(new URL('../phases/01-content.json',import.meta.url),'utf8'));
 assert.equal(manifest.execution_mode,'creative_host');
 assert.deepEqual(manifest.steps.map(step=>step.id),['evidence','voice','concept','narrative_design','narration']);
 assert.match(s,/zodiac-phase1-handoff@2/u);
 assert.match(s,/genuine Content Review approval/u);
 assert.match(s,/content-review-receipt\.json/u);
 assert.match(s,/SHA256SUMS/u);
 assert.match(s,/SHA-256 hashes for `narration`, `plan`, `scope`, `brief`, and `voice`/u);
 assert.match(s,/Do not require Node or the native producer runtime/u);
 assert.doesNotMatch(s,/zodiac-video-pipeline\/SKILL\.md/u);
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
