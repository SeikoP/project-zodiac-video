#!/usr/bin/env node
import {access,readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReleaseConsistency} from './validate-release-consistency.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'..');
const pluginRoot=path.resolve(root,'../..');
const workspace=path.resolve(process.argv[2]??'.');
const phase=process.argv[3]??'02-visual-production';
const reportPath=path.join(workspace,'.authoring','execution-preflight.json');
const required=[
 'orchestration/phase-index.json','orchestration/router.md',
 'orchestration/validate-pipeline-state.mjs',
 'orchestration/run-validator-with-receipt.mjs'
];
if(phase==='02-visual-production')required.push(
 'references/asset-library-v4/characters/compile-character-assembly.mjs',
 'references/asset-library-v4/characters/components/catalog.json',
 'references/asset-library-v4/environments/compile-environment.mjs',
 'references/asset-library-v4/environments/composition-index.json',
 'references/asset-library-v4/scene-direction/compile-scene-direction.mjs',
 'references/asset-library-v4/validation/validate-character-assembly.mjs',
 'orchestration/validate-visual-quality.mjs'
);
const exists=async p=>access(p).then(()=>true).catch(()=>false);
const problems=[];let manifest,template;
try{manifest=JSON.parse(await readFile(path.join(pluginRoot,'plugin.json'),'utf8'));}catch{problems.push('PLUGIN_MANIFEST_MISSING');}
try{template=JSON.parse(await readFile(path.join(here,'pipeline-state.template.json'),'utf8'));}catch{problems.push('STATE_TEMPLATE_MISSING');}
if(manifest&&template&&manifest.version!==template.plugin_version)problems.push('STATE_TEMPLATE_VERSION_MISMATCH');
const releaseCheck=await checkReleaseConsistency(pluginRoot);
for(const problem of releaseCheck.problems)if(!problems.includes(problem))problems.push(problem);
for(const rel of required)if(!await exists(path.join(root,rel)))problems.push('MISSING_SOURCE:'+rel);
const statePath=path.join(workspace,'.authoring','pipeline-state.json');
let state;
if(await exists(statePath)){
 try{state=JSON.parse(await readFile(statePath,'utf8'));}catch{problems.push('STATE_JSON_INVALID');}
 if(state&&manifest&&state.plugin_version!==manifest.version)problems.push('WORKSPACE_PLUGIN_VERSION_MISMATCH');
}else problems.push('STATE_MISSING');
if(phase==='02-visual-production' && process.argv.includes('--require-authoring-inputs')){
 for(const rel of ['production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json']){
  if(!await exists(path.join(workspace,rel)))problems.push('MISSING_AUTHORING_INPUT:'+rel);
 }
}
const report={format:'zodiac-execution-preflight@1',plugin_version:manifest?.version??null,phase,workspace,status:problems.length?'BLOCKED':'READY',problems,checked_at:new Date().toISOString(),notes:'READY verifies source/version/state only unless --require-authoring-inputs is passed. Strict READY verifies input existence, not schema or native compilation. Never synthesize compiler or validator receipts.'};
await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({status:report.status,problems,report:reportPath},null,2));
process.exit(problems.length?2:0);
