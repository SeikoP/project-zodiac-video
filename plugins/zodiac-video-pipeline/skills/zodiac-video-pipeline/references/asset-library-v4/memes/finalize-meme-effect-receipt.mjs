#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildMemeEffectReceipt} from './compile-meme-effects.mjs';
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
export async function finalizeMemeEffectReceipt(root){const packageRoot=path.resolve(root),production=JSON.parse(await readFile(path.join(packageRoot,'production.json'),'utf8')),receipt=buildMemeEffectReceipt(production),file=path.join(packageRoot,'.authoring/meme-effect-compile-receipt.json');await mkdir(path.dirname(file),{recursive:true});await writeFile(file,JSON.stringify(receipt,null,2)+'\n');return receipt;}
if(direct){const root=process.argv[2];if(!root){console.error('Usage: node finalize-meme-effect-receipt.mjs <package-root>');process.exit(2);}const receipt=await finalizeMemeEffectReceipt(root);console.log(`MEME_EFFECT_RECEIPT_PASS: effects=${receipt.effects.length}`);}
