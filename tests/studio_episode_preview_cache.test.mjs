import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import test from 'node:test';

test('episode pages reuse in-flight work, isolate projects, discard old builds and retry errors',async()=>{
  const calls=[];
  let fail=false;
  globalThis.previewCacheBackend={visualEpisodePreview:(project,build)=>{
    calls.push([project,build]);
    return fail?Promise.reject(Error('offline')):Promise.resolve({build_id:build,html:project});
  }};
  try {
    const source=(await readFile(new URL('../apps/zodiac-studio/src/episode-preview-cache.ts',import.meta.url),'utf8'))
      .replace('import { backend } from "./backend";','const backend = globalThis.previewCacheBackend;');
    const {episodePreview}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source)).toString('base64'));
    const first=episodePreview('p','b1');
    assert.equal(episodePreview('p','b1'),first);
    await first;
    assert.equal(episodePreview('p','b1'),first);
    await episodePreview('q','b1');
    await episodePreview('p','b2');
    await episodePreview('p','b1');
    assert.deepEqual(calls,[['p','b1'],['q','b1'],['p','b2'],['p','b1']]);
    fail=true;
    await assert.rejects(episodePreview('p','b3'),/offline/);
    fail=false;
    assert.equal((await episodePreview('p','b3')).build_id,'b3');
    assert.equal(calls.filter(([p,b])=>p==='p'&&b==='b3').length,2);
  } finally { delete globalThis.previewCacheBackend; }
});
