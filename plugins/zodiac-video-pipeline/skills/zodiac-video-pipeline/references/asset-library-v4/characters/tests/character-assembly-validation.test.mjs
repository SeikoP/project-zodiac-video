import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const validator=path.resolve(here,'../../validation/validate-character-assembly.mjs');
const compiler=path.resolve(here,'../compile-character-assembly.mjs');
const baseProduction=()=>({version:'2.0',assets:{},scenes:[{id:'S01',entities:[{id:'hero',kind:'character',initial_state:'neutral',states:{neutral:{transform:{x:100,y:100,width:300,height:420},layer:20,visible:true},react:{transform:{x:100,y:100,width:300,height:420},layer:20,visible:true}}}]}]});
const basePlan=()=>({format:'zodiac-character-assembly-plan@1',characters:[{entity_id:'hero',identity_id:'hero-main',body_profile:'lean_tall',hair_id:'side-part',outfit_id:'gemini-basic-clean',variant_seed:'series-a|hero',states:{neutral:{pose_id:'neutral',expression_id:'neutral'},react:{pose_id:'reach',expression_id:'side-eye'}}}]});
const compileWithPlan=d=>{const args=[path.join(d,'production.json'),path.join(d,'.authoring','character-assembly-plan.json')];const planned=spawnSync(process.execPath,[compiler,...args,'--plan-only'],{encoding:'utf8'});if(planned.status!==0)return planned;return spawnSync(process.execPath,[compiler,...args,'--write'],{encoding:'utf8'});};
async function ws(plan=basePlan(),production=baseProduction(),writeStatePlan=true){
 const d=await mkdtemp(path.join(os.tmpdir(),'char-assembly-v4-'));await mkdir(path.join(d,'.authoring'),{recursive:true});
 await writeFile(path.join(d,'production.json'),JSON.stringify(production));await writeFile(path.join(d,'.authoring','character-assembly-plan.json'),JSON.stringify(plan));if(writeStatePlan){const {planCharacterStateAssets}=await import('../compile-character-assembly.mjs');await writeFile(path.join(d,'.authoring','character-state-asset-plan.json'),JSON.stringify(planCharacterStateAssets(production,plan)));}return d;
}
test('validator requires compiled native-v4 character assets',async()=>{const d=await ws();try{const r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/CHARACTER_ASSEMBLY_REQUIRED/);}finally{await rm(d,{recursive:true,force:true});}});
test('write mode requires a precomputed state asset plan before creating SVG files',async()=>{const d=await ws();try{await rm(path.join(d,'.authoring','character-state-asset-plan.json'));const r=spawnSync(process.execPath,[compiler,path.join(d,'production.json'),path.join(d,'.authoring','character-assembly-plan.json'),'--write'],{encoding:'utf8'});assert.notEqual(r.status,0);await assert.rejects(readFile(path.join(d,'assets','characters','hero-neutral.svg')));}finally{await rm(d,{recursive:true,force:true});}});
test('plan-only reports reuse and creates no character SVGs; a changed source invalidates the plan',async()=>{const d=await ws();try{let r=spawnSync(process.execPath,[compiler,path.join(d,'production.json'),path.join(d,'.authoring','character-assembly-plan.json'),'--plan-only'],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const statePlan=JSON.parse(await readFile(path.join(d,'.authoring','character-state-asset-plan.json'),'utf8'));assert.equal(statePlan.format,'zodiac-character-state-asset-plan@1');assert.equal(statePlan.characters[0].unique_asset_count,2);assert.equal(statePlan.characters[0].reused_state_count,0);await assert.rejects(readFile(path.join(d,'assets','characters','hero-neutral.svg')));const plan=JSON.parse(await readFile(path.join(d,'.authoring','character-assembly-plan.json'),'utf8'));plan.characters[0].states.react.expression_id='deadpan';await writeFile(path.join(d,'.authoring','character-assembly-plan.json'),JSON.stringify(plan));r=spawnSync(process.execPath,[compiler,path.join(d,'production.json'),path.join(d,'.authoring','character-assembly-plan.json'),'--write'],{encoding:'utf8'});assert.notEqual(r.status,0);await assert.rejects(readFile(path.join(d,'assets','characters','hero-neutral.svg')));}finally{await rm(d,{recursive:true,force:true});}});
test('compiler output validates, keeps one identity signature, and includes a sticker edge',async()=>{const d=await ws();try{let r=compileWithPlan(d);assert.equal(r.status,0,r.stderr);r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);const p=JSON.parse(await readFile(path.join(d,'production.json'),'utf8'));const ids=Object.values(p.assets).map(a=>a.character_blueprint?.identity_signature).filter(Boolean);assert.equal(new Set(ids).size,1);const svg=await readFile(path.join(d,p.assets.CHAR_HERO_NEUTRAL.path),'utf8');assert.match(svg,/<g id="sticker_edge">/u);}finally{await rm(d,{recursive:true,force:true});}});
test('validator rejects shirt color identity drift in the baked blueprint',async()=>{const d=await ws();try{let r=compileWithPlan(d);assert.equal(r.status,0,r.stderr);const p=JSON.parse(await readFile(path.join(d,'production.json'),'utf8'));const bp=p.assets.CHAR_HERO_NEUTRAL.character_blueprint;bp.shirt_color_id=bp.shirt_color_id==='teal'?'coral':'teal';await writeFile(path.join(d,'production.json'),JSON.stringify(p));const {validateCharacterAssembly}=await import('../../validation/validate-character-assembly.mjs');await assert.rejects(()=>validateCharacterAssembly(d),/CHARACTER_IDENTITY_DRIFT/u);}finally{await rm(d,{recursive:true,force:true});}});
test('outfit bake validator checks shirt fills against distinct cast identities',async()=>{
 const d=await ws();
 try{
  const {compileCharacterAssembly}=await import('../compile-character-assembly.mjs');
  const production=baseProduction();production.scenes[0].entities.push({id:'friend',kind:'character',initial_state:'neutral',states:{neutral:{visible:true},react:{visible:true}}});
  const states={neutral:{pose_id:'neutral',expression_id:'neutral'},react:{pose_id:'reach',expression_id:'side-eye'}};
  const plan={format:'zodiac-character-assembly-plan@1',characters:[
   {...basePlan().characters[0],states},
   {entity_id:'friend',body_profile:'round_soft',hair_id:'soft-wave',outfit_id:'generic-soft-stripes',variant_seed:'series-a|friend',states}
  ]};
  const compiled=await compileCharacterAssembly(production,plan,{root:d,writeAssets:true});
  await writeFile(path.join(d,'production.json'),JSON.stringify(compiled));
  await writeFile(path.join(d,'.authoring','character-assembly-plan.json'),JSON.stringify(plan));
  const outfitValidator=path.resolve(here,'../../validation/validate-outfit-bake-v4.mjs');
  let r=spawnSync(process.execPath,[outfitValidator,d],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
  const p=JSON.parse(await readFile(path.join(d,'production.json'),'utf8'));
  p.assets.CHAR_FRIEND_NEUTRAL.character_blueprint.shirt_color='bad-color';
  await writeFile(path.join(d,'production.json'),JSON.stringify(p));
  r=spawnSync(process.execPath,[outfitValidator,d],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/shirt color identity drift/u);
 }finally{await rm(d,{recursive:true,force:true});}
});
test('duplicate character identity specs fail closed',async()=>{const p=basePlan();p.characters.push({...p.characters[0],body_profile:'round_soft'});const d=await ws(p,baseProduction(),false);try{const r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/duplicate.*hero/i);}finally{await rm(d,{recursive:true,force:true});}});
test('state-level identity overrides are forbidden',async()=>{const p=basePlan();p.characters[0].states.react.hair_id='soft-wave';const d=await ws(p,baseProduction(),false);try{const r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/state.*identity/i);}finally{await rm(d,{recursive:true,force:true});}});
test('meme-required crop and acting survive compilation and validator catches blueprint drift',async()=>{
 const production=baseProduction();production.scenes[0].visual_grammar={meme_composition:{acting_requirements:{hero:{pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'}}}};
 const plan=basePlan();plan.characters[0].states.neutral={pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'};
 const d=await ws(plan,production);
 try{
  const r=compileWithPlan(d);assert.equal(r.status,0,r.stderr);
  const {validateCharacterAssembly}=await import('../../validation/validate-character-assembly.mjs');
  await assert.doesNotReject(()=>validateCharacterAssembly(d));
  const p=JSON.parse(await readFile(path.join(d,'production.json'),'utf8'));p.assets.CHAR_HERO_NEUTRAL.character_blueprint.crop_id=null;await writeFile(path.join(d,'production.json'),JSON.stringify(p));
  await assert.rejects(()=>validateCharacterAssembly(d),/CHARACTER_STATE_MISMATCH/u);
 }finally{await rm(d,{recursive:true,force:true});}
});
test('validator rejects altered hair geometry even when blueprint metadata still matches',async()=>{const d=await ws();try{let r=compileWithPlan(d);assert.equal(r.status,0,r.stderr);const p=JSON.parse(await readFile(path.join(d,'production.json'),'utf8'));const assetPath=path.join(d,p.assets.CHAR_HERO_NEUTRAL.path);let svg=await readFile(assetPath,'utf8');assert.match(svg,/M147 250 Q165 181/u);svg=svg.replace('M147 250 Q165 181','M148 250 Q165 181');await writeFile(assetPath,svg);await assert.rejects(()=>import('../../validation/validate-character-assembly.mjs').then(m=>m.validateCharacterAssembly(d)),/CHARACTER_ART_DRIFT/u);}finally{await rm(d,{recursive:true,force:true});}});
