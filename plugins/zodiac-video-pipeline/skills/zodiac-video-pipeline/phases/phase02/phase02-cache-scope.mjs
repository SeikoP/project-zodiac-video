// Cache fingerprints should follow the files a native owner actually consumes.
// Required-input checks remain broader in phase02-execute; this module only narrows invalidation.
const unique=xs=>[...new Set(xs.filter(Boolean))];

export function cacheInputsForStep(stepId,{coreInputPaths=[],publishInputPaths=[]}={}){
 const production=coreInputPaths.find(x=>x==='production.json')??'production.json';
 const narration=coreInputPaths.find(x=>x==='narration.txt')??'narration.txt';
 const characterPlan=coreInputPaths.find(x=>x.endsWith('character-assembly-plan.json'))??'.authoring/character-assembly-plan.json';
 const narrativePlan=coreInputPaths.find(x=>x.endsWith('narrative-plan.json'))??null;
 if(stepId==='narration_performance')return unique([narration,narrativePlan]);
 if(['character_components','character_plan','character_write','character_identity','outfit_bake'].includes(stepId))return unique([production,characterPlan]);
 if(stepId==='publish_prep')return unique([production,narration,...publishInputPaths]);
 return [production];
}
