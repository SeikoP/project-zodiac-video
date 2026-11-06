import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html=fs.readFileSync(new URL('../public/garden/control.html',import.meta.url),'utf8');
const code=fs.readFileSync(new URL('../public/garden/control.js',import.meta.url),'utf8');

test('Control provides dedicated non-boss heart actions and actual status',()=>{
 assert.match(html,/id="heartStatus"/);
 for(const amount of [100,400,500])assert.match(html,new RegExp(`data-heart="${amount}"`));
 assert.match(code,/s\.hearts/);
 assert.match(code,/querySelectorAll\('\[data-heart\]'\)/);
 assert.match(code,/count: Number\(button\.dataset\.heart\)/);
});
test('Control surfaces old server code and out-of-date source builds',()=>{
 assert.match(code,/s\.runtimeSourceChanged/);
 assert.match(code,/d\.build\s*!==\s*s\.build/);
 assert.match(code,/className\s*=\s*staleCode/);
});
test('Control shows native scene ID and real display scene independently',()=>{
 assert.match(code,/s\.camera\.sceneId/);
 assert.match(code,/serverSceneId/);
 assert.match(code,/serverPhase/);
});