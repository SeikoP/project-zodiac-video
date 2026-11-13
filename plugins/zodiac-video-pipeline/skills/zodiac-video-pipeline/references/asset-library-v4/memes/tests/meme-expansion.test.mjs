import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCharacterSvg} from '../../characters/compile-character-assembly.mjs';
import {validateHumanStroke} from '../../validation/validate-human-stroke.mjs';
import {compileVisualGrammar} from '../../compile-visual-grammar.mjs';
import {compileMemeProps} from '../compile-meme-props.mjs';
import {selectAssetGuidance} from '../../../../core/policy/select-asset-guidance.mjs';
const catalog=JSON.parse(await readFile(new URL('../../characters/components/catalog.json',import.meta.url)));

test('new meme actions preserve identity and handmade geometry on every native body',()=>{
 for(const body of catalog.body_profiles){
  const identity={entity_id:'hero',body_profile:body.id,hair_id:'long-side-part',outfit_id:'plain-shirt'};
  const normal=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  for(const pose of ['hands-on-hips','clasp-hands','hold-broom','cheek-poke','slump','shrug','clap','stop-hand','phone-call']){
   const result=compileCharacterSvg(identity,{pose_id:pose,expression_id:pose==='slump'?'weary':'smug'});
   assert.equal(result.identity_signature,normal.identity_signature);assert.notEqual(result.svg,normal.svg);
   validateHumanStroke(result.svg,'character');
  }
 }
});

test('new verbal reactions have distinct acting and readable complete stock phrases',async()=>{
 const registry=JSON.parse(await readFile(new URL('../index.json',import.meta.url)));
 for(const id of ['plead-mercy','sarcastic-applause','stunned-wow','contempt-dismissal','ultimatum-choice','never-again','confused-shrug','stop-talking','serious-please','call-for-help']){
  const meme=registry.compositions.find(m=>m.id===id);
  assert.ok(meme?.reference_url,id);
  const template=JSON.parse(await readFile(new URL(meme.source,new URL('../',import.meta.url))));
  assert.equal(template.optional_text,meme.text_label.text);
  assert.equal(template.adaptation.meme_text_readability_required,true);
  const label=meme.asset_requirements.find(r=>r.role==='label');
  const svg=await readFile(new URL(label.source_path,new URL('../',import.meta.url)),'utf8');
  assert.ok(svg.includes('<title>'+meme.text_label.text+'</title>'),id);
  if(meme.text_label.text.length>20){assert.match(svg,/viewBox="0 0 [\d.]+ 240"/u);assert.match(svg,/fill="#E97A66"/u);}
 }
 const acting=id=>registry.compositions.find(m=>m.id===id).roles.actor.acting;
 assert.notDeepEqual(acting('plead-mercy'),acting('polite-exit'));
 assert.notDeepEqual(acting('confused-shrug'),acting('innocent-shrug'));
 assert.notDeepEqual(acting('sarcastic-applause'),acting('stunned-wow'));
});

test('optional meme label can be absent or compile as native path art without extra cast',async()=>{
 for(const enabled of [false,true]){
  const entities=[{id:'hero',kind:'character',initial_state:'react',states:{react:{}}}];
  if(enabled)entities.push({id:'label',kind:'object',initial_state:'visible',states:{visible:{}}});
  const source={version:'2.0',assets:{},scenes:[{id:'S01',entities}]};
  const plan={format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'S01',meme_composition:{id:'impatient-wait',bindings:{actor:'hero',...(enabled?{label:'label'}:{})}}}]};
  const projected=compileVisualGrammar(source,plan),out=await compileMemeProps(projected,{writeAssets:false});
  assert.equal(out.scenes[0].entities.filter(e=>e.kind==='character').length,1);
  assert.equal(out.scenes[0].visual_grammar.meme_composition.asset_requirements.length,enabled?1:0);
  if(enabled){const asset=out.assets[out.scenes[0].entities[1].states.visible.asset];assert.match(asset.path,/label/u);}
 }
});

test('all optional label SVGs are portable native paths, not font-dependent text',async()=>{
 const registry=JSON.parse(await readFile(new URL('../index.json',import.meta.url)));
 assert.equal(registry.compositions.filter(c=>c.text_label).length,registry.compositions.length);
 for(const meme of registry.compositions.filter(c=>c.text_label)){
  const requirement=meme.asset_requirements.find(r=>r.role==='label');
  assert.equal(requirement.optional,true);
  const svg=await readFile(new URL(requirement.source_path,new URL('../',import.meta.url)),'utf8');
  assert.doesNotMatch(svg,/<text\b|<image\b|<script\b|\bhref=["']https?:\/\//u);
  assert.match(svg,/<title>/u);validateHumanStroke(svg,'focal');
 }
});

test('every meme, prop and acting component is selectable in Phase 2',async()=>{
 const policy=JSON.parse(await readFile(new URL('../../selection-policy.json',import.meta.url)));
 const registry=JSON.parse(await readFile(new URL('../index.json',import.meta.url)));
 const props=JSON.parse(await readFile(new URL('../../props/index.json',import.meta.url)));
 const ids=[...registry.compositions.map(c=>c.id),...props.assets.map(a=>a.id),...catalog.poses.map(a=>a.id),...catalog.expressions.map(a=>a.id)];
 const result=selectAssetGuidance({selected_asset_ids:ids,meme_selected:true},policy);
 assert.deepEqual(result.unresolved_ids,[]);
 assert.ok(result.extension_refs.some(ref=>ref.includes('memes')));
 assert.ok(registry.compositions.every(c=>c.roles.label.required===false));
 assert.equal(registry.compositions.find(c=>c.id==='heart-offer-overkill').asset_requirements.find(a=>a.role==='heart').source_path,'../props/heart.svg');
});
