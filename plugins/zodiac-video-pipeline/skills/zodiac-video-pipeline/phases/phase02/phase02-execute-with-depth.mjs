#!/usr/bin/env node
// Optional native depth path; requires substantive authored plan.
// No approval writes, fake receipts, default visual choices or new ZIPs.
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const home=path.dirname(fileURLToPath(import.meta.url));
export const stages=[
  {id:'transition',script:'phases/phase02/phase02-transition-gate.mjs',args:w=>['--workspace',w]},
  {id:'native_environment',script:'references/asset-library-v4/environments/compile-environment.mjs',args:w=>[w,'--write']},
  {id:'native_depth',script:'features/visual-composition/compile-depth-composition.mjs',args:w=>[w,'--write']},
  {id:'depth_validation',script:'features/visual-composition/validate-depth-composition.mjs',args:w=>[w]},
  {id:'phase02_native',script:'phases/phase02/phase02-execute.mjs',args:(w,source)=>['--workspace',w,...(source?['--source-root',source]:[]),'--run']},
];
export function sourcePath(script){return path.resolve(home,'../..',script)}
export async function executeWithDepth({workspace,sourceRoot}={}){
 if(!workspace)throw new Error('DEPTH_WORKSPACE_REQUIRED');
 const root=path.resolve(workspace);
 await access(path.join(root,'.authoring/depth-composition-plan.json')).catch(()=>{throw new Error('DEPTH_PLAN_REQUIRED')});
 const trace=[];
 for(const step of stages){
  const command=[sourcePath(step.script),...step.args(root,sourceRoot)];
  const res=spawnSync(process.execPath,command,{encoding:'utf8',maxBuffer:8*1024*1024,timeout:240000});
  trace.push({step:step.id,code:res.status??2});
  if(res.stdout)process.stdout.write(res.stdout);
  if(res.stderr)process.stderr.write(res.stderr);
  if(res.status!==0)throw new Error('DEPTH_PHASE02_STAGE_FAILED '+step.id+' exit='+String(res.status??2));
 }
 return {status:'NATIVE_EXECUTION_COMPLETED_NOT_REVIEW_APPROVED',stages:trace};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),arg=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]};
 if(!args.includes('--run')){console.error('Usage: node phase02-execute-with-depth.mjs --workspace <dir> --run [--source-root <root>]');process.exitCode=2;}
 else try{console.log(JSON.stringify(await executeWithDepth({workspace:arg('--workspace'),sourceRoot:arg('--source-root')})));}
 catch(e){console.error(e.message);process.exitCode=2;}
}
