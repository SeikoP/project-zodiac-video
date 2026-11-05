import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {sha256,cacheRoot,readCacheGraph,writeCacheGraph,propagateDirty} from './incremental-cache.mjs';

const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const hash=x=>sha256(JSON.stringify(canonical(x)));
const symbolic=e=>['narrative_visual','story_object','story_symbol','visual_metaphor'].includes(e.kind)||['narrative_visual','story_object'].includes(e.visual_role);
const assetsForEntity=(entity,assets)=>[...new Set(Object.values(entity.states??{}).map(s=>s.asset).filter(Boolean))].map(id=>[id,assets?.[id]??null]);
export function buildPhase02SemanticGraph(intent){
 const nodes={},sceneRefs=new Map(),assets=intent.assets??{};
 for(const c of intent.cast??[]){const id='asset:character:'+c.entity_id;nodes[id]={kind:'character',input_sha256:hash(c),dependencies:[]};}
 for(const scene of intent.scenes??[]){
  const intentId='intent:'+scene.id;const {entities:ignoredEntities,events:ignoredEvents,...sceneCore}=scene;nodes[intentId]={kind:'intent',input_sha256:hash(sceneCore),dependencies:[]};const deps=[intentId];
  for(const e of scene.entities??[]){
   if(e.kind==='character'){const id='asset:character:'+e.id;deps.push(id);if(!sceneRefs.has(id))sceneRefs.set(id,new Set());sceneRefs.get(id).add(scene.id);continue;}
   const category=symbolic(e)?'narrative_visual':e.visual_role==='interactive_prop'||e.kind==='prop'?'prop':e.kind==='scene_accent'?'scene_accent':'asset';
   const id='asset:'+category+':'+e.id;const refs=assetsForEntity(e,assets);nodes[id]={kind:category,input_sha256:hash({entity:e,assets:refs}),dependencies:[]};deps.push(id);
  }
  nodes['scene:'+scene.id]={kind:'scene',input_sha256:hash({id:scene.id,events:scene.events,layout_contract:scene.layout_contract,spatial_bindings:scene.spatial_bindings,occlusion_relations:scene.occlusion_relations}),dependencies:[...new Set(deps)]};
  nodes['preview:'+scene.id]={kind:'preview',input_sha256:hash({scene:scene.id,events:scene.events}),dependencies:['scene:'+scene.id]};
 }
 nodes['review:index']={kind:'review',input_sha256:hash((intent.scenes??[]).map(s=>s.id)),dependencies:(intent.scenes??[]).map(s=>'preview:'+s.id)};
 return {format:'zodiac-phase02-semantic-graph@1',source_sha256:hash(intent),nodes,scene_references:Object.fromEntries([...sceneRefs].map(([k,v])=>[k,[...v].sort()]))};
}
export function revisionGuidance(current,diff){
 const all=Object.keys(current?.nodes??{}),dirty=new Set((diff?.dirty??[]).filter(id=>current?.nodes?.[id]));
 const rebuild=all.filter(id=>dirty.has(id)).sort(),reuse=all.filter(id=>!dirty.has(id)).sort();
 const sceneIds=[...new Set(all.filter(id=>id.startsWith('scene:')).map(id=>id.slice(6)))].sort();
 const assetIds=all.filter(id=>id.startsWith('asset:')).sort();
 return {
  format:'zodiac-phase02-revision-guidance@1',
  nodes:{rebuild,reuse},
  scenes:{
   rebuild:sceneIds.filter(id=>dirty.has('scene:'+id)||dirty.has('preview:'+id)),
   reuse:sceneIds.filter(id=>!dirty.has('scene:'+id)&&!dirty.has('preview:'+id))
  },
  assets:{rebuild:assetIds.filter(id=>dirty.has(id)),reuse:assetIds.filter(id=>!dirty.has(id))},
  review_index_rebuild:dirty.has('review:index'),
  not_an_approval:true
 };
}
export function diffPhase02SemanticGraphs(previous,current){
 if(!previous)return {dirty:Object.keys(current.nodes),changed:Object.keys(current.nodes)};
 const changed=[];for(const [id,node] of Object.entries(current.nodes))if(previous.nodes?.[id]?.input_sha256!==node.input_sha256)changed.push(id);
 for(const id of Object.keys(previous.nodes??{}))if(!current.nodes[id])changed.push(id);
 const merged={...previous.nodes,...current.nodes};return {changed:[...new Set(changed)],dirty:propagateDirty(merged,[...new Set(changed)])};
}
export async function updatePhase02SemanticCache(workspace,intent){
 const dir=cacheRoot(workspace),file=path.join(dir,'phase02-semantic-graph.json');let previous=null;try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 const current=buildPhase02SemanticGraph(intent),diff=diffPhase02SemanticGraphs(previous,current);await mkdir(dir,{recursive:true});await writeFile(file,JSON.stringify(current,null,2)+'\n');
 const graph=await readCacheGraph(workspace);graph.semantic_graph_sha256=current.source_sha256;graph.semantic_dirty=diff.dirty;await writeCacheGraph(workspace,graph);
 return {...diff,current,previous};
}
