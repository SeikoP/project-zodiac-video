#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {validateEpisodeNarrative} from './episode-narrative.mjs';
import {ttsTextIssues,estimateDuration} from './short-form-duration.mjs';
import {assertEngagementDesign} from '../features/episode/engagement-contract.mjs';

const [workspace,mode='draft']=process.argv.slice(2);
if(!workspace||!['preflight','draft'].includes(mode)){
  console.error('Usage: node narration-progressive-validation.mjs <workspace> <preflight|draft>');
  process.exit(2);
}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const raw=async n=>readFile(path.join(dir,n),'utf8');
const json=async n=>JSON.parse(await raw(n));
const hash=s=>createHash('sha256').update(s).digest('hex');
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/gu,' ');
const fail=(code,detail)=>{throw new Error(code+(detail?' '+detail:''));};

const [state,plan,candidates,brief,design]=await Promise.all([
  json('pipeline-state.json'),json('narrative-plan.json'),json('concept-candidates.json'),json('phase3-writer-brief.json'),json('engagement-design.json')
]);
const selected=candidates.candidates.find(x=>x.id===candidates.selected_candidate_id);
if(!selected||selected.id!==plan.selected_concept_id)fail('NARRATION_PREFLIGHT_CONCEPT_DRIFT');
assertEngagementDesign(design,{plan,selectedCandidate:selected});
if(!Array.isArray(brief.narrator_vibe)||!brief.narrator_vibe.length)fail('NARRATION_PREFLIGHT_NARRATOR_VIBE');
if(typeof brief.rhythm_direction!=='string'||!brief.rhythm_direction.trim())fail('NARRATION_PREFLIGHT_RHYTHM');
if(!brief.engagement_direction||typeof brief.engagement_direction.entry_hook!=='string'||!brief.engagement_direction.entry_hook.trim())fail('NARRATION_PREFLIGHT_ENGAGEMENT_DIRECTION');
if(state.phases?.['01-content']?.current_step!=='narration')fail('NARRATION_PREFLIGHT_STEP');
if(plan.version==='2.1'&&!plan.episode_scope)fail('NARRATION_PREFLIGHT_EPISODE_SCOPE');
if(!Array.isArray(plan.beats)||!plan.beats.length)fail('NARRATION_PREFLIGHT_BEATS');

const source={
  plan_sha256:hash(await raw('narrative-plan.json')),
  candidates_sha256:hash(await raw('concept-candidates.json')),
  writer_brief_sha256:hash(await raw('phase3-writer-brief.json')),
  engagement_design_sha256:hash(await raw('engagement-design.json'))
};
const base={
  format:'zodiac-narration-progressive-check@1',
  mode,
  source,
  selected_concept_id:selected.id,
  beat_ids:plan.beats.map(b=>b.id),
  narrator_vibe:brief.narrator_vibe,
  rhythm_direction:brief.rhythm_direction,
  status:'PASS',
  issues:[],
  not_an_approval:true
};
if(mode==='preflight'){
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'narration-preflight.json'),JSON.stringify(base,null,2)+'\n');
  console.log('NARRATION_PREFLIGHT_PASS: beats='+plan.beats.length);
  process.exit(0);
}

const narrationRaw=await raw('narration.txt');
const spoken=norm(narrationRaw);
const plannerVocabulary=['concept','evidence','claim','payoff','narrative','criticism','story spine','semantic delta','viral analysis','writer brief'];
const leaked=plannerVocabulary.filter(term=>new RegExp('(?:^| )'+term.replaceAll(' ',' +')+'(?: |$)','u').test(spoken));
if(leaked.length)base.issues.push({code:'PLANNER_LANGUAGE_LEAK',detail:leaked});
if(plan.version==='2.1'){
  try{validateEpisodeNarrative(plan,narrationRaw);}catch(e){base.issues.push({code:'EPISODE_NARRATIVE',detail:e.message});}
}
const signLabel=plan.version==='2.1'?(plan.episode_scope?.member_ids?.length===1?plan.member_lenses?.[0]?.label:null):plan.sign?.label;
if(signLabel&&!spoken.includes(norm(signLabel)))base.issues.push({code:'SPOKEN_IDENTITY_MISSING',detail:signLabel});
const ttsIssues=ttsTextIssues(narrationRaw);
if(ttsIssues.some(x=>x.kind==='performance_tag'))base.issues.push({code:'TTS_PERFORMANCE_TAG',detail:ttsIssues.filter(x=>x.kind==='performance_tag')});
const duration=estimateDuration(narrationRaw);
if(duration.estimated_seconds<90)base.issues.push({code:'DURATION_UNDER_90',detail:duration});
if(duration.estimated_seconds>120){
  let exception=null;
  try{exception=await json('duration-exception.json');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  const approved=exception?.format==='zodiac-duration-editorial-exception@1'&&
    exception?.decision==='EDITORIAL_EXCEPTION'&&
    exception?.narration_sha256===hash(narrationRaw)&&
    typeof exception?.reason==='string'&&exception.reason.trim().length>=40&&
    typeof exception?.user_review_excerpt==='string'&&exception.user_review_excerpt.trim().length>=15;
  if(approved)base.duration_exception={decision:'EDITORIAL_EXCEPTION',narration_sha256:exception.narration_sha256,reason:exception.reason,not_tts_verification:true};
  else base.issues.push({code:'DURATION_OVER_120',detail:duration});
}
const openingWords=spoken.split(' ').filter(Boolean).slice(0,45).join(' ');
if(!openingWords)base.issues.push({code:'EMPTY_OPENING'});
const recognition=(brief.engagement_direction?.recognition_cues??[]).filter(x=>spoken.includes(norm(x))).length;
base.duration=duration;base.tts_issues=ttsIssues;base.opening_words=openingWords;base.recognition_cues_grounded=recognition;
if(base.issues.length)base.status='REVIEW';
base.source.narration_sha256=hash(narrationRaw);
await writeFile(path.join(dir,'narration-draft-checkpoint.json'),JSON.stringify(base,null,2)+'\n');
if(base.status!=='PASS'){
  console.error('NARRATION_DRAFT_CHECKPOINT_REVIEW: '+base.issues.map(x=>x.code).join(','));
  process.exitCode=2;
}else console.log('NARRATION_DRAFT_CHECKPOINT_PASS: duration='+duration.estimated_seconds+'s tts_issues='+ttsIssues.length);
