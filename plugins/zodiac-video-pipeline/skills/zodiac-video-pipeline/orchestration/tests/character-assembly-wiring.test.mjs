import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));const orch=path.resolve(here,'..');const skillRoot=path.resolve(orch,'..');
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
test('Phase 2 makes native character assembly mandatory without adding a phase',async()=>{
 const phase=await readJson(path.join(orch,'phases/02-visual-production.json'));assert.equal(phase.id,'02-visual-production');assert.equal(phase.steps.length,3);
 const v=phase.steps.find(x=>x.id==='visual_compile'),a=phase.steps.find(x=>x.id==='assets');
 for(const id of ['character_component_catalog','character_assembly_contract'])assert.ok(v.required_capabilities.some(x=>x.id===id),id);
 assert.ok(v.required_outputs.includes('.authoring/character-assembly-plan.json'));
 for(const g of ['character_identity_blueprint','body_hair_outfit_binding','pose_expression_state_binding'])assert.ok(v.gate_checks.includes(g),g);
 for(const id of ['character_state_asset_planner','character_assembly_compiler','character_assembly_validation'])assert.ok(a.required_capabilities.some(x=>x.id===id),id);
 assert.ok(a.required_outputs.includes('.authoring/character-state-asset-plan.json'));
 const ids=a.required_capabilities.map(x=>x.id);assert.ok(ids.indexOf('character_state_asset_planner')<ids.indexOf('character_assembly_compiler'),'asset planning must precede SVG compilation');assert.ok(ids.indexOf('character_assembly_compiler')<ids.indexOf('scene_direction_compiler'),'character assembly must precede Scene Direction');assert.ok(ids.indexOf('character_assembly_validation')<ids.indexOf('scene_direction_compiler'),'identity validation must precede Scene Direction');
 assert.equal(a.required_capabilities.find(x=>x.id==='outfit_pattern_validation')?.tool_locator,'references/asset-library-v4/validation/validate-character-components.mjs');
 assert.equal(a.required_capabilities.find(x=>x.id==='outfit_bake_validation')?.tool_locator,'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs');
 for(const g of ['character_assembly_compiled','character_state_asset_budget','character_identity_lock','native_v4_outfit','pose_expression_component_fit'])assert.ok(a.gate_checks.includes(g),g);
});
test('v4 manifest exposes character component contract',async()=>{const m=await readJson(path.join(skillRoot,'references/asset-library-v4/manifest.json'));assert.equal(m.contracts.character_components,'characters/components/catalog.json');assert.equal(m.contracts.character_assembly,'characters/assembly-contract.md');});

test('Phase 2 capability guidance URIs are not duplicated inside one step',async()=>{
 const phase=await readJson(path.join(orch,'phases/02-visual-production.json'));
 for(const step of phase.steps){
   const refs=[...(step.required_capabilities??[]),...(step.conditional_capabilities??[])].map(x=>x.guidance_uri).filter(Boolean);
   const dup=refs.filter((x,i)=>refs.indexOf(x)!==i);
   assert.deepEqual([...new Set(dup)],[],`${step.id} duplicates capability guidance: ${dup.join(', ')}`);
 }
});

test('visual grammar recipe includes character assembly before skin/environment/geometry',async()=>{
 const recipe=await readJson(path.join(skillRoot,'references/asset-library-v4/recipes/visual-grammar.json'));
 assert.deepEqual(recipe.selection_order,['frame_skeleton','mechanic','character_assembly','skin_binding','environment_composition','scene_direction_compile']);
});
