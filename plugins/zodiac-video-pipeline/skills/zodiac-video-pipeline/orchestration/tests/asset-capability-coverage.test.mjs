import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileVisualGrammar} from '../../references/asset-library-v4/compile-visual-grammar.mjs';
import {compileSceneSetWorkspace} from '../../references/asset-library-v4/scene-set/compile-scene-set.mjs';
import {selectAssetGuidance} from '../select-asset-guidance.mjs';

const orchestration=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const skill=path.resolve(orchestration,'..');
const library=path.join(skill,'references/asset-library-v4');
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const json=async rel=>JSON.parse(await readFile(path.join(library,rel),'utf8'));

const NEW_SCENES=['scene-set-classroom','scene-set-study','scene-set-street','scene-set-neutral'];
const NEW_ACCENTS=['scene-accent-board','scene-accent-shelf','scene-accent-clock','scene-accent-sign'];

test('asset capability index covers fresh scene, cast, interaction and effect needs',async()=>{
 const capabilities=await json('capability-index.json');
 const coverage=await json('coverage-matrix.json');
 assert.equal(capabilities.format,'zodiac-asset-capability-index@1');
 assert.equal(coverage.format,'zodiac-asset-coverage-matrix@1');
 for(const id of NEW_SCENES){
  assert.equal(capabilities.scene_sets?.[id]?.fresh,true,id+' must be fresh');
  assert.deepEqual(capabilities.scene_sets[id].cast,[1,2,3]);
 }
 assert.deepEqual(capabilities.layouts?.['three-person-comparison']?.cast,[3]);
 for(const id of ['pass-object','hold-show','compare-group'])assert.ok(capabilities.interactions?.[id],id+' interaction capability missing');
 assert.deepEqual(capabilities.effects,{});
 const needs=new Map((coverage.needs??[]).map(row=>[row.id,row]));
 for(const id of ['scene.classroom','scene.study','scene.street','scene.neutral','cast.three_compare','interaction.pass_object'])assert.ok(needs.has(id),id+' coverage missing');
});

test('new scene-set and accent masters are registered, hashed and style-safe',async()=>{
 const registry=await json('scene-set/index.json');
 const accents=await json('scene-set/accents/index.json');
 for(const id of NEW_SCENES){
  const row=registry.scene_sets.find(item=>item.id===id);assert.ok(row,id+' registry missing');
  const raw=await readFile(path.join(library,'scene-set',row.path));
  assert.equal(sha(raw),row.asset_sha256,id+' hash drift');
  const text=raw.toString('utf8');
  assert.match(text,/asset_role=environment_scene_set/u);assert.match(text,/style=zodiac-paper-doodle-meme-v4/u);assert.match(text,/accent_policy=inside_wall_only/u);
 }
 assert.equal(new Set(NEW_SCENES.map(id=>registry.scene_sets.find(item=>item.id===id).asset_sha256)).size,NEW_SCENES.length,'new scene sets must not be byte duplicates');
 for(const id of NEW_ACCENTS){
  const row=accents.accents.find(item=>item.id===id);assert.ok(row,id+' registry missing');
  assert.equal(row.containment,'inside_scene_set_wall');
  const raw=await readFile(path.join(library,'scene-set',row.path));assert.equal(sha(raw),row.asset_sha256,id+' hash drift');
 }
});

test('three-person comparison layout compiles without inventing runtime geometry',async()=>{
 const layouts=await json('shot-layouts/index.json');
 const compat=await json('frames/index.json');
 const row=(layouts.layouts??layouts.frames).find(item=>item.id==='three-person-comparison');assert.ok(row);
 assert.ok((compat.frames??[]).some(item=>item.id==='three-person-comparison'));
 const production={version:'2.0',scenes:[{id:'s1',entities:[
  {id:'lead',kind:'character'},{id:'left',kind:'character'},{id:'right',kind:'character'}
 ]}]};
 const out=compileVisualGrammar(production,{format:'zodiac-visual-grammar-plan@1',scenes:[{scene_id:'s1',frame_id:'three-person-comparison',mechanic_id:'compare-group',bindings:{lead:'lead',peer_a:'left',peer_b:'right'}}]});
 assert.equal(out.scenes[0].scene_direction.shot,'three-person');
 assert.deepEqual(out.scenes[0].scene_direction.interaction_roles,{lead:'lead',peer_a:'left',peer_b:'right'});
});

