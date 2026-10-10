#!/usr/bin/env node
import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=m=>{throw new Error('V4_MEME_TEMPLATE_INVALID: '+m);};
const exists=p=>access(p).then(()=>true).catch(()=>false);
export async function validateMemeTemplates(){
 const index=JSON.parse(await readFile(path.join(here,'templates/index.json'),'utf8'));
 const adapters=JSON.parse(await readFile(path.join(here,'index.json'),'utf8'));
 if(index.format!=='zodiac-v4-meme-templates@1'||index.policy?.semantic_contracts_only!==true||index.policy?.legacy_svg_artwork_copied!==false)fail('template ownership policy');
 const templates=new Map();
 for(const row of index.templates??[]){
  if(!row.id||templates.has(row.id))fail('duplicate/missing template id '+row.id);
  const file=path.resolve(here,row.path);
  if(!file.startsWith(path.join(here,'templates')+path.sep))fail(row.id+' escapes templates directory');
  if(!(await exists(file)))fail(row.id+' missing '+row.path);
  const data=JSON.parse(await readFile(file,'utf8'));
  if(data.id!==row.id||data.format!=='zodiac-meme-reference-bundle@1')fail(row.id+' semantic contract identity');
  if(data.reference_svg)fail(row.id+' may not depend on a legacy reference SVG');
  templates.set(row.id,row);
 }
 const ids=new Set();
 for(const adapter of adapters.compositions??[]){
  if(!adapter.id||ids.has(adapter.id))fail('duplicate/missing adapter id '+adapter.id);
  ids.add(adapter.id);
  const rel=adapter.source?.replace(/^\.\//u,'');
  const row=index.templates.find(x=>x.path===rel);
  if(!row||row.id!==adapter.id)fail(adapter.id+' missing local semantic template mapping');
 }
 if(templates.size!==ids.size||templates.size!==11)fail(`expected 11 matched templates/adapters; got templates=${templates.size} adapters=${ids.size}`);
 return {templates:templates.size,adapters:ids.size};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){const r=await validateMemeTemplates();console.log(`V4_MEME_TEMPLATES_PASS: templates=${r.templates} adapters=${r.adapters}`);}
