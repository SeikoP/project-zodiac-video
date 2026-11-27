import {resolvePaletteSvg} from './visual_themes.mjs';
// Intro communicates the approved episode TOPIC, not the clickbait hook.
// Designed as a non-time-shifting overlay. The voice and captions start at frame zero.
const escape=text=>String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const SIGNS=new Set(['Bạch Dương','Kim Ngưu','Song Tử','Cự Giải','Sư Tử','Xử Nữ','Thiên Bình','Bọ Cạp','Nhân Mã','Ma Kết','Bảo Bình','Song Ngư']);
// Hand-drawn, resolution-independent zodiac glyphs. No OS font fallback or arbitrary monograms.
const ZODIAC_PATHS={
 'Bạch Dương':'M50 85 V40 C50 10 25 7 15 25 C4 46 23 60 35 58 M50 40 C50 10 75 7 85 25 C96 46 77 60 65 58',
 'Kim Ngưu':'M13 23 C26 36 38 40 50 40 C62 40 74 36 87 23 M31 25 C27 5 13 10 13 24 M69 25 C73 5 87 10 87 24 M50 42 A26 26 0 1 0 50 94 A26 26 0 1 0 50 42',
 'Song Tử':'M24 18 Q50 27 76 18 M24 82 Q50 73 76 82 M35 21 V79 M65 21 V79',
 'Cự Giải':'M18 29 C36 9 68 9 85 29 M82 71 C64 91 32 91 15 71 M27 38 A13 13 0 1 0 27 64 A13 13 0 1 0 27 38 M73 38 A13 13 0 1 1 73 64 A13 13 0 1 1 73 38',
 'Sư Tử':'M40 70 C20 70 11 56 17 38 C23 19 48 14 61 32 C71 48 51 60 53 74 C56 93 87 94 88 64 M44 50 A16 16 0 1 1 44 18 A16 16 0 1 1 44 50',
 'Xử Nữ':'M15 79 V28 Q15 16 25 16 Q35 16 35 28 V78 M35 29 Q35 16 45 16 Q55 16 55 29 V78 M55 28 Q55 16 65 16 Q75 16 75 29 V67 Q75 82 85 66 Q92 55 83 46',
 'Thiên Bình':'M14 76 H86 M14 60 H86 M29 60 C22 52 25 27 50 26 C75 27 78 52 71 60',
 'Bọ Cạp':'M12 68 V24 Q12 13 23 13 Q34 13 34 24 V68 M34 24 Q34 13 45 13 Q56 13 56 24 V68 M56 24 Q56 13 67 13 Q78 13 78 24 V76 L89 88 M78 76 L78 90 M78 76 L93 76',
 'Nhân Mã':'M20 81 L81 20 M48 20 H81 V53 M16 47 L54 85',
 'Ma Kết':'M16 25 V73 M16 25 C27 12 40 23 40 42 V73 M40 42 C46 22 63 26 66 49 C69 63 57 79 72 85 C88 90 92 65 76 62',
 'Bảo Bình':'M12 35 L26 25 L39 39 L52 25 L65 39 L79 25 L89 32 M12 69 L26 59 L39 73 L52 59 L65 73 L79 59 L89 66',
 'Song Ngư':'M25 16 C44 30 44 70 25 84 M75 16 C56 30 56 70 75 84 M17 50 H83'
};
export function zodiacGlyph(sign,stroke='#2F3C44'){
 const path=ZODIAC_PATHS[sign];
 if(!path)throw Error('VISUAL_ZODIAC_GLYPH_UNKNOWN');
 return `<svg data-zodiac-glyph="${escape(sign)}" aria-label="${escape(sign)}" viewBox="0 0 100 100" width="150" height="150" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="${path}" stroke="${stroke}" stroke-width="7" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}
export function validateSeriesOpening(opening,video) {
 if(opening==null)return null; // Old authored videos remain valid; no silent hook replacement.
 const keys=Object.keys(opening).sort().join(',');
 if(keys!=='duration_frames,format,series,sign,topic,transition_frames'||
    opening.format!=='zodiac-series-opening@1'||opening.series!=='12 CUNG HOÀNG ĐẠO'||
    !SIGNS.has(opening.sign)||
    typeof opening.topic!=='string'||opening.topic.length>65||
    !/^(Cách|Khi) /u.test(opening.topic)||!opening.topic.includes(opening.sign)||
    /[<>\n\r]/u.test(opening.topic)||
    ![24,30].includes(video?.fps)||!Number.isInteger(opening.duration_frames)||
    opening.duration_frames<Math.round(.8*video.fps)||
    opening.duration_frames>Math.round(2.5*video.fps)||
    !Number.isInteger(opening.transition_frames)||
    opening.transition_frames<3||opening.transition_frames>15||
    opening.transition_frames>=opening.duration_frames){
  throw Error('VISUAL_SERIES_OPENING_INVALID');
 }
 return opening;
}
export function openingHtml(opening,palette,scene=null,assets={},themeId='light',episodeScenes=null){
 if(!opening)return '';
 // The cover is the series' pinned paper-doodle design (as the Remotion covers): its colours do not follow the editor theme.
 const paper='#F6F0E6',ink='#2F3C44',card='#FFFDF9',ochre='#F2C45C';
 themeId='light';
 const warm='#D0C1B3';
 const noteOutline='M14 10 C157 4 280 14 433 7 S698 8 862 5 Q870 5 870 15 C874 86 865 152 873 227 Q873 264 878 292 Q864 304 844 307 C701 301 572 312 430 305 S164 310 17 303 Q9 302 9 291 C5 214 13 137 7 57 Q4 26 14 10 Z';
 const identityOutline='M24 7 C211 3 333 10 482 6 S716 8 834 5 Q852 7 851 24 C847 51 855 82 850 105 Q848 124 829 123 C649 128 460 120 277 125 S95 121 25 124 Q8 122 9 106 C12 82 5 48 10 25 Q11 10 24 7 Z';
 const actors=(scene?.entities??[]).filter(e=>e.kind==='character');
 const positions=actors.length===1?[{x:275,y:722,w:590,h:720}]:[{x:170,y:747,w:565,h:710},{x:602,y:825,w:395,h:570}];
 const pictures=actors.slice(0,2).map((entity,i)=>{
  const state=entity.states[entity.initial_state];
  const asset=assets[state?.asset];
  if(!asset?.svg)throw Error('VISUAL_COVER_NATIVE_ACTOR_MISSING '+entity.id);
  // Same source SVG as the underlying scene. No new generated characters, hair, or clothes.
  const src=Buffer.from(resolvePaletteSvg(asset.svg,themeId)).toString('base64');
  const b=positions[i];
  return `<img data-cover-native-actor="${escape(entity.id)}" draggable="false" src="data:image/svg+xml;base64,${src}" style="position:absolute;left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px;object-fit:contain"/>`;
 }).join('');
 // A few props the video really uses (any scene), each drawn from its own scene asset, fill the empty margins of the cover.
 const seen=new Set();
 const propSpots=[{x:22,y:1130,w:175,h:215,r:-8},{x:885,y:640,w:150,h:180,r:10},{x:22,y:830,w:140,h:170,r:-6}];
 const props=[];
 const physical=e=>(e.visual_role==='interactive_prop'&&e.kind==='object'&&!String(e.id).startsWith('graphic_'))||e.kind==='prop';
 const candidates=[];
 for(const test of [physical])for(const sc of (episodeScenes??(scene?[scene]:[])))for(const e of sc.entities??[])if(test(e))candidates.push(e);
 for(const e of candidates){
  if(props.length>=propSpots.length)break;
  const st=Object.values(e.states??{}).find(s=>s.visible!==false&&assets[s.asset]?.svg);
  if(!st||seen.has(st.asset))continue;
  seen.add(st.asset);
  const p=propSpots[props.length];
  props.push(`<img data-cover-native-prop="${escape(e.id)}" draggable="false" src="data:image/svg+xml;base64,${Buffer.from(resolvePaletteSvg(assets[st.asset].svg,themeId)).toString('base64')}" style="position:absolute;left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;object-fit:contain;transform:rotate(${p.r}deg)"/>`);
 }
 const prop=props.join('');
 // Cover title changes semantics from hook to the current episode's topic, but preserves
 // the approved crooked-paper-note, identity strip, paper relief, and native scene visuals.
 return `<div id="series-opening" data-cover-opening="series-topic" data-cover-design="zodiac-paper-doodle-meme-v4"
 data-opening-duration="${opening.duration_frames}" style="position:absolute;left:0;top:0;width:1080px;height:1470px;z-index:80;pointer-events:none;opacity:1;background:${paper};font-family:ZodiacCaption,Arial,sans-serif;color:${ink}">
 <svg aria-hidden="true" viewBox="0 0 860 130" preserveAspectRatio="none" style="position:absolute;top:250px;left:110px;width:860px;height:130px;overflow:visible">
 <path d="${identityOutline}" fill="${warm}" transform="translate(6 10)"/>
 <path d="${identityOutline}" fill="${ochre}" stroke="${ink}" stroke-width="6" vector-effect="non-scaling-stroke"/></svg>
 <div style="position:absolute;top:248px;left:110px;width:860px;height:132px;display:flex;align-items:center;justify-content:center;gap:24px;font-size:65px;line-height:1;box-sizing:border-box">
 ${escape(opening.sign)} ${zodiacGlyph(opening.sign,ink).replace('width="150" height="150"','width="83" height="83"')}</div>
 <svg aria-hidden="true" viewBox="0 0 880 312" preserveAspectRatio="none" style="position:absolute;top:420px;left:72px;width:936px;height:312px;overflow:visible;transform:rotate(-2deg)">
 <path d="${noteOutline}" fill="${warm}" transform="translate(16 24)"/>
 <path d="${noteOutline}" fill="${card}" stroke="${ink}" stroke-width="6" vector-effect="non-scaling-stroke"/></svg>
 <div style="position:absolute;top:422px;left:84px;width:914px;height:305px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;padding:19px 45px;font-size:${opening.topic.length>35?70:82}px;line-height:1.09;font-weight:400;text-align:center;text-wrap:balance;transform:rotate(-2deg)">
 ${escape(opening.topic)}</div>
 ${pictures}${prop}
 ${props.length?'':`<svg aria-hidden="true" style="position:absolute;left:128px;top:1310px;width:185px;height:75px" viewBox="0 0 185 75" fill="none"><path d="M6 63 Q88 12 176 58" stroke="${ochre}" stroke-width="14" stroke-linecap="round"/></svg>`}
 <svg aria-hidden="true" style="position:absolute;left:850px;top:777px;width:70px;height:77px" viewBox="0 0 70 77" fill="none"><path d="M36 70 L44 44 L68 33 L43 27 L35 3 L27 28 L4 34 L27 43 Z" stroke="${ink}" stroke-width="5"/></svg>
 </div>`;
}

export function openingOpacity(opening,frame){
 if(!opening||frame>=opening.duration_frames)return 0;
 const fadeFrom=opening.duration_frames-opening.transition_frames;
 return frame<=fadeFrom?1:(opening.duration_frames-frame)/opening.transition_frames;
}
