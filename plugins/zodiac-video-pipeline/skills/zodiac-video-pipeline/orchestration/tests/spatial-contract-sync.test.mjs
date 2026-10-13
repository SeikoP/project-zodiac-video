import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const reference=new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url);
const schema=JSON.parse(await readFile(reference,'utf8'));
const sorted=(value)=>Array.isArray(value)?value.map(sorted):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sorted(value[key])])):value;
test('spatial Job@5 schema hash pins matching runner source',()=>{
  const hash=createHash('sha256').update(JSON.stringify(sorted(schema)),'utf8').digest('hex');
  const runnerSchema=JSON.parse(await readFile(new URL('../../../../../../contracts/authoring-ir-v1.schema.json',import.meta.url),'utf8'));
  const runnerHash=createHash('sha256').update(JSON.stringify(sorted(runnerSchema)),'utf8').digest('hex');
  assert.equal(hash,runnerHash,'producer and runner must use identical canonical authoring schema');
  assert.ok(schema.$defs.scene.properties.spatial_bindings);
  assert.equal(schema.$defs.spatial_binding.additionalProperties,false);
});
