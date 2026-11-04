import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {validateStoryObjectCompositionWorkspace} from '../../../features/story-object/validate-story-object-composition.mjs';

// Regression: Phase-03 native Narrative Visual must not require the retired
// Story Object composition plan. This static guard complements the workspace E2E.
const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
test('handoff accepts projected narrative visual asset category',async()=>{
 const source=await readFile(path.join(skill,'phases/phase03/validate-handoff-workspace-v2.mjs'),'utf8');
 assert.match(source,/category==='story_object'/u);
 assert.match(source,/return 'effect'/u);
});
test('native Narrative Visual gate is checked independently of legacy story-object plan',async()=>{
 const source=await readFile(path.join(skill,'features/story-object/validate-story-object-composition.mjs'),'utf8');
 assert.match(source,/intent\?\.taxonomy_version==='narrative_visual@1'/u);
 assert.match(source,/validateNarrativeVisualPresence\(root\)/u);
 assert.match(source,/NARRATIVE_VISUAL_COMPOSITION_BLOCKED/u);
 assert.equal(typeof validateStoryObjectCompositionWorkspace,'function');
});
