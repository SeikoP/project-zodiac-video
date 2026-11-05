import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhase02SemanticGraph,diffPhase02SemanticGraphs,revisionGuidance} from '../../core/cache/phase02-semantic-cache.mjs';

function makeIntent(propX=10){return {assets:{P:{category:'prop',path:'assets/p.svg'}},cast:[{entity_id:'lead'}],scenes:[
 {id:'S01',entities:[{id:'lead',kind:'character',states:{a:{}}}],events:[]},
 {id:'S03',entities:[{id:'lead',kind:'character',states:{a:{}}},{id:'cup',kind:'prop',visual_role:'interactive_prop',states:{a:{asset:'P',transform:{x:propX,y:20,width:220,height:220}}}}],events:[]},
 {id:'S05',entities:[{id:'lead',kind:'character',states:{a:{}}}],events:[]}
]};}
test('single S03 prop edit rebuilds S03 and aggregate review while reusing unrelated scenes',()=>{
 const a=buildPhase02SemanticGraph(makeIntent(10)),b=buildPhase02SemanticGraph(makeIntent(30));
 const diff=diffPhase02SemanticGraphs(a,b),g=revisionGuidance(b,diff);
 assert.ok(g.scenes.rebuild.includes('S03'));
 assert.ok(g.scenes.reuse.includes('S01'));
 assert.ok(g.scenes.reuse.includes('S05'));
 assert.ok(g.nodes.rebuild.includes('preview:S03'));
 assert.ok(g.nodes.rebuild.includes('review:index'));
 assert.ok(g.nodes.reuse.includes('preview:S01'));
 assert.ok(g.nodes.reuse.includes('asset:character:lead'));
});


test('revision impact CLI reports scene-level rebuild and reuse guidance',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');
 const os=await import('node:os'),path=await import('node:path'),{spawnSync}=await import('node:child_process'),{fileURLToPath}=await import('node:url');
 const root=await mkdtemp(path.join(os.tmpdir(),'phase02-impact-')),before=path.join(root,'before'),after=path.join(root,'after');
 try{
  for(const d of [before,after])await mkdir(path.join(d,'.authoring'),{recursive:true});
  await writeFile(path.join(before,'.authoring/visual-intent.json'),JSON.stringify(makeIntent(10)));
  await writeFile(path.join(after,'.authoring/visual-intent.json'),JSON.stringify(makeIntent(30)));
  const script=fileURLToPath(new URL('../../core/audit/assess-revision-impact.mjs',import.meta.url));
  const r=spawnSync(process.execPath,[script,'--before',before,'--after',after],{encoding:'utf8'});
  assert.equal(r.status,0,r.stderr);
  const report=JSON.parse(r.stdout);
  assert.ok(report.phase02_revision.scenes.rebuild.includes('S03'));
  assert.ok(report.phase02_revision.scenes.reuse.includes('S01'));
  assert.ok(report.phase02_revision.scenes.reuse.includes('S05'));
 }finally{await rm(root,{recursive:true,force:true});}
});

test('semantic cache update returns rebuild/reuse guidance for the active revision',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises');const os=await import('node:os'),path=await import('node:path');
 const {updatePhase02SemanticCache}=await import('../../core/cache/phase02-semantic-cache.mjs');
 const root=await mkdtemp(path.join(os.tmpdir(),'phase02-semantic-cache-'));
 try{
  await updatePhase02SemanticCache(root,makeIntent(10));
  const r=await updatePhase02SemanticCache(root,makeIntent(30));
  assert.ok(r.guidance.scenes.rebuild.includes('S03'));
  assert.ok(r.guidance.scenes.reuse.includes('S01'));
  assert.equal(r.guidance.review_index_rebuild,true);
 }finally{await rm(root,{recursive:true,force:true});}
});
