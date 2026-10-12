#!/usr/bin/env node
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {compileCharacterSvg} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/characters/compile-character-assembly.mjs';
import {compileBackgroundPaletteSvg,resolveBackgroundPalette} from '../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/scene-set/compile-background-palette.mjs';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const skill=path.join(repo,'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline');
const lib=path.join(skill,'references/asset-library-v4');
const outDir=path.join(repo,'docs/previews');
const read=rel=>readFile(path.join(lib,rel),'utf8');
const json=async rel=>JSON.parse(await read(rel));
const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const nestedSvg=(raw,{x,y,width,height,opacity=1})=>{
 const viewBox=raw.match(/viewBox="([^"]+)"/u)?.[1]??'0 0 100 100';
 const inner=raw.replace(/^\s*<svg[^>]*>/u,'').replace(/<\/svg>\s*$/u,'');
 return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" opacity="${opacity}">${inner}</svg>`;
};
const styles=`<style>@font-face{font-family:'Patrick Hand';src:local('Patrick Hand')}text{font-family:'Patrick Hand','Segoe Print',cursive;fill:#2F3C44}.title{font-size:42px;font-weight:700}.h2{font-size:29px;font-weight:700}.body{font-size:25px}.small{font-size:20px}.tiny{font-size:16px}</style>`;
const box=(x,y,w,h,stroke='#D0C1B3')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#FFFDF9" fill-opacity=".84" stroke="${stroke}" stroke-width="3"/>`;
const label=(x,y,text)=>`<text x="${x}" y="${y}" class="tiny" text-anchor="middle">${esc(text)}</text>`;
const effectSvg=(row)=>`<svg viewBox="0 0 100 100">${(row.paths??[]).map(p=>`<path d="${p.d}" fill="${p.fill??'none'}" stroke="${p.stroke??'none'}" stroke-width="${p.width??0}" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;

const [sceneSets,accents,chars,props,effects,ornaments,layouts,mechanics,memes,palettes,metaphors,capabilities]=await Promise.all([
 json('scene-set/index.json'),json('scene-set/accents/index.json'),json('characters/components/catalog.json'),json('props/index.json'),
 json('effects/meme-effect-catalog.json'),json('effects/ornament-index.json'),json('shot-layouts/index.json'),json('mechanics/index.json'),
 json('memes/index.json'),json('scene-set/background-palettes.json'),json('visual-metaphors/index.json'),json('capability-index.json')
]);
const classroom=await read('scene-set/frames/scene-set-classroom.svg');
const board=await read('scene-set/accents/scene-accent-board.svg');
const clock=await read('scene-set/accents/scene-accent-clock.svg');
const classWindow=await read('scene-set/accents/scene-accent-class-window.svg');
const notebook=await read('props/notebook.svg');
const pen=await read('props/pen.svg');
const gift=await read('props/gift-box.svg');
const cup=await read('props/coffee-cup.svg');
const scaleIndex=metaphors.metaphors.find(x=>x.id==='balance-scale');
if(!scaleIndex)throw new Error('balance-scale metaphor missing');
const scaleStates=Object.fromEntries(await Promise.all(Object.entries(scaleIndex.states).map(async([id,row])=>[id,await read('visual-metaphors/'+row.path)])));

const lead=compileCharacterSvg({
 entity_id:'lead',body_profile:'lean_tall',hair_id:'spiky-overthink',face_profile_id:'freckled',
 outfit_id:'gemini-basic-clean',shirt_color_id:'teal',accessory_id:'round-glasses',variant_seed:'showcase-lead'
},{pose_id:'explain',expression_id:'smug'}).svg;
const redShirt=compileCharacterSvg({
 entity_id:'peer-a',body_profile:'round_soft',hair_id:'blocky-cut',face_profile_id:'wide-set',
 outfit_id:'taurus-basic-clean',shirt_color_id:'coral',accessory_id:'none',variant_seed:'showcase-red'
},{pose_id:'offer',expression_id:'embarrassed'}).svg;
const peerB=compileCharacterSvg({
 entity_id:'peer-b',body_profile:'stocky_short',hair_id:'antenna-short',face_profile_id:'close-set',
 outfit_id:'leo-basic-clean',shirt_color_id:'ochre',accessory_id:'star-hair-clip',variant_seed:'showcase-b'
},{pose_id:'text-phone',expression_id:'side-eye'}).svg;

const full=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${styles}
<rect width="1080" height="1920" fill="#F6F0E6"/>
<text x="48" y="62" class="body" opacity=".7">✦ bungmoto</text>
<text x="540" y="62" class="title" text-anchor="middle">ASSET V4 · FULL FRAME DIAGNOSTIC</text>
<text x="540" y="98" class="small" text-anchor="middle">actual compiler · actual assets · diagnostic density</text>
${nestedSvg(classroom,{x:0,y:125,width:1080,height:1190})}
<text x="540" y="220" class="title" text-anchor="middle">3 KIỂU PHẢN ỨNG</text>
${nestedSvg(board,{x:295,y:300,width:490,height:195})}
${nestedSvg(classWindow,{x:70,y:325,width:190,height:90})}
${nestedSvg(clock,{x:855,y:320,width:105,height:105})}
<text x="540" y="502" class="tiny" text-anchor="middle">SCENE SET + SPARSE IDENTITY CUES</text>

