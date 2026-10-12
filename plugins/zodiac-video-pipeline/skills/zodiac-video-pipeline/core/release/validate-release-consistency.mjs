#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ownRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
export async function checkReleaseConsistency(root=ownRoot){
  const files=[
    ['plugin.json','version'],
    ['.codex-plugin/plugin.json','version'],
    ['skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json','plugin_version']
  ];
  const versions={};const problems=[];
  for(const [file,field] of files){
    try {
      const data=JSON.parse(await readFile(path.join(root,file),'utf8'));
      const version=data?.[field];
      if(typeof version!=='string'||!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version))
        problems.push('INVALID_RELEASE_VERSION:'+file);
      else versions[file]=version;
    } catch(err){problems.push('VERSION_SOURCE_UNREADABLE:'+file+':'+(err?.code??'INVALID_JSON'));}
  }
  const unique=[...new Set(Object.values(versions))];
  if(unique.length>1)problems.push('RELEASE_VERSION_MISMATCH');
  return {status:problems.length?'BLOCKED':'PASS',versions,problems};
}
const isCLI=process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url;
if(isCLI){
  const result=await checkReleaseConsistency(process.argv[2]?path.resolve(process.argv[2]):ownRoot);
  console.log(JSON.stringify(result,null,2));
  if(result.status!=='PASS')process.exitCode=1;
}
