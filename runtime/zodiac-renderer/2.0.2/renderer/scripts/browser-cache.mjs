import {readFile,stat} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export async function findCachedBrowser(roots,version,{platform=process.platform,arch=process.arch}={}) {
 const target=platform==='win32'?'win64':platform==='darwin'?(arch==='arm64'?'mac-arm64':'mac-x64'):'linux64';
 for(const root of roots){
  const cache=join(root,'chrome-headless-shell');
  try{
   if((await readFile(join(cache,'VERSION'),'utf8')).trim()!==version)continue;
   const executable=join(cache,target,'chrome-headless-shell-'+target,'chrome-headless-shell'+(platform==='win32'?'.exe':''));
   if((await stat(executable)).isFile())return executable;
  }catch(error){if(!['ENOENT','ENOTDIR'].includes(error.code))throw error;}
 }
 return null;
}

export async function resolveBrowserExecutable(){
 const renderer=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const repo=resolve(renderer,'../../../..');
 const require=createRequire(import.meta.url),cliRequire=createRequire(require.resolve('@remotion/cli/package.json'));
 const api=cliRequire('@remotion/renderer');
 const packageRoot=dirname(cliRequire.resolve('@remotion/renderer/package.json'));
 // The CLI is exact-pinned; compare Chrome revision before sharing any cache.
 const {TESTED_VERSION}=cliRequire(join(packageRoot,'dist/browser/BrowserFetcher.js'));
 const cached=await findCachedBrowser([join(repo,'node_modules/.remotion'),join(repo,'.remotion'),
  ...['2.0.2','2.0.1','2.0.0'].map(v=>join(repo,'runtime/zodiac-renderer',v,'renderer/node_modules/.remotion'))],TESTED_VERSION);
 if(cached)return cached;
 return (await api.ensureBrowser({logLevel:'info'})).path;
}
