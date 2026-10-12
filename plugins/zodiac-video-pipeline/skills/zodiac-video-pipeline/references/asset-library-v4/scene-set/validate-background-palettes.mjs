import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveBackgroundPalette} from './compile-background-palette.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const IDS=['warm-paper','mint-air','blush-paper','cool-study','sand-coral','neutral-graphite'];
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);
const lum=hex=>rgb(hex).map(v=>v<=.03928?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const [hi,lo]=[lum(a),lum(b)].sort((x,y)=>y-x);return (hi+.05)/(lo+.05);};
export function validateBackgroundPalettes(registry){
 const issues=[];
 if(registry?.format!=='zodiac-background-palette-registry@1')issues.push('format');
 if(JSON.stringify(Object.keys(registry?.palettes??{}))!==JSON.stringify(IDS))issues.push('ids');
 for(const id of IDS){
  let p;try{p=resolveBackgroundPalette(id,registry);}catch(e){issues.push(e.message);continue;}
  if(contrast(p.roles.wall,p.roles.ink)<4.5)issues.push(id+'/wall-ink-contrast');
  if(contrast(p.roles.floor,p.roles.ink)<4.0)issues.push(id+'/floor-ink-contrast');
 }
 return {status:issues.length?'BLOCKED':'PASS',palettes:IDS.length,issues};
}
export async function loadAndValidateBackgroundPalettes(file=path.join(here,'background-palettes.json')){
 return validateBackgroundPalettes(JSON.parse(await readFile(file,'utf8')));
}
