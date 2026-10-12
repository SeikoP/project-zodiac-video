import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSceneSetAccents} from '../../../orchestration/validate-scene-set-accents.mjs';
const here=path.dirname(fileURLToPath(import.meta.url)),sha=x=>createHash('sha256').update(x).digest('hex');
const fail=m=>{throw Error('SCENE_SET_COMPILE_'+m)};
export async function compileSceneSetWorkspace(root,{production,libraryRoot=here,write=true}={}){
 const registry=JSON.parse(await readFile(path.join(libraryRoot,'index.json'))),accents=JSON.parse(await readFile(path.join(libraryRoot,'accents/index.json')));const out=structuredClone(production??JSON.parse(await readFile(path.join(root,'production.json')))),files={},selected=[];out.assets??={};
 const copy=async (master,category)=>{const raw=await readFile(path.join(libraryRoot,master.path));if(sha(raw)!==master.asset_sha256)fail('MASTER_HASH_DRIFT '+master.id);const existing=out.assets[master.asset_id];if(existing&&existing.path!==master.output_path)fail('ASSET_ID_COLLISION '+master.asset_id);files[master.output_path]=raw;out.assets[master.asset_id]={path:master.output_path,category,style_id:'zodiac-paper-doodle-meme-v4',lineage:{mode:'direct_copy',source_library:'zodiac-visual-grammar-v4',source_master:master.id,semantic_intent:master.semantic_intent,source_sha256:master.asset_sha256}};};
 for(const scene of out.scenes??[]){const env=scene.environment??{},id=env.scene_set_id??env.scene_set?.id;if(!id)continue;const master=registry.scene_sets.find(s=>s.id===id);if(!master)fail('UNKNOWN '+id);await copy(master,'environment');const entityId=env.scene_set?.entity_id??'env__'+id;
  const old=scene.entities?.find(e=>e.id===entityId);if(old&&Object.values(old.states??{}).some(s=>s.asset!==master.asset_id))fail('ENTITY_ID_COLLISION '+entityId);
  scene.entities=(scene.entities??[]).filter(e=>e.id!==entityId);scene.entities.push({id:entityId,kind:'object',visual_role:'background',initial_state:'visible',states:{visible:{asset:master.asset_id,transform:structuredClone(master.transform),layer:master.layer,visible:true}}});
  const t=master.transform,v=master.view_box,w=master.wall_region_local,wall={x:t.x+(w.x-v[0])*t.width/v[2],y:t.y+(w.y-v[1])*t.height/v[3],width:w.width*t.width/v[2],height:w.height*t.height/v[3]};
  scene.environment={...env,mode:'scene_set',scene_set_id:id,scene_set:{format:'zodiac-scene-set@1',id,asset:master.asset_id,entity_id:entityId,asset_sha256:master.asset_sha256,view_box:master.view_box,transform:master.transform,wall_region:wall},roles:{rear:[entityId],grounding:[],front:[]},scene_accents:[]};
  for(const request of env.scene_accents??[]){const accent=accents.accents.find(a=>a.id===request.id);if(!accent)fail('ACCENT_UNKNOWN '+request.id);await copy(accent,'environment');const eid=request.entity_id??'accent__'+request.id;if(scene.entities.some(e=>e.id===eid)&&!Object.values(scene.entities.find(e=>e.id===eid).states??{}).every(s=>s.asset===accent.asset_id))fail('ACCENT_ENTITY_COLLISION '+eid);scene.entities=scene.entities.filter(e=>e.id!==eid);scene.entities.push({id:eid,kind:'object',visual_role:'effect',initial_state:'visible',states:{visible:{asset:accent.asset_id,visible:true,layer:accent.layer,transform:structuredClone(request.transform??accent.transform)}}});scene.environment.scene_accents.push({id:accent.id,entity_id:eid});}
  selected.push({scene_id:scene.id,scene_set_id:id,asset_sha256:master.asset_sha256,scene_accents:scene.environment.scene_accents});
 }
 const verdict=validateSceneSetAccents(out);if(verdict.status!=='PASS')fail('ACCENT_CONTAINMENT '+JSON.stringify(verdict.issues));
 const receipt={format:'zodiac-scene-set-compile@1',structural_status:'STRUCTURAL_PASS',creative_status:'CREATIVE_REVIEW_REQUIRED',runtime_status:'RUNTIME_QA_PENDING',scenes:selected,selected_assets:Object.keys(files),source_hashes:Object.fromEntries(Object.entries(files).map(([p,b])=>[p,sha(b)]))};
 if(write){for(const [p,raw] of Object.entries(files)){await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),raw);}await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'production.json'),JSON.stringify(out,null,2)+'\n');await writeFile(path.join(root,'.authoring/scene-set-compile-receipt.json'),JSON.stringify(receipt,null,2)+'\n');}
 return {production:out,receipt,files};
}
