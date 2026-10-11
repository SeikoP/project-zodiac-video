#!/usr/bin/env node
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(process.argv[2]||'.');
const production=JSON.parse(await readFile(path.join(root,'production.json'),'utf8'));
const fail=(s)=>{throw Error('SCENE_SET_QC_BLOCKED '+s)};
const scenes=new Set(),profiles=new Map();const hashes=new Set();let checked=0;
for(const scene of production.scenes??[]){
 const id=scene.id,set=scene.environment?.scene_set;if(!set||set.format!=='zodiac-scene-set@1')fail(id+' missing scene-set metadata');
 const e=(scene.entities||[]).find(x=>Object.values(x.states??{}).some(s=>s.asset===(set.asset??set.asset_id)));if(!e)fail(id+' missing background entity');
 const s=e.states?.[e.initial_state],t=s?.transform;
 if(s?.layer!==0||s?.visible!==true||!t||t.x!==0||t.y!==0||t.width!==1080||t.height>950||t.height<700)fail(id+' placement/layer/caption regression');
 if(set.profile!==scene.environment.profile||set.palette_id!==scene.art_direction?.palette_id)fail(id+' intent drift');
 if(!production.assets?.[s.asset]||production.assets[s.asset].category!=='environment'||s.asset!==(set.asset??set.asset_id))fail(id+' asset registry mismatch');
 const raw=await readFile(path.join(root,production.assets[s.asset].path),'utf8');
 if(!raw.includes('style=zodiac-paper-doodle-meme-v4')||!raw.includes('handmade=human-stroke-v2'))fail(id+' token drift');
 if(!raw.includes('profile='+set.profile)||!raw.includes('palette='+set.palette_id))fail(id+' profile/palette SVG drift');
 if(!/<path\b/.test(raw)||!raw.includes('fill='))fail(id+' unmaterialized spatial plane');
 const hash=createHash('sha256').update(raw).digest('hex');hashes.add(hash);
 const signature=scene.environment.profile;profiles.set(signature,new Set([...(profiles.get(signature)??[]),set.palette_id]));
 checked++;scenes.add(id);
}
if(!checked)fail('no scene sets');
console.log('SCENE_SET_QC_PASS '+JSON.stringify({scenes:checked,profiles:profiles.size,unique_background_assets:hashes.size,caption_clear:true,style_token:'zodiac-paper-doodle-meme-v4'}));
