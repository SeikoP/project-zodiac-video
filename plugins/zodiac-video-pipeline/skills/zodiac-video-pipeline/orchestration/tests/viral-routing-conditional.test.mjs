import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('phases/01-content.json',root),'utf8'));
const template=JSON.parse(await readFile(new URL('pipeline-state.template.json',root),'utf8'));
const phaseDoc=await readFile(new URL('phases/01-content.md',root),'utf8');
const concept=manifest.steps.find(s=>s.id==='concept');

test('viral support is an opt-in creative direction, not a native Web capability',()=>{
 assert.deepEqual(concept.required_capabilities??[],[]);
 assert.deepEqual(concept.conditional_capabilities??[],[]);
 assert.equal(template.flags.viral_support_needed,false);
 assert.match(phaseDoc,/Generate multiple premises/iu);
 assert.match(phaseDoc,/Select the strongest valid concept automatically unless the user asks to choose/iu);
 assert.deepEqual(manifest.steps.map(s=>s.id),['evidence','voice','concept','narrative_design','narration']);
});

test('Web Phase 1 manifest carries creative sequencing without native artifact contracts',()=>{
 assert.deepEqual(concept.required_outputs??[],[]);
 assert.deepEqual(concept.gate_checks??[],[]);
 assert.ok((concept.load_references??[]).length>0);
 assert.ok((concept.load_references??[]).every(ref=>typeof ref==='string'&&ref.startsWith('references/')));
});
