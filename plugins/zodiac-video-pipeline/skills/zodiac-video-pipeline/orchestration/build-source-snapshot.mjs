#!/usr/bin/env node
// Convert exact Plugin Creator get_plugin_files responses to the restore contract.
// The caller is responsible for staging connector response JSON onto disk.
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2);
const at=k=>{const i=args.indexOf(k);return i>=0?args[i+1]:null};
const input=at('--input'),out=at('--output');
if(!input||!out){console.error('Usage: node build-source-snapshot.mjs --input connector-pages.json --output snapshot.json [--require-complete]');process.exit(2)}
const fail=m=>{throw new Error('CONNECTOR_SNAPSHOT_INVALID: '+m)};
const raw=JSON.parse(await readFile(input,'utf8'));
const pages=Array.isArray(raw)?raw:raw.pages;
if(!Array.isArray(pages)||!pages.length)fail('expected pages array');
const inventory=new Map(),contents=new Map();let version,release;
for(const [n,p0] of pages.entries()){
 const p=p0.result??p0;
 if(!p?.plugin?.version||!p?.plugin?.current_release_id)fail('missing plugin metadata page '+n);
 if(p.plugin.plugin_id!=='plugins_6ac25a87d8d481919c5ef654596144e3')fail('unexpected plugin id');
 if(version&&version!==p.plugin.version||release&&release!==p.plugin.current_release_id)fail('mixed release');
 version=p.plugin.version;release=p.plugin.current_release_id;
 if(p.missing_paths?.length||p.size_limited_paths?.length)fail('unreadable paths in page '+n);
 for(const row of p.files??[]){
  if(typeof row.path!=='string'||!Number.isSafeInteger(row.size_bytes)||row.size_bytes<0)fail('invalid inventory row');
  if(inventory.has(row.path)&&inventory.get(row.path)!==row.size_bytes)fail('inconsistent inventory size '+row.path);
  inventory.set(row.path,row.size_bytes);
 }
 for(const [name,value] of Object.entries(p.contents??{})){
  if(typeof value!=='string')fail('non-text source '+name);
  if(contents.has(name)&&contents.get(name)!==value)fail('inconsistent source '+name);
  contents.set(name,value);
 }
}
if(!contents.has('plugin.json'))fail('missing root plugin.json');
const manifest=JSON.parse(contents.get('plugin.json'));
if(manifest.name!=='zodiac-video-pipeline'||manifest.version!==version)fail('root manifest mismatch');
if(args.includes('--require-complete')){
 if(!inventory.size)fail('complete snapshot requires inventory pages');
 const absent=[...inventory.keys()].filter(x=>!contents.has(x));if(absent.length)fail('source missing '+absent.length+' listed files (first: '+absent[0]+')');
}
const files=[];
for(const [rel,value] of contents){
 if(!rel.startsWith('skills/zodiac-video-pipeline/')&&!['plugin.json','.codex-plugin/plugin.json'].includes(rel))fail('out of scope '+rel);
 const bytes=Buffer.from(value,'utf8');
 if(inventory.has(rel)&&bytes.length!==inventory.get(rel))fail('byte size mismatch '+rel+' expected '+inventory.get(rel)+' got '+bytes.length);
 files.push({path:rel,base64:bytes.toString('base64'),sha256:createHash('sha256').update(bytes).digest('hex')});
}
files.sort((a,b)=>a.path.localeCompare(b.path));
const snapshot={format:'zodiac-plugin-source-snapshot@1',version,source_release_id:release,files};
await mkdir(path.dirname(path.resolve(out)),{recursive:true});const tmp=path.resolve(out)+'.tmp-'+process.pid;
await writeFile(tmp,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});await rename(tmp,path.resolve(out));
console.log(JSON.stringify({status:'READY',version,release,files:files.length,inventory:inventory.size,complete:inventory.size>0&&files.length===inventory.size,output:path.resolve(out)}));
