import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
import {startGardenServer} from '../garden/server.mjs';

export async function rehearse({outDir='logs/garden-implementation/rehearsal',browserModule,browserExe}={}){
 const dir=path.resolve(outDir);fs.mkdirSync(dir,{recursive:true});
 const s=await startGardenServer({port:0,dir:fs.mkdtempSync(path.join(os.tmpdir(),'garden-rehearsal-')),tiktok:false,simulator:true,config:{garden:{bossChance:0,pestChancePerSec:0,weedChancePerSec:0,sleepAfterMs:1e9,evictAfterMs:1e9}},log:()=>{}});
 const report={mode:'isolated-offline',scenarios:[],browser:{checked:false},studio:'not-checked',liveDelivery:'not-checked',listening:'pending'};let browser;
 const post=async(route,body)=>{const response=await fetch(s.url+'api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));assert.notEqual(data.ok,false);return data.result;};
 try{
  for(const scenario of ['newcomer1','group4','room12','room24','room48','careburst48','cardspam100','giftburst30','shield','no-target','destruction','bossinterrupt','awardreload','audioquiet','audiobusy']){
   const run=await post('sim-scenario',{scenario});assert.equal(run.ok,true);if(scenario==='bossinterrupt')assert.equal(s.garden.boss.status().phase,'active');report.scenarios.push({scenario,ok:true,expected:run.expected});
  }
  await post('sim-scenario',{scenario:'restore'});
  if(browserModule){
   const {chromium}=await import(browserModule);browser=await chromium.launch({headless:true,...(browserExe?{executablePath:browserExe}:{})});
   const page=await browser.newPage({viewport:{width:540,height:960},deviceScaleFactor:2}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(s.url+'?display=live');await page.click('#world');
   await post('sim-room',{action:'set',count:12});await page.waitForTimeout(1800);await page.screenshot({path:path.join(dir,'room12.png')});
   await post('sim',{kind:'gift',diamonds:50,user:{userId:'auto-0',nickname:'An'}});
   await page.locator('#roulette.on').waitFor({state:'visible'});await page.waitForTimeout(350);await page.reload();await page.waitForTimeout(450);
   assert.equal(await page.locator('#roulette').evaluate(el=>el.classList.contains('on')),true,'same-tab checkpoint resumes the active wheel');await page.screenshot({path:path.join(dir,'wheel-reloaded.png')});
   await post('sim-scenario',{scenario:'bossinterrupt'});await page.locator('#bossArena.on').waitFor({state:'visible'});assert.equal(await page.locator('#roulette.on').count(),0);assert.match(await page.locator('#guideCommand').textContent(),/thả tim/);await page.screenshot({path:path.join(dir,'boss-priority.png')});
   await post('sim-scenario',{scenario:'restore'});await post('sim-room',{action:'set',count:48});await page.waitForTimeout(700);
   for(const stage of [0,2,3]){
    for(const [i,u] of Object.values(s.garden.state.users).filter(u=>u.seat).entries()){
     u.level=[1,3,5,7,9][i%5];u.xp=[0,90,400,1100,2200][i%5];u.titles={[['firstHarvest','helpful','pestKeeper','harvest50','harvest100'][i%5]]:1};
     const p=s.garden.state.plots[`${u.seat.tier}:${u.seat.slot}`];p.crop={type:['rau','huongduong','nammay'][Math.floor(i/5)%3],variant:['common','lush','golden'][Math.floor(i/15)%3],progress:stage===3?1:stage===2?.75:.05,ripeAt:stage===3?Date.now():null,pest:false,weeds:false,stolen:0};p.ver=++s.garden.state.ver;
    }
    await page.waitForTimeout(800);await page.screenshot({path:path.join(dir,`contact-stage-${stage}.png`)});
   }
   const control=await browser.newPage({viewport:{width:1600,height:1050}});control.on('pageerror',e=>errors.push(e.message));await control.goto(s.url+'control');await control.waitForTimeout(1600);
   await control.locator('[data-control-tab="audio"]').click();assert.equal(await control.locator('.audio-row').count(),50);await control.locator('#audioDestination').selectOption('control');await control.locator('#warmAudio').click();await control.locator('.audio-row button').first().click();await control.waitForTimeout(500);await control.screenshot({path:path.join(dir,'control-audio.png'),fullPage:true});
   await control.setViewportSize({width:390,height:844});await control.locator('[data-control-tab="watch"]').click();assert.equal(await control.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);const previewY=await control.locator('#preview').evaluate(el=>el.getBoundingClientRect().top+scrollY);assert.ok(previewY<1200,`preview at ${previewY}`);await control.screenshot({path:path.join(dir,'control-mobile-watch.png'),fullPage:true});
   const status=await fetch(s.url+'api/status').then(r=>r.json());assert.ok(status.displays.some(d=>d.role==='live'));assert.ok(status.displays.some(d=>d.role==='preview'));
   const reduced=await browser.newPage({viewport:{width:360,height:640},reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto(s.url+'?display=preview');await reduced.waitForTimeout(500);await reduced.screenshot({path:path.join(dir,'reduced-motion.png')});
   assert.deepEqual(errors,[]);report.browser={checked:true,errors,rows:50,checkpointRestored:true,bossVisible:true,liveAndPreviewDistinct:true,mobilePreviewY:Math.round(previewY),mobileOverflow:false};
  }
  fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));return report;
 }finally{await browser?.close();await s.close();}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=key=>{const i=process.argv.indexOf(key);return i>=0?process.argv[i+1]:undefined;};
 try{console.log(JSON.stringify(await rehearse({outDir:arg('--out')??'logs/garden-implementation/rehearsal',browserModule:arg('--browser-module'),browserExe:arg('--browser-exe')})));}catch(e){console.error(e.stack);process.exitCode=1;}
}
