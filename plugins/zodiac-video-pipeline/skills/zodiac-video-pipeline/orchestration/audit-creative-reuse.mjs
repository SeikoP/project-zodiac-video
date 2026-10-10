#!/usr/bin/env node
// Editorial repetition report. Reuse is not prohibited; no invented approvals.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';
const norm=s=>String(s??'').trim().toLocaleLowerCase('vi-VN').replace(/\s+/g,' ');
const sceneKey=o=>String(o?.scene_id??o?.id??'');
export function auditCreativeReuse({production,visualGrammar,depth,assetPlan}={}){
 const scenes=production?.scenes;
 if(!Array.isArray(scenes)||!scenes.length)throw new Error('REUSE_PRODUCTION_REQUIRED');
 const ids=scenes.map(s=>s.id);
 if(new Set(ids).size!==ids.length)throw new Error('REUSE_DUPLICATE_SCENE');
 const index=(doc,name)=>{const m=new Map();for(const item of doc?.scenes??[]){const id=sceneKey(item);if(!ids.includes(id)||m.has(id))throw new Error('REUSE_PLAN_SCENE_INVALID '+name+' '+id);m.set(id,item);}return m;};
 const grams=index(visualGrammar,'grammar'),depths=index(depth,'depth');
 const flags=[],byMaster=new Map(),identities=[];
 const add=(code,sceneIds,details={})=>flags.push({code,scenes:sceneIds,...details,severity:'EDITORIAL_REVIEW'});
 for(const s of scenes){
  const g=grams.get(s.id)??{},d=depths.get(s.id)??{};
  const active=(s.entities??[]).filter(e=>!/^env__|^depth__|^decor_/u.test(e.id));
  const objects=active.filter(e=>e.kind==='story_object'||e.kind==='object'||/^story[_-]/u.test(e.id));
  const objectSignature=objects.map(e=>({id:e.id,states:Object.keys(e.states??{}).length,events:(s.events??[]).filter(v=>v.target===e.id).map(v=>({before:v.state_before,after:v.state_after,motion:v.motion?.preset??v.desired_motion??v.motion??null}))}));
  identities.push({scene:s.id,frame:g.frame_id??null,mechanic:g.mechanic_id??null,palette:d.palette??d.palette_id??null,profile:d.profile??d.environment_profile??null,objectSignature:JSON.stringify(objectSignature),cast:(active.filter(e=>e.kind==='character').map(e=>e.id)).sort().join(',')});
  const primary=active.filter(e=>e.kind==='story_object'||/^story[_-]/u.test(e.id));
  for(const e of primary)for(const state of Object.values(e.states??{})){
    const a=production.assets?.[state?.asset];if(!a)continue;
    const master=String(a.lineage?.source_master??a.path??state.asset);
    const arr=byMaster.get(master)??new Set();arr.add(s.id);byMaster.set(master,arr);
  }
 }
 for(let i=2;i<identities.length;i++){
  const trio=identities.slice(i-2,i+1),q=trio.map(x=>x.scene);
  for(const [field,code] of [['frame','THREE_SCENES_SAME_FRAME'],['mechanic','THREE_SCENES_SAME_MECHANIC'],['palette','THREE_SCENES_SAME_PALETTE'],['profile','THREE_SCENES_SAME_ENVIRONMENT']]){
    if(trio.every(x=>x[field]!==null&&x[field]===trio[0][field]))add(code,q,{value:trio[0][field]});
  }
  if(trio.every(x=>x.objectSignature!=='[]'&&x.objectSignature===trio[0].objectSignature))add('THREE_SCENES_SAME_OBJECT_CHOREOGRAPHY',q);
 }
 const decisions=assetPlan?.semantic_asset_fit?.decisions??[];
 const byReuse=new Map();
 for(const d of decisions){if(d.role!=='primary_story'||!d.scene_id)continue;const master=String(d.selected_master??d.asset_id??'');if(!master)continue;const arr=byReuse.get(master)??[];arr.push({scene:String(d.scene_id),need:norm(d.semantic_need)});byReuse.set(master,arr);}
 for(const [master,rows] of byReuse){const uniqueScenes=[...new Set(rows.map(x=>x.scene))],needs=[...new Set(rows.map(x=>x.need).filter(Boolean))];if(uniqueScenes.length>=3&&needs.length>=2)add('MASTER_REUSED_ACROSS_DIFFERENT_MEANINGS',uniqueScenes,{master,distinct_needs:needs.length});}
 const repeated=[...byMaster].filter(([,v])=>v.size>=4).map(([master,v])=>({master,scene_count:v.size}));
 return {format:'zodiac-creative-reuse-audit@1',status:'REVIEW_REQUIRED',flags,reused_story_masters:repeated,scenes_checked:scenes.length,policy:'Reuse stable identities/assets for continuity. Review unrelated meanings, three-scene repetition and unsupported variation; do not generate extra SVG solely to satisfy a quota.',not_a_validation_or_creative_pass:true};
}
export async function auditWorkspace(root){const load=async rel=>{try{return JSON.parse(await readFile(path.join(root,rel),'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};const report=auditCreativeReuse({production:await load('production.json'),visualGrammar:await load('visual-grammar-plan.json')??await load('.authoring/visual-grammar-plan.json'),depth:await load('.authoring/depth-composition-plan.json'),assetPlan:await load('asset-plan.json')});const p=path.join(root,'.authoring/creative-reuse-audit.json');await mkdir(path.dirname(p),{recursive:true});await writeFile(p,JSON.stringify(report,null,2)+'\n');return {path:p,...report};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node audit-creative-reuse.mjs <workspace>');process.exitCode=2;}
 else try{console.log(JSON.stringify(await auditWorkspace(path.resolve(root)),null,2));}catch(e){console.error('CREATIVE_REUSE_AUDIT_BLOCKED '+e.message);process.exitCode=2;}
}