test('semantic effect capabilities resolve to native catalog entries with bounded lifecycle',async()=>{
 const capabilities=await json('capability-index.json');
 const effects=await json('effects/meme-effect-catalog.json');
 for(const [semantic,row] of Object.entries(capabilities.effects)){
  assert.ok(effects.effects?.[row.effect_id],semantic+' maps to missing native effect '+row.effect_id);
  assert.equal(row.lifecycle,'bounded_enter_release');
 }
});

test('fresh scene selection stays selected-only and does not load compatibility environment cues',async()=>{
 const policy=await json('selection-policy.json');
 const selected=selectAssetGuidance({selected_asset_ids:['scene-set-classroom'],environment_mode:'scene_set'},policy);
 assert.deepEqual(selected.unresolved_ids,[]);
 assert.equal(selected.extension_refs.some(ref=>ref.includes('environments/composition-index.json')),false);
 const production={version:'2.0',assets:{},scenes:[{id:'s1',environment:{scene_set_id:'scene-set-classroom'},entities:[]}]};
 const compiled=await compileSceneSetWorkspace('/tmp/not-written',{production,libraryRoot:path.join(library,'scene-set'),write:false});
 assert.ok(compiled.production.assets.ENV_SCENE_SET_CLASSROOM);
 assert.equal(Boolean(compiled.production.assets.ENV_SCENE_SET_HOME),false);
 assert.equal(Boolean(compiled.production.assets.ENV_SCENE_SET_CAFE),false);
 assert.deepEqual(Object.keys(compiled.files),['assets/environment/scene-set-classroom.svg']);
});

test('narrative asset needs resolve through coverage matrix before guidance selection',async()=>{
 const policy=await json('selection-policy.json');
 const capabilityIndex=await json('capability-index.json');
 const coverageMatrix=await json('coverage-matrix.json');
 const selected=selectAssetGuidance({
  asset_needs:['scene.classroom','cast.three_compare'],
  environment_mode:'scene_set'
 },policy,{capabilityIndex,coverageMatrix});
 assert.deepEqual(selected.unresolved_needs,[]);
 assert.ok(selected.resolved_capabilities.some(row=>row.need_id==='scene.classroom'&&row.capability_id==='scene-set-classroom'&&row.kind==='scene_set'));
 assert.ok(selected.resolved_capabilities.some(row=>row.need_id==='cast.three_compare'&&row.capability_id==='three-person-comparison'&&row.kind==='layout'));
 assert.throws(()=>selectAssetGuidance({asset_needs:['effect.confusion']},policy,{capabilityIndex,coverageMatrix}),/ASSET_CAPABILITY_NEED_UNKNOWN/);
 assert.ok(selected.selected_asset_ids.includes('scene-set-classroom'));
 assert.deepEqual(selected.unresolved_ids,[]);
 assert.equal(selected.extension_refs.some(ref=>ref.includes('environments/composition-index.json')),false);
});

test('unknown narrative asset need fails closed',async()=>{
 const policy=await json('selection-policy.json');
 const capabilityIndex=await json('capability-index.json');
 const coverageMatrix=await json('coverage-matrix.json');
 assert.throws(()=>selectAssetGuidance({asset_needs:['scene.not-real'],environment_mode:'scene_set'},policy,{capabilityIndex,coverageMatrix}),/ASSET_CAPABILITY_NEED_UNKNOWN scene.not-real/u);
});
