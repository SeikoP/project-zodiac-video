import path from 'node:path';

export const sourcePaths=[
 'phases/phase02/phase02-native-plan.mjs',
 'core/performance/native-command.mjs',
 'features/episode/episode-handoff.mjs','features/episode/episode-scope.mjs',
 'orchestration/phase-index.json',
 'orchestration/pipeline-state.template.json',
 'core/state/validate-pipeline-state.mjs',
 'core/evidence/run-validator-with-receipt.mjs',
 'features/visual-composition/validate-authoring-scene-events.mjs',
 'features/visual-composition/validate-visual-quality.mjs',
 'features/visual-composition/validate-phase02-precompile-boundary.mjs',
 'features/visual-composition/validate-phase02-progressive-preflight.mjs',
 'features/visual-composition/validate-scene-experience.mjs',
 'features/visual-composition/phase02-composition.mjs',
 'core/ownership/generated-asset-ownership.mjs',
 'features/narration-performance/compile-narration-performance.mjs',
 'references/narration-rhythm.mjs',
 'features/visual-composition/resolve-scene-composition.mjs',
 'references/asset-library-v4/memes/compile-meme-props.mjs',
 'references/asset-library-v4/memes/effect-lifecycle.mjs',
 'references/design.md',
 'features/visual-composition/validate-phase02-art-direction.mjs',
 'features/scene-set/validate-scene-set-identity.mjs',
 'features/scene-set/scene-set-detection.mjs',
 'references/asset-library-v4/scene-set/index.json',
 'references/asset-library-v4/scene-set/compile-scene-set.mjs',
 'references/asset-library-v4/scene-set/accents/index.json',
 'phases/phase02/phase02-selected-dependencies.mjs',
 'features/visual-composition/validate-motion-consistency.mjs',
 'features/scene-set/validate-scene-set-accents.mjs',
 'art-direction/palette-registry.json',
 'art-direction/environment-registry.json',
 'features/publish/validate-publish-prep.mjs',
 'references/asset-library-v4/characters/compile-character-assembly.mjs',
 'references/asset-library-v4/characters/character-design-intent.mjs',
 'features/visual-composition/validate-character-intent-preflight.mjs',
 'references/asset-library-v4/characters/components/catalog.json',
 'references/asset-library-v4/validation/validate-character-assembly.mjs',
 'references/asset-library-v4/validation/validate-character-components.mjs',
 'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs',
 'references/asset-library-v4/environments/compile-environment.mjs',
 'references/asset-library-v4/environments/validate-environment-binding.mjs',
 'references/asset-library-v4/scene-set/index.json',
 'references/asset-library-v4/scene-direction/compile-scene-direction.mjs',
 'references/asset-library-v4/scene-direction/compiler-profile.json',
 'references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs',
];

export function phase02NativeSteps(workspace,{narrationPerformance=false,modernComposition=false,currentVisual=false,finalizeManifest=false}={}){
const steps=[
 {id:'character_components',src:'references/asset-library-v4/validation/validate-character-components.mjs',args:[],required:[],validator:true},
 {id:'character_plan',src:'references/asset-library-v4/characters/compile-character-assembly.mjs',args:[path.join(workspace,'production.json'),path.join(workspace,'.authoring/character-assembly-plan.json'),'--plan-only'],required:['.authoring/character-state-asset-plan.json']},
 {id:'character_write',src:'references/asset-library-v4/characters/compile-character-assembly.mjs',args:[path.join(workspace,'production.json'),path.join(workspace,'.authoring/character-assembly-plan.json'),'--write'],required:['.authoring/character-state-asset-plan.json']},
 {id:'character_identity',src:'references/asset-library-v4/validation/validate-character-assembly.mjs',args:[workspace],required:[],validator:true},
 {id:'outfit_bake',src:'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs',args:[workspace],required:[],validator:true},
 {id:'environment',src:'references/asset-library-v4/environments/compile-environment.mjs',args:[workspace,'--write'],required:['.authoring/environment-compile-receipt.json']},
 {id:'environment_binding',src:'references/asset-library-v4/environments/validate-environment-binding.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_direction',src:'references/asset-library-v4/scene-direction/compile-scene-direction.mjs',args:[workspace,'--write'],required:['.authoring/scene-direction-compile-receipt.json']},
 {id:'scene_set_identity',src:'features/scene-set/validate-scene-set-identity.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_accent_containment',src:'features/scene-set/validate-scene-set-accents.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_direction_validation',src:'references/asset-library-v4/scene-direction/validate-scene-direction-compile.mjs',args:[workspace],required:[],validator:true},
 {id:'scene_events',src:'features/visual-composition/validate-authoring-scene-events.mjs',args:[workspace],required:[],validator:true},
 {id:'motion_consistency',src:'features/visual-composition/validate-motion-consistency.mjs',args:[workspace],required:[],validator:true},
 {id:'visual_quality',src:'features/visual-composition/validate-visual-quality.mjs',args:[workspace],required:[],validator:true},
 {id:'publish_prep',src:'features/publish/validate-publish-prep.mjs',args:[workspace],required:[],validator:true},
];
if(narrationPerformance){steps.unshift({id:'narration_performance',src:'features/narration-performance/compile-narration-performance.mjs',args:[workspace,'--write'],required:['.authoring/narration-performance-receipt.json']});}
steps.splice(steps.findIndex(s=>s.id==='environment'),0,{id:'meme_props',src:'references/asset-library-v4/memes/compile-meme-props.mjs',args:[path.join(workspace,'production.json'),'--write'],required:['.authoring/meme-prop-compile-receipt.json','.authoring/generated-assets.json']});
if(modernComposition){steps.splice(steps.findIndex(s=>s.id==='scene_events'),0,{id:'composition_resolved',src:'features/visual-composition/resolve-scene-composition.mjs',args:[workspace,'--write'],required:['.authoring/scene-composition-resolved.json']});}
// Retired Scene Set checks remain available for compatibility only.
// Current Visual Intent uses canvas-native composition even when recovering a continuity run.
if(currentVisual){
 for(const oldId of ['scene_set_identity','scene_accent_containment']){
  const ix=steps.findIndex(s=>s.id===oldId);if(ix>=0)steps.splice(ix,1);
 }
}
if(finalizeManifest)steps.push({id:'director_final_review',src:'features/visual-composition/run-director-v2-review.mjs',args:[workspace],required:['.authoring/director-v2-review-receipt.json']});
return steps;
}
