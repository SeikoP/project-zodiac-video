#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {access,readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateSchema} from './schema-lite.mjs';
import {assertJob5VisualRoleSizes} from './compile-job-v5.mjs';
import {preflightHandoff} from './handoff-preflight.mjs';
import {voicesMatchNarration} from './voice-source-ranges.mjs';
const fail=m=>{throw new Error('HANDOFF_V2_INVALID: '+m);};
const installedPluginVersion=JSON.parse(await readFile(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../plugin.json'),'utf8')).version;
const exists=p=>access(p).then(()=>true).catch(()=>false);
const isObj=x=>x&&typeof x==='object'&&!Array.isArray(x);
const canonical=value=>Array.isArray(value)?value.map(canonical):isObj(value)?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value)),'utf8').digest('hex');
const readJson=async p=>{try{return JSON.parse(await readFile(p,'utf8'));}catch(e){fail('invalid '+path.basename(p)+': '+e.message);}};
const walk=async dir=>{const out=[];for(const ent of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,ent.name);if(ent.isDirectory())out.push(...await walk(p));else if(ent.isFile())out.push(p);}return out;};
export async function validateHandoffV2(root){
 root=path.resolve(root);const here=path.dirname(fileURLToPath(import.meta.url));const contracts=path.resolve(here,'../references/contracts');
 const required=['package-manifest.json','production.ir.json','design-token.json','narration.txt','publish/publish.json','publish/publish-copy.txt'];
 for(const rel of required)if(!(await exists(path.join(root,rel))))fail('missing '+rel);if(!(await exists(path.join(root,'assets'))))fail('missing assets/');
 for(const rel of ['production.json','design.md','.authoring','renderer','library','references','node_modules','voice.wav','.runtime','out','FINAL_VALIDATION.json','handoff-manifest.json'])if(await exists(path.join(root,rel)))fail('forbidden '+rel);
 const manifest=await readJson(path.join(root,'package-manifest.json')),ir=await readJson(path.join(root,'production.ir.json')),design=await readJson(path.join(root,'design-token.json')),publish=await readJson(path.join(root,'publish','publish.json'));
 assertJob5VisualRoleSizes(ir);const preflight=preflightHandoff(ir);if(preflight.status==='BLOCKED')fail(JSON.stringify(preflight.issues));
 const schemas={manifest:await readJson(path.join(contracts,'zodiac-job-v5.schema.json')),ir:await readJson(path.join(contracts,'authoring-ir-v1.schema.json')),design:await readJson(path.join(contracts,'design-token-v4.schema.json')),publish:await readJson(path.join(contracts,'publish-v1.schema.json'))};
 for(const [name,value] of Object.entries({manifest,ir,design,publish})){const issues=validateSchema(schemas[name],value);if(issues.length)fail(`${name} schema: ${issues[0].path} ${issues[0].message}`);}
 if(manifest.contract.sha256!==hash(schemas.ir))fail('package contract hash does not match canonical authoring-ir-v1 schema');
 if(manifest.renderer.id!=='zodiac-renderer'||manifest.renderer.version!=='2.0.1')fail('renderer must pin zodiac-renderer@2.0.1');
 if(manifest.producer.plugin!=='zodiac-video-pipeline'||manifest.producer.version!==installedPluginVersion)fail(`producer must match installed plugin version ${installedPluginVersion}`);
 if(ir.fps!==24||ir.video.width!==1080||ir.video.height!==1920)fail('authoring IR must be 1080x1920 at 24fps');
 const narration=(await readFile(path.join(root,'narration.txt'),'utf8')).replace(/\r\n/g,'\n').replace(/\n$/,'');if(!voicesMatchNarration(ir.scenes.map(s=>s.voice),narration))fail('narration.txt must exactly match ordered IR scene voice');
 const assetRoot=path.resolve(root,'assets'),referenced=new Set();
 for(const [id,a] of Object.entries(ir.assets)){if(!isObj(a)||typeof a.path!=='string'||!a.path.startsWith('assets/'))fail('asset '+id+' requires assets/ path');const p=path.resolve(root,a.path);if(!p.startsWith(assetRoot+path.sep)||!(await exists(p)))fail('asset '+id+' missing/escaping file');referenced.add(path.relative(root,p).split(path.sep).join('/'));}
 const actual=new Set((await walk(assetRoot)).map(p=>path.relative(root,p).split(path.sep).join('/')));for(const rel of actual)if(!referenced.has(rel))fail('unreferenced asset file '+rel);for(const rel of referenced)if(!actual.has(rel))fail('referenced asset missing '+rel);
 for(const scene of ir.scenes){
  if(scene.voice.trim() && (!Array.isArray(scene.caption_segments)||!scene.caption_segments.length))fail('missing caption_segments in '+scene.id);
  if(!isObj(scene.layout_contract)||!isObj(scene.render_density_budget))fail('missing layout/density contract in '+scene.id);
  const tokens=s=>String(s).match(/[\p{L}\p{N}]+/gu)?.map(x=>x.toLocaleLowerCase('vi'))??[];
  const authored=scene.caption_segments.flatMap(s=>tokens(s.text));
  if(authored.join('|')!==tokens(scene.voice).join('|'))fail('caption narration mismatch '+scene.id);
  let end=0;for(const s of scene.caption_segments){
    if(s.start_ms<end||s.end_ms<=s.start_ms||s.max_lines>2)fail('invalid caption timing/lines '+scene.id);
    end=s.end_ms;
    if(tokens(s.text).length<3 && !/[!?…]/u.test(s.text))fail('tiny caption fragment '+scene.id);
  }
  const layout=scene.layout_contract;const canvas=layout.canvas;
  const boxes=['caption_safe_zone','character_zone','prop_zone','effect_zone'];
  for(const key of boxes){const b=layout[key];if(b.x+b.width>canvas.width||b.y+b.height>canvas.height)fail('zone out of bounds '+scene.id+' '+key);}
  const a=layout.caption_safe_zone;
  for(const key of ['character_zone','prop_zone','effect_zone']){
    const b=layout[key];
    if(a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)fail('caption zone overlaps '+key+' in '+scene.id);
  }
  const bindings=scene.spatial_bindings??[];
  const ids=new Set(scene.entities.map(e=>e.id));
  const bound=new Set();
  for(const b of bindings){
    if(!ids.has(b.entity)||!ids.has(b.anchor)||b.entity===b.anchor)fail('spatial anchor missing '+scene.id);
    if(bound.has(b.entity))fail('duplicate spatial binding '+scene.id+' '+b.entity);
    bound.add(b.entity);
    if(!['near','held_by','on_surface','emitted_by','points_to'].includes(b.relation))fail('invalid spatial relation '+scene.id);
    if(!Number.isFinite(b.max_distance_px)||b.max_distance_px<=0||b.max_distance_px>1200)fail('invalid spatial distance '+scene.id);
  }
  const density=scene.render_density_budget;
  // Component roles come from source asset metadata, not entity naming conventions.
  const roleOf=(entity)=>{
    const roles=new Set(Object.values(entity.states??{}).map(st=>ir.assets[st.asset]?.category).filter(Boolean));
    if(roles.size>1)fail('entity mixes asset categories '+scene.id+' '+entity.id);
    const category=[...roles][0];
    if(category==='character'||category==='character_pose')return 'character';
    if(category==='prop')return 'prop';
    if(category==='effect')return 'effect';
    if(category==='environment')return 'environment';
    // Legacy fixtures without category retain the former naming behavior.
    if(category!==undefined)fail('unknown asset category '+scene.id+' '+entity.id+' '+category);
    if(entity.id.startsWith('env__'))return 'environment';
    if(entity.id==='story_prop')return 'prop';
    if(entity.id==='story_effect')return 'effect';
    return 'character';
  };
  const roles=scene.entities.map(roleOf);
  const actorCount=roles.filter(role=>role==='character').length;
  const propCount=roles.filter(role=>role==='prop').length;
  const effectCount=roles.filter(role=>role==='effect').length;
  if(actorCount>density.max_characters||propCount>density.max_prominent_props||effectCount>density.max_prominent_effects)fail('scene density exceeded '+scene.id);
  if(actorCount===3&&(propCount>1||effectCount>1))fail('scene has 3 actors and too many props/effects '+scene.id);
 }
 const eventIds=new Set();for(const scene of ir.scenes){const entities=new Map(scene.entities.map(e=>[e.id,e]));for(const event of scene.events){if(eventIds.has(event.id))fail('duplicate event id '+event.id);eventIds.add(event.id);const entity=entities.get(event.target);if(!entity)fail('event '+event.id+' target missing');for(const sid of [event.state_before,event.state_after]){const state=entity.states?.[sid];if(!state)fail('event '+event.id+' state missing '+sid);if(typeof state.asset!=='string'||!ir.assets[state.asset])fail('event '+event.id+' executable state must resolve an asset: '+sid);}if(!design.motion_defaults[event.desired_motion])fail('event '+event.id+' desired_motion missing design motion default');}}
 const serialized=JSON.stringify(ir);for(const field of ['start_frame','end_frame','anticipation_frames','hold_frames','settle_frames','runtime_motion','performance'])if(serialized.includes(`"${field}"`))fail('runtime-derived field forbidden in authoring IR: '+field);
 return {manifest,ir,design,publish};
}
const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);if(direct){const root=process.argv[2];if(!root){console.error('Usage: node validate-handoff-workspace-v2.mjs <package-root>');process.exit(2);}try{const r=await validateHandoffV2(root);console.log(`HANDOFF_V2_PASS: job=${r.manifest.job.id} revision=${r.manifest.job.revision} scenes=${r.ir.scenes.length} assets=${Object.keys(r.ir.assets).length}`);}catch(e){console.error(e.message);process.exit(1);}}
