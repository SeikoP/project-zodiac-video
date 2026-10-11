import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const here=path.dirname(fileURLToPath(import.meta.url));const root=path.resolve(here,'..');const skillRoot=path.resolve(root,'..');
const phase=JSON.parse(await readFile(path.join(root,'phases/02-visual-production.json'),'utf8'));const visual=phase.steps.find(x=>x.id==='visual_compile'),assets=phase.steps.find(x=>x.id==='assets');
test('outfit routing is native v4 character assembly',()=>{const idx=visual.required_capabilities.find(x=>x.id==='outfit_pattern_index');assert.equal(idx?.guidance_uri,'references/asset-library-v4/characters/outfit-contract.md');assert.equal(assets.required_capabilities.find(x=>x.id==='outfit_pattern_validation')?.tool_locator,'references/asset-library-v4/validation/validate-character-components.mjs');assert.equal(assets.required_capabilities.find(x=>x.id==='outfit_bake_validation')?.tool_locator,'references/asset-library-v4/validation/validate-outfit-bake-v4.mjs');});
test('native catalog covers 12 signs plus generic pool without runtime randomness',async()=>{const c=JSON.parse(await readFile(path.join(skillRoot,'references/asset-library-v4/characters/components/catalog.json'),'utf8'));assert.equal(c.outfits.filter(x=>x.kind==='zodiac').length,12);assert.ok(c.outfits.filter(x=>x.kind==='generic').length>=5);assert.equal(c.policy.render_time_randomness,false);assert.equal(c.policy.same_entity_identity_lock,true);});
