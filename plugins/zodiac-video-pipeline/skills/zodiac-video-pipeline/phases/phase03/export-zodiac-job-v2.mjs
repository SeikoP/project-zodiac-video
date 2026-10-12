#!/usr/bin/env node
import {assertEpisodeIdentity} from '../../features/episode/episode-handoff.mjs';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectWorkspace,assertJobRootContract,buildZip,validateZipFile} from './zip-core-v2.mjs';
import {validateJob5Workspace} from './validate-job5-import-gate.mjs';
import {lintSemanticAnimation} from '../../features/visual-composition/validate-animation-semantics.mjs';
import {validateHandoffV2} from './validate-handoff-workspace-v2.mjs';
import {validatePhase03Release} from './phase03-production-release.mjs';
const fail=m=>{throw new Error('ZIP_V2_EXPORT_INVALID: '+m);};
const ascii=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[đĐ]/g,m=>m==='đ'?'d':'D').toLowerCase();
const signSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'');
const conceptSlug=value=>ascii(value).replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').replace(/-{2,}/g,'-');
export function canonicalPackageZipName({sign,concept,episodeIdentity,patchVersion}={}){
 const identity=episodeIdentity?assertEpisodeIdentity(episodeIdentity):null;const s=signSlug(sign),c=conceptSlug(concept);if(!identity&&(!s||!c))fail('sign/concept required');let suffix='';
 if(patchVersion!==undefined&&patchVersion!==null&&String(patchVersion).trim()!==''){
  const v=String(patchVersion).trim();if(!/^\d+(?:\.\d+)*$/.test(v))fail('patch version must be dotted numeric');suffix=`-v${v}`;
 }
 return`${identity?.package_slug??`zodiac-${s}-${c}`}${suffix}.zip`;
}
export async function exportZodiacJobV2(root,zipPath,{sourceRoot,reviewLock}={}){
 const absRoot=path.resolve(root),absZip=path.resolve(zipPath);
 if(absZip===absRoot||absZip.startsWith(absRoot+path.sep))fail('output ZIP must be outside package root');
 // Required before any filesystem write, including destination directory creation.
 if(!sourceRoot||!reviewLock)fail('APPROVAL_EVIDENCE_REQUIRED: approved source and review-lock must be supplied');
 // Export must never bypass the complete canonical Job@5 workspace gate.
 await validateHandoffV2(absRoot);
 await validatePhase03Release(absRoot,{sourceRoot,reviewLock});
 const entries=await collectWorkspace(absRoot);
 assertJobRootContract(entries.map(x=>x.rel));
 // Producer and runner must agree BEFORE ZIP emission, not during local TTS.
 await validateJob5Workspace(absRoot);
 const ir=JSON.parse(await readFile(path.join(absRoot,'production.ir.json'),'utf8'));
 const semanticErrors=lintSemanticAnimation(ir).filter(x=>x.severity==='P1');
 if(semanticErrors.length)fail('semantic P1 must be cleared before export: '+JSON.stringify(semanticErrors.slice(0,10)));
 await mkdir(path.dirname(absZip),{recursive:true});await writeFile(absZip,buildZip(entries));
 try{return await validateZipFile(absZip,absRoot);}catch(e){await rm(absZip,{force:true});throw e;}
}
const arg=n=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined;};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const root=process.argv[2],target=process.argv[3],sign=arg('--sign'),concept=arg('--concept'),patchVersion=arg('--patch-version'),sourceRoot=arg('--source-workspace'),reviewLock=arg('--review-lock');
 if(!root||!target||sign===undefined||concept===undefined){console.error('Usage: node export-zodiac-job-v2.mjs <package-root> <output-dir-or-zip> --sign <sign> --concept <concept> [--patch-version <version>]');process.exit(2);}
 try{
  const filename=canonicalPackageZipName({sign,concept,episodeIdentity,patchVersion}),zip=path.extname(target).toLowerCase()==='.zip'?target:path.join(target,filename);
  if(path.basename(zip)!==filename)fail(`output ZIP filename must be ${filename}`);
  const r=await exportZodiacJobV2(root,zip,{sourceRoot,reviewLock});console.log(`ZIP_V2_EXPORT_PASS: name=${path.basename(zip)} entries=${r.entries} bytes=${r.bytes}`);console.log('LOCAL_RUNNER_IMPORT_READY');
 }catch(e){console.error(e.message);process.exit(1);}
}
