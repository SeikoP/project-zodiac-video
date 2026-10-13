import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshPreferredHairIds} from '../../references/asset-library-v4/characters/select-character-components.mjs';
import {selectAssetGuidance} from '../select-asset-guidance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../..');
const lib=path.join(skill,'references/asset-library-v4');
const json=async rel=>JSON.parse(await readFile(path.join(lib,rel),'utf8'));
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const sha=raw=>createHash('sha256').update(raw).digest('hex');

test('Visual Metaphor library covers six reusable mechanisms with real distinct states',async()=>{
 const index=await json('visual-metaphors/index.json');
 assert.equal(index.format,'zodiac-visual-metaphor-assets@1');
 assert.ok(index.metaphors.length>=6,'need at least six metaphor mechanisms');
 const ids=new Set(index.metaphors.map(x=>x.id));
 for(const id of ['balance-scale','split-direction','push-pull','focus-shift','barrier-opening','comparison-level'])assert.ok(ids.has(id),id+' missing');
 for(const row of index.metaphors){
  assert.ok(Object.keys(row.states??{}).length>=2,row.id+' needs at least two states');
  const hashes=[];
  for(const [stateId,state] of Object.entries(row.states)){
   assert.ok(state.path,row.id+'/'+stateId+' path missing');
   const abs=path.join(lib,'visual-metaphors',state.path);
   assert.equal(await exists(abs),true,row.id+'/'+stateId+' file missing');
   const raw=await readFile(abs);hashes.push(sha(raw));
  }
  assert.equal(new Set(hashes).size,hashes.length,row.id+' states must be byte-distinct');
 }
 const libra=index.metaphors.find(x=>x.id==='balance-scale');
 assert.deepEqual(Object.keys(libra.states).sort(),['balanced','tilt_left','tilt_right']);
});

test('character diversity expands fresh silhouettes faces accessories and interaction poses',async()=>{
 const [catalog,promotedAccessories]=await Promise.all([json('characters/components/catalog.json'),json('characters/accessories/index.json')]);
 const preferred=freshPreferredHairIds(catalog);
 assert.ok(preferred.length>=8,'need >=8 fresh preferred hair silhouettes');
 assert.equal(preferred.includes('lopsided-bob'),false);
 assert.deepEqual(catalog.face_profiles.map(x=>x.id),['balanced']);
 assert.deepEqual(catalog.accessories,[]);assert.deepEqual(promotedAccessories.assets,[]);
 assert.ok(catalog.poses.length>=25,'need >=25 poses');
 for(const id of ['curtain-bang','short-curl','low-ponytail','soft-mohawk'])assert.ok(preferred.includes(id),id+' fresh hair missing');
 for(const id of ['point-choice','receive-object','hold-two-props','open-barrier'])assert.ok(catalog.poses.some(x=>x.id===id),id+' pose missing');
});

test('prop/contact library adds eight reusable contact-capable props',async()=>{
 const props=await json('props/index.json');
 assert.ok(props.assets.length>=22,'need at least 22 total props');
 const contact=props.assets.filter(x=>Array.isArray(x.contact_sockets)&&x.contact_sockets.length);
 assert.ok(contact.length>=8,'need at least eight contact-capable props');
 for(const id of ['coffee-cup','keycard','gift-box','umbrella','sticky-note','wallet','photo-card','small-bag']){
  const row=props.assets.find(x=>x.id===id);assert.ok(row,id+' missing');
  assert.ok(row.contact_sockets?.length,id+' missing contact sockets');
  assert.ok(row.compatible_mechanics?.length,id+' missing compatible mechanics');
  assert.equal(await exists(path.join(lib,row.path)),true,id+' SVG missing');
 }
});

test('each scene family gains a third sparse authored identity cue',async()=>{
 const [sets,accents,contract]=await Promise.all([json('scene-set/index.json'),json('scene-set/accents/index.json'),json('scene-set/identity-contract.json')]);
 const accentIds=new Set(accents.accents.map(x=>x.id));
 assert.ok(accents.accents.length>=11,'need at least eleven scene accents');
 for(const row of sets.scene_sets){
  assert.ok(row.identity_cues.length>=3,row.id+' needs >=3 identity cues after diversity expansion');
  const authored=row.identity_cues.filter(id=>accentIds.has(contract.cues?.[id]?.asset_id));
  assert.ok(authored.length>=2,row.id+' needs at least two authored accent-backed cues');
 }
});

test('removed effect needs fail closed while metaphor and mechanics remain native',async()=>{
 const [caps,mechanics,coverage,policy]=await Promise.all([json('capability-index.json'),json('mechanics/index.json'),json('coverage-matrix.json'),json('selection-policy.json')]);
 assert.deepEqual(caps.effects,{});
 for(const id of ['compare-two-props','point-choice','open-barrier','focus-shift'])assert.ok(mechanics.mechanics.some(x=>x.id===id));
 const selected=selectAssetGuidance({asset_needs:['metaphor.balance'],environment_mode:'scene_set'},policy,{capabilityIndex:caps,coverageMatrix:coverage});
 assert.ok(selected.resolved_capabilities.some(x=>x.need_id==='metaphor.balance'&&x.kind==='visual_metaphor'));
 assert.throws(()=>selectAssetGuidance({asset_needs:['effect.focus']},policy,{capabilityIndex:caps,coverageMatrix:coverage}),/ASSET_CAPABILITY_NEED_UNKNOWN/);
});
