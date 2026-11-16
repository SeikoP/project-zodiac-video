#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildSceneGraph} from '../scene-production/scene-graph.mjs';
import {reviewSceneContinuity} from '../scene-production/scene-continuity.mjs';
import {writeSceneCheckpoints} from '../scene-production/scene-checkpoints.mjs';

const text=v=>typeof v==='string'&&v.trim().length>0;
const meaningful=v=>typeof v==='string'&&v.trim().length>=12;
const norm=v=>String(v??'').trim().replace(/\s+/gu,' ').toLocaleLowerCase('vi');
const visibleEntity=e=>Object.values(e.states??{}).some(s=>s?.visible!==false);
const isPhysical=e=>e?.visual_role==='interactive_prop'||e?.kind==='prop';
const isNarrative=e=>e?.kind==='narrative_visual'||e?.visual_role==='narrative_visual';
const isAccent=e=>e?.kind==='scene_accent'||e?.role==='scene_accent'||e?.visual_role==='background';
const isCharacter=e=>e?.kind==='character'||e?.visual_role==='character';
const isStoryEntity=e=>isCharacter(e)||isPhysical(e)||isNarrative(e);

const initialState=e=>e?.states?.[e.initial_state]??Object.values(e?.states??{})[0]??null;
const rectOf=e=>{const t=initialState(e)?.transform;return t&&['x','y','width','height'].every(k=>Number.isFinite(t[k]))&&t.width>0&&t.height>0?t:null;};
const layerOf=e=>Number(initialState(e)?.layer);
const intersection=(a,b)=>{const w=Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x));const h=Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));return w*h;};
const clipped=(r,b)=>intersection(r,b);

