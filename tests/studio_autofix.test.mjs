import assert from 'node:assert/strict';
import test from 'node:test';
import {autofixIntent,autofixScene} from '../tools/studio_project/visual_autofix.mjs';
import {quality} from '../tools/studio_project/visual_preview.mjs';

const state=(x,y,width,height,extra={})=>({asset:'a',visible:true,layer:1,transform:{x,y,width,height},...extra});
const scene=()=>({id:'s01',layout_contract:{caption_safe_zone:{x:80,y:1470,width:920,height:360}},events:[],entities:[
  {id:'hero',kind:'character',visual_role:'character',initial_state:'neutral',states:{neutral:state(700,900,500,1100),react:state(700,900,500,1100)}},
  {id:'bg',kind:'object',visual_role:'background',initial_state:'on',states:{on:state(0,0,1080,1920)}},
  {id:'ok',kind:'object',visual_role:'interactive_prop',initial_state:'on',states:{on:state(100,200,200,200)}},
]});
const codes=s=>quality(s,'light',null).issues.map(i=>i.code+':'+i.entity_id).sort();

test('QA reports the faults the fixer is meant to remove', () => {
  const found=codes(scene());
  assert.ok(found.includes('OUTSIDE_CANVAS:hero'));
  assert.ok(found.includes('CAPTION_OCCLUSION:hero'));
});

test('a repaired scene passes the same QA without touching clean or exempt entities', () => {
  const input={scenes:[scene()]};
  const {intent,changes}=autofixIntent(input,{theme:'light'});
  assert.deepEqual(codes(intent.scenes[0]),[]);
  assert.deepEqual(changes.map(c=>c.entity_id),['hero']);
  const fixed=Object.fromEntries(intent.scenes[0].entities.map(e=>[e.id,e]));
  assert.deepEqual(fixed.ok.states.on.transform,{x:100,y:200,width:200,height:200});
  assert.deepEqual(fixed.bg.states.on.transform,{x:0,y:0,width:1080,height:1920});
});

test('every state of one entity gets the same correction, so a pose swap never jumps', () => {
  const {intent}=autofixIntent({scenes:[scene()]},{theme:'light'});
  const hero=intent.scenes[0].entities[0];
  assert.deepEqual(hero.states.neutral.transform,hero.states.react.transform);
});

test('the fix is idempotent and the input is not mutated', () => {
  const original={scenes:[scene()]};
  const snapshot=JSON.stringify(original);
  const once=autofixIntent(original,{theme:'light'});
  assert.equal(JSON.stringify(original),snapshot);
  const twice=autofixIntent(once.intent,{theme:'light'});
  assert.deepEqual(twice.changes,[]);
  assert.deepEqual(twice.intent,once.intent);
});

test('only the named scenes are touched', () => {
  const other={...scene(),id:'s02'};
  const {intent,changes}=autofixIntent({scenes:[scene(),other]},{theme:'light',sceneIds:['s02']});
  assert.deepEqual(changes.map(c=>c.scene_id),['s02']);
  assert.deepEqual(intent.scenes[0].entities[0].states.neutral.transform,{x:700,y:900,width:500,height:1100});
});

test('an entity larger than the canvas is scaled down to fit', () => {
  const big={id:'s03',events:[],entities:[{id:'huge',kind:'object',visual_role:'background_prop',initial_state:'on',states:{on:state(-100,-100,2000,3000)}}]};
  autofixScene(big,'light');
  const t=big.entities[0].states.on.transform;
  assert.ok(t.x>=0&&t.y>=0&&t.x+t.width<=1080&&t.y+t.height<=1920,JSON.stringify(t));
});
