import {createHash} from 'node:crypto';
import {assertNarrativeArchetype,compileNarrativeArchetypeDirection,assertImplicitArchetypeLabel} from './narrative-archetype.mjs';

const fail=m=>{throw new Error('ENGAGEMENT_CONTRACT_INVALID '+m);};
const text=(v,k,min=8)=>{if(typeof v!=='string'||v.trim().length<min)fail(k);return v.trim();};
const hash=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');

const INTERACTION_KEYS=['comment_move','share_target','quotable_line','replay_seam'];
const wordCount=s=>norm(s).split(' ').filter(Boolean).length;
// Interaction design: the few things that make a viewer DO something after watching. Required by design@2, optional on legacy @1.
function assertInteraction(interaction){
 if(!interaction||typeof interaction!=='object')fail('interaction');
 for(const k of INTERACTION_KEYS)text(interaction[k],'interaction.'+k);
 const q=wordCount(interaction.quotable_line);
 if(q<4||q>25)fail('interaction.quotable_line_length');
}

export function assertEngagementDesign(design,{plan,selectedCandidate}={}){
 if(!['zodiac-engagement-design@1','zodiac-engagement-design@2'].includes(design?.format))fail('format');
 if(design.format.endsWith('@2')||design.interaction!=null)assertInteraction(design.interaction);
 if(!plan||!selectedCandidate)fail('lineage_inputs');
 if(design.selected_concept_id!==plan.selected_concept_id||design.selected_concept_id!==selectedCandidate.id)fail('selected_concept_id');
 // Final review binds the full plan; an unchanged base story can reuse its earlier design.
 const {mock_ad,...baseStory}=plan;
 if(![hash(JSON.stringify(plan)),hash(JSON.stringify(baseStory))].includes(design.source?.plan_sha256)||design.source?.candidate_sha256!==hash(JSON.stringify(selectedCandidate)))fail('source_lineage');
 text(design.entry_hook?.intent,'entry_hook.intent');
 text(design.entry_hook?.mechanism,'entry_hook.mechanism');
 text(design.open_question,'open_question');
 if(!Array.isArray(design.recognition_loop)||design.recognition_loop.length<2||design.recognition_loop.length>6)fail('recognition_loop');
 for(const [i,v] of design.recognition_loop.entries())text(v,'recognition_loop.'+i);
 if(!Array.isArray(design.reframe_points)||design.reframe_points.length<1||design.reframe_points.length>4)fail('reframe_points');
 for(const [i,v] of design.reframe_points.entries())text(v,'reframe_points.'+i);
 text(design.payoff_callback,'payoff_callback');
 if(design.narrative_archetype!=null)assertNarrativeArchetype(design.narrative_archetype);
 const beats=plan.beats??[];
 if(!Array.isArray(design.beat_pull)||design.beat_pull.length!==beats.length)fail('beat_pull_length');
 for(let i=0;i<beats.length;i++){
  const d=design.beat_pull[i],b=beats[i];
  if(d?.beat_id!==b?.id)fail('beat_pull_order '+(b?.id??i));
  text(d.question_created,'beat_pull.'+i+'.question_created');
  text(d.reason_to_continue,'beat_pull.'+i+'.reason_to_continue');
  text(d.new_information,'beat_pull.'+i+'.new_information');
  if(d.payoff_promised!=null&&typeof d.payoff_promised!=='string')fail('beat_pull.'+i+'.payoff_promised');
 }
 return design;
}

export function compileEngagementDirection(design){
 return {
  entry_hook:design.entry_hook.intent,
  open_question:design.open_question,
  recognition_cues:[...design.recognition_loop],
  reframe_cues:[...design.reframe_points],
  payoff_callback:design.payoff_callback,
  ...(design.interaction?{interaction:Object.fromEntries(INTERACTION_KEYS.map(k=>[k,design.interaction[k]]))}:{}),
  ...(design.narrative_archetype?{narrative_mode:compileNarrativeArchetypeDirection(design.narrative_archetype)}:{})
 };
}

