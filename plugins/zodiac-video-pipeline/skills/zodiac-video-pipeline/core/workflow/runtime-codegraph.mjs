import {readFile,writeFile,mkdir,realpath,access,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const sha=x=>createHash('sha256').update(x).digest('hex');
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const pluginCodeGraphCache=path.resolve(skill,'../../.runtime/codegraph');
const safe=rel=>{if(typeof rel!=='string'||path.isAbsolute(rel)||rel.includes(':')||rel.replaceAll('\\','/').split('/').some(p=>p==='..'||p==='')||!rel.endsWith('.mjs'))throw Error('CODEGRAPH_SOURCE_UNSAFE '+rel);return rel.replaceAll('\\','/');};
async function sources(root,files){
 const base=await realpath(root);
 return Promise.all([...new Set(files.map(safe))].sort().map(async rel=>{
  const file=await realpath(path.join(base,rel));if(!file.startsWith(base+path.sep))throw Error('CODEGRAPH_SOURCE_UNSAFE '+rel);
  const bytes=await readFile(file);return {rel,bytes,sha256:sha(bytes)};
 }));
}
const fingerprint=rows=>sha(JSON.stringify(rows.map(r=>[r.rel,r.sha256])));
export async function collectPluginCodeSources(manifests,{sourceRoot=skill}={}){
 const files=new Set(),base=await realpath(sourceRoot);
 async function visit(rel){
  rel=safe(rel);if(files.has(rel))return;
  const [row]=await sources(base,[rel]);files.add(rel);
  for(const m of row.bytes.toString('utf8').matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"\n]+\.mjs)['"]/gu)){
   const child=path.relative(base,path.resolve(base,path.dirname(rel),m[1])).replaceAll('\\','/');await visit(child);
  }
 }
 for(const m of manifests)for(const s of m.steps)for(const c of [...s.required_capabilities??[],...s.conditional_capabilities??[]])if(c.tool_locator?.endsWith('.mjs'))await visit(c.tool_locator);
 for(const rel of ['orchestration/resume-brief.mjs','core/workflow/task-coordinator.mjs','core/workflow/deterministic-execution.mjs','core/workflow/runtime-codegraph.mjs'])await visit(rel);
 return [...files].sort();
}
// Only verified current executable modules are mirrored, never episode data or past examples.
export async function buildCodeIndex({sourceRoot=skill,cacheRoot=pluginCodeGraphCache,files,rebuild=false}={}){
 if(!Array.isArray(files)||!files.length)throw Error('CODEGRAPH_FILES_REQUIRED');
 const rows=await sources(sourceRoot,files),digest=fingerprint(rows),project=path.join(path.resolve(cacheRoot),'source'),manifestFile=path.join(path.resolve(cacheRoot),'index.json');
 const require=createRequire(import.meta.url),dependencyRoot=path.resolve(skill,'../../node_modules')+path.sep;
 let sdkPackage,bundlePackage;
 try{sdkPackage=require.resolve('@colbymchenry/codegraph/package.json');bundlePackage=createRequire(sdkPackage).resolve('@colbymchenry/codegraph-'+process.platform+'-'+process.arch+'/package.json');}catch{throw Error('CODEGRAPH_PLUGIN_DEPENDENCY_REQUIRED: install the plugin lockfile with platform optional dependencies');}
 if(!sdkPackage.startsWith(dependencyRoot)||!bundlePackage.startsWith(dependencyRoot))throw Error('CODEGRAPH_PLUGIN_DEPENDENCY_REQUIRED: ambient/global packages cannot replace the plugin dependency');
 if(JSON.parse(await readFile(sdkPackage,'utf8')).version!=='1.6.2'||JSON.parse(await readFile(bundlePackage,'utf8')).version!=='1.6.2')throw Error('CODEGRAPH_PLUGIN_VERSION_MISMATCH');
 const sdk=await import('@colbymchenry/codegraph');const {CodeGraph,setLogger,silentLogger}=sdk.default??sdk;setLogger(silentLogger);
 let old=null;try{old=JSON.parse(await readFile(manifestFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(project,{recursive:true});
 let mirrorChanged=false;
 for(const row of rows){const target=path.join(project,row.rel);await mkdir(path.dirname(target),{recursive:true});let mirrored=null;try{mirrored=sha(await readFile(target));}catch(e){if(e.code!=='ENOENT')throw e;}if(mirrored!==row.sha256){mirrorChanged=true;await writeFile(target,row.bytes);}}
 for(const rel of Object.keys(old?.hashes??{}))if(!rows.some(r=>r.rel===rel))await rm(path.join(project,safe(rel)),{force:true});
 const initialized=await access(path.join(project,'.codegraph/codegraph.db')).then(()=>true,()=>false);
 const graph=initialized?await CodeGraph.open(project,{sync:false}):await CodeGraph.init(project,{index:false});
 try{
  let indexResult=null;
  if(rebuild||mirrorChanged||!initialized||old?.source_sha256!==digest){indexResult=await graph.indexAll();await writeFile(manifestFile,JSON.stringify({format:'zodiac-code-index@1',engine:'@colbymchenry/codegraph@1.6.2',source_sha256:digest,hashes:Object.fromEntries(rows.map(r=>[r.rel,r.sha256]))},null,2)+'\n');}
  return {engine:'codegraph',source_sha256:digest,file_count:rows.length,source_bytes:rows.reduce((n,r)=>n+r.bytes.length,0),index_result:indexResult,stats:graph.getStats(),close:()=>graph.close(),
   async query(query,{limit=5,maxBytes=24000}={}){
    if(typeof query!=='string'||!query.trim())throw Error('CODEGRAPH_QUERY_REQUIRED');
    if(!Number.isInteger(limit)||limit<1||limit>20||!Number.isInteger(maxBytes)||maxBytes<1000||maxBytes>100000)throw Error('CODEGRAPH_QUERY_BUDGET_INVALID');
    const [currentSource,currentMirror]=await Promise.all([sources(sourceRoot,files),sources(project,files)]);
    if(fingerprint(currentSource)!==digest)throw Error('CODEGRAPH_SOURCE_CHANGED: rebuild the plugin index before using its code context');
    if(fingerprint(currentMirror)!==digest)throw Error('CODEGRAPH_CACHE_CHANGED: rebuild the plugin index');
    const hits=graph.searchNodes(query,{limit}),ids=hits.map(h=>h.node.id),matched=new Set(ids);
    const edges=[...graph.getOutgoingEdgesFrom(ids),...graph.getIncomingEdgesTo(ids)].slice(0,60),allIds=[...new Set([...ids,...edges.flatMap(e=>[e.source,e.target])].filter(Boolean))];
    const linked=graph.getNodesByIds(allIds),symbols=[];let bytes=0,sourceBytes=0,omitted=0;
    for(const node of linked.values()){
     if(!rows.some(r=>r.rel===node.filePath)){omitted++;continue;}
     const original=rows.find(r=>r.rel===node.filePath),source=original.bytes.toString('utf8').split(/\r?\n/u).slice(node.startLine-1,node.endLine).join('\n');
     const item={id:node.id,name:node.name,kind:node.kind,file:node.filePath,start_line:node.startLine,end_line:node.endLine,...(matched.has(node.id)?{source}:{})};
     const size=Buffer.byteLength(JSON.stringify(item));if(bytes+size>maxBytes){omitted++;continue;}bytes+=size;sourceBytes+=item.source?Buffer.byteLength(item.source):0;symbols.push(item);
    }
    const included=new Set(symbols.map(s=>s.id));
    return {format:'zodiac-code-context@1',engine:'codegraph',query,symbols,edges:edges.filter(e=>included.has(e.source)&&included.has(e.target)),source_sha256:digest,source_bytes:sourceBytes,context_bytes:bytes,omitted_symbols:omitted,not_an_approval:true};
   }
  };
 }catch(e){graph.close();throw e;}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [mode,query]=process.argv.slice(2);
 try{
  if(!['index','query'].includes(mode))throw Error('Usage: runtime-codegraph.mjs <index|query> [symbol]');
  if(mode==='query'&&!(await access(path.join(pluginCodeGraphCache,'index.json')).then(()=>true,()=>false)))throw Error('CODEGRAPH_INDEX_REQUIRED: run index first');
  const manifests=await Promise.all(['01-content','02-visual-production','03-handoff'].map(async p=>JSON.parse(await readFile(path.join(skill,'orchestration/phases',p+'.json'),'utf8'))));
  const index=await buildCodeIndex({files:await collectPluginCodeSources(manifests)});
  try{console.log(JSON.stringify(mode==='query'?await index.query(query):{engine:index.engine,files:index.file_count,source_bytes:index.source_bytes,stats:index.stats},null,2));}finally{index.close();}
 }catch(e){console.error('PLUGIN_CODEGRAPH_BLOCKED '+e.message);process.exitCode=2;}
}
