import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const testsDir=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(testsDir,'..');
async function exists(p){try{await access(p);return true;}catch{return false;}}

test('capability registry resolves current metadata and retired narrative variants are absent',async()=>{
 const modulePath=path.join(orchestration,'..','core/policy/capability-registry.mjs');
 assert.equal(await exists(modulePath),true);
 const {resolveCapability,listCapabilities}=await import(pathToFileURL(modulePath));
 const sceneSet=await resolveCapability('scene_set');
 assert.equal(sceneSet.fresh,false);
 assert.throws(()=>resolveCapability('visual_metaphor'),/CAPABILITY_UNKNOWN visual_metaphor/u);
 assert.equal(listCapabilities().some(x=>x.id==='visual_metaphor'),false);
});

test('fresh capability routing contains no compatibility storytelling feature',async()=>{
 const modulePath=path.join(orchestration,'..','core/policy/capability-registry.mjs');
 const {capabilitiesForStep}=await import(pathToFileURL(modulePath));
 const selected=capabilitiesForStep('02-visual-production','visual_compile',{run_mode:'fresh',environment_mode:'canvas',flags:{}});
 const ids=selected.map(item=>item.id);
 assert.deepEqual(ids,['character_assembly']);
 assert.equal(selected.flatMap(item=>item.refs??[]).some(ref=>/visual-metaphor|story-object|\/compat\//u.test(ref)),false);
 const continuity=capabilitiesForStep('02-visual-production','visual_compile',{run_mode:'continuity',environment_mode:'scene_set',flags:{}});
 assert.ok(continuity.some(item=>item.id==='scene_set'));
 assert.equal(continuity.some(item=>item.id==='visual_metaphor'),false);
});
