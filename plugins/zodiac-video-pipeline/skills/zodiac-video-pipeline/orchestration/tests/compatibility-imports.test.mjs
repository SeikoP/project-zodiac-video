import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// compatibility-surface.json: wrappers in orchestration/ keep the pre-F3 CLI and module paths
// for external consumers, but fresh_import_allowed is false. Production code imports the
// canonical owner directly. Tests under orchestration/tests may still use wrappers on purpose.
const here=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(here,'..');
const skill=path.resolve(orchestration,'..');
const thin=/^export \* from ['"]([^'"]+)['"];\n(?:import \{forwardCliIfMain\} from '\.\/forward-cli\.mjs';\nforwardCliIfMain\([^\n]+\);\n)?$/u;
const spec=/(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|new URL\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g;

async function walk(dir){
 const out=[];
 for(const e of await readdir(dir,{withFileTypes:true})){
  if(e.name==='node_modules')continue;
  const p=path.join(dir,e.name);
  if(e.isDirectory())out.push(...await walk(p));else if(/\.(mjs|js)$/.test(e.name))out.push(p);
 }
 return out;
}

test('production code does not import orchestration compatibility wrappers',async()=>{
 const wrappers=new Set();
 for(const e of await readdir(orchestration,{withFileTypes:true})){
  if(e.isFile()&&e.name.endsWith('.mjs')&&thin.test(await readFile(path.join(orchestration,e.name),'utf8')))wrappers.add(e.name);
 }
 assert.ok(wrappers.size>80,'expected the preserved compatibility surface');
 const offenders=[];
 for(const file of await walk(skill)){
  const rel=path.relative(skill,file).split(path.sep).join('/');
  if(rel.startsWith('orchestration/tests/')||rel.endsWith('.test.mjs'))continue;
  if(path.dirname(file)===orchestration&&wrappers.has(path.basename(file)))continue;
  const source=await readFile(file,'utf8');
  for(const m of source.matchAll(spec)){
   const target=path.normalize(path.join(path.dirname(file),m[3]));
   if(path.dirname(target)===orchestration&&wrappers.has(path.basename(target)))offenders.push(rel+' -> '+m[3]);
  }
 }
 assert.deepEqual(offenders,[],'import the canonical owner instead of the wrapper (see compatibility-surface.json)');
});
