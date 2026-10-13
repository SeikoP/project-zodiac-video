import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScenePlan} from '../scene-plan.mjs';
const source={scenes:[{id:'S01'},{id:'S02'}],scene_plan:{scenes:[
  {id:'S01',purpose:'Introduce two friends',beats:['setup']},
  {id:'S02',purpose:'Contrast their experiences',beats:['contrast'],transition_reason:'Shift story focus'}
]}};
test('multi-scene plan maps boundaries exactly',()=>assert.equal(validateScenePlan(source).status,'PASS'));
test('planned boundaries cannot collapse into one S01',()=>{
 const result=validateScenePlan({...source,scenes:[{id:'S01'}]});
 assert.ok(result.issues.some(x=>x.code==='SCENE_PLAN_DRIFT'));
});
test('single-scene is valid when intentional and justified',()=>{
 const v=validateScenePlan({scenes:[{id:'S01'}],scene_plan:{scenes:[{id:'S01',purpose:'Single continuous shot',beats:['setup','payoff']}],single_scene_rationale:'One continuous interaction',continuous_visual_logic:'Camera and focus evolve without cutting'}});
 assert.equal(v.status,'PASS');
});
test('single scene without authoring rationale is blocked',()=>{
 const result=validateScenePlan({scenes:[{id:'S01'}],scene_plan:{scenes:[{id:'S01',purpose:'all',beats:['setup','payoff']}]}});
 assert.ok(result.issues.some(x=>x.code==='SINGLE_SCENE_RATIONALE_MISSING'));
});
test('new authoring can require an explicit scene plan',()=>{
 assert.equal(validateScenePlan({scenes:[{id:'S01'}]},{required:true}).issues[0].code,'SCENE_PLAN_MISSING');
});
