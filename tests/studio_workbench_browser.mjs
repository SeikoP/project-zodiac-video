import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {mkdir} from 'node:fs/promises';
import {installWorkbenchFixture} from './studio_workbench_fixture.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
try {
 const page=await browser.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await installWorkbenchFixture(page);
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
 await page.locator('.editing-workbench').waitFor({timeout:10000});
 await page.getByRole('heading',{name:'Bàn dựng video',exact:true}).waitFor();
 for(const [width,height] of [[1366,768],[1060,650],[1093,614]]) {
  await page.setViewportSize({width,height});
  await page.locator('.visual-scenes button').first().waitFor();
  assert.equal(await page.locator('.visual-stage:visible').count(),1);
  await page.getByRole('button',{name:'Mở giọng đọc',exact:true}).waitFor();
  await page.getByRole('button',{name:'Xuất video',exact:true}).waitFor();
  const bounds=await page.evaluate(()=>({w:document.documentElement.scrollWidth,h:document.documentElement.scrollHeight,iw:innerWidth,ih:innerHeight,stage:document.querySelector('.visual-viewport').getBoundingClientRect().height}));
  assert.ok(bounds.w<=bounds.iw && bounds.h<=bounds.ih+1,JSON.stringify(bounds));
  assert.ok(bounds.stage>=190,'Preview needs meaningful height '+JSON.stringify(bounds));
 }
 await page.locator('.visual-scenes button').nth(1).click();
 assert.match(await page.locator('.visual-scenes button.active').innerText(),/s2/);
 await page.getByRole('button',{name:'Mở giọng đọc',exact:true}).click();
 await page.locator('.voice-workspace').waitFor();
 await page.locator('.workflow-tabs').getByRole('button',{name:'Hình ảnh',exact:true}).click();
 assert.match(await page.locator('.visual-scenes button.active').innerText(),/s2/);
 await page.getByRole('button',{name:'Xuất video',exact:true}).click();
 await page.locator('.episode-export').waitFor();
 assert.deepEqual(errors,[]);
 await mkdir('.runtime/workbench',{recursive:true});
 console.log('PASS editor-first shell, context and layout at 3 sizes');
} finally {await browser.close();}
