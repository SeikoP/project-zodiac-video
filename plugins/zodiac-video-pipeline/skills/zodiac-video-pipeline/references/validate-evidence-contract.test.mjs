import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const validator=path.join(here,'validate-evidence-contract.mjs');
const good=()=>({
  format:'zodiac-evidence-ledger@1',
  central_claim:'Scorpio is selective about what receives visible attention.',
  entries:[
    {id:'E1',source:'Astrology source A',url:'https://a.example/scorpio',supported_interpretation:'Selective attention and privacy.',confidence:'medium'},
    {id:'E2',source:'Astrology source B',url:'https://b.example/scorpio',supported_interpretation:'Reserved outward expression with close observation.',confidence:'medium'}
  ]
});
async function run(mut){const d=await mkdtemp(path.join(os.tmpdir(),'z-evidence-'));try{await mkdir(path.join(d,'.authoring'));const x=good();mut?.(x);await writeFile(path.join(d,'.authoring/evidence-ledger.json'),JSON.stringify(x));await writeFile(path.join(d,'.authoring/evidence-summary.md'),'Two independent sources support the bounded central claim.');return spawnSync(process.execPath,[validator,d],{encoding:'utf8'});}finally{await rm(d,{recursive:true,force:true});}}
test('two independent bounded evidence entries pass',async()=>{const r=await run();assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/EVIDENCE_CONTRACT_PASS/);});
test('one source cannot satisfy source coverage',async()=>{const r=await run(x=>x.entries=x.entries.slice(0,1));assert.notEqual(r.status,0);assert.match(r.stderr,/at least two independent useful sources/i);});
test('duplicate domains are not independent coverage',async()=>{const r=await run(x=>x.entries[1].url='https://a.example/other');assert.notEqual(r.status,0);assert.match(r.stderr,/independent source identities/i);});
test('entry without supported interpretation is rejected',async()=>{const r=await run(x=>delete x.entries[0].supported_interpretation);assert.notEqual(r.status,0);assert.match(r.stderr,/supported interpretation/i);});
test('empty evidence summary is rejected',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'z-evidence-empty-'));try{await mkdir(path.join(d,'.authoring'));await writeFile(path.join(d,'.authoring/evidence-ledger.json'),JSON.stringify(good()));await writeFile(path.join(d,'.authoring/evidence-summary.md'),'   ');const r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/evidence-summary/i);}finally{await rm(d,{recursive:true,force:true});}});
