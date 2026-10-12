import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
test('Director v2 is required by native manifest and produces durable review receipt',async()=>{
 const manifest=JSON.parse(await readFile(path.join(root,'orchestration/phases/02-visual-production.json')));
 assert.equal(manifest.steps.length,3);
 const vc=manifest.steps.find(s=>s.id==='visual_compile'),assets=manifest.steps.find(s=>s.id==='assets');
 assert.ok(vc.required_capabilities.some(c=>c.id==='director_performance_contract'&&c.kind==='internal_reference'));
 assert.ok(vc.required_outputs.includes('.authoring/director-plan.json'));
 const director=assets.required_capabilities.find(c=>c.id==='director_v2_native_review');
 assert.equal(director?.tool_locator,'features/visual-composition/run-director-v2-review.mjs');
 assert.equal(director?.stage,'exit');
 assert.ok(assets.required_outputs.includes('.authoring/director-v2-review-receipt.json'));
 assert.ok(assets.gate_checks.includes('director_v2_native_review_verified'));
});
