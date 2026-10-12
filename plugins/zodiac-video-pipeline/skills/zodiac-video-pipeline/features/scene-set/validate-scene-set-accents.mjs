import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const valid=r=>r&&['x','y','width','height'].every(k=>Number.isFinite(r[k]))&&r.width>0&&r.height>0;
export function validateSceneSetAccents(production){
 const issues=[];for(const scene of production.scenes??[]){const accents=scene.environment?.scene_accents??[];if(!accents.length)continue;const wall=scene.environment?.scene_set?.wall_region;
  if(!valid(wall)){issues.push({code:'SCENE_ACCENT_WALL_MISSING',scene_id:scene.id});continue;}
  const seen=new Set();for(const accent of accents){const id=accent.entity_id,e=scene.entities?.find(e=>e.id===id);if(!e||seen.has(id)){issues.push({code:'SCENE_ACCENT_ENTITY_INVALID',scene_id:scene.id,entity_id:id});continue;}seen.add(id);
   const states=Object.values(e.states??{}).filter(s=>s.visible!==false);if(!states.length)issues.push({code:'SCENE_ACCENT_STATES_MISSING',scene_id:scene.id,entity_id:id});for(const s of states){const r=s.transform;if(!valid(r)||r.x<wall.x||r.y<wall.y||r.x+r.width>wall.x+wall.width||r.y+r.height>wall.y+wall.height)issues.push({code:'SCENE_ACCENT_OUTSIDE_WALL',scene_id:scene.id,entity_id:id});}
  }
 }return {format:'zodiac-scene-accent-qc@1',status:issues.length?'BLOCKED':'PASS',issues};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const r=validateSceneSetAccents(JSON.parse(await readFile(path.join(process.argv[2],'production.json'))));console.log(JSON.stringify(r));if(r.status!=='PASS')process.exitCode=1;}
