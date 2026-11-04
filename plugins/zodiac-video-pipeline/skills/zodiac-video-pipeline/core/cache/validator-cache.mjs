import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import path from 'node:path';
import {sha256,cacheRoot} from './incremental-cache.mjs';
const exists=p=>access(p).then(()=>true,()=>false);
export async function validatorFingerprint({validator,args=[],declaredInputs=[],declaredOutputs=[]}){
 const validator_sha256=sha256(await readFile(validator)),args_sha256=sha256(JSON.stringify(args)),inputs={},outputs={};
 for(const p of declaredInputs)inputs[p]=await exists(p)?sha256(await readFile(p)):null;
 for(const p of declaredOutputs)outputs[p]=await exists(p)?sha256(await readFile(p)):null;
 return {validator_sha256,args_sha256,inputs,outputs};
}
export async function readValidatorCache(workspace,capabilityId,fingerprint){
 const key=sha256(JSON.stringify(fingerprint)),file=path.join(cacheRoot(workspace),'validation',capabilityId,key+'.json');
 try{const receipt=JSON.parse(await readFile(file,'utf8'));return receipt.status==='PASS'?{hit:true,key,receipt,file}:{hit:false,key,file};}catch(e){if(e.code==='ENOENT')return {hit:false,key,file};throw e;}
}
export async function writeValidatorCache(workspace,capabilityId,fingerprint,receipt){
 const key=sha256(JSON.stringify(fingerprint)),file=path.join(cacheRoot(workspace),'validation',capabilityId,key+'.json');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify({...receipt,cache_key:key},null,2)+'\n');return {key,file};
}
