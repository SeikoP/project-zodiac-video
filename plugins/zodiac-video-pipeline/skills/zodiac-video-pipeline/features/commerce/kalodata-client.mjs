#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildRankPayload,normalizeCandidates} from './commerce-core.mjs';
const fail=code=>{throw new Error(code)};

export async function kalodataRequest(endpoint,payload,{apiKey=process.env.KALODATA_API_KEY,fetchImpl=globalThis.fetch,baseUrl=process.env.KALODATA_BASE_URL||'https://www.kalodata.com'}={}){
  if(!String(apiKey??'').trim())fail('KALODATA_API_KEY_MISSING');
  if(typeof fetchImpl!=='function')fail('FETCH_UNAVAILABLE');
  const url=new URL(endpoint,baseUrl).toString();
  const res=await fetchImpl(url,{method:'POST',headers:{'secret-key':String(apiKey).trim(),'content-type':'application/json;charset=UTF-8'},body:JSON.stringify(payload)});
  if(!res?.ok)fail(`KALODATA_HTTP_${res?.status??'ERROR'}`);
  const body=await res.json();
  if(body?.success!==true)fail(`KALODATA_API_${body?.code??'FAILED'}:${body?.message??'unknown'}`);
  return body.data;
}

export async function discoverKalodataProducts(keywords,{apiKey,fetchImpl,baseUrl,pageSize=20,needImage=1}={}){
  const clean=[...new Set((keywords??[]).map(x=>String(x).trim()).filter(Boolean))];if(!clean.length)fail('KALODATA_KEYWORDS_REQUIRED');
  const all=[];
  for(const keyword of clean){
    const rows=await kalodataRequest('/openapi/v1/tiktok/product/rank',buildRankPayload(keyword,{pageSize,needImage}),{apiKey,fetchImpl,baseUrl});
    for(const row of Array.isArray(rows)?rows:[])all.push({...row,__keyword:keyword});
  }
  const byId=new Map();
  for(const row of all){const prior=byId.get(String(row.product_id))??[];prior.push(row);byId.set(String(row.product_id),prior);}
  return [...byId.values()].flatMap(rows=>normalizeCandidates([rows.reduce((a,b)=>({...a,...b}),{})],[...new Set(rows.map(x=>x.__keyword))]));
}

export async function getKalodataProductDetail(productId,{apiKey,fetchImpl,baseUrl,needImage=1}={}){
  if(!String(productId??'').trim())fail('PRODUCT_ID_REQUIRED');
  return kalodataRequest('/openapi/v1/tiktok/product/detail',{region:'VN',language:'vi-VN',currency:'VND',date_range:'last30Day',product_id:String(productId),need_image:needImage,need_extra:false},{apiKey,fetchImpl,baseUrl});
}

export async function discoverWorkspace(workspace,{apiKey=process.env.KALODATA_API_KEY,fetchImpl=globalThis.fetch}={}){
  const commerce=path.join(workspace,'.authoring','commerce');await mkdir(commerce,{recursive:true});
  const query=JSON.parse(await readFile(path.join(commerce,'product-query.json'),'utf8'));
  const candidates=await discoverKalodataProducts(query.keywords,{apiKey,fetchImpl,pageSize:query.page_size??20,needImage:query.need_image??1});
  const out={format:'zodiac-product-candidates@1',provider:'kalodata',region:'VN',keywords:query.keywords,candidates};
  await writeFile(path.join(commerce,'product-candidates.json'),JSON.stringify(out,null,2)+'\n');return out;
}

export async function detailWorkspace(workspace,{apiKey=process.env.KALODATA_API_KEY,fetchImpl=globalThis.fetch}={}){
  const commerce=path.join(workspace,'.authoring','commerce');await mkdir(commerce,{recursive:true});
  const selection=JSON.parse(await readFile(path.join(commerce,'product-selection.json'),'utf8'));
  const productId=String(selection?.product?.product_id??'').trim();if(!productId)fail('PRODUCT_SELECTION_REQUIRED');
  const detail=await getKalodataProductDetail(productId,{apiKey,fetchImpl});
  const normalized={...detail,product_id:String(detail?.product_id??productId)};
  if(normalized.product_id!==productId)fail('PRODUCT_DETAIL_ID_MISMATCH');
  await writeFile(path.join(commerce,'product-detail.json'),JSON.stringify(normalized,null,2)+'\n');return normalized;
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  let cmd=process.argv[2],workspace=process.argv[3];
  if(!['discover','detail'].includes(cmd)&&['discover','detail'].includes(process.argv[3])){workspace=process.argv[2];cmd=process.argv[3];}
  if(!['discover','detail'].includes(cmd)||!workspace){console.error('Usage: node kalodata-client.mjs <discover|detail> <workspace>');process.exit(2);}
  try{
    if(cmd==='discover'){const r=await discoverWorkspace(path.resolve(workspace));console.log(`KALODATA_DISCOVERY_PASS candidates=${r.candidates.length}`);}
    else {const r=await detailWorkspace(path.resolve(workspace));console.log(`KALODATA_DETAIL_PASS product=${r.product_id}`);}
  }catch(e){console.error(`KALODATA_${cmd.toUpperCase()}_BLOCKED `+e.message);process.exit(1);}
}
