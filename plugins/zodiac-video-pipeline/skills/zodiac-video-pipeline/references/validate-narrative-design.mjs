#!/usr/bin/env node
import {readFile} from 'node:fs/promises';import path from 'node:path';
const root=process.argv[2];if(!root){console.error('Usage: node validate-narrative-design.mjs <workspace>');process.exit(2);}
const fail=m=>{throw Error('NARRATIVE_DESIGN_INVALID: '+m);};
const a=path.join(path.resolve(root),'.authoring');
const [design,profile,plan]=await Promise.all(['narrative-design.json','voice-profile.json','narrative-plan.json'].map(async n=>JSON.parse(await readFile(path.join(a,n),'utf8'))));
if(design.format!=='zodiac-narrative-design@1')fail('format');
if(!Array.isArray(design.beats)||!design.beats.length)fail('beats');
if(design.selected_concept_id!==plan.selected_concept_id)fail('selected concept lineage');
const planIds=new Set((plan.beats??[]).map(b=>b.id));
for(const b of design.beats){
 if(typeof b.id!=='string'||!b.id.trim()||!planIds.has(b.id))fail('beat id '+b.id);
 if(typeof b.purpose!=='string'||b.purpose.trim().length<8)fail(b.id+'.purpose');
 if(!Array.isArray(b.evidence_refs)||!b.evidence_refs.length)fail(b.id+'.evidence_refs');
 if(!Array.isArray(b.voice_devices)||!b.voice_devices.length)fail(b.id+'.voice_devices');
 if(!Array.isArray(b.rhythm)||!b.rhythm.length)fail(b.id+'.rhythm');
}
if(!design.voice_profile_ref||design.voice_profile_ref!=='voice-profile.json')fail('voice_profile_ref');
if(profile.format!=='zodiac-voice-profile@1')fail('voice profile lineage');
if(Object.prototype.hasOwnProperty.call(design,'full_research')||Object.prototype.hasOwnProperty.call(design,'raw_reference'))fail('forbidden raw context');
console.log('NARRATIVE_DESIGN_PASS');
