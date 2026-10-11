#!/usr/bin/env node
// The only public Phase-03 export entrypoint. Stages a sealed Phase-02 source,
// compiles it to Job@5, validates *all* deterministic contracts, then moves one
// independently checked ZIP into the output directory.
import {commitPhase03Release} from './commit-phase03-release.mjs';
import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createHash} from 'node:crypto';
import {episodeIdentity as identityForScope,episodeHandoffWorkspace} from './episode-handoff.mjs';
import {buildHandoffReceipt} from './handoff-receipt.mjs';
import {writeArtifact} from './phase01-artifacts.mjs';
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

export async function publishCheckedZip(tempZip,target,persistReceipt){await persistReceipt();try{await link(tempZip,target);}catch(e){if(e.code==='EEXIST')throw new Error('PRODUCTION_ZIP_ALREADY_EXISTS '+target);throw e;}}

export async function runPhase03Production({sourceRoot,outputDir,sign,concept,episodeScope,revision='1.0',patchVersion,reviewLock}={}){
 if(!sourceRoot||!outputDir||(!sign&&!episodeScope)||!concept)throw new Error('PHASE03_ARGUMENTS_REQUIRED');
 const approved=path.resolve(sourceRoot),dest=path.resolve(outputDir);
 const episode=await episodeHandoffWorkspace(approved,{cover:true});let episodeIdentity;
 if(episode.status==='VALID'){if(!episodeScope||path.resolve(episodeScope)!==path.join(approved,'.authoring/episode-scope.json'))throw Error('APPROVED_EPISODE_SCOPE_REQUIRED');if(sign)throw Error('EPISODE_SIGN_ARGUMENT_FORBIDDEN');episodeIdentity=identityForScope(episode.scope,concept);}
 else if(episodeScope)throw Error('EPISODE_NARRATIVE_REQUIRED');
 // Repeat strict state/native review check even when a lock file already exists.
 // This happens before any staging, archive writes or output directory creation.
 const gate=await inspectPhase02Seal(approved);
 if(gate.status!=='SEAL_ELIGIBLE')throw new Error('PHASE03_STATE_EVIDENCE_BLOCKED '+JSON.stringify(gate.issues));
 await validateStoryObjectWorkspace(approved); // fail before staging/ZIP
 await validateStoryObjectCompositionWorkspace(approved); // object must not become environment/background
 const stateBefore=await readFile(path.join(approved,'.authoring/pipeline-state.json'));const expectedStateHash=createHash('sha256').update(stateBefore).digest('hex');
 const lockPath=reviewLock??path.join(approved,'.authoring','phase02-review-lock.json');
 const lock=JSON.parse(await readFile(lockPath,'utf8'));
 await assertReviewLock(approved,lock); // no staging or ZIP writes before this gate
 await mkdir(dest,{recursive:true});
 const scratch=await mkdtemp(path.join(dest,'.zodiac-production-handoff-'));
 const filename=canonicalPackageZipName({sign,concept,episodeIdentity,patchVersion});const stage=path.join(scratch,'job'),tempZip=path.join(scratch,filename);
 try{
  await mkdir(stage);
  for(const rel of ['production.json','design.md','narration.txt'])await cp(path.join(approved,rel),path.join(stage,rel));
  await cp(path.join(approved,'publish'),path.join(stage,'publish'),{recursive:true});
  // Stage the reviewed registry, not stale unregistered SVGs left by older runs.
  // Source files stay intact; compileWorkspace subsequently prunes unused registered assets.
  const sourceProduction=JSON.parse(await readFile(path.join(approved,'production.json'),'utf8'));
  for(const asset of Object.values(sourceProduction.assets??{})){
   const rel=asset.path;
   if(typeof rel!=='string'||!rel.startsWith('assets/')||rel.includes('\\')||rel.split('/').some(p=>p==='..'||p===''))throw Error('PHASE03_ASSET_PATH_INVALID');
   await mkdir(path.dirname(path.join(stage,rel)),{recursive:true});
   await cp(path.join(approved,rel),path.join(stage,rel));
  }
  const nativeReceipts=[];const releaseRun=randomUUID();
  const recordValidator=(capability_id,tool,args)=>{const rel='phase03-validator-'+releaseRun+'-'+capability_id+'.json',receipt=path.join(approved,'.authoring',rel);const run=spawnSync(process.execPath,[fileURLToPath(new URL('./run-validator-with-receipt.mjs',import.meta.url)),capability_id,receipt,fileURLToPath(new URL('./'+tool,import.meta.url)),...args],{encoding:'utf8',timeout:60000});if(run.status!==0)throw Error('PHASE03_NATIVE_VALIDATOR_FAILED '+capability_id+' '+run.stderr);nativeReceipts.push({capability_id,receipt_path:rel});};
  const identityFile=path.join(scratch,'episode-identity.json');if(episodeIdentity){const {writeFile}=await import('node:fs/promises');await writeFile(identityFile,JSON.stringify(episodeIdentity));}
  const {ir}=await compileWorkspace(stage,{sign,concept,episodeIdentity,revision,prune:true});
  recordValidator('handoff_v2_workspace_validation','validate-handoff-workspace-v2.mjs',[stage]);await validateHandoffV2(stage); // schema, manifest/hash, asset set, fonts, visual-role size, captions
  await validateJob5Workspace(stage); // runner pre-import anchor semantics
  const p1=lintSemanticAnimation(ir).filter(x=>x.severity==='P1');
  if(p1.length)throw new Error('PRODUCTION_SEMANTIC_P1 '+JSON.stringify(p1.slice(0,20)));
  // Lower-level exporter executes sealed approvals, original source fingerprint,
  // production model round-trip, contact graph and publishing checks again.
  await exportZodiacJobV2(stage,tempZip,{sourceRoot:approved,reviewLock:lockPath});
  recordValidator('pre_export_v2_workspace_validation','validate-handoff-workspace-v2.mjs',[stage]);
  recordValidator('job5_zip_roundtrip_validation','validate-zodiac-job-zip-v2.mjs',[tempZip,stage,'--sign',sign??episodeIdentity.episode_id??'episode','--concept',concept,...(patchVersion?['--patch-version',patchVersion]:[]),...(episodeIdentity?['--episode-identity',identityFile]:[])]);
  const zipQc=await validateZipFile(tempZip,stage);
  const semantic=await validateSemanticZip(tempZip);
  if(semantic.errors.length)throw new Error('PRODUCTION_ZIP_SEMANTIC_P1 '+semantic.errors.length);
  const target=path.join(dest,filename);
  const handoff=await buildHandoffReceipt({zip:tempZip,source_sha256:lock.source_sha256??lock.source?.sha256??lock.fingerprint?.sha256,scenes:ir.scenes.length,events:ir.scenes.reduce((n,s)=>n+s.events.length,0),assets:Object.keys(ir.assets).length});
  handoff.validator_receipts=nativeReceipts;
  handoff.native_substages=['compile','handoff','import_gate','export','roundtrip','semantic'].map(id=>({id,status:'PASS',zip_sha256:handoff.zip_sha256}));
  const receiptName='phase03-handoff-'+handoff.zip_sha256+'.json';
  // Write-ahead receipt survives a crash immediately after atomic ZIP publication.
  await publishCheckedZip(tempZip,target,()=>writeArtifact(approved,receiptName,handoff));
  const receiptStatus='WRITTEN';
  let stateCommit={status:'PENDING'};if(receiptStatus==='WRITTEN'){try{stateCommit=await commitPhase03Release(approved,handoff,target,{expected_state_sha256:expectedStateHash});}catch(e){stateCommit={status:'RECOVERY_REQUIRED',reason:e.message};}}
  return {state_commit:stateCommit,handoff,handoff_receipt_status:receiptStatus,handoff_receipt:receiptStatus==='WRITTEN'?path.join(approved,'.authoring',receiptName):null,ok:true,release_level:'PRODUCTION_READY_ZIP',zip:target,scenes:ir.scenes.length,events:ir.scenes.reduce((n,s)=>n+s.events.length,0),assets:Object.keys(ir.assets).length,archive_entries:zipQc.entries,post_zip_semantic_p1:0,runner_media_verified:false};
 }finally{await rm(scratch,{recursive:true,force:true});}
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const arg=name=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
 try{const result=await runPhase03Production({sourceRoot:arg('--source-workspace'),outputDir:arg('--output-dir'),sign:arg('--sign'),episodeScope:arg('--episode-scope'),concept:arg('--concept'),revision:arg('--revision')??'1.0',patchVersion:arg('--patch-version'),reviewLock:arg('--review-lock')});console.log('PRODUCTION_READY_ZIP '+JSON.stringify(result));}
 catch(e){console.error('PHASE03_PRODUCTION_BLOCKED '+e.message);process.exitCode=1;}
}
