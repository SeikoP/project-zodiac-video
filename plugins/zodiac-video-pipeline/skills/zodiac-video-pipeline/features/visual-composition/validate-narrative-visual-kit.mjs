// Mechanical kit lint for a hand-drawn narrative visual. It constrains form
// (style, safety, size, placement), never content. Pure: no I/O, no stroke generation.
export const KIT_MIN_AREA=30000;
const issue=(issues,code,detail={})=>issues.push({code,...detail});
const area=r=>r.width*r.height;
const overlap=(a,b)=>Math.max(0,Math.min(a.x+a.width,b.x+b.width)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.height,b.y+b.height)-Math.max(a.y,b.y));
const valid=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;
const normHex=c=>{const h=c.trim().toLowerCase();return /^#[0-9a-f]{3}$/.test(h)?'#'+[...h.slice(1)].map(x=>x+x).join(''):h;};
const colors=svg=>{const out=[];for(const m of svg.matchAll(/\b(?:fill|stroke|stop-color)\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\)|[a-zA-Z]+)/g))out.push(m[1]);return out;};
/** @param {string} svg @param {{palette?:string[],strokeWidths?:number[],canvas?:{width:number,height:number},rect?:object,captionSafeZone?:object,minArea?:number,minPaths?:number}} o */
export function validateNarrativeVisualKit(svg,o={}){
 const issues=[],s=String(svg??'');
 if(!/<svg[\s>]/i.test(s)){issue(issues,'NARRATIVE_KIT_NOT_SVG');return issues;}
 if(/<\s*(text|tspan|textPath)\b/i.test(s))issue(issues,'NARRATIVE_KIT_TEXT_GLYPHS');
 if(/<\s*(filter|fe[A-Z]\w*|script|foreignObject|image|animate\w*|set)\b/.test(s)||/\bfilter\s*[:=]/i.test(s))issue(issues,'NARRATIVE_KIT_FORBIDDEN_ELEMENT');
 const vb=/viewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(s);
 if(!vb||!(Number(vb[3])>0)||!(Number(vb[4])>0))issue(issues,'NARRATIVE_KIT_VIEWBOX_INVALID');
 const pathCount=(s.match(/<\s*path\b/gi)||[]).length,minPaths=o.minPaths??2;
 if(pathCount<minPaths)issue(issues,'NARRATIVE_KIT_FOCAL_PATHS_TOO_FEW',{found:pathCount,required:minPaths});
 if(Array.isArray(o.palette)&&o.palette.length){
  const allowed=new Set(o.palette.map(normHex));
  for(const c of new Set(colors(s))){
   const v=c.toLowerCase();if(['none','transparent','currentcolor','inherit'].includes(v))continue;
   if(v.startsWith('url'))continue;
   if(!allowed.has(normHex(v)))issue(issues,'NARRATIVE_KIT_COLOR_OFF_PALETTE',{color:c});
  }
 }
 if(Array.isArray(o.strokeWidths)&&o.strokeWidths.length){
  for(const m of s.matchAll(/stroke-width\s*[:=]\s*["']?\s*([\d.]+)/g)){
   const w=Number(m[1]);if(!o.strokeWidths.some(a=>Math.abs(a-w)<1e-6))issue(issues,'NARRATIVE_KIT_STROKE_OFF_TOKEN',{width:w});
  }
 }
 if(o.rect!==undefined){
  if(!valid(o.rect))issue(issues,'NARRATIVE_KIT_PLACEMENT_INVALID');
  else{
   if(area(o.rect)<(o.minArea??KIT_MIN_AREA))issue(issues,'NARRATIVE_KIT_AREA_TOO_SMALL',{area:area(o.rect),required:o.minArea??KIT_MIN_AREA});
   const c=o.canvas;
   if(c&&c.width>0&&c.height>0&&(o.rect.x<0||o.rect.y<0||o.rect.x+o.rect.width>c.width||o.rect.y+o.rect.height>c.height))issue(issues,'NARRATIVE_KIT_OUT_OF_CANVAS');
   if(valid(o.captionSafeZone)&&overlap(o.rect,o.captionSafeZone)>0)issue(issues,'NARRATIVE_KIT_CAPTION_SAFE_ZONE_OVERLAP');
  }
 }
 return issues;
}
