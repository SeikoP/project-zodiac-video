import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildFingerprint, GARDEN_BUILD_FILES, runtimeSourceChanged, buildRuntimeFiles } from './build-id.mjs';

test('build fingerprint changes when camera, hearts, or browser view code changes',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garden-build-'));
 try{
  for(const file of GARDEN_BUILD_FILES){const full=path.join(dir,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,'v1');}
  const old=buildFingerprint(dir);
  for(const modified of ['garden/camera.mjs','garden/hearts.mjs','public/garden/view.js','public/garden/control.js','public/garden/control.html']){
   const file=path.join(dir,modified);fs.writeFileSync(file,'v2');
   assert.notEqual(buildFingerprint(dir),old,`${modified} must change build ID`);
   fs.writeFileSync(file,'v1');
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('runtime source detector catches edits after server startup without hashing on every status request',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garden-runtime-'));
 try{
  for(const file of GARDEN_BUILD_FILES){const full=path.join(dir,file);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,'v1');}
  const baseline=Date.now()+2000;
  assert.equal(runtimeSourceChanged(dir,baseline),false);
  const changed=path.join(dir,'garden/camera.mjs');
  fs.utimesSync(changed,new Date(baseline+3000),new Date(baseline+3000));
  assert.equal(runtimeSourceChanged(dir,baseline),true);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('fingerprint follows newly imported local modules instead of silently missing them',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'garden-import-'));
 try{
  for(const name of GARDEN_BUILD_FILES){const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'v1');}
  const extra=path.join(dir,'garden','garden-helper.mjs');fs.writeFileSync(extra,'export const value=1;');
  fs.writeFileSync(path.join(dir,'garden','camera.mjs'),"import './garden-helper.mjs';");
  assert.ok(buildRuntimeFiles(dir).includes('garden/garden-helper.mjs'));
  const before=buildFingerprint(dir);fs.writeFileSync(extra,'export const value=2;');
  assert.notEqual(buildFingerprint(dir),before);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});