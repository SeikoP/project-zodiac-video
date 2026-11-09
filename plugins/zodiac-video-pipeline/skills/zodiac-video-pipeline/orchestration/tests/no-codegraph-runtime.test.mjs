import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const skill=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const plugin=path.resolve(skill,'../..');

test('CodeGraph does not ship in the canonical Local producer runtime',async()=>{
 const pkg=JSON.parse(await readFile(path.join(plugin,'package.json'),'utf8'));
 const lock=JSON.parse(await readFile(path.join(plugin,'package-lock.json'),'utf8'));
 assert.equal(pkg.dependencies['@colbymchenry/codegraph'],undefined);
 assert.deepEqual(lock.packages[''].dependencies,pkg.dependencies);
 assert.ok(!Object.keys(lock.packages).some(name=>name.includes('@colbymchenry/codegraph')));
 await assert.rejects(access(path.join(skill,'core/workflow/runtime-codegraph.mjs')),{code:'ENOENT'});
 const benchmark=await readFile(path.join(skill,'core/audit/benchmark-plugin-orchestration.mjs'),'utf8');
 assert.doesNotMatch(benchmark,/buildCodeIndex|collectPluginCodeSources|runtime-codegraph/);
 assert.match(benchmark,/source_lookup:/);
});
