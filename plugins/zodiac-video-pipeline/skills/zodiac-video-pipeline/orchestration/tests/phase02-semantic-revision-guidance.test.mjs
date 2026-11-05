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
