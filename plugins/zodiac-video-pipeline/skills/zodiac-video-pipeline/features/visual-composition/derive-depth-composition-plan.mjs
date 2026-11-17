#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const catalogPath=path.resolve(here,'../../references/depth-catalog.json');
const sha=x=>createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');

function paletteFor(scene,catalog){
 const hint=String(scene.environment?.background_palette_id??scene.grammar?.environment?.background_palette_id??'').toLowerCase();
 const candidate=hint.includes('graphite')||hint.includes('cool')||hint.includes('mint')?'cool-reflective':
  hint.includes('coral')||hint.includes('blush')||hint.includes('warm')||hint.includes('sand')?'warm-emotional':
  hint.includes('comic')||hint.includes('pop')?'comic-pop':
  hint.includes('dark')||hint.includes('night')?'dark-tension':'bright-clean';
 return catalog.palettes?.[candidate]?candidate:Object.keys(catalog.palettes??{})[0];
}

function purposeOf(scene){
 return scene.director_beats?.find(b=>b?.semantic_purpose)?.semantic_purpose??scene.director_beats?.[0]?.semantic_purpose??null;
}

function depthSpec(scene,catalog){
 const mode=scene.experience_profile?.story_mode??'general',purpose=purposeOf(scene),sparse=Boolean(String(scene.experience_profile?.sparse_reason??'').trim());
 let profile='relationship-space',layers=['rear','front'];
 if(purpose==='payoff'||mode==='payoff'){profile='spotlight-payoff';layers=['rear','front'];}
 else if(mode==='reflection'){profile='split-thought';layers=sparse?['rear']:['rear','divider'];}
 else if(['distance','contrast','barrier','subtext'].includes(purpose)){profile='split-thought';layers=['rear','divider','front'];}
 else if(mode==='transition'){profile='relationship-space';layers=['rear'];}
 if(!catalog.profiles?.[profile])throw new Error('DEPTH_PROFILE_UNAVAILABLE '+profile);
 const palette=paletteFor(scene,catalog);
 return {
  scene_id:scene.id,
  profile,palette,layers,
  rationale:`Derived canvas depth for ${mode}/${purpose??'general'} without introducing a literal room or containing the actors.`
 };
}

export function deriveDepthPlan(intent,catalog){
 if(!intent||!Array.isArray(intent.scenes))throw new Error('DEPTH_INTENT_INVALID');
 const scenes=[];
 for(const scene of intent.scenes){
  if(!scene?.id)throw new Error('DEPTH_SCENE_ID_REQUIRED');
  if(scene.environment?.scene_set_id||scene.environment?.scene_set?.id)continue;
  scenes.push(depthSpec(scene,catalog));
 }
 return {
  format:'zodiac-depth-composition-plan@1',
  source:'derived-from-visual-intent',
  source_sha256:sha(intent),
  scenes,
  not_an_approval:true
 };
}

export async function deriveDepthPlanWorkspace(root,{write=false}={}){
 const intentRaw=await readFile(path.join(root,'.authoring/visual-intent.json'),'utf8');
 const [intent,catalog]=await Promise.all([Promise.resolve(JSON.parse(intentRaw)),readFile(catalogPath,'utf8').then(JSON.parse)]);
 const plan=deriveDepthPlan(intent,catalog);
 const receipt={format:'zodiac-depth-plan-derive@1',source_sha256:sha(intentRaw),plan_sha256:sha(plan),scene_count:plan.scenes.length,not_an_approval:true};
 if(write){
  const auth=path.join(root,'.authoring');await mkdir(auth,{recursive:true});
  await writeFile(path.join(auth,'depth-composition-plan.json'),JSON.stringify(plan,null,2)+'\n');
  await writeFile(path.join(auth,'depth-plan-derive-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
 }
 return {plan,receipt};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];
 if(!root){console.error('Usage: node derive-depth-composition-plan.mjs <workspace> --write');process.exitCode=2;}
 else try{const r=await deriveDepthPlanWorkspace(path.resolve(root),{write:process.argv.includes('--write')});console.log(JSON.stringify({status:'DEPTH_PLAN_DERIVED',...r.receipt},null,2));}
 catch(e){console.error(e.message);process.exitCode=2;}
}
