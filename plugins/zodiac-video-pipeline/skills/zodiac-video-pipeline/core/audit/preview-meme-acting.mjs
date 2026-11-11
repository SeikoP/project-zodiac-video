#!/usr/bin/env node
// Isolated native demo, never an episode workspace or an approval receipt.
import {mkdir,writeFile,readFile,readdir,access,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {compileVisualGrammar} from '../../references/asset-library-v4/compile-visual-grammar.mjs';
import {compileMemeProps} from '../../references/asset-library-v4/memes/compile-meme-props.mjs';
import {compileCharacterSvg,compileCharacterAssembly,planCharacterStateAssets} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {validateCharacterAssembly} from '../../references/asset-library-v4/validation/validate-character-assembly.mjs';
import {validateHumanStroke} from '../../references/asset-library-v4/validation/validate-human-stroke.mjs';
import {compileProduction} from '../../references/asset-library-v4/scene-direction/compile-scene-direction.mjs';
import {buildNativePairs} from '../../features/visual-composition/build-native-preview-pairs.mjs';
import {assertJob5VisualRoleSizes} from '../../phases/phase03/compile-job-v5.mjs';
import {resolveHandoffLayout} from '../../phases/phase03/handoff-preflight.mjs';

const root=path.resolve(process.argv[2]??'.runtime/phase02-meme-review'),started=performance.now();
const exists=file=>access(file).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
if(await exists(path.join(root,'.authoring/pipeline-state.json'))||await exists(path.join(root,'pipeline-state.json')))throw Error('DEMO_PIPELINE_WORKSPACE_FORBIDDEN');
const entries=await readdir(root).catch(error=>{if(error.code==='ENOENT')return [];throw error;});
if(entries.length){
 const prior=await readFile(path.join(root,'meme-demo-receipt.json'),'utf8').then(JSON.parse).catch(()=>null);
 if(prior?.format!=='zodiac-meme-acting-demo@1'||prior.status!=='DEMO_ONLY')throw Error('DEMO_OUTPUT_NOT_OWNED');
}
await mkdir(path.join(root,'.authoring'),{recursive:true});
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),library=path.join(skill,'references/asset-library-v4');
const registry=JSON.parse(await readFile(path.join(library,'memes/index.json'))),catalog=JSON.parse(await readFile(path.join(library,'characters/components/catalog.json')));
const esc=value=>String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const hero={entity_id:'hero',body_profile:'lean_tall',hair_id:'long-side-part',outfit_id:'zodiac-glyph-shirt',zodiac_sign_id:'scorpio',shirt_color_id:'teal',states:{}};
const peer={entity_id:'peer',body_profile:'round_soft',hair_id:'soft-layered-bob',outfit_id:'plain-shirt',shirt_color_id:'coral',states:{}};
const cast={format:'zodiac-character-assembly-plan@1',characters:[hero,peer]},examples=[],grammar={format:'zodiac-visual-grammar-plan@1',scenes:[]};
const production={version:'2.0',video:{width:1080,height:1920,fps:30},assets:{},scenes:[]};
for(const [index,meme] of registry.compositions.entries()){
 const id='S'+String(index+1).padStart(2,'0'),demo=meme.preview;
 if(!demo?.title||!demo.setup||!demo.reaction)throw Error('MEME_PREVIEW_EXAMPLE_REQUIRED '+meme.id);
 const scene={id,voice:demo.setup+' '+demo.reaction,layout_contract:resolveHandoffLayout(),entities:[],events:[]},bindings={},stateBindings={};let actorIndex=0;
 for(const [role,contract] of Object.entries(meme.roles)){
  if(!contract.required&&contract.kind!=='character'&&role!=='label')continue;
  const character=contract.kind==='character',spec=character?(actorIndex++===0?hero:peer):null;
  const entityId=spec?.entity_id??(role==='label'?'meme_label':'prop_'+role),before=id+'_setup_'+role,after=id+'_react_'+role;
  bindings[role]=entityId;
  if(character){
   const acting=contract.acting??{pose_id:'neutral',expression_id:'neutral'};
   spec.states[before]={pose_id:'neutral',expression_id:'neutral',...(acting.crop_id?{crop_id:acting.crop_id}:{})};
   spec.states[after]={...acting};stateBindings[role]=after;
  }
  let asset=null;
  if(!character&&!meme.asset_requirements?.some(r=>r.role===role)){
   if(!demo.prop)throw Error('MEME_PREVIEW_PROP_REQUIRED '+meme.id+'/'+role);
   asset='DEMO_'+demo.prop.replaceAll('-','_').toUpperCase();const rel='assets/props/'+demo.prop+'.svg';
   const source=path.join(library,'props',demo.prop+'.svg'),svg=await readFile(source,'utf8');validateHumanStroke(svg,'focal');
   await mkdir(path.dirname(path.join(root,rel)),{recursive:true});await copyFile(source,path.join(root,rel));production.assets[asset]={path:rel,style_id:'zodiac-paper-doodle-meme-v4',category:'prop'};
  }
  scene.entities.push({id:entityId,kind:character?'character':'object',initial_state:before,states:{[before]:{asset,visible:character,layer:character?20:role==='label'?40:25},[after]:{asset,visible:true,layer:character?20:role==='label'?40:25}}});
  scene.events.push({id:id+'_'+role,target:entityId,action:character?'react':'reveal',state_before:before,state_after:after,trigger:{type:'voice_anchor',text:demo.reaction},motion:{preset:'state_swap',duration_frames:8}});
 }
 examples.push({scene_id:id,meme:meme.id,title:demo.title,setup:demo.setup,reaction:demo.reaction,source:meme.reference_url??null,label:meme.text_label?.text??null});
 production.scenes.push(scene);grammar.scenes.push({scene_id:id,meme_composition:{id:meme.id,bindings,state_bindings:stateBindings}});
}
if(!Object.keys(peer.states).length)cast.characters.pop();
let compiled=compileVisualGrammar(production,grammar);
compiled=await compileMemeProps(compiled,{root});
const assetPlan=planCharacterStateAssets(compiled,cast);
compiled=await compileCharacterAssembly(compiled,cast,{root,writeAssets:true,stateAssetPlan:assetPlan});
compiled=(await compileProduction(compiled,{root})).production;
assertJob5VisualRoleSizes({assets:compiled.assets,scenes:compiled.scenes});
for(const [rel,data] of [['production.json',compiled],['visual-grammar-plan.json',grammar],['.authoring/character-assembly-plan.json',cast],['.authoring/character-state-asset-plan.json',assetPlan]])await writeFile(path.join(root,rel),JSON.stringify(data,null,2)+'\n');
await validateCharacterAssembly(root);
const preview=await buildNativePairs(root);
assert.equal(preview.scene_count,registry.compositions.length);
assert.ok(compiled.scenes.every(s=>s.visual_grammar.meme_composition.effects.length===0));
const identities=Object.values(compiled.assets).filter(a=>a.character_blueprint).map(a=>a.character_blueprint.identity_signature);
assert.equal(new Set(identities).size,cast.characters.length);
const extract=html=>html.slice(html.indexOf('<div class="canvas">'),html.lastIndexOf('</html>'));
const cards=[];
for(const example of examples){
 const frame=preview.scene_frames.find(s=>s.scene_id===example.scene_id);
 const [before,after]=await Promise.all([frame.before,frame.after].map(name=>readFile(path.join(root,'.authoring/preview-pairs',name),'utf8')));
 cards.push(`<article data-meme="${esc(example.meme)}" data-new="${!!example.source}" data-phase="reaction" data-search="${esc(example.title+' '+example.meme)}"><header><span class="tag">${example.source?'MỚI':'TRONG KHO'}</span><h2>${esc(example.title)}</h2><small>${esc(example.meme)}</small></header><div class="stage"><div class="native setup">${extract(before)}</div><div class="native reaction">${extract(after)}</div><div class="speech setup">${esc(example.setup)}</div><div class="speech reaction">${esc(example.reaction)}</div></div><div class="controls"><button data-action="setup">Setup</button><button data-action="reaction">Phản ứng</button><button data-action="replay">▶ Phát lại</button></div>${example.label?'<p class="label-note">Chữ tùy chọn: '+esc(example.label)+'</p>':''}${example.source?'<a class="source" href="'+esc(example.source)+'" target="_blank" rel="noreferrer">Ảnh tham khảo ↗</a>':''}</article>`);
}
const poseCards=catalog.poses.map(p=>{const r=compileCharacterSvg(hero,{pose_id:p.id,expression_id:p.id==='slump'?'weary':'neutral'});validateHumanStroke(r.svg,'character');return `<figure data-pose="${esc(p.id)}">${r.svg}<figcaption>${esc(p.id)}</figcaption></figure>`;});
const faceCards=catalog.expressions.map(e=>{const r=compileCharacterSvg(hero,{pose_id:'neutral',expression_id:e.id,crop_id:'face-closeup'});validateHumanStroke(r.svg,'character');return `<figure data-expression="${esc(e.id)}">${r.svg}<figcaption>${esc(e.id)}</figcaption></figure>`;});
const font=await readFile(path.resolve(skill,'../../../../runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf')).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const viewer=`<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kho meme · bungmoto</title><style>
@font-face{font-family:Patrick Hand;src:url(data:font/ttf;base64,${font?.toString('base64')??''})}*{box-sizing:border-box}body{margin:0;background:#F6F0E6;color:#2F3C44;font:17px system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:30px 24px}h1{font:48px 'Patrick Hand',cursive;margin:4px 0}h2{font:29px 'Patrick Hand',cursive;margin:8px 0}.intro{max-width:850px;line-height:1.6;color:#5C6B75}.toolbar{display:flex;gap:10px;align-items:center;flex-wrap:wrap;padding:16px 0 24px;position:sticky;top:0;background:#F6F0E6;z-index:5}button,input{font:inherit;color:inherit;border:1px solid #D0C1B3;background:#FFFDF9;border-radius:8px;padding:9px 14px}button{cursor:pointer}button[aria-pressed=true]{background:#2F3C44;color:#FFFDF9}button:focus-visible,input:focus-visible{outline:3px solid #E97A66}input[type=search]{min-width:220px;flex:1}.gallery{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px}article{padding:17px;background:#FFFDF9;border:1px solid #D0C1B3;border-radius:16px;overflow:hidden}article[hidden]{display:none}header{min-height:108px}small,.source{font-size:13px;color:#5C6B75}.tag{font-size:11px;letter-spacing:1.2px;color:#5C6B75}.stage{position:relative;width:270px;height:480px;margin:8px auto 14px;background:#F6F0E6;border-radius:10px;overflow:hidden}.native{position:absolute;inset:0;width:1080px;height:1920px;transform:scale(.25);transform-origin:top left}.canvas{position:relative;width:1080px;height:1920px;overflow:hidden;background:#F6F0E6}.meta{display:none}.speech{position:absolute;left:14px;right:14px;bottom:34px;text-align:center;font:26px/1.18 'Patrick Hand',cursive;color:#2F3C44;text-shadow:1px 1px #FFFDF9}.stage>.setup{display:none}[data-phase=setup] .stage>.setup{display:block}[data-phase=setup] .stage>.reaction{display:none}[data-labels=off] [data-entity=meme_label]{display:none}.controls{display:flex;justify-content:center;gap:6px}.controls button{padding:7px 9px;font-size:14px}.label-note{font:21px 'Patrick Hand',cursive;text-align:center;margin:12px 0 8px;color:#5C6B75}.source{display:block;text-align:center;margin-top:12px}.sheet{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}.sheet figure{margin:0;background:#FFFDF9;border:1px solid #D0C1B3;border-radius:12px;padding:10px;text-align:center}.sheet svg{width:100%;height:230px}.sheet figcaption{font-size:13px}details{margin-top:35px}summary{font:30px 'Patrick Hand',cursive;cursor:pointer}.foot{color:#5C6B75;font-size:14px;margin:24px 0}a{color:#435064}.empty{display:none}body.no-results .empty{display:block}@media(max-width:420px){main{padding:20px 12px}.toolbar{position:static}h1{font-size:39px}}
</style><body data-labels="on"><main><small>✦ bungmoto · Paper doodle meme</small><h1>Có chuyện là có biểu cảm.</h1><p class="intro">${examples.length} tình huống meme · ${catalog.poses.length} tư thế · ${catalog.expressions.length} biểu cảm. Cùng nhân vật của kênh, xem từ bình thản đến phản ứng. Chữ nhấn là tùy chọn; có thể tắt để kiểm tra động tác có tự kể được câu đùa.</p><div class="toolbar"><button data-filter="all" aria-pressed="true">Tất cả (${examples.length})</button><button data-filter="new" aria-pressed="false">Mới (${examples.filter(e=>e.source).length})</button><button id="play-all">▶ Phát tất cả</button><label><input id="labels" type="checkbox" checked> Hiện chữ nhấn</label><input id="search" type="search" aria-label="Tìm hành động meme" placeholder="Tìm hành động…"></div><p class="empty">Không có hành động phù hợp.</p><section class="gallery">${cards.join('')}</section><details id="poses"><summary>Tất cả ${catalog.poses.length} tư thế nhân vật</summary><p class="intro">Hình biên dịch trực tiếp từ catalog hiện tại.</p><div class="sheet">${poseCards.join('')}</div></details><details id="expressions"><summary>Tất cả ${catalog.expressions.length} biểu cảm</summary><div class="sheet">${faceCards.join('')}</div></details><p class="foot">Preview nhịp trạng thái minh họa, chưa có giọng đọc. Bố cục và nét vẽ dùng asset native; video cuối vẫn cần kiểm tra timing với audio.</p></main><script>
const cards=[...document.querySelectorAll('article[data-meme]')],timers=new Map();let filter=new URLSearchParams(location.search).get('filter')==='new'?'new':'all';
const norm=s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d');
function apply(){const query=norm(document.getElementById('search').value);for(const card of cards)card.hidden=(filter==='new'&&card.dataset.new!=='true')||!norm(card.dataset.search).includes(query);document.body.classList.toggle('no-results',cards.every(c=>c.hidden));for(const b of document.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));}
function phase(card,value){clearTimeout(timers.get(card));card.dataset.phase=value;for(const b of card.querySelectorAll('[data-action]'))b.setAttribute('aria-pressed',String(b.dataset.action===value));}
function replay(card){phase(card,'setup');timers.set(card,setTimeout(()=>phase(card,'reaction'),950));}
document.addEventListener('click',event=>{const f=event.target.closest('[data-filter]');if(f){filter=f.dataset.filter;apply();return;}const b=event.target.closest('[data-action]');if(!b)return;const c=b.closest('article');b.dataset.action==='replay'?replay(c):phase(c,b.dataset.action);});
document.getElementById('play-all').addEventListener('click',()=>cards.filter(c=>!c.hidden).forEach(replay));document.getElementById('search').addEventListener('input',apply);document.getElementById('labels').addEventListener('change',e=>document.body.dataset.labels=e.target.checked?'on':'off');apply();
</script></body></html>`;
await writeFile(path.join(root,'index.html'),viewer);
const receipt={format:'zodiac-meme-acting-demo@1',status:'DEMO_ONLY',native_wall_ms:+(performance.now()-started).toFixed(2),meme_count:examples.length,pose_count:catalog.poses.length,expression_count:catalog.expressions.length,examples,identity_count:new Set(identities).size,review_required:true,timed_render:false,not_an_approval:true};
await writeFile(path.join(root,'meme-demo-receipt.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({status:receipt.status,meme_count:receipt.meme_count,pose_count:receipt.pose_count,expression_count:receipt.expression_count,preview:path.join(root,'index.html')},null,2));
