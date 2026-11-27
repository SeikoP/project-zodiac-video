#!/usr/bin/env node
// Trend-phrase pass for the narration skeleton (see narration-skeleton.md). Language evidence only: it never supports a Zodiac trait.
// Checks that every trend phrase placed in the script is bounded, sourced, dated, classified honestly and actually spoken.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SLOTS=['hook','facet1','facet2','facet3','turn','close'];
export const CLASSES=['observed','recurring','trend_candidate','measured'];
export const MAX_PHRASES=2;
const norm=s=>String(s??'').normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu)?.join(' ')??'';
const host=u=>{try{return new URL(u).hostname.replace(/^www\./,'');}catch{return '';}};
const dated=d=>/^\d{4}-\d{2}(-\d{2})?$/.test(String(d??''));

export function checkTrendPhrases(doc,narration){
 const issues=[],add=(code,where,detail)=>issues.push({code,where,detail});
 if(doc?.format!=='zodiac-trend-phrases@1'){add('FORMAT','file','format must be zodiac-trend-phrases@1');return out(issues,0);}
 const items=Array.isArray(doc.items)?doc.items:[];
 if(items.length>MAX_PHRASES)add('TOO_MANY','items',items.length+' phrases, max '+MAX_PHRASES+': more makes the script sound assembled from slang');
 const spoken=' '+norm(narration)+' ';
 items.forEach((it,i)=>{
  const w='item'+(i+1),tokens=norm(it.phrase).split(' ').filter(Boolean);
  if(tokens.length<2||tokens.length>8)add('PHRASE_SIZE',w,'phrase needs 2-8 tokens');
  if(!spoken.includes(' '+norm(it.phrase)+' '))add('NOT_IN_NARRATION',w,'"'+it.phrase+'" is not spoken in narration.txt');
  if(!SLOTS.includes(it.slot))add('SLOT',w,'slot must be one of '+SLOTS.join(', '));
  if(typeof it.function!=='string'||it.function.trim().length<8)add('FUNCTION',w,'name the job it does (surprise, escalation, mock seriousness, punchline…), not just the word');
  if(!CLASSES.includes(it.evidence_class))add('CLASS',w,'evidence_class must be one of '+CLASSES.join(', '));
  const sources=Array.isArray(it.sources)?it.sources:[];
  if(!sources.length)add('NO_SOURCE',w,'at least one accessed source');
  for(const s of sources){if(!host(s.url))add('SOURCE_URL',w,'bad url');if(!dated(s.date))add('SOURCE_DATE',w,'source needs a YYYY-MM or YYYY-MM-DD date');}
  const hosts=new Set(sources.map(s=>host(s.url)).filter(Boolean));
  if(it.evidence_class==='recurring'&&hosts.size<3)add('RECURRING_NEEDS_3',w,'recurring needs 3 independent sites, found '+hosts.size);
  if(it.evidence_class==='measured'&&!(typeof it.window==='string'&&it.window.trim()&&typeof it.platform==='string'&&it.platform.trim()))add('MEASURED_NEEDS_WINDOW',w,'measured needs platform and time window');
  if(typeof it.natural_check!=='string'||it.natural_check.trim().length<12)add('NATURAL_CHECK',w,'say why it is natural to speak aloud for this narrator, and not forced or stale');
 });
 return out(issues,items.length);
}
const out=(issues,count)=>({format:'zodiac-trend-phrase-check@1',status:issues.length?'REVIEW':'PASS',phrases:count,issues,not_an_approval:true,language_evidence_only:true});

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const ws=process.argv[2];if(!ws){console.error('Usage: node validate-trend-phrases.mjs <workspace>');process.exit(2);}
  const dir=path.join(path.resolve(ws),'.authoring');
  const [doc,narration]=await Promise.all([readFile(path.join(dir,'trend-phrases.json'),'utf8').then(JSON.parse),readFile(path.join(dir,'narration.txt'),'utf8')]);
  const r=checkTrendPhrases(doc,narration);console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
