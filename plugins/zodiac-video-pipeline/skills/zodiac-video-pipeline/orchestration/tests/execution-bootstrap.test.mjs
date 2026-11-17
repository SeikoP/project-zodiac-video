import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const orch=path.resolve(here,'..');
const plugin=JSON.parse(await readFile(path.resolve(orch,'../../../plugin.json'),'utf8'));
const overlay=JSON.parse(await readFile(path.resolve(orch,'../../../.codex-plugin/plugin.json'),'utf8'));
const state=JSON.parse(await readFile(path.join(orch,'pipeline-state.template.json'),'utf8'));

test('manifest, overlay and state template versions stay synchronized',()=>{
 assert.equal(state.plugin_version,plugin.version);assert.equal(overlay.version,plugin.version);
});

test('router keeps Web Phase 1 free of native execution bootstrap',async()=>{
 const r=await readFile(path.join(orch,'router.md'),'utf8');
 assert.match(r,/Phase 1 intentionally does not use native execution bootstrap/iu);
 assert.doesNotMatch(r,/execution-preflight\.mjs/);
 assert.match(r,/Local imports the Phase-1 capsule/iu);
});

test('bootstrap guide scopes native execution to Local Phase 2-3',async()=>{
 const s=await readFile(path.join(orch,'execution-bootstrap.md'),'utf8');
 assert.match(s,/No execution bootstrap is required/iu);
 assert.match(s,/Local \/ Phase 2–3/iu);
 assert.match(s,/Source transport never creates creative approval/iu);
});
