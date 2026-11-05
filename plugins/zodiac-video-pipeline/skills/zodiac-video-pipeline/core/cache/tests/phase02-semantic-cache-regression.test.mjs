import test from 'node:test';
import assert from 'node:assert/strict';
import {buildPhase02SemanticGraph,diffPhase02SemanticGraphs,revisionGuidance} from '../phase02-semantic-cache.mjs';
const actor=(x)=>({id:'lead',kind:'character',initial_state:'normal',states:{normal:{asset:'char-a',transform:{x}}}});
const prop=(x)=>({id:'letter',kind:'prop',initial_state:'closed',states:{closed:{asset:'letter-a',transform:{x}}}});
const intent=(actorX=10,propX1=10,propX2=20)=>({cast:[{entity_id:'lead',asset:'char-a'}],assets:{'char-a':{a:1},'letter-a':{a:2}},scenes:[{id:'S01',entities:[actor(actorX),prop(propX1)],events:[]},{id:'S02',entities:[actor(200),prop(propX2)],events:[]},{id:'S03',entities:[actor(400)],events:[]}]});
const guide=(a,b)=>revisionGuidance(buildPhase02SemanticGraph(b),diffPhase02SemanticGraphs(buildPhase02SemanticGraph(a),buildPhase02SemanticGraph(b)));
test('actor transform change invalidates its scene but not unrelated scenes',()=>{
 const g=guide(intent(),intent(100));assert.deepEqual(g.scenes.rebuild,['S01']);assert.deepEqual(g.scenes.reuse,['S02','S03']);
});
test('shared prop edit in first scene invalidates all scenes using the prop, never unrelated scene',()=>{
 const g=guide(intent(),intent(10,100));assert.deepEqual(g.scenes.rebuild,['S01','S02']);assert.deepEqual(g.scenes.reuse,['S03']);assert.ok(g.assets.rebuild.includes('asset:prop:letter'));
});
test('shared prop edit in second scene invalidates first scene as well',()=>{
 const g=guide(intent(),intent(10,10,100));assert.deepEqual(g.scenes.rebuild,['S01','S02']);
});
test('reordering scene records does not modify shared asset hash',()=>{
 const before=intent(),after=structuredClone(before);after.scenes.reverse();
 const g0=buildPhase02SemanticGraph(before),g1=buildPhase02SemanticGraph(after);
 assert.equal(g0.nodes['asset:prop:letter'].input_sha256,g1.nodes['asset:prop:letter'].input_sha256);
});
test('no change reuses all scenes and assets',()=>{
 const g=guide(intent(),structuredClone(intent()));assert.deepEqual(g.scenes.rebuild,[]);
 assert.deepEqual(g.scenes.reuse,['S01','S02','S03']);
});