function geometryExperience(scene,{entities,mode,sparse,focusPass,supportIds}){
 const canvas=scene.layout_contract?.canvas??{width:1080,height:1920};
 const captionY=Number(scene.layout_contract?.caption_safe_zone?.y);
 const storyField={x:0,y:0,width:canvas.width,height:Number.isFinite(captionY)?Math.max(1,captionY):Math.min(canvas.height,1400)};
 const geometryAvailable=entities.some(e=>rectOf(e));
 if(!geometryAvailable)return {
  geometryAvailable:false,
  environmentPass:text(scene.art_direction?.scene_experience?.environment_specificity)||entities.some(isAccent),
  depthPass:focusPass&&supportIds.length>0,
  occupancyPass:true,
  occupancyRatio:null,
  minOccupancy:null,
  reason:'Geometry is not available at this review boundary.'
 };

 const visible=entities.filter(e=>rectOf(e));
 const story=visible.filter(isStoryEntity);
 const support=visible.filter(e=>isAccent(e)||String(e.id??'').startsWith('depth__')||e.visual_role==='foreground_environment');
 const frame=scene.environment?.frame?.version==='zodiac-environment-frame@1';
 const depthEntities=support.filter(e=>String(e.id??'').startsWith('depth__'));
 const backgroundArea=support.reduce((n,e)=>n+clipped(rectOf(e),{x:0,y:0,width:canvas.width,height:canvas.height}),0);
 const backgroundRatio=backgroundArea/(canvas.width*canvas.height);
 const environmentPass=frame||depthEntities.length>0||backgroundRatio>=0.07;

 const storyLayers=new Set(story.map(layerOf).filter(Number.isFinite));
 const storyAreas=story.map(e=>{const r=rectOf(e);return r.width*r.height;}).filter(n=>n>0);
 const areaRatio=storyAreas.length>=2?Math.max(...storyAreas)/Math.min(...storyAreas):1;
 const foregroundStory=story.some(e=>e.visual_role==='foreground_environment');
 const depthPass=frame||depthEntities.length>0||foregroundStory||storyLayers.size>=2||areaRatio>=1.35;

 let occupied=story.reduce((n,e)=>n+clipped(rectOf(e),storyField),0);
 for(let i=0;i<story.length;i++)for(let j=i+1;j<story.length;j++)occupied-=intersection(rectOf(story[i]),rectOf(story[j]));
 occupied=Math.max(0,occupied);
 const occupancyRatio=occupied/(storyField.width*storyField.height);
 const minOccupancy=mode==='relationship'||mode==='payoff'?0.26:mode==='behavior'?0.24:0.20;
 const occupancyPass=sparse||!['relationship','behavior','payoff'].includes(mode)||occupancyRatio>=minOccupancy;
 return {geometryAvailable:true,environmentPass,depthPass,occupancyPass,occupancyRatio,minOccupancy,backgroundRatio};
}

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
  const geometry=geometryExperience(scene,{entities,mode,sparse,focusPass,supportIds:focusReview.supportIds});
  if(geometry.geometryAvailable&&!sparse&&['relationship','behavior','payoff'].includes(mode)&&!geometry.environmentPass)issues.push({code:'ENVIRONMENT_VISUAL_UNDERDEVELOPED',background_ratio:Number((geometry.backgroundRatio??0).toFixed(3))});
  if(geometry.geometryAvailable&&!sparse&&focusReview.supportIds.length&&!geometry.depthPass)issues.push({code:'VISUAL_DEPTH_UNDERDEVELOPED'});
  if(geometry.geometryAvailable&&!geometry.occupancyPass)issues.push({code:'FRAME_OCCUPANCY_LOW',ratio:Number(geometry.occupancyRatio.toFixed(3)),minimum:geometry.minOccupancy});

  const criteria={
   story_focus_alignment:{result:focusReview.required?(focusPass?'PASS':'REVIEW'):focusReview.focus?(focusPass?'PASS':'REVIEW'):'OMIT',reason:focusPass?'Focal and supporting story entities form a goal-bound relation chain.':focusReview.required?'Required story focus is missing, invalid or disconnected.':'No story-focus chain required for this sparse/simple beat.'},
   character_action:{result:activeStory||mode==='reflection'?'PASS':'REVIEW',reason:activeStory?'A scene event changes actor/prop/narrative state.':mode==='reflection'&&sparse?profile.sparse_reason:'No meaningful action is authored.'},
   environment_specificity:{result:(mode==='reflection'&&sparse)?'OMIT':geometry.environmentPass?'PASS':geometry.geometryAvailable&&['relationship','behavior','payoff'].includes(mode)?'REVIEW':text(authored.environment_specificity)||accents.length?'PASS':'OMIT',reason:(mode==='reflection'&&sparse)?profile.sparse_reason:geometry.environmentPass?'Context occupies a meaningful part of the frame or uses an explicit depth/frame layer.':'A tiny accent or prose rationale alone does not establish a readable environment.'},
   physical_storytelling:{result:physicalActions.length?'PASS':required.length?'REVIEW':'OMIT',reason:physicalActions.length?'Physical prop participates in an authored action.':authored.physical_storytelling??'No physical story action required.'},
   depth_separation:{result:(mode==='reflection'&&sparse)?'OMIT':focusReview.supportIds.length?(geometry.depthPass?'PASS':'REVIEW'):'OMIT',reason:(mode==='reflection'&&sparse)?'Negative space is intentional.':geometry.depthPass?'Actual geometry/layers create readable separation between story roles.':focusReview.supportIds.length?'Semantic links exist but the rendered geometry is visually flat.':'No supporting story role requires depth separation.'},
   frame_occupancy:{result:(mode==='reflection'&&sparse)?'OMIT':geometry.geometryAvailable?(geometry.occupancyPass?'PASS':'REVIEW'):'OMIT',reason:(mode==='reflection'&&sparse)?'Sparse reflection intentionally preserves negative space.':geometry.geometryAvailable?('Story mass occupies '+(geometry.occupancyRatio*100).toFixed(1)+'% of the pre-caption field; minimum '+((geometry.minOccupancy??0)*100).toFixed(0)+'%.'):'Geometry is not available at this review boundary.'},
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
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-scene-experience.mjs <workspace> [--write]');process.exit(2);}try{const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'),'utf8')),r=reviewSceneExperience(intent);if(process.argv.includes('--write')){await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/scene-experience-review.json'),JSON.stringify(r,null,2)+'\n');await writeSceneCheckpoints(path.resolve(root));}console.log(JSON.stringify(r,null,2));if(r.decision!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
