import {readFile,access,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
const exists=p=>access(p).then(()=>true,()=>false);
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
export function characterProductionFingerprint(production){
 const characters=(production?.scenes??[]).map(scene=>({
  id:scene.id,voice:scene.voice??null,
  acting_requirements:scene.visual_grammar?.meme_composition?.acting_requirements??null,
  entities:(scene.entities??[]).filter(e=>e.kind==='character').map(e=>({
   id:e.id,initial_state:e.initial_state??null,
   states:Object.fromEntries(Object.entries(e.states??{}).map(([id,s])=>[id,{visible:s?.visible!==false}]))
  }))
 }));
 return createHash('sha256').update(JSON.stringify(canonical({version:production?.version??null,characters}))).digest('hex');
}
export async function signatureFiles(files){
 const sha=b=>createHash('sha256').update(b).digest('hex'),parts=[],selected=[...new Set(files)].sort();
 // Bound parallel I/O; reread every call so edits cannot survive a memoized PASS.
 for(let i=0;i<selected.length;i+=8){
  const batch=await Promise.all(selected.slice(i,i+8).map(async rel=>{const p=path.resolve(rel);try{const st=await lstat(p);return st.isFile()&&!st.isSymbolicLink()?[p,sha(await readFile(p))]:null;}catch{return null;}}));
  if(batch.includes(null))return null;parts.push(...batch);
 }
 return sha(JSON.stringify(parts));
}
// Selected SVGs plus transitive local executable imports. Never walk the asset tree.
export async function selectedPhase02Dependencies(skillRoot,workspace){
 const intentFile=path.join(workspace,'.authoring/visual-intent.json');if(!await exists(intentFile))return {mode:'legacy-full',files:[]};
 const intent=JSON.parse(await readFile(intentFile)),files=new Set(),v4=path.join(skillRoot,'references/asset-library-v4');
 const add=async p=>{p=path.resolve(p);if(!p.startsWith(path.resolve(skillRoot)+path.sep))throw Error('SELECTED_DEPENDENCY_PATH_UNSAFE');if(!await exists(p))throw Error('SELECTED_DEPENDENCY_MISSING '+p);if(files.has(p))return;files.add(p);if(p.endsWith('.mjs')){const source=await readFile(p,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\(?\s*)['"](\.[^'"]+)['"]/gu))await add(path.resolve(path.dirname(p),match[1]));for(const match of source.matchAll(/['"]([^'"\n]+\.(?:mjs|json|md))['"]/gu)){if(match[1].includes('://')||match[1].startsWith('/'))continue;const child=path.resolve(path.dirname(p),match[1]);if(await exists(child))await add(child);}}};
 const setRegistry=JSON.parse(await readFile(path.join(v4,'scene-set/index.json'))),accentRegistry=JSON.parse(await readFile(path.join(v4,'scene-set/accents/index.json')));for(const scene of intent.scenes??[]){const env=scene.grammar?.environment??scene.environment??{},setId=env.scene_set_id??env.scene_set?.id;if(setId){const master=setRegistry.scene_sets.find(s=>s.id===setId);if(!master)throw Error('SCENE_SET_UNKNOWN '+setId);await add(path.join(v4,'scene-set',master.path));}for(const a of env.scene_accents??[]){const master=accentRegistry.accents.find(s=>s.id===a.id);if(!master)throw Error('SCENE_ACCENT_UNKNOWN '+a.id);await add(path.join(v4,'scene-set',master.path));}}
 const selectedMemeIds=new Set((intent.scenes??[]).map(s=>s.grammar?.meme_composition?.id).filter(Boolean));if(selectedMemeIds.size){const memeRoot=path.join(v4,'memes'),memeIndex=JSON.parse(await readFile(path.join(memeRoot,'index.json')));await add(path.join(memeRoot,'index.json'));await add(path.join(memeRoot,'compile-meme-props.mjs'));for(const id of selectedMemeIds){const composition=memeIndex.compositions.find(c=>c.id===id);if(!composition)throw Error('MEME_SELECTION_UNKNOWN '+id);for(const requirement of composition.asset_requirements??[])if(requirement.source_path)await add(path.resolve(memeRoot,requirement.source_path));}}
 const catalog=JSON.parse(await readFile(path.join(v4,'characters/components/catalog.json')));for(const c of intent.cast??[])if(c.accessory_id&&c.accessory_id!=='none'){const a=catalog.accessories.find(a=>a.id===c.accessory_id);if(!a)throw Error('CHARACTER_ACCESSORY_UNKNOWN');await add(path.join(v4,'characters',a.path));}
 // Explicit library locators only; package-local authored assets are workspace inputs.
 for(const a of Object.values(intent.assets??{}))if(a.library_path)await add(path.join(v4,a.library_path));
 for(const rel of ['phases/phase02/phase02-execute.mjs','references/asset-library-v4/scene-set/compile-scene-set.mjs','references/asset-library-v4/characters/compile-character-assembly.mjs','references/asset-library-v4/scene-direction/compile-scene-direction.mjs'])await add(path.join(skillRoot,rel));
 return {mode:'selected',files:[...files].sort()};
}
export async function selectedStepDependencyFiles(skillRoot,entry,candidates,{stepId}={}){
 const seen=new Set(),base=path.resolve(skillRoot),known=candidates.map(p=>path.resolve(p));
 const visit=async p=>{p=path.resolve(p);if(!p.startsWith(base+path.sep)||seen.has(p)||!await exists(p))return;seen.add(p);if(!p.endsWith('.mjs'))return;const raw=await readFile(p,'utf8');
  for(const m of raw.matchAll(/['"]([^'"\n]+\.(?:mjs|json|md))['"]/gu)){const rel=m[1];if(rel.startsWith('/')||rel.includes('://'))continue;const local=path.resolve(path.dirname(p),rel);if(await exists(local))await visit(local);else for(const candidate of known)if(candidate.replaceAll('\\','/').endsWith('/'+rel.replace(/^\.\//u,'')))await visit(candidate);}
 };
 await visit(path.join(base,entry));
 const character=entry.includes('/characters/')||['character_components','character_identity','outfit_bake'].includes(stepId);
 const environment=entry.includes('/environments/')||['environment_binding','scene_set_identity','scene_accent_containment'].includes(stepId);
 for(const p of known.filter(p=>p.endsWith('.svg'))){const normalized=p.replaceAll('\\','/');if(character?normalized.includes('/characters/'):environment?normalized.includes('/scene-set/')||normalized.includes('/environments/'):true)seen.add(p);}
 return [...seen].sort();
}
