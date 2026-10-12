import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script=fileURLToPath(new URL('../phase02-execute.mjs',import.meta.url));
const write=async(p,s)=>{await mkdir(path.dirname(p),{recursive:true});await writeFile(p,s);};
const run=(ws,root,extra=[])=>spawnSync(process.execPath,[script,'--workspace',ws,'--source-root',root,...extra],{encoding:'utf8',timeout:12000});
const makeWorkspace=async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'phase02-exec-workspace-'));
 await write(path.join(root,'production.json'),JSON.stringify({version:'2.0',assets:{},scenes:[{id:'s01',voice:'Song Tử nói khác.',entities:[{id:'gemini',kind:'character',initial_state:'neutral',states:{neutral:{asset:null}}}],events:[]}]}));
 await write(path.join(root,'narration.txt'),'Song Tử nói khác.\n');
 await write(path.join(root,'.authoring/character-assembly-plan.json'),'{}');
 await write(path.join(root,'publish/publish.json'),'{}');
 await write(path.join(root,'publish/publish-copy.txt'),'COPY');
 return root;
};
const makeSource=async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'phase02-exec-plugin-'));
 const skill=path.join(root,'skills/zodiac-video-pipeline');
 await write(path.join(root,'plugin.json'),JSON.stringify({name:'zodiac-video-pipeline',version:'2.2.9'}));
 await write(path.join(skill,'orchestration/pipeline-state.template.json'),JSON.stringify({plugin_version:'2.2.9'}));
 const coordinator=await readFile(script,'utf8');
 const rels=coordinator.match(/const sourcePaths=\[([\s\S]*?)\];/)[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
 for(const p of rels){const full=path.join(skill,p);if(p.endsWith('.mjs'))await write(full,'console.log("MOCK_PASS");\n');else if(!(await exists(full)))await write(full,'{}\n');}
 // Deterministic fake binaries only for testing the coordinator, never for production.
 const fakeCharacter=`import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';
 const file=process.argv[2],root=path.dirname(file);await mkdir(path.join(root,'.authoring'),{recursive:true});
 if(process.argv.includes('--plan-only')){await writeFile(path.join(root,'.authoring/character-state-asset-plan.json'),'{}');}
 else {const prod=JSON.parse(await readFile(file));prod.assets.demo={path:'assets/characters/demo.svg'};prod.scenes[0].entities[0].states.neutral.asset='demo';await mkdir(path.join(root,'assets/characters'),{recursive:true});await writeFile(path.join(root,'assets/characters/demo.svg'),'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"></svg>');await writeFile(file,JSON.stringify(prod));}
 console.log('FAKE_COMPILER_OK');`;
 await write(path.join(skill,'references/asset-library-v4/characters/compile-character-assembly.mjs'),fakeCharacter);
 await write(path.join(skill,'references/asset-library-v4/environments/compile-environment.mjs'),`import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';const root=process.argv[2];await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/environment-compile-receipt.json'),'{}');console.log('ENV_FIXTURE_OK')`);
 await write(path.join(skill,'references/asset-library-v4/scene-direction/compile-scene-direction.mjs'),`import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';const root=process.argv[2];await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/scene-direction-compile-receipt.json'),'{}');console.log('SCENE_FIXTURE_OK')`);
 await write(path.join(skill,'orchestration/run-validator-with-receipt.mjs'),await readFile(new URL('../run-validator-with-receipt.mjs',import.meta.url),'utf8'));
 for(const name of ['episode-handoff.mjs','episode-scope.mjs'])await write(path.join(skill,'orchestration',name),await readFile(new URL('../'+name,import.meta.url),'utf8'));
 await write(path.join(skill,'orchestration/phase02-composition.mjs'),await readFile(new URL('../phase02-composition.mjs',import.meta.url),'utf8'));
 await write(path.join(skill,'orchestration/phase02-composition-core.mjs'),await readFile(new URL('../phase02-composition-core.mjs',import.meta.url),'utf8'));
 await write(path.join(skill,'orchestration/validate-phase02-precompile-boundary.mjs'),await readFile(new URL('../validate-phase02-precompile-boundary.mjs',import.meta.url),'utf8'));
 await write(path.join(skill,'orchestration/validate-phase02-art-direction.mjs'),await readFile(new URL('../validate-phase02-art-direction.mjs',import.meta.url),'utf8'));
 for(const f of ['palette-registry.json','environment-registry.json']) await write(path.join(skill,'art-direction',f),await readFile(new URL('../../art-direction/'+f,import.meta.url),'utf8'));
 await write(path.join(skill,'orchestration/validate-pipeline-state.mjs'),`import {readFile} from 'node:fs/promises';const j=JSON.parse(await readFile(process.argv[2]));if(j.plugin_version!=='2.2.9')process.exit(2);console.log('VALID_STATE_FIXTURE')`);
 return root;
};
const exists=async p=>{try{await readFile(p);return true;}catch{return false;}};

