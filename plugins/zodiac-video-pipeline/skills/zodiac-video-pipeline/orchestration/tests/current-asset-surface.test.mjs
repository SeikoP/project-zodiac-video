import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {selectAssetGuidance} from '../../core/policy/select-asset-guidance.mjs';
import {loadStepContext} from '../plan-step-context.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const json=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const policy=await json('references/asset-library-v4/selection-policy.json');
test('retired room IDs cannot silently resolve without guidance in fresh authoring',()=>{
 assert.throws(()=>selectAssetGuidance({selected_asset_ids:['cafe-window'],environment_mode:'scene_set'},policy),/ASSET_RETIRED/);
});
test('fresh cannot turn on compatibility by selecting a legacy environment mode',()=>{
 assert.throws(()=>selectAssetGuidance({selected_asset_ids:[],environment_mode:'legacy'},policy),/RECOVERY_SNAPSHOT_REQUIRED/);
});
test('both fresh Phase2 authoring steps materialize only current guidance',async()=>{
 const template=await json('orchestration/pipeline-state.template.json');
 for(const step of ['visual_compile','assets']){
  const plan=await loadStepContext('02-visual-production',step,template.flags,{selected_asset_ids:[],environment_mode:'scene_set'});
  assert.equal(plan.required_references.some(p=>/migration|provenance|story-object-effects|environments\/compositions/u.test(p)),false);
  assert.ok(plan.deferred_exit_capabilities.includes('visual_grammar_validation')||plan.deferred_exit_capabilities.includes('character_assembly_validation'));
 }
});
test('retired hair and historical exemplars are absent from the current asset surface',async()=>{
 const catalog=await json('references/asset-library-v4/characters/components/catalog.json');
 assert.ok(catalog.hair.every(r=>r.selection_tier!=='compatibility_opt_in'));
 for(const p of ['references/asset-library-v4/migration/index.json','references/story-object-effects.md','references/asset-library-v4/characters/masters/female-messy-bun.svg'])
  assert.equal(await access(path.join(root,p)).then(()=>true,()=>false),false,p);
});
test('fresh selection validator is executable and permits current native props',async()=>{
 let api;try{api=await import('../../features/visual-composition/validate-fresh-asset-selection.mjs');}catch(e){assert.fail('fresh gate cannot execute: '+e.message);}
 const intent={cast:[{entity_id:'hero',hair_id:'asym-bang'}],assets:{phone:{path:'assets/phone.svg',lineage:{source_master:'phone'}}},scenes:[{id:'s',grammar:{environment:{scene_set_id:'scene-set-home'}}}]};
 assert.equal(api.validateFreshAssetSelection({intent,policy}).status,'PASS');
 assert.throws(()=>api.validateFreshAssetSelection({intent:{...intent,cast:[{entity_id:'hero',hair_id:'lopsided-bob'}]},policy}),/RETIRED_HAIR/);
 assert.throws(()=>api.validateFreshAssetSelection({intent,production:{assets:{stale:{path:'assets/stale.svg',character_blueprint:{hair_id:'lopsided-bob'}}}},policy}),/RETIRED_HAIR/);
});
test('selected stage bytes participate in dependency fingerprints from canonical grammar input',async()=>{
 const {selectedPhase02Dependencies}=await import('../../phases/phase02/phase02-selected-dependencies.mjs');
 const ws=await mkdtemp(path.join(os.tmpdir(),'current-deps-'));
 try{await mkdir(path.join(ws,'.authoring'));await writeFile(path.join(ws,'.authoring/visual-intent.json'),JSON.stringify({cast:[],assets:{},scenes:[{grammar:{environment:{scene_set_id:'scene-set-home',scene_accents:[{id:'scene-accent-clock'}]}}}]}));
 const r=await selectedPhase02Dependencies(root,ws);
 assert.ok(r.files.some(p=>p.endsWith('/scene-set/frames/scene-set-home.svg')));
 const clock=(await json('references/asset-library-v4/scene-set/accents/index.json')).accents.find(a=>a.id==='scene-accent-clock');
 assert.ok(r.files.some(p=>p.endsWith('/scene-set/'+clock.path)));
 }finally{await rm(ws,{recursive:true,force:true});}
});
test('catalog review renders compiled characters and exact current native stage bytes',async()=>{
 const module=path.join(root,'features/asset-selection/build-current-asset-review.mjs');
 assert.ok(await access(module).then(()=>true,()=>false),'current catalog preview is missing');
 const {buildCurrentAssetReview}=await import(module);
 const result=await buildCurrentAssetReview({selected_ids:['scene-set-home','asym-bang','phone']});
 assert.ok(result.html.includes('hair_id=asym-bang'));
 assert.equal(result.receipt.items.some(i=>i.id==='lopsided-bob'),false);
 assert.equal(result.receipt.items.some(i=>i.id==='cafe-window'),false);
 const master=(await json('references/asset-library-v4/scene-set/index.json')).scene_sets.find(s=>s.id==='scene-set-home');
 const item=result.receipt.items.find(i=>i.id===master.id);
 assert.equal(item.sha256,master.asset_sha256);
 assert.equal(createHash('sha256').update(result.html).digest('hex'),result.receipt.html_sha256);
 await assert.rejects(()=>buildCurrentAssetReview({selected_ids:['cafe-window']}),/ASSET_RETIRED/);
});
test('current effect vocabulary renders semantic marks without an artificial path-count quota',async()=>{
 const {buildEffectSvg}=await import('../../references/asset-library-v4/memes/compile-meme-effects.mjs');
 for(const id of ['focus-halo-mark','comparison-bracket-mark','relief-wave-mark','alarm-zigzag-mark'])
  assert.ok(buildEffectSvg(id).includes('id='+id));
});
test('every advertised identity accessory is visibly baked into character output',async()=>{
 const {compileCharacterSvg}=await import('../../references/asset-library-v4/characters/compile-character-assembly.mjs');
 for(const id of ['small-hoop','headband','neck-scarf','square-glasses']){
  const result=compileCharacterSvg({entity_id:'hero',body_profile:'standard_compact',hair_id:'asym-bang',outfit_id:'generic-cosmic-light',accessory_id:id},{pose_id:'explain',expression_id:'neutral'});
  assert.ok(result.svg.includes('id="accessory_'+id.replaceAll('-','_')+'"'),id);
 }
});
test('intent IDs cannot mask retired native production identity',async()=>{
 const {validateFreshAssetSelection}=await import('../../features/visual-composition/validate-fresh-asset-selection.mjs');
 const intent={assets:{hero:{path:'assets/current.svg'}},scenes:[{id:'s',grammar:{environment:{scene_set_id:'scene-set-home'}}}]};
 assert.throws(()=>validateFreshAssetSelection({intent,production:{assets:{hero:{path:'assets/stale.svg',character_blueprint:{hair_id:'lopsided-bob'}}}},policy}),/RETIRED_HAIR/);
});
test('current shirt colors have native comparison previews',async()=>{
 const {buildCurrentAssetReview}=await import('../../features/asset-selection/build-current-asset-review.mjs');
 const result=await buildCurrentAssetReview({selected_ids:['teal','coral','ochre','slate']});
 assert.equal(result.receipt.items.length,4);
 assert.ok(result.html.includes('shirt_color_id=coral'));
});
test('current contracts contain no retired character source or profile geometry',async()=>{
 for(const rel of ['contracts/visual-intent-contract.json','contracts/interaction-map.json']){
  const raw=await readFile(path.join(root,'references/asset-library-v4',rel),'utf8');
  for(const id of policy.retired_hair_ids)assert.equal(raw.includes('"'+id+'"'),false,rel+' '+id);
 }
});
