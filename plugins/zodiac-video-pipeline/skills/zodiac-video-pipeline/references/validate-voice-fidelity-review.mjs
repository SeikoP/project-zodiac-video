#!/usr/bin/env node
import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';import path from 'node:path';
const root=path.resolve(process.argv[2]??'');if(!process.argv[2]){console.error('Usage: node validate-voice-fidelity-review.mjs <workspace>');process.exit(2);}
const read=n=>readFile(path.join(root,'.authoring',n),'utf8').catch(e=>{if(e.code!=='ENOENT'||n!=='narration.txt')throw e;return readFile(path.join(root,n),'utf8');});const h=s=>createHash('sha256').update(s).digest('hex');const fail=m=>{throw Error('VOICE_FIDELITY_REVIEW_INVALID: '+m);};
const [narrRaw,profileRaw,reviewRaw]=await Promise.all(['narration.txt','voice-profile.json','voice-fidelity-review.json'].map(read));
const q=JSON.parse(reviewRaw);
if(q.format!=='zodiac-voice-fidelity-review@1'||q.reviewer_role!=='voice_challenger')fail('format/reviewer_role');
if(q.source?.narration_sha256!==h(narrRaw)||q.source?.voice_profile_sha256!==h(profileRaw))fail('stale source fingerprints');
const keys=['narrator_relationship','spoken_naturalness','roughness_preservation','comic_aggression','behavior_before_analysis','contradiction_energy','internal_voice','sentence_music','warmth_leakage','generic_ai_distance'];
if(!q.criteria||Object.keys(q.criteria).sort().join('|')!==[...keys].sort().join('|'))fail('exact voice criteria required');
const failureCodes=new Set(['GENERIC_EXPLAINER','SLANG_PAINTED_AI','MISSING_NARRATOR_REACTION','WEAK_COMIC_CAUSALITY','RHYTHM_FLATTENING','THERAPIST_DRIFT','ENDING_ENERGY_DROP','REFERENCE_CONTAMINATION']);
if(!Array.isArray(q.failure_codes)||q.failure_codes.some(x=>!failureCodes.has(x)))fail('failure_codes');
let unresolved=0;
for(const k of keys){const c=q.criteria[k];if(!c||!['PASS','REVIEW'].includes(c.result))fail(k+'.result');if(typeof c.response!=='string'||c.response.trim().length<20)fail(k+'.response');if(!Array.isArray(c.evidence)||c.evidence.length<1||c.evidence.some(x=>typeof x!=='string'||x.trim().length<6))fail(k+'.evidence');if(c.result==='REVIEW')unresolved++;}
if(q.decision==='PASS'&&q.failure_codes.length)fail('PASS with failure codes');
if(!['strong_match','plausible_match','weak_match','different_narrator'].includes(q.same_narrator_probability))fail('same_narrator_probability');
if(!['PASS','REVIEW'].includes(q.decision)||!Array.isArray(q.revision_targets))fail('decision/revision_targets');
if(q.decision==='PASS'&&(unresolved||q.revision_targets.length||!['strong_match','plausible_match'].includes(q.same_narrator_probability)))fail('PASS with unresolved voice drift');
if(q.decision==='REVIEW'&&!q.revision_targets.length)fail('REVIEW requires revision targets');
if(q.decision!=='PASS')fail('voice fidelity blocks Content Review');
console.log('VOICE_FIDELITY_REVIEW_PASS');
