import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhase02AuthoringCompleteness} from '../../../features/visual-composition/validate-phase02-authoring-completeness.mjs';

const base=()=>({
 run_mode:'fresh',
 intent:{taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'required',reason:'story'},scene_plan:{scenes:[{id:'S01',purpose:'setup',beats:['setup']}]}},
 production:{scenes:[{id:'S01',environment:{},entities:[{id:'C',kind:'character'},{id:'P',kind:'object',visual_role:'interactive_prop'},{id:'NV',kind:'narrative_visual'}],events:[{id:'E1',target:'P'},{id:'E2',target:'NV',state_before:'hidden',state_after:'shown'}]}]},
 art:{scenes:[{id:'S01',visual_coverage:{beats:[{layers:{actors:{decision:'use',reason:'x',entity_ids:['C']},props:{decision:'use',reason:'x',entity_ids:['P']},narrative_visual:{decision:'use',reason:'x',entity_ids:['NV']},scene_accent:{decision:'omit',reason:'not needed'}}}]}}]},
 director:{beats:[{scene_id:'S01'}]},
 character:{characters:[{entity_id:'C'}]}
});
test('fresh authoring blocks missing scene plan',()=>{const f=base();delete f.intent.scene_plan;const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_SCENE_PLAN_REQUIRED'));});
test('required narrative visual must participate in coverage and event chain',()=>{const f=base();f.art.scenes[0].visual_coverage.beats[0].layers.narrative_visual={decision:'omit',reason:'oops'};const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_NARRATIVE_VISUAL_COVERAGE_REQUIRED'));});
test('declared physical prop must participate in an event',()=>{const f=base();f.production.scenes[0].events=f.production.scenes[0].events.filter(e=>e.target!=='P');const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_PROP_EVENT_REQUIRED'));});
test('complete fresh authoring passes',()=>assert.equal(validatePhase02AuthoringCompleteness(base()).status,'PASS'));

test('fresh authoring rejects legacy Scene Set selection',()=>{const f=base();f.intent.scenes=[{id:'S01',grammar:{environment:{scene_set_id:'scene-set-cafe'}}}];const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_LEGACY_SCENE_SET_FORBIDDEN'));});
test('fresh authoring rejects legacy Story Object plan',()=>{const f=base();f.intent.story_object_plan={objects:[]};const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_LEGACY_STORY_OBJECT_FORBIDDEN'));});
test('continuity recovery remains outside fresh completeness gate',()=>{const f=base();f.run_mode='continuity';f.intent.story_object_plan={objects:[]};f.intent.scenes=[{grammar:{environment:{scene_set_id:'legacy'}}}];assert.equal(validatePhase02AuthoringCompleteness(f).status,'NOT_APPLICABLE');});

test('required Narrative Visual may be concentrated in selected scenes',()=>{const f=base();f.intent.scene_plan.scenes.push({id:'S02',purpose:'quiet reaction',beats:['hold']});f.production.scenes.push({id:'S02',environment:{},entities:[{id:'C',kind:'character'}],events:[]});f.art.scenes.push({id:'S02',visual_coverage:{beats:[{layers:{actors:{decision:'use',reason:'x',entity_ids:['C']},props:{decision:'omit',reason:'none'},narrative_visual:{decision:'omit',reason:'not needed'},scene_accent:{decision:'omit',reason:'none'}}}]}});f.director.beats.push({scene_id:'S02'});assert.equal(validatePhase02AuthoringCompleteness(f).status,'PASS');});
