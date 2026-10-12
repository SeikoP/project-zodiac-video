import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'../..'),lib=path.join(skill,'references/asset-library-v4');
const json=async rel=>JSON.parse(await readFile(path.join(lib,rel),'utf8'));

test('each scene-set family declares at least two non-palette identity cues',async()=>{
 const [sets,contract]=await Promise.all([json('scene-set/index.json'),json('scene-set/identity-contract.json')]);
 assert.equal(contract.format,'zodiac-scene-set-identity@1');
 const known=new Set(Object.keys(contract.cues??{}));
 for(const row of sets.scene_sets){
  assert.ok(Array.isArray(row.identity_cues)&&row.identity_cues.length>=2,row.id+' needs at least two identity cues');
  assert.equal(new Set(row.identity_cues).size,row.identity_cues.length,row.id+' has duplicate identity cues');
  for(const id of row.identity_cues){
   assert.ok(known.has(id),row.id+' unknown cue '+id);
   assert.equal(/^palette[:.-]/u.test(id),false,row.id+' cannot use palette as identity');
   assert.ok((contract.cues[id].scene_sets??[]).includes(row.id),id+' must authorize '+row.id);
  }
 }
});
