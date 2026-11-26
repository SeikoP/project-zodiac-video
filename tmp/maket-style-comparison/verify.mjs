import assert from 'node:assert/strict';
import {chromium} from 'file:///C:/Users/bungm/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright-core/index.mjs';
const browser=await chromium.launch({headless:true,executablePath:'E:/projects/project-zodiac-video/node_modules/.remotion/chrome-headless-shell/win64/chrome-headless-shell-win64/chrome-headless-shell.exe'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:3020');
 await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>v.readyState>=2));
 const info=await page.locator('video').evaluateAll(vs=>vs.map(v=>({duration:v.duration,width:v.videoWidth,height:v.videoHeight,muted:v.muted})));
 assert.equal(info.length,2);for(const v of info){assert.equal(v.duration,10);assert.equal(v.width,1080);assert.equal(v.height,1920);}assert.deepEqual(info.map(v=>v.muted),[false,true]);
 await page.click('#play');await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>!v.paused&&v.currentTime>.5));
 const times=await page.locator('video').evaluateAll(vs=>vs.map(v=>v.currentTime));assert.ok(Math.abs(times[0]-times[1])<.15,times.join(','));
 await page.click('#pause');await page.selectOption('#sound','b');assert.deepEqual(await page.locator('video').evaluateAll(vs=>vs.map(v=>v.muted)),[true,false]);
 await page.evaluate(()=>{const s=document.querySelector('#seek');s.value='2.6';s.dispatchEvent(new Event('input'));});
 await page.waitForFunction(()=>[...document.querySelectorAll('video')].every(v=>!v.seeking&&Math.abs(v.currentTime-2.6)<.05&&v.readyState>=2));
 await page.screenshot({path:new URL('comparison.png',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1')});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({ok:true,info,playback_times:times,errors}));
}finally{await browser.close();}
