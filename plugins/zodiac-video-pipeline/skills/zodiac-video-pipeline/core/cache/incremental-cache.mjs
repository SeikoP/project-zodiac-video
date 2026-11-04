import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,rm,access,stat} from 'node:fs/promises';
import path from 'node:path';

export const CACHE_FORMAT='zodiac-incremental-cache@1';
export const CACHE_REASON=Object.freeze({
 HIT_EXACT:'HIT_EXACT',
 MISS_INPUT_CHANGED:'MISS_INPUT_CHANGED',
 MISS_DEPENDENCY_CHANGED:'MISS_DEPENDENCY_CHANGED',
 MISS_COMPILER_CHANGED:'MISS_COMPILER_CHANGED',
 MISS_ASSET_CHANGED:'MISS_ASSET_CHANGED',
 MISS_OUTPUT_MISSING:'MISS_OUTPUT_MISSING',
 MISS_OUTPUT_TAMPERED:'MISS_OUTPUT_TAMPERED',
 MISS_VALIDATOR_CHANGED:'MISS_VALIDATOR_CHANGED',
 INVALIDATED_BY_APPROVAL_CHANGE:'INVALIDATED_BY_APPROVAL_CHANGE',
 MISS_NOT_RECORDED:'MISS_NOT_RECORDED'
});
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'&&!Buffer.isBuffer(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export const sha256=x=>createHash('sha256').update(Buffer.isBuffer(x)||typeof x==='string'?x:JSON.stringify(canonical(x))).digest('hex');
const exists=p=>access(p).then(()=>true,()=>false);
const atomicWrite=async(file,data)=>{await mkdir(path.dirname(file),{recursive:true});const tmp=file+'.tmp-'+process.pid+'-'+Date.now();await writeFile(tmp,data);await rename(tmp,file).catch(async e=>{await rm(tmp,{force:true});throw e;});};

