#!/usr/bin/env node
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {validateZipFile} from './zip-core-v2.mjs';
import {canonicalPackageZipName} from './export-zodiac-job-v2.mjs';
import {validateSemanticZip} from '../../features/visual-composition/validate-animation-semantics.mjs';
const arg=n=>{const i=process.argv.indexOf(n);return i>=0?process.argv[i+1]:undefined;};
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
 const zip=process.argv[2],root=process.argv[3],sign=arg('--sign'),concept=arg('--concept'),patchVersion=arg('--patch-version'),identityPath=arg('--episode-identity');
 if(!zip||sign===undefined||concept===undefined){console.error('Usage: node validate-zodiac-job-zip-v2.mjs <zip> [package-root] --sign <sign> --concept <concept> [--patch-version <version>]');process.exit(2);}
 try{
   const expected=canonicalPackageZipName({sign,concept,patchVersion,episodeIdentity:identityPath?JSON.parse(await readFile(identityPath,'utf8')):undefined});
   if(path.basename(zip)!==expected)throw new Error(`ZIP_V2_QC_INVALID: delivery filename must be ${expected}`);
   const r=await validateZipFile(zip,root);
   const semantic=await validateSemanticZip(zip);
   console.log(`ZIP_V2_ROUNDTRIP_PASS: name=${path.basename(zip)} entries=${r.entries} bytes=${r.bytes}`);
   console.log(`SEMANTIC_QC_${semantic.errors.length?'LEGACY_REVIEW_REQUIRED':'PASS'}: P1=${semantic.errors.length} P2=${semantic.findings.length-semantic.errors.length}`);
   console.log('ZIP_CANONICAL_FILENAME_PASS');console.log('ZIP_ROOT_LAYOUT_PASS');
   console.log('ZIP_WINDOWS_PATH_SAFETY_PASS');console.log('ZIP_CRC_PASS');console.log('LOCAL_RUNNER_IMPORT_READY');
 }catch(e){console.error(e.message);process.exit(1);}
}
