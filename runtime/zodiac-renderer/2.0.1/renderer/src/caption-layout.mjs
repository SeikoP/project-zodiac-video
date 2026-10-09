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
  const zone=resolveCaptionZone(scene,presentation,video), lines=[];
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
