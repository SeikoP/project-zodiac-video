#!/usr/bin/env node
// Restore an exact, connector-exported plugin source snapshot, never synthesized assets.
import {readFile,writeFile,mkdir,lstat,realpath,rename} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const args=process.argv.slice(2);
const idx=args.indexOf('--source');const to=args.indexOf('--target');
if(idx<0||to<0||!args[idx+1]||!args[to+1]){console.error('Usage: node restore-plugin-source.mjs --source <snapshot.json> --target <directory> [--dry-run]');process.exit(2);}
const input=path.resolve(args[idx+1]),target=path.resolve(args[to+1]),dry=args.includes('--dry-run');
const fail=(message)=>{throw new Error('SOURCE_RESTORE_INVALID: '+message);};
const snapshot=JSON.parse(await readFile(input,'utf8'));
if(snapshot.format!=='zodiac-plugin-source-snapshot@1'||typeof snapshot.version!=='string'||!Array.isArray(snapshot.files)||!snapshot.files.length)fail('invalid snapshot contract');
if(!/^\d+\.\d+\.\d+$/.test(snapshot.version))fail('invalid snapshot version');
const paths=new Set();const writes=[];
for(const [i,item] of snapshot.files.entries()){
 const rel=item?.path;
 if(typeof rel==='string'&&/(?:\.lock$|\.tmp(?:-|$)|\.restore-tmp-)/u.test(rel))fail('transient source excluded '+rel);
 if(typeof rel!=='string'||!rel||rel.includes('\\')||rel.startsWith('/')||rel.split('/').some(x=>x==='..'||x==='.'||x==='')||!rel.startsWith('skills/zodiac-video-pipeline/')&&!['plugin.json','.codex-plugin/plugin.json'].includes(rel))fail('unsafe path at index '+i);
 if(paths.has(rel))fail('duplicate path '+rel);paths.add(rel);
 if(typeof item.base64!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(item.base64))fail('invalid base64 '+rel);
 const buf=Buffer.from(item.base64,'base64');
 if(buf.toString('base64')!==item.base64)fail('noncanonical base64 '+rel);
 const sha=createHash('sha256').update(buf).digest('hex');
 if(!/^[0-9a-f]{64}$/.test(item.sha256??'')||sha!==item.sha256)fail('checksum mismatch '+rel);
 if(rel==='plugin.json'){
  const manifest=JSON.parse(buf.toString('utf8'));
  if(manifest.name!=='zodiac-video-pipeline'||manifest.version!==snapshot.version)fail('plugin identity/version mismatch');
 }
 writes.push({rel,buf});
}
if(!paths.has('plugin.json'))fail('snapshot must carry exact root plugin.json');
const report={format:'zodiac-plugin-restore-receipt@1',version:snapshot.version,status:dry?'DRY_RUN':'RESTORED',files:writes.length,sha256:createHash('sha256').update(JSON.stringify(writes.map(({rel,buf})=>[rel,createHash('sha256').update(buf).digest('hex')]))).digest('hex')};
if(!dry){
 await mkdir(target,{recursive:true});const root=await realpath(target);
 for(const {rel,buf} of writes){
  const dest=path.resolve(root,rel);if(!dest.startsWith(root+path.sep))fail('path escapes target');
  const seg=rel.split('/');let dir=root;
  for(const part of seg.slice(0,-1)){
   dir=path.join(dir,part);
   try{const st=await lstat(dir);if(st.isSymbolicLink()||!st.isDirectory())fail('unsafe existing directory '+dir);}catch(e){if(e.code!=='ENOENT')throw e;await mkdir(dir);}
  }
  try{const st=await lstat(dest);if(st.isSymbolicLink()||!st.isFile())fail('unsafe existing file '+dest);}catch(e){if(e.code!=='ENOENT')throw e;}
  const tmp=dest+'.restore-tmp-'+process.pid;await writeFile(tmp,buf,{flag:'wx'});await rename(tmp,dest);
 }
 const receipt=path.join(root,'source-restore-receipt.json');await writeFile(receipt,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify(report));
