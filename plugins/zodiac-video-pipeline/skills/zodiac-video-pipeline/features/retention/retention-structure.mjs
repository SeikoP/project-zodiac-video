#!/usr/bin/env node
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {estimateDuration} from '../../references/short-form-duration.mjs';

const fail=code=>{throw new Error(code)};
const tokens=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').match(/[\p{L}\p{N}]+/gu)??[];

function findSubsequence(hay,needle){
  if(!needle.length)return -1;
  outer:for(let i=0;i<=hay.length-needle.length;i++){
    for(let j=0;j<needle.length;j++)if(hay[i+j]!==needle[j])continue outer;
    return i;
  }
  return -1;
}

function locate(all,excerpt,code){
  const part=tokens(excerpt),start=findSubsequence(all,part);
  if(start<0)fail(code+'_EXCERPT_NOT_FOUND');
  return {start,end:start+part.length,length:part.length,excerpt};
}

export function analyzeRetentionStructure({narration,engagementReview,engagementDesign,plan}){
  if(!String(narration??'').trim())fail('RETENTION_NARRATION_REQUIRED');
  const all=tokens(narration),issues=[],criteria=engagementReview?.criteria??{};
  const hook=locate(all,criteria.hook_strength?.evidence_excerpt,'HOOK');
  const early=locate(all,criteria.early_value?.evidence_excerpt,'EARLY_VALUE');
  const payoff=locate(all,criteria.payoff_satisfaction?.evidence_excerpt,'PAYOFF');
  const pulls=(engagementReview?.pull_chain??[]).map((p,i)=>({...locate(all,p.evidence_excerpt,'PULL_'+i),beat_id:p.beat_id}));

  if(hook.end>16)issues.push({code:'HOOK_LATE',end_token:hook.end,limit:16});
  if(early.end>30)issues.push({code:'EARLY_VALUE_LATE',end_token:early.end,limit:30});
  if(pulls.length&&pulls[0].end>30)issues.push({code:'FIRST_PULL_LATE',end_token:pulls[0].end,limit:30});

  let maxGap=0;
  for(let i=1;i<pulls.length;i++){
    if(pulls[i].start<=pulls[i-1].start)issues.push({code:'PULL_CHAIN_ORDER',beat_id:pulls[i].beat_id});
    const gap=Math.max(0,pulls[i].start-pulls[i-1].end);maxGap=Math.max(maxGap,gap);
    if(gap>90)issues.push({code:'PULL_GAP_LONG',from:pulls[i-1].beat_id??null,to:pulls[i].beat_id??null,gap_tokens:gap,limit:90});
  }

  if(all.length&&payoff.start/all.length<0.55)issues.push({code:'PAYOFF_TOO_EARLY',start_ratio:Math.round(payoff.start/all.length*1000)/1000,min_ratio:0.55});

  const duration=estimateDuration(narration),turns=pulls.length,reframes=engagementDesign?.reframe_points?.length??0;
  if(duration.estimated_seconds>90&&turns<5)issues.push({code:'RUNTIME_LONG_WITH_FEW_TURNS',estimated_seconds:duration.estimated_seconds,turns,required:5});
  if(duration.estimated_seconds>90&&reframes<2)issues.push({code:'RUNTIME_LONG_WITH_FEW_REFRAMES',estimated_seconds:duration.estimated_seconds,reframes,required:2});
  if(duration.estimated_seconds>120&&turns<6)issues.push({code:'RUNTIME_OVER_120_WITH_FEW_TURNS',estimated_seconds:duration.estimated_seconds,turns,required:6});

  const status=issues.length?'REVIEW':'PASS';
  const risk_level=status==='PASS'?'LOW':issues.length>=3||issues.some(x=>x.code==='RUNTIME_OVER_120_WITH_FEW_TURNS')?'HIGH':'MEDIUM';
  return {format:'zodiac-retention-structure@1',status,risk_level,metrics:{token_count:all.length,estimated_seconds:duration.estimated_seconds,hook_end_token:hook.end,early_value_end_token:early.end,first_pull_end_token:pulls[0]?.end??null,max_pull_gap_tokens:maxGap,payoff_start_ratio:all.length?Math.round(payoff.start/all.length*1000)/1000:null,pull_beats:turns,reframe_points:reframes},issues,not_a_performance_guarantee:true};
}

async function narrationFile(root){
  for(const p of [path.join(root,'.authoring','narration.txt'),path.join(root,'narration.txt')]){
    try{if((await stat(p)).isFile())return p;}catch(e){if(e.code!=='ENOENT')throw e;}
  }
  fail('RETENTION_NARRATION_FILE_MISSING');
}

export async function analyzeRetentionWorkspace(root,{write=false}={}){
  root=path.resolve(root);const dir=path.join(root,'.authoring');
  const [narration,engagementReview,engagementDesign,plan]=await Promise.all([
    narrationFile(root).then(p=>readFile(p,'utf8')),
    readFile(path.join(dir,'engagement-review.json'),'utf8').then(JSON.parse),
    readFile(path.join(dir,'engagement-design.json'),'utf8').then(JSON.parse),
    readFile(path.join(dir,'narrative-plan.json'),'utf8').then(JSON.parse)
  ]);
  const report=analyzeRetentionStructure({narration,engagementReview,engagementDesign,plan});
  if(write){await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'retention-structure.json'),JSON.stringify(report,null,2)+'\n');}
  return report;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2];
  if(!root){console.error('Usage: node retention-structure.mjs <workspace> [--write]');process.exit(2);}
  try{
    const r=await analyzeRetentionWorkspace(root,{write:process.argv.includes('--write')});
    console.log(`RETENTION_STRUCTURE_${r.status}: risk=${r.risk_level} issues=${r.issues.length}`);
    if(r.status!=='PASS')process.exitCode=1;
  }catch(e){console.error('RETENTION_STRUCTURE_BLOCKED '+e.message);process.exitCode=2;}
}
