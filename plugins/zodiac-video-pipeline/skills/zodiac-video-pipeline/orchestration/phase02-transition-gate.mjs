#!/usr/bin/env node
// Non-mutating entry gate. Source readiness != authored input readiness != native PASS.
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildPhase02HandoffContext} from './phase02-handoff-context.mjs';
import {assertContentApprovalSources} from './approval-source-hashes.mjs';
const args=process.argv.slice(2), option=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]??null};
const workspace=option('--workspace');
if(!workspace){console.error('Usage: node phase02-transition-gate.mjs --workspace <dir>');process.exit(2)}
const root=path.resolve(workspace), skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const exists=async p=>access(p).then(()=>true).catch(()=>false);
const required=['narration.txt','production.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json'];
const issues=[],hashes={};
const readJson=async p=>{try{return JSON.parse(await readFile(p,'utf8'))}catch{return null}};
const manifest=await readJson(path.resolve(skill,'../../plugin.json'));
const state=await readJson(path.join(root,'.authoring/pipeline-state.json'));
if(!manifest)issues.push({code:'SOURCE_UNAVAILABLE',path:'plugin.json'});
if(!state)issues.push({code:'PIPELINE_STATE_MISSING_OR_INVALID',path:'.authoring/pipeline-state.json'});
if(manifest&&state?.plugin_version!==manifest.version)issues.push({code:'VERSION_MISMATCH',state:state?.plugin_version,plugin:manifest.version});
try{const binding=await assertContentApprovalSources(root,state);if(await exists(path.join(root,'.authoring/visual-intent.json'))&&binding.status!=='BOUND')throw Error('NEW_INTENT_REQUIRES_BOUND_CONTENT_REVIEW');}catch(e){issues.push({code:'CONTENT_APPROVAL_SOURCE_DRIFT',detail:e.message});}
const content=state?.phases?.['01-content'];
if(state&&!['PASS','SKIPPED_REUSED'].includes(content?.status))issues.push({code:'CONTENT_NOT_APPROVED',status:content?.status??null});
if(state&&!state.review_receipts?.some(r=>r.phase_id==='01-content'&&r.status==='APPROVED'&&r.proof?.kind==='user_message'&&typeof r.proof.ref==='string'&&r.proof.ref.trim()&&!r.proof.ref.includes('<')))issues.push({code:'CONTENT_APPROVAL_RECEIPT_MISSING'});
const missing=[];
for(const rel of required){const file=path.join(root,rel);if(!(await exists(file))){missing.push(rel);continue;}const data=await readFile(file);hashes[rel]=createHash('sha256').update(data).digest('hex');if(rel.endsWith('.json')&&!await readJson(file))issues.push({code:'AUTHORING_JSON_INVALID',path:rel});}
if(!missing.includes('production.json')){const p=await readJson(path.join(root,'production.json'));if(p&&(!Array.isArray(p.scenes)||!p.scenes.length))issues.push({code:'PRODUCTION_SCENES_MISSING'});}
if(missing.length)issues.push({code:'AUTHORING_INPUT_MISSING',paths:missing});
const blocked=issues.some(x=>x.code!=='AUTHORING_INPUT_MISSING');
const status=blocked?'BLOCKED':missing.length?'AUTHORING_REQUIRED':'AUTHORING_READY';
const handoff_context=await buildPhase02HandoffContext(root,{status,issues,pluginVersion:manifest?.version??null});
console.log(JSON.stringify({handoff_context,format:'zodiac-phase02-transition@1',status,workspace:root,source_version:manifest?.version??null,source_ready:Boolean(manifest&&state&&state.plugin_version===manifest.version),authoring_ready:status==='AUTHORING_READY',hashes,issues,next:status==='AUTHORING_REQUIRED'?'Create the missing Phase-02 authoring inputs from approved narration; do not create placeholders or receipts.':status==='AUTHORING_READY'?'Run strict execution-preflight then phase02-execute --run; this is not native PASS.':'Resolve blockers using genuine source/state evidence.'},null,2));
process.exit(blocked?2:0);
