import test from 'node:test';
import assert from 'node:assert/strict';
import {compactState} from '../context-capsule.mjs';
const state=()=>({format:'zodiac-pipeline-state@2',run_id:'r1',plugin_version:'2.4.34',current_phase:'02-visual-production',operations:[{phase_id:'02-visual-production',step_id:'assets',kind:'write_authoring',path:'production.json'}],review_receipts:[],phases:{'02-visual-production':{current_step:'assets',steps:{assets:{status:'READY',capability_receipts:[{capability_id:'validator_a',status:'PASS',proof:{ref:'receipt-path'}}]}}}}});
test('capsule carries real path references without serializing old scene content',()=>{const out=compactState(state(),{'narration.txt':'sha1'});assert.equal(out.phase,'02-visual-production');assert.equal(out.inputs['narration.txt'],'sha1');assert.equal(out.receipt_refs[0].proof_ref,'receipt-path');assert.ok(!JSON.stringify(out).includes('entities'));});
test('capsule cannot recover missing or invalid canonical state',()=>{const s=state();delete s.phases['02-visual-production'].steps.assets;assert.throws(()=>compactState(s),/CAPSULE_ACTIVE_STEP_MISSING/);assert.throws(()=>compactState({format:'other'}),/CAPSULE_STATE_INVALID/);});
