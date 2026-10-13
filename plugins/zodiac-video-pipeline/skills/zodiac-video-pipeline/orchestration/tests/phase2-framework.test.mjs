import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access,mkdtemp,writeFile,mkdir,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cp} from 'node:fs/promises';
const root=fileURLToPath(new URL('../../',import.meta.url));
const library=path.join(root,'references/asset-library-v4');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('refactor source contains every executable module and canonical registry it imports',async()=>{
 for(const file of ['orchestration/scene-set-detection.mjs','orchestration/phase02-selected-dependencies.mjs','orchestration/validate-motion-consistency.mjs','orchestration/validate-scene-set-accents.mjs','references/asset-library-v4/scene-set/index.json','references/asset-library-v4/scene-set/compile-scene-set.mjs','references/asset-library-v4/shot-layouts/index.json'])assert.ok(await access(path.join(root,file)).then(()=>true,()=>false),'Missing source '+file);
});
test('clean scene-set compilation copies only selected exact masters and keeps performers',async()=>{
 const module=path.join(library,'scene-set/compile-scene-set.mjs');assert.ok(await access(module).then(()=>true,()=>false),'scene-set compiler missing');
 const {compileSceneSetWorkspace}=await import(module),dir=await mkdtemp(path.join(os.tmpdir(),'scene-set-clean-'));
 try{await writeFile(path.join(dir,'production.json'),JSON.stringify({version:'2.0',assets:{},scenes:[{id:'s',environment:{scene_set_id:'scene-set-home',profile:'living-room-home',scene_accents:[]},entities:[{id:'lead',kind:'character',states:{a:{asset:'future-character'}}}],events:[]}]}));
 const r=await compileSceneSetWorkspace(dir);assert.equal(r.production.scenes[0].entities.filter(e=>e.kind==='character').length,1);assert.equal(r.production.scenes[0].entities.length,2);assert.deepEqual(Object.keys(r.production.assets),['ENV_SCENE_SET_HOME']);
 const index=JSON.parse(await readFile(path.join(library,'scene-set/index.json'))),master=index.scene_sets.find(s=>s.id==='scene-set-home');assert.equal(sha(await readFile(path.join(dir,r.production.assets.ENV_SCENE_SET_HOME.path))),master.asset_sha256);
 }finally{await rm(dir,{recursive:true,force:true})}
});
test('scene accent cannot escape the selected wall, and unknown set fails closed',async()=>{
 const module=path.join(root,'orchestration/validate-scene-set-accents.mjs');assert.ok(await access(module).then(()=>true,()=>false),'containment validator missing');const {validateSceneSetAccents}=await import(module);
 const p={scenes:[{id:'s',environment:{scene_set:{id:'scene-set-home',wall_region:{x:40,y:310,width:990,height:790}},scene_accents:[{entity_id:'accent'}]},entities:[{id:'accent',states:{a:{visible:true,transform:{x:220,y:390,width:640,height:130}}}}]}]};assert.equal(validateSceneSetAccents(p).status,'PASS');p.scenes[0].entities[0].states.a.transform.y=1400;assert.equal(validateSceneSetAccents(p).status,'BLOCKED');
});
test('furniture semantic matching does not read bedroom as bed',async()=>{
 const {validatePrecompileBoundary}=await import('../validate-phase02-precompile-boundary.mjs');const p={scenes:[{id:'s',voice:'Một câu.',entities:[{id:'env__bedroom-window',states:{a:{asset:'a'}}}],events:[]}],assets:{a:{path:'assets/bedroom-window.svg'}}};assert.equal(validatePrecompileBoundary(p,'Một câu.').status,'PASS');p.scenes[0].entities[0].id='env__bed';assert.ok(validatePrecompileBoundary(p,'Một câu.').issues.some(i=>i.code==='BACKGROUND_FURNITURE_OWNERSHIP'));
});
test('duration authority uses registry defaults and explicit valid overrides',async()=>{
 const module=path.join(root,'orchestration/validate-motion-consistency.mjs');assert.ok(await access(module).then(()=>true,()=>false),'motion validator missing');const {validateMotionConsistency}=await import(module);const registry=JSON.parse(await readFile(path.join(root,'contracts/motion-registry-v1.json')));assert.equal(registry.motions.state_swap.default_duration_frames,12);
 const p={scenes:[{id:'s',events:[{id:'e',motion:{preset:'state_swap',duration_frames:12}}]}]};assert.equal(validateMotionConsistency(p,registry).status,'PASS');p.scenes[0].events[0].motion.duration_frames=10;assert.equal(validateMotionConsistency(p,registry).status,'BLOCKED');p.scenes[0].events[0].motion.duration_override=true;assert.equal(validateMotionConsistency(p,registry).status,'PASS');p.scenes[0].events[0].motion.duration_frames=-1;assert.equal(validateMotionConsistency(p,registry).status,'BLOCKED');
});
test('symbolic authoring kind projects to existing Job5 transport only at intent boundary',async()=>{
 const {compileVisualIntent}=await import('../compile-visual-intent.mjs');const narration='Một câu.',intent={format:'zodiac-visual-intent@1',narration_sha256:sha(narration),cast:[],frames:[],assets:{symbol:{path:'symbol.svg',category:'story_object'}},video:{width:1080,height:1920,fps:30},story_object_decision:{mode:'optional',reason:'Một biểu tượng.',review_ref:'fixture'},scenes:[{id:'s',narration_range:[0,Buffer.byteLength(narration)],semantic_goal:'Biểu tượng suy nghĩ',grammar:{frame_id:'prop-focus',mechanic_id:'reveal',bindings:{focus_prop:'thought'}},entities:[{id:'thought',kind:'story_object',visual_role:'story_object',initial_state:'a',states:{a:{asset:'symbol'}}}],events:[]}]};const out=compileVisualIntent(intent,{narration});assert.equal(out.production.scenes[0].entities[0].kind,'object');assert.equal(out.production.scenes[0].entities[0].visual_role,'story_object');assert.equal(out.production.assets.symbol.category,'story_object');assert.equal(intent.scenes[0].entities[0].kind,'story_object');
});
test('selected dependency graph excludes unselected library bytes and includes selected master bytes',async()=>{
 const {selectedPhase02Dependencies}=await import('../phase02-selected-dependencies.mjs');const dir=await mkdtemp(path.join(os.tmpdir(),'selected-deps-'));try{const skill=path.join(dir,'skill'),ws=path.join(dir,'job');await cp(root,skill,{recursive:true});await mkdir(path.join(ws,'.authoring'),{recursive:true});await writeFile(path.join(ws,'.authoring/visual-intent.json'),JSON.stringify({cast:[],assets:{},scenes:[{environment:{scene_set_id:'scene-set-home'}}]}));const r=await selectedPhase02Dependencies(skill,ws);assert.equal(r.mode,'selected');assert.ok(r.files.some(p=>p.endsWith('scene-set/frames/scene-set-home.svg')));assert.ok(!r.files.some(p=>p.endsWith('scene-set-cafe.svg')||(p.includes('/memes/')&&p.endsWith('.svg'))));const fingerprint=async()=>sha(Buffer.concat(await Promise.all(r.files.map(p=>readFile(p)))));const before=await fingerprint();await writeFile(path.join(skill,'references/asset-library-v4/scene-set/frames/scene-set-cafe.svg'),'unselected mutation');assert.equal(await fingerprint(),before);await writeFile(path.join(skill,'references/asset-library-v4/scene-set/frames/scene-set-home.svg'),'selected mutation');assert.notEqual(await fingerprint(),before);}finally{await rm(dir,{recursive:true,force:true})}
});
test('per-step lineage keeps environment masters out of character compiler receipts',async()=>{const api=await import('../phase02-selected-dependencies.mjs');assert.equal(typeof api.selectedStepDependencyFiles,'function');const candidates=[path.join(library,'characters/compile-character-assembly.mjs'),path.join(library,'characters/components/catalog.json'),path.join(library,'characters/character-design-intent.mjs'),path.join(library,'scene-set/frames/scene-set-home.svg')];const r=await api.selectedStepDependencyFiles(root,'references/asset-library-v4/characters/compile-character-assembly.mjs',candidates);assert.ok(r.some(p=>p.endsWith('characters/components/catalog.json')));assert.ok(!r.some(p=>p.endsWith('.svg')));});

test('selected fresh guidance resolves every required file in the packaged source',async()=>{
 const {loadStepContext}=await import('../plan-step-context.mjs');
 const template=JSON.parse(await readFile(path.join(root,'orchestration/pipeline-state.template.json')));
 const plan=await loadStepContext('02-visual-production','assets',template.flags, {selected_asset_ids:['scene-set-home'],environment_mode:'scene_set'});
 for(const ref of plan.required_references??[])assert.ok(await access(path.join(root,ref)).then(()=>true,()=>false),'Missing selected guidance '+ref);
 const policy=JSON.parse(await readFile(path.join(library,'selection-policy.json')));
 for(const ref of policy.core_refs)assert.ok(await access(path.join(root,ref)).then(()=>true,()=>false),'Missing core guidance '+ref);
});
