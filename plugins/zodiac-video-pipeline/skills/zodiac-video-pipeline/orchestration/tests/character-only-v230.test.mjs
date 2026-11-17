import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../../..',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('Zodiac schema permits only character_deconstruction',()=>{
 const schema=JSON.parse(read('skills/zodiac-video-pipeline/references/narrative-plan.schema.json'));
 assert.deepEqual(schema.properties.story_shape.enum,['character_deconstruction']);
});

test('release versions match',()=>{
 const a=JSON.parse(read('plugin.json'));const b=JSON.parse(read('.codex-plugin/plugin.json'));
 const s=JSON.parse(read('skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json'));
 assert.equal(a.version,b.version);assert.equal(a.version,s.plugin_version);
});

test('current editorial guidance owns the single Story Shape',()=>{
 const policy=read('skills/zodiac-video-pipeline/references/character-viral-performance.md');
 assert.match(policy,/ONE Story Shape: `character_deconstruction`/);
 assert.match(policy,/hybrid_deconstruction.*REJECTED/);
});
