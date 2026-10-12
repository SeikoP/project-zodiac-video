import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'../..'),lib=path.join(skill,'references/asset-library-v4');
const json=async rel=>JSON.parse(await readFile(path.join(lib,rel),'utf8'));
const sig=fx=>createHash('sha256').update(JSON.stringify((fx.paths??[]).map(p=>p.d))).digest('hex');

test('pressure tension and emphasis use distinct semantic families, loci and geometry',async()=>{
 const [families,catalog,caps]=await Promise.all([json('effects/semantic-families.json'),json('effects/meme-effect-catalog.json'),json('capability-index.json')]);
 const rows=['pressure','tension','emphasis'].map(id=>{
  const cap=caps.effects[id],fx=catalog.effects[cap.effect_id],family=families.families[fx.semantic_family];
  assert.ok(fx.semantic_family,id+' effect lacks semantic_family');
  assert.ok(family,id+' unknown semantic family');
  assert.equal(fx.locus,family.locus,id+' locus must match family');
  return {id,family:fx.semantic_family,locus:fx.locus,signature:sig(fx)};
 });
 assert.equal(new Set(rows.map(x=>x.family)).size,3);
 assert.equal(new Set(rows.map(x=>x.locus)).size,3);
 assert.equal(new Set(rows.map(x=>x.signature)).size,3);
});
