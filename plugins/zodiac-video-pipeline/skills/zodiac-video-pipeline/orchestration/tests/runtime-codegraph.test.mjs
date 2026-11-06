import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
const api=await import('../../core/workflow/runtime-codegraph.mjs').catch(()=>({}));
test('plugin-owned CodeGraph indexes actual symbols and calls, and refuses stale source',async()=>{
 assert.equal(typeof api.buildCodeIndex,'function');
 const root=await mkdtemp(path.join(tmpdir(),'z-codegraph-'));
 try{const sources=path.join(root,'source');await mkdir(sources);await writeFile(path.join(sources,'sample.mjs'),'export function leaf(){return 1;}\nexport function parent(){return leaf();}\n');
 const index=await api.buildCodeIndex({sourceRoot:sources,cacheRoot:path.join(root,'cache'),files:['sample.mjs']});
 try{const q=await index.query('parent');assert.ok(q.symbols.some(s=>s.name==='parent'));assert.ok(q.edges.some(e=>e.kind==='calls'));assert.ok(q.symbols.find(s=>s.name==='parent').source.includes('leaf()'));assert.equal(q.not_an_approval,true);
 const mirrored=path.join(root,'cache/source/sample.mjs');const {readFile}=await import('node:fs/promises');const original=await readFile(mirrored);await writeFile(mirrored,'tampered');await assert.rejects(()=>index.query('parent'),/CODEGRAPH_CACHE_CHANGED/);await writeFile(mirrored,original);
 await writeFile(path.join(sources,'sample.mjs'),'export function parent(){return 2;}');await assert.rejects(()=>index.query('parent'),/CODEGRAPH_SOURCE_CHANGED/);
 }finally{index.close();}
 await assert.rejects(()=>api.buildCodeIndex({sourceRoot:sources,cacheRoot:path.join(root,'cache'),files:['../secret.mjs']}),/CODEGRAPH_SOURCE_UNSAFE/);
 }finally{await rm(root,{recursive:true,force:true});}
});
