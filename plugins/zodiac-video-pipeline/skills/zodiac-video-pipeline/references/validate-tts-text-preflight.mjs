#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {ttsTextIssues,estimateDuration} from './short-form-duration.mjs';
const [workspace]=process.argv.slice(2);
if(!workspace){console.error('Usage: node validate-tts-text-preflight.mjs <workspace> [--write]');process.exit(2);}
const root=path.resolve(workspace),dir=path.join(root,'.authoring');
const hash=s=>createHash('sha256').update(s).digest('hex');
const fail=m=>{throw Error('TTS_TEXT_PREFLIGHT_INVALID '+m);};
try{
 const narration=await readFile(path.join(dir,'narration.txt'),'utf8');
 const planRaw=await readFile(path.join(dir,'spoken-performance-plan.json'),'utf8');
 const plan=JSON.parse(planRaw);
 const duration=estimateDuration(narration),issues=ttsTextIssues(narration),unresolved=[];
 for(const issue of issues){
  if(issue.kind==='performance_tag'){unresolved.push({...issue,reason:'performance tags are forbidden in approved narration'});continue;}
  if(['acronym','number','foreign_word'].includes(issue.kind)){
   const covered=(plan.pronunciation??[]).some(row=>row.token===issue.text);
   if(!covered)unresolved.push({...issue,reason:'pronunciation reading not declared in spoken-performance-plan'});
  }else if(issue.kind==='ellipsis'){
   const covered=(plan.units??[]).some(u=>u.excerpt.includes(issue.text)&&(u.pause_before!=='none'||u.pause_after!=='none'));
   if(!covered)unresolved.push({...issue,reason:'ellipsis has no explicit pause intent'});
  }
 }
 const warnings=duration.estimated_seconds>120?['DURATION_OVER_120_OWNED_BY_EDITORIAL_DURATION_GATE']:[];
 const report={format:'zodiac-tts-text-preflight@1',status:unresolved.length?'REVIEW':'PASS',source:{narration_sha256:hash(narration),spoken_performance_plan_sha256:hash(planRaw)},duration,issues,unresolved,warnings,prosody_verified:false,audio_measured:false,not_an_approval:true};
 if(process.argv.includes('--write'))await writeFile(path.join(dir,'tts-text-preflight.json'),JSON.stringify(report,null,2)+'\n','utf8');
 if(unresolved.length)fail(unresolved.map(x=>x.kind+':'+x.reason).join('|'));
 console.log('TTS_TEXT_PREFLIGHT_PASS: duration='+duration.estimated_seconds+'s issues='+issues.length);
}catch(e){console.error(e.message);process.exitCode=2;}
