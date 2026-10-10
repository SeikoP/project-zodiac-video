import assert from 'node:assert/strict';
import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const here=path.dirname(fileURLToPath(import.meta.url));
test('ten native profiles each have ground and rear cues',async()=>{
 const index=JSON.parse(await readFile(path.join(here,'composition-index.json'),'utf8'));
 assert.equal(index.profiles.length,10);
 assert.equal(index.structural_assets.length,24);
 assert.equal(index.policy.full_scene_backgrounds,false);
 const ids=new Set(index.structural_assets.map(c=>c.id));
 assert.equal(ids.size,index.structural_assets.length);
 for(const p of index.profiles){
  assert.ok(p.modifiers.clean,p.id);
  for(const role of ['rear','grounding']){
   assert.ok(p.structural_roles[role].length,p.id+':'+role);
   for(const id of p.structural_roles[role])assert.ok(ids.has(id),id);
  }
 }
 for(const cue of index.structural_assets){await access(path.join(here,cue.path));}
});
test('canonical bedroom modifiers remain backwards compatible',async()=>{
 const index=JSON.parse(await readFile(path.join(here,'composition-index.json'),'utf8'));
 const p=index.profiles.find(p=>p.id==='bedroom-study-base');
 assert.deepEqual(Object.keys(p.modifiers).sort(),['clean','cozy-depth','meme-payoff'].sort());
});
