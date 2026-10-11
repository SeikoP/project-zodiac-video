import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const root=here;
const read=async p=>readFile(path.join(root,p),'utf8');

test('caption design uses semantic pagination instead of fixed word chunks',async()=>{
  const design=await read('design.md');
  assert.match(design,/semantic-first/i);
  assert.match(design,/complete spoken sentence/i);
  assert.doesNotMatch(design,/Prefer 4.?7 words\/page with target 6/i);
});

test('caption contract requires full voiced coverage and measured timing',async()=>{
  const c=await read('caption-timing.md');
  assert.match(c,/every spoken token/i);
  assert.match(c,/measured word timing/i);
  assert.match(c,/without a visible dead zone/i);
  assert.match(c,/fixed 4.?7-word slicing/i);
});

test('caption contract balances two-line layout and avoids orphan fragments',async()=>{
  const c=await read('caption-timing.md');
  assert.match(c,/No orphan fragments/);
  assert.match(c,/balance visual line widths/i);
  assert.match(c,/avoid one- or two-word dangling lines/i);
});

test('visual compile loads caption contract explicitly',async()=>{
  const p=JSON.parse(await read('../orchestration/phases/02-visual-production.json'));
  const visual=p.steps.find(x=>x.id==='visual_compile');
  assert.ok(!visual.load_references.includes('references/caption-timing.md'));
  assert.ok(visual.required_capabilities.some(x=>x.id==='caption_compile_contract' && x.guidance_uri==='references/caption-timing.md'));
  assert.ok(visual.required_capabilities.some(x=>x.id==='caption_compile_contract'));
});


test('runtime 1.16 caption policy emits semantic segmentation',async()=>{
  const c=await read('caption-timing.md');
  assert.match(c,/"segmentation": "semantic"/);
  assert.match(c,/Do not emit `page_target_words` or `max_words`/);
});
