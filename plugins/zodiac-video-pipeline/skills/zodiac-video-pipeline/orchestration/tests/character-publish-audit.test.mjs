import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const root=new URL('../../../..',import.meta.url);
const rd=p=>readFileSync(new URL(p,root),'utf8');

test('plugin entry prompts route current three-phase ownership without reviving hybrid shapes',()=>{
 for(const p of ['plugin.json','.codex-plugin/plugin.json']){
  const j=JSON.parse(rd(p));
  const prompt=j.interface?.defaultPrompt||j.extensions['com.openai'].interface.defaultPrompt;
  assert.match(prompt,/01-content|Phase 1|resume-brief/i);
  assert.doesNotMatch(prompt,/hybrid_deconstruction/);
 }
});

test('single shape remains in core editorial policy',()=>{
 const p=rd('skills/zodiac-video-pipeline/references/character-depth-v2.md');
 assert.match(p,/ONE Story Shape/);
 assert.doesNotMatch(p,/Select `hybrid_deconstruction`/);
});

test('publish structural pass remains separated from editorial review',()=>{
 assert.match(rd('skills/zodiac-video-pipeline/features/publish/validate-publish-prep.mjs'),/PUBLISH_EDITORIAL_REVIEW_REQUIRED/);
});
