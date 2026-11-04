#!/usr/bin/env node
import path from 'node:path';import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {recordEpisodeSpan,summarizeEpisodeSpans} from './episode-profiler.mjs';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 try{
  const [action,workspace,...a]=process.argv.slice(2);
  if(!workspace||!['summary','record','phase02'].includes(action))throw Error('Usage: fast-profile-cli.mjs <summary|record|phase02> <workspace> [phase stage category duration_ms]');
  if(action==='summary')console.log(JSON.stringify(await summarizeEpisodeSpans(workspace),null,2));
  if(action==='phase02'){const r=JSON.parse(await readFile(path.join(path.resolve(workspace),'.authoring/fast-pipeline-profile.json'),'utf8'));console.log(JSON.stringify(r,null,2));}
  if(action==='record'){const [phase,stage,category,duration]=a;const r=await recordEpisodeSpan(workspace,{phase,stage,category,duration_ms:Number(duration),status:'OBSERVED'});console.log(JSON.stringify(r));}
 }catch(e){console.error('FAST_PROFILE_BLOCKED '+e.message);process.exitCode=2;}
}
