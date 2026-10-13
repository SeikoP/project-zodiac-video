import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../..');
const chars=path.join(skill,'references/asset-library-v4/characters');
const compiler=path.join(chars,'compile-character-assembly.mjs');
const sha=s=>createHash('sha256').update(s).digest('hex');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};

const cases=[
 {name:'lean-explain',identity:{entity_id:'a',body_profile:'lean_tall',hair_id:'spiky-overthink',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'teal',accessory_id:'none',variant_seed:'baseline-a'},state:{pose_id:'explain',expression_id:'smug'}},
 {name:'round-offer',identity:{entity_id:'b',body_profile:'round_soft',hair_id:'blocky-cut',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'coral',accessory_id:'none',variant_seed:'baseline-b'},state:{pose_id:'offer',expression_id:'embarrassed'}},
 {name:'stocky-phone',identity:{entity_id:'c',body_profile:'stocky_short',hair_id:'antenna-short',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'ochre',accessory_id:'none',variant_seed:'baseline-c'},state:{pose_id:'text-phone',expression_id:'side-eye'}},
 {name:'petite-run',identity:{entity_id:'d',body_profile:'petite_compact',hair_id:'asym-bang',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'slate',accessory_id:'none',variant_seed:'baseline-d'},state:{pose_id:'run',expression_id:'panic'}}
];

// Refreshed after 7bc1af17 vs 672f4983 pixel-identical CairoSVG 720x720 raster audit.
test('character compiler baseline is observable before geometry extraction',async()=>{
 const {compileCharacterSvg}=await import(pathToFileURL(compiler));
 const hashes=Object.fromEntries(cases.map(row=>[row.name,sha(compileCharacterSvg(row.identity,row.state).svg)]));
 console.log('CHARACTER_BASELINE_SHA '+JSON.stringify(hashes));
 assert.deepEqual(hashes,{
  'lean-explain':'d7e5a44e63b9f2172cb8b969dc5a686bbcbfe9e943efa7ffa11d3d7ebab4105f',
  'round-offer':'251246879b3d7f96885346772e512694eaa08740b591ac3f6df95b073b747963',
  'stocky-phone':'693ce53785837dbffe30bf83ff883a089352ff28c2d51a0edba05f5ca4f1c203',
  'petite-run':'4cfac2b010cda3d2bf6b3aff2577980f69cfce1c5768c909bb9920ae6e52e0f6'
 });
});

test('character geometry has focused owner modules',async()=>{
 for(const rel of ['geometry/body-profiles.mjs','geometry/hair-profiles.mjs','geometry/face-profiles.mjs','geometry/outfit-profiles.mjs','geometry/pose-profiles.mjs','geometry/expression-profiles.mjs','select-character-components.mjs']){
  assert.equal(await exists(path.join(chars,rel)),true,rel+' missing');
 }
});

test('fresh automatic hair routing excludes lopsided-bob while compatibility can request it',async()=>{
 const catalog=JSON.parse(await readFile(path.join(chars,'components/catalog.json'),'utf8'));
 const selectorPath=path.join(chars,'select-character-components.mjs');
 assert.equal(await exists(selectorPath),true,'selector missing');
 const {selectHairId,freshPreferredHairIds}=await import(pathToFileURL(selectorPath));
 const preferred=freshPreferredHairIds(catalog);
 assert.equal(preferred.includes('lopsided-bob'),false);
 for(let i=0;i<64;i++)assert.notEqual(selectHairId({seed:'seed-'+i,mode:'fresh'},catalog),'lopsided-bob');
 assert.throws(()=>selectHairId({requested_id:'lopsided-bob',mode:'compatibility'},catalog),/HAIR_UNKNOWN/);
 assert.throws(()=>selectHairId({requested_id:'lopsided-bob',mode:'fresh'},catalog),/HAIR_UNKNOWN/);
});