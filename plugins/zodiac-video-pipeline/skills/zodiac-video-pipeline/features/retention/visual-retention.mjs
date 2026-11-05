#!/usr/bin/env node
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {estimateDuration} from '../../references/short-form-duration.mjs';

const fail=code=>{throw new Error(code)};
const round=n=>Math.round(n*100)/100;

export function meaningfulVisualEvent(ev){
  const before=ev?.state_before,after=ev?.state_after;
  const motion=String(ev?.desired_motion??'').toLowerCase();
  const action=String(ev?.action??'').trim().toLowerCase();
  if(before!=null&&after!=null&&before!==after)return true;
  if(motion&&!['hold','none','static','still'].includes(motion))return true;
  if(action&&!['hold','none','static','still'].includes(action))return true;
  return false;
}

function sceneDuration(scene,fps){
  const frames=Number(scene?.duration_hint_frames);
  if(Number.isFinite(frames)&&frames>0&&Number.isFinite(fps)&&fps>0)return frames/fps;
  for(const k of ['duration_sec','duration_s']){
    const v=Number(scene?.[k]);if(Number.isFinite(v)&&v>0)return v;
  }
  if(String(scene?.voice??'').trim())return estimateDuration(scene.voice,{tail_seconds:0}).estimated_seconds;
  return 0;
}

function sparseAllowed(scene){
  const profile=scene?.experience_profile??{};
  const mode=String(profile.story_mode??scene?.story_mode??'').toLowerCase();
  const reason=String(profile.sparse_reason??scene?.sparse_reason??'').trim();
  return reason.length>=12&&['reflection','payoff','transition'].includes(mode);
}

export function analyzeVisualRetention(production){
  const fps=Number(production?.fps)||24,scenes=[],issues=[];
  let totalDuration=0,totalEvents=0;
  for(const scene of production?.scenes??[]){
    const duration=sceneDuration(scene,fps);
    const meaningful=(scene.events??[]).filter(meaningfulVisualEvent).length;
    const interval=meaningful?duration/meaningful:duration||Infinity;
    const exempt=sparseAllowed(scene),local=[];
    if(!exempt){
      if(duration>20&&meaningful<2)local.push({code:'SCENE_EVENT_COUNT_LOW'});
      if(interval>12)local.push({code:'SCENE_EVENT_DENSITY_LOW',interval_sec:round(interval),limit:12});
      if(duration>30&&meaningful<3)local.push({code:'SCENE_LONG_DEAD_ZONE'});
    }
    for(const x of local)issues.push({scene_id:scene.id,...x,duration_sec:round(duration),meaningful_events:meaningful});
    scenes.push({scene_id:scene.id,duration_sec:round(duration),meaningful_events:meaningful,event_interval_sec:Number.isFinite(interval)?round(interval):null,sparse_exempt:exempt,issues:local});
    totalDuration+=duration;totalEvents+=meaningful;
  }
  const overall=totalEvents?totalDuration/totalEvents:totalDuration||Infinity;
  if(overall>8)issues.push({code:'OVERALL_EVENT_DENSITY_LOW',interval_sec:round(overall),limit:8});
  const status=issues.length?'REVIEW':'PASS';
  const risk_level=status==='PASS'?'LOW':issues.some(x=>x.code==='SCENE_LONG_DEAD_ZONE'||(x.code==='OVERALL_EVENT_DENSITY_LOW'&&x.interval_sec>12))?'HIGH':'MEDIUM';
  return {format:'zodiac-visual-retention-review@1',status,risk_level,metrics:{total_duration_sec:round(totalDuration),meaningful_events:totalEvents,overall_event_interval_sec:Number.isFinite(overall)?round(overall):null},scenes,issues,not_a_performance_guarantee:true};
}

async function productionFile(root){
  for(const p of [path.join(root,'production.json'),path.join(root,'production.ir.json')]){
    try{if((await stat(p)).isFile())return p;}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  fail('VISUAL_RETENTION_PRODUCTION_MISSING');
}

export async function analyzeVisualRetentionWorkspace(root,{write=false}={}){
  root=path.resolve(root);
  const report=analyzeVisualRetention(JSON.parse(await readFile(await productionFile(root),'utf8')));
  if(write){
    const dir=path.join(root,'.authoring');await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'visual-retention-review.json'),JSON.stringify(report,null,2)+'\n');
  }
  return report;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2];
  if(!root){console.error('Usage: node visual-retention.mjs <workspace> [--write]');process.exit(2);}
  try{
    const r=await analyzeVisualRetentionWorkspace(root,{write:process.argv.includes('--write')});
    console.log(`VISUAL_RETENTION_${r.status}: interval=${r.metrics.overall_event_interval_sec}s issues=${r.issues.length}`);
    if(r.status!=='PASS')process.exitCode=1;
  }catch(e){console.error('VISUAL_RETENTION_BLOCKED '+e.message);process.exitCode=2;}
}
