import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {evaluateCacheNode,recordCacheNode,CACHE_REASON,putObject,readObject} from '../../core/cache/incremental-cache.mjs';
import {buildPhase02SemanticGraph,diffPhase02SemanticGraphs} from '../../core/cache/phase02-semantic-cache.mjs';
import {signatureFiles,selectedStepDependencyFiles} from '../../phases/phase02/phase02-selected-dependencies.mjs';
const intent=()=>({format:'zodiac-visual-intent@1',cast:[{entity_id:'C_SCORPIO',hair_id:'long'},{entity_id:'C_FRIEND',hair_id:'short'}],assets:{nv3:{category:'narrative_visual',path:'assets/nv3.svg'}},scenes:[{id:'S01',semantic_goal:'a',grammar:{},entities:[{id:'C_FRIEND',kind:'character',states:{a:{asset:'friend'}}}],events:[]},{id:'S03',semantic_goal:'b',grammar:{},entities:[{id:'C_SCORPIO',kind:'character',states:{a:{asset:'scorpio'}}},{id:'NV_S03',kind:'narrative_visual',states:{a:{asset:'nv3'}}}],events:[]}]});
test('tampered output is never reused',async()=>{const ws=await mkdtemp(path.join(os.tmpdir(),'zcache-'));try{await mkdir(path.join(ws,'out'),{recursive:true});await writeFile(path.join(ws,'out/a.txt'),'A');await recordCacheNode(ws,{nodeId:'x',input:{a:1},compiler:'v1',outputs:['out/a.txt']});assert.equal((await evaluateCacheNode(ws,{nodeId:'x',input:{a:1},compiler:'v1',outputs:['out/a.txt']})).reason,CACHE_REASON.HIT_EXACT);await writeFile(path.join(ws,'out/a.txt'),'B');assert.equal((await evaluateCacheNode(ws,{nodeId:'x',input:{a:1},compiler:'v1',outputs:['out/a.txt']})).reason,CACHE_REASON.MISS_OUTPUT_TAMPERED);}finally{await rm(ws,{recursive:true,force:true});}});
test('object store is content addressed',async()=>{const ws=await mkdtemp(path.join(os.tmpdir(),'zcache-'));try{const x=await putObject(ws,'hello');assert.equal((await readObject(ws,x.sha256)).toString(),'hello');}finally{await rm(ws,{recursive:true,force:true});}});
test('S03 narrative visual edit dirties only its downstream scene/review branch',()=>{const a=buildPhase02SemanticGraph(intent()),b=intent();b.scenes[1].entities[1].states.a.transform={x:1};const d=diffPhase02SemanticGraphs(a,buildPhase02SemanticGraph(b));assert.ok(d.dirty.includes('asset:narrative_visual:NV_S03'));assert.ok(d.dirty.includes('scene:S03'));assert.ok(d.dirty.includes('preview:S03'));assert.ok(d.dirty.includes('review:index'));assert.ok(!d.dirty.includes('scene:S01'));});
test('character hair edit dirties referencing scene only',()=>{const a=buildPhase02SemanticGraph(intent()),b=intent();b.cast[0].hair_id='bob';const d=diffPhase02SemanticGraphs(a,buildPhase02SemanticGraph(b));assert.ok(d.dirty.includes('asset:character:C_SCORPIO'));assert.ok(d.dirty.includes('scene:S03'));assert.ok(!d.dirty.includes('scene:S01'));});

test('non-PASS cache checkpoint is never a reuse hit',async()=>{const ws=await mkdtemp(path.join(os.tmpdir(),'zcache-'));try{await mkdir(path.join(ws,'out'),{recursive:true});await writeFile(path.join(ws,'out/a.txt'),'A');await recordCacheNode(ws,{nodeId:'failed',input:{a:1},compiler:'v1',outputs:['out/a.txt'],status:'FAIL'});const res=await evaluateCacheNode(ws,{nodeId:'failed',input:{a:1},compiler:'v1',outputs:['out/a.txt']});assert.equal(res.hit,false);assert.equal(res.reason,CACHE_REASON.MISS_PREVIOUS_NOT_PASS);}finally{await rm(ws,{recursive:true,force:true});}});

test('bounded parallel signatures preserve exact legacy hash and detect same-size edits',async()=>{
 const {createHash}=await import('node:crypto'),sha=b=>createHash('sha256').update(b).digest('hex');
 const root=await mkdtemp(path.join(os.tmpdir(),'signature-'));
 try{const files=Array.from({length:20},(_,i)=>path.join(root,i+'.txt'));await Promise.all(files.map(p=>writeFile(p,'one')));
  const expected=sha(JSON.stringify(files.slice().sort().map(p=>[p,sha('one')])));
  assert.equal(await signatureFiles(files.reverse()),expected);
  await writeFile(files[0],'two');assert.notEqual(await signatureFiles(files),expected);
  assert.equal(await signatureFiles([...files,path.join(root,'missing')]),null);
  assert.equal(await signatureFiles([root]),null);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('selected native SVG dependencies use normalized Windows paths',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'selected-deps-'));
 try{await writeFile(path.join(root,'entry.mjs'),'export const x=1;');
  const character=path.join(root,'characters','master.svg'),environment=path.join(root,'environments','master.svg');
  const out=await selectedStepDependencyFiles(root,'entry.mjs',[character,environment],{stepId:'character_identity'});
  assert.ok(out.includes(character));assert.ok(!out.includes(environment));
 }finally{await rm(root,{recursive:true,force:true});}
});
