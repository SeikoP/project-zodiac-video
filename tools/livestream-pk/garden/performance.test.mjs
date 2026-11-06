import test from 'node:test';import assert from 'node:assert/strict';
import {uniqueFrameTimestamps} from '../scripts/garden-performance.mjs';

test('Canvas instrument counts one painted frame for multiple full-screen draws in the same RAF',()=>{
 assert.deepEqual(uniqueFrameTimestamps([0,0.8,1,33,33.9,66,66.5]),[0,33,66]);
 assert.deepEqual(uniqueFrameTimestamps([0,16.7,33.4]),[0,16.7,33.4]);
});