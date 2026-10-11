import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
const api=await import('../benchmark-phase02-simplification.mjs').catch(()=>({}));
test('reference rejects SVG or transform or provenance drift',()=>{
 assert.equal(typeof api.verifyArchiveFrame,'function');
 const ref={asset_sha256:'x',transform:{x:0,y:0,width:1080,height:900},source_zip_sha256:'zip'};
 assert.equal(api.verifyArchiveFrame(ref,ref).status,'PASS');
 for(const key of ['asset_sha256','transform','source_zip_sha256']) assert.equal(api.verifyArchiveFrame(ref,{...ref,[key]:'changed'}).status,'BLOCKED');
});
test('baseline measures bytes and selected assets without creative claims',async()=>{
 assert.equal(typeof api.measurePhase02,'function');const root=await mkdtemp(path.join(os.tmpdir(),'z-baseline-'));await mkdir(path.join(root,'.authoring'));
 await writeFile(path.join(root,'.authoring/asset-plan.json'),'{}');await writeFile(path.join(root,'a.svg'),'<svg/>');
 await writeFile(path.join(root,'production.json'),JSON.stringify({assets:{a:{path:'a.svg'},b:{path:'a.svg'}},scenes:[{environment:{scene_set:{asset:'a'}},entities:[{states:{one:{asset:'a'},two:{asset:'a'}}}]}]}));
 const result=await api.measurePhase02(root,[{bytes:23}]);assert.equal(result.guidance_bytes,23);assert.equal(result.unique_svg_count,1);assert.equal(result.manual_source_files,2);assert.equal(result.frame_count,1);assert.equal(result.duplicate_state_count,1);assert.equal(result.creative_review,undefined);
});
