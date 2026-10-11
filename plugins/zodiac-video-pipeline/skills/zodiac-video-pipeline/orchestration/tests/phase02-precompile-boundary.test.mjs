import test from 'node:test';
import assert from 'node:assert/strict';
import {validatePrecompileBoundary} from '../validate-phase02-precompile-boundary.mjs';
const production=(voices,entities=[])=>({scenes:voices.map((voice,i)=>({id:'S'+(i+1),voice,entities:entities[i]??[],environment:{roles:{}}})),assets:{}});
const narration='Một đoạn đầu tiên.\n\nMột đoạn thứ hai.';
test('rejects a paragraph split across two scenes before SVG compile',()=>{
 const q=validatePrecompileBoundary(production(['Một đoạn','đầu tiên.','Một đoạn thứ hai.']),narration);
 assert.ok(q.issues.some(x=>x.code==='SCENE_PARAGRAPH_SPLIT'));
});
test('accepts intact approved paragraphs',()=>{
 assert.equal(validatePrecompileBoundary(production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']),narration).status,'PASS');
});
test('blocks reordering or omitted narration without hiding it as whitespace',()=>{
 const q=validatePrecompileBoundary(production(['Một đoạn thứ hai.','Một đoạn đầu tiên.']),narration);
 assert.ok(q.issues.some(x=>x.code==='NARRATION_SCENE_MISMATCH'));
});
test('rejects furniture owned by background but permits separate narrative chair',()=>{
 const auto={id:'env__desk',kind:'object',states:{show:{asset:'a'}}};
 const q=validatePrecompileBoundary(production(['Một đoạn đầu tiên.','Một đoạn thứ hai.'],[[auto]]),narration);
 assert.ok(q.issues.some(x=>x.code==='BACKGROUND_FURNITURE_OWNERSHIP'));
 const chair={id:'chair',kind:'prop',states:{show:{asset:'b'}}};
 assert.equal(validatePrecompileBoundary(production(['Một đoạn đầu tiên.','Một đoạn thứ hai.'],[[chair]]),narration).status,'PASS');
});

test('blocks event references to missing entities before SVG compilation',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].events=[{id:'x',target:'missing-chair',trigger:{type:'voice_anchor',text:'Một đoạn'}}];
 assert.ok(validatePrecompileBoundary(doc,narration).issues.some(x=>x.code==='EVENT_TARGET_NOT_IN_SCENE'));
});
test('blocks voice anchors absent from the scene narration',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[{id:'kimnguu',kind:'character'}];
 doc.scenes[0].events=[{id:'x',target:'kimnguu',trigger:{type:'voice_anchor',text:'đoạn thứ hai'}}];
 assert.ok(validatePrecompileBoundary(doc,narration).issues.some(x=>x.code==='EVENT_VOICE_ANCHOR_NOT_IN_SCENE'));
});
test('allows event with present target and matching voice anchor',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[{id:'kimnguu',kind:'character'}];
 doc.scenes[0].events=[{id:'x',target:'kimnguu',trigger:{type:'voice_anchor',text:'đoạn đầu tiên'}}];
 assert.equal(validatePrecompileBoundary(doc,narration).status,'PASS');
});
test('rejects event state not declared on target entity',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[{id:'lead',kind:'character',states:{idle:{asset:'A'}}}];
 doc.scenes[0].events=[{id:'e',target:'lead',state_before:'idle',state_after:'disappear',trigger:{type:'scene_start'}}];
 assert.ok(validatePrecompileBoundary(doc,narration).issues.some(x=>x.code==='EVENT_STATE_NOT_DECLARED'));
});
test('rejects effect starting before object reveal',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[{id:'anchor',kind:'object',initial_state:'hidden',states:{hidden:{visible:false,asset:'A'},visible:{visible:true,asset:'A'}}},{id:'anchor_effect',kind:'effect',source_object_id:'anchor',initial_state:'visible',states:{visible:{asset:'B'}}}];
 doc.scenes[0].events=[{id:'e1',target:'anchor_effect',state_after:'visible',trigger:{type:'scene_start'}},{id:'e2',target:'anchor',state_after:'visible',trigger:{type:'voice_anchor',text:'đầu tiên'}}];
 assert.ok(validatePrecompileBoundary(doc,narration).issues.some(x=>x.code==='EFFECT_PRECEDES_OBJECT'));
});

test('rejects foreground furniture occluding a character face',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[
  {id:'lead',kind:'character',initial_state:'idle',states:{idle:{asset:'C',visible:true,transform:{x:200,y:180,width:400,height:700}}}},
  {id:'table',kind:'object',initial_state:'visible',states:{visible:{asset:'T',visible:true,transform:{x:100,y:220,width:720,height:320}}}}
 ];
 const q=validatePrecompileBoundary(doc,narration);
 assert.ok(q.issues.some(x=>x.code==='PROP_OCCLUDES_CHARACTER_FACE'));
});
test('allows a table limited to the lower body and semantic chair',()=>{
 const doc=production(['Một đoạn đầu tiên.','Một đoạn thứ hai.']);
 doc.scenes[0].entities=[
  {id:'lead',kind:'character',initial_state:'idle',states:{idle:{asset:'C',visible:true,transform:{x:200,y:180,width:400,height:700}}}},
  {id:'table',kind:'object',initial_state:'visible',states:{visible:{asset:'T',visible:true,transform:{x:100,y:610,width:720,height:320}}}}
 ];
 assert.equal(validatePrecompileBoundary(doc,narration).status,'PASS');
});
