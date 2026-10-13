import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const manifest=JSON.parse(await readFile(new URL('../phases/02-visual-production.json',import.meta.url),'utf8'));
test('fresh Phase02 capabilities never require Scene Set or wall validators',()=>{
 for(const step of manifest.steps){
  const mandatory=[...(step.required_capabilities??[])].filter(c=>['fresh','always'].includes(c.when));
  assert.deepEqual(mandatory.filter(c=>c.id.startsWith('scene_set')),[]);
  assert.equal((step.conditional_gate_checks??[]).filter(c=>c.when==='fresh'&&c.name.startsWith('scene_set')).length,0);
 }
});
test('fresh routing loads independent Narrative Visual and Scene Accent contracts',()=>{
 const compile=manifest.steps.find(s=>s.id==='visual_compile');
 const fresh=compile.required_capabilities.filter(x=>x.when==='fresh');
 for(const id of ['narrative_visual_contract','scene_accent_canvas_contract']){
  const contract=fresh.find(x=>x.id===id);
  assert.ok(contract, id+' is required for fresh context');
  assert.equal(contract.stage,'entry');
 }
});
test('historic Scene Set capabilities are not silently made mandatory via manifest',()=>{
 assert.ok(manifest.steps.every(s=>!s.required_capabilities?.some(c=>c.guidance_uri?.includes('/scene-set/'))));
});
