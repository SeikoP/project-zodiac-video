import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {sha256} from '../director-v2-core.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const original=path.resolve(here,'..');

test('failed downstream QC restores byte-exact production and invalidates director PASS',async()=>{
 const base=await mkdtemp(path.join(os.tmpdir(),'director-rollback-'));
 const source=path.join(base,'skill'),workspace=path.join(base,'workspace');
 const feature=path.join(source,'features/visual-composition');await mkdir(feature,{recursive:true});await mkdir(path.join(source,'orchestration'),{recursive:true});await mkdir(path.join(workspace,'.authoring'),{recursive:true});
 for(const x of ['director-v2-core.mjs','director-v2-gate.mjs','run-director-v2-review.mjs'])await copyFile(path.resolve(original,'../features/visual-composition',x),path.join(feature,x));
 await writeFile(path.join(base,'package.json'),'{"type":"module"}');
 await writeFile(path.join(source,'orchestration/compile-job-v5.mjs'),`export function assertJob5VisualRoleSizes(ir){for(const scene of ir.scenes??[])for(const e of scene.entities??[])for(const s of Object.values(e.states??{})){if(s.visible===false)continue;if(ir.assets[s.asset]?.category==='effect'&&s.transform.width*s.transform.height<30000)throw Error('ROLE_TOO_SMALL');}}`);
 const voice='Bạn tưởng nó im lặng. Nhưng hóa ra nó đã đọc hết.';
 const entity=(id,kind,asset,transform)=>({id,kind,initial_state:'on',states:{on:{asset,visible:true,transform}}});
 const prod={version:'2.0',assets:{CHAR:{category:'character'},FX:{category:'effect'}},scenes:[{id:'S02',voice,entities:[entity('hero','character','CHAR',{x:170,y:430,width:300,height:400}),entity('friend','character','CHAR',{x:620,y:430,width:300,height:400}),entity('reaction','effect','FX',{x:540,y:200,width:155,height:170})],events:[{id:'notice',target:'hero',trigger:{type:'voice_anchor',text:'Bạn tưởng'}},{id:'respond',target:'friend',trigger:{type:'voice_anchor',text:'Nhưng hóa ra'}}]}]};
 const plan={format:'zodiac-director-plan@1',narration_sha256:sha256(voice),beats:[{scene_id:'S02',beat_id:'S02-B1',voice_anchor:'Bạn tưởng',semantic_purpose:'realization',performer:'hero',target:'friend',action:'look_up',reaction:'look_away',visual_payoff:'expose_truth',shot_reason:'tension',supported_motion_or_state:'state_swap',asset_cost_reason:'reuse native',cause_event_id:'notice',reaction_event_id:'respond',blocking:[{entity_id:'reaction',anchor:'friend',side:'above-left',relayout:true}]}]};
 const src=JSON.stringify(prod,null,2)+'\n';await writeFile(path.join(workspace,'production.json'),src);await writeFile(path.join(workspace,'narration.txt'),voice);await writeFile(path.join(workspace,'.authoring/director-plan.json'),JSON.stringify(plan));
 const run=spawnSync(process.execPath,[path.join(feature,'run-director-v2-review.mjs'),workspace],{encoding:'utf8'});
 assert.notEqual(run.status,0);
 assert.equal(await readFile(path.join(workspace,'production.json'),'utf8'),src);
 assert.equal(JSON.parse(await readFile(path.join(workspace,'.authoring/director-v2-gate-receipt.json'))).status,'BLOCKED');
 assert.equal(JSON.parse(await readFile(path.join(workspace,'.authoring/director-v2-review-receipt.json'))).status,'BLOCKED');
});
