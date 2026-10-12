import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';
import {compositionHash} from './phase02-composition.mjs';
import {partitionNarration} from './voice-source-ranges.mjs';
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(canonical(x))).digest('hex');
const clone=x=>structuredClone(x);
const runtimeRole=role=>({story_object:'interactive_prop',scene_set:'background',scene_accent:'effect'}[role]??role);
const projectEntity=({narrative_intent,ownership,...e})=>({...e,kind:['story_object','scene_set','scene_accent'].includes(e.kind)?'object':e.kind,visual_role:runtimeRole(e.visual_role)});
const projectAssets=assets=>Object.fromEntries(Object.entries(clone(assets)).map(([id,a])=>[id,{...a,category:a.category==='story_object'?'prop':['scene_set','scene_accent'].includes(a.category)?'environment':a.category}]));const fail=m=>{throw Error('VISUAL_INTENT_'+m)};
export const projectionPaths={production:'production.json',character_assembly:'.authoring/character-assembly-plan.json',visual_grammar_plan:'visual-grammar-plan.json',asset_plan:'asset-plan.json',director_plan:'.authoring/director-plan.json',art_direction:'.authoring/scene-art-direction.json',episode_cast_plan:'.authoring/episode-cast-plan.json',story_object_plan:'.authoring/story-object-plan.json'};
export function compileVisualIntent(intent,{narration,token,catalog}={}){
 if(intent?.format!=='zodiac-visual-intent@1')fail('FORMAT');if(intent.narration_sha256!==hash(narration))fail('NARRATION_STALE');
 if(intent.cast?.length&&!intent.episode_cast_plan)fail('EPISODE_CAST_PLAN_REQUIRED');
 if(intent.story_object_decision?.mode==='required'&&!intent.story_object_plan)fail('OBJECT_PLAN_REQUIRED');
 if(!Array.isArray(intent.scenes)||!intent.scenes.length||!Array.isArray(intent.cast)||!intent.assets||!intent.video)fail('INCOMPLETE');
 const decision=intent.story_object_decision;if(!decision||!['required','optional','omitted'].includes(decision.mode)||!decision.reason?.trim()||!decision.review_ref?.trim())fail('OBJECT_DECISION');
 for(const s of intent.scenes){if(s.frame_ref){const ref=intent.frames.find(f=>f.asset_id===s.frame_ref.asset_id);if(!ref||hash(ref)!==hash(s.frame_ref))fail('FRAME_REFERENCE');}}
 const bytes=Buffer.from(narration),ids=new Set();partitionNarration(bytes,intent.scenes.map(s=>s.narration_range));let end=0;
 const scenes=intent.scenes.map(s=>{if(!s.id||ids.has(s.id)||!s.semantic_goal?.trim()||!s.grammar||!Array.isArray(s.entities)||!Array.isArray(s.events))fail('SCENE_INCOMPLETE');ids.add(s.id);
 const [start,stop]=s.narration_range??[];if(!Number.isInteger(start)||!Number.isInteger(stop)||start!==end||stop<=start||stop>bytes.length)fail('NARRATION_RANGE');const voice=bytes.subarray(start,stop).toString('utf8');if(!Buffer.from(voice).equals(bytes.subarray(start,stop)))fail('NARRATION_CODEPOINT');end=stop;
 const {narration_range,semantic_goal,grammar,director_beats,semantic_asset_decisions,...native}=clone(s);return {...native,entities:native.entities.map(projectEntity),voice};});
 if(end!==bytes.length)fail('NARRATION_COVERAGE');
 const result={production:{version:'2.0',voice_partition:'utf8_ranges',video:clone(intent.video),visual_system:clone(intent.visual_system??{}),assets:projectAssets(intent.assets),scenes},character_assembly:{format:'zodiac-character-assembly-plan@2',characters:clone(intent.cast)},visual_grammar_plan:{format:'zodiac-visual-grammar-plan@1',scenes:intent.scenes.map(s=>({scene_id:s.id,...clone(s.grammar)}))},asset_plan:{semantic_asset_fit:{format:'zodiac-semantic-asset-plan@1',decisions:intent.scenes.flatMap(s=>clone(s.semantic_asset_decisions??[]))}},director_plan:{format:'zodiac-director-plan@1',narration_sha256:intent.narration_sha256,beats:intent.scenes.flatMap(s=>clone(s.director_beats??[]))},art_direction:{format:'zodiac-scene-art-direction@2',composition_stage:'intent',...(token?{design_token_sha256:compositionHash(token)}:{}),scenes:intent.scenes.map((s,index)=>({id:s.id,voice:scenes[index].voice,semantic_goal:s.semantic_goal,...clone(s.art_direction??{}),components:s.entities.map(e=>({id:e.id,...clone(e.narrative_intent??{}),visual_role:runtimeRole(e.visual_role),initial_state:e.initial_state,states:Object.fromEntries(Object.entries(e.states).map(([id,st])=>[id,{visible:st.visible,layer:st.layer}])),ownership:e.ownership??{kind:'authored'}})),layout_contract:clone(s.layout_contract??null),occlusion_relations:clone(s.occlusion_relations??[]),spatial_bindings:clone(s.spatial_bindings??[])}))},episode_cast_plan:clone(intent.episode_cast_plan??{characters:intent.cast.map(c=>({entity_id:c.entity_id}))}),story_object_plan:intent.story_object_plan?clone(intent.story_object_plan):null};
 result.receipt={format:'zodiac-visual-intent-projection@1',owner:'visual-intent',source_sha256:hash(intent),narration_sha256:intent.narration_sha256,projection_hashes:Object.fromEntries(Object.entries(result).map(([k,v])=>[k,hash(v)]))};return result;
}
export function verifyIntentProjections(outputs,receipt){const issues=Object.entries(receipt.projection_hashes).filter(([k,h])=>hash(outputs[k])!==h).map(([path])=>({code:'VISUAL_INTENT_PROJECTION_DRIFT',path}));return {status:issues.length?'BLOCKED':'PASS',issues};}
export async function verifyIntentWorkspace(root,{revalidateNativeOutput=false}={}){const intentPath=path.join(root,'.authoring/visual-intent.json');let raw;try{raw=await readFile(intentPath,'utf8')}catch(e){if(e.code==='ENOENT')return {status:'LEGACY'};throw e;}
 const receipt=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent-projection-receipt.json'),'utf8'));const intent=JSON.parse(raw);if(hash(intent)!==receipt.source_sha256||hash(await readFile(path.join(root,'narration.txt')))!==receipt.narration_sha256)fail('SOURCE_DRIFT');
 const outputs={};for(const [k,rel]of Object.entries(projectionPaths)){outputs[k]=await readFile(path.join(root,rel),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT'&&receipt.projection_hashes[k]===hash(null))return null;throw e;});}
 // Production is a mutable native compiler output after its first compile; its drift is checked by native-source-fingerprint.
 const check={...receipt,projection_hashes:{...receipt.projection_hashes}};try{const execution=JSON.parse(await readFile(path.join(root,'.authoring/phase02-execution-receipt.json')));if(execution.mode==='run'&&execution.compiled_production_sha256===hash(await readFile(path.join(root,'production.json')))&&execution.projection_source_sha256===receipt.source_sha256)delete check.projection_hashes.production;}catch(e){if(e.code!=='ENOENT')throw e;}
 if(revalidateNativeOutput){
  const execution=JSON.parse(await readFile(path.join(root,'.authoring/phase02-execution-receipt.json'))),state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json')));
  if(execution.mode!=='run'||execution.status!=='NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED'||execution.projection_source_sha256!==receipt.source_sha256||!['visual_compile','assets','publish_prep'].every(id=>state.phases?.['02-visual-production']?.steps?.[id]?.status==='PASS'))fail('FINALIZATION_REQUIRES_COMPLETED_NATIVE_MANIFEST');
  // Entry for a forced native revalidation only. Normal seals still require the executed final hash.
  delete check.projection_hashes.production;
 }
 const verdict=verifyIntentProjections(outputs,check);if(verdict.status==='BLOCKED')fail('PROJECTION_DRIFT '+JSON.stringify(verdict.issues));return revalidateNativeOutput?{status:'REVALIDATION_REQUIRED',issues:[]}:verdict;
}