<rect x="55" y="585" width="310" height="485" rx="28" fill="none" stroke="#E97A66" stroke-width="3" stroke-dasharray="10 8"/>
<rect x="385" y="525" width="310" height="515" rx="28" fill="none" stroke="#8EC0B9" stroke-width="3" stroke-dasharray="10 8"/>
<rect x="715" y="590" width="310" height="480" rx="28" fill="none" stroke="#F2C45C" stroke-width="3" stroke-dasharray="10 8"/>
${nestedSvg(redShirt,{x:65,y:620,width:290,height:425})}
${nestedSvg(lead,{x:395,y:555,width:290,height:445})}
${nestedSvg(peerB,{x:725,y:625,width:290,height:425})}
${label(210,1085,'red shirt · blocky-cut · offer')}${label(540,1055,'lead · explain')}${label(870,1085,'peer · text-phone')}

${box(52,1120,300,210,'#F2C45C')}
<text x="202" y="1154" class="h2" text-anchor="middle">PROP / CONTACT</text>
${nestedSvg(notebook,{x:72,y:1174,width:78,height:74})}${nestedSvg(pen,{x:146,y:1182,width:58,height:68})}
${nestedSvg(gift,{x:216,y:1164,width:104,height:92})}
<text x="202" y="1300" class="tiny" text-anchor="middle">notebook · pen · gift-box</text>

${box(372,1120,656,210,'#8EC0B9')}
<text x="700" y="1152" class="h2" text-anchor="middle">VISUAL METAPHOR · balance-scale</text>
${['tilt_left','balanced','tilt_right'].map((id,i)=>nestedSvg(scaleStates[id],{x:405+i*205,y:1168,width:165,height:105})+label(488+i*205,1300,id)).join('')}

<rect x="78" y="1360" width="924" height="158" rx="18" fill="#FFFDF9" fill-opacity=".68" stroke="#8EC0B9" stroke-width="3" stroke-dasharray="12 8"/>
<text x="98" y="1389" class="tiny">CAPTION SAFE ZONE · runtime</text>
<text x="540" y="1455" text-anchor="middle" style="font-size:52px;font-weight:700;paint-order:stroke;stroke:#FFFDF9;stroke-width:4px">“Cân bên nào rồi lại <tspan fill="#E97A66">đổi ý</tspan>?”</text>
<text x="540" y="1498" class="small" text-anchor="middle">Patrick Hand · max 2 lines</text>

<text x="48" y="1570" class="h2">SEMANTIC EFFECT FAMILY</text>
${['sparkle-burst','contact-fan-pressure','stress-ticks','offer-impact','focus-halo-mark','comparison-bracket-mark','relief-wave-mark','alarm-zigzag-mark'].map((id,i)=>nestedSvg(effectSvg(effects.effects[id]),{x:45+i*128,y:1590,width:88,height:88})+label(89+i*128,1695,id.replace('-mark',''))).join('')}

<text x="48" y="1750" class="h2">LIVE INVENTORY</text>
<text x="48" y="1790" class="small">${chars.body_profiles.length} body · ${chars.hair.length} hair · ${chars.face_profiles.length} face · ${chars.outfits.length} outfits · ${chars.poses.length} poses</text>
<text x="48" y="1825" class="small">${props.assets.length} props · ${accents.accents.length} scene accents · ${mechanics.mechanics.length} mechanics · ${Object.keys(effects.effects).length} effects</text>
<text x="48" y="1860" class="small">${sceneSets.scene_sets.length} scene sets · ${Object.keys(palettes.palettes).length} background palettes · ${metaphors.metaphors.length} Visual Metaphors · ${memes.compositions?.length??memes.templates?.length??11} memes</text>
<text x="1032" y="1900" class="tiny" text-anchor="end">DIAGNOSTIC ONLY · production density caps still apply</text>
</svg>`;

const paletteIds=Object.keys(palettes.palettes);
const paletteBoard=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1040" width="1200" height="1040">${styles}
<rect width="1200" height="1040" fill="#F6F0E6"/><text x="600" y="65" class="title" text-anchor="middle">BACKGROUND PALETTE BOARD · SAME GEOMETRY</text>
<text x="600" y="100" class="small" text-anchor="middle">scene-set-classroom · compile-time palette variants</text>
${paletteIds.map((id,i)=>{const row=Math.floor(i/2),col=i%2,x=45+col*570,y=145+row*285;const pal=resolveBackgroundPalette(id,palettes);const raw=compileBackgroundPaletteSvg(classroom,pal);return box(x,y,535,245,pal.roles.teal)+nestedSvg(raw,{x:x+12,y:y+15,width:510,height:185})+`<text x="${x+267}" y="${y+225}" class="body" text-anchor="middle">${esc(id)}</text>`;}).join('')}
</svg>`;

