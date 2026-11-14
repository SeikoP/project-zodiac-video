#!/usr/bin/env node
// P0 bridge: route to the ONE canonical Phase 1 importer/validator.
// Protocol: one JSON value on stdout, failures only on stderr + nonzero exit.
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectPhase1Handoff,materializePhase1Handoff} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/import-phase1-handoff.mjs';
import {assertContentApprovalSources,approvalSourceHashes} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/evidence/approval-source-hashes.mjs';

const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const sourceFiles={
 narration:'narration.txt',
 plan:'.authoring/narrative-plan.json',
 scope:'.authoring/episode-scope.json',
 brief:'.authoring/phase3-writer-brief.json',
 voice:'.authoring/voice-profile.json'
};
const rawSourceNames={
 narration:'narration.txt',
 plan:'narrative-plan.json',
 scope:'episode-scope.json',
 brief:'writer-brief.json',
 voice:'voice-profile.json'
};
function assertApproved(inspected){
 const {manifest,entries}=inspected;
 if(manifest.contract_major!==2)throw Error('STUDIO_HANDOFF_V2_REQUIRED');
 const payload=new Map(entries.map(x=>[x.rel,x.data]));
 const receipt=JSON.parse(payload.get('content-review-receipt.json').toString('utf8'));
 if(receipt.status!=='APPROVED'||receipt.phase_id!=='01-content'||
    receipt.run_id!==manifest.run_id||receipt.proof?.kind!=='user_message'||
    !String(receipt.proof.ref||'').trim())throw Error('STUDIO_CONTENT_REVIEW_INVALID');
 for(const k of Object.keys(sourceFiles)){
   const digest=sha(payload.get(rawSourceNames[k]));
   if(receipt.source_hashes?.[k]!==digest||
      manifest.content_review?.source_hashes?.[k]!==digest)
     throw Error('CONTENT_APPROVAL_SOURCE_DRIFT '+k);
 }
 if(JSON.stringify(receipt.proof)!==JSON.stringify(manifest.content_review.proof))
   throw Error('STUDIO_CONTENT_REVIEW_PROOF_MISMATCH');
 const verified=Object.fromEntries(Object.keys(sourceFiles).map(k=>[k,sha(payload.get(rawSourceNames[k]))]));
 const sourceSha=sha(Buffer.from(JSON.stringify({
   run_id:manifest.run_id,source_hashes:verified,proof_ref:receipt.proof.ref
 })));
 return {manifest,source_sha256:sourceSha,approved_source_hashes:verified};
}
async function inspect(zipPath){
 const inspected=await inspectPhase1Handoff(zipPath);
 const approved=assertApproved(inspected);
 return {...approved,manifest_sha256:sha(inspected.entries.find(x=>x.rel==='HANDOFF.json').data),
   capsule_sha256:sha(await readFile(zipPath))};
}
async function verifyWorkspace(zipPath,workspace){
 const expected=await inspect(zipPath);
 const {manifest}=expected;
 const hashes=await approvalSourceHashes(workspace);
 for(const [k,digest] of Object.entries(expected.approved_source_hashes)){
   if(hashes[k]!==digest)throw Error('STUDIO_MATERIALIZED_SOURCE_DRIFT '+k);
 }
 const stored=JSON.parse(await readFile(path.join(workspace,'.authoring','content-review-receipt.json'),'utf8'));
 if(JSON.stringify(stored.proof)!==JSON.stringify(manifest.content_review.proof))
   throw Error('STUDIO_MATERIALIZED_RECEIPT_DRIFT');
 const state=JSON.parse(await readFile(path.join(workspace,'.authoring','pipeline-state.json'),'utf8'));
 if((await assertContentApprovalSources(workspace,state)).status!=='BOUND')
   throw Error('STUDIO_APPROVAL_NOT_BOUND');
 if(state.run_id!==manifest.run_id)throw Error('STUDIO_MATERIALIZED_RUN_DRIFT');
 return {...expected,verified:true};
}
async function main(){
 const [command,zip,workspace]=process.argv.slice(2);
 if(!['inspect','materialize','verify'].includes(command)||!zip||
    ((command==='materialize'||command==='verify')&&!workspace))
   throw Error('STUDIO_HANDOFF_USAGE inspect|materialize|verify <capsule.zip> [workspace]');
 if(command==='inspect')return inspect(zip);
 if(command==='verify')return verifyWorkspace(zip,workspace);
 // Canonical materialize performs pipeline-state synthesis and source-bound validation.
 await materializePhase1Handoff(zip,workspace);
 return verifyWorkspace(zip,workspace);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().then(result=>console.log(JSON.stringify({ok:true,...result})))
   .catch(error=>{console.error(String(error?.message??error));process.exitCode=2;});
}
