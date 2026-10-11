import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,copyFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {spawnSync} from 'node:child_process';import test from 'node:test';import {fileURLToPath} from 'node:url';
import {parseStyleToken} from '../compile-job-v5.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));const skillRoot=path.resolve(here,'../..');
const validator=path.join(skillRoot,'references/asset-library-v4/validation/validate-production-style.mjs');
const exemplar=path.join(skillRoot,'references/asset-library-v4/props/phone.svg');
const design=await readFile(path.join(skillRoot,'references/design.md'),'utf8');
async function run(asset={style_id:'zodiac-paper-doodle-meme-v4',lineage:{mode:'derived_copy',source_library:'zodiac-visual-grammar-v4',source_master:'phone'},category:'prop'}){const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-v4-style-'));await mkdir(path.join(d,'assets'));await copyFile(exemplar,path.join(d,'assets/phone.svg'));asset.path='assets/phone.svg';await writeFile(path.join(d,'production.json'),JSON.stringify({version:'2.0',assets:{PHONE:asset},scenes:[]}));await writeFile(path.join(d,'design.md'),design);const r=spawnSync(process.execPath,[validator,d],{encoding:'utf8'});await rm(d,{recursive:true,force:true});return r;}
test('v4 production asset passes canonical style gate',async()=>{const r=await run();assert.equal(r.status,0,r.stderr);});
test('v3 style id is rejected from new production',async()=>{const r=await run({style_id:'zodiac-paper-doodle-meme-v3',lineage:{mode:'derived_copy',source_master:'phone'},category:'prop'});assert.notEqual(r.status,0);assert.match(r.stderr,/STYLE_TOKEN_V4_INVALID/);});
test('legacy v3 direct-copy lineage is rejected even if style id is relabeled v4',async()=>{const r=await run({style_id:'zodiac-paper-doodle-meme-v4',lineage:{mode:'direct_copy',source_library:'zodiac-paper-doodle-asset-library-v3',source_master:'phone'},category:'prop'});assert.notEqual(r.status,0);assert.match(r.stderr,/V3_DIRECT_COPY_FORBIDDEN/);});
test('canonical design.md uses the same v4 token as handoff and assets',async()=>{const markdown=await (await import('node:fs/promises')).readFile(path.join(skillRoot,'references/design.md'),'utf8');const parsed=parseStyleToken(markdown);assert.equal(parsed.id,'zodiac-paper-doodle-meme-v4');assert.equal(parsed.version,'4.0');assert.equal(parsed.handmade_profile,'human-stroke-v2');assert.equal(parsed.hard_style_lock,true);});
