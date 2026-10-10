import test from 'node:test';import assert from 'node:assert/strict';import {rm} from 'node:fs/promises';
import {migrateLegacyJob5} from '../migrate-production-model.mjs';import {projectLegacyIR,assertRoundTrip} from '../project-legacy-ir.mjs';
import {makePortableLegacyFixture} from './portable-legacy-fixture.mjs';
test('portable 16-scene Job@5 authoring IR roundtrips without semantic loss',async()=>{
 const {root,ir}=await makePortableLegacyFixture();
 try{const model=migrateLegacyJob5(root),after=projectLegacyIR(model);
 assert.equal(ir.scenes.length,16);
 assert.equal(ir.scenes.reduce((s,x)=>s+x.events.length,0),after.scenes.reduce((s,x)=>s+x.events.length,0));
 assertRoundTrip(ir,after);}finally{await rm(root,{recursive:true,force:true});}
});
test('modified event cannot silently pass roundtrip',async()=>{
 const {root,ir}=await makePortableLegacyFixture();
 try{const after=structuredClone(ir);after.scenes[0].events[0].intent='wrong';
 assert.throws(()=>assertRoundTrip(ir,after),/LEGACY_ROUNDTRIP_DRIFT/);}
 finally{await rm(root,{recursive:true,force:true});}
});
