#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-spoken-performance-plan.mjs <workspace>');process.exit(2);}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const raw=n=>readFile(path.join(dir,n),'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=m=>{throw Error('SPOKEN_PERFORMANCE_PLAN_INVALID '+m);};
try{
 const [narration,profileRaw,planRaw]=await Promise.all(['narration.txt','voice-profile.json','spoken-performance-plan.json'].map(raw));
 const plan=JSON.parse(planRaw),profile=JSON.parse(profileRaw);
 if(plan.format!=='zodiac-spoken-performance-plan@1')fail('format');
 if(plan.source?.narration_sha256!==hash(narration)||plan.source?.voice_profile_sha256!==hash(profileRaw))fail('source_lineage');
 if(!Array.isArray(plan.units)||plan.units.length<2)fail('units');
 const roles=new Set(['setup','run','hit','reframe','internal_voice','recovery','payoff']);
 const pauses=new Set(['none','micro','short','full']);
 const paces=new Set(['slow','medium','fast']);
 let cursor=0; const ids=new Set(); let hasPayoff=false;
 for(const [i,u] of plan.units.entries()){
  if(!u?.id||ids.has(u.id))fail('unit_id_'+i);ids.add(u.id);
  if(typeof u.excerpt!=='string'||!u.excerpt.trim())fail('excerpt_'+u.id);
  const at=narration.indexOf(u.excerpt,cursor);if(at<0)fail('excerpt_order_or_grounding_'+u.id);cursor=at+u.excerpt.length;
  if(!roles.has(u.role)||!paces.has(u.pace)||!pauses.has(u.pause_before)||!pauses.has(u.pause_after))fail('intent_'+u.id);
  if(!Number.isFinite(u.energy)||u.energy<0||u.energy>1)fail('energy_'+u.id);
  if(typeof u.delivery!=='string'||u.delivery.trim().length<4)fail('delivery_'+u.id);
  if(!Array.isArray(u.emphasis)||u.emphasis.some(x=>typeof x!=='string'||!x.trim()||!u.excerpt.includes(x)))fail('emphasis_'+u.id);
  if(u.role==='payoff')hasPayoff=true;
 }
 if(!hasPayoff)fail('payoff_unit_required');
 if(!Array.isArray(plan.pronunciation))fail('pronunciation');
 for(const row of plan.pronunciation){
  if(!row||typeof row.token!=='string'||!row.token.trim()||!narration.includes(row.token))fail('pronunciation_token');
  if(typeof row.reading!=='string'||!row.reading.trim())fail('pronunciation_reading');
 }
 if(!plan.ending_strategy||typeof plan.ending_strategy!=='string'||plan.ending_strategy.trim().length<12)fail('ending_strategy');
 if(profile.ending_rule&&plan.ending_strategy.length<12)fail('ending_strategy');
 console.log('SPOKEN_PERFORMANCE_PLAN_PASS: units='+plan.units.length+' pronunciation='+plan.pronunciation.length);
}catch(e){console.error(e.message);process.exitCode=2;}
