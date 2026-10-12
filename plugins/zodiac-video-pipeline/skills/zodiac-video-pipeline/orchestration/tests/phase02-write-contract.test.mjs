import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url),'utf8');
for(const [id,script] of [['environment','compile-environment.mjs'],['scene_direction','compile-scene-direction.mjs']]){
 test(id+' must invoke compiler with --write before checking receipt',()=>{
  const pattern=new RegExp(String.raw`\{id:'${id}',src:'[^']*${script.replace('.','\.')}',args:\[workspace,'--write'\]`);
  assert.match(src,pattern);
 });
}
