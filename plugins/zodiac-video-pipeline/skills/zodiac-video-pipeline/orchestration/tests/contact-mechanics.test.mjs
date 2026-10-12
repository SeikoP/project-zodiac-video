import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),skill=path.resolve(here,'../..'),lib=path.join(skill,'references/asset-library-v4');
const json=async rel=>JSON.parse(await readFile(path.join(lib,rel),'utf8'));

test('pass-object capability resolves to canonical pass-object mechanic with giver receiver and prop contact',async()=>{
 const [caps,mechanics,contract]=await Promise.all([json('capability-index.json'),json('mechanics/index.json'),json('contracts/contact-mechanics.json')]);
 assert.equal(caps.interactions['pass-object'].mechanic_id,'pass-object');
 const mech=mechanics.mechanics.find(x=>x.id==='pass-object');
 assert.ok(mech,'pass-object mechanic missing');
 assert.deepEqual(mech.requires,['actor','target','focus_prop']);
 const spec=contract.mechanics['pass-object'];
 assert.equal(spec.giver_role,'actor');
 assert.equal(spec.receiver_role,'target');
 assert.equal(spec.prop_role,'focus_prop');
 assert.deepEqual(new Set(spec.required_contacts),new Set(['giver_prop','receiver_prop']));
 assert.equal(spec.ownership_transition,true);
});

test('offer-object is compatibility alias only, not fresh canonical transport',async()=>{
 const mechanics=await json('mechanics/index.json');
 const alias=mechanics.mechanics.find(x=>x.id==='offer-object');
 assert.ok(alias,'compatibility alias missing');
 assert.equal(alias.compatibility_alias_of,'pass-object');
 assert.equal(alias.fresh,false);
});
