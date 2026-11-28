// One source of measured caption pages for scene preview, whole episode and SRT.
// The legacy V4 layout/wrapping rules remain authoritative; Fontkit measures the
// same pinned Patrick Hand TTF without relying on runtime browser font fallback.
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {paginateCaption} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/caption-layout.mjs';
import {validateCaptionWords} from '../../runtime/zodiac-renderer/2.0.2/renderer/src/caption-karaoke.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const requireStudio=createRequire(path.join(ROOT,'apps/zodiac-studio/package.json'));
const fontkit=requireStudio('fontkit');
const size={width:1080,height:1920};
const tokens=text=>[...text.matchAll(/[\p{L}\p{N}_]+/gu)].map(match=>match[0]);

export function planMeasuredCaptionPages(scene,time,presentation,fontBytes){
  if(Array.isArray(scene.captions))return scene.captions;
  if(!time.words?.length)return [];
  if(!fontBytes?.length)throw Error('CAPTION_FONT_REQUIRED');
  const fps=time.fps??30;
  const durationFrames=Math.ceil((time.endMs-time.startMs)/1000*fps);
  const words=time.words.flatMap(word=>{
    const parts=tokens(word.text);
    return parts.map((text,i)=>({
      text,
      start_frame:((word.startMs-time.startMs)+(word.endMs-word.startMs)*i/parts.length)*fps/1000,
      end_frame:((word.startMs-time.startMs)+(word.endMs-word.startMs)*(i+1)/parts.length)*fps/1000,
    }));
  });
  if(!words.length)throw Error('CAPTION_WORD_TIMING_INVALID');
  const font=fontkit.create(fontBytes),fontSize=presentation.caption.font_size_px;
  const measure=text=>font.layout(text).positions.reduce((width,position)=>width+position.xAdvance,0)*fontSize/font.unitsPerEm;
  const caption={text:time.words.map(word=>word.text).join(' '),words,start_frame:Math.max(0,Math.floor(words[0].start_frame)),end_frame:durationFrames};
  const pages=paginateCaption(scene,presentation,size,caption,measure);
  // Keep one page on screen until the next starts. The old browser-only pager
  // left blank frames between the measured last word and the next first word.
  for(let i=0;i<pages.length-1;i++){
    const next=pages[i+1],boundary=Math.min(durationFrames-1,Math.max(pages[i].start_frame+1,Math.round(next.words[0].start_frame)));
    pages[i].end_frame=boundary;
    next.start_frame=boundary;
  }
  for(const page of pages){
    if(page.end_frame<=page.start_frame)throw Error('CAPTION_PAGE_DURATION_INVALID');
    validateCaptionWords(page);
  }
  return pages;
}

// hiddenUntilMs: the series cover covers the start of the video; a subtitle is neither drawn nor listed under it.
export function captionCuesForEpisode(rows,hiddenUntilMs=0){
  const cues=[];
  for(const {time,pages}of rows){
    const fps=time.fps??30,offset=time.startMs;
    for(const page of pages){
      if(!page.resolved_layout?.lines?.length)throw Error('CAPTION_LAYOUT_MISSING');
      // Scene cuts follow measured millisecond boundaries, which need not land
      // on a video frame. Never let a rounded caption frame cross the cut.
      const startMs=Math.max(time.startMs,hiddenUntilMs,offset+page.start_frame/fps*1000);
      const endMs=Math.min(time.endMs,offset+page.end_frame/fps*1000);
      if(endMs<=hiddenUntilMs)continue;
      if(endMs<=startMs || (cues.length&&startMs<cues.at(-1).endMs-0.1))
        throw Error('CAPTION_CUE_TIME_INVALID');
      cues.push({startMs,endMs,text:page.resolved_layout.lines.join('\n')});
    }
  }
  return cues;
}

export function captionsToSrt(cues){
  const stamp=ms=>new Date(Math.round(ms)).toISOString().slice(11,23).replace('.',',');
  return cues.map((cue,index)=>`${index+1}\n${stamp(cue.startMs)} --> ${stamp(cue.endMs)}\n${cue.text}`).join('\n\n')+'\n';
}
