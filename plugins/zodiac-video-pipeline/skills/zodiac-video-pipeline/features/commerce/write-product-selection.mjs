#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildAffiliateHandoff} from './commerce-core.mjs';

const fail=code=>{throw new Error(code)};
const clamp01=v=>Math.max(0,Math.min(1,Number(v)||0));

export async function writeProductSelection(workspace,product,{retrievedAt=null,creativeScores={}}={}){
  if(!product?.product_id||!String(product?.product_name??'').trim())fail('PRODUCT_IDENTITY_REQUIRED');
  const commerce=path.join(workspace,'.authoring','commerce');await mkdir(commerce,{recursive:true});
  const creative_scores={story_fit:clamp01(creativeScores.story_fit),visual_quality:clamp01(creativeScores.visual_quality),demo_potential:clamp01(creativeScores.demo_potential),price_fit:clamp01(creativeScores.price_fit)};
  const selection={format:'zodiac-product-selection@1',provider:'kalodata',region:'VN',product:{...product,product_id:String(product.product_id),product_name:String(product.product_name).trim()},creative_scores,...(retrievedAt?{retrieved_at:retrievedAt}:{})};
  const handoff=buildAffiliateHandoff(selection.product,{retrievedAt});
  await writeFile(path.join(commerce,'product-selection.json'),JSON.stringify(selection,null,2)+'\n');
  await writeFile(path.join(commerce,'affiliate-handoff.json'),JSON.stringify(handoff,null,2)+'\n');
  return {selection,handoff};
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const workspace=process.argv[2],productJson=process.argv[3];
  if(!workspace||!productJson){console.error('Usage: node write-product-selection.mjs <workspace> <product.json>');process.exit(2);}
  try{const product=JSON.parse(await readFile(productJson,'utf8'));const r=await writeProductSelection(path.resolve(workspace),product);console.log(`PRODUCT_SELECTION_PASS product=${r.selection.product.product_id}`);}catch(e){console.error('PRODUCT_SELECTION_BLOCKED '+e.message);process.exit(1);}
}
