#!/usr/bin/env node
// Revision-impact assessment: no approval is issued or copied by this tool.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {buildPhase02SemanticGraph,diffPhase02SemanticGraphs,revisionGuidance} from '../cache/phase02-semantic-cache.mjs';
const args=process.argv.slice(2), opt=k=>{const i=args.indexOf(k);return i<0?null:args[i+1]??null};
const before=opt('--before'),after=opt('--after'),output=opt('--output');
if(!before||!after){console.error('Usage: assess-revision-impact.mjs --before <approved-workspace> --after <revised-workspace> [--output <json>]');process.exit(2)}
const sha=b=>createHash('sha256').update(b).digest('hex');
async function inventory(root){
 const dirs=['assets'];
 const contentNames=['episode-scope.json','phase3-writer-brief.json','writer-brief.json','narrative-plan.json','concept-candidates.json','writer-brief-extras.json','engagement-design.json','reference-mechanics.json','voice-profile.json','narrative-design.json','voice-fidelity-review.json','viral-analysis.json','narration.txt'];
 const evidenceNames=['evidence-ledger.json','evidence-brief.json','evidence-summary.md','research-scope.json'];
 const rels=[...contentNames,...evidenceNames,...[...contentNames,...evidenceNames].map(name=>'.authoring/'+name),'.authoring/visual-intent.json','asset-plan.json','visual-grammar-plan.json','.authoring/character-assembly-plan.json','.authoring/generated-assets.json','.authoring/scene-composition-resolved.json','production.json','design.md','design-token.json','publish/publish.json','publish/publish-copy.txt','.authoring/story-beat-choreography.json','.authoring/scene-art-direction.json','.authoring/director-plan.json'];
 const {readdir}=await import('node:fs/promises');
 async function walk(dir){let ents=[];try{ents=await readdir(path.join(root,dir),{withFileTypes:true})}catch(e){if(e.code==='ENOENT')return;throw e}
  for(const e of ents){const rel=path.posix.join(dir,e.name);if(e.isSymbolicLink())throw Error('SYMLINK_UNSAFE '+rel);if(e.isDirectory())await walk(rel);else if(e.isFile())rels.push(rel)}
 }
 for(const d of dirs)await walk(d);
 const fileHash={},json={};for(const r of rels){let b;try{b=await readFile(path.join(root,r))}catch(e){if(e.code==='ENOENT')continue;throw e}fileHash[r]=sha(b);if(r.endsWith('.json')){try{json[r]=JSON.parse(b.toString('utf8'))}catch(e){json[r]=null}}}
 return {fileHash,json};
}
let x,y;try{[x,y]=await Promise.all([inventory(path.resolve(before)),inventory(path.resolve(after))])}catch(e){console.error('INVENTORY_ERROR '+e.message);process.exit(2)}
const files=[...new Set([...Object.keys(x.fileHash),...Object.keys(y.fileHash)])].sort();
const changed=files.filter(f=>x.fileHash[f]!==y.fileHash[f]);
const groups={content:[],visual:[],publish:[],token:[],evidence:[],performance:[]};
const evidenceFiles=new Set(['evidence-ledger.json','evidence-brief.json','evidence-summary.md','research-scope.json']);
const conceptFiles=new Set(['episode-scope.json','phase3-writer-brief.json','writer-brief.json','narrative-plan.json','concept-candidates.json','writer-brief-extras.json','engagement-design.json','reference-mechanics.json','voice-profile.json','narrative-design.json','viral-analysis.json']);
for(const f of changed){const name=f.replace(/^\.authoring\//u,'');if(evidenceFiles.has(name))groups.evidence.push(f);else if(name==='narration.txt'||conceptFiles.has(name))groups.content.push(f);else if(f.startsWith('publish/'))groups.publish.push(f);else if(['design.md','design-token.json'].includes(f))groups.token.push(f);else groups.visual.push(f)}
let eventChange=false,voiceChange=false;
const p0=x.json['production.json'],p1=y.json['production.json'];
if(p0&&p1){
 const scenes0=p0.scenes??[],scenes1=p1.scenes??[];
 if(JSON.stringify(scenes0.map(s=>[s.id,s.voice]))!==JSON.stringify(scenes1.map(s=>[s.id,s.voice])))voiceChange=true;
 if(JSON.stringify(scenes0.map(s=>[s.id,s.events,s.entities,s.spatial_bindings,s.occlusion_relations]))!==JSON.stringify(scenes1.map(s=>[s.id,s.events,s.entities,s.spatial_bindings,s.occlusion_relations])))eventChange=true;
}else if(changed.includes('production.json')){eventChange=true;voiceChange=true}
if(voiceChange&&!groups.content.includes('production.json:scene_voice'))groups.content.push('production.json:scene_voice');
const withoutPerformance=value=>Array.isArray(value)?value.map(withoutPerformance):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>!['performance','performance_context'].includes(key)).map(([key,val])=>[key,withoutPerformance(val)])):value;
for(const file of [...groups.content,...groups.visual])if(['production.json','.authoring/narrative-plan.json','narrative-plan.json'].includes(file)&&x.json[file]&&y.json[file]&&JSON.stringify(withoutPerformance(x.json[file]))===JSON.stringify(withoutPerformance(y.json[file]))){groups.performance.push(file);groups.content=groups.content.filter(f=>f!==file);groups.visual=groups.visual.filter(f=>f!==file);}
const approval={content:(groups.evidence.length||groups.content.length||groups.performance.some(f=>f!=='production.json'))?'REAPPROVAL_REQUIRED':'UNCHANGED_BY_SNAPSHOT',visual:(groups.evidence.length||groups.visual.length||groups.token.length||groups.content.length||groups.performance.length)?'REAPPROVAL_REQUIRED':'UNCHANGED_BY_SNAPSHOT',publish:groups.publish.length?'REAPPROVAL_REQUIRED':'UNCHANGED_BY_SNAPSHOT'};
const gates=new Set();if(groups.performance.length){['narration_performance','performance_review','voice_anchor_validation','job5_compile','tts_timing','subtitle_alignment'].forEach(g=>gates.add(g));if(groups.performance.some(f=>f!=='production.json'))gates.add('content_source_review');}if(groups.evidence.length){['evidence_validation','writer_brief','semantic_story_quality','content_review','native_compile','visual_review','job5_compile','tts_timing','subtitle_alignment'].forEach(g=>gates.add(g));} // Research rerun only when evidence input changed.
if(groups.content.length){['narration_qc','voice_fidelity_review','content_review','voice_anchor_validation','semantic_story_quality','native_compile','source_hash','visual_review','job5_compile','tts_timing','subtitle_alignment'].forEach(g=>gates.add(g))}
if(groups.visual.length||groups.token.length){['native_compile','visual_quality','narrative_visual','director_review','native_preview','job5_compile','runner_visual_parity'].forEach(g=>gates.add(g))}
if(eventChange){['event_state_chain','motion_registry','voice_anchor_validation'].forEach(g=>gates.add(g))}
if(changed.includes('.authoring/scene-art-direction.json')||groups.token.length){['art_direction_qc','background_scene_set_qc','native_compile','director_review','native_preview','job5_compile'].forEach(g=>gates.add(g))}
if(changed.includes('.authoring/director-plan.json')){['performance_coverage','director_review','native_preview','job5_compile'].forEach(g=>gates.add(g))}
if(groups.publish.length){['publish_prep','cover_contract','job5_compile','cover_render'].forEach(g=>gates.add(g))}
let phase02Revision=null;
const beforeIntent=x.json['.authoring/visual-intent.json'],afterIntent=y.json['.authoring/visual-intent.json'];
if(beforeIntent&&afterIntent){
 const g0=buildPhase02SemanticGraph(beforeIntent),g1=buildPhase02SemanticGraph(afterIntent),diff=diffPhase02SemanticGraphs(g0,g1);
 phase02Revision=revisionGuidance(g1,diff);
 phase02Revision.changed_nodes=diff.changed;
}
const resume_from=groups.evidence.length?{phase:'01-content',step:'evidence'}:groups.content.length?{phase:'01-content',step:groups.content.some(f=>conceptFiles.has(f.replace(/^\.authoring\//u,'')))?'concept':'narration'}:groups.performance.some(f=>f!=='production.json')?{phase:'01-content',step:'narration'}:groups.visual.length||groups.token.length||groups.performance.length?{phase:'02-visual-production',step:'visual_compile'}:groups.publish.length?{phase:'02-visual-production',step:'publish_prep'}:null;
const report={resume_from,format:'zodiac-revision-impact@1',status:changed.length?'REVIEW_REQUIRED':'NO_CHANGE',before:path.resolve(before),after:path.resolve(after),changed_files:changed,groups,production:{voice_changed:voiceChange,events_or_entities_changed:eventChange},approval,tasks_to_revalidate:[...gates].sort(),phase02_revision:phase02Revision,warning:'UNCHANGED_BY_SNAPSHOT does not prove an approval exists. This report NEVER grants approval or certifies runtime output.'};
if(output){await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(path.resolve(output),JSON.stringify(report,null,2)+'\n')}
console.log(JSON.stringify(report,null,2));