export function assertEngagementReview(review,{design,plan,narrationRaw}={}){
 if(review?.format!=='zodiac-engagement-review@1')fail('review.format');
 if(review.source?.design_sha256!==hash(JSON.stringify(design))||review.source?.plan_sha256!==hash(JSON.stringify(plan))||review.source?.narration_sha256!==hash(narrationRaw))fail('review.source_lineage');
 const spoken=norm(narrationRaw);
 if(design?.narrative_archetype)assertImplicitArchetypeLabel(design.narrative_archetype,narrationRaw);
 const keys=['hook_strength','early_value','curiosity_continuity','recognition_density','reframe_strength','payoff_satisfaction'];
 if(!review.criteria||Object.keys(review.criteria).sort().join('|')!==[...keys].sort().join('|'))fail('review.criteria');
 const unresolved=[];
 for(const k of keys){
  const c=review.criteria[k];
  if(!c||!['PASS','REVIEW'].includes(c.result))fail(k+'.result');
  text(c.note,k+'.note',20);
  const ex=text(c.evidence_excerpt,k+'.evidence_excerpt',8),words=norm(ex).split(' ').filter(Boolean);
  if(words.length<3||words.length>35||!spoken.includes(norm(ex)))fail(k+'.excerpt');
  if(c.result==='REVIEW')unresolved.push(k);
 }
 const beats=plan.beats??[];
 if(!Array.isArray(review.pull_chain)||review.pull_chain.length!==beats.length)fail('pull_chain_length');
 for(let i=0;i<beats.length;i++){
  const p=review.pull_chain[i],b=beats[i];
  if(p?.beat_id!==b?.id)fail('pull_chain_order '+(b?.id??i));
  if(!['PASS','REVIEW'].includes(p.result))fail('pull_chain.result '+i);
  text(p.reason_to_continue,'pull_chain.reason '+i,16);
  const ex=text(p.evidence_excerpt,'pull_chain.excerpt '+i,8);
  if(!spoken.includes(norm(ex)))fail('pull_chain.excerpt_grounding '+i);
  if(p.result==='REVIEW')unresolved.push('beat:'+p.beat_id);
 }
 const er=review.consecutive_explanation_risk;
 if(!er||!['PASS','REVIEW'].includes(er.result)||typeof er.note!=='string'||er.note.trim().length<20)fail('consecutive_explanation_risk');
 if(er.result==='REVIEW')unresolved.push('consecutive_explanation_risk');
 if(design?.interaction){
  const ic=review.interaction_check;
  if(!ic||Object.keys(ic).sort().join('|')!==[...INTERACTION_KEYS].sort().join('|'))fail('review.interaction_check');
  for(const k of INTERACTION_KEYS){
   const c=ic[k];
   if(!c||!['PASS','REVIEW'].includes(c.result))fail('interaction_check.'+k+'.result');
   const ex=text(c.evidence_excerpt,'interaction_check.'+k+'.excerpt',8),words=norm(ex).split(' ').filter(Boolean);
   if(words.length<3||words.length>35||!spoken.includes(norm(ex)))fail('interaction_check.'+k+'.excerpt');
   if(c.result==='REVIEW')unresolved.push('interaction:'+k);
  }
  // The quotable line must be spoken as designed, not paraphrased away.
  if(!spoken.includes(norm(design.interaction.quotable_line)))fail('interaction.quotable_line_not_spoken');
 }
 if(!['PASS','REVIEW'].includes(review.decision)||!Array.isArray(review.revision_targets))fail('review.decision');
 if(review.decision==='PASS'&&(unresolved.length||review.revision_targets.length))fail('review.pass_with_unresolved');
 if(review.decision==='REVIEW'&&!review.revision_targets.length)fail('review.review_without_targets');
 if(review.decision!=='PASS')fail('Content Review blocked by engagement REVIEW');
 return review;
}

export {hash as engagementHash};
