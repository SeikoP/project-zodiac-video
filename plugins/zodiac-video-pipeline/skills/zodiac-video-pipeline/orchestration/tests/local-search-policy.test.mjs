import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const plugin=path.resolve(skill,'../..');

test('Local CLI uses source-bound next_task and scoped ripgrep, not mandatory repository discovery',async()=>{
 const local=await readFile(path.join(plugin,'skills/zodiac-video-local/SKILL.md'),'utf8');
 assert.match(local,/PHASE2_LOCAL_READY/);
 assert.match(local,/`next_task`/);
 assert.match(local,/rg -l -F/);
 assert.match(local,/git grep/);
 assert.match(local,/never hand-edit its generated projections/i);
 assert.match(local,/genuine Visual Review/);
 assert.doesNotMatch(local,/CodeGraph|runtime-codegraph/i);
});

test('canonical JSON and lossless context transport remain separate',async()=>{
 const source=await readFile(path.join(skill,'core/performance/compile-step-capsule.mjs'),'utf8');
 assert.match(source,/isDeepStrictEqual\(restored,value\)/);
 assert.match(source,/tokens\(candidate\)<json_tokens/);
 assert.match(source,/format='json'/);
});
