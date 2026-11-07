#!/usr/bin/env node
import {mkdir,link,unlink,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPhase03Production} from '../phase03/run-phase03-production.mjs';
import {validateZipFile} from '../phase03/zip-core-v2.mjs';
import {validateSemanticZip} from '../../features/visual-composition/validate-animation-semantics.mjs';

const exists=p=>access(p).then(()=>true).catch(()=>false);

export async function publishReadyZip(stagedZip,readyDir){
 const source=path.resolve(stagedZip),ready=path.resolve(readyDir);
 await validateZipFile(source);
 const semantic=await validateSemanticZip(source);
 if(semantic.errors.length)throw Error('LOCAL_READY_SEMANTIC_P1 '+semantic.errors.length);
 await mkdir(ready,{recursive:true});
 const target=path.join(ready,path.basename(source));
 if(await exists(target))throw Error('LOCAL_READY_ALREADY_EXISTS '+target);
 try{await link(source,target)}catch(e){if(e.code==='EEXIST')throw Error('LOCAL_READY_ALREADY_EXISTS '+target);throw e}
 try{await unlink(source)}catch(e){await unlink(target).catch(()=>{});throw e}
 return {status:'READY_PUBLISHED',zip:target,archive_entries:(await validateZipFile(target)).entries,not_an_approval:true};
}

export async function runLocalPhase03({queueRoot=process.env.ZODIAC_QUEUE_ROOT||process.cwd(),sourceRoot,producer=runPhase03Production,...args}={}){
 if(!sourceRoot)throw Error('LOCAL_PHASE03_SOURCE_REQUIRED');
 const root=path.resolve(queueRoot),ready=path.join(root,'ready');await mkdir(ready,{recursive:true});
 // The canonical Phase-03 producer already stages privately under outputDir,
 // validates the real archive, then atomically publishes and commits state
 // against that final target. Do not add a second staging layer here or the
 // producer state would point at a path that this wrapper later removes.
 const result=await producer({sourceRoot:path.resolve(sourceRoot),outputDir:ready,...args});
 if(result?.ok!==true||result?.release_level!=='PRODUCTION_READY_ZIP'||!result?.zip)throw Error('LOCAL_PHASE03_PRODUCTION_NOT_READY');
 const target=path.resolve(result.zip);
 if(path.dirname(target)!==ready)throw Error('LOCAL_PHASE03_READY_PATH_INVALID '+target);
 const zipQc=await validateZipFile(target);
 const semantic=await validateSemanticZip(target);
 if(semantic.errors.length)throw Error('LOCAL_READY_SEMANTIC_P1 '+semantic.errors.length);
 return {status:'READY_PUBLISHED',zip:target,archive_entries:zipQc.entries,run_id:result.handoff?.run_id??null,producer_release_level:result.release_level,producer_result:result,not_an_approval:true};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=n=>{const i=process.argv.indexOf(n);return i<0?undefined:process.argv[i+1]};
 runLocalPhase03({
  queueRoot:arg('--queue-root')??process.env.ZODIAC_QUEUE_ROOT??process.cwd(),
  sourceRoot:arg('--source-workspace'),sign:arg('--sign'),episodeScope:arg('--episode-scope'),
  concept:arg('--concept'),revision:arg('--revision')??'1.0',patchVersion:arg('--patch-version'),reviewLock:arg('--review-lock')
 }).then(x=>console.log('LOCAL_READY_PUBLISHED '+JSON.stringify(x))).catch(e=>{console.error('LOCAL_PHASE03_BLOCKED '+e.message);process.exitCode=2});
}
