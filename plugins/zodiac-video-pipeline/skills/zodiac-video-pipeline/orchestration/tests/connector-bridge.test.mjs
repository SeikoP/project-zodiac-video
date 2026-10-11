import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../build-source-snapshot.mjs');
const id='plugins_6ac25a87d8d481919c5ef654596144e3', manifest=JSON.stringify({name:'zodiac-video-pipeline',version:'2.2.6'});const bytes=Buffer.byteLength(manifest);
const mk=(release='abc',src=manifest)=>({result:{plugin:{plugin_id:id,version:'2.2.6',current_release_id:release},files:[{path:'plugin.json',size_bytes:bytes}],contents:{'plugin.json':src}}});
async function run(pages,flags=[]){const dir=await mkdtemp(path.join(os.tmpdir(),'bridge-'));const inp=path.join(dir,'p.json'),out=path.join(dir,'out.json');await writeFile(inp,JSON.stringify({pages}));const r=spawnSync(process.execPath,[script,'--input',inp,'--output',out,...flags],{encoding:'utf8'});return {r,out};}
test('converts exact connector pages and validates SHA256',async()=>{const {r,out}=await run([mk()],['--require-complete']);assert.equal(r.status,0,r.stderr);const snap=JSON.parse(await readFile(out,'utf8'));assert.equal(Buffer.from(snap.files[0].base64,'base64').toString(),manifest);assert.equal(snap.files.length,1)});
test('rejects a mixed plugin release',async()=>{const {r}=await run([mk('abc'),mk('def')]);assert.notEqual(r.status,0);assert.match(r.stderr,/mixed release/)});
test('rejects truncated or mutated bytes',async()=>{const {r}=await run([mk('abc',manifest+' ')]);assert.notEqual(r.status,0);assert.match(r.stderr,/byte size mismatch/)});
test('rejects incomplete inventory',async()=>{const p=mk();p.result.files.push({path:'skills/zodiac-video-pipeline/SKILL.md',size_bytes:2});const {r}=await run([p],['--require-complete']);assert.notEqual(r.status,0);assert.match(r.stderr,/source missing/)});
