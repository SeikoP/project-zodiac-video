import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {assertPhase02AuthoringSource} from '../../features/visual-composition/write-phase02-authoring.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=rel=>readFile(path.join(root,rel),'utf8');

test('fresh Phase 2 accepts only canonical Visual Intent source',()=>{
 assert.equal(assertPhase02AuthoringSource('zodiac-visual-intent@1','fresh'),true);
 assert.throws(()=>assertPhase02AuthoringSource('zodiac-phase02-authored-handoff@1','fresh'),/FRESH_VISUAL_INTENT_REQUIRED/);
 assert.equal(assertPhase02AuthoringSource('zodiac-phase02-authored-handoff@1','continuity'),true);
});

test('Phase 1 policy has one normal pause at final Content Review',async()=>{
 const doc=await read('phases/01-content.md');
 assert.match(doc,/autopilot authoring phase/iu);
 assert.match(doc,/Do \*\*not\*\* ask the user to:[\s\S]*choose among concept candidates/iu);
 assert.match(doc,/final Narration \+ compact QC[\s\S]*Content Review/iu);
});

test('Phase 2 policy makes Visual Intent the only agent-authored visual source',async()=>{
 const doc=await read('phases/02-visual-production.md');
 assert.match(doc,/one source of truth only[\s\S]*visual-intent\.json/iu);
 assert.match(doc,/compiler-owned and must not be manually authored or patched/iu);
});
