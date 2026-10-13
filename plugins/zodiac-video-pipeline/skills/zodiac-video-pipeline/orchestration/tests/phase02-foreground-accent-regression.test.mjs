import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {compileSceneSetWorkspace} from '../../references/asset-library-v4/scene-set/compile-scene-set.mjs';
import {validatePhase02ArtDirection} from '../../features/visual-composition/validate-phase02-art-direction.mjs';
import {buildNativePairs} from '../build-native-preview-pairs.mjs';
import * as intentCompiler from '../../features/visual-composition/compile-visual-intent.mjs';
import {validateCompositionIntent} from '../../features/visual-composition/resolve-scene-composition.mjs';
import {compositionHash} from '../phase02-composition.mjs';
import * as semanticFit from '../../features/visual-composition/validate-semantic-asset-fit.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const lib=path.join(skill,'references/asset-library-v4/scene-set');
const box={x:280,y:760,width:410,height:599};
const production=accents=>({version:'2.0',assets:{},scenes:[{id:'s',voice:'Một chuyện.',environment:{scene_set_id:'scene-set-cafe',scene_accents:accents},entities:[{id:'actor',kind:'character',initial_state:'idle',states:{idle:{asset:'ACTOR',transform:box,visible:true,layer:20}}}],events:[]}]});
const direction={format:'zodiac-scene-art-direction@2',scenes:[{id:'s',voice:'Một chuyện.',scene_set_id:'scene-set-cafe',palette_id:'p',performer:'actor',action:'listen',semantic_goal:'context',color_reason:'identity',environment_reason:'cafe'}]};
const art=p=>validatePhase02ArtDirection(p,direction,'Một chuyện.',{palettes:{p:{}}},{});
test('compiled background accents do not become symbolic story objects',()=>{
 assert.equal(typeof semanticFit.isStoryFacingObject,'function');
 const e={id:'accent__scene-accent-sign',kind:'object',generated_by:'scene-set',scene_asset_role:'scene_accent',scene_asset_id:'scene-accent-sign',states:{visible:{asset:'A'}}};
 const s={environment:{scene_accents:[{id:'scene-accent-sign',entity_id:e.id,asset:'A'}]}},assets={A:{category:'environment',lineage:{source_master:'scene-accent-sign'}}};
 assert.equal(semanticFit.isStoryFacingObject(s,e,assets),false);
 assert.equal(semanticFit.isStoryFacingObject(s,{...e,generated_by:undefined},assets),true);
 assert.equal(semanticFit.isStoryFacingObject(s,{...e,id:'seat-support',scene_asset_role:undefined},assets),true);
});
test('composition preflight recognizes planned accent compiler ownership before SVG generation',async()=>{
 const p=production([{id:'scene-accent-sign'}]),s=p.scenes[0],token={id:'fixture'};
 s.entities[0].visual_role='character';s.layout_contract={canvas:{width:1080,height:1920}};
 const plan={design_token_sha256:compositionHash(token),scenes:[{id:s.id,voice:s.voice,components:[{id:'actor',reason:'actor',voice_anchor:s.voice,visual_role:'character',ownership:{kind:'authored'}},...intentCompiler.sceneSetComponentIntents(s.environment,s.voice)],layout_contract:s.layout_contract,occlusion_relations:[],spatial_bindings:[]}]};
 assert.equal((await validateCompositionIntent(p,plan,token)).status,'PASS');
 plan.scenes[0].components[2].ownership.locator='scene-accent:unknown';assert.ok((await validateCompositionIntent(p,plan,token)).issues.some(x=>x.code==='COMPOSITION_COMPILER_LOCATOR_INVALID'));
});
test('Visual Intent plans the backdrop and all selected accent components',()=>{
 assert.equal(typeof intentCompiler.sceneSetComponentIntents,'function');
 const rows=intentCompiler.sceneSetComponentIntents({scene_set_id:'scene-set-cafe',scene_accents:[{id:'scene-accent-sign',entity_id:'menu',voice_anchor:'Một chuyện.'}]},'Một chuyện.');
 assert.deepEqual(rows.map(x=>x.id),['env__scene-set-cafe','menu']);assert.equal(rows[1].visual_role,'effect');assert.equal(rows[1].ownership.locator,'scene-accent:scene-accent-sign');
});
test('native art gate requires chosen accents or an explicit omission',()=>{
 const p=production([]);assert.ok(art(p).issues.some(x=>x.code==='SCENE_ACCENT_DECISION_MISSING'));
 p.scenes[0].environment.scene_accent_omission_reason='Neutral framing intentionally focuses on the actor.';assert.equal(art(p).status,'PASS');
 p.scenes[0].environment.scene_accents=[{id:'scene-accent-sign'}];delete p.scenes[0].environment.scene_accent_omission_reason;assert.equal(art(p).status,'PASS');
});
test('default accent placement follows the transformed wall and recompiles without actor drift',async()=>{
 const a=await compileSceneSetWorkspace('.', {production:production([{id:'scene-accent-cafe-window'},{id:'scene-accent-sign'}]),write:false});
 const s=a.production.scenes[0],w=s.environment.scene_set.wall_region;
 assert.equal(s.environment.scene_accents.length,2);
 for(const accent of s.environment.scene_accents){const b=accent.transform;assert.ok(b.x>=w.x&&b.y>=w.y&&b.x+b.width<=w.x+w.width&&b.y+b.height<=w.y+w.height);}
 assert.deepEqual(s.entities.find(e=>e.id==='actor').states.idle.transform,box);
 const b=await compileSceneSetWorkspace('.',{production:a.production,write:false});assert.deepEqual(b.production,a.production);
});
test('explicit out-of-wall accents fail closed',async()=>{
 await assert.rejects(()=>compileSceneSetWorkspace('.',{production:production([{id:'scene-accent-sign',transform:{x:0,y:1100,width:500,height:190}}]),write:false}),/ACCENT_CONTAINMENT/);
});
test('backdrop cannot own physical support or actor slots',async()=>{
 const p=production([]);p.scenes[0].spatial_bindings=[{entity:'actor',anchor:'env__scene-set-cafe',relation:'on_surface'}];await assert.rejects(()=>compileSceneSetWorkspace('.',{production:p,write:false}),/BACKDROP_PHYSICAL_SUPPORT/);
 delete p.scenes[0].spatial_bindings;p.scenes[0].environment.frame={slots:[{entity:'env__scene-set-cafe'}]};await assert.rejects(()=>compileSceneSetWorkspace('.',{production:p,write:false}),/BACKDROP_ACTOR_FRAME_SLOT/);
});
test('every selectable accent has canonical source integrity',async()=>{
 const r=JSON.parse(await readFile(path.join(lib,'accents/index.json')));
 for(const a of r.accents)assert.equal(a.asset_sha256,createHash('sha256').update(await readFile(path.join(lib,a.path))).digest('hex'),a.id);
});
test('current native visual contract passes its own validator',()=>{
 const r=spawnSync(process.execPath,[path.join(skill,'references/asset-library-v4/contracts/validate-visual-intent.mjs')],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
test('scene-set defaults reserve foreground space at the top',async()=>{
 const r=JSON.parse(await readFile(path.join(lib,'index.json')));for(const s of r.scene_sets){assert.equal(s.transform.y,0);assert.ok(s.transform.height<=800);}
});
test('whole-scene and event preview SVG roots honor wrapper dimensions',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-svg-sizing-'));
 try{await mkdir(path.join(root,'assets'));await writeFile(path.join(root,'assets/a.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 900" width="1080" height="900"><path d="M0 0L20 20"/></svg>');
 const p=production([]);p.assets={ACTOR:{path:'assets/a.svg',category:'character'}};p.scenes[0].events=[{id:'tilt',target:'actor',state_before:'idle',state_after:'idle',motion:{preset:'subtle-tilt',duration_frames:9}}];await writeFile(path.join(root,'production.json'),JSON.stringify(p));
 const r=await buildNativePairs(root);for(const row of [...r.scene_frames,...r.pairs])for(const side of ['before','after'])assert.match(await readFile(path.join(root,'.authoring/preview-pairs',row[side]),'utf8'),/<svg preserveAspectRatio="none" style="display:block;width:100%;height:100%"/);
 }finally{await rm(root,{recursive:true,force:true});}
});
