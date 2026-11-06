// Local, read-only Garden preflight. No TikTok connection or save mutation.
import fs from 'node:fs';import path from 'node:path';
import {assessGardenPreflight} from '../garden/preflight.mjs';
const arg=(name,fallback)=>{const i=process.argv.indexOf(name);return i<0?fallback:process.argv[i+1]??fallback;};
const url=arg('--url','http://127.0.0.1:4858'),mode=arg('--mode','sim'),out=arg('--out','logs/garden-preflight.json');
try{
 if(!['sim','live'].includes(mode))throw new Error('mode must be sim or live');
 const response=await fetch(new URL('/api/status',url),{signal:AbortSignal.timeout(5000)});
 if(!response.ok)throw new Error(`Garden HTTP ${response.status}`);
 const report=assessGardenPreflight(await response.json(),{mode});
 fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));if(!report.offlineReady)process.exitCode=1;
}catch(error){console.error(error.stack??error.message);process.exitCode=1;}