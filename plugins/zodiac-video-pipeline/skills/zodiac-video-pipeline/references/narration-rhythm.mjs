import {validateBeatPerformance,anchorPositions} from '../contracts/narration-performance-contract.mjs';
export {SPEECH_FIELDS,validateBeatPerformance,anchorPositions} from '../contracts/narration-performance-contract.mjs';
const fail=m=>{throw Error('NARRATION_RHYTHM_INVALID '+m);};
export function validateNarrationRhythm(plan,narration){
 if(!['2.0','2.1'].includes(plan.version))return;
 for(const beat of plan.beats??[]){validateBeatPerformance(beat.performance,narration);const hits=anchorPositions(narration,beat.voice_anchor);if(!hits.length)fail('ANCHOR_MISSING '+beat.id);
  if(beat.occurrence!==undefined&&(!Number.isInteger(beat.occurrence)||beat.occurrence<1))fail('ANCHOR_OCCURRENCE');
  if(!beat.scene_id&&hits.length>1&&beat.occurrence===undefined)fail('ANCHOR_AMBIGUOUS '+beat.id);
  if(!beat.scene_id&&(beat.occurrence??1)>hits.length)fail('ANCHOR_OCCURRENCE');
 }
}
