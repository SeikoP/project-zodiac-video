import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../..');
const validatorPath=path.join(skill,'features/visual-metaphor/validate-visual-metaphor.mjs');
const compositionPath=path.join(skill,'features/visual-metaphor/validate-visual-metaphor-composition.mjs');
const compilerPath=path.join(skill,'features/visual-metaphor/compile-visual-metaphor-plan.mjs');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

const libraPlan={
 format:'zodiac-visual-metaphor-plan@1',
 decision:{mode:'required',reason:'Narration contrasts two choices',review_ref:'review-1'},
 metaphors:[{
  id:'libra-two-directions',
  meaning:'weighing competing choices',
  visual_states:{
   tilt_left:{visual_read:'left dish visibly lower than right',signature:'scale:left:-12'},
   balanced:{visual_read:'both dishes level',signature:'scale:level:0'},
   tilt_right:{visual_read:'right dish visibly lower than left',signature:'scale:right:12'}
  },
  cues:[
   {scene_id:'S03',voice_anchor:'bên này',state:'tilt_left',relation:{mode:'near',anchor:'character.lead'}},
   {scene_id:'S03',voice_anchor:'cân bằng',state:'balanced',relation:{mode:'near',anchor:'character.lead'}},
   {scene_id:'S03',voice_anchor:'bên kia',state:'tilt_right',relation:{mode:'near',anchor:'character.lead'}}
  ]
 }]
};

test('Visual Metaphor has canonical feature owners',async()=>{
 for(const p of [validatorPath,compositionPath,compilerPath])assert.equal(await exists(p),true,p+' missing');
});

test('a stateful Libra metaphor accepts left balanced right states without story lifecycle roles',async()=>{
 assert.equal(await exists(validatorPath),true,'validator missing');
 const {validateVisualMetaphorPlan}=await import(pathToFileURL(validatorPath));
 const result=validateVisualMetaphorPlan(libraPlan);
 assert.equal(result.status,'PASS');
 assert.equal(result.metaphors,1);
 assert.deepEqual(result.issues,[]);
});

test('one-state metaphor is valid and setup friction payoff are not required',async()=>{
 assert.equal(await exists(validatorPath),true,'validator missing');
 const {validateVisualMetaphorPlan}=await import(pathToFileURL(validatorPath));
 const plan=structuredClone(libraPlan);
 plan.metaphors[0].visual_states={balanced:{visual_read:'both dishes level',signature:'scale:level:0'}};
 plan.metaphors[0].cues=[{scene_id:'S03',voice_anchor:'cân bằng',state:'balanced',relation:{mode:'near',anchor:'character.lead'}}];
 const result=validateVisualMetaphorPlan(plan);
 assert.equal(result.status,'PASS');
 assert.equal(JSON.stringify(result).includes('setup'),false);
 assert.equal(JSON.stringify(result).includes('friction'),false);
 assert.equal(JSON.stringify(result).includes('payoff'),false);
});

test('unknown cue state is blocked',async()=>{
 assert.equal(await exists(validatorPath),true,'validator missing');
 const {validateVisualMetaphorPlan}=await import(pathToFileURL(validatorPath));
 const plan=structuredClone(libraPlan); plan.metaphors[0].cues[0].state='missing';
 const result=validateVisualMetaphorPlan(plan);
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.issues.some(x=>x.code==='VISUAL_METAPHOR_STATE_UNKNOWN'));
});

test('used states with identical authored signatures are blocked',async()=>{
 assert.equal(await exists(validatorPath),true,'validator missing');
 const {validateVisualMetaphorPlan}=await import(pathToFileURL(validatorPath));
 const plan=structuredClone(libraPlan);
 plan.metaphors[0].visual_states.tilt_right.signature=plan.metaphors[0].visual_states.tilt_left.signature;
 const result=validateVisualMetaphorPlan(plan);
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.issues.some(x=>x.code==='VISUAL_METAPHOR_STATE_DUPLICATE'));
});

test('Visual Metaphor cannot own background or environment roles',async()=>{
 assert.equal(await exists(compositionPath),true,'composition validator missing');
 const {validateVisualMetaphorComposition}=await import(pathToFileURL(compositionPath));
 const production={
  assets:{M:{category:'prop',style_id:'zodiac-paper-doodle-meme-v4'}},
  scenes:[{id:'S03',voice:'bên này rồi cân bằng rồi bên kia',environment:{roles:{background:['metaphor']},frame:{slots:[]}},entities:[
   {id:'lead',kind:'character',states:{base:{visible:true,transform:{x:320,y:560,width:320,height:500}}}},
   {id:'metaphor',kind:'object',states:{tilt_left:{asset:'M',visible:true,transform:{x:650,y:420,width:220,height:180}}}}
  ],spatial_bindings:[{entity:'metaphor',anchor:'lead',relation:'near'}]}]
 };
 const result=validateVisualMetaphorComposition(libraPlan,production);
 assert.equal(result.status,'BLOCKED');
 assert.ok(result.issues.some(x=>x.code==='VISUAL_METAPHOR_USED_AS_ENVIRONMENT'));
});

test('fresh template no longer requires Story Object and exposes lightweight metaphor routing flag',async()=>{
 const state=JSON.parse(await readFile(path.join(skill,'orchestration/pipeline-state.template.json'),'utf8'));
 assert.equal(state.flags.story_object_required??false,false);
 assert.equal(state.flags.visual_metaphor_selected??false,false);
});
