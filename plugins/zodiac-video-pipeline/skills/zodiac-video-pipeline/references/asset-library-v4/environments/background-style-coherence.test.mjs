import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const read=async id=>readFile(path.join(here,'structural',id+'.svg'),'utf8');
test('library background keeps classroom simple colored paper-doodle language',async()=>{
 const [shelf,table,board,desk]=await Promise.all(['library-shelf','library-table','classroom-whiteboard','classroom-desk-edge'].map(read));
 for(const [id,svg] of [['shelf',shelf],['table',table],['board',board],['desk',desk]]){
  assert.match(svg,/handmade=human-stroke-v2/,id);
  assert.match(svg,/style=zodiac-paper-doodle-meme-v4/,id);
  assert.match(svg,/<path\b/,id);
  assert.doesNotMatch(svg,/<filter\b|<linearGradient\b|<radialGradient\b|<text\b/i,id);
 }
 assert.match(shelf,/fill="#FFFDF9"/);
 assert.match(shelf,/fill="#8EC0B9"/);
 assert.match(table,/fill="#E97A66"/);
 assert.match(board,/fill="#FFFDF9"/);
 assert.match(desk,/fill="#E97A66"/);
 const idx=JSON.parse(await readFile(path.join(here,'composition-index.json'),'utf8'));
 const room=id=>idx.profiles.find(x=>x.id===id).structural_roles;
 assert.deepEqual(room('classroom-study'),{rear:['classroom-whiteboard','classroom-window'],grounding:['classroom-desk-edge'],front:[]});
 assert.deepEqual(room('library-study'),{rear:['library-shelf'],grounding:['library-table'],front:[]});
});
