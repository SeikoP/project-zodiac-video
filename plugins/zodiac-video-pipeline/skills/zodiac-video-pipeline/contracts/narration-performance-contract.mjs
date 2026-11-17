export const SPEECH_FIELDS=['delivery','energy','emotion','pace','emphasis'];

const fail=m=>{throw Error('NARRATION_RHYTHM_INVALID '+m);};

export function validateBeatPerformance(value,voice){
 if(!value||typeof value!=='object'||Array.isArray(value))fail('PERFORMANCE_MISSING');
 for(const key of Object.keys(value))if(![...SPEECH_FIELDS,'reason'].includes(key))fail('UNKNOWN_FIELD '+key);
 for(const key of ['delivery','emotion','reason'])if(typeof value[key]!=='string'||!value[key].trim())fail('PERFORMANCE_'+key.toUpperCase());
 if(!Number.isFinite(value.energy)||value.energy<0||value.energy>1)fail('ENERGY');
 if(!['slow','medium','fast'].includes(value.pace))fail('PACE');
 if(!Array.isArray(value.emphasis)||value.emphasis.some(x=>typeof x!=='string'||!x.trim()||(voice!==undefined&&!voice.includes(x))))fail('EMPHASIS');
 return Object.fromEntries(SPEECH_FIELDS.map(key=>[key,structuredClone(value[key])]));
}

export function anchorPositions(voice,anchor){
 if(typeof anchor!=='string'||!anchor.trim())fail('ANCHOR_MISSING');
 const hits=[];
 for(let start=0;start<=voice.length;){
  const at=voice.indexOf(anchor,start);
  if(at<0)break;
  hits.push(at);start=at+anchor.length;
 }
 return hits;
}
