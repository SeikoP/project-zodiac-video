import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,mkdir,cp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {checkReleaseConsistency} from '../validate-release-consistency.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const file=['plugin.json','.codex-plugin/plugin.json','skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json'];
const current=JSON.parse(await readFile(path.join(root,file[0]),'utf8')).version;
const stable=current.split('-')[0];
const next=stable.replace(/\d+$/,x=>String(Number(x)+1));
async function fixture(fn){const dir=await mkdtemp(path.join(tmpdir(),'zodiac-release-parity-'));try{for(const p of file){await mkdir(path.dirname(path.join(dir,p)),{recursive:true});await cp(path.join(root,p),path.join(dir,p));}return await fn(dir);}finally{await rm(dir,{recursive:true,force:true});}}
const update=async(dir,file,key,val)=>{const p=path.join(dir,file);const v=JSON.parse(await readFile(p,'utf8'));v[key]=val;await writeFile(p,JSON.stringify(v));};
test('real source release manifests and template match',async()=>{assert.equal((await checkReleaseConsistency(root)).status,'PASS');});
test('block stale state template after orchestration patch version bump',async()=>fixture(async dir=>{await update(dir,file[2],'plugin_version','2.2.18');const r=await checkReleaseConsistency(dir);assert.equal(r.status,'BLOCKED');assert.ok(r.problems.includes('RELEASE_VERSION_MISMATCH'));}));
test('block stale alternate plugin manifest',async()=>fixture(async dir=>{await update(dir,file[1],'version','2.2.19');assert.equal((await checkReleaseConsistency(dir)).status,'BLOCKED');}));
test('block damaged release manifest',async()=>fixture(async dir=>{await update(dir,file[0],'version','not-a-version');assert.ok((await checkReleaseConsistency(dir)).problems.some(x=>x.startsWith('INVALID_RELEASE_VERSION')));}));
test('explicit patch preparation synchronizes all three versions',async()=>fixture(async dir=>{await update(dir,file[2],'plugin_version','2.2.18');const run=spawnSync(process.execPath,[path.join(root,'skills/zodiac-video-pipeline/orchestration/prepare-release.mjs'),next,dir],{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.equal((await checkReleaseConsistency(dir)).status,'PASS');const v=JSON.parse(await readFile(path.join(dir,file[2]),'utf8'));assert.equal(v.plugin_version,next);}));
test('reject same-version preparation to avoid automatic patch bump',async()=>fixture(async dir=>{
 for(const p of file)await update(dir,p,p.includes('pipeline-state.template')?'plugin_version':'version',stable);
 const run=spawnSync(process.execPath,[path.join(root,'skills/zodiac-video-pipeline/orchestration/prepare-release.mjs'),stable,dir],{encoding:'utf8'});
 assert.notEqual(run.status,0);assert.match(run.stderr,/must be higher/);
}));
test('reject older-version release preparation',async()=>fixture(async dir=>{const run=spawnSync(process.execPath,[path.join(root,'skills/zodiac-video-pipeline/orchestration/prepare-release.mjs'),stable.replace(/\d+$/,x=>String(Number(x)-1)),dir],{encoding:'utf8'});assert.notEqual(run.status,0);}));

test('state machine fixtures derive plugin_version from installed manifest',async()=>{
  const fixtureText=await readFile(path.join(root,'skills/zodiac-video-pipeline/orchestration/tests/state-machine.test.mjs'),'utf8');
  assert.match(fixtureText,/plugin_version:currentPluginVersion/);
  assert.match(fixtureText,/currentPluginVersion=JSON\.parse\(await readFile/);
  assert.doesNotMatch(fixtureText,/plugin_version:'2\.1\.6'/);
});
