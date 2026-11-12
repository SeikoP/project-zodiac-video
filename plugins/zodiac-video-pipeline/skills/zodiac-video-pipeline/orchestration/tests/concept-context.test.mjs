import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {conceptContext,readConceptContext} from '../../features/episode/concept-context.mjs';
import {assertPublishProjection} from '../../phases/phase03/phase03-production-release.mjs';

test('concept identity comes from narrative premise and episode scope, never title inference',()=>{
 const context=conceptContext({selected_concept_id:'C1',story_spine:{premise:'Sự quan tâm bị hiểu nhầm'}},{episode_id:'gemini-trust',title_working:'Tập Song Tử',member_ids:['gemini']});
 assert.equal(context.id,'C1');assert.equal(context.premise,'Sự quan tâm bị hiểu nhầm');
 assert.deepEqual(context.member_ids,['gemini']);
 assert.equal(conceptContext({}, {title_working:'A title is not a concept'}),null);
 const authored={format:'zodiac-publish@1',source:{}};
 const compiled={...authored,source:{narration:'narration.txt',production:'production.ir.json',concept:context}};
 assert.doesNotThrow(()=>assertPublishProjection(authored,compiled,context));
 assert.throws(()=>assertPublishProjection(authored,{...compiled,source:{...compiled.source,concept:{...context,premise:'Changed'}}},context),/APPROVED_PUBLISH_DRIFT/);
});

test('imported Phase1 handoff narrative works without a concept-candidates sidecar',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'concept-context-'));
 try{await mkdir(path.join(root,'.authoring'));await writeFile(path.join(root,'.authoring/narrative-plan.json'),JSON.stringify({selected_concept_id:'C1',story_spine:{premise:'Actual approved premise'}}));
 assert.equal((await readConceptContext(root)).premise,'Actual approved premise');
 }finally{await rm(root,{recursive:true,force:true})}
});
