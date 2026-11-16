import {readFile} from 'node:fs/promises';import path from 'node:path';import {createHash} from 'node:crypto';
export const approvalPaths={narration:['.authoring/narration.txt','narration.txt'],plan:['.authoring/narrative-plan.json','narrative-plan.json'],scope:['.authoring/episode-scope.json'],brief:['.authoring/phase3-writer-brief.json','.authoring/writer-brief.json','.authoring/narration-writer-brief.json'],voice:['.authoring/voice-profile.json','voice-profile.json'],visual_intent:['.authoring/visual-intent.json'],production:['production.json']};
export async function approvalSourceHashes(workspace){const result={};for(const [key,paths]of Object.entries(approvalPaths)){result[key]=null;for(const rel of paths){try{result[key]=createHash('sha256').update(await readFile(path.join(workspace,rel))).digest('hex');break;}catch(e){if(e.code!=='ENOENT')throw e;}}}return result;}
export async function assertContentApprovalSources(workspace,state){const receipt=state?.review_receipts?.find(r=>r.phase_id==='01-content'&&r.status==='APPROVED');if(!receipt?.source_hashes)return {status:'LEGACY_UNBOUND_APPROVAL'};const current=await approvalSourceHashes(workspace);for(const key of ['narration','plan','scope','brief'])if(receipt.source_hashes[key]!==current[key])throw Error('CONTENT_APPROVAL_SOURCE_DRIFT '+key);if(Object.hasOwn(receipt.source_hashes,'voice')&&receipt.source_hashes.voice!==current.voice)throw Error('CONTENT_APPROVAL_SOURCE_DRIFT voice');return {status:'BOUND'};}

export async function buildSourceBoundReviewReceipt(workspace,{phase_id,proof}={}){
 if(!['01-content','02-visual-production'].includes(phase_id)||proof?.kind!=='user_message'||typeof proof.ref!=='string'||!proof.ref.trim()||proof.ref.includes('<'))throw Error('EXPLICIT_USER_REVIEW_REQUIRED');
 const before=await approvalSourceHashes(workspace),missing=['narration','plan','scope','brief','voice'].filter(key=>!before[key]);
 if(missing.length)throw Error('REVIEW_INPUTS_REQUIRED '+missing.join(','));
 const readSource=async key=>{for(const rel of approvalPaths[key])try{return await readFile(path.join(workspace,rel),'utf8');}catch(e){if(e.code!=='ENOENT')throw e;}throw Error('REVIEW_INPUTS_REQUIRED '+key);};
 const {validatePhase1NarrativePerformance,validatePhase1StoryVisuals}=await import('../../contracts/phase1-handoff.mjs');
 validatePhase1StoryVisuals(validatePhase1NarrativePerformance(await readSource('plan'),await readSource('narration')));
 (await import('../../features/episode/episode-scope.mjs')).assertEpisodeScope(JSON.parse(await readSource('scope')));
 (await import('../../references/validate-voice-profile.mjs')).validateVoiceProfile(JSON.parse(await readSource('voice')));
 const brief=JSON.parse(await readSource('brief'));if(!brief||typeof brief!=='object'||Array.isArray(brief)||!Object.keys(brief).length)throw Error('REVIEW_WRITER_BRIEF_REQUIRED');
 if(phase_id==='02-visual-production'){
  const statePath=path.join(workspace,'.authoring/pipeline-state.json'),state=JSON.parse(await readFile(statePath,'utf8'));
  if(state.current_phase!==phase_id||state.phases?.[phase_id]?.status!=='IN_REVIEW')throw Error('REVIEW_PHASE_NOT_READY');
  const binding=await assertContentApprovalSources(workspace,state);
  if(state.run_mode==='fresh'&&binding.status!=='BOUND')throw Error('REVIEW_BOUND_CONTENT_REQUIRED');
  await (await import('../state/validate-pipeline-state.mjs')).validatePipelineState(statePath);
  await (await import('../../features/visual-composition/compile-visual-intent.mjs')).verifyIntentWorkspace(workspace);
  for(const validate of [
   (await import('../../features/visual-composition/validate-phase02-progressive-preflight.mjs')).validateProgressivePreflightWorkspace,
   (await import('../../features/visual-composition/validate-phase02-authoring-completeness.mjs')).validatePhase02AuthoringCompletenessWorkspace,
   (await import('../../features/visual-composition/validate-story-visual-presence.mjs')).validateStoryVisualPresence
  ]){
   const result=await validate(workspace);
   if(result.status!=='PASS')throw Error('REVIEW_VALIDATION_BLOCKED '+JSON.stringify(result.issues));
  }
  await (await import('../../features/visual-composition/validate-native-preview-pairs.mjs')).validateNativePairPreview(workspace);
  const intent=JSON.parse(await readFile(path.join(workspace,'.authoring/visual-intent.json'),'utf8'));
  const experience=(await import('../../features/visual-composition/validate-scene-experience.mjs')).reviewSceneExperience(intent);
  if(experience.decision!=='PASS')throw Error('REVIEW_SCENE_EXPERIENCE_BLOCKED '+JSON.stringify(experience.scenes));
  const composition=await (await import('../../features/visual-composition/resolve-scene-composition.mjs')).inspectResolvedWorkspace(workspace);
  if(composition.status!=='PASS')throw Error('REVIEW_COMPOSITION_BLOCKED '+JSON.stringify(composition.issues));
 }
 const after=await approvalSourceHashes(workspace);
 if(JSON.stringify(before)!==JSON.stringify(after))throw Error('REVIEW_SOURCE_CHANGED_DURING_VALIDATION');
 return {phase_id,status:'APPROVED',proof,source_hashes:after};
}
