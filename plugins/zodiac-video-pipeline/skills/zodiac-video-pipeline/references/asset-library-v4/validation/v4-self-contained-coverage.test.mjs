import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const v4=path.resolve(here,'..');
const skillRoot=path.resolve(v4,'../..');
const json=async rel=>JSON.parse(await readFile(path.join(v4,rel),'utf8'));

test('V4 production contracts no longer depend on a V3 directory',async()=>{
  await assert.rejects(access(path.join(skillRoot,'references/asset-library-v3')));
  const phase=await readFile(path.join(skillRoot,'orchestration/phases/02-visual-production.json'),'utf8');
  const memes=await json('memes/index.json');
  assert.doesNotMatch(phase,/asset-library-v3/);
  assert.ok(memes.compositions.every(x=>x.source?.startsWith('./templates/')));
  for(const item of memes.compositions)await access(path.join(v4,'memes',item.source.replace(/^\.\//u,'')));
});

test('V4 has native study props and a school environment profile',async()=>{
  const props=await json('props/index.json');
  const ids=new Set(props.assets.map(x=>x.id));
  for(const id of ['notebook','book','water-bottle','tissue-box','headset','mirror','backpack','pen'])assert.ok(ids.has(id),id);
  for(const item of props.assets)await access(path.join(v4,item.path));
  const env=await json('environments/composition-index.json');
  assert.ok(env.profiles.some(x=>x.id==='classroom-study'));
  assert.ok(env.profiles.some(x=>x.id==='school-hallway'));
  assert.equal(env.policy.full_scene_backgrounds,false);
});

test('character identity includes stable face traits and everyday study actions',async()=>{
  const catalog=await json('characters/components/catalog.json');
  assert.ok(catalog.policy.identity_fields.includes('face_profile_id'));
  assert.ok(catalog.face_profiles.length>=4);
  const poses=new Set(catalog.poses.map(x=>x.id));
  for(const id of ['write','read','carry-backpack','text-phone'])assert.ok(poses.has(id),id);
  const accessories=await json('characters/accessories/index.json');
  assert.ok(accessories.assets.length>=2);
  for(const item of accessories.assets)await access(path.join(v4,item.path));
  const {compileCharacterSvg,identitySignature}=await import(pathToFileURL(path.join(v4,'characters/compile-character-assembly.mjs')).href);
  const base={entity_id:'test',body_profile:'standard_compact',hair_id:'asym-bang',outfit_id:'generic-cosmic-light',shirt_color_id:'coral',variant_seed:'test'};
  const a={...base,face_profile_id:catalog.face_profiles[0].id};
  const b={...base,face_profile_id:catalog.face_profiles[1].id};
  assert.notEqual(identitySignature(a),identitySignature(b));
  assert.match(compileCharacterSvg(a,{pose_id:'write',expression_id:'neutral'}).svg,/face_profile_id=/);
});
