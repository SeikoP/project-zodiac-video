import {createHash} from 'node:crypto';

const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
const uniq=a=>[...new Set(a)];
const character=e=>e?.kind==='character'||e?.visual_role==='character';
const physical=e=>e?.kind==='prop'||e?.visual_role==='interactive_prop';
const narrative=e=>e?.kind==='narrative_visual'||e?.visual_role==='narrative_visual';
const story=e=>character(e)||physical(e)||narrative(e);

/** Build a deterministic read-only per-scene DAG from the canonical Visual Intent.
 * Dependency references are scene IDs only; cache fingerprints never include
 * authoring receipts, timestamps or user approvals.
 */
export function buildSceneGraph(intent,{catalogFingerprint='',compilerFingerprint=''}={}){
 const issues=[],scenes=intent?.scenes??[];
 if(!Array.isArray(scenes)||!scenes.length)issues.push({code:'SCENES_REQUIRED'});
 const ids=scenes.map(s=>s.id),idSet=new Set(ids);
 if(ids.some(id=>!nonempty(id))||idSet.size!==ids.length)issues.push({code:'SCENE_IDS_INVALID'});
 const allAssets=intent?.assets??{},cast=intent?.cast??[];
 const nodes=scenes.map((s,i)=>{
  const profile=s.experience_profile??{},focus=profile.story_focus??{};
  const refs=uniq((s.entities??[]).flatMap(e=>Object.values(e.states??{}).map(v=>v?.asset).filter(Boolean))).sort();
  const storyIds=(s.entities??[]).filter(story).map(e=>e.id);
  const depends=uniq([...(Array.isArray(profile.depends_on_scene_ids)?profile.depends_on_scene_ids:[]),...(Array.isArray(profile.callback_scene_ids)?profile.callback_scene_ids:[])]);
  const related=uniq([s.id,...depends]);
  for(const dep of depends)if(dep===s.id||!idSet.has(dep)||ids.indexOf(dep)>=i)issues.push({code:'SCENE_DEPENDENCY_INVALID',scene_id:s.id,dependency:dep});
  const missing=refs.filter(ref=>!Object.hasOwn(allAssets,ref));
  // Some current scenes use a baked/derived character identity not stored in intent.assets;
  // it is owned by Character Assembly, so do not treat a missing character asset as a defect here.
  const context={id:s.id,semantic_goal:s.semantic_goal,voice:s.voice??'',narration_range:s.narration_range,experience_profile:profile,grammar:s.grammar,entities:s.entities,events:s.events,director_beats:s.director_beats,art_direction:s.art_direction,scene_plan:(intent?.scene_plan?.scenes??[]).find(row=>row.id===s.id)??null,cast:cast.filter(c=>storyIds.includes(c.entity_id)),assets:Object.fromEntries(refs.filter(id=>Object.hasOwn(allAssets,id)).map(id=>[id,allAssets[id]])),catalogFingerprint,compilerFingerprint};
  return {scene_id:s.id,index:i,depends_on:depends,related_scene_ids:related,asset_ids:refs,character_ids:(s.entities??[]).filter(character).map(e=>e.id),story_entity_ids:storyIds,semantic_goal:s.semantic_goal??'',focus_entity_id:focus.focal_entity_id??null,source_fingerprint:hash(context),missing_assets:missing};
 });
 return {format:'zodiac-scene-graph@1',status:issues.length?'BLOCKED':'PASS',source_format:intent?.format??null,global_fingerprint:hash({narration_sha256:intent?.narration_sha256,cast,video:intent?.video,frames:intent?.frames,catalogFingerprint,compilerFingerprint}),nodes,issues,not_an_approval:true};
}

export function assessSceneRevision(previous,current){
 const old=new Map((previous?.nodes??[]).map(n=>[n.scene_id,n]));
 const dirty=new Set(),reasons={};
 for(const n of current?.nodes??[]){const before=old.get(n.scene_id),cause=!before?'NEW_SCENE':before.source_fingerprint!==n.source_fingerprint?'SCENE_INPUT_CHANGED':null;if(cause){dirty.add(n.scene_id);reasons[n.scene_id]=[cause];}}
 // Direct/callback successors are re-reviewed, not necessarily recompiled.
 let changed=true;while(changed){changed=false;for(const n of current?.nodes??[])if(!dirty.has(n.scene_id)&&n.depends_on.some(id=>dirty.has(id))){dirty.add(n.scene_id);reasons[n.scene_id]=['DEPENDENCY_CHANGED'];changed=true;}}
 return {format:'zodiac-scene-revision@1',rebuild:(current?.nodes??[]).filter(n=>dirty.has(n.scene_id)&&reasons[n.scene_id]?.[0]!=='DEPENDENCY_CHANGED').map(n=>n.scene_id),revalidate:(current?.nodes??[]).filter(n=>dirty.has(n.scene_id)).map(n=>n.scene_id),reuse:(current?.nodes??[]).filter(n=>!dirty.has(n.scene_id)).map(n=>n.scene_id),removed:[...old.keys()].filter(id=>!(current?.nodes??[]).some(n=>n.scene_id===id)),reasons,not_an_approval:true};
}
