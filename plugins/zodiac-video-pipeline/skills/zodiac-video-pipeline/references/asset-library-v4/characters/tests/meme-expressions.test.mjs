import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {compileCharacterSvg} from '../compile-character-assembly.mjs';
import {expr} from '../geometry/expression-profiles.mjs';
import {validateHumanStroke} from '../../validation/validate-human-stroke.mjs';

test('performed meme faces have distinct playful reactions on every body without changing cast identity',async()=>{
 const catalog=JSON.parse(await readFile(new URL('../components/catalog.json',import.meta.url)));
 const faces=catalog.expressions.filter(e=>e.id.startsWith('meme-'));
 assert.equal(faces.length,9);
 assert.equal(new Set(faces.map(e=>JSON.stringify(expr(e.id)))).size,faces.length);
 for(const body of catalog.body_profiles){
  const identity={entity_id:'hero',body_profile:body.id,hair_id:'long-side-part',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'scorpio'};
  const normal=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:'neutral'});
  assert.doesNotMatch(normal.svg,/id="face_performance"/u);
  for(const face of faces){
   const result=compileCharacterSvg(identity,{pose_id:'neutral',expression_id:face.id});
   assert.equal(result.identity_signature,normal.identity_signature);
   assert.match(result.svg,/id="face_performance"/u);
   const coords=expr(face.id).mouth.match(/-?\d+(?:\.\d+)?/gu).map(Number);
   const xs=coords.filter((_,i)=>i%2===0);
   assert.ok(Math.max(...xs)-Math.min(...xs)<=70,face.id+' must retain a compact channel mouth');
   assert.equal(expr(face.id).eye_backdrop,undefined,face.id+' must preserve the ordinary face silhouette');
   validateHumanStroke(result.svg,'character');
  }
 }
});
