import {CAPTION_STROKE_PX, CAPTION_BOUNCE_PX} from './caption-karaoke.mjs';

export function resolveCaptionZone(scene, presentation={}, video={width:1080,height:1920}) {
  const typography=presentation.caption ?? {};
  const fontSize=typography.font_size_px ?? 84, lineHeight=typography.line_height ?? 1.15;
  const maxLines=typography.max_lines ?? 2, padding=typography.padding_px ?? 12;
  const source=scene.layout_contract?.caption_safe_zone ?? typography.safe_zone;
  const zone=source ?? {x:video.width*.075,y:video.height*.74,width:video.width*.80,height:fontSize*lineHeight*maxLines+2*padding};
  if (![zone.x,zone.y,zone.width,zone.height,fontSize,lineHeight,maxLines,padding].every(Number.isFinite) || zone.x<0 || zone.y<0 || zone.width<=2*padding || zone.height<=2*padding || zone.x+zone.width>video.width || zone.y+zone.height>video.height || fontSize<=0 || lineHeight<=0 || maxLines<1 || !Number.isInteger(maxLines) || padding<0)
    throw new Error(`CAPTION_SAFE_ZONE_INVALID scene=${scene.id}`);
  return {...zone,padding,fontSize,lineHeight,maxLines,source:source && source===scene.layout_contract?.caption_safe_zone?'scene':source?'presentation':'tiktok-default'};
}

export function resolveCaptionLayout(scene,presentation,video,text,measure) {
  const source=resolveCaptionZone(scene,presentation,video);
  const zone={...source,padding:Math.max(source.padding,CAPTION_STROKE_PX+CAPTION_BOUNCE_PX)}, lines=[];
  for (const paragraph of text.split('\n')) {
    let line='';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (measure(word)>zone.width-2*zone.padding) throw new Error(`CAPTION_OVERFLOW scene=${scene.id} word=${word}`);
      const next=line?line+' '+word:word;
      if (line && measure(next)>zone.width-2*zone.padding) {lines.push(line);line=word;} else line=next;
    }
    lines.push(line);
  }
  const height=lines.length*zone.fontSize*zone.lineHeight;
  if (lines.length>zone.maxLines || height>zone.height-2*zone.padding)
    throw new Error(`CAPTION_OVERFLOW scene=${scene.id} actual_lines=${lines.length} max_lines=${zone.maxLines}`);
  return {zone,lines,x:zone.x+zone.padding,y:zone.y+zone.height-zone.padding-height,width:zone.width-2*zone.padding,height};
}


export function paginateCaption(scene,presentation,video,caption,measure) {
  const layout=text=>resolveCaptionLayout(scene,presentation,video,text,measure);
  try{return [{...caption,resolved_layout:layout(caption.text)}];}
  catch(error){if(!String(error.message).startsWith('CAPTION_OVERFLOW')||!caption.words)throw error;}
  const tokens=caption.text.split(/\s+/u).filter(Boolean),pages=[];
  let from=0,wordOffset=0;
  while(from<tokens.length){
    let end=from,boundary=from;
    for(let to=from+1;to<=tokens.length;to++){
      try{layout(tokens.slice(from,to).join(' '));end=to;}
      catch(error){if(!String(error.message).startsWith('CAPTION_OVERFLOW'))throw error;break;}
      if(/[,;:.!?…][”’"')\]]*$/u.test(tokens[to-1]))boundary=to;
    }
    if(end===from)throw Error('CAPTION_OVERFLOW scene='+scene.id+' word='+tokens[from]);
    if(end<tokens.length&&boundary>from)end=boundary;
    const text=tokens.slice(from,end).join(' ');
    const count=(text.match(/[\p{L}\p{N}_]+/gu)??[]).length;
    const words=caption.words.slice(wordOffset,wordOffset+count);
    if(!words.length)throw Error('CAPTION_WORD_TIMING_INVALID');
    const start=pages.length?Math.round(words[0].start_frame):caption.start_frame;
    const stop=end===tokens.length?caption.end_frame:Math.round(words.at(-1).end_frame);
    pages.push({...caption,text,words,start_frame:start,end_frame:Math.max(start+1,stop),resolved_layout:layout(text)});
    from=end;wordOffset+=count;
  }
  return pages;
}
