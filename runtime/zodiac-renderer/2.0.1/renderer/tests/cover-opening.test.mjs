import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveCoverOpening, coverOpeningOpacity} from '../src/cover-opening.mjs';
import * as openingApi from '../src/cover-opening.mjs';
test('captions stay out of the opening cover and resume on its first uncovered frame',()=>{
 assert.equal(typeof openingApi.coverCaptionVisible,'function');
 const o={duration_frames:23,transition_frames:6};
 assert.equal(openingApi.coverCaptionVisible(o,0),false);
 assert.equal(openingApi.coverCaptionVisible(o,22),false);
 assert.equal(openingApi.coverCaptionVisible(o,23),true);
 assert.equal(openingApi.coverCaptionVisible(null,0),true);
});
const scenes=[{id:'first',start_frame:0,duration_frames:72},{id:'later',start_frame:72,duration_frames:72}];
const publish={cover:{opening:{enabled:true,duration_sec:1.5,transition_sec:0.3}}};
test('opening starts on frame zero and releases existing timeline without adding frames',()=>{
  const original=structuredClone(scenes);
  const opening=resolveCoverOpening(publish,24,scenes);
  assert.equal(opening.duration_frames,36);
  assert.equal(coverOpeningOpacity(opening,0),1);
  assert.equal(coverOpeningOpacity(opening,28),1);
  assert.ok(coverOpeningOpacity(opening,32)>0 && coverOpeningOpacity(opening,32)<1);
  assert.equal(coverOpeningOpacity(opening,36),0);
  assert.deepEqual(scenes,original);
});
test('old cover metadata has no implicit intro',()=>assert.equal(resolveCoverOpening({cover:{}},24,scenes),null));
test('explicit opt out has no intro',()=>assert.equal(resolveCoverOpening({cover:{opening:{enabled:false}}},24,scenes),null));
test('invalid duration and transition reject rather than silently clamp',()=>{
  for(const patch of [{duration_sec:-1},{duration_sec:9},{duration_sec:'1.5'},{transition_sec:0},{transition_sec:2},{enabled:'true'}])
    assert.throws(()=>resolveCoverOpening({cover:{opening:{...publish.cover.opening,...patch}}},24,scenes),/COVER_OPENING_INVALID/);
});
test('opening cannot hide a subsequent scene or assume delayed scene starts',()=>{
  assert.throws(()=>resolveCoverOpening(publish,24,[{start_frame:0,duration_frames:12}]),/COVER_OPENING_INVALID/);
  assert.throws(()=>resolveCoverOpening(publish,24,[{start_frame:5,duration_frames:72}]),/COVER_OPENING_INVALID/);
});
