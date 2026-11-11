#!/usr/bin/env node
import {readFile} from 'node:fs/promises';import path from 'node:path';
const root=process.argv[2];if(!root){console.error('Usage: node validate-voice-profile.mjs <workspace>');process.exit(2);}
const fail=m=>{throw Error('VOICE_PROFILE_INVALID: '+m);};
const p=JSON.parse(await readFile(path.join(path.resolve(root),'.authoring','voice-profile.json'),'utf8'));
if(p.format!=='zodiac-voice-profile@1'||typeof p.reference_present!=='boolean')fail('format/reference_present');
const req=['narrator_relationship','affection_model','attack_style','language_register','warmth_rule'];
for(const k of req)if(typeof p[k]!=='string'||p[k].trim().length<8)fail(k);
for(const k of ['comic_engine','contradiction_engine','sentence_music','emotional_movement','internal_voice','forbidden_drift','source_refs'])if(!Array.isArray(p[k]))fail(k);
if(p.reference_present&&(!p.source_refs.length||!p.comic_engine.length||!p.sentence_music.length||!p.forbidden_drift.length))fail('reference profile incomplete');
if(p.reference_present){
 if(typeof p.benchmark_ref!=='string'||!p.benchmark_ref.endsWith('voice-benchmark.md'))fail('benchmark_ref');
 if(!Array.isArray(p.benchmark_dimensions)||p.benchmark_dimensions.length<4)fail('benchmark_dimensions');
 if(typeof p.ending_rule!=='string'||p.ending_rule.trim().length<12)fail('ending_rule');
}
if(!p.firewall||p.firewall.style_only!==true||!Array.isArray(p.firewall.may_transfer)||!Array.isArray(p.firewall.must_not_transfer))fail('firewall');
for(const token of ['claim','exact sentence','exact joke'])if(!p.firewall.must_not_transfer.some(x=>String(x).toLowerCase().includes(token)))fail('firewall missing '+token);
console.log('VOICE_PROFILE_PASS');
