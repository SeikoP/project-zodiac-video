import {validateVisualMetaphorPlan} from './validate-visual-metaphor.mjs';
export function compileVisualMetaphorPlan(input){
 const plan=structuredClone(input??{});
 const result=validateVisualMetaphorPlan(plan);
 if(result.status==='BLOCKED')throw new Error('VISUAL_METAPHOR_INVALID '+result.issues.map(x=>x.code+':'+x.at).join(','));
 return plan;
}
