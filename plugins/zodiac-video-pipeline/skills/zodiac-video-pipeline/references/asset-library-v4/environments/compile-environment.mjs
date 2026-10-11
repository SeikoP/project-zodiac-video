#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {hasPrimarySceneSet} from '../../../orchestration/scene-set-detection.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=m=>{throw new Error('ENVIRONMENT_COMPILE_INVALID: '+m);};
const clone=x=>JSON.parse(JSON.stringify(x));
const safeId=s=>String(s).replace(/[^A-Za-z0-9_-]+/gu,'_');
const assetId=id=>'ENV_'+safeId(id).toUpperCase().replaceAll('-','_');
const entityId=id=>'env__'+safeId(id);
const LAYOUT={
 'bedroom-window-curtain':{x:720,y:110,width:280,height:280,layer:2},
 'bedroom-headboard-bed-edge':{x:70,y:500,width:650,height:401,layer:4},
 'bedroom-desk-edge':{x:610,y:590,width:400,height:167,layer:5},
 'bedroom-pillow-edge':{x:0,y:1600,width:250,height:214,layer:36},
 'bedroom-blanket-edge':{x:650,y:1640,width:430,height:236,layer:35},
 'classroom-whiteboard':{x:90,y:300,width:520,height:322,layer:2},
 'classroom-window':{x:728,y:260,width:292,height:307,layer:1},
 'classroom-desk-edge':{x:140,y:610,width:800,height:240,layer:5},
 'hallway-lockers':{x:150,y:300,width:760,height:460,layer:2},
 'hallway-floor-edge':{x:115,y:1190,width:850,height:298,layer:5}
};
const SHOT_VARIANTS={
 'wide-environment':{rear:{dx:-28,dy:12,scale:1.08},grounding:{dx:0,dy:24,scale:1.04}},
 'medium-character':{rear:{dx:0,dy:0,scale:1},grounding:{dx:0,dy:0,scale:1}},
 'reaction-closeup':{rear:{dx:46,dy:-22,scale:.88},grounding:{dx:-28,dy:30,scale:.92}},
 'prop-insert':{rear:{dx:-34,dy:-8,scale:.92},grounding:{dx:30,dy:22,scale:.96}},
 'two-person':{rear:{dx:22,dy:0,scale:.95},grounding:{dx:-12,dy:18,scale:.98}},
 'over-shoulder':{rear:{dx:38,dy:-14,scale:.9},grounding:{dx:-22,dy:22,scale:.94}},
 'foreground-peek':{rear:{dx:-38,dy:-10,scale:.9},grounding:{dx:24,dy:24,scale:.94}},
 'caption-led':{rear:{dx:54,dy:-28,scale:.85},grounding:{dx:-34,dy:38,scale:.9}}
};
const clamp=(n,min,max)=>Math.max(min,Math.min(n,max));
const placementFor=(id,role,scene,sceneIndex)=>{const base=clone(LAYOUT[id]??(role==='rear'?{x:700,y:120,width:280,height:280,layer:2}:role==='front'?{x:0,y:1600,width:260,height:220,layer:35}:{x:80,y:520,width:520,height:320,layer:5}));const shot=scene?.scene_direction?.shot??'medium-character',v=SHOT_VARIANTS[shot]?.[role]??{dx:0,dy:0,scale:1};const placement=scene?.scene_direction?.subject_placement;const sideBias=role==='front'?0:placement==='left'?24:placement==='right'?-24:0;const continuityBias=role==='front'?0:((sceneIndex%3)-1)*10;const width=Math.round(base.width*(v.scale??1)),height=Math.round(base.height*(v.scale??1));let x=clamp(Math.round(base.x+(v.dx??0)+sideBias+continuityBias),0,1080-width),y=clamp(Math.round(base.y+(v.dy??0)),0,1920-height);if(role==='front')y=Math.max(1580,y);return {...base,x,y,width,height};};
const cueMap=index=>new Map((index.structural_assets??[]).map(x=>[x.id,x]));
const profileMap=index=>new Map((index.profiles??[]).map(x=>[x.id,x]));
// Story props belong to the authoring layer, never to automatic background decoration.
// Only ambient architecture (wall/window/floor etc.) may be materialized by default.
const FURNITURE_CUE=/(?:^|[-_])(?:desk|table|bed|headboard|pillow|blanket|sofa|chair|counter|cabinet|bookshelf)(?:[-_]|$)/iu;
export const isBackgroundCue=id=>!FURNITURE_CUE.test(String(id));
export const backgroundOnlyRoles=roles=>Object.fromEntries(Object.entries(roles).map(([role,ids])=>[role,ids.filter(isBackgroundCue)]));
const selectedCues=(index,env)=>{const profiles=profileMap(index),cues=cueMap(index),profile=profiles.get(env?.profile);if(!profile)fail('unknown environment profile '+env?.profile);const modifierId=env.modifier??profile.default_modifier,modifier=profile.modifiers?.[modifierId];if(!modifier)fail(`unknown environment modifier ${modifierId}`);const roles={rear:[...(profile.structural_roles?.rear??[])],grounding:[...(profile.structural_roles?.grounding??[])],front:[...(profile.structural_roles?.front??[]),...(modifier.foreground_assets??[])]};for(const [role,ids] of Object.entries(roles))for(const id of ids){const cue=cues.get(id);if(!cue)fail('unknown structural cue '+id);if(cue.role!==role&&!(role==='front'&&cue.role==='front'))fail(`${id} role mismatch ${cue.role}/${role}`);}return {profile,modifierId,modifier,roles:backgroundOnlyRoles(roles)};};
export function materializeEnvironment(production,index){if(production?.version!=='2.0')fail('production.version must be 2.0');const out=clone(production),knownCueIds=new Set((index.structural_assets??[]).map(x=>x.id));for(const [sceneIndex,scene] of (out.scenes??[]).entries()){if(scene.environment?.mode==='archive_frame'||hasPrimarySceneSet(scene,out))continue;scene.entities=(scene.entities??[]).filter(e=>!String(e.id??'').startsWith('env__'));if(!scene.environment?.profile)continue;const sel=selectedCues(index,scene.environment);scene.environment={...scene.environment,mode:'micro_environment',profile:sel.profile.id,modifier:sel.modifierId,roles:{rear:[],grounding:[],front:[]}};for(const [role,ids] of Object.entries(sel.roles)){for(const id of ids){const eid=entityId(id),aid=assetId(id),t=placementFor(id,role,scene,sceneIndex);scene.environment.roles[role].push(eid);const visualRole=role==='front'?'foreground_environment':'background';const previous=(production.scenes[sceneIndex].entities??[]).find(e=>e.id===eid);if(previous?.visual_role&&previous.visual_role!==visualRole)fail('ROLE_CONFLICT '+eid);scene.entities.push({id:eid,kind:'object',visual_role:visualRole,initial_state:'visible',states:{visible:{asset:aid,transform:{x:t.x,y:t.y,width:t.width,height:t.height},layer:t.layer,visible:true}}});}}}return out;}
export async function compileEnvironmentWorkspace(root,{libraryRoot=here,write=true}={}){const productionPath=path.join(root,'production.json'),index=JSON.parse(await readFile(path.join(libraryRoot,'composition-index.json'),'utf8')),source=JSON.parse(await readFile(productionPath,'utf8')),out=materializeEnvironment(source,index),cues=cueMap(index);out.assets=out.assets??{};const used=new Set();for(const scene of out.scenes??[])if(scene.environment?.mode!=='archive_frame'&&!hasPrimarySceneSet(scene,out))for(const ids of Object.values(scene.environment?.roles??{}))for(const eid of ids){const id=String(eid).replace(/^env__/u,'');used.add(id);}for(const id of used){const cue=cues.get(id);if(!cue)fail('missing cue '+id);const rel='assets/environment/'+id+'.svg',src=path.join(libraryRoot,cue.path),svg=await readFile(src,'utf8');await mkdir(path.join(root,'assets/environment'),{recursive:true});if(write)await writeFile(path.join(root,rel),svg);out.assets[assetId(id)]={path:rel,category:'environment',style_id:'zodiac-paper-doodle-meme-v4',lineage:{mode:'direct_copy',source_library:'zodiac-visual-grammar-v4',source_master:id,semantic_intent:`ambient ${cue.role} background cue`}};}
 const scenes=(out.scenes??[]).filter(s=>s.environment?.profile&&s.environment?.mode!=='archive_frame'&&!hasPrimarySceneSet(s,out)).map(s=>({scene_id:s.id,profile:s.environment.profile,modifier:s.environment.modifier,roles:s.environment.roles}));const signature=createHash('sha256').update(JSON.stringify(scenes)).digest('hex');const receipt={format:'zodiac-environment-compile-receipt@1',scenes,signature};if(write){await writeFile(productionPath,JSON.stringify(out,null,2)+'\n');await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/environment-compile-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}return {production:out,receipt};}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(direct){if(process.argv.includes('--write')&&!process.argv.includes('--transaction-stage')){const {runGeneratedCompile}=await import('../../../orchestration/generated-asset-ownership.mjs');const result=await runGeneratedCompile(path.resolve(process.argv[2]),fileURLToPath(import.meta.url),process.argv.slice(2),{compiler_id:'environment',prune:process.argv.includes('--prune-generated')});process.stdout.write(result.stdout??'');process.exit(0);}const root=process.argv[2];if(!root){console.error('Usage: node compile-environment.mjs <package-root> [--library-root <dir>] --write');process.exit(2);}const li=process.argv.indexOf('--library-root'),libraryRoot=li>=0?process.argv[li+1]:here;const r=await compileEnvironmentWorkspace(path.resolve(root),{libraryRoot:path.resolve(libraryRoot),write:process.argv.includes('--write')});if(process.argv.includes('--write'))console.log(`ENVIRONMENT_COMPILE_PASS: scenes=${r.receipt.scenes.length} signature=${r.receipt.signature.slice(0,12)}`);else console.log(JSON.stringify(r,null,2));}
