import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=p=>readFile(new URL('../'+p,import.meta.url),'utf8');

test('producer review and runner media responsibilities remain separate',async()=>{
 const router=await read('router.md');
 assert.match(router,/LocalRunner owns TTS, measured timing, captions, Remotion, audio and MP4 acceptance/iu);
 assert.match(router,/Technical checks can verify structure and production readiness but never create approval/iu);
 assert.match(router,/genuine Visual Review/iu);
});

test('Phase02 native gates have real tools and never require renderer',async()=>{
 const m=JSON.parse(await read('phases/02-visual-production.json'));
 const caps=m.steps.flatMap(s=>[...(s.required_capabilities??[]),...(s.conditional_capabilities??[])]);
 for(const id of ['character_assembly_compiler','environment_compiler','scene_direction_compiler','director_v2_native_review'])assert.ok(caps.some(c=>c.id===id&&c.tool_locator),id);
 assert.ok(!caps.some(c=>/remotion|renderer/.test(c.id)));
});

test('only Phase03 exports Job5 while Phase02 ends at review-ready production',async()=>{
 const visual=JSON.parse(await read('phases/02-visual-production.json')),handoff=JSON.parse(await read('phases/03-handoff.json'));
 assert.deepEqual(visual.steps.map(s=>s.id),['visual_compile','assets','publish_prep']);
 assert.ok(visual.steps.every(s=>!s.allowed_operations.includes('create_zip')));
 assert.ok(handoff.steps.find(s=>s.id==='export').allowed_operations.includes('create_zip'));
 assert.match(await read('router.md'),/validated Job@5 handoff/iu);
});
