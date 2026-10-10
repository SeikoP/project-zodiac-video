#!/usr/bin/env node
// Records digest ONLY after strict manifest/state + native execution proof.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
import {buildReviewLock} from './phase03-production-release.mjs';
import {inspectPhase02Seal} from './phase02-seal-gate.mjs';
export async function sealPhase02Review(root){
 const abs=path.resolve(root);
 const gate=await inspectPhase02Seal(abs);
 if(gate.status!=='SEAL_ELIGIBLE')throw new Error('PHASE02_SEAL_EVIDENCE_BLOCKED '+JSON.stringify(gate.issues));
 const state=JSON.parse(await readFile(path.join(abs,'.authoring','pipeline-state.json'),'utf8'));
 const lock=await buildReviewLock(abs,state);
 const dir=path.join(abs,'.authoring');await mkdir(dir,{recursive:true});
 const dest=path.join(dir,'phase02-review-lock.json');
 const tmp=dest+'.tmp-'+process.pid;
 await writeFile(tmp,JSON.stringify(lock,null,2)+'\n');
 await (await import('node:fs/promises')).rename(tmp,dest);
 return lock;
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node seal-phase02-review.mjs <approved-authoring-workspace>');process.exit(2);}else try{const lock=await sealPhase02Review(root);console.log('PHASE02_REVIEW_LOCK_PASS '+lock.source.sha256);}catch(e){console.error('PHASE02_REVIEW_LOCK_BLOCKED '+e.message);process.exitCode=1;}}
