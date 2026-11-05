#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const fail=code=>{throw new Error(code)};
const sha256=buf=>createHash('sha256').update(buf).digest('hex');
const safeId=v=>String(v??'').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);

function jpegSize(buf){
  let i=2;while(i+9<buf.length){if(buf[i]!==0xff){i++;continue;}const marker=buf[i+1];i+=2;if(marker===0xd8||marker===0xd9)continue;if(i+2>buf.length)break;const len=buf.readUInt16BE(i);if(len<2||i+len>buf.length)break;if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)){return {width:buf.readUInt16BE(i+5),height:buf.readUInt16BE(i+3)};}i+=len;}
  fail('JPEG_DIMENSIONS_UNREADABLE');
}
function webpSize(buf){
  const kind=buf.subarray(12,16).toString('ascii');
  if(kind==='VP8X'){return {width:1+buf.readUIntLE(24,3),height:1+buf.readUIntLE(27,3)};}
  if(kind==='VP8L'){if(buf[20]!==0x2f)fail('WEBP_DIMENSIONS_UNREADABLE');const bits=(buf[21]|(buf[22]<<8)|(buf[23]<<16)|(buf[24]<<24))>>>0;return {width:1+(bits&0x3fff),height:1+((bits>>>14)&0x3fff)};}
  if(kind==='VP8 '){const idx=buf.indexOf(Buffer.from([0x9d,0x01,0x2a]),20);if(idx>0)return {width:buf.readUInt16LE(idx+3)&0x3fff,height:buf.readUInt16LE(idx+5)&0x3fff};}
  fail('WEBP_DIMENSIONS_UNREADABLE');
}
export function sniffImage(buf){
  if(!Buffer.isBuffer(buf)||buf.length<24)fail('IMAGE_BYTES_INVALID');
  if(buf.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',ext:'png',width:buf.readUInt32BE(16),height:buf.readUInt32BE(20)};
  if(buf[0]===0xff&&buf[1]===0xd8){const s=jpegSize(buf);return {mime:'image/jpeg',ext:'jpg',...s};}
  if(buf.subarray(0,4).toString('ascii')==='RIFF'&&buf.subarray(8,12).toString('ascii')==='WEBP'){const s=webpSize(buf);return {mime:'image/webp',ext:'webp',...s};}
  fail('IMAGE_TYPE_UNSUPPORTED');
}

function svgFor(buf,info){
  const encoded=buf.toString('base64');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}" viewBox="0 0 ${info.width} ${info.height}"><image width="${info.width}" height="${info.height}" href="data:${info.mime};base64,${encoded}" preserveAspectRatio="xMidYMid meet"/></svg>\n`;
}

export async function downloadImage(url,{fetchImpl=globalThis.fetch,maxBytes=12*1024*1024}={}){
  if(!/^https:\/\//i.test(String(url??'')))fail('PRODUCT_IMAGE_URL_INVALID');if(typeof fetchImpl!=='function')fail('FETCH_UNAVAILABLE');
  const res=await fetchImpl(url,{redirect:'follow'});if(!res?.ok)fail(`PRODUCT_IMAGE_HTTP_${res?.status??'ERROR'}`);
  const buf=Buffer.from(await res.arrayBuffer());if(buf.length>maxBytes)fail('PRODUCT_IMAGE_TOO_LARGE');const info=sniffImage(buf);return {buf,info};
}

export function productImageUrls(product){
  const urls=[];if(product?.master_image_url)urls.push(product.master_image_url);
  for(const b of product?.product_description??[])if(b?.type==='image'&&b?.url)urls.push(b.url);
  return [...new Set(urls.map(String).filter(Boolean))];
}


export function buildVisualIntentProductAssets(media){
  if(media?.format!=='zodiac-product-media@1'||media.provider!=='kalodata'||!media.product_id||!Array.isArray(media.assets)||!media.assets.length)fail('PRODUCT_MEDIA_MANIFEST_INVALID');
  return Object.fromEntries(media.assets.map(a=>{
    if(!a?.id||!a.path||a.transport_kind!=='svg'||!/^assets\/product\/.+\.svg$/u.test(a.path)||!['image/png','image/jpeg','image/webp'].includes(a.source_mime)||!/^[a-f0-9]{64}$/u.test(String(a.source_sha256??'')))fail('PRODUCT_MEDIA_ASSET_INVALID');
    return [a.id,{path:a.path,category:'story_object',commerce:{format:'zodiac-product-media-ref@1',provider:'kalodata',product_id:String(media.product_id),role:a.role,transport:'svg_raster_embed',source_mime:a.source_mime,source_width:a.source_width,source_height:a.source_height,source_sha256:a.source_sha256}}];
  }));
}

export async function localizeProductMedia(workspace,product,{fetchImpl=globalThis.fetch,maxImages=3}={}){
  const id=safeId(product?.product_id);if(!id)fail('PRODUCT_ID_REQUIRED');
  const urls=productImageUrls(product).slice(0,maxImages);if(!urls.length)fail('PRODUCT_IMAGE_REQUIRED');
  const sourceDir=path.join(workspace,'.authoring','commerce','media-source'),assetDir=path.join(workspace,'assets','product');
  await mkdir(sourceDir,{recursive:true});await mkdir(assetDir,{recursive:true});
  const assets=[];
  for(let i=0;i<urls.length;i++){
    const role=i===0?'hero':`detail-${String(i).padStart(2,'0')}`;const {buf,info}=await downloadImage(urls[i],{fetchImpl});
    const sourceSha=sha256(buf),sourceRel=path.posix.join('.authoring/commerce/media-source',`${id}-${role}.${info.ext}`),assetRel=path.posix.join('assets/product',`${id}-${role}.svg`);
    await writeFile(path.join(workspace,sourceRel),buf);const svg=svgFor(buf,info);const svgBuf=Buffer.from(svg,'utf8');await writeFile(path.join(workspace,assetRel),svgBuf);
    assets.push({id:`product.${id}.${role}`,role,path:assetRel,transport_kind:'svg',source_path:sourceRel,source_url:urls[i],source_mime:info.mime,source_width:info.width,source_height:info.height,source_sha256:sourceSha,sha256:sha256(svgBuf),recommended_category:i===0?'story_object':'story_object'});
  }
  const manifest={format:'zodiac-product-media@1',provider:'kalodata',product_id:String(product.product_id),assets};
  const manifestPath=path.join(workspace,'.authoring','commerce','product-media.json');await mkdir(path.dirname(manifestPath),{recursive:true});await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');return manifest;
}

export async function localizeWorkspaceProductMedia(workspace,{productPath=null,fetchImpl=globalThis.fetch,maxImages=3}={}){
  const detailPath=productPath??path.join(workspace,'.authoring','commerce','product-detail.json');
  const product=JSON.parse(await readFile(detailPath,'utf8'));
  return localizeProductMedia(workspace,product,{fetchImpl,maxImages});
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const workspace=process.argv[2],productJson=process.argv[3]??null;if(!workspace){console.error('Usage: node product-media-adapter.mjs <workspace> [product-detail.json]');process.exit(2);}try{const r=await localizeWorkspaceProductMedia(path.resolve(workspace),{productPath:productJson?path.resolve(productJson):null});console.log(`PRODUCT_MEDIA_PASS product=${r.product_id} assets=${r.assets.length}`);}catch(e){console.error('PRODUCT_MEDIA_BLOCKED '+e.message);process.exit(1);}}
