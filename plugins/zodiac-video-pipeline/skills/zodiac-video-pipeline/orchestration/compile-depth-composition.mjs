#!/usr/bin/env node
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const lib=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../references/depth-catalog.json');
const digest=x=>createHash('sha256').update(x).digest('hex');
const safe=s=>String(s).replace(/[^a-z0-9_-]/gi,'_');
const fail=(code,reason)=>{throw new Error(code+' '+reason)};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
export function makeLayer(profile,palette,role,sceneId){
 const c=palette;
 const wrap=(w,h,shapes)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${escape(profile)} ${escape(role)}"><g stroke-linejoin="round" stroke-linecap="round">${shapes}</g></svg>`;
 if(role==='rear'){
  if(profile==='bedroom-night')return wrap(740,430,`<path d="M28 378V56H705V378" fill="${c.wall}" fill-opacity=".43" stroke="${c.edge}" stroke-width="7"/><path d="M330 65V354M125 210H548" fill="none" stroke="${c.edge}" stroke-width="6"/><circle cx="555" cy="116" r="39" fill="${c.light}" opacity=".82"/><path d="M475 92Q510 50 544 92" fill="none" stroke="${c.accent}" stroke-width="5"/>`);
  if(profile==='study-corner')return wrap(740,430,`<path d="M42 90H690M55 245H677" fill="none" stroke="${c.edge}" stroke-width="8"/><path d="M80 98V218M143 112V222M350 112V228M512 120V224" stroke="${c.accent}" stroke-width="13" stroke-linecap="round"/><path d="M590 145Q615 90 644 150V236" fill="none" stroke="${c.ink}" stroke-width="6"/>`);
  if(profile==='classroom-day')return wrap(740,430,`<path d="M65 80Q65 63 88 63H670V331H65Z" fill="${c.wall}" fill-opacity=".43" stroke="${c.edge}" stroke-width="8"/><path d="M112 115H565M115 175H388" stroke="${c.accent}" opacity=".55" stroke-width="6" stroke-dasharray="26 18"/><circle cx="615" cy="118" r="26" fill="${c.light}" stroke="${c.ink}" stroke-width="5"/>`);
  if(profile==='school-hallway')return wrap(740,430,`<path d="M100 35L35 373H704L640 35" fill="${c.wall}" fill-opacity=".29" stroke="${c.edge}" stroke-width="7"/><path d="M160 80H325V330H120M420 80H585L625 330H430" fill="none" stroke="${c.ink}" stroke-width="7"/><path d="M350 44V360" stroke="${c.light}" stroke-width="13" opacity=".9"/>`);
  if(profile==='spotlight-payoff')return wrap(720,460,`<ellipse cx="360" cy="240" rx="300" ry="200" fill="${c.light}" opacity=".72" stroke="${c.edge}" stroke-width="5" stroke-dasharray="18 21"/><path d="M80 400Q360 445 650 385" fill="none" stroke="${c.accent}" stroke-width="6" opacity=".55"/>`);
  if(profile==='social-pressure')return wrap(740,360,`<path d="M20 195Q160 40 300 186T580 195T720 180" fill="none" stroke="${c.edge}" stroke-width="8" opacity=".55"/><path d="M70 290Q340 210 675 285" fill="none" stroke="${c.accent}" stroke-width="6" stroke-dasharray="30 21"/>`);
  if(profile==='split-thought')return wrap(730,410,`<path d="M16 350Q200 65 355 185T710 100" fill="none" stroke="${c.accent}" stroke-width="8" opacity=".7"/><path d="M65 95Q250 35 340 155M430 285Q540 175 690 310" fill="none" stroke="${c.edge}" stroke-width="5" stroke-dasharray="16 20"/>`);
  return wrap(740,430,`<path d="M20 382V90Q22 30 84 30H648Q720 40 720 98V382" fill="${c.wall}" fill-opacity=".32" stroke="${c.edge}" stroke-width="7"/><path d="M95 65V336M650 68V335" stroke="${c.light}" stroke-width="12" opacity=".9"/>`);
 }
 if(role==='divider'){
  if(profile==='bedroom-night')return wrap(360,520,`<path d="M45 40Q75 120 56 205T48 480M294 39Q259 130 293 238T310 471" fill="none" stroke="${c.accent}" stroke-width="15" opacity=".6"/><path d="M35 45H318" stroke="${c.edge}" stroke-width="7"/>`);
  if(profile==='study-corner')return wrap(360,520,`<path d="M62 35V483M275 35V483M50 207H305M45 381H300" fill="none" stroke="${c.edge}" stroke-width="8"/><path d="M75 148H225" stroke="${c.accent}" stroke-width="6"/>`);
  if(profile==='classroom-day')return wrap(360,520,`<path d="M62 68V455H300" fill="none" stroke="${c.edge}" stroke-width="7"/><path d="M88 115H280M88 173H230" stroke="${c.accent}" stroke-width="6" stroke-dasharray="17 13"/>`);
  if(profile==='school-hallway')return wrap(360,520,`<path d="M55 35V488M272 35V488M55 45H272" fill="none" stroke="${c.edge}" stroke-width="8"/><circle cx="236" cy="270" r="10" fill="${c.accent}"/><path d="M85 110H232" stroke="${c.light}" stroke-width="9"/>`);
  const split=['split-thought','social-pressure','spotlight-payoff'].includes(profile);
  return split?wrap(360,490,`<path d="M175 25Q100 130 178 237T176 464" fill="none" stroke="${c.shadow}" stroke-opacity=".16" stroke-width="33"/><path d="M175 24Q106 130 178 237T176 465" fill="none" stroke="${c.accent}" stroke-width="6" stroke-dasharray="31 16"/>`):wrap(360,520,`<path d="M40 30Q40 16 56 16H290Q312 16 312 36V468" fill="none" stroke="${c.edge}" stroke-width="8"/><path d="M65 65V440" fill="none" stroke="${c.light}" stroke-width="17" opacity=".72"/><path d="M52 472H320" fill="none" stroke="${c.shadow}" stroke-opacity=".2" stroke-width="20"/>`);
 }
 return wrap(700,240,`<ellipse cx="355" cy="177" rx="288" ry="28" fill="${c.shadow}" opacity=".13"/><path d="M35 180Q145 144 348 159T665 176" fill="none" stroke="${c.edge}" stroke-width="8"/><path d="M37 170Q188 142 347 158T663 166" fill="none" stroke="${c.light}" stroke-width="13" opacity=".64"/>`);
}
export function compileDepth(production,plan,catalog){
 if(production?.version!=='2.0'||plan?.format!=='zodiac-depth-composition-plan@1'||!Array.isArray(plan.scenes))fail('DEPTH_PLAN_INVALID','schema');
 const out=structuredClone(production);out.assets??={};
 for(const s of out.scenes??[])s.entities=(s.entities??[]).filter(e=>!String(e.id).startsWith('depth__'));
 for(const id of Object.keys(out.assets))if(id.startsWith('DEPTH_'))delete out.assets[id];
 const scenes=new Map((out.scenes??[]).map(s=>[s.id,s])),seen=new Set(),files={};
 for(const item of plan.scenes){
  const scene=scenes.get(item.scene_id),profile=catalog.profiles[item.profile],palette=catalog.palettes[item.palette];
  if(!scene||!profile||!palette||seen.has(item.scene_id))fail('DEPTH_PLAN_INVALID',String(item.scene_id));
  seen.add(item.scene_id);
  if(!String(item.rationale??'').trim()||!Array.isArray(item.layers)||item.layers.length<1||item.layers.length>3||new Set(item.layers).size!==item.layers.length||item.layers.some(x=>!['rear','divider','front'].includes(x)))fail('DEPTH_LAYER_INVALID',item.scene_id);
  if(item.story_object_entity_id && !(scene.entities??[]).some(e=>e.id===item.story_object_entity_id))fail('STORY_OBJECT_MISSING',item.scene_id);
  for(const role of item.layers){
   const id='depth__'+safe(item.scene_id)+'__'+role,asset='DEPTH_'+safe(item.scene_id).toUpperCase()+'_'+role.toUpperCase(),rel='assets/environment/depth-'+safe(item.scene_id)+'-'+role+'.svg';
   if(out.assets[asset] || (scene.entities??[]).some(e=>e.id===id))fail('DEPTH_ENTITY_COLLISION',id);
   const svg=makeLayer(item.profile,palette,role,item.scene_id);files[rel]=svg;
   const sizes={rear:[740,430],divider:[360,520],front:[700,240]};
   const wh=role==='rear'&&['spotlight-payoff','social-pressure','split-thought'].includes(item.profile)?({ 'spotlight-payoff':[720,460],'social-pressure':[740,360],'split-thought':[730,410]}[item.profile]):role==='divider'&&['spotlight-payoff','social-pressure','split-thought'].includes(item.profile)?[360,490]:sizes[role];
   const t=role==='rear'?{x:170,y:160,width:wh[0],height:wh[1]}:role==='divider'?{x:item.profile==='split-thought'?375:695,y:320,width:wh[0],height:wh[1]}:{x:190,y:1130,width:wh[0],height:wh[1]};
   const layer=role==='rear'?-12:role==='divider'?-7:15;
   scene.entities.push({id,kind:'object',initial_state:'visible',states:{visible:{asset,transform:t,layer,visible:true}}});
   out.assets[asset]={path:rel,category:'environment',style_id:catalog.style_token,lineage:{mode:'native_derived',source_library:'zodiac-depth-background@1',source_master:item.profile,semantic_intent:item.rationale}};
  }
 }
 return {production:out,files,receipt:{format:'zodiac-depth-compile@1',scene_ids:[...seen],assets:Object.keys(files).sort(),signature:digest(JSON.stringify({scenes:plan.scenes,files}))}};
}
export async function compileDepthWorkspace(root,{write=false}={}){
 const catalog=JSON.parse(await readFile(lib,'utf8')),production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8')),plan=JSON.parse(await readFile(path.join(root,'.authoring/depth-composition-plan.json'),'utf8'));
 const result=compileDepth(production,plan,catalog);
 if(write){for(const [rel,data] of Object.entries(result.files)){const out=path.join(root,rel);await mkdir(path.dirname(out),{recursive:true});await writeFile(out,data);}await writeFile(path.join(root,'production.json'),JSON.stringify(result.production,null,2)+'\n');await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/depth-compile-receipt.json'),JSON.stringify(result.receipt,null,2)+'\n');}
 return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node compile-depth-composition.mjs <workspace> --write');process.exitCode=2;}else try{const result=await compileDepthWorkspace(path.resolve(root),{write:process.argv.includes('--write')});console.log(JSON.stringify({status:'DEPTH_COMPILE_PASS',...result.receipt}));}catch(e){console.error(e.message);process.exitCode=2;}
}
