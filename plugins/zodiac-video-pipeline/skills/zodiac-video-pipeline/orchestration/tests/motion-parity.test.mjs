import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeMotion,assertRegistryRunnerSupport} from '../normalize-motion.mjs';
test('legacy state swap names lower to canonical motion and duration',()=>{
 for(const n of [8,10,12])assert.deepEqual({motion:normalizeMotion(`state_swap_${n}f`).motion,duration:normalizeMotion(`state_swap_${n}f`).duration_frames},{motion:'state_swap',duration:n});
});
test('unknown never silently holds',()=>assert.throws(()=>normalizeMotion('wiggle-random'),/UNSUPPORTED_MOTION/));
test('invalid durations fail closed',()=>assert.throws(()=>normalizeMotion('state_swap_0f'),/MOTION_DURATION_INVALID/));
test('runner vocabulary mismatch fails',()=>assert.throws(()=>assertRegistryRunnerSupport(['state_swap']),/MOTION_REGISTRY_RUNNER_MISMATCH/));
test('valid explicit duration wins',()=>assert.equal(normalizeMotion('subtle-tilt',{duration_frames:14}).duration_frames,14));
