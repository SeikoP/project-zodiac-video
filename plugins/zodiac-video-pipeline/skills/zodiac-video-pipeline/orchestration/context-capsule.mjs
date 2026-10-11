#!/usr/bin/env node
// Small, read-only resume capsule; persisted pipeline-state.json remains canonical.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const hex=data=>createHash('sha256').update(data).digest('hex');
const reserved=['.authoring/visual-intent.json','.authoring/visual-intent-projection-receipt.json','.authoring/episode-scope.json','.authoring/narrative-plan.json','.authoring/scene-composition-resolved.json','.authoring/generated-assets.json','.authoring/story-beat-choreography.json','design.md','.authoring/scene-art-direction.json','narration.txt','production.json','asset-plan.json','visual-grammar-plan.json','.authoring/director-plan.json','.authoring/character-assembly-plan.json','.authoring/story-object-plan.json','.authoring/depth-composition-plan.json','publish/publish.json'];
export function compactState(state,shaByPath={}){
 if(!state||state.format!=='zodiac-pipeline-state@2')throw new Error('CAPSULE_STATE_INVALID');
 const phase=state.current_phase;const ss=state.phases?.[phase];
 if(!ss)throw new Error('CAPSULE_ACTIVE_PHASE_MISSING');
 const step=ss.current_step;const stepState=ss.steps?.[step];
 if(!stepState)throw new Error('CAPSULE_ACTIVE_STEP_MISSING');
 const all=(state.operations??[]);
 const done=all.filter(o=>o.phase_id===phase&&o.step_id===step).map(o=>({kind:o.kind,path:o.path}));
 const receipts=(stepState.capability_receipts??[]).map(r=>({id:r.capability_id,status:r.status,proof_ref:r.proof?.ref??null}));
 return {format:'zodiac-context-capsule@1',authoritative_state:'.authoring/pipeline-state.json',
   run_id:state.run_id,plugin_version:state.plugin_version,phase,step,status:stepState.status,
   inputs:shaByPath,operations:done,receipt_refs:receipts,
   review_approval_refs:(state.review_receipts??[]).map(x=>({phase:x.phase_id,status:x.status,ref:x.proof?.ref??null})),
   blockers:(stepState.blockers??[]).slice(0,20),
   warning:'Read-only context digest, never approval, validation receipt or serialized pipeline state'};
}
export async function capsuleWorkspace(root){
 const statePath=path.join(root,'.authoring/pipeline-state.json');
 const raw=await readFile(statePath);
 const state=JSON.parse(raw.toString('utf8'));
 const shaByPath={};
 for(const rel of reserved){try{const content=await readFile(path.join(root,rel));shaByPath[rel]=hex(content);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const capsule=compactState(state,shaByPath);
 return {...capsule,state_sha256:hex(raw)};
}
const self=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(self){
 try {const a=process.argv.slice(2),root=a[0];if(!root)throw new Error('Usage: node context-capsule.mjs <workspace> [--output <file>]');
  const result=await capsuleWorkspace(path.resolve(root));const out=a.indexOf('--output');
  if(out>=0){if(!a[out+1])throw new Error('CAPSULE_OUTPUT_PATH_MISSING');const dest=path.resolve(a[out+1]);await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify(result,null,2));
 }catch(e){console.error('CONTEXT_CAPSULE_BLOCKED '+e.message);process.exitCode=2;}
}
