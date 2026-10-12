import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function forwardCliIfMain(wrapperUrl,targetUrl){
 const invoked=process.argv[1]?path.resolve(process.argv[1]):null;
 if(!invoked||invoked!==fileURLToPath(wrapperUrl))return false;
 const target=fileURLToPath(targetUrl);
 const result=spawnSync(process.execPath,[target,...process.argv.slice(2)],{stdio:'inherit',env:process.env});
 if(result.error)throw result.error;
 process.exitCode=result.status??1;
 return true;
}
