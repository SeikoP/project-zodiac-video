#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneGraph} from '../scene-production/scene-graph.mjs';
import {reviewSceneContinuity} from '../scene-production/scene-continuity.mjs';

const text=v=>typeof v==='string'&&v.trim().length>0;
const meaningful=v=>typeof v==='string'&&v.trim().length>=12;
const norm=v=>String(v??'').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const visibleEntity=e=>Object.values(e.states??{}).some(s=>s?.visible!==false);
const isPhysical=e=>e?.visual_role==='interactive_prop'||e?.kind==='prop';
const isNarrative=e=>e?.kind==='narrative_visual'||e?.visual_role==='narrative_visual';
const isAccent=e=>e?.kind==='scene_accent'||e?.role==='scene_accent'||e?.visual_role==='background';
const isCharacter=e=>e?.kind==='character'||e?.visual_role==='character';
const isStoryEntity=e=>isCharacter(e)||isPhysical(e)||isNarrative(e);

function reviewStoryFocus(scene,{entities,events,mode,sparse}){
 const issues=[],focus=scene.experience_profile?.story_focus;
 const storyEntities=entities.filter(isStoryEntity),byId=new Map(storyEntities.map(e=>[e.id,e]));
 const evented=new Set(events.map(e=>e.target));
 const alwaysFocus=['behavior','relationship','symbolic','payoff'].includes(mode);
 const multiRole=storyEntities.length>1&&['exposition'].includes(mode);
 const required=alwaysFocus||multiRole;
 if((mode==='reflection'||mode==='transition')&&sparse)return {required:false,focus:null,issues,connected:new Set(),supportIds:[]};
 if(required&&!focus){issues.push({code:'STORY_FOCUS_MISSING'});return {required,focus:null,issues,connected:new Set(),supportIds:[]};}
 if(!focus)return {required:false,focus:null,issues,connected:new Set(),supportIds:[]};
 if(!meaningful(focus.goal)||norm(focus.goal)!==norm(scene.semantic_goal))issues.push({code:'STORY_FOCUS_GOAL_MISMATCH'});
 const focal=focus.focal_entity_id;
 if(!byId.has(focal))issues.push({code:'STORY_FOCUS_ENTITY_INVALID',entity_id:focal??null});
 const supportIds=[...new Set(Array.isArray(focus.supporting_entity_ids)?focus.supporting_entity_ids:[])];
 for(const id of supportIds)if(id===focal||!byId.has(id))issues.push({code:'STORY_FOCUS_SUPPORT_INVALID',entity_id:id});
 if(storyEntities.length>1&&!supportIds.length)issues.push({code:'STORY_FOCUS_SUPPORT_REQUIRED'});

 // Entities that actively carry meaning must be named in the focus chain. Physical
 // props and Narrative Visuals always count; co-actors count in relationship scenes;
 // any event-targeted story entity also counts.
 const mustLink=storyEntities.filter(e=>e.id!==focal&&(isPhysical(e)||isNarrative(e)||evented.has(e.id)||(mode==='relationship'&&isCharacter(e))));
 for(const e of mustLink)if(!supportIds.includes(e.id))issues.push({code:'STORY_ENTITY_UNLINKED',entity_id:e.id});

 const nodes=new Set([focal,...supportIds].filter(Boolean)),links=Array.isArray(focus.links)?focus.links:[];
 const graph=new Map([...nodes].map(id=>[id,new Set()]));
 for(const link of links){
  const from=link?.from,to=link?.to;
  if(!nodes.has(from)||!nodes.has(to)||from===to||!text(link?.relation)||!meaningful(link?.purpose)){
   issues.push({code:'STORY_FOCUS_LINK_INVALID',from:from??null,to:to??null});continue;
  }
  graph.get(from).add(to);graph.get(to).add(from);
 }
 const connected=new Set();
 if(nodes.has(focal)){
  const q=[focal];connected.add(focal);
  while(q.length){const cur=q.shift();for(const n of graph.get(cur)??[])if(!connected.has(n)){connected.add(n);q.push(n);}}
 }
 for(const id of supportIds)if(!connected.has(id))issues.push({code:'STORY_FOCUS_DISCONNECTED',entity_id:id});
 return {required,focus,issues,connected,supportIds};
}

