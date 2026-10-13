// Authoring-only ownership and transactional native compilation. Never shipped in Job@5.
import {readFile,writeFile,mkdir,lstat,readdir,rename,rm,cp,mkdtemp,open} from 'node:fs/promises';
import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';import path from 'node:path';import os from 'node:os';import {fileURLToPath} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error('GENERATED_ASSET_'+m);};
const json=async p=>JSON.parse(await readFile(p,'utf8'));
async function confined(root,rel,{assets=false}={}){
 if(typeof rel!=='string'||path.isAbsolute(rel)||rel.includes('\\')||rel.split('/').some(p=>p==='..'||p==='')||(assets&&!rel.startsWith('assets/')))fail('PATH_INVALID '+rel);
 const base=path.resolve(root),abs=path.resolve(base,rel);if(!abs.startsWith(base+path.sep))fail('PATH_INVALID');
 let current=base;for(const part of rel.split('/')){current=path.join(current,part);try{if((await lstat(current)).isSymbolicLink())fail('SYMLINK '+rel);}catch(e){if(e.code!=='ENOENT')throw e;}}
 return abs;
}
export function collectAssetReferences(production,publish){
 const used=new Set();for(const s of production.scenes??[])for(const e of s.entities??[])for(const state of Object.values(e.states??{}))if(state.asset)used.add(state.asset);
 const scene=production.scenes?.find(s=>s.id===publish?.cover?.source_scene_id);for(const v of publish?.cover?.visuals??[]){const asset=scene?.entities?.find(e=>e.id===v.entity_id)?.states?.[v.state_id]?.asset;if(asset)used.add(asset);}
 return used;
}
export function planGeneratedAssetReconcile({production,publish,previousOwnership,nextOwnership}){
 const used=collectAssetReferences(production,publish),previous=previousOwnership?.entries??[],next=nextOwnership?.entries??[],nextIds=new Set(next.map(e=>e.asset_id));
 const ownedIds=new Set([...previous,...next].map(e=>e.asset_id)),livePaths=new Set([...used].map(id=>production.assets?.[id]?.path).filter(Boolean));
 const retained=[],retired=[],blocked=[];
 for(const entry of previous){if(nextIds.has(entry.asset_id)||used.has(entry.asset_id)||livePaths.has(entry.path)){retained.push(entry);continue;}if(!entry.compiler_id||!entry.source_key||!/^[a-f0-9]{64}$/.test(entry.sha256??'')){blocked.push({asset_id:entry.asset_id,reason:'PROVENANCE_INVALID'});continue;}retired.push(entry);}
 return {retained,retired,unowned:Object.keys(production.assets??{}).filter(id=>!ownedIds.has(id)),blocked};
}
export async function applyGeneratedAssetReconcile(root,plan,{prune=false}={}){
 if(plan.blocked?.length)fail('RECONCILE_BLOCKED');if(!prune)return {...plan,quarantined:[]};
 const moves=[];for(const entry of plan.retired??[]){const src=await confined(root,entry.path,{assets:true}),dest=await confined(root,'.authoring/retired-assets/'+entry.path);const bytes=await readFile(src);if(hash(bytes)!==entry.sha256)fail('HASH_CHANGED '+entry.path);try{await lstat(dest);fail('QUARANTINE_EXISTS '+entry.path);}catch(e){if(e.code!=='ENOENT')throw e;}moves.push([src,dest]);}
 const done=[];try{for(const [src,dest] of moves){await mkdir(path.dirname(dest),{recursive:true});await rename(src,dest);done.push([src,dest]);}}catch(e){for(const [src,dest] of done.reverse())await rename(dest,src);throw e;}
 return {...plan,quarantined:moves.map(([,dest])=>dest)};
}
async function walk(root,rel=''){
 const out=[];for(const e of await readdir(path.join(root,rel),{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(e.isSymbolicLink())fail('SYMLINK '+p);if(e.isDirectory())out.push(...await walk(root,p));else if(e.isFile())out.push(p);}return out;
}
function generatedIds(production,compilerId,statePlan){
 if(compilerId==='character_write')return (statePlan?.characters??[]).flatMap(c=>c.groups.map(g=>g.asset_id));
 if(compilerId==='environment')return [...new Set((production.scenes??[]).flatMap(s=>{const ids=[...Object.values(s.environment?.roles??{}).flat(),...(s.environment?.scene_accents??[]).map(a=>a.entity_id)];return ids.flatMap(id=>Object.values(s.entities?.find(e=>e.id===id)?.states??{}).map(st=>st.asset));}).filter(Boolean))];
 if(compilerId==='meme_props')return [...new Set((production.scenes??[]).flatMap(s=>(s.visual_grammar?.meme_composition?.asset_requirements??[]).map(r=>r.asset_id)).filter(Boolean))];
 return [];
}
export async function runGeneratedCompile(root,script,args,{compiler_id,prune=false}={}){
 root=path.resolve(root);const temp=await mkdtemp(path.join(os.tmpdir(),'zodiac-native-transaction-')),stage=path.join(temp,'job');await mkdir(stage);const lock=path.join(root,'.authoring/native-compile.lock');let locked=false;
 try{
  await mkdir(path.dirname(lock),{recursive:true});try{const handle=await open(lock,'wx');locked=true;await handle.writeFile(JSON.stringify({pid:process.pid,compiler_id}));await handle.close();}catch(e){if(e.code==='EEXIST')fail('COMPILE_LOCKED');throw e;}
  const inputs=['production.json','assets','.authoring','publish','narration.txt','design.md','asset-plan.json','visual-grammar-plan.json'];
  for(const rel of inputs){const src=await confined(root,rel);try{const st=await lstat(src);if(st.isDirectory())await walk(root,rel);await cp(src,path.join(stage,rel),{recursive:true,filter:entry=>!entry.endsWith('.lock')});}catch(e){if(e.code!=='ENOENT')throw e;}}
  const sourceHashes=new Map();for(const rel of await walk(stage))sourceHashes.set(rel,hash(await readFile(path.join(stage,rel))));
  const previous=await json(path.join(root,'.authoring/generated-assets.json')).catch(e=>{if(e.code==='ENOENT')return {entries:[]};throw e;});
  const rewritten=args.map(arg=>arg===root?stage:arg.startsWith(root+path.sep)?stage+arg.slice(root.length):arg);
  const result=spawnSync(process.execPath,[script,...rewritten,'--transaction-stage'],{cwd:stage,encoding:'utf8',maxBuffer:4*1024*1024,timeout:180000});if(result.status!==0)fail('COMPILE_FAILED '+(result.stderr||result.error?.message||result.stdout));
  const production=await json(path.join(stage,'production.json')),publish=await json(path.join(stage,'publish/publish.json')).catch(e=>{if(e.code==='ENOENT')return {};throw e;});
  const statePlan=await json(path.join(stage,'.authoring/character-state-asset-plan.json')).catch(()=>null),ids=generatedIds(production,compiler_id,statePlan),entries=[];
  for(const id of ids){const a=production.assets?.[id];if(!a?.path)fail('OUTPUT_ASSET_MISSING '+id);const abs=await confined(stage,a.path,{assets:true});entries.push({asset_id:id,path:a.path,sha256:hash(await readFile(abs)),compiler_id,source_key:hash(JSON.stringify(a.character_blueprint??a.lineage??a))});}
  const next={format:'zodiac-generated-assets@1',entries:[...(previous.entries??[]).filter(e=>e.compiler_id!==compiler_id),...entries]};
  const plan=planGeneratedAssetReconcile({production,publish,previousOwnership:previous,nextOwnership:next});if(plan.blocked.length)fail('PROVENANCE_INVALID');
  for(const e of plan.retained)if(!next.entries.some(n=>n.asset_id===e.asset_id))next.entries.push(e);
  for(const e of plan.retired)delete production.assets?.[e.asset_id];
  await mkdir(path.join(stage,'.authoring'),{recursive:true});await writeFile(path.join(stage,'production.json'),JSON.stringify(production,null,2)+'\n');await writeFile(path.join(stage,'.authoring/generated-assets.json'),JSON.stringify(next,null,2)+'\n');await writeFile(path.join(stage,'.authoring/generated-assets-reconcile.json'),JSON.stringify(plan,null,2)+'\n');
  for(const [rel,expected] of sourceHashes){let current;try{current=hash(await readFile(await confined(root,rel)));}catch{fail('SOURCE_CHANGED '+rel);}if(current!==expected)fail('SOURCE_CHANGED '+rel);}
  const changes=[];for(const rel of await walk(stage)){if(rel.endsWith('.lock'))continue;if(!['production.json'].includes(rel)&&!rel.startsWith('assets/')&&!rel.startsWith('.authoring/'))continue;const bytes=await readFile(path.join(stage,rel)),target=await confined(root,rel);let original=null;try{original=await readFile(target);}catch(e){if(e.code!=='ENOENT')throw e;}if(original&&original.equals(bytes))continue;
   if(rel.startsWith('assets/')&&original){const owned=previous.entries?.find(e=>e.path===rel);if(!owned)fail('UNOWNED_PATH_CONFLICT '+rel);if(hash(original)!==owned.sha256)fail('HASH_CHANGED '+rel);}
   changes.push({target,bytes,original});
  }
  const done=[];try{for(const change of changes){await mkdir(path.dirname(change.target),{recursive:true});done.push(change);await writeFile(change.target,change.bytes);}if(prune)await applyGeneratedAssetReconcile(root,plan,{prune:true});}catch(e){for(const change of done.reverse()){if(change.original)await writeFile(change.target,change.original);else await rm(change.target,{force:true});}throw e;}
  return {status:'PASS',stdout:result.stdout,ownership:next,reconcile:plan};
 }finally{if(locked)await rm(lock,{force:true});await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [root,compiler_id,script,...args]=process.argv.slice(2);try{if(!root||!compiler_id||!script)fail('ARGUMENTS_REQUIRED');const result=await runGeneratedCompile(root,script,args,{compiler_id,prune:args.includes('--prune-generated')});process.stdout.write(result.stdout??'');console.log('GENERATED_ASSET_TRANSACTION_PASS');}catch(e){console.error(e.message);process.exitCode=2;}
}
