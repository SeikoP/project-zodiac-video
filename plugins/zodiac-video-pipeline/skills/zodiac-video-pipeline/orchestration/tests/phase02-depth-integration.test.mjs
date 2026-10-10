import test from 'node:test';import assert from 'node:assert/strict';
import {stages,sourcePath} from '../phase02-execute-with-depth.mjs';
import {access} from 'node:fs/promises';
test('preserves entry gate and native ordering before scene direction',async()=>{
 assert.deepEqual(stages.map(x=>x.id),['transition','native_environment','native_depth','depth_validation','phase02_native']);
 for(const step of stages)assert.match(sourcePath(step.script),/zodiac-video-pipeline\//);
 for(const step of stages.filter(x=>['native_depth','depth_validation'].includes(x.id)))await access(sourcePath(step.script));
});
