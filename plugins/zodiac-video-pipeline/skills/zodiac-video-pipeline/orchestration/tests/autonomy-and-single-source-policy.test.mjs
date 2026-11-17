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

test('Phase 1 is a creative Web workflow with one human boundary',async()=>{
 const doc=await read('phases/01-content.md');
 assert.match(doc,/creative-host workflow/iu);
 assert.match(doc,/select the strongest valid concept automatically unless the user asks to choose/iu);
 assert.match(doc,/only required human approval boundary/iu);
 assert.match(doc,/Web does not create or activate native pipeline state/iu);
});

test('Phase 2 policy makes Visual Intent the only agent-authored visual source',async()=>{
 const doc=await read('phases/02-visual-production.md');
 assert.match(doc,/one source of truth only[\s\S]*visual-intent\.json/iu);
 assert.match(doc,/compiler-owned and must not be manually authored or patched/iu);
});
