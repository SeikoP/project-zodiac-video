import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildZip} from '../../phases/phase03/zip-core-v2.mjs';
import {publishReadyZip,runLocalPhase03} from '../../phases/local/run-local-phase03.mjs';

const exists=p=>access(p).then(()=>true).catch(()=>false);
function minimalJob(){
 return buildZip([
  {rel:'package-manifest.json',data:Buffer.from('{}')},
  {rel:'production.ir.json',data:Buffer.from('{}')},
  {rel:'design-token.json',data:Buffer.from('{}')},
  {rel:'narration.txt',data:Buffer.from('narration')},
  {rel:'publish/publish.json',data:Buffer.from('{}')},
  {rel:'publish/publish-copy.txt',data:Buffer.from('copy')},
  {rel:'assets/a.svg',data:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')},
 ]);
}

test('validated staged Job5 is atomically published into ready',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-ready-'));try{
  const staged=path.join(root,'staging','zodiac-songtu-demo.zip'),ready=path.join(root,'ready');await mkdir(path.dirname(staged),{recursive:true});await writeFile(staged,minimalJob());
  const r=await publishReadyZip(staged,ready);const target=path.join(ready,path.basename(staged));
  assert.equal(r.status,'READY_PUBLISHED');assert.equal(r.zip,target);assert.equal(await exists(target),true);assert.equal(await exists(staged),false);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('ready collision is rejected without overwriting existing archive',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-ready-'));try{
  const staged=path.join(root,'staging','same.zip'),ready=path.join(root,'ready'),target=path.join(ready,'same.zip');await mkdir(path.dirname(staged),{recursive:true});await mkdir(ready);await writeFile(staged,minimalJob());await writeFile(target,Buffer.from('existing'));
  await assert.rejects(()=>publishReadyZip(staged,ready),/LOCAL_READY_ALREADY_EXISTS/);
  assert.equal((await readFile(target)).toString(),'existing');assert.equal(await exists(staged),true);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('invalid staged archive never becomes visible in ready',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-ready-'));try{
  const staged=path.join(root,'staging','bad.zip'),ready=path.join(root,'ready');await mkdir(path.dirname(staged),{recursive:true});await writeFile(staged,Buffer.from('not zip'));
  await assert.rejects(()=>publishReadyZip(staged,ready),/ZIP_V2_QC_INVALID/);
  assert.deepEqual(await (await import('node:fs/promises')).readdir(ready).catch(()=>[]),[]);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('local Phase3 wrapper lets canonical producer own the atomic ready publication path',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'z-ready-'));try{
  const source=path.join(root,'processing','run','workspace'),ready=path.join(root,'ready');await mkdir(source,{recursive:true});
  let seenOutput=null;
  const producer=async({outputDir})=>{seenOutput=path.resolve(outputDir);await mkdir(outputDir,{recursive:true});const zip=path.join(outputDir,'zodiac-songtu-demo.zip');await writeFile(zip,minimalJob());return {ok:true,release_level:'PRODUCTION_READY_ZIP',zip,state_commit:{status:'COMMITTED',zip}};};
  const r=await runLocalPhase03({queueRoot:root,sourceRoot:source,sign:'Song Tử',concept:'Demo',producer});
  assert.equal(seenOutput,ready);assert.equal(r.status,'READY_PUBLISHED');assert.equal(r.zip,path.join(ready,'zodiac-songtu-demo.zip'));assert.equal(r.producer_result.state_commit.zip,r.zip);assert.equal(await exists(r.zip),true);
 }finally{await rm(root,{recursive:true,force:true})}
});
