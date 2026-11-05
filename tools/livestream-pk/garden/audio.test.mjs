import test from 'node:test';import assert from 'node:assert/strict';
import {createSfx} from '../public/sfx.js';
import {createGardenAudio} from '../public/garden/audio.js';
test('Garden audio bounds voices, protects important cues, dedupes and restores duck',()=>{
 let time=10000;const played=[],ducks=[];
 const sfx=(role)=>{const h={role,stop(){h.stopped=true;},ended:new Promise(()=>{})};played.push(h);return h;};sfx.setVolume=()=>{};sfx.stop=()=>{};sfx.status=()=>({context:'running'});
 const music={duck:(value)=>ducks.push(value),setVolume(){},status:()=>({})};
 const audio=createGardenAudio({sfx,music,now:()=>time});
 for(const role of ['water','plant','harvest','fertilize'])audio.cue({role,eventId:role});
 assert.equal(audio.status().voices,3);assert.equal(audio.cue({role:'water',eventId:'water'}),null);
 audio.cue({role:'bossWin',eventId:'boss'});assert.ok(played.some(p=>p.role==='bossWin'));
 assert.equal(audio.cue({role:'help',eventId:'old',ageMs:501}),null);
 time+=4000;audio.status();assert.equal(ducks.at(-1),1);
 audio.mute(true);assert.equal(audio.status().voices,0);assert.equal(audio.cue({role:'bossWin',eventId:'muted'}),null);audio.stop();
});
test('sample-only roles load once per URL, play, stop and report readiness',async()=>{
 let decoded=0,started=0;const previous={window:globalThis.window,fetch:globalThis.fetch};
 const node=()=>({gain:{value:0},connect(){return this;},start(){started++;},stop(){this.onended?.();}});
 globalThis.window={AudioContext:class{state='running';sampleRate=100;destination={};createGain=node;createBuffer(){return{getChannelData:()=>new Float32Array(100)};}createBufferSource=node;async decodeAudioData(){decoded++;return{duration:.1};}}};
 globalThis.fetch=async url=>url.endsWith('.json')?{json:async()=>({roles:{water:{files:['water.mp3']},help:{files:['water.mp3']}}})}:{ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};
 try{const play=createSfx(.2,{manifestUrl:'/garden/audio/manifest.json'});await play.warmup();assert.equal(decoded,1);const handle=play('water',null,{managed:true});assert.ok(handle);assert.equal(started,1);handle.stop();await handle.ended;assert.equal(play.status().voices,0);play.setVolume(0);assert.equal(play('help'),null);}finally{Object.assign(globalThis,previous);}
});
