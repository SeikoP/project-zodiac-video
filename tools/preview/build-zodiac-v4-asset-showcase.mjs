#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileCharacterSvg} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const skill=path.join(repo,'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline');
const lib=path.join(skill,'references/asset-library-v4');
const outDir=path.join(repo,'docs/previews');
const read=rel=>readFile(path.join(lib,rel),'utf8');
const json=async rel=>JSON.parse(await read(rel));
const esc=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

function nestedSvg(raw,{x,y,width,height,opacity=1}){
  const viewBox=raw.match(/viewBox="([^"]+)"/u)?.[1]??'0 0 100 100';
  const inner=raw.replace(/^\s*<svg[^>]*>/u,'').replace(/<\/svg>\s*$/u,'');
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}">${inner}</svg>`;
}
const rounded=(x,y,w,h,stroke='#2F3C44',dash='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFDF9" fill-opacity=".82" stroke="${stroke}" stroke-width="3" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
const chip=(x,y,text,fill='#FFFDF9')=>`<g><rect x="${x}" y="${y-26}" width="${Math.max(96,text.length*12+26)}" height="34" rx="15" fill="${fill}" stroke="#2F3C44" stroke-width="2"/><text x="${x+13}" y="${y-3}" class="small">${esc(text)}</text></g>`;

function effectIcon(effectCatalog,id,{x,y,size=90,label=id}){
  const item=effectCatalog.effects[id];
  if(!item)throw new Error('Missing effect '+id);
  const paths=item.paths.map(p=>`<path d="${p.d}" fill="${p.fill??'none'}" stroke="${p.stroke??'none'}" stroke-width="${p.width??0}" stroke-linecap="round" stroke-linejoin="round"/>`).join('');
  return `<g>${nestedSvg(`<svg viewBox="0 0 100 100">${paths}</svg>`,{x,y,width:size,height:size})}<text x="${x+size/2}" y="${y+size+20}" class="tiny" text-anchor="middle">${esc(label)}</text></g>`;
}

const sceneSets=await json('scene-set/index.json');
const accents=await json('scene-set/accents/index.json');
const chars=await json('characters/components/catalog.json');
const props=await json('props/index.json');
const effects=await json('effects/meme-effect-catalog.json');
const ornaments=await json('effects/ornament-index.json');
const layouts=await json('shot-layouts/index.json');
const mechanics=await json('mechanics/index.json');
const memes=await json('memes/index.json');

const classroom=await read('scene-set/frames/scene-set-classroom.svg');
const board=await read('scene-set/accents/scene-accent-board.svg');
const clock=await read('scene-set/accents/scene-accent-clock.svg');
const shelf=await read('scene-set/accents/scene-accent-shelf.svg');
const phonePing=await read('props/phone-ping.svg');
const phoneSilent=await read('props/phone-silent.svg');
const pants=await read('props/pants.svg');
const notebook=await read('props/notebook.svg');
const pen=await read('props/pen.svg');
const backpack=await read('props/backpack.svg');
const reaction=await read('effects/reaction-accent.svg');

const lead=compileCharacterSvg({
  entity_id:'lead',body_profile:'lean_tall',hair_id:'spiky-overthink',face_profile_id:'freckled',
  outfit_id:'gemini-basic-clean',shirt_color_id:'teal',accessory_id:'round-glasses',variant_seed:'showcase-lead'
},{pose_id:'explain',expression_id:'smug'}).svg;
const peerA=compileCharacterSvg({
  entity_id:'peer-a',body_profile:'round_soft',hair_id:'lopsided-bob',face_profile_id:'wide-set',
  outfit_id:'taurus-basic-clean',shirt_color_id:'coral',accessory_id:'none',variant_seed:'showcase-a'
},{pose_id:'offer',expression_id:'embarrassed'}).svg;
const peerB=compileCharacterSvg({
  entity_id:'peer-b',body_profile:'stocky_short',hair_id:'antenna-short',face_profile_id:'close-set',
  outfit_id:'leo-basic-clean',shirt_color_id:'ochre',accessory_id:'star-hair-clip',variant_seed:'showcase-b'
},{pose_id:'text-phone',expression_id:'side-eye'}).svg;

const sceneThumbs=await Promise.all(sceneSets.scene_sets.map(async row=>({id:row.id.replace('scene-set-',''),raw:await read('scene-set/'+row.path)})));
const semanticEffects=[
  ['sparkle-burst','surprise'],['contact-fan-pressure','pressure'],['question-pop','confusion'],
  ['blush-marks','embarrass'],['stress-ticks','tension'],['offer-impact','emphasis'],['motion-dash','motion']
];

const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">
<style>
@font-face{font-family:'Patrick Hand';src:local('Patrick Hand')}
text{font-family:'Patrick Hand','Segoe Print',cursive;fill:#2F3C44}
.title{font-size:44px;font-weight:700;letter-spacing:.5px}.h2{font-size:31px;font-weight:700}.body{font-size:27px}.small{font-size:21px}.tiny{font-size:17px}
.diag{fill:none;stroke:#E97A66;stroke-width:3;stroke-dasharray:10 8}
.soft{fill:#FFFDF9;fill-opacity:.82;stroke:#D0C1B3;stroke-width:3}
</style>
<rect width="1080" height="1920" fill="#F6F0E6"/>
<text x="48" y="64" class="body" opacity=".72">✦ bungmoto</text>
<text x="540" y="62" class="title" text-anchor="middle">ASSET V4 · FULL FRAME DIAGNOSTIC</text>
<text x="540" y="99" class="small" text-anchor="middle">actual assets · actual compiler · intentionally above production density</text>
${chip(50,134,'COVER / FRAME 0','#F2C45C')}
${chip(265,134,'LAYOUT · three-person-comparison','#8EC0B9')}
${chip(650,134,'MECHANIC · compare-group','#E97A66')}

<!-- Full production scene-set stage -->
${nestedSvg(classroom,{x:0,y:140,width:1080,height:1240})}
<text x="540" y="235" class="title" text-anchor="middle">3 KIỂU PHẢN ỨNG</text>
<text x="540" y="270" class="small" text-anchor="middle">cover identity lives inside the first video frame</text>
${nestedSvg(board,{x:280,y:315,width:520,height:210})}
${nestedSvg(shelf,{x:70,y:360,width:165,height:76,opacity:.9})}
${nestedSvg(clock,{x:855,y:338,width:105,height:105,opacity:.95})}
<g><rect x="330" y="482" width="420" height="34" rx="15" fill="#FFFDF9" fill-opacity=".86"/><text x="540" y="505" class="tiny" text-anchor="middle">SCENE ACCENTS · wall-contained (board / shelf / clock)</text></g>

<!-- Scene direction diagnostic slots -->
<rect x="58" y="615" width="315" height="500" rx="30" class="diag"/>
<rect x="382" y="535" width="330" height="520" rx="30" class="diag"/>
<rect x="706" y="620" width="315" height="500" rx="30" class="diag"/>
${chip(74,640,'peer_a · offer-object')}
${chip(405,560,'lead · explain')}
${chip(727,645,'peer_b · text-phone')}
${nestedSvg(peerA,{x:72,y:650,width:300,height:438})}
${nestedSvg(lead,{x:390,y:570,width:315,height:460})}
${nestedSvg(peerB,{x:712,y:655,width:300,height:438})}

<!-- Contact / prop / meme -->
${nestedSvg(phonePing,{x:825,y:892,width:82,height:92})}
${nestedSvg(reaction,{x:820,y:520,width:160,height:180,opacity:.95})}

<!-- Story object state progression -->
${rounded(385,1052,330,176,'#8EC0B9')}
<text x="550" y="1083" class="h2" text-anchor="middle">STORY OBJECT</text>
<text x="550" y="1110" class="tiny" text-anchor="middle">semantic mechanism · not background</text>
${nestedSvg(phonePing,{x:425,y:1120,width:72,height:82})}
<text x="535" y="1166" class="body" text-anchor="middle">→</text>
${nestedSvg(phoneSilent,{x:575,y:1120,width:72,height:82})}
<text x="461" y="1214" class="tiny" text-anchor="middle">ping</text>
<text x="611" y="1214" class="tiny" text-anchor="middle">silent</text>

<!-- Ordinary story props/contact -->
${rounded(62,1058,285,175,'#F2C45C')}
<text x="205" y="1088" class="h2" text-anchor="middle">PROP / CONTACT</text>
${nestedSvg(notebook,{x:84,y:1110,width:92,height:86})}
${nestedSvg(pen,{x:166,y:1120,width:62,height:74})}
${nestedSvg(pants,{x:238,y:1103,width:82,height:95})}
<text x="205" y="1217" class="tiny" text-anchor="middle">notebook · pen · meme/contact</text>

<!-- Main semantic effects -->
${effectIcon(effects,'question-pop',{x:730,y:1075,size:84,label:'confusion'})}
${effectIcon(effects,'stress-ticks',{x:865,y:1075,size:84,label:'tension'})}

<!-- Runtime caption safe area -->
<rect x="78" y="1408" width="924" height="174" rx="18" fill="#FFFDF9" fill-opacity=".64" stroke="#8EC0B9" stroke-width="3" stroke-dasharray="12 8"/>
<text x="98" y="1438" class="tiny">CAPTION SAFE ZONE · runtime</text>
<text x="540" y="1505" text-anchor="middle" style="font-size:54px;font-weight:700;paint-order:stroke;stroke:#FFFDF9;stroke-width:4px">“Ai là người <tspan fill="#E97A66">phản ứng</tspan> mạnh nhất?”</text>
<text x="540" y="1550" class="small" text-anchor="middle">Patrick Hand · max 2 lines · avoids active visual boxes</text>

<!-- Scene-set family thumbnails -->
<text x="48" y="1620" class="h2">SCENE-SET FAMILY · 6</text>
${sceneThumbs.map((row,i)=>{const x=45+i*170;return nestedSvg(row.raw,{x,y:1635,width:145,height:92})+`<text x="${x+72}" y="1744" class="tiny" text-anchor="middle">${esc(row.id)}</text>`;}).join('')}

<!-- Semantic effects tray -->
<text x="48" y="1780" class="h2">SEMANTIC EFFECTS · 7</text>
${semanticEffects.map(([id,label],i)=>effectIcon(effects,id,{x:72+i*138,y:1792,size:72,label})).join('')}

<!-- Footer inventory -->
<line x1="48" y1="1892" x2="1032" y2="1892" stroke="#D0C1B3" stroke-width="3"/>
<text x="48" y="1917" class="tiny">6 body · 10 hair · 4 face · 17 outfits · 21 poses · 9 expressions · ${props.assets.length} props · ${ornaments.ornaments.length} ornaments · ${accents.accents.length} accents · ${layouts.frames.length} layouts · ${mechanics.mechanics.length} mechanics · ${memes.compositions?.length??memes.templates?.length??11} memes</text>
<text x="1032" y="1778" class="tiny" text-anchor="end">DIAGNOSTIC ONLY · density intentionally exceeds production caps</text>
</svg>`;

const manifest={
  format:'zodiac-v4-full-asset-showcase@1',
  canvas:{width:1080,height:1920},
  diagnostic_only:true,
  production_density_valid:false,
  style_token:'zodiac-paper-doodle-meme-v4',
  font:'Patrick Hand',
  watermark:'✦ bungmoto',
  active_example:{scene_set:'scene-set-classroom',layout:'three-person-comparison',mechanics:['compare-group','offer-pants-for-embarrassment'],story_object:'phone ping → silent'},
  counts:{
    scene_sets:sceneSets.scene_sets.length,scene_accents:accents.accents.length,body_profiles:chars.body_profiles.length,
    hair:chars.hair.length,face_profiles:chars.face_profiles.length,outfits:chars.outfits.length,poses:chars.poses.length,
    expressions:chars.expressions.length,props:props.assets.length,ornaments:ornaments.ornaments.length,
    layouts:layouts.frames.length,mechanics:mechanics.mechanics.length,memes:memes.compositions?.length??memes.templates?.length??null
  },
  rendered_categories:['scene-set','scene-accent','cover-first-frame','three-character-layout','character-assembly','story-object','story-prop','contact-prop','meme-prop','semantic-effect','caption-safe-zone','watermark']
};

await mkdir(outDir,{recursive:true});
await writeFile(path.join(outDir,'zodiac-v4-full-asset-showcase.svg'),svg);
await writeFile(path.join(outDir,'zodiac-v4-full-asset-showcase.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('ZODIAC_V4_SHOWCASE_PASS '+JSON.stringify(manifest.counts));