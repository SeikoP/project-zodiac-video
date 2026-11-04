import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../../../../../..');
const read=rel=>readFile(path.join(repoRoot,rel),'utf8');

test('plugin release archive normally triggers from version-bearing changes on main',async()=>{
 const yml=await read('.github/workflows/zodiac-plugin-release.yml');
 assert.match(yml,/push:\s*[\s\S]*branches:\s*(?:\[\s*)?(?:-\s*)?main(?:\s*\])?/u);
 for(const rel of [
  'plugins/zodiac-video-pipeline/plugin.json',
  'plugins/zodiac-video-pipeline/.codex-plugin/plugin.json',
  'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json'
 ])assert.ok(yml.includes(rel),rel);
 assert.match(yml,/workflow_dispatch:/u);
});

test('phase bundle release record push on main builds all three phases',async()=>{
 const yml=await read('.github/workflows/zodiac-source-bundle.yml');
 assert.match(yml,/push:\s*[\s\S]*branches:\s*(?:\[\s*)?(?:-\s*)?main(?:\s*\])?/u);
 assert.ok(yml.includes('docs/zodiac-plugin-release.json'));
 for(const phase of ['01-content','02-visual-production','03-handoff'])assert.ok(yml.includes(phase),phase);
 assert.match(yml,/matrix:/u);
 assert.match(yml,/workflow_dispatch:/u);
 assert.match(yml,/matrix\.phase/u);
});
