import test from 'node:test';
import assert from 'node:assert/strict';
import {access,readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const orchestration=path.resolve(here,'..');
const skill=path.resolve(orchestration,'..');
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const thin=/^export \* from ['"]([^'"]+)['"];\n(?:import \{forwardCliIfMain\} from '\.\/forward-cli\.mjs';\nforwardCliIfMain\([^\n]+\);\n)?$/u;

test('every thin orchestration wrapper is classified with a real canonical owner',async()=>{
 const manifest=JSON.parse(await readFile(path.join(orchestration,'compatibility-surface.json'),'utf8'));
 assert.equal(manifest.format,'zodiac-orchestration-compatibility-surface@1');
 const wrappers={};
 for(const e of await readdir(orchestration,{withFileTypes:true})){
  if(!e.isFile()||!e.name.endsWith('.mjs'))continue;
  const source=await readFile(path.join(orchestration,e.name),'utf8'),m=thin.exec(source);
  if(m)wrappers[e.name]={owner_import:m[1],cli:source.includes('forwardCliIfMain')};
 }
 assert.deepEqual(Object.keys(manifest.wrappers).sort(),Object.keys(wrappers).sort());
 for(const [name,row] of Object.entries(manifest.wrappers)){
  assert.ok(['retained_module_compat','retained_cli_compat','repo_consumer'].includes(row.classification),name+' classification');
  assert.ok(typeof row.owner==='string'&&row.owner.length>0,name+' owner');
  assert.equal(await exists(path.join(skill,row.owner)),true,name+' owner missing');
  assert.equal(row.fresh_import_allowed,false,name+' must not be a fresh import target');
  if(row.classification!=='repo_consumer')assert.ok(row.retention_reason?.length>=12,name+' needs retention reason');
  if(row.classification==='retained_cli_compat')assert.equal(wrappers[name].cli,true,name+' is not a CLI wrapper');
 }
});
