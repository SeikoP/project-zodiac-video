import {readFile,writeFile,mkdir} from 'node:fs/promises';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {validateBeatPerformance,anchorPositions} from '../references/narration-rhythm.mjs';import {compositionHash} from './phase02-composition.mjs';
import {voicesMatchNarration} from './voice-source-ranges.mjs';
const fail=m=>{throw Error('NARRATION_PERFORMANCE_INVALID '+m);};
export function compileNarrationPerformance(production,plan,narration){
 const out=structuredClone(production);if(plan.version==='1.1')return out;if(!['2.0','2.1'].includes(plan.version))fail('VERSION');
 const normalizeLines=s=>s.replace(/\r\n/g,'\n');
 if(!(out.voice_partition==='utf8_ranges'?voicesMatchNarration(out.scenes.map(s=>s.voice),narration):voicesMatchNarration(out.scenes.map(s=>normalizeLines(s.voice)),normalizeLines(narration))))fail('NARRATION_DRIFT');
 const mapped=new Map(),ids=new Set();
 for(const beat of plan.beats??[]){if(!beat.id||ids.has(beat.id))fail('BEAT_ID');ids.add(beat.id);
  const candidates=out.scenes.filter(s=>!beat.scene_id||s.id===beat.scene_id),hits=candidates.flatMap(s=>anchorPositions(s.voice,beat.voice_anchor).map(position=>({scene:s,position})));
  const occurrence=beat.occurrence??1;if(!hits.length)fail('ANCHOR_MISSING '+beat.id);if(hits.length>1&&beat.occurrence===undefined)fail('ANCHOR_AMBIGUOUS '+beat.id);
  if(!Number.isInteger(occurrence)||occurrence<1||occurrence>hits.length)fail('ANCHOR_OCCURRENCE '+beat.id);
  const scene=hits[occurrence-1].scene,speech=validateBeatPerformance(beat.performance,scene.voice),previous=mapped.get(scene.id);
  if(previous&&compositionHash(previous)!==compositionHash(speech))fail('SAME_SCENE_PERFORMANCE_CONFLICT '+scene.id);
  mapped.set(scene.id,speech);
 }
 for(const scene of out.scenes){if(scene.voice.trim()&&!mapped.has(scene.id))fail('SCENE_COVERAGE '+scene.id);if(mapped.has(scene.id))scene.performance_context={...scene.performance_context,...mapped.get(scene.id)};}
 return out;
}
export async function compileNarrationPerformanceWorkspace(root,{write=false}={}){
 const [raw,plan,narration]=await Promise.all([readFile(path.join(root,'production.json'),'utf8'),readFile(path.join(root,'.authoring/narrative-plan.json'),'utf8').catch(async e=>{if(e.code!=='ENOENT')throw e;return readFile(path.join(root,'narrative-plan.json'),'utf8');}),readFile(path.join(root,'narration.txt'),'utf8')]);
 const state=await readFile(path.join(root,'.authoring/pipeline-state.json'),'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
 const version=String(state?.plugin_version??'0.0.0').split('.').map(Number);
 if(state?.run_mode==='fresh'&&(version[0]>2||version[0]===2&&(version[1]>4||version[1]===4&&version[2]>=47))&&!['2.0','2.1'].includes(JSON.parse(plan).version))fail('NARRATIVE_V2_REQUIRED');
 const production=JSON.parse(raw),parsed=JSON.parse(plan),output=compileNarrationPerformance(production,parsed,narration);
 if(!write&&compositionHash(output)!==compositionHash(production))fail('SOURCE_PERFORMANCE_DRIFT');
 const report={format:'zodiac-narration-performance-compile@1',status:'PASS',plan_version:parsed.version,source_sha256:compositionHash(output),plan_sha256:compositionHash(parsed),not_an_approval:true,prosody_verified:false};
 if(write){await mkdir(path.join(root,'.authoring'),{recursive:true});await writeFile(path.join(root,'production.json'),JSON.stringify(output,null,2)+'\n');await writeFile(path.join(root,'.authoring/narration-performance-receipt.json'),JSON.stringify(report,null,2)+'\n');}return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{console.log(JSON.stringify(await compileNarrationPerformanceWorkspace(process.argv[2],{write:process.argv.includes('--write')}),null,2));}catch(e){console.error(e.message);process.exitCode=2;}}
