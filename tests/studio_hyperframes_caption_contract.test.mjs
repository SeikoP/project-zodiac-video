import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {planMeasuredCaptionPages,captionCuesForEpisode,captionsToSrt} from '../tools/studio_project/visual_captions.mjs';
import {renderPreview,renderEpisode,previewRuntime} from '../tools/studio_project/visual_preview.mjs';
import {presentationFor} from '../tools/studio_project/visual_presentation.mjs';
import {THEMES} from '../tools/studio_project/visual_themes.mjs';

const sentence='Hội bạn rủ Nhân Mã đi chơi thứ Bảy, nhưng câu trả lời vẫn là để xem. Người ấy nhắn đúng câu đó, Nhân Mã lại lập tức hẹn giờ và chủ động qua đón.';
const parts=sentence.split(/\s+/u);
const words=parts.map((text,i)=>({text,startMs:150+i*360,endMs:340+i*360}));
const time={fps:30,startMs:0,endMs:parts.length*360+500,measured:true,words,events:[]};
const scene={id:'caption-contract',entities:[{id:'actor',kind:'character',initial_state:'idle',states:{idle:{asset:'a',transform:{x:200,y:350,width:400,height:680}}}}],events:[]};
const assets={a:{svg:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8"/></svg>',source_sha256:'a'.repeat(64)}};

test('non-frame-aligned scene cuts cannot make SRT cues overlap',()=>{
 const rows=[
  {time:{fps:30,startMs:0,endMs:15040},pages:[{start_frame:0,end_frame:452,resolved_layout:{lines:['Trang trước']}}]},
  {time:{fps:30,startMs:15040,endMs:30000},pages:[{start_frame:0,end_frame:449,resolved_layout:{lines:['Trang sau']}}]},
 ];
 const cues=captionCuesForEpisode(rows);
 assert.equal(cues.length,2);
 assert.equal(cues[0].endMs,15040);
 assert.equal(cues[1].startMs,15040);
 assert.equal((captionsToSrt(cues).match(/-->/gu)||[]).length,2);
});

test('caption pages are measured once, contiguous across speech gaps, and match preview/export/SRT',async()=>{
 const runtime=await previewRuntime(path.resolve('.'));
 const presentation=presentationFor(THEMES.light);
 const pages=planMeasuredCaptionPages(scene,time,presentation,Buffer.from(runtime.font.base64,'base64'));
 assert.ok(pages.length>1,'long Vietnamese narration must paginate');
 for(let i=0;i<pages.length;i++){
  assert.ok(pages[i].resolved_layout.lines.length<=2);
  assert.ok(pages[i].end_frame>pages[i].start_frame);
  if(i)assert.equal(pages[i-1].end_frame,pages[i].start_frame,'no blank-frame gap between displayed pages');
 }
 const preview=renderPreview(scene,assets,time,'light',runtime.gsap,runtime.font);
 const episode=renderEpisode([{scene,time}],assets,'light',30,runtime);
 assert.deepEqual(preview.render_model.captions,pages);
 assert.equal(episode.caption_cues.length,pages.length);
 for(let i=0;i<pages.length;i++){
  const cue=episode.caption_cues[i];
  assert.equal(cue.text,pages[i].resolved_layout.lines.join('\n'),'SRT and the screen must use the same line breaks');
  assert.ok(Math.abs(cue.startMs-pages[i].start_frame/30*1000)<.02);
  assert.ok(Math.abs(cue.endMs-pages[i].end_frame/30*1000)<.02);
 }
 const srt=captionsToSrt(episode.caption_cues);
 assert.equal((srt.match(/-->/gu)||[]).length,pages.length);
 assert.match(srt,/Nhân Mã/u);
 assert.match(episode.html,/verifyCaptionFont\(start\)/u);
 assert.match(preview.html,/FONT_LOAD_FAILED/u);
});

test('captions stay hidden under the series cover and start once it is gone',()=>{
 const rows=[
  {time:{fps:30,startMs:0,endMs:6000},pages:[
   {start_frame:0,end_frame:30,resolved_layout:{lines:['Hết trong cover']}},
   {start_frame:30,end_frame:120,resolved_layout:{lines:['Qua mép cover']}},
   {start_frame:120,end_frame:180,resolved_layout:{lines:['Sau cover']}}]},
 ];
 const cues=captionCuesForEpisode(rows,2000);  // cover lasts 2 s
 assert.deepEqual(cues.map(c=>c.text),['Qua mép cover','Sau cover']);
 assert.equal(cues[0].startMs,2000,'a page that straddles the cover edge starts when the cover is gone');
 assert.equal(captionCuesForEpisode(rows).length,3,'no cover: every page is listed');
});

test('preview and export hide the caption while the cover is up',async()=>{
 const runtime=await previewRuntime(path.resolve('.'));
 const opening={format:'zodiac-series-opening@1',series:'12 CUNG HOÀNG ĐẠO',sign:'Nhân Mã',topic:'Khi Nhân Mã thật lòng yêu',duration_frames:45,transition_frames:6};
 const episode=renderEpisode([{scene,time}],assets,'light',30,runtime,{},opening);
 assert.match(episode.html,/m\.opening&&frame<m\.opening\.duration_frames/u);
 assert.ok(episode.caption_cues.every(c=>c.startMs>=1500),'SRT lists nothing under the 1.5 s cover');
});
