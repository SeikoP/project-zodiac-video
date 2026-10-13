import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
const api=await import('../compile-visual-intent.mjs').catch(()=>({}));const narration='Xin chào.';const sha=x=>createHash('sha256').update(x).digest('hex');
const intent=()=>({format:'zodiac-visual-intent@1',narration_sha256:sha(narration),assets:{a:{path:'a.svg'}},video:{width:1080,height:1920,fps:30},visual_system:{},cast:[],frames:[],story_object_decision:{mode:'omitted',reason:'No metaphor needed',review_ref:'review:1'},scenes:[{id:'s',narration_range:[0,Buffer.byteLength(narration)],semantic_goal:'A calm greeting',grammar:{frame_id:'prop-focus',mechanic_id:'reveal',bindings:{focus_prop:'cup'}},environment:{mode:'archive_frame',scene_set:{asset:'a'}},entities:[{id:'cup',kind:'object',initial_state:'on',states:{on:{asset:'a'}}}],events:[],director_beats:[],art_direction:{},semantic_asset_decisions:[]}]});
test('one authored entity change reaches native projections deterministically',()=>{assert.equal(typeof api.compileVisualIntent,'function');const a=api.compileVisualIntent(intent(),{narration});assert.deepEqual(a,api.compileVisualIntent(intent(),{narration}));assert.equal(a.production.scenes[0].environment.mode,'archive_frame');const b=intent();b.scenes[0].entities[0].id='bowl';b.scenes[0].grammar.bindings.focus_prop='bowl';const result=api.compileVisualIntent(b,{narration});assert.equal(result.production.scenes[0].entities[0].id,'bowl');assert.equal(result.visual_grammar_plan.scenes[0].bindings.focus_prop,'bowl');assert.equal(result.receipt.owner,'visual-intent');assert.throws(()=>api.compileVisualIntent(b,{narration:'Changed'}),/NARRATION/);assert.throws(()=>api.compileVisualIntent({...b,format:'legacy'},{narration}),/FORMAT/);});
test('tampering a derived projection invalidates ownership receipt',()=>{assert.equal(typeof api.verifyIntentProjections,'function');const outputs=api.compileVisualIntent(intent(),{narration});assert.equal(api.verifyIntentProjections(outputs,outputs.receipt).status,'PASS');outputs.asset_plan.semantic_asset_fit.decisions.push({fake:true});assert.equal(api.verifyIntentProjections(outputs,outputs.receipt).status,'BLOCKED');});
test('scene art direction is projected to the native intent contract',()=>{const input=intent();input.scenes[0].entities[0].visual_role='interactive_prop';input.scenes[0].entities[0].narrative_intent={reason:'Cup carries the greeting',voice_anchor:'Xin chào.'};const result=api.compileVisualIntent(input,{narration});assert.equal(result.art_direction.format,'zodiac-scene-art-direction@2');assert.equal(result.art_direction.composition_stage,'intent');assert.equal(result.art_direction.scenes[0].id,'s');assert.equal(result.art_direction.scenes[0].components[0].id,'cup');assert.equal(result.art_direction.scenes[0].components[0].ownership.kind,'authored');});
test('an empty execution receipt cannot hide production drift',async()=>{const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises');const os=await import('node:os');const path=await import('node:path');const root=await mkdtemp(path.join(os.tmpdir(),'z-intent-drift-'));try{await mkdir(path.join(root,'.authoring'));const input=intent(),out=api.compileVisualIntent(input,{narration});await writeFile(path.join(root,'narration.txt'),narration);await writeFile(path.join(root,'.authoring/visual-intent.json'),JSON.stringify(input));await writeFile(path.join(root,'.authoring/visual-intent-projection-receipt.json'),JSON.stringify(out.receipt));for(const [key,rel]of Object.entries(api.projectionPaths))if(out[key]!==null)await writeFile(path.join(root,rel),JSON.stringify(out[key]));assert.equal((await api.verifyIntentWorkspace(root)).status,'PASS');out.production.scenes[0].voice='tampered';await writeFile(path.join(root,'production.json'),JSON.stringify(out.production));await writeFile(path.join(root,'.authoring/phase02-execution-receipt.json'),'{}');await assert.rejects(()=>api.verifyIntentWorkspace(root),/PROJECTION_DRIFT/);}finally{await rm(root,{recursive:true,force:true});}});
test('a populated cast needs the explicit native episode cast plan',()=>{const input=intent();input.cast=[{entity_id:'taurus'}];assert.throws(()=>api.compileVisualIntent(input,{narration}),/EPISODE_CAST_PLAN_REQUIRED/);});
test('manifest finalization permits forced native revalidation only after genuine source-bound core and completed steps',async()=>{
 const {mkdtemp,mkdir,writeFile,rm}=await import('node:fs/promises'),os=await import('node:os'),path=await import('node:path'),root=await mkdtemp(path.join(os.tmpdir(),'z-finalize-intent-'));
 try{await mkdir(path.join(root,'.authoring'));const input=intent(),out=api.compileVisualIntent(input,{narration});
  const put=(rel,value)=>writeFile(path.join(root,rel),JSON.stringify(value));
  await writeFile(path.join(root,'narration.txt'),narration);await put('.authoring/visual-intent.json',input);await put('.authoring/visual-intent-projection-receipt.json',out.receipt);for(const [key,rel]of Object.entries(api.projectionPaths))if(out[key]!==null)await put(rel,out[key]);
  out.production.scenes[0].compiled_metadata={native:true};await put('production.json',out.production);
  await put('.authoring/phase02-execution-receipt.json',{mode:'run',status:'NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED',projection_source_sha256:out.receipt.source_sha256});
  const steps=Object.fromEntries(['visual_compile','assets','publish_prep'].map(id=>[id,{status:'PASS'}]));await put('.authoring/pipeline-state.json',{phases:{'02-visual-production':{steps}}});
  await assert.rejects(()=>api.verifyIntentWorkspace(root),/PROJECTION_DRIFT/);assert.equal((await api.verifyIntentWorkspace(root,{revalidateNativeOutput:true})).status,'REVALIDATION_REQUIRED');
  steps.assets.status='IN_PROGRESS';await put('.authoring/pipeline-state.json',{phases:{'02-visual-production':{steps}}});await assert.rejects(()=>api.verifyIntentWorkspace(root,{revalidateNativeOutput:true}),/COMPLETED_NATIVE_MANIFEST/);
  steps.assets.status='PASS';await put('.authoring/pipeline-state.json',{phases:{'02-visual-production':{steps}}});out.asset_plan.extra='tampered';await put('asset-plan.json',out.asset_plan);await assert.rejects(()=>api.verifyIntentWorkspace(root,{revalidateNativeOutput:true}),/PROJECTION_DRIFT/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('fresh narrative visual authoring accepts simple representation without three-beat object plan',()=>{
 const input=intent();
 input.taxonomy_version='narrative_visual@1';
 delete input.story_object_decision;
 input.narrative_visual_decision={mode:'required',reason:'Compare two choices',review_ref:'review:nv1'};
 input.scenes[0].entities[0].kind='narrative_visual';
 input.scenes[0].entities[0].visual_role='narrative_visual';
 input.assets.a.category='narrative_visual';
 const out=api.compileVisualIntent(input,{narration});
 assert.equal(out.production.scenes[0].entities[0].kind,'narrative_visual');
 assert.equal(out.story_object_plan,null);
 input.scenes[0].entities[0].kind='story_symbol';
 assert.throws(()=>api.compileVisualIntent(input,{narration}),/FRESH_SYMBOLIC_ALIAS_FORBIDDEN/);
});
