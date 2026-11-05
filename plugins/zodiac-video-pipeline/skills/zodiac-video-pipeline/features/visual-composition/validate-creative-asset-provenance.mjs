#!/usr/bin/env node
// Editorial-source provenance gate for fresh, scene-authored Narrative Visuals.
// This cannot judge artistic quality and never grants Visual Review approval.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const hash=s=>createHash('sha256').update(s).digest('hex');
const meaningful=s=>typeof s==='string'&&s.trim().length>=12;
const entry=(code,scene_id,entity_id,detail)=>({code,scene_id,entity_id,detail});
export function validateCreativeProvenance(intent,svgByAsset={}){
 const issues=[];const seenByHash=new Map();
 if(intent?.taxonomy_version!=='narrative_visual@1')return {status:'NOT_APPLICABLE',issues,review_required:false};
 for(const scene of intent.scenes??[]){
  const voice=String(scene.voice??scene.narration_text??'');
  const visuals=(scene.entities??[]).filter(x=>x.kind==='narrative_visual');
  if(!visuals.length)continue;
  const narrativeBrief=scene.art_direction?.narrative_brief??{};
  if(!meaningful(narrativeBrief.claim))issues.push(entry('CREATIVE_SCENE_CLAIM_REQUIRED',scene.id,null,'No clear viewer takeaway'));
  for(const entity of visuals){
   const states=Object.entries(entity.states??{}).filter(([,s])=>s?.asset&&s.visible!==false);
   if(!states.length){issues.push(entry('CREATIVE_VISIBLE_STATE_REQUIRED',scene.id,entity.id,'At least one visible visual state is needed'));continue;}
   for(const [stateId,state] of states){
    const asset=intent.assets?.[state.asset],origin=asset?.creative_origin;
    if(!asset){issues.push(entry('CREATIVE_ASSET_MISSING',scene.id,entity.id,state.asset));continue;}
    if(!origin||origin.mode!=='scene_authored'){
     issues.push(entry('CREATIVE_ORIGIN_REQUIRED',scene.id,entity.id,`State ${stateId} must use a scene-authored Narrative Visual`));continue;
    }
    if(origin.scene_id!==scene.id)issues.push(entry('CREATIVE_SCENE_OWNER_MISMATCH',scene.id,entity.id,state.asset));
    if(!meaningful(origin.claim)||!meaningful(origin.selection_reason))issues.push(entry('CREATIVE_SEMANTIC_RATIONALE_REQUIRED',scene.id,entity.id,state.asset));
    const concepts=origin.concept_candidates??{};
    if(!['literal','metaphor','exaggeration'].every(k=>meaningful(concepts[k]))||!['literal','metaphor','exaggeration'].includes(origin.selected_concept))
     issues.push(entry('CREATIVE_CONCEPT_LADDER_REQUIRED',scene.id,entity.id,state.asset));
    const anchor=String(origin.anchor_phrase??'').trim();
    if(!anchor||(!voice.includes(anchor)&&!String(scene.narration_range_text??'').includes(anchor)))
     issues.push(entry('CREATIVE_VOICE_ANCHOR_REQUIRED',scene.id,entity.id,anchor));
    const svg=svgByAsset[state.asset];
    if(typeof svg!=='string'||!svg.trim()){issues.push(entry('CREATIVE_SVG_MISSING',scene.id,entity.id,state.asset));continue;}
    if(/<\s*(?:text|script|image|foreignObject|filter|animate\w*|use)\b/i.test(svg)||!/viewBox\s*=/.test(svg))
     issues.push(entry('CREATIVE_SVG_UNSAFE',scene.id,entity.id,state.asset));
    const digest=hash(svg.replace(/<metadata>[\s\S]*?<\/metadata>/g,'').replace(/\s+/g,' '));
    const prior=seenByHash.get(digest);
    if(prior&&prior.scene_id!==scene.id){
      if(!meaningful(origin.intentional_reuse_reason))issues.push(entry('CREATIVE_STOCK_REUSE_REQUIRES_REVIEW',scene.id,entity.id,`identical art as ${prior.scene_id}/${prior.entity_id}`));
    }else if(!prior)seenByHash.set(digest,{scene_id:scene.id,entity_id:entity.id});
   }
  }
 }
 return {format:'zodiac-creative-provenance@1',status:issues.length?'BLOCKED':'PASS',issues,review_required:issues.some(x=>x.code==='CREATIVE_STOCK_REUSE_REQUIRES_REVIEW'),not_an_approval:true};
}
export async function validateCreativeWorkspace(root){
 const workspace=path.resolve(root);const intent=JSON.parse(await readFile(path.join(workspace,'.authoring/visual-intent.json'),'utf8'));
 // The authoritative scene voice in Visual Intent is stored as UTF-8 narration_range.
 // Do not mistake a missing denormalized scene.voice for a missing anchor.
 const narration=await readFile(path.join(workspace,'narration.txt'));
 for(const scene of intent.scenes??[]){
  if(typeof scene.voice==='string')continue;
  const [start,end]=scene.narration_range??[];
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>narration.length)throw Error('CREATIVE_NARRATION_RANGE_INVALID '+scene.id);
  scene.voice=narration.subarray(start,end).toString('utf8');
 }
 const assetIds=new Set((intent.scenes??[]).flatMap(s=>(s.entities??[]).filter(e=>e.kind==='narrative_visual').flatMap(e=>Object.values(e.states??{}).map(st=>st?.asset).filter(Boolean))));
 const svgByAsset={};const issues=[];
 for(const id of assetIds){const rel=intent.assets?.[id]?.path;
  if(typeof rel!=='string'||!rel.endsWith('.svg')){issues.push(entry('CREATIVE_ASSET_PATH_INVALID',null,id,String(rel)));continue;}
  const full=path.resolve(workspace,rel);if(!full.startsWith(workspace+path.sep)){issues.push(entry('CREATIVE_ASSET_PATH_TRAVERSAL',null,id,rel));continue;}
  try{svgByAsset[id]=await readFile(full,'utf8')}catch(e){issues.push(entry('CREATIVE_SVG_MISSING',null,id,e.code??e.message));}
 }
 const result=validateCreativeProvenance(intent,svgByAsset);
 return {...result,status:(issues.length||result.issues.length)?'BLOCKED':result.status,issues:[...issues,...result.issues]};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-creative-asset-provenance.mjs <workspace>');process.exit(2)}
 try{const result=await validateCreativeWorkspace(root);console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=2;}catch(e){console.error('CREATIVE_PROVENANCE_BLOCKED '+e.message);process.exitCode=2;}}
