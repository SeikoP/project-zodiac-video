#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {normalizeMonetizationDecision} from './commerce-core.mjs';

const fail=code=>{throw new Error(code)};

export async function writeMonetizationDecision(workspace,value){
  const decision=normalizeMonetizationDecision(value);
  const dir=path.join(workspace,'.authoring','commerce');await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'monetization.json'),JSON.stringify(decision,null,2)+'\n');
  const statePath=path.join(workspace,'.authoring','pipeline-state.json');
  try{
    const state=JSON.parse(await readFile(statePath,'utf8'));
    state.flags={...(state.flags??{}),affiliate_enabled:decision.advertising};
    await writeFile(statePath,JSON.stringify(state,null,2)+'\n');
  }catch(e){if(e.code!=='ENOENT')throw e;}
  return decision;
}
export async function readMonetizationDecision(workspace){
  const p=path.join(workspace,'.authoring','commerce','monetization.json');
  return JSON.parse(await readFile(p,'utf8'));
}
export async function validateMonetizationDecision(workspace){
  const decision=await readMonetizationDecision(workspace);
  if(decision?.format!=='zodiac-monetization@1'||typeof decision.advertising!=='boolean')fail('MONETIZATION_DECISION_INVALID');
  if(decision.advertising&&decision.provider!=='kalodata')fail('KALODATA_PROVIDER_REQUIRED');
  const state=JSON.parse(await readFile(path.join(workspace,'.authoring','pipeline-state.json'),'utf8'));
  if(state?.flags?.affiliate_enabled!==decision.advertising)fail('AFFILIATE_FLAG_MISMATCH');
  return {status:'PASS',advertising:decision.advertising};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  let workspace=process.argv[2],value=process.argv[3];
  if(workspace==='check'){workspace=process.argv[3];value='check';}
  if(!workspace){console.error('Usage: node monetization-gate.mjs <workspace> <yes|no|check>');process.exit(2);}
  try{
    if(value==='check'){const r=await validateMonetizationDecision(path.resolve(workspace));console.log(`MONETIZATION_GATE_PASS advertising=${r.advertising}`);}
    else {const d=await writeMonetizationDecision(path.resolve(workspace),value);console.log(`MONETIZATION_GATE_PASS advertising=${d.advertising}${d.provider?` provider=${d.provider}`:''}`);}
  }catch(e){console.error('MONETIZATION_GATE_BLOCKED '+e.message);process.exit(1);}
}
