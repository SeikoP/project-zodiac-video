import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('production checks native manifest evidence before producing output directory',async()=>{
 const src=await readFile(new URL('../../phases/phase03/run-phase03-production.mjs',import.meta.url),'utf8');
 assert.ok(src.includes("inspectPhase02Seal(approved)"));
 assert.ok(src.indexOf('inspectPhase02Seal(approved)') < src.indexOf('await mkdir(dest')); 
 assert.ok(src.includes('PHASE03_STATE_EVIDENCE_BLOCKED'));
 assert.ok(src.includes('assertReviewLock(approved,lock)'));
});
