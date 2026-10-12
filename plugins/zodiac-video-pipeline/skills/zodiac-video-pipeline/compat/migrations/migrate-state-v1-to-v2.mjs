#!/usr/bin/env node
import {readFile,writeFile} from 'node:fs/promises';

const [inputPath,outputPath]=process.argv.slice(2);
if(!inputPath||!outputPath){console.error('Usage: node migrate-state-v1-to-v2.mjs <old-state.json> <new-state.json>');process.exit(2);}
const old=JSON.parse(await readFile(inputPath,'utf8'));
if(old.format!=='zodiac-pipeline-state@1')throw new Error('STATE_MIGRATION_INVALID: expected zodiac-pipeline-state@1');
const blank=(status='LOCKED')=>({status,capability_receipts:[],context_manifest:[],outputs:[],gate_results:{}});
const copy=(id)=>old.phases?.[id]?JSON.parse(JSON.stringify(old.phases[id])):blank();
const terminal=s=>['PASS','SKIPPED_REUSED'].includes(s?.status);
const readyOrCopied=(id)=>copy(id);

const evidence=readyOrCopied('01-evidence');
const concept=readyOrCopied('02-concept');
for(const r of concept.capability_receipts??[])if(r.capability_id==='viral_analysis'&&!r.application_summary)r.application_summary='Migrated from orchestration v2 validated viral-analysis receipt.';
const narration=readyOrCopied('03-narration');
const visual=readyOrCopied('04-visual-compile');
const assets=readyOrCopied('05-assets');
const publish=readyOrCopied('07-publish');

const contentSteps={evidence,concept,narration};
let contentCurrent='evidence';
for(const id of ['evidence','concept','narration']){if(!terminal(contentSteps[id])){contentCurrent=id;break;}contentCurrent=id;}
const contentAll=Object.values(contentSteps).every(terminal);
if(!contentAll){
  const ids=['evidence','concept','narration'];const idx=ids.indexOf(contentCurrent);
  for(let i=idx+1;i<ids.length;i++)contentSteps[ids[i]]=blank();
  if(contentSteps[contentCurrent].status==='LOCKED')contentSteps[contentCurrent].status='READY';
}

const visualSteps={visual_compile:visual,assets,publish_prep:publish};
let visualCurrent='visual_compile';
for(const id of ['visual_compile','assets','publish_prep']){if(!terminal(visualSteps[id])){visualCurrent=id;break;}visualCurrent=id;}
const visualAll=Object.values(visualSteps).every(terminal);
if(!visualAll){
  const ids=['visual_compile','assets','publish_prep'];const idx=ids.indexOf(visualCurrent);
  for(let i=idx+1;i<ids.length;i++)visualSteps[ids[i]]=blank();
  if(visualSteps[visualCurrent].status==='LOCKED')visualSteps[visualCurrent].status='READY';
}

let currentPhase='01-content';
let contentStatus=contentAll?'PASS':'IN_PROGRESS';
let visualStatus='LOCKED';
if(contentAll){currentPhase='02-visual-production';visualStatus=visualAll?'PASS':'IN_PROGRESS';}
if(contentAll&&visualAll)currentPhase='03-handoff';

const handoff={status:(contentAll&&visualAll)?'READY':'LOCKED',current_step:'assemble',steps:{assemble:blank((contentAll&&visualAll)?'READY':'LOCKED'),validate:blank(),export:blank()}};
const next={
  format:'zodiac-pipeline-state@2',plugin_version:'1.24.0',run_id:old.run_id,run_mode:old.run_mode??'fresh',flags:old.flags??{},current_phase:currentPhase,operations:[],waivers:[],
  migration:{from:'zodiac-pipeline-state@1',old_current_phase:old.current_phase,discarded_old_handoff:true,note:'Old 06-render-handoff is intentionally discarded because the three-phase flow moves publish prep before final handoff/export.'},
  phases:{
    '01-content':{status:contentStatus,current_step:contentAll?'narration':contentCurrent,steps:contentSteps},
    '02-visual-production':{status:contentAll?visualStatus:'LOCKED',current_step:visualAll?'publish_prep':visualCurrent,steps:contentAll?visualSteps:{visual_compile:blank(),assets:blank(),publish_prep:blank()}},
    '03-handoff':handoff
  }
};
await writeFile(outputPath,JSON.stringify(next,null,2)+'\n','utf8');
console.log('PIPELINE_STATE_MIGRATED: '+outputPath);
