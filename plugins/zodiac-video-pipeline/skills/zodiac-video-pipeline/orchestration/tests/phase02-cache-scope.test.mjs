import test from 'node:test';
import assert from 'node:assert/strict';
import {cacheInputsForStep} from '../../phases/phase02/phase02-cache-scope.mjs';

const core=['production.json','narration.txt','.authoring/character-assembly-plan.json','.authoring/narrative-plan.json'];
const publish=['publish/publish.json','publish/publish-copy.txt'];

test('native cache invalidation is scoped to the owning inputs',()=>{
 assert.deepEqual(cacheInputsForStep('scene_direction',{coreInputPaths:core,publishInputPaths:publish}),['production.json']);
 assert.deepEqual(cacheInputsForStep('environment',{coreInputPaths:core,publishInputPaths:publish}),['production.json']);
 assert.deepEqual(cacheInputsForStep('character_write',{coreInputPaths:core,publishInputPaths:publish}),['production.json','.authoring/character-assembly-plan.json']);
 assert.deepEqual(cacheInputsForStep('narration_performance',{coreInputPaths:core,publishInputPaths:publish}),['narration.txt','.authoring/narrative-plan.json']);
 assert.deepEqual(cacheInputsForStep('publish_prep',{coreInputPaths:core,publishInputPaths:publish}),['production.json','narration.txt',...publish]);
});
