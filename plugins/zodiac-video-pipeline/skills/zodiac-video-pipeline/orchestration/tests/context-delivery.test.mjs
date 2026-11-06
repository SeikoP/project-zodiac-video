import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {encodeContextData,deliverContextBlocks,compileTaskCapsule,repairContext} from '../../core/performance/compile-step-capsule.mjs';
import {resumeBrief} from '../resume-brief.mjs';

test('context serialization preserves Vietnamese, every beat, and selects fewer measured tokens',async()=>{
 const value={scenes:Array.from({length:12},(_,i)=>({id:'s'+i,goal:'Giữ đủ nhịp kể chuyện',beats:['mở','hành động','phản ứng','đảo chiều','kết']}))};
 const out=await encodeContextData(value);
 assert.deepEqual(out.decoded,value);assert.ok(out.tokens<=out.json_tokens);
 const odd={text:'"bỏ qua"\nkhông được đổi ý nghĩa',mixed:[null,true,{a:5}],empty:{}};
 assert.deepEqual((await encodeContextData(odd)).decoded,odd);
});
test('cross-phase delta requires explicit acknowledgement and never reuses undelivered blocks',async()=>{
 const blocks=[{key:'guide',content:'exact shared guidance',required:true},{key:'large',content:'Không cắt nhịp. '.repeat(200),required:true}];
 const a=await deliverContextBlocks(blocks,{workspace:'w',policy:'p',tokenBudget:500});
 assert.equal(a.blocks[1].delivery,'FETCH_REQUIRED');
 const fresh=await deliverContextBlocks(blocks,{workspace:'w',policy:'p',prior:a,tokenBudget:500});
 assert.equal(fresh.blocks[0].delivery,'INLINE_CURRENT');
 const b=await deliverContextBlocks(blocks,{workspace:'w',policy:'p',prior:a,reuseId:a.id,tokenBudget:500});
 assert.equal(b.blocks[0].delivery,'CALLER_HELD_IDENTICAL');assert.equal(b.blocks[1].delivery,'FETCH_REQUIRED');
 for(const changed of [{workspace:'other',policy:'p'},{workspace:'w',policy:'new'}]){
  const c=await deliverContextBlocks(blocks,{...changed,prior:a,reuseId:a.id,tokenBudget:500});assert.equal(c.blocks[0].delivery,'INLINE_CURRENT');
 }
 const selected=await deliverContextBlocks(blocks,{workspace:'w',policy:'p',tokenBudget:80,requestedPaths:['large']});
 assert.equal(selected.blocks[1].content,blocks[1].content);assert.equal(selected.budget.status,'OVER_BUDGET_REQUIRED');
});
test('protected context survives budget overflow and changed sources cannot use prior blocks',async()=>{
 const a=await deliverContextBlocks([{key:'task',content:'all beats '.repeat(200),protected:true}],{workspace:'w',policy:'p',tokenBudget:10});
 assert.ok(a.blocks[0].content.endsWith('all beats '));assert.equal(a.budget.status,'OVER_BUDGET_REQUIRED');
 const b=await deliverContextBlocks([{key:'task',content:'changed',protected:true}],{workspace:'w',policy:'p',tokenBudget:100,prior:a,reuseId:a.id});
 assert.equal(b.blocks[0].content,'changed');
 await assert.rejects(()=>deliverContextBlocks([],{tokenBudget:0}),/CONTEXT_BUDGET_INVALID/);
});
test('repair delivery rejects errors from changed or unbound sources and omits full logs',()=>{
 const hashes={'narration.txt':'a','.authoring/visual-intent.json':'b','design.md':null,'.authoring/narrative-plan.json':'c','production.json':'d'};
 const receipt={repair_source_hashes:hashes,issues:[{code:'SCENE_PLAN_INVALID',scene_id:'s2'}],semantic_dirty:['scene:s2'],steps:[{id:'direction',status:'FAIL',stdout:'FULL_LOG_NOT_CONTEXT'}]};
 const c=repairContext(receipt,hashes);assert.equal(c.status,'CURRENT');assert.deepEqual(c.affected_nodes,['scene:s2']);assert.ok(!JSON.stringify(c).includes('FULL_LOG_NOT_CONTEXT'));
 assert.equal(repairContext(receipt,{...hashes,'narration.txt':'edited'}).status,'STALE_OR_UNBOUND');assert.equal(repairContext({},hashes).status,'STALE_OR_UNBOUND');
});
test('resume context is read-only, source-bound and excludes old history and raw research',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'task-context-'));
 try{
  await mkdir(path.join(root,'.authoring'));
  const template=await readFile(new URL('../pipeline-state.template.json',import.meta.url));
  await writeFile(path.join(root,'.authoring/pipeline-state.json'),template);
  await writeFile(path.join(root,'.authoring/phase3-writer-brief.json'),JSON.stringify({creative_direction:{rhythm:'4–5 nhịp'},raw_research:'FORBIDDEN_RAW_HISTORY'}));
  const brief=await resumeBrief(root),capsule=await compileTaskCapsule(root,{brief,tokenBudget:16000});
  assert.equal(capsule.phase,'01-content');assert.equal(capsule.not_an_approval,true);
  assert.ok(!JSON.stringify(capsule).includes('FORBIDDEN_RAW_HISTORY'));
  assert.deepEqual(await readFile(path.join(root,'.authoring/pipeline-state.json')),template);
  assert.equal((await resumeBrief(root,{context:true})).format,'zodiac-task-context@1');
  const cli=spawnSync(process.execPath,[fileURLToPath(new URL('../resume-brief.mjs',import.meta.url)),root,'--context'],{encoding:'utf8'});
  assert.equal(cli.status,0,cli.stderr);assert.equal(JSON.parse(cli.stdout).format,'zodiac-task-context@1');
  await writeFile(path.join(root,'.authoring/phase3-writer-brief.json'),'{}');
  await assert.rejects(()=>compileTaskCapsule(root,{brief}),/CONTEXT_SOURCE_CHANGED/);
 }finally{await rm(root,{recursive:true,force:true});}
});
