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
 const wrappers=[];
 for(const e of await readdir(orchestration,{withFileTypes:true})){
  if(!e.isFile()||!e.name.endsWith('.mjs'))continue;
  const source=await readFile(path.join(orchestration,e.name),'utf8'),m=thin.exec(source);
  if(m)wrappers.push({name:e.name,owner_import:m[1],cli:source.includes('forwardCliIfMain')});
 }
 assert.ok(wrappers.length>80,'expected the preserved pre-F3 compatibility surface');
 const cliRule=manifest.rules?.cli_forwarder,moduleRule=manifest.rules?.module_forwarder;
 for(const wrapper of wrappers){
  const rule=wrapper.cli?cliRule:moduleRule;
  assert.ok(rule,wrapper.name+' has no classification rule');
  assert.ok(['retained_module_compat','retained_cli_compat'].includes(rule.classification),wrapper.name+' classification');
  assert.equal(rule.fresh_import_allowed,false,wrapper.name+' must not be a fresh import target');
  assert.ok(rule.retention_reason?.length>=12,wrapper.name+' needs retention reason');
  const owner=path.resolve(orchestration,wrapper.owner_import);
  assert.equal(await exists(owner),true,wrapper.name+' owner missing '+owner);
  assert.equal(owner.startsWith(orchestration+path.sep),false,wrapper.name+' must forward to a canonical owner outside orchestration');
 }
});