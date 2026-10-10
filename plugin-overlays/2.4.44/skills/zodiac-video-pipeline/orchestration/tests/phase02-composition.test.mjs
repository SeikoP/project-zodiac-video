import test from 'node:test';import assert from 'node:assert/strict';
import {validateComposition,compositionHash,sceneContext} from '../phase02-composition.mjs';
const fixture=()=>{
 const token={id:'zodiac-paper-doodle-meme-v4',version:'4.0'};
 const entity={id:'hero',visual_role:'character',initial_state:'idle',states:{idle:{asset:'hero',transform:{x:50,y:200,width:500,height:600},layer:3,visible:true}}};
 const scene={id:'s1',voice:'Cậu ấy đứng cạnh chiếc bàn.',entities:[entity],occlusion_relations:[],spatial_bindings:[],layout_contract:{canvas:{width:1080,height:1920}}};
 const plan={design_token_sha256:compositionHash(token),scenes:[{id:scene.id,voice:scene.voice,components:[{id:'hero',reason:'performer',voice_anchor:'Cậu ấy',visual_role:'character',initial_state:'idle',states:{idle:{transform:entity.states.idle.transform,layer:3,visible:true}}}],occlusion_relations:[],spatial_bindings:[],layout_contract:scene.layout_contract}]};
 return {production:{scenes:[scene]},plan,token};
};
test('complete scene produces reusable context with full token and geometry',()=>{const f=fixture();assert.equal(validateComposition(f.production,f.plan,f.token).status,'PASS');assert.deepEqual(sceneContext(f.production,f.plan,f.token,'s1').scene,f.production.scenes[0]);});
test('reports missing component, style drift and geometry drift together',()=>{const f=fixture();f.token.version='changed';f.production.scenes[0].entities[0].states.idle.layer=4;f.plan.scenes[0].components.push({...f.plan.scenes[0].components[0],id:'desk'});const codes=validateComposition(f.production,f.plan,f.token).issues.map(x=>x.code);for(const c of ['COMPOSITION_TOKEN_STALE','COMPOSITION_GEOMETRY_STALE','COMPOSITION_COMPONENT_MISSING'])assert.ok(codes.includes(c));});
test('rejects incomplete role, position and cyclic front/back',()=>{const f=fixture(),s=f.production.scenes[0];delete s.entities[0].visual_role;delete s.entities[0].states.idle.transform.width;s.occlusion_relations=[{front:'hero',back:'hero'}];const codes=validateComposition(f.production,f.plan,f.token).issues.map(x=>x.code);for(const c of ['COMPOSITION_ROLE_MISSING_OR_STALE','COMPOSITION_GEOMETRY_INCOMPLETE','COMPOSITION_DEPTH_REFERENCE_INVALID','COMPOSITION_DEPTH_CYCLE'])assert.ok(codes.includes(c));});
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {designToken} from '../phase02-composition.mjs';
test('fresh precompile enforces canonical token and inventory; resume context is executable',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'composition-seam-'));
 try{
  await mkdir(path.join(root,'.authoring'));const f=fixture(),design=await readFile(new URL('../../references/design.md',import.meta.url),'utf8');f.token=designToken(design);f.plan.design_token_sha256=compositionHash(f.token);
  for(const [name,data] of Object.entries({'production.json':f.production,'.authoring/scene-art-direction.json':f.plan,'.authoring/pipeline-state.json':{plugin_version:'2.4.44'}}))await writeFile(path.join(root,name),JSON.stringify(data));
  await writeFile(path.join(root,'narration.txt'),f.production.scenes[0].voice);await writeFile(path.join(root,'design.md'),design);
  const seam=fileURLToPath(new URL('../validate-phase02-precompile-boundary.mjs',import.meta.url)),context=fileURLToPath(new URL('../phase02-composition.mjs',import.meta.url));
  let r=spawnSync(process.execPath,[seam,root],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);
  r=spawnSync(process.execPath,[context,root,'--context','s1'],{encoding:'utf8'});assert.equal(r.status,0,r.stdout+r.stderr);assert.deepEqual(JSON.parse(r.stdout).design_token,f.token);
  f.plan.scenes[0].components=[];await writeFile(path.join(root,'.authoring/scene-art-direction.json'),JSON.stringify(f.plan));r=spawnSync(process.execPath,[seam,root],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stdout,/COMPOSITION_COMPONENT_UNPLANNED/);
  f.token.palette_roles.ink='#000000';f.plan.design_token_sha256=compositionHash(f.token);await writeFile(path.join(root,'design.md'),'<!-- STYLE_TOKEN_BEGIN -->\n```json\n'+JSON.stringify(f.token)+'\n```\n<!-- STYLE_TOKEN_END -->');r=spawnSync(process.execPath,[seam,root],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stdout,/COMPOSITION_CANONICAL_TOKEN_DRIFT/);
 }finally{await rm(root,{recursive:true,force:true});}
});
