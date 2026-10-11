import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../../../..',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('Zodiac schema permits only Character',()=>{
  const schema=JSON.parse(read('skills/zodiac-video-pipeline/references/narrative-plan.schema.json'));
  assert.deepEqual(schema.properties.story_shape.enum,['character_deconstruction']);
});
test('release versions match',()=>{
  const a=JSON.parse(read('plugin.json'));const b=JSON.parse(read('.codex-plugin/plugin.json'));
  const s=JSON.parse(read('skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json'));
  assert.equal(a.version,b.version);assert.equal(a.version,s.plugin_version);
});
test('character-only guidance is registered',()=>{
  assert.match(read('skills/zodiac-video-pipeline/SKILL.md'),/character-viral-performance.md/);
});
