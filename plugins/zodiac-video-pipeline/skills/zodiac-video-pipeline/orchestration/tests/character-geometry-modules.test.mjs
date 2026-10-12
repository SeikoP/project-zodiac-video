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
 {name:'lean-explain',identity:{entity_id:'a',body_profile:'lean_tall',hair_id:'spiky-overthink',face_profile_id:'freckled',outfit_id:'gemini-basic-clean',shirt_color_id:'teal',accessory_id:'round-glasses',variant_seed:'baseline-a'},state:{pose_id:'explain',expression_id:'smug'}},
 {name:'round-offer',identity:{entity_id:'b',body_profile:'round_soft',hair_id:'blocky-cut',face_profile_id:'wide-set',outfit_id:'taurus-basic-clean',shirt_color_id:'coral',accessory_id:'none',variant_seed:'baseline-b'},state:{pose_id:'offer',expression_id:'embarrassed'}},
 {name:'stocky-phone',identity:{entity_id:'c',body_profile:'stocky_short',hair_id:'antenna-short',face_profile_id:'close-set',outfit_id:'leo-basic-clean',shirt_color_id:'ochre',accessory_id:'star-hair-clip',variant_seed:'baseline-c'},state:{pose_id:'text-phone',expression_id:'side-eye'}},
 {name:'petite-run',identity:{entity_id:'d',body_profile:'petite_compact',hair_id:'asym-bang',face_profile_id:'balanced',outfit_id:'generic-wave-stitch',shirt_color_id:'slate',accessory_id:'none',variant_seed:'baseline-d'},state:{pose_id:'run',expression_id:'panic'}}
];

test('character compiler baseline is observable before geometry extraction',async()=>{
 const {compileCharacterSvg}=await import(pathToFileURL(compiler));
 const hashes=Object.fromEntries(cases.map(row=>[row.name,sha(compileCharacterSvg(row.identity,row.state).svg)]));
 console.log('CHARACTER_BASELINE_SHA '+JSON.stringify(hashes));
 assert.equal(Object.keys(hashes).length,4);
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
 assert.equal(selectHairId({requested_id:'lopsided-bob',mode:'compatibility'},catalog),'lopsided-bob');
 assert.throws(()=>selectHairId({requested_id:'lopsided-bob',mode:'fresh'},catalog),/HAIR_NOT_FRESH_PREFERRED/);
});
