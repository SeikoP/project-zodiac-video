import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {installWorkbenchFixture} from './studio_workbench_fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true,args:['--autoplay-policy=no-user-gesture-required']});
await mkdir('tmp/studio-settings-audio',{recursive:true});
try {
  const page=await browser.newPage({viewport:{width:1366,height:768}}), errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await installWorkbenchFixture(page);
  await page.addInitScript(()=>{
    const fixture=window.layoutFixture;
    const roles=Object.fromEntries(['creative','repair','review','vision'].map(role=>[role,{model:'gpt-6-luna',effort:'high'}]));
    window.settingsFixture={revision:0,values:{audio:{music_enabled:true,music_id:'',music_volume:.1,sfx_enabled:true,sfx_id:'',sfx_volume:.2,ducking:true},libraries:{music_dir:'E:/music',sfx_dir:'E:/sfx'},agents:roles,voice:{default:''},appearance:{theme:'light'}},effective_agents:roles,overrides:{},voices:['Hải Đăng'],themes:['light','dark'],system:{renderer:'HyperFrames 0.9.63',fps:30,render_workers:1}};
    window.layoutFixture=(method,p)=>{
      if(method==='settings.get')return structuredClone(window.settingsFixture);
      if(method==='settings.update') {
        if(window.failSettingsSave)throw Error('Không lưu được cài đặt');
        window.settingsFixture={...window.settingsFixture,revision:window.settingsFixture.revision+1,values:structuredClone(p.values)};
        return structuredClone(window.settingsFixture);
      }
      if(method==='audio.catalog')return {items:['music','sfx'].map(kind=>({id:kind+'-1',kind,title:kind+' sample',url:'data:audio/wav;base64,'+fixture('voice.audio').data}))};
      return fixture(method,p);
    };
  });
  await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
  await page.getByRole('button',{name:'Cài đặt',exact:true}).click();
  await page.getByRole('heading',{name:'Cài đặt chung'}).waitFor();
  await page.getByLabel('Nhạc nền',{exact:true}).selectOption('music-1');
  await page.getByLabel('Âm lượng nhạc nền',{exact:true}).fill('0.07');
  await page.getByRole('button',{name:'Nghe thử nhạc nền',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.settings-audition audio')?.paused===false);
  await page.locator('.settings-audition audio').evaluate(e=>{window.previousAudition=e;});
  await page.getByRole('button',{name:'Agent',exact:true}).click();
  assert.equal(await page.evaluate(()=>window.previousAudition.paused),true,'audition stops on tab change');
  await page.getByLabel('Model creative',{exact:true}).fill('gpt-6-luna');
  await page.getByLabel('Độ suy luận creative',{exact:true}).selectOption('xhigh');
  await page.getByRole('button',{name:'Lưu cài đặt',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Đã lưu'}).waitFor();
  assert.equal(await page.evaluate(()=>window.settingsFixture.values.audio.music_volume),.07);
  assert.equal(await page.evaluate(()=>window.settingsFixture.values.agents.creative.effort),'xhigh');
  await page.getByRole('button',{name:'Tải lại',exact:true}).click();
  await page.getByRole('button',{name:'Âm thanh',exact:true}).click();
  assert.equal(await page.getByLabel('Nhạc nền',{exact:true}).inputValue(),'music-1');
  await page.evaluate(()=>{window.failSettingsSave=true;});
  await page.getByRole('button',{name:'Lưu cài đặt',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'Không lưu được'}).waitFor();
  for(const [width,height] of [[1366,768],[1093,614],[800,580],[800,960]]) {
    await page.setViewportSize({width,height});
    for(const label of ['Âm thanh','Agent','Giọng & giao diện','Hệ thống & thư viện']) {
      await page.getByRole('button',{name:label,exact:true}).click();
      const box=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight}));
      assert.ok(box.w<=width && box.h<=height+1,`${label} fits ${width}x${height}: ${JSON.stringify(box)}`);
    }
    await page.getByRole('button',{name:'Âm thanh',exact:true}).click();
    await page.screenshot({path:`tmp/studio-settings-audio/settings-${width}.png`});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS settings navigation, library audition, stop, save/reload, failed save, four sizes');
} finally {await browser.close();}
