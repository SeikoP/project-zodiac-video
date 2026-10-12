import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
const src=await readFile(new URL('../../phases/phase02/phase02-execute.mjs',import.meta.url),'utf8');
test('native cache fingerprint includes canonical SVG and other V4 dependency source',()=>{
 assert.ok(src.includes('collectNativeDependencies(source.skillRoot)'));
 assert.ok(src.includes('...nativeDependencies]'));
 assert.ok(src.includes('source_fingerprint:stamp'));
 assert.ok(src.includes('source.native_dependency_count'));
});
