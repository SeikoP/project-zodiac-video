import {readFile} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
export const defaultLayout={canvas:{width:1080,height:1920},caption_safe_zone:{x:80,y:1320,width:920,height:350},character_zone:{x:24,y:360,width:1032,height:545},prop_zone:{x:100,y:930,width:880,height:340},effect_zone:{x:20,y:380,width:1040,height:510}};
export function resolveHandoffLayout(authored={}){return Object.fromEntries(Object.entries(defaultLayout).map(([k,v])=>[k,{...v,...authored[k]}]));}
export function preflightHandoff(source){const issues=[],add=(scene_id,code,path)=>issues.push({scene_id,code,path});for(const scene of source.scenes??[]){const layout=resolveHandoffLayout(scene.layout_contract),a=layout.caption_safe_zone;for(const k of ['caption_safe_zone','character_zone','prop_zone','effect_zone']){const b=layout[k];if(![b.x,b.y,b.width,b.height].every(Number.isFinite)||b.x<0||b.y<0||b.width<=0||b.height<=0||b.x+b.width>layout.canvas.width||b.y+b.height>layout.canvas.height)add(scene.id,'LAYOUT_ZONE_INVALID',k);if(k!=='caption_safe_zone'&&a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y)add(scene.id,'CAPTION_ZONE_OVERLAP',k);}
 const categories=new Map(),current={};
 for(const e of scene.entities??[]){
  const cats=new Set(Object.values(e.states??{}).map(st=>source.assets?.[st.asset]?.category).filter(Boolean));
  if(cats.size>1)add(scene.id,'ENTITY_CATEGORY_MIX',e.id);
  categories.set(e.id,[...cats][0]??(e.kind==='character'?'character':null));
  current[e.id]=e.initial_state??Object.keys(e.states??{})[0];
 }
 const assetFolderCategory=p=>{const path=String(p??'').replaceAll('\\\\','/');for(const [part,cat] of [['characters','character'],['props','prop'],['effects','effect'],['story','story_object'],['symbols','story_symbol'],['environment','environment'],['environments','environment']])if(path.split('/').includes(part))return cat;return null;};
 for(const [assetId,asset] of Object.entries(source.assets??{})){const inferred=assetFolderCategory(asset.path);if(inferred&&asset.category!==inferred&&!(inferred==='story_object'&&asset.category==='narrative_visual'))add(scene.id,'ASSET_CATEGORY_MISMATCH',assetId);}
 const byId=new Map((scene.entities??[]).map(e=>[e.id,e]));
 const links=new Set((scene.spatial_bindings??[]).map(b=>b.entity+'->'+b.anchor));
 for(const b of scene.spatial_bindings??[])if(links.has(b.anchor+'->'+b.entity))add(scene.id,'SPATIAL_BINDING_CYCLE',b.entity);
 const anchorCheck=(stage)=>{for(const b of scene.spatial_bindings??[]){const child=byId.get(b.entity),anchor=byId.get(b.anchor);if(!child||!anchor)continue;const c=child.states?.[current[child.id]],a=anchor.states?.[current[anchor.id]];if(c?.visible!==false&&a?.visible===false)add(scene.id,'SPATIAL_ANCHOR_HIDDEN',b.entity+'->'+b.anchor+'@'+stage);}};
 anchorCheck('initial');
 for(const ev of scene.events??[]){if(ev.target in current&&ev.state_after)current[ev.target]=ev.state_after;anchorCheck(ev.id??'event');}
 for(const e of scene.entities??[])current[e.id]=e.initial_state??Object.keys(e.states??{})[0];
 const limits={max_characters:3,max_prominent_props:2,max_prominent_effects:2,...scene.render_density_budget},reported=new Set();
 const density=()=>{
  const counts={character:0,prop:0,effect:0};
  for(const e of scene.entities??[]){
   if(e.states?.[current[e.id]]?.visible===false)continue;
   const cat=categories.get(e.id);if(cat==='character_pose')counts.character++;else if(cat in counts)counts[cat]++;
  }
  if((counts.character>limits.max_characters||counts.prop>limits.max_prominent_props||counts.effect>limits.max_prominent_effects)&&!reported.has('SCENE_DENSITY_EXCEEDED')){add(scene.id,'SCENE_DENSITY_EXCEEDED','render_density_budget');reported.add('SCENE_DENSITY_EXCEEDED');}
  if(counts.character===3&&(counts.prop>1||counts.effect>1)&&!reported.has('THREE_ACTOR_DENSITY')){add(scene.id,'THREE_ACTOR_DENSITY','entities');reported.add('THREE_ACTOR_DENSITY');}
 };
 density();for(const event of [...(scene.events??[])].sort((a,b)=>(a.start_frame??0)-(b.start_frame??0))){if(event.target&&event.state_after)current[event.target]=event.state_after;density();}
 }

 return {status:issues.length?'BLOCKED':'PASS',issues};}
export async function preflightCompiler(source,design,options={}){const result=preflightHandoff(source);try{const {compileJobV5}=await import('./compile-job-v5.mjs');const {validateRunnerMotionBoundary}=await import('../../features/visual-composition/validate-runner-motion-boundary.mjs');const schema=JSON.parse(await readFile(new URL('../../references/contracts/authoring-ir-v1.schema.json',import.meta.url)));const {ir}=compileJobV5(source,design,{sign:'preview',concept:'preflight',contractSchema:schema,...options});const {validateSchema}=await import('../../core/schema/schema-lite.mjs');const schemaIssues=validateSchema(schema,ir);if(schemaIssues.length)result.issues.push(...schemaIssues.map(issue=>({code:'HANDOFF_IR_SCHEMA_INVALID',detail:issue})));const {lintSemanticAnimation}=await import('../../features/visual-composition/validate-animation-semantics.mjs');const semantic=lintSemanticAnimation(ir).filter(issue=>issue.severity==='P1');if(semantic.length)result.issues.push(...semantic.map(issue=>({code:'HANDOFF_SEMANTIC_P1',detail:issue})));const {assertProductionSemantics}=await import('./phase03-production-release.mjs');try{assertProductionSemantics(ir);}catch(e){result.issues.push({code:'HANDOFF_PRODUCTION_SEMANTICS_INVALID',detail:e.message});}const motion=validateRunnerMotionBoundary(ir);if(!motion.ok)result.issues.push(...motion.issues.map(issue=>({code:'RUNNER_MOTION_BOUNDARY',detail:issue})));}catch(e){result.issues.push({code:'HANDOFF_COMPILER_INVALID',detail:e.message});}result.status=result.issues.length?'BLOCKED':'PASS';result.not_an_approval=true;return result;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){(async()=>{try{const root=process.argv[2];const report=await preflightCompiler(JSON.parse(await readFile(path.join(root,'production.json'),'utf8')),await readFile(path.join(root,'design.md'),'utf8'));console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;}catch(e){console.error(e.message);process.exitCode=2;}})();}
