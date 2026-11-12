import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePhase02AuthoringCompleteness} from '../../../features/visual-composition/validate-phase02-authoring-completeness.mjs';

const base=()=>({
 run_mode:'fresh',
 intent:{taxonomy_version:'narrative_visual@1',narrative_visual_decision:{mode:'required',reason:'story'},scene_plan:{scenes:[{id:'S01',purpose:'setup',beats:['setup']}]}},
 production:{scenes:[{id:'S01',environment:{},entities:[{id:'C',kind:'character',initial_state:'idle',states:{idle:{}}},{id:'P',kind:'object',visual_role:'interactive_prop',initial_state:'idle',states:{idle:{}}},{id:'NV',kind:'object',visual_role:'story_object',initial_state:'hidden',states:{hidden:{visible:false},shown:{}}},{id:'BG',kind:'scene_accent',initial_state:'visible',states:{visible:{asset:'BG',visible:true,transform:{x:40,y:40,width:120,height:100}}}}],events:[{id:'E1',target:'P',state_before:'idle',state_after:'idle'},{id:'E2',target:'NV',state_before:'hidden',state_after:'shown'}]}]},
 art:{scenes:[{id:'S01',visual_coverage:{beats:[{layers:{story_text:{decision:'omit',reason:'The acted prop change carries this beat without lettering.'},meme:{decision:'omit',reason:'A quiet comparison needs no exaggerated reaction.'},actors:{decision:'use',reason:'x',entity_ids:['C']},props:{decision:'use',reason:'x',entity_ids:['P']},narrative_visual:{decision:'use',reason:'x',entity_ids:['NV']},scene_accent:{decision:'use',reason:'narrated context',entity_ids:['BG']}}}]}}]},
 director:{beats:[{scene_id:'S01'}]},
 character:{characters:[{entity_id:'C',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'scorpio'}]},episodeScope:{member_ids:['scorpio']},episodeCast:{bindings:[{member_id:'scorpio',entity_id:'C',role:'member',scene_ids:['S01']}]}
});
test('fresh authoring blocks missing scene plan',()=>{const f=base();delete f.intent.scene_plan;const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_SCENE_PLAN_REQUIRED'));});
test('required narrative visual must participate in coverage and event chain',()=>{const f=base();f.art.scenes[0].visual_coverage.beats[0].layers.narrative_visual={decision:'omit',reason:'oops'};const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_NARRATIVE_VISUAL_COVERAGE_REQUIRED'));});
test('declared physical prop must participate in an event',()=>{const f=base();f.production.scenes[0].events=f.production.scenes[0].events.filter(e=>e.target!=='P');const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_PROP_EVENT_REQUIRED'));});
test('complete fresh authoring passes',()=>assert.equal(validatePhase02AuthoringCompleteness(base()).status,'PASS'));

test('every fresh beat considers lettering and meme acting even without selected entities',()=>{
 const f=base(),layers=f.art.scenes[0].visual_coverage.beats[0].layers;
 for(const layer of ['story_text','meme'])delete layers[layer];
 const issues=validatePhase02AuthoringCompleteness(f).issues;
 for(const layer of ['story_text','meme'])assert.ok(issues.some(i=>i.code==='PHASE02_EDITORIAL_DECISION_REQUIRED'&&i.detail===layer));
});

test('declared lettering and meme use require actual authoring and an anchored reaction in that beat',()=>{
 const f=base(),beat=f.art.scenes[0].visual_coverage.beats[0];
 beat.layers.story_text={decision:'use',reason:'The label contradicts the reaction.',entity_ids:['missing']};
 beat.layers.meme={decision:'use',reason:'The speaker realizes their mistake.',entity_ids:['C']};
 let issues=validatePhase02AuthoringCompleteness(f).issues;
 assert.ok(issues.some(i=>i.code==='PHASE02_STORY_TEXT_SELECTION_REQUIRED'));
 assert.ok(issues.some(i=>i.code==='PHASE02_MEME_REACTION_REQUIRED'));
 beat.layers.story_text={decision:'omit',reason:'Keep the realization silent.'};
 f.intent.scenes=[{id:'S01',grammar:{meme_composition:{id:'facepalm-closeup',bindings:{actor:'C'},state_bindings:{actor:'realization'}}}}];
 f.production.scenes[0].entities[0].states.realization={visible:true};
 const event={id:'REACTION',target:'C',state_before:'idle',state_after:'realization',trigger:{type:'voice_anchor',text:'Thôi.'}};
 f.production.scenes[0].voice='Thôi.';f.production.scenes[0].events.push(event);beat.event_ids=['REACTION'];
 assert.equal(validatePhase02AuthoringCompleteness(f).status,'PASS');
 f.production.scenes[0].entities[0].initial_state='realization';
 event.state_before='realization';
 assert.ok(validatePhase02AuthoringCompleteness(f).issues.some(i=>i.code==='PHASE02_MEME_REACTION_REQUIRED'));
 f.production.scenes[0].entities[0].initial_state='idle';
 event.state_before='missing';assert.throws(()=>validatePhase02AuthoringCompleteness(f),/TRACE_STATE_BEFORE/);event.state_before='idle';
 beat.event_ids=[];assert.ok(validatePhase02AuthoringCompleteness(f).issues.some(i=>i.code==='PHASE02_MEME_REACTION_REQUIRED'));
 beat.event_ids=['REACTION'];beat.layers.meme={decision:'omit',reason:'No reaction intended.'};
 assert.ok(validatePhase02AuthoringCompleteness(f).issues.some(i=>i.code==='PHASE02_MEME_COVERAGE_REQUIRED'));
});
test('fresh authoring still requires a visible covered background cue',()=>{const f=base();f.production.scenes[0].entities=f.production.scenes[0].entities.filter(e=>e.id!=='BG');assert.ok(validatePhase02AuthoringCompleteness(f).issues.some(i=>i.code==='PHASE02_SCENE_BACKGROUND_REQUIRED'));});

test('fresh authoring rejects legacy Scene Set selection',()=>{const f=base();f.intent.scenes=[{id:'S01',grammar:{environment:{scene_set_id:'scene-set-cafe'}}}];const r=validatePhase02AuthoringCompleteness(f);assert(r.issues.some(x=>x.code==='PHASE02_LEGACY_SCENE_SET_FORBIDDEN'));});
test('continuity recovery remains outside fresh completeness gate',()=>{const f=base();f.run_mode='continuity';f.intent.scenes=[{grammar:{environment:{scene_set_id:'legacy'}}}];assert.equal(validatePhase02AuthoringCompleteness(f).status,'NOT_APPLICABLE');});

test('required Narrative Visual may be concentrated in selected scenes',()=>{
 const f=base();f.intent.scene_plan.scenes.push({id:'S02',purpose:'quiet reaction',beats:['hold']});
 const quiet=structuredClone(f.production.scenes[0]);quiet.id='S02';quiet.entities=quiet.entities.filter(e=>['C','BG'].includes(e.id));quiet.events=[];f.production.scenes.push(quiet);
 f.art.scenes.push({id:'S02',visual_coverage:{beats:[{layers:{story_text:{decision:'omit',reason:'The acted prop change carries this beat without lettering.'},meme:{decision:'omit',reason:'A quiet comparison needs no exaggerated reaction.'},actors:{decision:'use',reason:'x',entity_ids:['C']},props:{decision:'omit',reason:'none'},narrative_visual:{decision:'omit',reason:'not needed'},scene_accent:{decision:'use',reason:'same narrated context',entity_ids:['BG']}}}]}});
 f.director.beats.push({scene_id:'S02'});assert.equal(validatePhase02AuthoringCompleteness(f).status,'PASS');
});

test('zodiac member character must carry its intrinsic sign glyph shirt',()=>{
 const f=base();f.character.characters[0].outfit_id='plain-shirt';delete f.character.characters[0].zodiac_sign_id;
 const r=validatePhase02AuthoringCompleteness(f);
 assert(r.issues.some(x=>x.code==='PHASE02_ZODIAC_MEMBER_GLYPH_REQUIRED'&&x.detail==='C:scorpio'));
});
test('zodiac member glyph must match bound member id',()=>{
 const f=base();f.character.characters[0].zodiac_sign_id='libra';
 const r=validatePhase02AuthoringCompleteness(f);
 assert(r.issues.some(x=>x.code==='PHASE02_ZODIAC_MEMBER_GLYPH_MISMATCH'&&x.detail==='C:scorpio->libra'));
});
test('shared narrator may remain plain-shirt',()=>{
 const f=base();f.episodeCast.bindings[0].role='shared_narrator';f.character.characters[0].outfit_id='plain-shirt';delete f.character.characters[0].zodiac_sign_id;
 assert.equal(validatePhase02AuthoringCompleteness(f).status,'PASS');
});
