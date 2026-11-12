import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {freshPreferredHairIds} from '../../references/asset-library-v4/characters/select-character-components.mjs';
import {selectAssetGuidance} from '../../core/policy/select-asset-guidance.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../..');
const lib=path.join(skill,'references/asset-library-v4');
const json=async rel=>JSON.parse(await readFile(path.join(lib,rel),'utf8'));
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

test('retired storytelling-image catalog is physically absent',async()=>{
 assert.equal(await exists(path.join(lib,'visual-metaphors')),false);
 const caps=await json('capability-index.json');
 assert.equal('visual_metaphors' in caps,false);
 const coverage=await json('coverage-matrix.json');
 assert.equal(coverage.needs.some(x=>String(x.id).startsWith('metaphor.')),false);
 const policy=await json('selection-policy.json');
 assert.equal(policy.extensions.some(x=>x.kind==='visual_metaphor'),false);
});

test('character diversity retains fresh silhouettes and interaction poses',async()=>{
 const [catalog,promotedAccessories]=await Promise.all([json('characters/components/catalog.json'),json('characters/accessories/index.json')]);
 const preferred=freshPreferredHairIds(catalog);
 assert.ok(preferred.length>=8);
 assert.equal(preferred.includes('lopsided-bob'),false);
 assert.deepEqual(catalog.face_profiles.map(x=>x.id),['balanced']);
 assert.deepEqual(catalog.accessories,[]);assert.deepEqual(promotedAccessories.assets,[]);
 assert.ok(catalog.poses.length>=25);
 for(const id of ['curtain-bang','short-curl','low-ponytail','soft-mohawk'])assert.ok(preferred.includes(id),id+' fresh hair missing');
 for(const id of ['point-choice','receive-object','hold-two-props','open-barrier'])assert.ok(catalog.poses.some(x=>x.id===id),id+' pose missing');
});

test('prop/contact library retains reusable contact-capable props',async()=>{
 const props=await json('props/index.json');
 const contact=props.assets.filter(x=>Array.isArray(x.contact_sockets)&&x.contact_sockets.length);
 assert.ok(contact.length>=8);
 for(const id of ['coffee-cup','keycard','gift-box','umbrella','sticky-note','wallet','photo-card','small-bag']){
  const row=props.assets.find(x=>x.id===id);assert.ok(row,id+' missing');
  assert.ok(row.contact_sockets?.length);
  assert.ok(row.compatible_mechanics?.length);
  assert.equal(await exists(path.join(lib,row.path)),true,id+' SVG missing');
 }
});

test('scene families retain sparse authored context cues',async()=>{
 const [sets,accents,contract]=await Promise.all([json('scene-set/index.json'),json('scene-set/accents/index.json'),json('scene-set/identity-contract.json')]);
 const accentIds=new Set(accents.accents.map(x=>x.id));
 for(const row of sets.scene_sets){
  const authored=row.identity_cues.filter(id=>accentIds.has(contract.cues?.[id]?.asset_id));
  assert.ok(authored.length>=2,row.id+' needs authored accent-backed cues');
 }
});

test('retired storytelling asset needs fail closed',async()=>{
 const [caps,coverage,policy]=await Promise.all([json('capability-index.json'),json('coverage-matrix.json'),json('selection-policy.json')]);
 assert.throws(()=>selectAssetGuidance({asset_needs:['metaphor.balance'],environment_mode:'canvas'},policy,{capabilityIndex:caps,coverageMatrix:coverage}),/ASSET_CAPABILITY_NEED_UNKNOWN/);
});
