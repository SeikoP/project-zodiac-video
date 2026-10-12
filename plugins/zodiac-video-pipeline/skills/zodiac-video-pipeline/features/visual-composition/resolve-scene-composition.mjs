// Validate authored intent separately from compiler-resolved geometry. No approval synthesis.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateComposition,compositionHash,designToken} from './phase02-composition-core.mjs';
import {materializeEnvironment} from '../../references/asset-library-v4/environments/compile-environment.mjs';
const load=async relative=>JSON.parse(await readFile(new URL(relative,import.meta.url),'utf8'));
const environmentIndex=await load('../../references/asset-library-v4/environments/composition-index.json');
const sceneSetRegistry=await load('../../references/asset-library-v4/scene-set/index.json');
const effectCatalog=await load('../../references/asset-library-v4/effects/meme-effect-catalog.json');
const roles=new Set(['background','character','interactive_prop','foreground_environment','effect','caption','overlay']);
const result=issues=>({status:issues.length?'BLOCKED':'PASS',issues});
function compilerEntity(production,scene,c){
 const locator=c.ownership?.locator;if(typeof locator!=='string')return null;
 const [kind,key,...extra]=locator.split(':');if(extra.length||!key)return null;
 if(kind==='scene-set'){
  const master=sceneSetRegistry.scene_sets.find(s=>s.id===key);if(!master||c.id!=='env__'+key)return null;
  return {id:c.id,kind:'object',visual_role:'background',initial_state:'visible',states:{visible:{asset:master.asset_id,visible:true,layer:master.layer,transform:structuredClone(master.transform)}}};
 }
 if(kind==='environment'){
  const expected=materializeEnvironment({version:'2.0',assets:{},scenes:[scene]},environmentIndex).scenes[0];
  return c.id==='env__'+key?expected.entities.find(e=>e.id===c.id)??null:null;
 }
 if(kind==='character')return key===c.id&&scene.entities?.find(e=>e.id===key&&e.kind==='character')?{...scene.entities.find(e=>e.id===key),visual_role:'character'}:null;
 if(kind==='meme-effect'){
  const spec=scene.visual_grammar?.meme_composition?.effects?.find(e=>e.id===key&&e.entity_id===c.id);
  const known=Object.hasOwn(effectCatalog.effects??{},key);
  if(!spec||!known)return null;const [cx,cy,width,height]=spec.box,state={transform:{x:cx-width/2,y:cy-height/2,width,height},layer:spec.layer};
  return {id:c.id,kind:'effect',visual_role:'effect',initial_state:'off',states:{off:{...state,visible:false},on:{...state,visible:true}}};
 }
 if(kind==='meme-prop')return scene.visual_grammar?.meme_composition?.asset_requirements?.some(r=>r.asset_id===key&&r.entity_id===c.id)&&scene.entities?.find(e=>e.id===c.id)?{...scene.entities.find(e=>e.id===c.id),visual_role:'interactive_prop'}:null;
 return null;
}
function prepareIntent(production,plan,token){
 const issues=[],source=structuredClone(production),projected=structuredClone(plan);
 for(const scene of source.scenes??[]){const planned=projected.scenes?.find(p=>p.id===scene.id);for(const c of planned?.components??[]){
  if(!c||!roles.has(c.visual_role)){issues.push({code:'COMPOSITION_INTENT_ROLE_INVALID',scene_id:scene.id});continue;}
  const kind=c.ownership?.kind??'authored';let e=scene.entities?.find(e=>e.id===c.id);
  if(kind==='compiler'){
   const expected=compilerEntity(production,scene,c);if(!expected||expected.visual_role!==c.visual_role){issues.push({code:'COMPOSITION_COMPILER_LOCATOR_INVALID',scene_id:scene.id,entity_id:c.id});continue;}
   if(!e){e=expected;scene.entities.push(e);}else if(e.visual_role&&e.visual_role!==c.visual_role){issues.push({code:'COMPOSITION_INTENT_ROLE_CONFLICT',entity_id:c.id});continue;}else e.visual_role=c.visual_role;
  }else if(kind!=='authored'){issues.push({code:'COMPOSITION_OWNERSHIP_INVALID',entity_id:c.id});continue;}
  if(!e)continue;
  if(e.kind==='character')for(const state of Object.values(e.states??{})){state.visible??=true;state.layer??=20;}
  // Geometry belongs to native compilers; identity, roles, planned state keys and relations remain constraints.
  if(c.initial_state!==undefined&&c.initial_state!==e.initial_state)issues.push({code:'COMPOSITION_INITIAL_STATE_INVALID',entity_id:c.id});
  if(c.states!==undefined&&compositionHash(Object.keys(c.states).sort())!==compositionHash(Object.keys(e.states??{}).sort()))issues.push({code:'COMPOSITION_STATE_COVERAGE',entity_id:c.id});
  for(const [id,state] of Object.entries(c.states??{}))for(const field of ['visible','layer'])if(state[field]!==undefined&&state[field]!==e.states?.[id]?.[field])issues.push({code:'COMPOSITION_STATE_INTENT_DRIFT',entity_id:c.id,state_id:id,field});
  c.initial_state=e.initial_state;c.states=Object.fromEntries(Object.entries(e.states??{}).map(([id,s])=>[id,{transform:s.transform,layer:s.layer,visible:s.visible}]));
 }}
 const checked=validateComposition(source,projected,token);return {source,projected,issues:[...issues,...checked.issues]};
}
export async function validateCompositionIntent(production,plan,token){return {format:'zodiac-composition-intent-qc@1',...result(prepareIntent(production,plan,token).issues)};}
export async function resolveSceneComposition(production,plan,token){
 const prepared=prepareIntent(production,plan,token),issues=[...prepared.issues];
 for(const planned of plan.scenes??[])for(const c of planned.components??[])if(!production.scenes?.find(s=>s.id===planned.id)?.entities?.some(e=>e.id===c.id))issues.push({code:'COMPOSITION_COMPONENT_MISSING',scene_id:planned.id,entity_id:c.id});
 // Strictly validate actual output, including actual compiler role/state metadata, never normalized placeholders.
 const strict=structuredClone(prepared.projected);for(const scene of production.scenes??[]){const p=strict.scenes?.find(p=>p.id===scene.id);for(const c of p?.components??[]){const e=scene.entities?.find(e=>e.id===c.id);if(e)c.states=Object.fromEntries(Object.entries(e.states??{}).map(([id,s])=>[id,{transform:s.transform,layer:s.layer,visible:s.visible}]));}}
 issues.push(...validateComposition(production,strict,token).issues);
 return {format:'zodiac-scene-composition-resolved@1',...result(issues),source_sha256:compositionHash(production),intent_sha256:compositionHash(plan),design_token_sha256:compositionHash(token),scenes:strict.scenes??[],not_an_approval:true};
}
export async function validateResolvedComposition(production,plan,token,resolved){
 const actual=await resolveSceneComposition(production,plan,token),issues=[...actual.issues];
 if(resolved?.format!==actual.format||resolved.status!=='PASS'||compositionHash(actual)!==compositionHash(resolved))issues.push({code:'COMPOSITION_RESOLVED_STALE'});
 return {format:'zodiac-resolved-composition-qc@1',...result(issues)};
}
export async function inspectResolvedWorkspace(root,{write=false}={}){
 const [production,plan,design]=await Promise.all([readFile(path.join(root,'production.json'),'utf8').then(JSON.parse),readFile(path.join(root,'.authoring/scene-art-direction.json'),'utf8').then(JSON.parse),readFile(path.join(root,'design.md'),'utf8')]);const token=designToken(design);
 if(compositionHash(token)!==compositionHash(designToken(await readFile(new URL('../../references/design.md',import.meta.url),'utf8'))))return {status:'BLOCKED',issues:[{code:'COMPOSITION_CANONICAL_TOKEN_DRIFT'}]};
 if(write){const resolved=await resolveSceneComposition(production,plan,token);await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'.authoring/scene-composition-resolved.json'),JSON.stringify(resolved,null,2)+'\n');return resolved;}
 const resolved=JSON.parse(await readFile(path.join(root,'.authoring/scene-composition-resolved.json'),'utf8'));return validateResolvedComposition(production,plan,token,resolved);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{const root=process.argv[2];if(!root)throw Error('COMPOSITION_WORKSPACE_REQUIRED');const r=await inspectResolvedWorkspace(root,{write:process.argv.includes('--write')});console.log(JSON.stringify(r,null,2));if(r.status!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}}