export function reviewSceneExperience(intent){
 const scenes=[];
 for(const scene of intent?.scenes??[]){
  const issues=[],profile=scene.experience_profile??{},entities=(scene.entities??[]).filter(visibleEntity);
  if(!scene.experience_profile||!text(profile.story_mode))issues.push({code:'EXPERIENCE_PROFILE_MISSING'});
  const characters=entities.filter(isCharacter),physical=entities.filter(isPhysical),narrative=entities.filter(isNarrative),accents=entities.filter(isAccent);
  const events=scene.events??[];
  const physicalActions=events.filter(ev=>physical.some(p=>p.id===ev.target)&&text(ev.action));
  const narrativeActions=events.filter(ev=>narrative.some(n=>n.id===ev.target)&&(ev.state_before!==ev.state_after||text(ev.action)));
  const required=profile.required_physical_entities??[];
  for(const id of required)if(!physical.some(e=>e.id===id))issues.push({code:'PHYSICAL_STORY_ENTITY_MISSING',entity_id:id});
  const mode=profile.story_mode??'general',sparse=text(profile.sparse_reason);
  const actorActions=events.filter(ev=>characters.some(c=>c.id===ev.target)&&text(ev.action));
  const activeStory=physicalActions.length>0||narrativeActions.length>0||actorActions.length>0;
  if(['behavior','relationship'].includes(mode)&&characters.length&&!activeStory&&physical.length===0&&narrative.length===0)issues.push({code:'PASSIVE_STORYTELLING'});
  if(['behavior','relationship'].includes(mode)&&characters.length&&accents.length&&physical.length===0&&narrative.length===0&&!activeStory)issues.push({code:'PASSIVE_ACCENT_ONLY'});

  const focusReview=reviewStoryFocus(scene,{entities,events,mode,sparse});
  issues.push(...focusReview.issues);
  const authored=scene.art_direction?.scene_experience??{};
  if(mode==='reflection'&&sparse&&characters.length){
   const keep=issues.filter(x=>x.code==='PHYSICAL_STORY_ENTITY_MISSING');issues.splice(0,issues.length,...keep);
  }
  const focusPass=Boolean(focusReview.focus)&&focusReview.issues.length===0;
  const criteria={
   story_focus_alignment:{result:focusReview.required?(focusPass?'PASS':'REVIEW'):focusReview.focus?(focusPass?'PASS':'REVIEW'):'OMIT',reason:focusPass?'Focal and supporting story entities form a goal-bound relation chain.':focusReview.required?'Required story focus is missing, invalid or disconnected.':'No story-focus chain required for this sparse/simple beat.'},
   character_action:{result:activeStory||mode==='reflection'?'PASS':'REVIEW',reason:activeStory?'A scene event changes actor/prop/narrative state.':mode==='reflection'&&sparse?profile.sparse_reason:'No meaningful action is authored.'},
   environment_specificity:{result:text(authored.environment_specificity)||accents.length?'PASS':'OMIT',reason:authored.environment_specificity??(accents.length?'Context cue is present.':'No context cue required.')},
   physical_storytelling:{result:physicalActions.length?'PASS':required.length?'REVIEW':'OMIT',reason:physicalActions.length?'Physical prop participates in an authored action.':authored.physical_storytelling??'No physical story action required.'},
   depth_separation:{result:focusPass&&focusReview.supportIds.length?'PASS':(mode==='reflection'&&sparse)?'OMIT':'REVIEW',reason:focusPass&&focusReview.supportIds.length?'Depth comes from linked story roles, not asset count.':mode==='reflection'&&sparse?'Negative space is intentional.':'Visual layers exist without a validated semantic relationship chain.'},
   secondary_action:{result:events.length>1?'PASS':'OMIT',reason:events.length>1?'More than one authored event supports the beat.':'Secondary action is not required.'},
   visual_callback:{result:text(authored.visual_callback)?'PASS':'OMIT',reason:authored.visual_callback??'No callback selected.'},
   narrative_visual_role:{result:narrative.length?(narrativeActions.length?'PASS':'REVIEW'):'OMIT',reason:narrative.length?(narrativeActions.length?'Narrative visual has a meaningful state/action change.':'Narrative visual is passive.'):'No narrative visual selected.'}
  };
  if(Object.values(criteria).some(c=>c.result==='REVIEW')&&!issues.length&&!(mode==='reflection'&&sparse))issues.push({code:'SCENE_EXPERIENCE_CRITERION_REVIEW'});
  scenes.push({scene_id:scene.id,decision:issues.length?'REVIEW':'PASS',criteria,issues});
 }
 const graph=buildSceneGraph(intent),continuity=reviewSceneContinuity(intent,{graph});
 return {format:'zodiac-scene-experience-review@1',decision:scenes.some(s=>s.decision==='REVIEW')||continuity.decision==='REVIEW'||graph.status==='BLOCKED'?'REVIEW':'PASS',scenes,continuity,scene_graph_issues:graph.issues,not_an_approval:true};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-scene-experience.mjs <workspace> [--write]');process.exit(2);}try{const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'),'utf8')),r=reviewSceneExperience(intent);if(process.argv.includes('--write')){await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/scene-experience-review.json'),JSON.stringify(r,null,2)+'\n');const {writeSceneCheckpoints}=await import('../scene-production/scene-checkpoints.mjs');await writeSceneCheckpoints(path.resolve(root));}console.log(JSON.stringify(r,null,2));if(r.decision!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
