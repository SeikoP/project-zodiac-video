#!/usr/bin/env node
import {mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectWorkspace,assertJobRootContract,buildZip,validateZipFile} from './zip-core.mjs';
const fail=m=>{throw new Error('ZIP_EXPORT_INVALID: '+m);};
const ascii=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,m=>m==='đ'?'d':'D').toLowerCase();
const signSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'');
const conceptSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
export function canonicalPackageZipName({sign,concept,patchVersion}={}){
  const s=signSlug(sign),c=conceptSlug(concept);
  if(!s)fail('sign is required for canonical package naming');
  if(!c)fail('concept is required for canonical package naming');
  let suffix='';
  if(patchVersion!==undefined&&patchVersion!==null&&String(patchVersion).trim()!==''){
    const v=String(patchVersion).trim();
    if(!/^\d+(?:\.\d+)*$/.test(v))fail('patch version must be dotted numeric, for example 1.1');
    suffix=`-v${v}`;
  }
  return `zodiac-${s}-${c}${suffix}.zip`;
}
export async function exportZodiacJob(root,zipPath){
  const absRoot=path.resolve(root),absZip=path.resolve(zipPath);
  if(absZip===absRoot||absZip.startsWith(absRoot+path.sep))fail('output ZIP must be outside package root');
  const entries=await collectWorkspace(absRoot);
  assertJobRootContract(entries.map(x=>x.rel));
  const zip=buildZip(entries);
  await mkdir(path.dirname(absZip),{recursive:true});
  await writeFile(absZip,zip);
  try{return await validateZipFile(absZip,absRoot);}catch(e){await rm(absZip,{force:true});throw e;}
}
const arg=name=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:undefined;};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  const root=process.argv[2],target=process.argv[3],sign=arg('--sign'),concept=arg('--concept'),patchVersion=arg('--patch-version');
  if(!root||!target||sign===undefined||concept===undefined){
    console.error('Usage: node export-zodiac-job.mjs <package-root> <output-dir-or-canonical-zip> --sign <sign> --concept <concept> [--patch-version <version>]');
    process.exit(2);
  }
  try{
    const filename=canonicalPackageZipName({sign,concept,patchVersion});
    const zip=path.extname(target).toLowerCase()==='.zip'?target:path.join(target,filename);
    if(path.basename(zip)!==filename)fail(`output ZIP filename must be ${filename}`);
    const r=await exportZodiacJob(root,zip);
    console.log(`ZIP_EXPORT_PASS: name=${path.basename(zip)} entries=${r.entries} bytes=${r.bytes}`);
    console.log('LOCAL_RUNNER_IMPORT_READY');
  }catch(e){console.error(e.message);process.exit(1);}
}
