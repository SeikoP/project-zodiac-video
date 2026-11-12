#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const meaningful=(value,min=12)=>typeof value==='string'&&value.trim().length>=min;
const issue=(issues,code,detail={})=>issues.push({code,...detail});

export function validateNarrativeVisualDirection(plan,{selectedCandidate=null}={}){
 const issues=[];
 if(!plan||!['2.0','2.1'].includes(plan.version))issue(issues,'NARRATIVE_VISUAL_PLAN_VERSION');
 const visuals=Array.isArray(plan?.narrative_visuals)?plan.narrative_visuals:[];
 if(!visuals.length)return {format:'zodiac-narrative-visual-direction-qc@2',status:'PASS',visuals:0,issues,not_an_approval:true};
 if(selectedCandidate&&selectedCandidate.id!==plan?.selected_concept_id)issue(issues,'NARRATIVE_VISUAL_CONCEPT_LINEAGE');
 const beats=new Map((plan.beats??[]).map(beat=>[beat.id,beat]));
 const allowedEvidence=new Set([
  ...(selectedCandidate?.evidence_refs??[]),
  ...(plan.beats??[]).flatMap(beat=>beat.evidence_refs??[])
 ]);
 const ids=new Set(),claimedBeats=new Map();
 for(const visual of visuals){
  const at=String(visual?.id??'unknown');
  if(!meaningful(visual?.id,2)||ids.has(visual.id))issue(issues,'NARRATIVE_VISUAL_ID_INVALID',{at});
  ids.add(visual?.id);
  for(const key of ['trait_basis','story_point','viewer_read','visible_action','visual_idea','concept_fit','centrality_reason','why_visual_not_text','tone_fit'])
   if(!meaningful(visual?.[key]))issue(issues,'NARRATIVE_VISUAL_FIELD_REQUIRED',{at,field:key});
  if(typeof visual?.visible_subject!=='string'||visual.visible_subject.trim().length<3)issue(issues,'NARRATIVE_VISUAL_FIELD_REQUIRED',{at,field:'visible_subject'});
  if(visual?.payoff_image!=null&&!meaningful(visual.payoff_image))issue(issues,'NARRATIVE_VISUAL_PAYOFF_INVALID',{at});
  if(!Array.isArray(visual?.beat_ids)||!visual.beat_ids.length)issue(issues,'NARRATIVE_VISUAL_BEATS_REQUIRED',{at});
  else for(const beatId of visual.beat_ids){
   if(!beats.has(beatId))issue(issues,'NARRATIVE_VISUAL_BEAT_UNKNOWN',{at,beat_id:beatId});
   const prior=claimedBeats.get(beatId);
   if(prior&&prior!==visual.id)issue(issues,'NARRATIVE_VISUAL_BEAT_OVERLAP',{at,beat_id:beatId,prior_visual_id:prior});
   else claimedBeats.set(beatId,visual.id);
  }
  if(!Array.isArray(visual?.evidence_refs)||!visual.evidence_refs.length)issue(issues,'NARRATIVE_VISUAL_EVIDENCE_REQUIRED',{at});
  else for(const ref of visual.evidence_refs)if(allowedEvidence.size&&!allowedEvidence.has(ref))issue(issues,'NARRATIVE_VISUAL_EVIDENCE_UNKNOWN',{at,evidence_ref:ref});
 }
 return {format:'zodiac-narrative-visual-direction-qc@2',status:issues.length?'BLOCKED':'PASS',visuals:visuals.length,issues,not_an_approval:true};
}

export async function validateNarrativeVisualDirectionWorkspace(root){
 const base=path.resolve(root);
 const plan=JSON.parse(await readFile(path.join(base,'.authoring','narrative-plan.json'),'utf8'));
 const candidates=JSON.parse(await readFile(path.join(base,'.authoring','concept-candidates.json'),'utf8'));
 const selected=(candidates.candidates??[]).find(x=>x.id===candidates.selected_candidate_id);
 if(!selected)throw Error('NARRATIVE_VISUAL_SELECTED_CANDIDATE_MISSING');
 return validateNarrativeVisualDirection(plan,{selectedCandidate:selected});
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2];
 if(!root){console.error('Usage: node validate-narrative-visual-direction.mjs <workspace>');process.exit(2);}
 try{const result=await validateNarrativeVisualDirectionWorkspace(root);console.log(JSON.stringify(result,null,2));if(result.status!=='PASS')process.exitCode=1;}
 catch(error){console.error(error.message);process.exitCode=2;}
}
