import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {compileCharacterSvg} from '../../references/asset-library-v4/characters/compile-character-assembly.mjs';
import {selectAssetGuidance} from '../../core/policy/select-asset-guidance.mjs';
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const library=path.join(skill,'references/asset-library-v4');
const sha=x=>createHash('sha256').update(x).digest('hex');
const esc=x=>String(x??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const json=async rel=>JSON.parse(await readFile(path.join(library,rel),'utf8'));
export async function buildCurrentAssetReview({selected_ids=null,outDir=null}={}){
 const [policy,characters,sets,accents,props,metaphors]=await Promise.all(['selection-policy.json','characters/components/catalog.json','scene-set/index.json','scene-set/accents/index.json','props/index.json','visual-metaphors/index.json'].map(json));
 if(selected_ids){const selection=selectAssetGuidance({selected_asset_ids:selected_ids,meme_selected:true},policy);if(selection.unresolved_ids.length)throw Error('ASSET_UNKNOWN '+selection.unresolved_ids.join(','));}
 const rows=[];
 const add=(id,group,spec)=>{if(!rows.some(r=>r.id===id))rows.push({id,group,...spec});};
 for(const [group,key,field] of [['body','body_profiles','body_profile'],['hair','hair','hair_id'],['outfit','outfits','outfit_id'],['shirt_color','shirt_colors','shirt_color_id'],['expression','expressions','expression_id'],['pose','poses','pose_id']])
  for(const row of characters[key]??[])add(row.id,group,{field,value:row.id});
 for(const row of sets.scene_sets)add(row.id,'scene_set',{path:'scene-set/'+row.path,expected_sha256:row.asset_sha256,meaning:'Mảng tranh/tường phụ trợ phía sau; nhân vật có bố cục tiền cảnh độc lập.'});
 for(const row of accents.accents)add(row.id,'scene_accent',{path:'scene-set/'+row.path,expected_sha256:row.asset_sha256,meaning:'Chi tiết bối cảnh, nằm trong wall.'});
 for(const row of props.assets)add(row.id,'prop',{path:row.path,meaning:row.role});

 for(const row of metaphors.metaphors)add(row.id,'story_object',{states:row.states,meaning:row.meaning});
 const retired=new Set(policy.retired_asset_ids);
 const chosen=rows.filter(r=>!retired.has(r.id)&&(!selected_ids||selected_ids.includes(r.id)));
 if(selected_ids){const missing=selected_ids.filter(id=>!chosen.some(r=>r.id===id));if(missing.length)throw Error('ASSET_PREVIEW_UNSUPPORTED '+missing.join(','));}
 const defaults={entity_id:'catalog-preview',body_profile:'standard_compact',hair_id:'asym-bang',face_profile_id:'balanced',outfit_id:'plain-shirt',shirt_color_id:'teal',accessory_id:'none',variant_seed:'current-catalog'};
 const state={pose_id:'explain',expression_id:'neutral'};
 const readSvg=async rel=>{const abs=path.resolve(library,rel);if(!abs.startsWith(library+path.sep))throw Error('ASSET_PREVIEW_PATH_UNSAFE');return readFile(abs,'utf8');};
 const cards=[],items=[];
 for(const row of chosen){
  let svg,source;
  if(row.field){const identity={...defaults},acting={...state};if(row.field in acting)acting[row.field]=row.value;else identity[row.field]=row.value;svg=compileCharacterSvg(identity,acting).svg;source='native_character_compiler';}
  else if(row.path){svg=await readSvg(row.path);source=row.path;if(row.expected_sha256&&sha(svg)!==row.expected_sha256)throw Error('ASSET_PREVIEW_HASH_DRIFT '+row.id);}
  else {const states=await Promise.all(Object.entries(row.states).map(async([name,s])=>({name,svg:await readSvg('visual-metaphors/'+s.path)})));svg=states.map(s=>s.svg).join('');source='native_metaphor_states';}
  items.push({id:row.id,group:row.group,source,sha256:sha(svg)});
  cards.push('<label class="card" data-group="'+esc(row.group)+'" data-id="'+esc(row.id)+'"><div class="pick"><input type="checkbox" value="'+esc(row.id)+'"><strong>'+esc(row.id)+'</strong></div><div class="canvas '+(row.group==='story_object'?'states':'')+'">'+svg+'</div><small>'+esc(row.meaning??row.group)+'</small></label>');
 }
 const labels={body:'Dáng người',hair:'Tóc',outfit:'Trang phục',shirt_color:'Màu áo',expression:'Biểu cảm',pose:'Hành động',scene_set:'Scene-set',scene_accent:'Chi tiết nền',prop:'Đạo cụ',story_object:'Biểu tượng'};
 const groups=[...new Set(items.map(i=>i.group))];
 const html='<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kho asset hiện hành · Zodiac</title><style>body{margin:0;background:#F6F0E6;color:#2F3C44;font:16px system-ui}header{padding:28px 5vw 18px;border-bottom:2px solid #D0C1B3}h1{margin:0 0 10px;font-size:30px}p{max-width:850px;line-height:1.6}.toolbar{position:sticky;top:0;background:#F6F0E6;padding:15px 5vw;display:flex;gap:12px;flex-wrap:wrap;z-index:2}input,select,button{font:inherit;padding:10px;border:1px solid #5C6B75;border-radius:8px}button{background:#2F3C44;color:#FFFDF9;cursor:pointer}main{padding:12px 5vw 40px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:18px}.card{background:#FFFDF9;border:2px solid #D0C1B3;border-radius:14px;padding:14px;cursor:pointer}.card:has(input:checked){border-color:#E97A66;box-shadow:0 0 0 2px #E97A66}.pick{display:flex;gap:8px;align-items:center;font-size:14px;overflow-wrap:anywhere}.canvas{height:245px;display:flex;align-items:center;justify-content:center;padding:10px 0}.canvas svg{max-width:100%;width:100%;height:100%}.states svg{width:33%}small{line-height:1.5;color:#5C6B75}[hidden]{display:none!important}</style><header><h1>Kho asset hiện hành</h1><p>Chọn theo vai trò trong câu chuyện. Nhân vật được dựng trên cùng dáng, mặt và áo để so sánh từng thành phần; scene-set và đạo cụ dùng đúng SVG hiện hành. Chọn ở đây chưa tạo asset cho tập và chưa thay thế Visual Review.</p></header><div class="toolbar"><select id="group"><option value="">Tất cả nhóm</option>'+groups.map(g=>'<option value="'+g+'">'+esc(labels[g]??g)+'</option>').join('')+'</select><input id="search" placeholder="Tìm ID asset" aria-label="Tìm asset"><button id="download">Xuất lựa chọn</button><span id="count">0 mục được chọn</span></div><main>'+cards.join('')+'</main><script>const cards=[...document.querySelectorAll(".card")],group=document.getElementById("group"),search=document.getElementById("search"),count=document.getElementById("count");function filter(){for(const c of cards)c.hidden=!!((group.value&&c.dataset.group!==group.value)||!c.dataset.id.toLowerCase().includes(search.value.toLowerCase()));}group.onchange=filter;search.oninput=filter;document.addEventListener("change",()=>count.textContent=document.querySelectorAll("input[type=checkbox]:checked").length+" mục được chọn");document.getElementById("download").onclick=()=>{const payload={format:"zodiac-asset-selection@1",environment_mode:"scene_set",selected_asset_ids:[...document.querySelectorAll("input[type=checkbox]:checked")].map(x=>x.value),approval:false};const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})),a=document.createElement("a");a.href=url;a.download="asset-selection.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};</script></html>';
 const receipt={format:'zodiac-current-asset-review@1',policy_sha256:sha(JSON.stringify(policy)),character_defaults:defaults,state_defaults:state,items,html_sha256:sha(html),approval:false,status:'CREATIVE_REVIEW_REQUIRED'};
 if(outDir){await mkdir(outDir,{recursive:true});await writeFile(path.join(outDir,'index.html'),html);await writeFile(path.join(outDir,'catalog-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
 return {html,receipt};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const at=process.argv.indexOf('--selection');
 const selection=at>=0?JSON.parse(await readFile(process.argv[at+1],'utf8')):null;
 buildCurrentAssetReview({selected_ids:selection?.selected_asset_ids??null,outDir:path.resolve(process.argv[2]??'.authoring/current-asset-review')}).then(r=>console.log(JSON.stringify({status:r.receipt.status,items:r.receipt.items.length,approval:false}))).catch(e=>{console.error(e.message);process.exitCode=1;});
}
