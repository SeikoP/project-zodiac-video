import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=(m)=>{throw new Error('SCENE_DIRECTION_INVALID: '+m);};
const idx=JSON.parse(await readFile(path.join(here,'index.json'),'utf8'));
if(idx.format!=='zodiac-scene-direction@1')fail('format');
if(idx.version!=='1.1.0')fail('version');
const p=idx.policy??{};
if(p.compile_time_only!==true)fail('compile_time_only');
if(p.runtime_contract!=='existing_scene_entities_and_camera_primitives')fail('runtime contract');
if(p.profiles_are!=='accelerators_not_whitelist')fail('profiles policy');
if(p.max_same_shot_streak!==2||p.max_same_signature_streak!==2)fail('streak policy');
if(p.window_size!==4||p.min_distinct_shots_per_window!==2)fail('window policy');
if(p.environment_change_for_variety!==false)fail('environment-change policy');
if(p.shot_change_counts_as_story_state_change!==false)fail('story-state policy');
const placements=new Set(p.placements??[]), continuity=new Set(p.continuity_relations??[]);
for(const x of ['center','left','right','split','full'])if(!placements.has(x))fail('missing placement '+x);
for(const x of ['start','continue','reframe','insert','location_change','payoff_break'])if(!continuity.has(x))fail('missing continuity '+x);
const shots=new Map();
for(const s of idx.shots??[]){
 if(!s.id||shots.has(s.id))fail('duplicate/missing shot '+s.id);shots.set(s.id,s);
 if(!s.scale_band||!Array.isArray(s.purpose)||!s.purpose.length)fail(s.id+' incomplete');
 if(!Array.isArray(s.placements)||!s.placements.length)fail(s.id+' placements');
 for(const q of s.placements)if(!placements.has(q))fail(s.id+' unknown placement '+q);
}
for(const id of ['wide-environment','medium-character','two-person','reaction-closeup','prop-insert','over-shoulder','foreground-peek','caption-led'])if(!shots.has(id))fail('missing shot '+id);
for(const pat of idx.rhythm_patterns??[]){if(!pat.id||!Array.isArray(pat.sequence)||pat.sequence.length<2)fail('bad rhythm pattern');for(const id of pat.sequence)if(!shots.has(id))fail(pat.id+' unknown shot '+id);}

async function maybeProduction(arg){
 if(!arg)return null;let s;try{s=await stat(arg);}catch{return null;}
 let f=s.isDirectory()?path.join(arg,'production.json'):arg;
 try{return JSON.parse(await readFile(f,'utf8'));}catch{return null;}
}
const prod=await maybeProduction(process.argv[2]);
if(prod){
 const scenes=prod.scenes??prod.visual?.scenes??[];
 if(Array.isArray(scenes)&&scenes.length){
  const dirs=[];
  for(let i=0;i<scenes.length;i++){
   const entityMap=new Map((scenes[i]?.entities??[]).map(e=>[e.id,e]));
   const d=scenes[i]?.scene_direction;if(!d)fail(`scene ${i+1} missing scene_direction`);
   const shot=shots.get(d.shot);if(!shot)fail(`scene ${i+1} unknown shot ${d.shot}`);
   if(!d.focus||typeof d.focus!=='string')fail(`scene ${i+1} missing focus`);
   if(d.focus!=='caption'&&!entityMap.has(d.focus))fail(`scene ${i+1} focus must resolve to scene entity or caption`);
   if(d.foreground_role&& !entityMap.has(d.foreground_role))fail(`scene ${i+1} foreground_role must resolve to scene entity`);
   if(!placements.has(d.subject_placement))fail(`scene ${i+1} bad subject_placement`);
   if(!shot.placements.includes(d.subject_placement))fail(`scene ${i+1} ${d.shot} disallows placement ${d.subject_placement}`);
   if(!continuity.has(d.continuity_relation))fail(`scene ${i+1} bad continuity_relation`);
   if(i===0&&d.continuity_relation!=='start')fail('first scene continuity_relation must be start');
   if(typeof d.composition_goal!=='string'||!d.composition_goal.trim())fail(`scene ${i+1} missing composition_goal`);
   if(d.shot==='foreground-peek'&&!d.foreground_role)fail(`scene ${i+1} foreground-peek requires foreground_role`);
   if(d.shot==='over-shoulder'&&!d.foreground_role)fail(`scene ${i+1} over-shoulder requires foreground_role`);
   if(d.shot==='prop-insert'&&(!entityMap.has(d.focus)||entityMap.get(d.focus)?.kind==='character'))fail(`scene ${i+1} prop-insert focus must be a non-character entity`);
   if(d.shot==='two-person'){
    const r=d.interaction_roles??{};if(!r.speaker||!r.listener||r.speaker===r.listener)fail(`scene ${i+1} two-person requires distinct speaker/listener`);if(!entityMap.has(r.speaker)||!entityMap.has(r.listener))fail(`scene ${i+1} two-person roles must resolve to scene entities`);if(r.shared_prop&&!entityMap.has(r.shared_prop))fail(`scene ${i+1} shared_prop must resolve to scene entity`);
   }
   dirs.push(d);
  }
  let shotRun=1,sigRun=1;
  for(let i=1;i<dirs.length;i++){
   shotRun=dirs[i].shot===dirs[i-1].shot?shotRun+1:1;
   const sig=x=>[x.shot,x.focus,x.subject_placement].join('|');
   sigRun=sig(dirs[i])===sig(dirs[i-1])?sigRun+1:1;
   if(shotRun>p.max_same_shot_streak)fail(`shot streak > ${p.max_same_shot_streak} at scene ${i+1}`);
   if(sigRun>p.max_same_signature_streak)fail(`same shot/focus/placement streak > ${p.max_same_signature_streak} at scene ${i+1}`);
  }
  for(let i=0;i+p.window_size<=dirs.length;i++){
   const w=dirs.slice(i,i+p.window_size);if(new Set(w.map(x=>x.shot)).size<p.min_distinct_shots_per_window)fail(`scenes ${i+1}-${i+p.window_size} need >=${p.min_distinct_shots_per_window} shot profiles`);
  }
 }
}
console.log(`Scene Direction ${idx.version} OK: ${shots.size} shot profiles, ${idx.rhythm_patterns?.length??0} rhythm patterns; anti-repetition active.`);
