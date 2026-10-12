import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=(m)=>{throw new Error('ENVIRONMENT_COMPOSITION_INVALID: '+m);};
const index=JSON.parse(await readFile(path.join(here,'index.json'),'utf8'));
const assetRoot=path.resolve(here,'..');
const manifest=JSON.parse(await readFile(path.join(assetRoot,'manifest.json'),'utf8'));
if(index.format!=='zodiac-environment-compositions@1')fail('format');
if(index.version!=='1.0.0')fail('version');
if(index.policy?.composition_only!==true)fail('composition_only must be true');
if(index.policy?.full_scene_backgrounds!==false)fail('full_scene_backgrounds must be false');
if(index.policy?.runtime_contract!=='ordinary_scene_entities_only')fail('runtime contract must stay ordinary entities');
const raw=JSON.stringify(index);
for(const token of ['background_asset','full_scene_svg','scene_module'])if(raw.includes('"'+token+'"'))fail('forbidden field '+token);
const propIds=new Set((manifest.prop_masters??[]).map(x=>x.id));
const presetIds=new Set();
for(const p of index.presets??[]){
  if(!p.id||presetIds.has(p.id))fail('duplicate/missing preset id '+p.id);presetIds.add(p.id);
  if(!Array.isArray(p.contexts)||!p.contexts.length)fail(p.id+' missing contexts');
  if(!Array.isArray(p.prop_pool)||p.prop_pool.length<3)fail(p.id+' needs >=3 prop_pool items');
  if(new Set(p.prop_pool).size!==p.prop_pool.length)fail(p.id+' duplicate prop id');
  for(const id of p.prop_pool)if(!propIds.has(id))fail(p.id+' unknown prop '+id);
  const d=p.density??{};if(!(d.min>=3&&d.preferred>=d.min&&d.max>=d.preferred&&d.max<=9))fail(p.id+' invalid density');
  const rear=p.roles?.rear??[],front=p.roles?.front??[];
  if(!rear.length||!front.length)fail(p.id+' must expose rear and front roles');
  for(const id of [...rear,...front])if(!p.prop_pool.includes(id))fail(p.id+' role references prop outside pool '+id);
  const occ=p.foreground_occlusion?.max_subject_bbox_ratio;
  if(!(typeof occ==='number'&&occ>=0&&occ<=0.22))fail(p.id+' foreground occlusion budget');
  if(!p.caption_open_zone)fail(p.id+' caption_open_zone');
}
for(const required of ['study-corner','messy-desk','social-chat','outing-corridor','neutral-grounded'])if(!presetIds.has(required))fail('missing preset '+required);
const cueIds=new Set();for(const c of index.structural_cues??[]){if(!c.id||cueIds.has(c.id))fail('duplicate structural cue '+c.id);cueIds.add(c.id);if(c.ownership!=='package_owned_derivative')fail(c.id+' ownership');}
for(const required of ['contact-shadow','floor-patch','depth-rail'])if(!cueIds.has(required))fail('missing structural cue '+required);
console.log(`Environment compositions ${index.version} OK: ${presetIds.size} presets, ${cueIds.size} structural cues; full-scene backgrounds disabled.`);
