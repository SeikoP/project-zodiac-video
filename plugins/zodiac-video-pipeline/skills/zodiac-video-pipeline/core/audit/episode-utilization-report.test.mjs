import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeUtilization,summarizeOptimization} from './episode-utilization-report.mjs';

const manifests=[{id:'01-content',steps:[{id:'narration',required_capabilities:[{id:'quality',kind:'internal_validator'}],conditional_capabilities:[{id:'human',kind:'external_tool',when:'flag:human'}]}]}];
test('declaration does not prove a capability ran',()=>{
 const no=summarizeUtilization({manifests,receipts:[{capability_id:'quality',status:'PASS'}]});
 assert.equal(no.capabilities.find(x=>x.id==='quality').status,'DECLARED_NOT_OBSERVED');
 const yes=summarizeUtilization({manifests,receipts:[{capability_id:'quality',status:'PASS',exit_code:0,executed_at:'2026-11-08T00:00:00Z',validator_sha256:'a'.repeat(64)}]});
 assert.equal(yes.capabilities.find(x=>x.id==='quality').status,'OBSERVED');
 assert.equal(yes.capabilities.find(x=>x.id==='human').status,'DECLARED_NOT_OBSERVED');
});
test('leaf skills require application provenance',()=>{
 const report=summarizeUtilization({decisions:{decisions:[{id:'U1',skill_id:'human-writing',status:'REQUESTED'}, {id:'U2',skill_id:'human-writing',status:'APPLIED',guidance_uri:'uri',skill_read_ref:'read:1',application_summary:'reviewed cadence'}]}});
 assert.equal(report.leaf_skill_decisions[0].has_application_proof,false);
 assert.equal(report.leaf_skill_decisions[1].has_application_proof,true);
});
test('no fake optimization when measurements are missing',()=>{
 const empty=summarizeOptimization();
 assert.equal(empty.measured.native_wall_ms,null);
 assert.equal(empty.cache_reuse_ratio,null);
 assert.equal(empty.comparison.status,'NO_COMPARABLE_BASELINE');
});
test('ratios and baseline comparison require compatible measurements',()=>{
 const diagnosis={measured:{native_reported_wall_ms:80,scene_direction_compiled:1,scene_direction_reused:3}};
 const baseline={format:'zodiac-episode-optimization@1',comparison_key:'same',measured:{native_wall_ms:100}};
 const x=summarizeOptimization({diagnosis,context:{comparison_key:'same',budget:{transport_tokens_before_accounting:300,full_transport_tokens_before_accounting:600}},baseline});
 assert.equal(x.cache_reuse_ratio,0.75);assert.equal(x.context_saving_ratio,0.5);
 assert.equal(x.comparison.native_wall_change_pct,-20);
 assert.equal(summarizeOptimization({diagnosis,baseline}).comparison.status,'NO_COMPARABLE_BASELINE');
});
