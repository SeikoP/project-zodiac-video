#!/usr/bin/env node
// Isolated native scene-direction compilation. Never writes approval receipts.
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,rename,rm,lstat,realpath,open,readdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
const hash=x=>createHash('sha256').update(typeof x==='string'||Buffer.isBuffer(x)?x:JSON.stringify(x)).digest('hex');
const sorted=x=>Array.isArray(x)?x.map(sorted):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,sorted(x[k])])):x;
const digest=x=>hash(sorted(x));
const safeId=id=>typeof id==='string'&&/^[A-Za-z0-9_-]{1,110}$/.test(id);
const readJson=async p=>JSON.parse(await readFile(p,'utf8'));
const atomic=async(p,bytes)=>{await mkdir(path.dirname(p),{recursive:true});const t=p+'.'+process.pid+'.tmp';await writeFile(t,bytes);await rename(t,p);};
const skillRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const sources=[path.join(skillRoot,'references/asset-library-v4/scene-direction/compile-scene-direction.mjs'),path.join(skillRoot,'references/asset-library-v4/scene-direction/compile-scene-direction-core.mjs'),path.join(skillRoot,'references/asset-library-v4/scene-direction/compiler-profile.json'),path.join(skillRoot,'references/asset-library-v4/environments/environment-frame-v2.mjs'),fileURLToPath(import.meta.url),path.join(path.dirname(fileURLToPath(import.meta.url)),'native-scene-worker.mjs')];
const sourceHash=async()=>{
 const extra=[];
 for(const dir of ['references/asset-library-v4/environments','references/asset-library-v4/scene-direction']){
  const root=path.join(skillRoot,dir);
  for(const e of await readdir(root,{withFileTypes:true})){if(e.isFile()&&/\.(?:mjs|json)$/u.test(e.name)&&!e.name.includes('.test.'))extra.push(path.join(root,e.name));}
 }
 return digest(await Promise.all([...new Set([...sources,...extra])].sort().map(async p=>[path.relative(skillRoot,p),hash(await readFile(p))])));
};
async function referencedAssets(scene,assets,root){
 const refs=new Set();const visit=v=>{if(typeof v==='string'){if(Object.hasOwn(assets,v))refs.add(v);}else if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')Object.values(v).forEach(visit);};visit(scene);
 const entries=[];
 for(const id of [...refs].sort()){
  const a=assets[id];if(!a?.path)throw Error('SCENE_ASSET_PATH_MISSING '+id);
  const rel=String(a.path).replaceAll('\\','/');if(path.isAbsolute(rel)||rel.split('/').includes('..')||rel.includes(':'))throw Error('SCENE_ASSET_PATH_UNSAFE '+id);
  const abs=path.resolve(root,rel),real=await realpath(abs);if(!real.startsWith(root+path.sep))throw Error('SCENE_ASSET_PATH_UNSAFE '+id);
  const st=await lstat(real);if(!st.isFile())throw Error('SCENE_ASSET_INVALID '+id);
  entries.push([id,a,hash(await readFile(real))]);
 }
 return entries;
}
const signature=scenes=>hash(JSON.stringify(scenes.map(x=>x.signature)));
const command=(worker,input,output)=>new Promise((resolve,reject)=>{
 const p=spawn(process.execPath,[worker,input,output],{stdio:['ignore','ignore','pipe']});let error='';
 p.stderr.on('data',d=>{error=(error+String(d)).slice(-5000)});
 p.on('error',reject);p.on('close',code=>code===0?resolve():reject(Error('SCENE_WORKER_FAILED '+code+' '+error)));
});
export async function compileIsolatedScenes(workspace,{maxConcurrency=3,compileOne=null,workerScript=null,production=null,sourceFingerprint=null,profileVersion=null,executionMode='auto'}={}){
 const totalStart=performance.now();
 if(!['auto','process','in_process'].includes(executionMode))throw Error('SCENE_NATIVE_EXECUTION_MODE_INVALID');
 if(!Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>8)throw Error('SCENE_NATIVE_CONCURRENCY_INVALID');
 const root=path.resolve(workspace),source=production??await readJson(path.join(root,'production.json'));
 if(source?.version!=='2.0'||!Array.isArray(source.scenes)||!source.scenes.length)throw Error('SCENE_NATIVE_PRODUCTION_INVALID');
 const ids=source.scenes.map(s=>s.id);if(ids.some(id=>!safeId(id))||new Set(ids).size!==ids.length)throw Error('SCENE_NATIVE_IDS_INVALID');
 const compiler=sourceFingerprint??await sourceHash();
 // Short scene-direction passes are I/O-light; spawning Node for each scene adds avoidable overhead.
 // Larger jobs preserve worker-process isolation and bounded parallelism.
 const mode=compileOne?'injected':executionMode==='auto'?(source.scenes.length<=3?'in_process':'process'):executionMode;
 const cachePath=path.join(root,'.authoring/scene-native-cache.json');let prior={};try{const c=await readJson(cachePath);if(c.format==='zodiac-scene-native-cache@1')prior=c.entries??{};}catch(e){if(e.code!=='ENOENT')throw e;}
 const workdir=path.join(root,'.authoring/scene-native-work',process.pid+'-'+Date.now());
 const lockPath=path.join(root,'.authoring/.scene-native.lock');
 const lease=await open(lockPath,'wx').catch(e=>{if(e.code==='EEXIST')throw Error('SCENE_NATIVE_ALREADY_RUNNING');throw e;});
 await mkdir(workdir,{recursive:true});
 try{
 const rows=await Promise.all(source.scenes.map(async(s,index)=>{
  const assets=await referencedAssets(s,source.assets??{},root);
  const input=digest({scene:s,version:source.version,visual_system:source.visual_system,asset_hashes:assets,compiler});
  const old=prior[s.id],alreadyCompiled=old?.output_sha256===digest(s),sameSource=old?.input_sha256===input||alreadyCompiled,
   reusable=sameSource&&old?.compiler_sha256===compiler&&old?.assets_sha256===digest(assets)&&old?.result&&old?.result_sha256===digest(old.result)&&(!alreadyCompiled||old?.output_sha256===digest(old.result))&&old?.receipt?.scene_id===s.id&&old?.result?.id===s.id;
  return {scene_id:s.id,index,input,assets,old,reuse:reusable||false,alreadyCompiled:alreadyCompiled||false};
 }));
 const results=new Array(rows.length),receipts=new Array(rows.length),events=[];
 const nativeStarted=performance.now();
 let cursor=0;
 const run=async()=>{while(cursor<rows.length){const row=rows[cursor++],scene=source.scenes[row.index];
  if(row.reuse){results[row.index]=row.alreadyCompiled?scene:row.old.result;receipts[row.index]=row.old.receipt;events.push({scene_id:row.scene_id,action:'reuse'});continue;}
  const input=path.join(workdir,row.scene_id+'.input.json'),output=path.join(workdir,row.scene_id+'.output.json');
  const snapshot={...source,scenes:[scene]};if(mode==='process')await writeFile(input,JSON.stringify(snapshot));
  let directResult=null;
  if(compileOne){directResult=await compileOne(snapshot,{sceneId:row.scene_id,index:row.index,root});}
  else if(mode==='in_process'){const {compileProduction}=await import('../../references/asset-library-v4/scene-direction/compile-scene-direction-core.mjs');directResult=await compileProduction(snapshot,{root});}
  else await command(workerScript??path.join(path.dirname(fileURLToPath(import.meta.url)),'native-scene-worker.mjs'),input,output);
  const compiled=directResult??await readJson(output),item=compiled?.production?.scenes?.[0],receipt=compiled?.receipt?.scenes?.[0];
  if(compiled?.production?.scenes?.length!==1||item?.id!==row.scene_id||receipt?.scene_id!==row.scene_id||typeof receipt.signature!=='string')throw Error('SCENE_WORKER_OUTPUT_INVALID '+row.scene_id);
  results[row.index]=item;receipts[row.index]=receipt;events.push({scene_id:row.scene_id,action:'compile'});
 }};
  await Promise.all(Array.from({length:Math.min(maxConcurrency,rows.length)},run));
  // Source integrity: workers must not mutate shared production or referenced asset bytes.
  const latest=await readFile(path.join(root,'production.json'));if(production===null&&digest(JSON.parse(latest))!==digest(source))throw Error('SCENE_NATIVE_SOURCE_CHANGED_DURING_RUN');
  for(const row of rows){const now=await referencedAssets(source.scenes[row.index],source.assets??{},root);if(digest(now)!==digest(row.assets))throw Error('SCENE_NATIVE_ASSET_CHANGED_DURING_RUN '+row.scene_id);}
  const merged={...source,scenes:results};
  const receipt={format:'zodiac-scene-direction-compile-receipt@1',compiler_version:profileVersion??(await readJson(path.join(skillRoot,'references/asset-library-v4/scene-direction/compiler-profile.json'))).version,production_version:merged.version,scenes:receipts,signature:signature(receipts)};
  const entries=Object.fromEntries(rows.map(row=>[row.scene_id,{input_sha256:row.reuse?row.old.input_sha256:row.input,compiler_sha256:compiler,assets_sha256:digest(row.assets),output_sha256:digest(results[row.index]),result:results[row.index],result_sha256:digest(results[row.index]),receipt:receipts[row.index]}]));
  const cache={format:'zodiac-scene-native-cache@1',compiler_sha256:compiler,entries};
  const compileWallMs=Math.round(performance.now()-nativeStarted);
  const nativeReceipt={format:'zodiac-scene-native-receipt@1',status:'PASS',execution_mode:mode,compile_wall_ms:compileWallMs,cache_hit_count:rows.filter(r=>r.reuse).length,cache_miss_count:rows.filter(r=>!r.reuse).length,compiler_sha256:compiler,scene_count:rows.length,scenes:rows.map(row=>({scene_id:row.scene_id,input_sha256:entries[row.scene_id].input_sha256,output_sha256:entries[row.scene_id].output_sha256,action:row.reuse?'reuse':'compile',native_compiled:true,preview_verified:false})),not_an_approval:true,native_review_required:true};
  const target=path.join(root,'production.json'),receiptPath=path.join(root,'.authoring/scene-direction-compile-receipt.json'),nativeReceiptPath=path.join(root,'.authoring/scene-native-receipt.json');
  // Do not publish partial state on worker failure. A lease is held by Phase-02 coordinator.
  const original=await readFile(target).catch(e=>{if(production!==null&&e.code==='ENOENT')return null;throw e;});
  const receiptOld=await readFile(receiptPath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  const cacheOld=await readFile(cachePath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  const nativeReceiptOld=await readFile(nativeReceiptPath).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
  try{await atomic(target,JSON.stringify(merged,null,2)+'\n');await atomic(receiptPath,JSON.stringify(receipt,null,2)+'\n');await atomic(cachePath,JSON.stringify(cache,null,2)+'\n');await atomic(nativeReceiptPath,JSON.stringify(nativeReceipt,null,2)+'\n');}
  catch(e){
   if(original!==null)await atomic(target,original);else await rm(target,{force:true});
   if(receiptOld!==null)await atomic(receiptPath,receiptOld);else await rm(receiptPath,{force:true});
   if(cacheOld!==null)await atomic(cachePath,cacheOld);else await rm(cachePath,{force:true});
   if(nativeReceiptOld!==null)await atomic(nativeReceiptPath,nativeReceiptOld);else await rm(nativeReceiptPath,{force:true});
   throw e;
  }
  return {status:'PASS',execution_mode:mode,compile_wall_ms:compileWallMs,total_wall_ms:Math.round(performance.now()-totalStart),scene_count:rows.length,compiled:rows.filter(r=>!r.reuse).map(r=>r.scene_id),reused:rows.filter(r=>r.reuse).map(r=>r.scene_id),receipt:receiptPath,native_receipt:nativeReceiptPath,compiler_sha256:compiler,not_an_approval:true};
 }finally{await rm(workdir,{recursive:true,force:true}).catch(()=>{});await lease.close();await rm(lockPath,{force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: native-scene-executor.mjs <workspace> [--max-concurrency N]');process.exitCode=2;}
 else try{const i=process.argv.indexOf('--max-concurrency'),n=i<0?3:Number(process.argv[i+1]);console.log(JSON.stringify(await compileIsolatedScenes(root,{maxConcurrency:n}),null,2));}catch(e){console.error('SCENE_NATIVE_BLOCKED '+e.message);process.exitCode=2;}
}
