import test from 'node:test';
import assert from 'node:assert/strict';
import {makeEpisodeTimeline, locateEpisodeTime} from '../apps/zodiac-studio/src/episode-timeline.ts';
const scenes = [{id:'a',start_ms:0,end_ms:1000},{id:'b',start_ms:1000,end_ms:3500},{id:'c',start_ms:4000,end_ms:9000}];
test('maps unequal measured boundaries and final endpoint', () => {
 const timeline = makeEpisodeTimeline(scenes);
 assert.deepEqual(locateEpisodeTime(timeline,1000),{sceneId:'b',localMs:0});
 assert.deepEqual(locateEpisodeTime(timeline,2800),{sceneId:'b',localMs:1800});
 assert.deepEqual(locateEpisodeTime(timeline,9000),{sceneId:'c',localMs:5000});
});
test('gaps, absent scenes and invalid seek do not invent time',()=>{
 for(const at of [-1,3500,3999,9001,NaN,Infinity]) assert.equal(locateEpisodeTime(makeEpisodeTimeline(scenes),at),null);
 assert.equal(locateEpisodeTime([],0),null);
});
test('rejects overlapping, reversed, duplicate and invalid intervals',()=>{
 for(const rows of [[...scenes,{id:'x',start_ms:8000,end_ms:10000}],[{id:'x',start_ms:2,end_ms:1}],[{id:'x',start_ms:-1,end_ms:1}],[{id:'x',start_ms:NaN,end_ms:1}],[{id:'a',start_ms:0,end_ms:1},{id:'a',start_ms:1,end_ms:2}]]) assert.throws(()=>makeEpisodeTimeline(rows));
 assert.deepEqual(makeEpisodeTimeline([]),[]);
 assert.equal(makeEpisodeTimeline([...scenes].reverse())[0].id,'a');
});
