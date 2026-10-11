import test from 'node:test';import assert from 'node:assert/strict';
import {rm} from 'node:fs/promises';import {migrateLegacyJob5} from '../migrate-production-model.mjs';
import {makePortableLegacyFixture} from './portable-legacy-fixture.mjs';
test('portable Bọ Cạp 16-scene migration preserves narration byte provenance',async()=>{
 const {root}=await makePortableLegacyFixture();
 try{const model=migrateLegacyJob5(root);assert.equal(model.scenes.length,16);
 assert.equal(model.source.origin,'reconstructed');assert.ok(model.scenes.every(s=>s.actions.every(a=>a.motion.motion==='state_swap'||a.motion.supported)));
 assert.equal(model.source.narration_sha256.length,64);}
 finally{await rm(root,{recursive:true,force:true});}
});
