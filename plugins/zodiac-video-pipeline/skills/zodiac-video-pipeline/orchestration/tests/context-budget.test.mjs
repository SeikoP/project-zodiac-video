import test from 'node:test';
import assert from 'node:assert/strict';
import {planStepContext,loadStepContext} from '../plan-step-context.mjs';
test('phase02 visual compile only loads its own references and keeps exit validations',async()=>{
 const x=planStepContext({id:'02-visual-production',steps:[{id:'visual_compile',required_capabilities:[{id:'visual_grammar_contract',stage:'entry',guidance_uri:'references/asset-library-v4/selection-guide.md'},{id:'visual_grammar_validation',stage:'exit'}],load_references:['references/visual-direction.md']}]},'visual_compile');
 assert.equal(x.no_validation_changes,true);
 assert.ok(x.required_references.includes('references/asset-library-v4/selection-guide.md'));
 assert.ok(x.deferred_exit_capabilities.includes('visual_grammar_validation'));
 assert.ok(!x.required_references.includes('references/publish-virality.md'));
});
test('conditional context only appears with active flag',()=>{
 const m={id:'p',steps:[{id:'x',required_capabilities:[{id:'base',stage:'entry',guidance_uri:'base.md'}],conditional_capabilities:[{id:'extra',stage:'entry',guidance_uri:'extra.md',when:'flag:relational_beats'}]}]};
 assert.deepEqual(planStepContext(m,'x',{relational_beats:false}).required_references,['base.md']);
 assert.deepEqual(planStepContext(m,'x',{relational_beats:true}).required_references,['base.md','extra.md']);
});
test('unknown step fails closed',async()=>{
 assert.throws(()=>planStepContext({id:'02-visual-production',steps:[]},'no-such-step'),/CONTEXT_STEP_NOT_FOUND/);
});

test('unknown conditional flag blocks instead of quietly omitting required context',()=>{
 const manifest={id:'p',steps:[{id:'a',conditional_capabilities:[{id:'x',stage:'entry',when:'flag:meme_selected',guidance_uri:'x.md'}]}]};
 assert.throws(()=>planStepContext(manifest,'a',{}),/CONTEXT_FLAG_UNKNOWN/);
 assert.throws(()=>planStepContext(manifest,'a',{meme_selected:'false'}),/CONTEXT_FLAG_INVALID/);
});
