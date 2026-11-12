import test from 'node:test';
import assert from 'node:assert/strict';
import {loadStepContext,workUnitForTask} from '../plan-step-context.mjs';

const flags={affiliate_enabled:false,meme_selected:false,mock_ad_enabled:true,retention_quality_engine:true,art_direction_required:true,relational_beats:false};
const options={run_mode:'fresh',role:'draft',environment_mode:'canvas'};

test('Phase 2 work units reduce model guidance without waiving entry capabilities',async()=>{
 const full=await loadStepContext('02-visual-production','visual_compile',flags,options);
 const design=await loadStepContext('02-visual-production','visual_compile',flags,{...options,work_unit:'design'});
 const scene=await loadStepContext('02-visual-production','visual_compile',flags,{...options,work_unit:'scene'});
 const validate=await loadStepContext('02-visual-production','visual_compile',flags,{...options,work_unit:'validate'});
 assert.ok(full.context_manifest.reduce((n,r)=>n+r.bytes,0)<70000);
 for(const context of [design,scene]){
  assert.ok(context.context_manifest.reduce((n,r)=>n+r.bytes,0)<45000);
  assert.ok(context.required_references.includes('references/story-text.md'));
  assert.ok(context.required_references.includes('references/visual-direction.md'));
 }
 assert.ok(scene.required_references.includes('references/director-performance-v2.md'));
 assert.ok(validate.required_references.length<=scene.required_references.length);
 assert.deepEqual(new Set(design.required_entry_capabilities),new Set(full.required_entry_capabilities));
 assert.deepEqual(new Set(scene.required_entry_capabilities),new Set(full.required_entry_capabilities));
 assert.ok(design.allowed_context_categories.includes('approved_narration'));
 assert.ok(design.forbidden_context_categories.includes('full_research'));
});

test('task kinds map deterministically to Phase 2 context work units',()=>{
 assert.equal(workUnitForTask({kind:'DESIGN_VISUAL',step:'visual_compile'}),'design');
 assert.equal(workUnitForTask({kind:'DESIGN_SCENE_BEATS',step:'visual_compile'}),'scene');
 assert.equal(workUnitForTask({kind:'AUTHOR_STEP',step:'assets'}),'assets');
 assert.equal(workUnitForTask({kind:'AUTHOR_STEP',step:'publish_prep'}),'publish');
 assert.equal(workUnitForTask({kind:'VALIDATE_AND_COMMIT_STEP',step:'assets'}),'validate');
 assert.equal(workUnitForTask({kind:'WAIT_FOR_GENUINE_USER_REVIEW',step:'assets'}),'review');
 assert.equal(workUnitForTask({kind:'AUTHOR_STEP',step:'concept'}),null);
});
