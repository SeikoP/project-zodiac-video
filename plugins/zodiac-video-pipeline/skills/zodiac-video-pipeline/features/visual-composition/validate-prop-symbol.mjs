import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
const err=(issues,code,at)=>issues.push({code,at});
export function validatePropSymbol(intent,production){
 const symbol=intent?.symbol_intent,issues=[];
 if(!symbol)return {status:'BLOCKED',issues:[{code:'SYMBOL_DECISION_MISSING',at:'symbol_intent'}]};
 if(symbol.mode==='omitted')return String(symbol.reason??'').trim()?{status:'OMITTED_EXPLICIT',issues:[]}:{status:'BLOCKED',issues:[{code:'SYMBOL_OMISSION_REASON_MISSING'}]};
 if(!['required','optional'].includes(symbol.mode))err(issues,'SYMBOL_MODE_INVALID','symbol_intent');
 for(const k of ['meaning','sign_specificity','removal_test'])if(!String(symbol[k]??'').trim())err(issues,'SYMBOL_SEMANTICS_MISSING',k);
 if(!Array.isArray(symbol.beats)||symbol.mode==='required'&&symbol.beats.length<3)err(issues,'SYMBOL_PROGRESS_INSUFFICIENT','beats');
 const map=new Map((production?.scenes??[]).map(s=>[s.id,s])),roles=[],meanings=new Set();
 for(const b of symbol.beats??[]){
  roles.push(b.role);const s=map.get(b.scene_id);if(!s){err(issues,'SYMBOL_SCENE_MISSING',b.scene_id);continue;}
  if(!b.voice_anchor||!s.voice?.includes(b.voice_anchor))err(issues,'SYMBOL_VOICE_ANCHOR_INVALID',b.scene_id);
  const e=s.entities?.find(e=>e.id===b.entity_id),ev=s.events?.find(e=>e.id===b.event_id&&e.target===b.entity_id);
  if(!e||!['object','prop','effect'].includes(e.kind))err(issues,'SYMBOL_ENTITY_NOT_NATIVE_PROP',b.scene_id);
  if(!ev)err(issues,'SYMBOL_EVENT_MISSING',b.scene_id);
  else if(!e?.states?.[ev.state_before]||!e?.states?.[ev.state_after]||JSON.stringify(e.states[ev.state_before])===JSON.stringify(e.states[ev.state_after]))err(issues,'SYMBOL_VISUAL_DELTA_MISSING',b.event_id);
  const meaning=String(b.semantic_delta??'').trim();if(!meaning||meanings.has(meaning))err(issues,'SYMBOL_MEANING_REPEATED_OR_MISSING',b.scene_id);meanings.add(meaning);
 }
 if(symbol.mode==='required'&&JSON.stringify(roles)!==JSON.stringify(['setup','friction','payoff']))err(issues,'SYMBOL_ARC_INVALID','beats');
 return {status:issues.length?'BLOCKED':'PASS',issues,beats:roles.length};
}
export async function validatePropSymbolWorkspace(root){const state=JSON.parse(await readFile(path.join(root,'.authoring/pipeline-state.json')));if(state.run_mode!=='fresh')return {status:'COMPATIBILITY_UNCHANGED'};const intent=JSON.parse(await readFile(path.join(root,'.authoring/visual-intent.json'))),production=JSON.parse(await readFile(path.join(root,'production.json')));const r=validatePropSymbol(intent,production);if(r.status==='BLOCKED')throw Error('PROP_SYMBOL_INVALID '+JSON.stringify(r.issues));return r}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))validatePropSymbolWorkspace(path.resolve(process.argv[2]??'.')).then(x=>console.log(JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