test('absent source blocks with named files and does not invent compiler results',async()=>{
 const ws=await makeWorkspace(),src=path.join(ws,'nothing-installed');const r=run(ws,src,['--run']);
 assert.equal(r.status,2);const evidence=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
 assert.equal(evidence.status,'BLOCKED');assert.ok(evidence.issues.some(x=>x.code==='SOURCE_UNAVAILABLE'));
 assert.equal(evidence.steps.length,0);
});

test('missing pipeline state remains blocked without fabricated approval',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();const r=run(ws,src,['--run']);
 assert.equal(r.status,2);const evidence=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
 assert.ok(evidence.issues.some(x=>x.code==='PIPELINE_STATE_MISSING_NO_AUTO_APPROVAL'));
 assert.equal(evidence.steps.length,0);
});

test('native run invokes fixture compilers and receipt-wrapped validators in order; resume reuses validated outputs',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9'}));
 const r=run(ws,src,['--run']);assert.equal(r.status,0,r.stderr+'\n'+r.stdout);
 const e=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
 assert.equal(e.status,'NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED');assert.equal(e.steps.length,15);
 assert.deepEqual(e.steps.map(x=>x.id),['character_components','character_plan','character_write','character_identity','outfit_bake','environment','environment_binding','scene_direction','scene_set_identity','scene_accent_containment','scene_direction_validation','scene_events','motion_consistency','visual_quality','publish_prep']);
 assert.ok(e.steps.every(x=>x.status==='PASS'));
 const p=JSON.parse(await readFile(path.join(ws,'production.json')));
 assert.equal(p.scenes[0].entities[0].states.neutral.asset,'demo');
 const v=JSON.parse(await readFile(path.join(ws,'.authoring/native-validator-visual_quality.json')));
 assert.equal(v.format,'zodiac-validator-receipt@1');
 const again=run(ws,src,['--run']);assert.equal(again.status,0,again.stderr);
 const e2=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
 assert.ok(e2.steps.some(x=>x.status==='SKIPPED_REUSED'));
});

test('source version mismatches template and aborts before any step',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();await write(path.join(src,'skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json'),JSON.stringify({plugin_version:'2.2.8'}));
 const r=run(ws,src,['--run']);assert.equal(r.status,2);const e=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
 assert.ok(e.issues.some(x=>x.code==='SOURCE_TEMPLATE_VERSION_MISMATCH'));assert.equal(e.steps.length,0);
});

test('resume regenerates tampered or missing character SVGs instead of trusting receipts',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9'}));
  assert.equal(run(ws,src,['--run']).status,0);
  const asset=path.join(ws,'assets/characters/demo.svg');
  const original=await readFile(asset,'utf8');
  for(const change of [()=>writeFile(asset,'<svg><!--changed--></svg>'),()=>rm(asset)]){
   await change();const result=run(ws,src,['--run']);assert.equal(result.status,0,result.stderr);
   const receipt=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
   assert.equal(receipt.steps.find(x=>x.id==='character_write').status,'PASS');
   assert.equal(await readFile(asset,'utf8'),original);
  }
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});

test('resume reruns visual QC when semantic asset-plan changes',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9'}));
  await write(path.join(ws,'asset-plan.json'),'{}');
  assert.equal(run(ws,src,['--run']).status,0);
  await write(path.join(ws,'asset-plan.json'),'{"changed":true}');
  assert.equal(run(ws,src,['--run']).status,0);
  const receipt=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json')));
  assert.equal(receipt.steps.find(x=>x.id==='visual_quality').status,'PASS');
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});

