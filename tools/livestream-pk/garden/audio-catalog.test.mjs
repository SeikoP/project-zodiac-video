import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {checkCatalog,ROLE_GROUPS} from '../scripts/prepare-garden-audio.mjs';
test('Garden catalog contains 36 roles and 50 original samples with verified hashes',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('./audio-catalog.json',import.meta.url)));
 assert.equal(Object.values(ROLE_GROUPS).flat().length,36);assert.deepEqual(checkCatalog(catalog),{roles:36,samples:50,listeningPending:50});
 const bad=structuredClone(catalog);bad.assets[0].file='../bad.wav';assert.throws(()=>checkCatalog(bad),/Invalid/);
 const role=structuredClone(catalog);role.roles.water.files=['../secret.wav'];assert.throws(()=>checkCatalog(role),/Invalid role/);
});
