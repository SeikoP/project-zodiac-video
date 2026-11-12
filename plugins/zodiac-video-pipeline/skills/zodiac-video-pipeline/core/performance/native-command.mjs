import {spawn,spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const MAX_OUTPUT=4*1024*1024,LOG_TAIL=4500;

function result(args,{stdout='',stderr='',status,signal=null,error,timedOut=false,outputExceeded=false},started){
 const exit_code=timedOut||error?.code==='ETIMEDOUT'?124:outputExceeded||error?.code==='ENOBUFS'?1:status??1;
 let issues=[];
 try{const value=JSON.parse(stdout);if(Array.isArray(value?.issues))issues=value.issues.filter(i=>i&&typeof i==='object'&&typeof i.code==='string'&&i.code.trim());}catch{}
 if(outputExceeded||error?.code==='ENOBUFS')issues.push({code:'NATIVE_OUTPUT_LIMIT_EXCEEDED'});
 if(exit_code!==0&&!issues.length){const code=stderr.trim().match(/^([A-Z][A-Z0-9_]+)(?:\s|:)/u)?.[1];if(code)issues.push({code,detail:stderr.slice(-LOG_TAIL)});}
 return {status:exit_code===0?'PASS':'FAIL',exit_code,signal,issues,elapsed_ms:+(performance.now()-started).toFixed(2),command:[process.execPath,...args],stdout:stdout.slice(-LOG_TAIL),stderr:String(stderr||error?.message||'').slice(-LOG_TAIL)};
}

export function runNativeCommandSync(args,{timeoutMs=180000}={}){
 const started=performance.now(),run=spawnSync(process.execPath,args,{encoding:'utf8',maxBuffer:MAX_OUTPUT,timeout:timeoutMs,windowsHide:true});
 return result(args,run,started);
}

export function runNativeCommand(args,{timeoutMs=180000}={}){
 const started=performance.now();
 return new Promise(resolve=>{
  const child=spawn(process.execPath,args,{stdio:['ignore','pipe','pipe'],windowsHide:true});
  child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
  let stdout='',stderr='',error,timedOut=false,outputExceeded=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill();},timeoutMs);
  const collect=(previous,chunk)=>{const next=previous+chunk.toString();if(next.length>MAX_OUTPUT){outputExceeded=true;child.kill();}return next.slice(0,MAX_OUTPUT);};
  child.stdout.on('data',b=>{stdout=collect(stdout,b);});child.stderr.on('data',b=>{stderr=collect(stderr,b);});
  child.once('error',e=>{error=e;});
  child.once('close',(status,signal)=>{clearTimeout(timer);resolve(result(args,{stdout,stderr,status,signal,error,timedOut,outputExceeded},started));});
 });
}
