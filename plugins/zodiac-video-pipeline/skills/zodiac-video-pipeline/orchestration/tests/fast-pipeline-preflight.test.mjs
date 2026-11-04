import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';
import {runParallelNativePreflight} from '../../core/performance/parallel-native-preflight.mjs';
async function fixture(){
 const root=await mkdtemp(path.join(os.tmpdir(),'z-fast-preflight-')),skill=path.join(root,'skill'),ws=path.join(root,'ws');
 await mkdir(path.join(skill,'core/evidence'),{recursive:true});await mkdir(path.join(skill,'features/visual-composition'),{recursive:true});await mkdir(path.join(ws,'.authoring'),{recursive:true});
 const js="import {writeFile} from 'node:fs/promises'; const ms=Number(process.env.Z_FAST_TEST_DELAY_MS??50);await new Promise(r=>setTimeout(r,ms));if(process.env.Z_FAST_TEST_FAIL==='1' && process.argv[1].includes('character'))process.exit(2);";
 await writeFile(path.join(skill,'features/visual-composition/validate-character-intent-preflight.mjs'),js);
 await writeFile(path.join(skill,'features/visual-composition/validate-phase02-precompile-boundary.mjs'),'process.exit(0)');
 await writeFile(path.join(skill,'features/visual-composition/validate-phase02-art-direction.mjs'),'process.exit(0)');
 await writeFile(path.join(skill,'core/evidence/run-validator-with-receipt.mjs'),"import {writeFile} from 'node:fs/promises';const [id,out]=process.argv.slice(2);await writeFile(out,JSON.stringify({format:'zodiac-validator-receipt@1',capability_id:id,status:'PASS',exit_code:0}));");
 return {root,skill,ws};
}
test('parallel preflight creates separate receipts and preserves gate results',async()=>{const f=await fixture();try{const r=await runParallelNativePreflight(f.skill,f.ws,{artDirectionRequired:true});assert.equal(r.status,'PASS');assert.deepEqual(r.plan.batches,[['seam','character','art']]);for(const id of ['seam','art'])assert.equal(JSON.parse(await readFile(r.receipts[id],'utf8')).status,'PASS');}finally{await rm(f.root,{recursive:true,force:true});}});

test('failed character preflight blocks while retaining other independent native receipts',async()=>{const f=await fixture();try{await writeFile(path.join(f.skill,'features/visual-composition/validate-character-intent-preflight.mjs'),'process.exitCode=2;');const r=await runParallelNativePreflight(f.skill,f.ws,{artDirectionRequired:true});assert.equal(r.status,'BLOCKED');assert.equal(r.checks.character.status,'FAIL');assert.equal(r.checks.seam.status,'PASS');assert.equal(r.checks.art.status,'PASS');assert.equal(r.issues.length,1);}finally{await rm(f.root,{recursive:true,force:true});}});