test('resume regenerates missing environment SVGs and tracks nested QC source changes',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9'}));
  const skill=path.join(src,'skills/zodiac-video-pipeline');
  await write(path.join(skill,'references/asset-library-v4/environments/compile-environment.mjs'),`import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';const root=process.argv[2],file=path.join(root,'production.json');const p=JSON.parse(await readFile(file));p.assets.ENV={path:'assets/environment/room.svg',category:'environment'};await mkdir(path.join(root,'assets/environment'),{recursive:true});await writeFile(path.join(root,p.assets.ENV.path),'<svg/>');await writeFile(file,JSON.stringify(p));await writeFile(path.join(root,'.authoring/environment-compile-receipt.json'),'{}');`);
  await write(path.join(skill,'orchestration/nested-qc.mjs'),'// original validator dependency');
  assert.equal(run(ws,src,['--run']).status,0);
  const asset=path.join(ws,'assets/environment/room.svg');await rm(asset);
  const rerun=run(ws,src,['--run']);assert.equal(rerun.status,0,rerun.stdout+rerun.stderr);
  const receiptPath=path.join(ws,'.authoring/phase02-execution-receipt.json');
  const before=JSON.parse(await readFile(receiptPath));
  assert.equal(before.steps.find(x=>x.id==='environment').status,'PASS');await readFile(asset);
  await write(path.join(skill,'orchestration/nested-qc.mjs'),'// changed validator dependency');
  assert.equal(run(ws,src,['--run']).status,0);
  const after=JSON.parse(await readFile(receiptPath));
  assert.notEqual(after.source.fingerprint,before.source.fingerprint);
  assert.equal(after.steps.find(x=>x.id==='visual_quality').status,'PASS');
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});

test('precompile seam blocks split narration before any native compiler executes',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9'}));
  const prod=JSON.parse(await readFile(path.join(ws,'production.json'),'utf8'));
  prod.scenes=[{...prod.scenes[0],id:'s01',voice:'Song Tử'}, {...prod.scenes[0],id:'s02',voice:'nói khác.'}];
  await write(path.join(ws,'production.json'),JSON.stringify(prod));
  const r=run(ws,src,['--run']);
  assert.equal(r.status,2,r.stdout);
  const receipt=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json'),'utf8'));
  assert.ok(receipt.issues.some(x=>x.code==='PRECOMPILE_SEAM_BLOCKED'));
  assert.equal(receipt.steps.length,0);
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});

test('opted-in art direction fails before character compilation when plan is absent',async()=>{
 const ws=await makeWorkspace(),src=await makeSource();
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9',flags:{art_direction_required:true}}));
  const r=run(ws,src,['--run']);assert.equal(r.status,2,r.stdout);
  const receipt=JSON.parse(await readFile(path.join(ws,'.authoring/phase02-execution-receipt.json'),'utf8'));
  assert.ok(receipt.issues.some(x=>x.code==='ART_DIRECTION_PREFLIGHT_BLOCKED'));
  assert.equal(receipt.steps.length,0);
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});

test('precompile and art direction preflights each execute once with genuine receipt',async()=>{
 const ws=await makeWorkspace(),src=await makeSource(),skill=path.join(src,'skills/zodiac-video-pipeline');
 try{
  await write(path.join(ws,'.authoring/pipeline-state.json'),JSON.stringify({plugin_version:'2.2.9',flags:{art_direction_required:true}}));
  await write(path.join(skill,'orchestration/run-validator-with-receipt.mjs'),await readFile(new URL('../run-validator-with-receipt.mjs',import.meta.url),'utf8'));
  for(const [scriptName,counter] of [['validate-phase02-precompile-boundary.mjs','seam'],['validate-phase02-art-direction.mjs','art']]){
   await write(path.join(skill,'orchestration',scriptName),`import {appendFile} from 'node:fs/promises';import path from 'node:path';await appendFile(path.join(process.argv[2],'.authoring/${counter}-calls'),'1\\n');console.log('PREFLIGHT_OK');`);
  }
  const result=run(ws,src,['--run']);assert.equal(result.status,0,result.stderr);
  for(const counter of ['seam','art'])assert.equal((await readFile(path.join(ws,'.authoring',counter+'-calls'),'utf8')).trim().split('\n').length,1,counter);
  const receipt=JSON.parse(await readFile(path.join(ws,'.authoring/native-validator-precompile_seam_validation.json')));assert.equal(receipt.exit_code,0);assert.match(receipt.stdout,/PREFLIGHT_OK/);
 }finally{await rm(ws,{recursive:true,force:true});await rm(src,{recursive:true,force:true});}
});
