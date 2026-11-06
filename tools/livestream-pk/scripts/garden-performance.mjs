// Repeatable browser Canvas benchmark for an isolated Garden simulator.
// node scripts/garden-performance.mjs --browser-module file:///.../playwright/index.mjs --browser-exe C:/.../chrome.exe
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startGardenServer } from '../garden/server.mjs';

export function uniqueFrameTimestamps(timestamps,minSeparationMs=12){
 const result=[];
 for(const at of timestamps)if(!result.length||at-result.at(-1)>=minSeparationMs)result.push(at);
 return result;
}
const percentile=(values,p)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor(sorted.length*p))]??0;};
const arg=(key,fallback)=>{const i=process.argv.indexOf(key);return i<0?fallback:process.argv[i+1]??fallback;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function benchmark({browserModule,browserExe,secondsPerCase=6,outDir='logs/garden-performance',soakSeconds=0,sizes=[1,4,12,24,42],viewports=[{width:540,height:960},{width:360,height:640}]}={}){
 if(!browserModule)throw new Error('Pass --browser-module with a locally installed Playwright module');
 const root=path.resolve(outDir);fs.mkdirSync(root,{recursive:true});
 const save=fs.mkdtempSync(path.join(os.tmpdir(),'garden-perf-'));
 const server=await startGardenServer({port:0,dir:save,simulator:true,tiktok:false,config:{garden:{bossChance:0,pestChancePerSec:0,weedChancePerSec:0,sleepAfterMs:1e9,evictAfterMs:1e9,sessionMs:1e9}},log:()=>{}});
 const {chromium}=await import(browserModule);let browser;
 const report={mode:'isolated-browser',cases:[],errors:[],soak:null,thresholds:{visibleMedianCanvasFps:30,frameIntervalP95Ms:50},studio:'not-verified'};
 async function post(route,body){const r=await fetch(server.url+'api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});if(!r.ok)throw new Error(`${route}: ${r.status} ${await r.text()}`);return (await r.json()).result;}
 async function open(viewport){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{
   const native=CanvasRenderingContext2D.prototype.fillRect;
   window.__gardenPerf={draws:[],mutations:0};
   CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){
    if(this.canvas?.id==='world'&&x===0&&y===0&&w===1080&&h===1920){const frames=window.__gardenPerf.draws;frames.push(performance.now());if(frames.length>2500)frames.splice(0,500);}
    return native.apply(this,arguments);
   };
   addEventListener('DOMContentLoaded',()=>{
    const stage=document.getElementById('stage');if(stage)new MutationObserver(m=>window.__gardenPerf.mutations+=m.length).observe(stage,{subtree:true,childList:true,characterData:true,attributes:true});
   });
  });
  await page.goto(server.url+'?display=live');await page.locator('#world').click();
  return page;
 }
 async function sample(page,seconds,description){
  await page.evaluate(()=>{window.__gardenPerf.draws=[];window.__gardenPerf.mutations=0;});
  const t=Date.now();await delay(seconds*1000);
  const data=await page.evaluate(()=>({frames:window.__gardenPerf.draws,mutations:window.__gardenPerf.mutations,heap:performance.memory?.usedJSHeapSize??null,visibility:document.visibilityState}));
  const frames=uniqueFrameTimestamps(data.frames);const intervals=frames.slice(1).map((x,i)=>x-frames[i]);const span=Date.now()-t;
  return {description,elapsedMs:span,frameCount:frames.length,canvasFps:Math.round(frames.length*1e5/span)/100,frameIntervalP95Ms:Math.round(percentile(intervals,.95)*100)/100,frameIntervalMedianMs:Math.round(percentile(intervals,.5)*100)/100,rawFullCanvasDraws:data.frames.length,domMutations:data.mutations,heapBytes:data.heap,visibility:data.visibility};
 }
 try{
  browser=await chromium.launch({headless:true,...(browserExe?{executablePath:browserExe}:{})});
  for(const viewport of viewports){
   const page=await open(viewport);
   for(const size of sizes){
    await post('sim-room',{action:'set',count:size});
    await delay(1200);
    const bot={userId:'auto-0',nickname:'An'};
    await post('sim',{kind:'like',user:bot,count:100});
    await post('sim',{kind:'gift',user:bot,diamonds:5});
    const item=await sample(page,secondsPerCase,`${viewport.width}x${viewport.height}/${size} pots`);
    report.cases.push({...item,viewport,size});
    await page.screenshot({path:path.join(root,`${viewport.width}-${size}.png`)});
   }
   await page.close();
  }
  if(soakSeconds>0){
   const page=await open({width:540,height:960});await post('sim-room',{action:'set',count:42});
   const start=Date.now();let pulses=0;const pieces=[];
   while(Date.now()-start<soakSeconds*1000){
    await post('sim',{kind:pulses%3===0?'gift':'like',user:{userId:'auto-0',nickname:'An'},... (pulses%3===0?{diamonds:[5,50,100][pulses%9/3|0]}:{count:100})});
    pieces.push(await sample(page,Math.min(10,(soakSeconds*1000-(Date.now()-start))/1000),'soak'));
    pulses++;
   }
   report.soak={seconds:Math.round((Date.now()-start)/1000),pulses,canvasFpsMedian:percentile(pieces.map(p=>p.canvasFps),.5),frameIntervalP95Ms:percentile(pieces.map(p=>p.frameIntervalP95Ms),.95),heapBytesStart:pieces[0]?.heapBytes,heapBytesEnd:pieces.at(-1)?.heapBytes};
   await page.close();
  }
  report.summary={cases:report.cases.length,medianCanvasFps:percentile(report.cases.map(p=>p.canvasFps),.5),p95FrameIntervalMs:percentile(report.cases.map(p=>p.frameIntervalP95Ms),.95),maxDomMutations:Math.max(0,...report.cases.map(p=>p.domMutations)),minCanvasFps:Math.min(...report.cases.map(p=>p.canvasFps)),pageErrors:report.errors.length};
  fs.writeFileSync(path.join(root,'benchmark.json'),JSON.stringify(report,null,2));
  return report;
 }finally{await browser?.close();await server.close();fs.rmSync(save,{recursive:true,force:true});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 benchmark({browserModule:arg('--browser-module'),browserExe:arg('--browser-exe'),secondsPerCase:Number(arg('--case-seconds',6)),soakSeconds:Number(arg('--soak-seconds',0)),outDir:arg('--out','logs/garden-performance'),sizes:arg('--sizes','1,4,12,24,42').split(',').map(Number),viewports:arg('--viewports','540x960,360x640').split(',').map(size=>{const [width,height]=size.split('x').map(Number);return {width,height};})}).then(r=>console.log(JSON.stringify({summary:r.summary,soak:r.soak,errors:r.errors}))).catch(e=>{console.error(e.stack);process.exitCode=1;});
}