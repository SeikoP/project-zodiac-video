import test from 'node:test';import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('orchestration holds no forwarding wrappers; entrypoints live at their canonical owner',async()=>{
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(!e.isFile()||!e.name.endsWith('.mjs'))continue;
  const s=await readFile(path.join(dir,e.name),'utf8');
  assert.ok(!/^export \* from ['"]\.\.\//mu.test(s)&&!s.includes('forwardCliIfMain'),e.name+' is a forwarding wrapper');
 }
});
