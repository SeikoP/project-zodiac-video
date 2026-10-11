#!/usr/bin/env node
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateDirectorPlan,validateDirectorCausality,compileDirectorBlocking,sha256} from './director-v2-core.mjs';
import {assertJob5VisualRoleSizes} from './compile-job-v5.mjs';

const main=async()=>{
 const root=process.argv[2];if(!root)throw Error('Usage: node orchestration/director-v2-gate.mjs <workspace> [--write]');
 const load=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
 const narration=await readFile(path.join(root,'narration.txt'),'utf8');
 const plan=await load('.authoring/director-plan.json');
 const prod=await load('production.json');
 const check=validateDirectorPlan(plan,prod,narration);
 const issues=[...check.issues,...validateDirectorCausality(plan,prod)];
 const {production:adjusted,issues:layoutErrors,changes}=compileDirectorBlocking(prod,plan);
 issues.push(...layoutErrors);
 // Exactly the same area/scale thresholds as Job@5; no second threshold set.
 try{assertJob5VisualRoleSizes({assets:adjusted.assets,scenes:(adjusted.scenes??[]).map(s=>({...s,layout_contract:s.layout_contract??{canvas:{width:1080,height:1920}}}))});}
 catch(e){for(const msg of e.diagnostics??[e.message])issues.push({code:'DIRECTOR_RUNNER_ROLE_SIZE',scope:'production',detail:msg});}
 const status=issues.length?'BLOCKED':'PASS';
 const receipt={format:'zodiac-director-v2-gate@1',status,scenes:adjusted.scenes?.length??0,beats:plan.beats?.length??0,changes,issues,source_sha256:sha256(JSON.stringify(prod)),narration_sha256:sha256(narration)};
 const dst=path.join(root,'.authoring/director-v2-gate-receipt.json');await mkdir(path.dirname(dst),{recursive:true});
 if(status==='PASS'&&process.argv.includes('--write')&&changes.length){
  const filename=path.join(root,'production.json');const tmp=filename+'.director-v2-tmp';
  await writeFile(tmp,JSON.stringify(adjusted,null,2)+'\n','utf8');await rename(tmp,filename);
 }
 await writeFile(dst,JSON.stringify(receipt,null,2)+'\n','utf8');
 console.log(JSON.stringify({status,issues,changes,receipt:dst},null,2));
 if(status!=='PASS')process.exitCode=1;
};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct)main().catch(e=>{console.error('DIRECTOR_V2_GATE_FAILED:',e.message);process.exitCode=2;});
