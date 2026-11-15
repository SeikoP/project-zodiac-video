// Source-backed V4 compatibility and bounded scene bundles; no second asset catalog.
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const LIBRARY = fileURLToPath(new URL('../../plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/', import.meta.url));
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const json = async file => JSON.parse(await readFile(file, 'utf8'));
export async function confined(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(p => !p || p === '..' || p === '.')) throw Error('VISUAL_PATH_INVALID');
  const base = await realpath(root), target = await realpath(path.join(base, relative));
  if (!target.startsWith(base + path.sep)) throw Error('VISUAL_PATH_OUTSIDE_ROOT');
  return target;
}

export function safeSvg(bytes) {
  const text = bytes.toString('utf8');
  if (!/<svg[\s>]/iu.test(text) || /<\s*(script|foreignObject|iframe|object|embed|audio|video)\b|\bon\w+\s*=|<!ENTITY|<!DOCTYPE|javascript\s*:|@import|url\(\s*['"]?(?!#)/iu.test(text)) throw Error('VISUAL_SVG_UNSAFE');
  for (const match of text.matchAll(/(?:href|src)\s*=\s*["']([^"']*)["']/giu)) if (!match[1].startsWith('#')) throw Error('VISUAL_SVG_EXTERNAL_REFERENCE');
  return text;
}

export function propIdentity(row, bytes) {
  const phone = /^phone(?:-|$)/u.test(row.id);
  // V4 phone notification states share one outer model; color/state are not new geometry.
  const body = phone ? bytes.toString('utf8').match(/<path\b[^>]*\bd="([^"]+)"/u)?.[1] : null;
  return {format:'zodiac-prop-identity@1', family_id:phone?'phone':row.id, model_id:phone?'v4-phone-'+digest(body || bytes).slice(0,12):'v4-'+row.id,
    appearance_id:'v4-original', state_id:phone?row.id.replace(/^phone-?/u,'')||'idle':'default', view_id:'source-master', owner_id:null, compatibility:'V4_ADAPTER'};
}

export async function describeAssets() {
  const catalog = await json(path.join(LIBRARY,'props/index.json')), result=[];
  for (const row of catalog.assets) {
    const bytes = await readFile(await confined(LIBRARY,row.path)); safeSvg(bytes);
    result.push({...row, source_sha256:digest(bytes), identity:propIdentity(row,bytes), fresh:true});
  }
  return {format:'zodiac-source-capabilities@1', source_revision:digest(catalog), items:result,
    retired:['scene_set'], authority:'asset-library-v4', ranking:'hard-constraints-then-context', not_an_approval:true};
}

export async function findCandidates(intent, sceneId, requirement={}, recent=[]) {
  const scene = intent.scenes.find(s=>s.id===sceneId); if(!scene) throw Error('VISUAL_SCENE_UNKNOWN');
  const catalog=await describeAssets(), rejected=[], eligible=[];
  const terms=String(requirement.context || scene.semantic_goal).toLowerCase().split(/[^\p{L}\p{N}_-]+/u).filter(t=>t.length>1);
  const existing=new Set(scene.entities.flatMap(e=>Object.values(e.states).map(s=>s.asset)).filter(Boolean));
  const used=new Set(recent.flatMap(r=>r.asset_ids??[]));
  for(const row of catalog.items) {
    let reason=null;
    if(requirement.family_id && row.identity.family_id!==requirement.family_id) reason='FAMILY_MISMATCH';
    else if(requirement.asset_id && row.id!==requirement.asset_id) reason='EXACT_ASSET_REQUIRED';
    else if(requirement.role && !['interactive_prop','prop','story_prop'].includes(requirement.role)) reason='ROLE_MISMATCH';
    const relevant=(row.contexts??[]).some(c=>terms.includes(c.toLowerCase())) || existing.has(row.id) || requirement.asset_id===row.id || requirement.family_id===row.identity.family_id;
    if(!reason && !relevant) reason='NO_SOURCE_CONTEXT_MATCH';
    if(requirement.contact && ![...existing].some(id=>intent.assets[id]?.path?.endsWith('/'+path.basename(row.path))) && row.identity.family_id!=='phone') reason='CONTACT_GEOMETRY_UNVERIFIED';
    if(reason) rejected.push({id:row.id,reason});
    else eligible.push({...row, score:(requirement.asset_id===row.id?100:0)+(existing.has(row.id)?10:0)-(used.has(row.id)?1:0), repeated:used.has(row.id)});
  }
  eligible.sort((a,b)=>b.score-a.score || a.id.localeCompare(b.id));
  const bundles=[];
  for(const asset of eligible.slice(0,3)) {
    const target=scene.entities.find(e=>['interactive_prop','prop'].includes(e.visual_role)||e.kind==='prop');
    if(!target) { rejected.push({id:asset.id,reason:'NO_PROP_SLOT_IN_SCENE'}); continue; }
    const current=intent.assets[target.states[target.initial_state]?.asset];
    const frameContacts=scene.environment?.frame?.contacts;
    const contacts=Array.isArray(frameContacts)?frameContacts:(scene.spatial_bindings??[]);
    const bound=contacts.some(b=>b.entity===target.id);
    if(bound && current?.path && !current.path.endsWith('/'+path.basename(asset.path))) {
      const currentRow=catalog.items.find(r=>current.path.endsWith('/'+path.basename(r.path)));
      if(!currentRow || currentRow.identity.model_id!==asset.identity.model_id) { rejected.push({id:asset.id,reason:'CONTACT_MODEL_MISMATCH'}); continue; }
    }
    const bundle={scene_id:scene.id, entity_id:target.id, state_id:target.initial_state, asset_id:asset.id,
      asset_source_sha256:asset.source_sha256, catalog_revision:catalog.source_revision, identity:asset.identity,
      actors:scene.entities.filter(e=>e.kind==='character').map(e=>({entity_id:e.id,states:Object.keys(e.states)})),
      mechanic_id:scene.grammar?.mechanic_id, frame_id:scene.grammar?.frame_id,
      fit_reasons:['Exact current catalog hash','Existing semantic prop slot','Actor identity and acting states retained',bound?'Same physical model preserves authored contact':'No authored contact binding changed'],
      warnings:asset.repeated?['Recent reviewed episode used this source asset; continuity may justify reuse']:[], not_an_approval:true};
    bundles.push({...bundle, candidate_id:digest({scene_id:scene.id,entity_id:target.id,state_id:target.initial_state,asset_id:asset.id,
      asset_source_sha256:asset.source_sha256,catalog_revision:catalog.source_revision,source_sha256:digest(intent)})});
  }
  return {format:'zodiac-scene-candidates@1', status:bundles.length?'CANDIDATES':'NO_FIT_ASSET', source_sha256:digest(intent),
    catalog_revision:catalog.source_revision, bundles, rejected, new_asset_task:bundles.length?null:{scene_id:sceneId,requirement,reason:'No source-backed feasible scene bundle; author and review a suitable asset.'}};
}
