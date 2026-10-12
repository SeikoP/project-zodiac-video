import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../../../../../..');
const skill=path.join(repo,'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline');
const lib=path.join(skill,'references/asset-library-v4');
const preview=path.join(repo,'docs/previews');
const json=async p=>JSON.parse(await readFile(p,'utf8'));

test('full diagnostic manifest reflects current visual semantics and live catalog counts',async()=>{
 const [m,chars,props,accents,mechanics,palettes]=await Promise.all([
  json(path.join(preview,'zodiac-v4-full-asset-showcase.json')),
  json(path.join(lib,'characters/components/catalog.json')),
  json(path.join(lib,'props/index.json')),
  json(path.join(lib,'scene-set/accents/index.json')),
  json(path.join(lib,'mechanics/index.json')),
  json(path.join(lib,'scene-set/background-palettes.json'))
 ]);
 assert.equal(JSON.stringify(m).toLowerCase().includes('story_object'),false);
 assert.equal(JSON.stringify(m).toLowerCase().includes('story object'),false);
 assert.equal(m.active_example.red_shirt_hair,'blocky-cut');
 assert.equal(m.active_example.visual_metaphor.id,'balance-scale');
 assert.deepEqual(m.active_example.visual_metaphor.states,['tilt_left','balanced','tilt_right']);
 assert.deepEqual(m.background_palettes.sort(),Object.keys(palettes.palettes).sort());
 assert.equal(m.counts.hair,chars.hair.length);
 assert.equal(m.counts.face_profiles,chars.face_profiles.length);
 assert.equal(m.counts.poses,chars.poses.length);
 assert.equal(m.counts.props,props.assets.length);
 assert.equal(m.counts.scene_accents,accents.accents.length);
 assert.equal(m.counts.mechanics,mechanics.mechanics.length);
});

test('diagnostic SVGs expose Visual Metaphor, six palettes and diversity board without Story Object terminology',async()=>{
 const [full,paletteBoard,diversity]=await Promise.all([
  readFile(path.join(preview,'zodiac-v4-full-asset-showcase.svg'),'utf8'),
  readFile(path.join(preview,'zodiac-v4-background-palettes.svg'),'utf8'),
  readFile(path.join(preview,'zodiac-v4-asset-diversity-board.svg'),'utf8')
 ]);
 assert.match(full,/VISUAL METAPHOR/u);
 assert.doesNotMatch(full,/STORY OBJECT/iu);
 for(const state of ['tilt_left','balanced','tilt_right'])assert.match(full,new RegExp(state,'u'));
 for(const id of ['warm-paper','mint-air','blush-paper','cool-study','sand-coral','neutral-graphite'])assert.match(paletteBoard,new RegExp(id,'u'));
 for(const id of ['curtain-bang','short-curl','low-ponytail','soft-mohawk','coffee-cup','gift-box','focus-halo'])assert.match(diversity,new RegExp(id,'u'));
});
