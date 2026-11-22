// Palette roles apply only to explicitly tagged source elements; actor identity stays baked.
import {createHash} from 'node:crypto';
const make=(id,title,canvas,ink,primary,secondary,accent)=>Object.freeze({format:'zodiac-visual-theme@1',id,title,canvas,ink,primary,secondary,accent,surface:'#FFFDF9',surface_alt:secondary,line:ink,muted_ink:'#59636E',caption:'#FFFDF9',caption_ink:'#15232D',human_review:'PENDING'});
export const THEMES=Object.freeze({
 light:make('light','Giấy sáng tương thích','#fff9ef','#243540','#F2B66D','#80BDB1','#92502c'),
 dark:make('dark','Tối tương thích','#18232f','#f6eee3','#7ABBB9','#E5AE62','#e6b875'),
 'apricot-campus':make('apricot-campus','Mơ ấm đời thường','#FFF8EE','#2B2B37','#F2B66D','#80BDB1','#E26E72'),
 'rose-social':make('rose-social','Hồng trêu ghẹo','#FFF2F4','#342B39','#D96B87','#A989D2','#ECAF71'),
 'indigo-noir':make('indigo-noir','Chàm đêm','#161C2B','#F7F3EB','#7ABBB9','#E5AE62','#E87983'),
});
export function resolvePaletteSvg(svg,themeId){
 const theme=THEMES[themeId];if(!theme)throw Error('VISUAL_THEME_UNKNOWN');
 return svg.replace(/<[^>]+>/gu,tag=>{
  for(const attr of ['fill','stroke']){
   const match=tag.match(new RegExp('data-palette-'+attr+'="([a-z_]+)"','u'));if(!match)continue;
   const color=theme[match[1]];if(typeof color!=='string'||!/^#[0-9a-f]{6}$/iu.test(color))throw Error('VISUAL_PALETTE_ROLE_UNKNOWN '+match[1]);
   const replacement=attr+'="'+color+'"';tag=new RegExp('\\s'+attr+'="[^"]*"','u').test(tag)?tag.replace(new RegExp('\\s'+attr+'="[^"]*"','u'),' '+replacement):tag.replace(/\s*\/?>$/u,ending=>' '+replacement+ending);
  }
  return tag;
 });
}
export const themeFingerprint=id=>{if(!THEMES[id])throw Error('VISUAL_THEME_UNKNOWN');return createHash('sha256').update(JSON.stringify(THEMES[id])).digest('hex');};
