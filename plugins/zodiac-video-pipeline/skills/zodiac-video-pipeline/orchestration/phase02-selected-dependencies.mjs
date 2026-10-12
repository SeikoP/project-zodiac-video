import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
const exists=p=>access(p).then(()=>true,()=>false);
// Selected SVGs plus transitive local executable imports. Never walk the asset tree.
export async function selectedPhase02Dependencies(skillRoot,workspace){
 const intentFile=path.join(workspace,'.authoring/visual-intent.json');if(!await exists(intentFile))return {mode:'legacy-full',files:[]};
 const intent=JSON.parse(await readFile(intentFile)),files=new Set(),v4=path.join(skillRoot,'references/asset-library-v4');
 const add=async p=>{p=path.resolve(p);if(!p.startsWith(path.resolve(skillRoot)+path.sep))throw Error('SELECTED_DEPENDENCY_PATH_UNSAFE');if(!await exists(p))throw Error('SELECTED_DEPENDENCY_MISSING '+p);if(files.has(p))return;files.add(p);if(p.endsWith('.mjs')){const source=await readFile(p,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/gu))await add(path.resolve(path.dirname(p),match[1]));for(const match of source.matchAll(/['"]([^'"\n]+\.(?:mjs|json|md))['"]/gu)){if(match[1].includes('://')||match[1].startsWith('/'))continue;const child=path.resolve(path.dirname(p),match[1]);if(await exists(child))await add(child);}}};
 const setRegistry=JSON.parse(await readFile(path.join(v4,'scene-set/index.json'))),accentRegistry=JSON.parse(await readFile(path.join(v4,'scene-set/accents/index.json')));for(const scene of intent.scenes??[]){const setId=scene.environment?.scene_set_id??scene.environment?.scene_set?.id;if(setId){const master=setRegistry.scene_sets.find(s=>s.id===setId);if(!master)throw Error('SCENE_SET_UNKNOWN '+setId);await add(path.join(v4,'scene-set',master.path));}for(const a of scene.environment?.scene_accents??[]){const master=accentRegistry.accents.find(s=>s.id===a.id);if(!master)throw Error('SCENE_ACCENT_UNKNOWN '+a.id);await add(path.join(v4,'scene-set',master.path));}}
 const catalog=JSON.parse(await readFile(path.join(v4,'characters/components/catalog.json')));for(const c of intent.cast??[])if(c.accessory_id&&c.accessory_id!=='none'){const a=catalog.accessories.find(a=>a.id===c.accessory_id);if(!a)throw Error('CHARACTER_ACCESSORY_UNKNOWN');await add(path.join(v4,'characters',a.path));}
 // Explicit library locators only; package-local authored assets are workspace inputs.
 for(const a of Object.values(intent.assets??{}))if(a.library_path)await add(path.join(v4,a.library_path));
 for(const rel of ['orchestration/phase02-execute.mjs','references/asset-library-v4/scene-set/compile-scene-set.mjs','references/asset-library-v4/characters/compile-character-assembly.mjs','references/asset-library-v4/scene-direction/compile-scene-direction.mjs'])await add(path.join(skillRoot,rel));
 return {mode:'selected',files:[...files].sort()};
}
export async function selectedStepDependencyFiles(skillRoot,entry,candidates,{stepId}={}){
 const seen=new Set(),base=path.resolve(skillRoot),known=candidates.map(p=>path.resolve(p));
 const visit=async p=>{p=path.resolve(p);if(!p.startsWith(base+path.sep)||seen.has(p)||!await exists(p))return;seen.add(p);if(!p.endsWith('.mjs'))return;const raw=await readFile(p,'utf8');
  for(const m of raw.matchAll(/['"]([^'"\n]+\.(?:mjs|json|md))['"]/gu)){const rel=m[1];if(rel.startsWith('/')||rel.includes('://'))continue;const local=path.resolve(path.dirname(p),rel);if(await exists(local))await visit(local);else for(const candidate of known)if(candidate.endsWith('/'+rel.replace(/^\.\//u,'')))await visit(candidate);}
 };
 await visit(path.join(base,entry));
 const character=entry.includes('/characters/')||['character_components','character_identity','outfit_bake'].includes(stepId);
 const environment=entry.includes('/environments/')||['environment_binding','scene_set_identity','scene_accent_containment'].includes(stepId);
 for(const p of known.filter(p=>p.endsWith('.svg')))if(character?p.includes('/characters/'):environment?p.includes('/scene-set/')||p.includes('/environments/'):true)seen.add(p);
 return [...seen].sort();
}
