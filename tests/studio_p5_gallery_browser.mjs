// Browser transport fixture; verifies gallery interactions, never writes episode approval.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href);
const browser=await chromium.launch({executablePath:process.env.STUDIO_BROWSER,headless:true});
try {
 const page=await browser.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/src/backend.ts*',async route=>{
  const response=await route.fetch();let source=await response.text();
  const a=source.indexOf('export async function request'),b=source.indexOf('export const backend',a);
  source=source.slice(0,a)+'export async function request(method, params={}) { return window.galleryFixture(method,params); }\n'+source.slice(b);
  await route.fulfill({response,body:source});
 });
 await page.addInitScript(()=>{
  const project={project_id:'p1',episode_id:'gallery-fixture',display_title:'Gallery test',source_sha256:'a'.repeat(64),revision:1,status:{}};
  window.galleryCalls=[];
  window.galleryFixture=(method,p)=>{
   window.galleryCalls.push({method,p});
   if(method==='health')return {status:'READY'};
   if(method==='projects.list')return [project];
   if(method==='projects.open')return project;
   if(method.startsWith('events.'))return [];
   if(method==='assets.gallery')return {format:'gallery-test',source_revision:'b'.repeat(64),usage_evidence:{coverage:{truncated:true}},themes:['light','dark','apricot-campus'].map(id=>({id,title:id,canvas:id==='dark'?'#18232f':'#fff9ef',ink:'#243540',caption:'#ffffff',caption_ink:'#15232d',accent:'#92502c'})),items:Array.from({length:13},(_,i)=>({id:`item-${i}`,role:i===12?'face':'prop',contexts:['comedy'],source_sha256:'c'.repeat(64),usage:i===0?[{project_id:'old',episode_id:'episode-truoc',build_id:'a'.repeat(32),manifest_sha256:'d'.repeat(64),source_sha256:'e'.repeat(64),scene_ids:['s02','s04'],review_status:'NOT_REVIEWED'}]:[],preview_data_uri:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 100"><rect x="5" y="5" width="40" height="90" rx="8" fill="purple"/></svg>')}))};
   throw Error('Unexpected fixture method '+method);
  };
 });
 await page.goto(process.env.STUDIO_URL||'http://127.0.0.1:1420');
 await page.locator('.sidebar-nav').getByRole('button',{name:'Tài nguyên',exact:true}).click();
 await page.locator('.gallery-card').first().waitFor();
 await page.getByRole('button',{name:'Ngữ cảnh',exact:true}).click();
 assert.match(await page.locator('.gallery-inspector').innerText(),/episode-truoc/);
 assert.match(await page.locator('.gallery-inspector').innerText(),/chưa duyệt hình/);
 assert.match(await page.locator('.gallery-inspector').innerText(),/s02, s04/);
 for(const [width,height]of [[1366,768],[1060,650],[1093,614]]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(120);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('.asset-gallery button,.asset-gallery select,.asset-gallery input,.asset-gallery .pagination')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.height&&(r.bottom>innerHeight+1||r.right>innerWidth+1||r.left<0);}).map(el=>el.outerHTML.slice(0,100)));
  assert.deepEqual(overflow,[],`${width}x${height}`);
 }
 assert.equal(await page.locator('.gallery-preview img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
 await page.getByRole('button',{name:'Nguồn',exact:true}).click();
 await page.getByRole('button',{name:'Hình ảnh: trang sau',exact:true}).click();
 assert.equal(await page.locator('.gallery-card').first().innerText(),'item-4\nĐạo cụ');
 await page.getByLabel('Loại hình ảnh').selectOption('face');
 assert.equal(await page.locator('.gallery-card').count(),1);
 assert.match(await page.locator('.gallery-inspector').innerText(),/item-12/);
 await page.getByLabel('Palette xem thử').selectOption('dark');
 assert.equal(await page.locator('.gallery-preview').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(24, 35, 47)');
 await page.getByRole('button',{name:'Tiếp xúc',exact:true}).click();
 assert.match(await page.locator('.gallery-inspector').innerText(),/contact geometry/);
 const writes=await page.evaluate(()=>window.galleryCalls.filter(c=>/command|update|confirm/.test(c.method)));
 assert.deepEqual(writes,[]);
 assert.deepEqual(errors,[]);
 console.log('P5 gallery browser: PASS (pagination/filter/preview/palettes/contact/read-only/three viewports)');
}finally{await browser.close();}
