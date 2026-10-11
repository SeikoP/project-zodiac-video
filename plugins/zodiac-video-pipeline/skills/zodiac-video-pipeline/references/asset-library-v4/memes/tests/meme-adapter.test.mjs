import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {compileVisualGrammar} from '../../compile-visual-grammar.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const index=JSON.parse(await readFile(path.join(here,'../index.json'),'utf8'));
const production=()=>({version:'2.0',scenes:[{id:'S01',entities:[
  {id:'hero',kind:'character',initial_state:'react',states:{react:{}}},
  {id:'phone',kind:'object',initial_state:'hold',states:{hold:{}}}
]}]});

test('facepalm meme compiles its adapter, acting requirement, and composition layout',()=>{
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{
    scene_id:'S01',frame_id:'reaction-closeup',bindings:{subject:'hero'},
    meme_composition:{id:'facepalm-closeup',bindings:{actor:'hero'}}
  }]};
  const out=compileVisualGrammar(production(),plan);
  const scene=out.scenes[0];
  assert.equal(scene.visual_grammar.meme_composition.id,'facepalm-closeup');
  assert.deepEqual(scene.visual_grammar.meme_composition.acting_requirements.hero,
    {pose_id:'facepalm',expression_id:'exasperated',crop_id:'face-closeup'});
  assert.deepEqual(scene.scene_direction.meme_layout.entities.hero,[540,560,700,760]);
  assert.equal(scene.scene_direction.shot,'reaction-closeup');
});

test('unknown meme composition fails closed',()=>{
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{
    scene_id:'S01',frame_id:'reaction-closeup',mechanic_id:'react',bindings:{subject:'hero'},
    meme_composition:{id:'invented-template',bindings:{actor:'hero'}}
  }]};
  assert.throws(()=>compileVisualGrammar(production(),plan),/unknown meme composition invented-template/u);
});

test('registry covers every promoted V4 meme template',()=>{
  const expected=['absurd-offer','cry-closeup','cry-hug-object','equip-this','facepalm-closeup','heart-offer-overkill','mirror-self-check','prop-pressure','receipt-in-face','side-eye-object','wallet-flex'];
  assert.deepEqual(index.compositions.map(x=>x.id).sort(),expected.sort());
});
test('each registered meme declares the approved effect primitive and a stable locus',()=>{const expected={'absurd-offer':'offer-swish','cry-closeup':'tear-trails','cry-hug-object':'tear-squeeze','equip-this':'offer-impact','facepalm-closeup':'facepalm-impact','heart-offer-overkill':'sparkle-burst','mirror-self-check':'mirror-glint','prop-pressure':'contact-fan-pressure','receipt-in-face':'contact-fan-receipt','side-eye-object':'question-accent','wallet-flex':'wallet-shine'};for(const composition of index.compositions){assert.equal(composition.effect?.id,expected[composition.id],`${composition.id} effect`);assert.ok(composition.effect?.anchor,`${composition.id} effect anchor`);assert.ok(Array.isArray(composition.effect?.size_px)&&composition.effect.size_px.every(n=>Number.isFinite(n)&&n>0),`${composition.id} effect size`);}});
test('equip-this requires a receiver and offers pants into their handoff zone',()=>{const composition=index.compositions.find(x=>x.id==='equip-this');assert.equal(composition.frame_id,'two-person-offset');assert.equal(composition.mechanic_id,'offer-pants-for-embarrassment');assert.equal(composition.roles.embarrassed_target.required,true);assert.equal(composition.roles.embarrassed_target.slot,'listener');assert.ok(composition.required_contacts.includes('pants→target.handoff_zone'));assert.ok(!composition.required_contacts.some(x=>x.includes('head_zone')));});

test('all registered compositions compile from existing role bindings',()=>{
  for(const composition of index.compositions){
    const entities=[];
    const bindings={};
    for(const [role,contract] of Object.entries(composition.roles)){
      if(!contract.required)continue;
      const entityId=`${composition.id}-${role}`;
      bindings[role]=entityId;
      entities.push({id:entityId,kind:contract.kind,initial_state:'meme',states:{meme:{}}});
    }
    const scene={id:'S01',entities};
    const result=compileVisualGrammar({version:'2.0',scenes:[scene]},{format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:composition.id,bindings}}]});
    assert.equal(result.scenes[0].visual_grammar.meme_composition.id,composition.id);
    assert.ok(result.scenes[0].visual_grammar.meme_composition.required_contacts.length>0,composition.id);
    assert.equal(result.scenes[0].visual_grammar.meme_composition.effects[0].id,composition.effect.id,composition.id);
    assert.ok(result.scenes[0].scene_direction.meme_layout.entities[result.scenes[0].visual_grammar.meme_composition.effects[0].entity_id],composition.id+' effect box');
  }
});

test('receipt confrontation maps both characters and the prop into distinct role boxes',()=>{
  const p={version:'2.0',scenes:[{id:'S01',entities:[
    {id:'evidence',kind:'character'},{id:'target',kind:'character'},{id:'receipt',kind:'object'}
  ]}]};
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'receipt-in-face',bindings:{evidence_actor:'evidence',target:'target',receipt:'receipt'}}}]};
  const scene=compileVisualGrammar(p,plan).scenes[0];
  assert.deepEqual(scene.scene_direction.interaction_roles,{speaker:'evidence',listener:'target',shared_prop:'receipt'});
  assert.equal(scene.scene_direction.meme_layout.entities.evidence[0],305);
  assert.equal(scene.scene_direction.meme_layout.entities.target[0],785);
  assert.equal(scene.scene_direction.meme_layout.entities.receipt[0],550);
});

test('required role cannot bind to the wrong entity kind',()=>{
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'facepalm-closeup',bindings:{actor:'phone'}}}]};
  assert.throws(()=>compileVisualGrammar(production(),plan),/role actor expects character, got object/u);
});

test('adapter rejects a generic frame override that erases its composition',()=>{
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',frame_id:'single-character-focus',mechanic_id:'react',meme_composition:{id:'facepalm-closeup',bindings:{actor:'hero'}}}]};
  assert.throws(()=>compileVisualGrammar(production(),plan),/requires frame reaction-closeup, got single-character-focus/u);
});

test('required prop role cannot be omitted',()=>{
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'cry-hug-object',bindings:{actor:'hero'}}}]};
  assert.throws(()=>compileVisualGrammar(production(),plan),/missing required role prop/u);
});
