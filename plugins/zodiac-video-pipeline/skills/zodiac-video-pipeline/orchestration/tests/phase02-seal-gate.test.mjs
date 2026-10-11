import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectPhase02Seal} from '../phase02-seal-gate.mjs';
const fixture=async()=>{
 const root=await mkdtemp(join(tmpdir(),'zodiac-seal-'));await mkdir(join(root,'.authoring'));
 const state={plugin_version:'2.4.23',operations:[{kind:'write_production'}],review_receipts:[{phase_id:'02-visual-production',status:'APPROVED',proof:{kind:'user_message',ref:'real-user-message'}}],phases:{'01-content':{status:'PASS'},'02-visual-production':{status:'PASS',steps:Object.fromEntries(['visual_compile','assets','publish_prep'].map(id=>[id,{status:'PASS',capability_receipts:[{proof:{kind:'validator_result'}}],outputs:['output'],gate_results:{x:'PASS'}}]))}}};
 const ck={format:'zodiac-phase02-native-checkpoints@1',version:'2.4.23',steps:{character_plan:{status:'PASS',output_sha:'abc',after_input_sha:'def'}}};
 const ex={status:'NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED'};
 for(const [name,obj] of [['pipeline-state.json',state],['phase02-native-checkpoints.json',ck],['phase02-execution-receipt.json',ex]])await writeFile(join(root,'.authoring',name),JSON.stringify(obj));
 for(const p of ['production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json','publish/publish.json','publish/publish-copy.txt']){await mkdir(join(root,p.substring(0,p.lastIndexOf('/'))||'.'),{recursive:true});await writeFile(join(root,p),'{}');}
 return root;
};
test('blocks missing source state and receipts without issuing approval',async()=>{const root=await mkdtemp(join(tmpdir(),'zodiac-seal-'));try{const r=await inspectPhase02Seal(root,{validateState:false});assert.equal(r.status,'BLOCKED');assert.ok(r.issues.length);}finally{await rm(root,{recursive:true,force:true})}});
test('allows evidence-ready only with completed phases',async()=>{const root=await fixture();try{const r=await inspectPhase02Seal(root,{validateState:false});assert.equal(r.status,'SEAL_ELIGIBLE');assert.equal(r.not_a_render_pass,true);}finally{await rm(root,{recursive:true,force:true})}});
test('rejects incomplete phase even with native proof',async()=>{const root=await fixture();try{const p=join(root,'.authoring/pipeline-state.json');const {readFile}=await import('node:fs/promises');const s=JSON.parse(await readFile(p));s.phases['02-visual-production'].status='READY';await writeFile(p,JSON.stringify(s));const r=await inspectPhase02Seal(root,{validateState:false});assert.ok(r.issues.some(i=>i.code==='VISUAL_PHASE_NOT_PASS'));}finally{await rm(root,{recursive:true,force:true})}});