const hairIds=['curtain-bang','short-curl','low-ponytail','soft-mohawk'];
const hairCards=hairIds.map((hairId,i)=>{
 const svg=compileCharacterSvg({entity_id:'div-'+i,body_profile:'standard_compact',hair_id:hairId,face_profile_id:'balanced',outfit_id:'generic-soft-stripes',shirt_color_id:['teal','coral','ochre','slate'][i],accessory_id:'none',variant_seed:'div-'+i},{pose_id:'neutral',expression_id:'neutral'}).svg;
 return {id:hairId,svg};
});
const newPropIds=['coffee-cup','keycard','gift-box','umbrella','sticky-note','wallet','photo-card','small-bag'];
const diversity=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1400" width="1200" height="1400">${styles}
<rect width="1200" height="1400" fill="#F6F0E6"/><text x="600" y="65" class="title" text-anchor="middle">ASSET V4 · DIVERSITY BOARD</text>
<text x="45" y="125" class="h2">FRESH HAIR SILHOUETTES</text>
${hairCards.map((row,i)=>nestedSvg(row.svg,{x:45+i*280,y:145,width:240,height:350})+label(165+i*280,520,row.id)).join('')}
<text x="45" y="590" class="h2">CONTACT PROP EXPANSION</text>
${newPropIds.map((id,i)=>{const x=45+(i%4)*280,y=615+Math.floor(i/4)*205;return nestedSvg(props.assets.find(x=>x.id===id)?'': '',{x,y,width:1,height:1})+`<g>${box(x,y,240,160)}${label(x+120,y+185,id)}</g>`;}).join('')}
${await Promise.all(newPropIds.map(async(id,i)=>{const x=60+(i%4)*280,y=630+Math.floor(i/4)*205;return nestedSvg(await read('props/'+id+'.svg'),{x,y,width:210,height:130});})).then(rows=>rows.join(''))}
<text x="45" y="1055" class="h2">NEW EFFECT SEMANTICS</text>
${[['focus-halo','focus-halo-mark'],['comparison-bracket','comparison-bracket-mark'],['relief-wave','relief-wave-mark'],['alarm-zigzag','alarm-zigzag-mark']].map(([labelText,id],i)=>nestedSvg(effectSvg(effects.effects[id]),{x:90+i*275,y:1090,width:130,height:130})+label(155+i*275,1245,labelText)).join('')}
<text x="45" y="1320" class="small">${mechanics.mechanics.length} mechanics · ${Object.keys(capabilities.effects).length} effect capabilities · ${metaphors.metaphors.length} metaphor mechanisms</text>
</svg>`;

const manifest={
 format:'zodiac-v4-full-asset-showcase@2',canvas:{width:1080,height:1920},diagnostic_only:true,production_density_valid:false,
 style_token:'zodiac-paper-doodle-meme-v4',font:'Patrick Hand',watermark:'✦ bungmoto',
 active_example:{
  scene_set:'scene-set-classroom',layout:'three-person-comparison',red_shirt_hair:'blocky-cut',
  mechanics:['compare-group','pass-object'],
  visual_metaphor:{id:'balance-scale',states:['tilt_left','balanced','tilt_right']}
 },
 background_palettes:paletteIds,
 counts:{scene_sets:sceneSets.scene_sets.length,scene_accents:accents.accents.length,body_profiles:chars.body_profiles.length,hair:chars.hair.length,
  face_profiles:chars.face_profiles.length,outfits:chars.outfits.length,poses:chars.poses.length,expressions:chars.expressions.length,
  props:props.assets.length,ornaments:ornaments.ornaments.length,layouts:layouts.frames.length,mechanics:mechanics.mechanics.length,
  visual_metaphors:metaphors.metaphors.length,effects:Object.keys(effects.effects).length,memes:memes.compositions?.length??memes.templates?.length??null},
 rendered_categories:['scene-set','scene-accent','background-palette','cover-first-frame','three-character-layout','character-assembly','visual-metaphor','contact-prop','meme-prop','semantic-effect','caption-safe-zone','watermark']
};
await mkdir(outDir,{recursive:true});
await Promise.all([
 writeFile(path.join(outDir,'zodiac-v4-full-asset-showcase.svg'),full),
 writeFile(path.join(outDir,'zodiac-v4-background-palettes.svg'),paletteBoard),
 writeFile(path.join(outDir,'zodiac-v4-asset-diversity-board.svg'),diversity),
 writeFile(path.join(outDir,'zodiac-v4-full-asset-showcase.json'),JSON.stringify(manifest,null,2)+'\n')
]);
console.log('ZODIAC_V4_SHOWCASE_PASS '+JSON.stringify(manifest.counts));
