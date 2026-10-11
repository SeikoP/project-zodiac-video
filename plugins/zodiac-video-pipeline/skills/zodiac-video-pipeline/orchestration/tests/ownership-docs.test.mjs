import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
const here=path.dirname(fileURLToPath(import.meta.url));
const skillRoot=path.resolve(here,'../..');
const read=rel=>readFile(path.join(skillRoot,rel),'utf8');

test('job@5 package remains semantic and excludes runtime artifacts',async()=>{const s=await read('references/package-format-v5.md');assert.match(s,/zodiac-job@5/);assert.match(s,/must not contain resolved/);assert.match(s,/runtime files.*forbidden/);assert.match(s,/Never deliver `zodiac-job\.zip`/);});
test('publish contract says metadata prep creates no zip and Studio creates no second bundle',async()=>{const s=await read('references/publish-package.md');assert.match(s,/Visual Production.*Publish Prep/is);assert.match(s,/creates no ZIP/is);assert.match(s,/does \*\*not\*\* create `zodiac-publish-bundle\.zip`/i);});
test('job@5 handoff performs one deterministic Export and leaves runtime projection to the runner',async()=>{const s=await read('references/production-handoff-v2.md');assert.match(s,/Assemble.*Validate.*deterministic Export/s);assert.match(s,/does not project runtime frames/);assert.match(s,/Renderer 2 owns actual pixels/);});
test('phase directory contains only the three active phase pairs',async()=>{const {readdir}=await import('node:fs/promises');const names=(await readdir(path.join(skillRoot,'orchestration/phases'))).sort();assert.deepEqual(names,['01-content.json','01-content.md','02-visual-production.json','02-visual-production.md','03-handoff.json','03-handoff.md']);});
