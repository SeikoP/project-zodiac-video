import test from 'node:test';
import assert from 'node:assert/strict';
import {paginateCaption} from '../src/caption-layout.mjs';
import {validateCaptionWords} from '../src/caption-karaoke.mjs';
import {findCachedBrowser} from '../scripts/browser-cache.mjs';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

const caption=text=>({text,start_frame:0,end_frame:(text.match(/[\p{L}\p{N}_]+/gu)??[]).length*5,words:(text.match(/[\p{L}\p{N}_]+/gu)??[]).map((text,i)=>({text,start_frame:i*5,end_frame:(i+1)*5}))});
const presentation={caption:{font_size_px:56,max_lines:2,safe_zone:{x:0,y:0,width:500,height:160}}};
test('measured pagination keeps every word, punctuation and original word timing',()=>{
 const original=caption('Bạch Dương bắt đầu trước, rồi mới nghĩ về những điều còn thiếu. Một câu khác vẫn được giữ đầy đủ.');
 const pages=paginateCaption({id:'S1'},presentation,{width:1080,height:1920},original,text=>text.length*20);
 assert.ok(pages.length>1);assert.equal(pages.map(p=>p.text).join(' '),original.text);
 assert.deepEqual(pages.flatMap(p=>p.words),original.words);
 for(const p of pages){validateCaptionWords(p);assert.ok(p.resolved_layout.lines.length<=2);}
});
test('a sentence that fits stays intact; unmeasured timing is never invented',()=>{
 const original=caption('Một việc chưa bắt đầu mà Bạch Dương đã thấy chậm.');
 assert.equal(paginateCaption({id:'S1'},presentation,{width:1080,height:1920},original,text=>text.length*7).length,1);
 delete original.words;
 assert.throws(()=>paginateCaption({id:'S1'},presentation,{width:1080,height:1920},original,text=>text.length*100),/CAPTION_OVERFLOW/);
});
test('browser cache requires both the pinned Chrome revision and executable',async()=>{
 const root=await mkdtemp(join(tmpdir(),'browser-cache-'));
 try{const cache=join(root,'chrome-headless-shell');const dir=join(cache,'win64/chrome-headless-shell-win64');await mkdir(dir,{recursive:true});
 await writeFile(join(cache,'VERSION'),'old');await writeFile(join(dir,'chrome-headless-shell.exe'),'fixture');
 assert.equal(await findCachedBrowser([root],'new',{platform:'win32'}),null);
 await writeFile(join(cache,'VERSION'),'new');
 assert.equal(await findCachedBrowser([root],'new',{platform:'win32'}),join(dir,'chrome-headless-shell.exe'));
 }finally{await rm(root,{recursive:true,force:true})}
});
