import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const compiler=path.join(here,'../compile-ending-payoff.mjs');
const validator=path.join(here,'../validate-ending-payoff.mjs');
const base=hold=>({version:'2.0',scenes:[{id:'S01',voice:'Và tin nhắn đó vẫn chưa gửi.',entities:[{id:'hero',kind:'character',initial_state:'idle',states:{idle:{},land:{}}}],events:[{id:'E1',target:'hero',state_before:'idle',state_after:'land',trigger:{source:'voice_anchor',text:'vẫn chưa gửi'},...(hold!==undefined?{performance:{intent:'final landing',hold_frames:hold}}:{})}]}]});
async function run(p){const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-ending-'));const f=path.join(d,'production.json');await writeFile(f,JSON.stringify(p));const c=spawnSync(process.execPath,[compiler,f,'--write'],{encoding:'utf8'});let out=null;try{out=JSON.parse(await readFile(f,'utf8'));}catch{}const v=spawnSync(process.execPath,[validator,f],{encoding:'utf8'});await rm(d,{recursive:true,force:true});return {c,v,out};}

test('ending compiler adds a deterministic 24-frame final landing hold',async()=>{const {c,v,out}=await run(base());assert.equal(c.status,0,c.stderr);assert.equal(out.scenes[0].events[0].performance.hold_frames,24);assert.equal(v.status,0,v.stderr);});
test('valid authored 24-30 frame final hold is preserved',async()=>{const {out}=await run(base(30));assert.equal(out.scenes[0].events[0].performance.hold_frames,30);});
test('out-of-range hold is normalized to 24 frames',async()=>{const {out}=await run(base(5));assert.equal(out.scenes[0].events[0].performance.hold_frames,24);});
test('validator rejects a package whose last meaningful event lost the landing hold',async()=>{const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-ending-bad-'));const f=path.join(d,'production.json');await writeFile(f,JSON.stringify(base()));const r=spawnSync(process.execPath,[validator,f],{encoding:'utf8'});await rm(d,{recursive:true,force:true});assert.notEqual(r.status,0);assert.match(r.stderr,/FINAL_LANDING_HOLD_REQUIRED/);});
