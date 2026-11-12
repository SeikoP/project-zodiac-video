#!/usr/bin/env node
// Fresh Narrative Visual provenance gate: every authored image must execute one concrete Phase-1 direction.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const hash=s=>createHash('sha256').update(s).digest('hex');
const meaningful=s=>typeof s==='string'&&s.trim().length>=8;
const entry=(code,scene_id,entity_id,detail)=>({code,scene_id,entity_id,detail});
const normalize=s=>String(s??'').trim();

export function validateCreativeProvenance(intent,svgByAsset={},phase1Visuals=[]){
 const issues=[],seenByHash=new Map();
 if(intent?.taxonomy_version!=='narrative_visual@1')return {status:'NOT_APPLICABLE',issues,review_required:false};
 const directions=new Map((phase1Visuals??[]).map(v=>[v.id,v]));
 for(const scene of intent.scenes??[]){
  const voice=String(scene.voice??scene.narration_text??'');
  const visuals=(scene.entities??[]).filter(x=>x.kind==='narrative_visual');
  if(!visuals.length)continue;
  if(visuals.length>1)issues.push(entry('CREATIVE_NARRATIVE_VISUAL_DENSITY',scene.id,null,String(visuals.length)));
  const brief=scene.art_direction?.narrative_brief??{};
  if(!meaningful(brief.story_point)||!meaningful(brief.viewer_read))issues.push(entry('CREATIVE_SCENE_MEANING_REQUIRED',scene.id,null,'Narrative Visual needs concrete story_point and viewer_read'));
  for(const entity of visuals){
   const states=Object.entries(entity.states??{}).filter(([,s])=>s?.asset&&s.visible!==false);
   if(!states.length){issues.push(entry('CREATIVE_VISIBLE_STATE_REQUIRED',scene.id,entity.id,'At least one visible Narrative Visual state is needed'));continue;}
   for(const [stateId,state] of states){
    const asset=intent.assets?.[state.asset],origin=asset?.creative_origin;
    if(!asset){issues.push(entry('CREATIVE_ASSET_MISSING',scene.id,entity.id,state.asset));continue;}
    if(!origin||origin.mode!=='phase1_directed'||!normalize(origin.phase1_visual_id)){
     issues.push(entry('CREATIVE_PHASE1_DIRECTION_REQUIRED',scene.id,entity.id,state.asset));
     continue;
    }
    if(origin.scene_id!==scene.id)issues.push(entry('CREATIVE_SCENE_OWNER_MISMATCH',scene.id,entity.id,state.asset));
    const direction=directions.get(origin.phase1_visual_id);
    if(!direction)issues.push(entry('CREATIVE_PHASE1_DIRECTION_UNKNOWN',scene.id,entity.id,origin.phase1_visual_id));
    else{
     const beatIds=new Set((scene.director_beats??[]).map(b=>b.beat_id));
     if(!(direction.beat_ids??[]).some(id=>beatIds.has(id)))issues.push(entry('CREATIVE_PHASE1_BEAT_MISMATCH',scene.id,entity.id,origin.phase1_visual_id));
     if(normalize(brief.phase1_visual_id)!==normalize(direction.id))issues.push(entry('CREATIVE_PHASE1_BRIEF_LINK_MISMATCH',scene.id,entity.id,origin.phase1_visual_id));
     if(normalize(brief.story_point)!==normalize(direction.story_point)||normalize(brief.viewer_read)!==normalize(direction.viewer_read))
      issues.push(entry('CREATIVE_PHASE1_MEANING_DRIFT',scene.id,entity.id,origin.phase1_visual_id));
     for(const key of ['visible_subject','visible_action','visual_idea','centrality_reason','why_visual_not_text','tone_fit'])
      if(!meaningful(direction[key]))issues.push(entry('CREATIVE_PHASE1_DIRECTION_INCOMPLETE',scene.id,entity.id,key));
    }
    const anchor=normalize(origin.anchor_phrase);
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
 return {format:'zodiac-creative-provenance@2',status:issues.length?'BLOCKED':'PASS',issues,review_required:issues.some(x=>x.code==='CREATIVE_STOCK_REUSE_REQUIRES_REVIEW'),not_an_approval:true};
}

export async function validateCreativeWorkspace(root){
 const workspace=path.resolve(root);
 const [intent,plan]=await Promise.all([
  readFile(path.join(workspace,'.authoring/visual-intent.json'),'utf8').then(JSON.parse),
  readFile(path.join(workspace,'.authoring/narrative-plan.json'),'utf8').then(JSON.parse).catch(()=>({}))
 ]);
 const narration=await readFile(path.join(workspace,'narration.txt'));
 for(const scene of intent.scenes??[]){
  if(typeof scene.voice==='string')continue;
  const [start,end]=scene.narration_range??[];
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<=start||end>narration.length)throw Error('CREATIVE_NARRATION_RANGE_INVALID '+scene.id);
  scene.voice=narration.subarray(start,end).toString('utf8');
 }
 const assetIds=new Set((intent.scenes??[]).flatMap(s=>(s.entities??[]).filter(e=>e.kind==='narrative_visual').flatMap(e=>Object.values(e.states??{}).map(st=>st?.asset).filter(Boolean))));
 const svgByAsset={},issues=[];
 for(const id of assetIds){
  const rel=intent.assets?.[id]?.path;
  if(typeof rel!=='string'||!rel.endsWith('.svg')){issues.push(entry('CREATIVE_ASSET_PATH_INVALID',null,id,String(rel)));continue;}
  const full=path.resolve(workspace,rel);
  if(!full.startsWith(workspace+path.sep)){issues.push(entry('CREATIVE_ASSET_PATH_TRAVERSAL',null,id,rel));continue;}
  try{svgByAsset[id]=await readFile(full,'utf8')}catch(e){issues.push(entry('CREATIVE_SVG_MISSING',null,id,e.code??e.message));}
 }
 const result=validateCreativeProvenance(intent,svgByAsset,plan.narrative_visuals??[]);
 return {...result,status:(issues.length||result.issues.length)?'BLOCKED':result.status,issues:[...issues,...result.issues]};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2];
 if(!root){console.error('Usage: node validate-creative-asset-provenance.mjs <workspace>');process.exit(2)}
 try{const result=await validateCreativeWorkspace(root);console.log(JSON.stringify(result,null,2));if(result.status==='BLOCKED')process.exitCode=2;}
 catch(e){console.error('CREATIVE_PROVENANCE_BLOCKED '+e.message);process.exitCode=2;}
}
