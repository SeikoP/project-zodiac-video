#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const text=v=>typeof v==='string'&&v.trim().length>0;
const visibleEntity=e=>Object.values(e.states??{}).some(s=>s?.visible!==false);
const isPhysical=e=>e?.visual_role==='interactive_prop'||e?.kind==='prop';
const isNarrative=e=>e?.kind==='narrative_visual'||e?.visual_role==='narrative_visual';
const isAccent=e=>e?.kind==='scene_accent'||e?.role==='scene_accent'||e?.visual_role==='background';
const isCharacter=e=>e?.kind==='character'||e?.visual_role==='character';

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
  const authored=scene.art_direction?.scene_experience??{};
  if(mode==='reflection'&&sparse&&characters.length){
   const keep=issues.filter(x=>x.code==='PHYSICAL_STORY_ENTITY_MISSING');issues.splice(0,issues.length,...keep);
  }
  const criteria={
   character_action:{result:activeStory||mode==='reflection'?'PASS':'REVIEW',reason:activeStory?'A scene event changes actor/prop/narrative state.':mode==='reflection'&&sparse?profile.sparse_reason:'No meaningful action is authored.'},
   environment_specificity:{result:text(authored.environment_specificity)||accents.length?'PASS':'OMIT',reason:authored.environment_specificity??(accents.length?'Context cue is present.':'No context cue required.')},
   physical_storytelling:{result:physicalActions.length?'PASS':required.length?'REVIEW':'OMIT',reason:physicalActions.length?'Physical prop participates in an authored action.':authored.physical_storytelling??'No physical story action required.'},
   depth_separation:{result:accents.length||physical.length||narrative.length?'PASS':'OMIT',reason:accents.length||physical.length||narrative.length?'Multiple visual roles create separation.':'Sparse composition is intentional.'},
   secondary_action:{result:events.length>1?'PASS':'OMIT',reason:events.length>1?'More than one authored event supports the beat.':'Secondary action is not required.'},
   visual_callback:{result:text(authored.visual_callback)?'PASS':'OMIT',reason:authored.visual_callback??'No callback selected.'},
   narrative_visual_role:{result:narrative.length?(narrativeActions.length?'PASS':'REVIEW'):'OMIT',reason:narrative.length?(narrativeActions.length?'Narrative visual has a meaningful state/action change.':'Narrative visual is passive.'):'No narrative visual selected.'}
  };
  if(Object.values(criteria).some(c=>c.result==='REVIEW')&&!issues.length&&!(mode==='reflection'&&sparse))issues.push({code:'SCENE_EXPERIENCE_CRITERION_REVIEW'});
  scenes.push({scene_id:scene.id,decision:issues.length?'REVIEW':'PASS',criteria,issues});
 }
 return {format:'zodiac-scene-experience-review@1',decision:scenes.some(s=>s.decision==='REVIEW')?'REVIEW':'PASS',scenes,not_an_approval:true};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-scene-experience.mjs <workspace> [--write]');process.exit(2);}try{const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'),'utf8')),r=reviewSceneExperience(intent);if(process.argv.includes('--write')){await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/scene-experience-review.json'),JSON.stringify(r,null,2)+'\n');}console.log(JSON.stringify(r,null,2));if(r.decision!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
