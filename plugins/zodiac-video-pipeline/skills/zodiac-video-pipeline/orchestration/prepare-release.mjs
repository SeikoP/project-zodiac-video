#!/usr/bin/env node
// Explicit release preparation; never silently migrates workspace pipeline-state.
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkReleaseConsistency} from './validate-release-consistency.mjs';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const files=[['plugin.json','version'],['.codex-plugin/plugin.json','version'],['skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json','plugin_version']];
const [version,rootArg]=process.argv.slice(2);const root=rootArg?path.resolve(rootArg):repo;
const fail=s=>{throw new Error('RELEASE_PREPARE_INVALID: '+s);};
const value=s=>String(s).split('.').map(Number);
if(!/^\d+\.\d+\.\d+$/.test(version??''))fail('explicit X.Y.Z version required');
const [manifest,alt,template]=await Promise.all(files.map(async ([p])=>JSON.parse(await readFile(path.join(root,p),'utf8'))));
const old=manifest.version;if(!/^\d+\.\d+\.\d+$/.test(old??''))fail('source manifest version invalid');
const a=value(version),b=value(old);
if(a[0]<b[0]||(a[0]===b[0]&&a[1]<b[1])||(a[0]===b[0]&&a[1]===b[1]&&a[2]<=b[2]))fail('new release version must be higher than '+old);
if(alt.version!==old)fail('plugin manifests differ before preparation');
for(const [i,[p,k]] of files.entries()){
  const obj=[manifest,alt,template][i];obj[k]=version;
  await writeFile(path.join(root,p),JSON.stringify(obj,null,2)+'\n');
}
const result=await checkReleaseConsistency(root);
if(result.status!=='PASS')fail('post-write check failed '+JSON.stringify(result.problems));
console.log('RELEASE_PREPARED '+old+' -> '+version+'; state template synchronized; workspace state unchanged');
