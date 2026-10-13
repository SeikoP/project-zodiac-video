import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {compileSceneSetWorkspace} from '../../references/asset-library-v4/scene-set/compile-scene-set.mjs';
import {validateSceneSetIdentityWorkspace} from '../../features/scene-set/validate-scene-set-identity.mjs';
test('compiled supporting backdrop binds exact selected identity and rejects changed SVG bytes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'zodiac-backdrop-integrity-'));
 try{
  await writeFile(path.join(root,'production.json'),JSON.stringify({version:'2.0',assets:{},scenes:[{id:'s',environment:{scene_set_id:'scene-set-classroom'},entities:[],events:[]}]}));
  await compileSceneSetWorkspace(root);
  assert.equal((await validateSceneSetIdentityWorkspace(root)).status,'PASS');
  const p=JSON.parse(await readFile(path.join(root,'production.json'))),asset=p.assets[p.scenes[0].environment.scene_set.asset];
  const bytes=await readFile(path.join(root,asset.path));await writeFile(path.join(root,asset.path),Buffer.concat([bytes,Buffer.from(' ')]));
  assert.ok((await validateSceneSetIdentityWorkspace(root)).issues.some(x=>x.code==='SCENE_SET_COMPILED_HASH_DRIFT'));
  await writeFile(path.join(root,asset.path),bytes);asset.lineage.source_master='scene-set-home';await writeFile(path.join(root,'production.json'),JSON.stringify(p));
  assert.ok((await validateSceneSetIdentityWorkspace(root)).issues.some(x=>x.code==='SCENE_SET_SOURCE_IDENTITY_DRIFT'));
 }finally{await rm(root,{recursive:true,force:true});}
});
