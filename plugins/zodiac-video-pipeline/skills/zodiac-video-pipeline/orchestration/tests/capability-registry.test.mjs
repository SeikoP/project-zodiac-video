import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(testsDir,'..');

async function exists(p){try{await access(p);return true;}catch{return false;}}

test('capability registry resolves current capability metadata and rejects unknown ids',async()=>{
 const modulePath=path.join(orchestration,'capability-registry.mjs');
 assert.equal(await exists(modulePath),true,'capability-registry.mjs must exist');
 const {resolveCapability}=await import(pathToFileURL(modulePath));
 const sceneSet=await resolveCapability('scene_set');
 assert.equal(sceneSet.id,'scene_set');
 assert.equal(sceneSet.fresh,true);
 assert.ok(Array.isArray(sceneSet.validators));
 assert.throws(()=>resolveCapability('definitely-not-a-capability'),/CAPABILITY_UNKNOWN definitely-not-a-capability/u);
});

test('fresh current capabilities do not depend on compatibility modules',async()=>{
 const modulePath=path.join(orchestration,'capability-registry.mjs');
 assert.equal(await exists(modulePath),true,'capability-registry.mjs must exist');
 const {listCapabilities}=await import(pathToFileURL(modulePath));
 const fresh=listCapabilities().filter(item=>item.fresh===true);
 assert.ok(fresh.length>0);
 for(const item of fresh){
  assert.equal((item.refs??[]).some(ref=>ref.includes('/compatibility/')||ref.includes('/historical/')),false,item.id+' leaks compatibility refs');
 }
});
