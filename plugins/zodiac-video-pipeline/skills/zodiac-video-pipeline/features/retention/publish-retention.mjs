#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const fail=code=>{throw new Error(code)};
const stop=new Set('la va nhung mot cac cua co khong vi ma thi lai rat hon duoc voi trong khi nay do ay nhu cho ra chi phai'.split(/\s+/u));
const tokens=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/đ/g,'d').match(/[\p{L}\p{N}]+/gu)??[];
const distinct=s=>[...new Set(tokens(s).filter(x=>x.length>1&&!stop.has(x)))];
const normalized=s=>tokens(s).join(' ');

export function analyzePublishRetention({publish,engagementReview,narration}){
  const reviewed=String(engagementReview?.criteria?.payoff_satisfaction?.evidence_excerpt??'').trim();
  const payoff=reviewed||String(publish?.retention?.payoff_evidence_excerpt??'').trim();
  if(!payoff)fail('PUBLISH_RETENTION_PAYOFF_REQUIRED');
  if(!reviewed&&narration==null)fail('PUBLISH_RETENTION_NARRATION_REQUIRED');
  const excerptTokens=tokens(payoff);
  if(excerptTokens.length<3||excerptTokens.length>35)fail('PUBLISH_RETENTION_PAYOFF_LENGTH');
  if(narration!=null&&!normalized(narration).includes(normalized(payoff)))fail('PUBLISH_RETENTION_PAYOFF_NOT_GROUNDED');
  const payoffTokens=distinct(payoff);
  const copy=[publish?.title,publish?.caption,publish?.cover?.hook].filter(Boolean).join(' ');
  const copySet=new Set(distinct(copy));
  const overlap=payoffTokens.filter(x=>copySet.has(x));
  const ratio=payoffTokens.length?overlap.length/payoffTokens.length:0;
  const issues=[];
  if(payoffTokens.length>=4&&overlap.length>=3&&ratio>=0.60){
    issues.push({code:'PAYOFF_SPOILER',overlap_tokens:overlap,overlap_ratio:Math.round(ratio*100)/100});
  }
  const status=issues.length?'REVIEW':'PASS';
  return {format:'zodiac-publish-retention-review@1',status,risk_level:status==='PASS'?'LOW':'HIGH',metrics:{payoff_distinct_tokens:payoffTokens.length,overlap_tokens:overlap.length,overlap_ratio:Math.round(ratio*100)/100},issues,not_a_performance_guarantee:true};
}

export async function analyzePublishRetentionWorkspace(root,{write=false}={}){
  root=path.resolve(root);
  const [publish,engagementReview,narration]=await Promise.all([
    readFile(path.join(root,'publish','publish.json'),'utf8').then(JSON.parse),
    readFile(path.join(root,'.authoring','engagement-review.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;}),
    readFile(path.join(root,'narration.txt'),'utf8')
  ]);
  const report=analyzePublishRetention({publish,engagementReview,narration});
  if(write){
    const dir=path.join(root,'.authoring');await mkdir(dir,{recursive:true});
    await writeFile(path.join(dir,'publish-retention-review.json'),JSON.stringify(report,null,2)+'\n');
  }
  return report;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2];
  if(!root){console.error('Usage: node publish-retention.mjs <workspace> [--write]');process.exit(2);}
  try{
    const r=await analyzePublishRetentionWorkspace(root,{write:process.argv.includes('--write')});
    console.log(`PUBLISH_RETENTION_${r.status}: overlap=${r.metrics.overlap_ratio}`);
    if(r.status!=='PASS')process.exitCode=1;
  }catch(e){console.error('PUBLISH_RETENTION_BLOCKED '+e.message);process.exitCode=2;}
}
