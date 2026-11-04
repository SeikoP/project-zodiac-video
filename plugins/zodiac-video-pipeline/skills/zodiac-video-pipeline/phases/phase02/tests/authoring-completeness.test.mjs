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
