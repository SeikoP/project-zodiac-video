#!/usr/bin/env node
// The only public Phase-03 export entrypoint. Stages a sealed Phase-02 source,
// compiles it to Job@5, validates *all* deterministic contracts, then moves one
// independently checked ZIP into the output directory.
import {mkdtemp,mkdir,cp,readFile,link,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertReviewLock} from './phase03-production-release.mjs';
import {inspectPhase02Seal} from './phase02-seal-gate.mjs';
import {validateStoryObjectWorkspace} from './validate-story-object.mjs';
import {validateStoryObjectCompositionWorkspace} from './validate-story-object-composition.mjs';
import {compileWorkspace} from './compile-job-v5.mjs';
import {validateHandoffV2} from './validate-handoff-workspace-v2.mjs';
import {validateJob5Workspace} from './validate-job5-import-gate.mjs';
import {lintSemanticAnimation,validateSemanticZip} from './validate-animation-semantics.mjs';
import {exportZodiacJobV2,canonicalPackageZipName} from './export-zodiac-job-v2.mjs';
import {validateZipFile} from './zip-core-v2.mjs';

export async function runPhase03Production({sourceRoot,outputDir,sign,concept,revision='1.0',patchVersion,reviewLock}={}){
 if(!sourceRoot||!outputDir||!sign||!concept)throw new Error('PHASE03_ARGUMENTS_REQUIRED');
 const approved=path.resolve(sourceRoot),dest=path.resolve(outputDir);
 // Repeat strict state/native review check even when a lock file already exists.
 // This happens before any staging, archive writes or output directory creation.
 const gate=await inspectPhase02Seal(approved);
 if(gate.status!=='SEAL_ELIGIBLE')throw new Error('PHASE03_STATE_EVIDENCE_BLOCKED '+JSON.stringify(gate.issues));
 await validateStoryObjectWorkspace(approved); // fail before staging/ZIP
 await validateStoryObjectCompositionWorkspace(approved); // object must not become environment/background
 const lockPath=reviewLock??path.join(approved,'.authoring','phase02-review-lock.json');
 const lock=JSON.parse(await readFile(lockPath,'utf8'));
 await assertReviewLock(approved,lock); // no staging or ZIP writes before this gate
 await mkdir(dest,{recursive:true});
 const scratch=await mkdtemp(path.join(dest,'.zodiac-production-handoff-'));
 const stage=path.join(scratch,'job'),tempZip=path.join(scratch,'output.zip');
 try{
  await mkdir(stage);
  for(const rel of ['production.json','design.md','narration.txt'])await cp(path.join(approved,rel),path.join(stage,rel));
  for(const rel of ['assets','publish'])await cp(path.join(approved,rel),path.join(stage,rel),{recursive:true});
  const {ir}=await compileWorkspace(stage,{sign,concept,revision,prune:true});
  await validateHandoffV2(stage); // schema, manifest/hash, asset set, fonts, visual-role size, captions
  await validateJob5Workspace(stage); // runner pre-import anchor semantics
  const p1=lintSemanticAnimation(ir).filter(x=>x.severity==='P1');
  if(p1.length)throw new Error('PRODUCTION_SEMANTIC_P1 '+JSON.stringify(p1.slice(0,20)));
  // Lower-level exporter executes sealed approvals, original source fingerprint,
  // production model round-trip, contact graph and publishing checks again.
  await exportZodiacJobV2(stage,tempZip,{sourceRoot:approved,reviewLock:lockPath});
  const zipQc=await validateZipFile(tempZip,stage);
  const semantic=await validateSemanticZip(tempZip);
  if(semantic.errors.length)throw new Error('PRODUCTION_ZIP_SEMANTIC_P1 '+semantic.errors.length);
  const filename=canonicalPackageZipName({sign,concept,patchVersion});
  const target=path.join(dest,filename);
  // Same-volume hard link publishes the checked ZIP atomically without overwriting.
  try{await link(tempZip,target);}catch(e){if(e.code==='EEXIST')throw new Error('PRODUCTION_ZIP_ALREADY_EXISTS '+target);throw e;}
  return {ok:true,release_level:'PRODUCTION_READY_ZIP',zip:target,scenes:ir.scenes.length,events:ir.scenes.reduce((n,s)=>n+s.events.length,0),assets:Object.keys(ir.assets).length,archive_entries:zipQc.entries,post_zip_semantic_p1:0,runner_media_verified:false};
 }finally{await rm(scratch,{recursive:true,force:true});}
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
 try{const result=await runPhase03Production({sourceRoot:arg('--source-workspace'),outputDir:arg('--output-dir'),sign:arg('--sign'),concept:arg('--concept'),revision:arg('--revision')??'1.0',patchVersion:arg('--patch-version'),reviewLock:arg('--review-lock')});console.log('PRODUCTION_READY_ZIP '+JSON.stringify(result));}
 catch(e){console.error('PHASE03_PRODUCTION_BLOCKED '+e.message);process.exitCode=1;}
}
