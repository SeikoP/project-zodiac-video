import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
test('release plugin, shadow manifest and state template declare exactly one same version',async()=>{
 const load=async rel=>JSON.parse(await readFile(path.join(root,rel),'utf8'));
 const manifest=await load('plugin.json');
 const shadow=await load('.codex-plugin/plugin.json');
 const template=await load('skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json');
 assert.equal(manifest.version,shadow.version,'shadow manifest must track release');
 assert.equal(manifest.version,template.plugin_version,'fresh workspace template must match release');
});
