#!/usr/bin/env node
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {traceSceneStates} from './scene-state-trace.mjs';
import {isDeepStrictEqual} from 'node:util';
import {assessSemanticEvent} from './semantic-motion-qa.mjs';
import {previewLineage} from '../../core/evidence/preview-lineage.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const fail=(m)=>{throw new Error('NATIVE_PAIR_PREVIEW_INVALID: '+m)};
export async function validateNativePairPreview(root){
 const folder=path.join(root,'.authoring','preview-pairs');
 const receipt=JSON.parse(await readFile(path.join(folder,'preview-report.json'),'utf8'));
 const lineage=await previewLineage(root);if(lineage&&!isDeepStrictEqual(lineage,receipt.authoring_lineage))fail('stale intent/projection lineage');
 if(receipt.format!=='zodiac-native-preview-pairs@2'||receipt.renderer_faithful!==false||receipt.scope!=='native_visual_review_only'||receipt.review_surface!=='scene_complete_plus_event_pairs')fail('receipt format and scope');
 const sourcePath=path.resolve(root,receipt.source);
 if(!sourcePath.startsWith(path.resolve(root)+path.sep))fail('unsafe source path');
 const src=await readFile(sourcePath);const hash=createHash('sha256').update(src).digest('hex');
 if(receipt.source_sha256!==hash)fail('stale source hash');
 const p=JSON.parse(src);const events=p.scenes.flatMap(s=>s.events??[]);
 if(receipt.scene_count!==p.scenes.length||receipt.scene_frame_files!==2*p.scenes.length||!Array.isArray(receipt.scene_frames)||receipt.scene_frames.length!==p.scenes.length||receipt.event_pairs!==events.length||receipt.frame_files!==2*events.length||!Array.isArray(receipt.pairs)||receipt.pairs.length!==events.length)fail('scene/event coverage mismatch');
 const sceneIds=new Set(p.scenes.map(s=>s.id));
 for(const frame of receipt.scene_frames){
  if(!sceneIds.delete(frame.scene_id))fail('missing or duplicated scene frame '+frame.scene_id);
  const scene=p.scenes.find(s=>s.id===frame.scene_id),traces=traceSceneStates(scene);
  const initial=traces[0]?.before??Object.fromEntries((scene.entities??[]).map(e=>[e.id,e.initial_state]));
  const final=traces.at(-1)?.after??initial;
  if(!isDeepStrictEqual(frame.initial_states,initial)||!isDeepStrictEqual(frame.final_states,final))fail('scene state coverage drift '+frame.scene_id);
  for(const phase of ['before','after']){
   const expectedName='scene-'+frame.scene_id+'-'+phase+'.html';if(frame[phase]!==expectedName)fail('scene frame file mismatch '+frame.scene_id+'/'+phase);
   const html=await readFile(path.join(folder,frame[phase]),'utf8');if(!html.includes('<svg ')||html.includes('data:image/svg+xml;base64,')||/<iframe\\b/iu.test(html))fail('scene frame embedding '+frame.scene_id+'/'+phase);
   if(createHash('sha256').update(html).digest('hex')!==frame[phase+'_sha256'])fail('modified scene frame '+frame.scene_id+'/'+phase);
  }
 }
 if(sceneIds.size)fail('missing scene frames '+[...sceneIds].join(','));
 const expected=new Set(p.scenes.flatMap(s=>(s.events??[]).map(e=>`${s.id}/${e.id}`)));
 for(const pair of receipt.pairs){const k=`${pair.scene_id}/${pair.event_id}`;if(!expected.delete(k))fail('missing or duplicated event '+k);if(!['motion_only','state_or_visibility_change','static_hold','actor_state_slide'].includes(pair.kind))fail('invalid event kind '+k);const event=p.scenes.find(s=>s.id===pair.scene_id)?.events.find(e=>e.id===pair.event_id);const scene=p.scenes.find(s=>s.id===pair.scene_id);if(!event||!scene)fail('event lookup '+k);const trace=traceSceneStates(scene).find(t=>t.event_id===event.id);if(!isDeepStrictEqual(pair.cumulative_before,trace.before)||!isDeepStrictEqual(pair.cumulative_after,trace.after))fail('cumulative state drift '+k);const qa=assessSemanticEvent(scene,event);if(pair.kind!==qa.kind||pair.runner_motion_check_required!==qa.runner_motion_check_required||JSON.stringify(pair.expected_motion)!==JSON.stringify(qa.expected_motion))fail('semantic motion QA drift '+k);
  for(const phase of ['before','after']){if(pair[phase]!==`${pair.scene_id}_${pair.event_id}-${phase}.html`)fail('frame file mismatch '+k);const html=await readFile(path.join(folder,pair[phase]),'utf8');if(!html.includes('<svg ')||html.includes('data:image/svg+xml;base64,')||/<iframe\b/iu.test(html))fail('missing inline SVG or blocked embedding in frame '+k+' '+phase);if(createHash('sha256').update(html).digest('hex')!==pair[phase+'_sha256'])fail('modified preview frame '+k+' '+phase);}
 }
 const index=await readFile(path.join(folder,'index.html'),'utf8');if(!index.includes('semantic endpoints, not timed Remotion frames'))fail('missing parity disclaimer');if(/<iframe\b|data:image\/svg\+xml;base64,|<script\b/iu.test(index))fail('preview index contains blocked/embed content');const expectedFrames=2*events.length+2*p.scenes.length;if((index.match(/data-preview-frame=/gu)??[]).length!==expectedFrames)fail('preview index missing inline frames');if((index.match(/<svg\b/gu)??[]).length<expectedFrames)fail('preview index missing inline SVG');if(createHash('sha256').update(index).digest('hex')!==receipt.index_sha256)fail('modified preview index');for(const [rel,sha] of Object.entries(receipt.assets_sha256??{})){if(rel.startsWith('/')||rel.split('/').includes('..'))fail('unsafe asset path');const data=await readFile(path.resolve(root,rel));if(createHash('sha256').update(data).digest('hex')!==sha)fail('stale source SVG '+rel);}if(!Object.keys(receipt.assets_sha256??{}).length)fail('missing source SVG checksums');
 if(expected.size)fail('missing events '+[...expected].join(','));
 if(receipt.motion_only_count!==receipt.pairs.filter(x=>x.kind==='motion_only').length||receipt.static_hold_count!==receipt.pairs.filter(x=>x.kind==='static_hold').length||receipt.transition_count!==receipt.pairs.filter(x=>['state_or_visibility_change','actor_state_slide'].includes(x.kind)).length)fail('event classification counts drift');
 return {pairs:events.length,eventFrames:events.length*2,sceneFrames:p.scenes.length*2,motionOnly:receipt.motion_only_count};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const root=process.argv[2];if(!root){console.error('Usage: node validate-native-preview-pairs.mjs <workspace>');process.exit(2);}try{const r=await validateNativePairPreview(path.resolve(root));console.log(`NATIVE_PAIR_PREVIEW_VALIDATION_PASS events=${r.pairs} event_frames=${r.eventFrames} scene_frames=${r.sceneFrames} motion_only=${r.motionOnly}`);}catch(e){console.error(e.message);process.exit(1);}
}
