import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('phases/01-content.json', root),'utf8'));
const template = JSON.parse(await readFile(new URL('pipeline-state.template.json', root),'utf8'));
const concept=manifest.steps.find(s=>s.id==='concept');
test('Viral plugin guidance is conditional, not required for ordinary concept',()=>{
 assert.equal(concept.required_capabilities.some(c=>c.id==='viral_analysis'),false);
 const cap=concept.conditional_capabilities.find(c=>c.id==='viral_analysis');
 assert.equal(cap.when,'flag:viral_support_needed');
 assert.equal(cap.require_application_summary,true);
 assert.equal(template.flags.viral_support_needed,false);
 assert.ok(concept.load_references.includes('references/viral-routing-policy.md'));
 assert.equal(manifest.steps.length,3);
});
test('content contract and required artifacts are unchanged',()=>{
 assert.equal(concept.required_capabilities.some(c=>c.id==='content_contract_validation'),true);
 assert.ok(concept.required_outputs.includes('viral-analysis.json'));
 assert.ok(concept.gate_checks.includes('viral_application'));
 assert.equal(manifest.steps.length,3);
});
