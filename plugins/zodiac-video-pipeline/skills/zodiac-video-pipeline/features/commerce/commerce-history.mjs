#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const FORMAT='zodiac-affiliate-commerce-history@1';
const TOPOLOGIES=new Set(['interrupt','embedded','seed_and_reveal','split_exposure','post_payoff','callback']);
const TREATMENTS=new Set(['narrator_hijack','freeze_analysis','prop_zoom','character_demo','mystery_clue','visual_annotation','comparison_card']);
const historyPath=root=>path.join(root,'.authoring','commerce','recent-motifs.json');

export async function readCommerceHistory(workspace){
  try{const v=JSON.parse(await readFile(historyPath(workspace),'utf8'));if(v?.format!==FORMAT||!Array.isArray(v.entries))throw new Error('COMMERCE_HISTORY_INVALID');return v;}
  catch(e){if(e.code==='ENOENT')return {format:FORMAT,entries:[]};throw e;}
}
export async function writeCommerceHistory(workspace,entries){
  const clean=(entries??[]).map(x=>{if(!TOPOLOGIES.has(x?.topology)||!TREATMENTS.has(x?.treatment))throw new Error('COMMERCE_HISTORY_ENTRY_INVALID');return {topology:x.topology,treatment:x.treatment,...(x.episode_id?{episode_id:String(x.episode_id)}:{})};}).slice(-12);
  const out={format:FORMAT,entries:clean};const p=historyPath(workspace);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,JSON.stringify(out,null,2)+'\n');return out;
}
export async function recordCommerceMotif(workspace,plan,{episode_id}={}){const h=await readCommerceHistory(workspace);return writeCommerceHistory(workspace,[...h.entries,{topology:plan.topology,treatment:plan.treatment,episode_id}]);}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const root=process.argv[2],integrationPath=process.argv[3],episode_id=process.argv[4];if(!root||!integrationPath){console.error('Usage: node commerce-history.mjs <workspace> <affiliate-integration.json> [episode-id]');process.exit(2);}try{const plan=JSON.parse(await readFile(integrationPath,'utf8'));const r=await recordCommerceMotif(path.resolve(root),plan,{episode_id});console.log(`COMMERCE_HISTORY_PASS entries=${r.entries.length}`);}catch(e){console.error('COMMERCE_HISTORY_BLOCKED '+e.message);process.exit(1);}}