export async function fileSha256(file){return sha256(await readFile(file));}
export async function hashExistingFiles(files,{base=null}={}){
 const out={};
 for(const entry of [...new Set(files)].sort()){
  const file=base&&!path.isAbsolute(entry)?path.join(base,entry):entry;
  if(!await exists(file)){out[entry]=null;continue;}
  const s=await stat(file);out[entry]=s.isFile()?await fileSha256(file):null;
 }
 return out;
}
export function cacheRoot(workspace){return path.join(path.resolve(workspace),'.authoring','cache');}
export async function readCacheGraph(workspace){
 const file=path.join(cacheRoot(workspace),'graph.json');
 try{const graph=JSON.parse(await readFile(file,'utf8'));if(graph.format!==CACHE_FORMAT)throw Error('CACHE_GRAPH_FORMAT_INVALID');return graph;}
 catch(e){if(e.code==='ENOENT')return {format:CACHE_FORMAT,plugin_version:null,nodes:{}};throw e;}
}
export async function writeCacheGraph(workspace,graph){await atomicWrite(path.join(cacheRoot(workspace),'graph.json'),JSON.stringify({...graph,format:CACHE_FORMAT},null,2)+'\n');}
export async function putObject(workspace,bytes){
 const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);const digest=sha256(data),file=path.join(cacheRoot(workspace),'objects',digest);
 if(!await exists(file))await atomicWrite(file,data);
 else if(await fileSha256(file)!==digest)throw Error('CACHE_OBJECT_TAMPERED '+digest);
 return {sha256:digest,path:file,bytes:data.length};
}
export async function readObject(workspace,digest){
 const file=path.join(cacheRoot(workspace),'objects',digest);if(!await exists(file))return null;
 const data=await readFile(file);if(sha256(data)!==digest)throw Error('CACHE_OBJECT_TAMPERED '+digest);return data;
}
export function nodeFingerprint({input,compiler,dependencies={},assets={}}){
 return {input_sha256:sha256(input),compiler_sha256:sha256(compiler),dependency_sha256:Object.fromEntries(Object.entries(dependencies).sort()),asset_sha256:Object.fromEntries(Object.entries(assets).sort())};
}
const mapEqual=(a={},b={})=>JSON.stringify(Object.fromEntries(Object.entries(a).sort()))===JSON.stringify(Object.fromEntries(Object.entries(b).sort()));
export async function evaluateCacheNode(workspace,{nodeId,input,compiler,dependencies={},assets={},outputs=[],validator=false}){
 const graph=await readCacheGraph(workspace),previous=graph.nodes?.[nodeId],fp=nodeFingerprint({input,compiler,dependencies,assets});
 if(!previous)return {hit:false,reason:CACHE_REASON.MISS_NOT_RECORDED,fingerprint:fp,previous:null};
 if(previous.input_sha256!==fp.input_sha256)return {hit:false,reason:CACHE_REASON.MISS_INPUT_CHANGED,fingerprint:fp,previous};
 if(previous.compiler_sha256!==fp.compiler_sha256)return {hit:false,reason:validator?CACHE_REASON.MISS_VALIDATOR_CHANGED:CACHE_REASON.MISS_COMPILER_CHANGED,fingerprint:fp,previous};
 if(!mapEqual(previous.dependency_sha256,fp.dependency_sha256))return {hit:false,reason:CACHE_REASON.MISS_DEPENDENCY_CHANGED,fingerprint:fp,previous};
 if(!mapEqual(previous.asset_sha256,fp.asset_sha256))return {hit:false,reason:CACHE_REASON.MISS_ASSET_CHANGED,fingerprint:fp,previous};
 const current=await hashExistingFiles(outputs,{base:workspace});
 if(Object.values(current).some(v=>v===null))return {hit:false,reason:CACHE_REASON.MISS_OUTPUT_MISSING,fingerprint:fp,previous};
 if(!mapEqual(previous.output_sha256,current))return {hit:false,reason:CACHE_REASON.MISS_OUTPUT_TAMPERED,fingerprint:fp,previous,current_outputs:current};
 return {hit:true,reason:CACHE_REASON.HIT_EXACT,fingerprint:fp,previous,current_outputs:current};
}
export async function recordCacheNode(workspace,{nodeId,input,compiler,dependencies={},assets={},outputs=[],status='PASS',meta={}}){
 const graph=await readCacheGraph(workspace),fp=nodeFingerprint({input,compiler,dependencies,assets}),output_sha256=await hashExistingFiles(outputs,{base:workspace});
 if(Object.values(output_sha256).some(v=>v===null))throw Error('CACHE_RECORD_OUTPUT_MISSING '+nodeId);
 graph.nodes??={};graph.nodes[nodeId]={node_id:nodeId,...fp,output_sha256,status,meta,updated_at:new Date().toISOString()};
 await writeCacheGraph(workspace,graph);return graph.nodes[nodeId];
}
export function propagateDirty(nodes,seedIds){
 const reverse=new Map();
 for(const [id,node] of Object.entries(nodes??{}))for(const dep of node.dependencies??[]){if(!reverse.has(dep))reverse.set(dep,new Set());reverse.get(dep).add(id);}
 const dirty=new Set(seedIds),queue=[...dirty];while(queue.length){const id=queue.shift();for(const child of reverse.get(id)??[])if(!dirty.has(child)){dirty.add(child);queue.push(child);}}
 return [...dirty];
}
export function summarizeCacheEvents(events=[]){
 const reused=events.filter(x=>x.reason===CACHE_REASON.HIT_EXACT),rebuilt=events.filter(x=>x.reason!==CACHE_REASON.HIT_EXACT);
 return {reused:reused.map(x=>x.node_id),rebuilt:rebuilt.map(x=>x.node_id),reasons:Object.fromEntries(rebuilt.map(x=>[x.node_id,x.reason]))};
}
