import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function validateMotionConsistency(production,registry){
 const issues=[];for(const s of production.scenes??[])for(const e of s.events??[]){const m=e.motion,preset=typeof m==='string'?m:m?.preset;if(!preset)continue;const entry=registry.motions?.[preset];if(!entry){issues.push({code:'MOTION_PRESET_UNKNOWN',scene_id:s.id,event_id:e.id,preset});continue;}const duration=typeof m==='object'?m.duration_frames:undefined;
 if(duration!==undefined&&(!Number.isInteger(duration)||duration<=0||duration>300||(duration!==entry.default_duration_frames&&m.duration_override!==true)))issues.push({code:'MOTION_DURATION_INVALID',scene_id:s.id,event_id:e.id,expected:entry.default_duration_frames,actual:duration});
 }return {format:'zodiac-motion-consistency@1',status:issues.length?'BLOCKED':'PASS',issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const [p,r]=await Promise.all([readFile(path.join(process.argv[2],'production.json')).then(JSON.parse),readFile(new URL('../../contracts/motion-registry-v1.json',import.meta.url)).then(JSON.parse)]);const result=validateMotionConsistency(p,r);console.log(JSON.stringify(result));if(result.status!=='PASS')process.exitCode=1;}
