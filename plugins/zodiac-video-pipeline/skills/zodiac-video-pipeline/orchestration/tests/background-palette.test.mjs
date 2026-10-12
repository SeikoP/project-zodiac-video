import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const skill=path.resolve(here,'../..');
const sceneRoot=path.join(skill,'references/asset-library-v4/scene-set');
const compiler=path.join(sceneRoot,'compile-background-palette.mjs');
const sceneCompiler=path.join(sceneRoot,'compile-scene-set.mjs');
const palettesPath=path.join(sceneRoot,'background-palettes.json');
const pathData=svg=>[...svg.matchAll(/\sd="([^"]+)"/gu)].map(m=>m[1]);

test('six approved background palette packs compile visibly different bytes without changing geometry',async()=>{
 const {compileBackgroundPaletteSvg}=await import(pathToFileURL(compiler));
 const registry=JSON.parse(await readFile(palettesPath,'utf8'));
 assert.deepEqual(Object.keys(registry.palettes),['warm-paper','mint-air','blush-paper','cool-study','sand-coral','neutral-graphite']);
 const raw=await readFile(path.join(sceneRoot,'frames/scene-set-classroom.svg'),'utf8');
 const warm=compileBackgroundPaletteSvg(raw,registry.palettes['warm-paper']);
 const mint=compileBackgroundPaletteSvg(raw,registry.palettes['mint-air']);
 assert.notEqual(warm,mint);
 assert.deepEqual(pathData(warm),pathData(raw));
 assert.deepEqual(pathData(mint),pathData(raw));
 assert.ok(mint.includes(registry.palettes['mint-air'].roles.wall));
 assert.ok(mint.includes(registry.palettes['mint-air'].roles.floor));
});

test('unknown palette fails closed',async()=>{
 const {resolveBackgroundPalette}=await import(pathToFileURL(compiler));
 const registry=JSON.parse(await readFile(palettesPath,'utf8'));
 assert.throws(()=>resolveBackgroundPalette('night-random',registry),/BACKGROUND_PALETTE_UNKNOWN/);
});

test('scene-set compiler deduplicates identical pair and separates different palette variants',async()=>{
 const {compileSceneSetWorkspace}=await import(pathToFileURL(sceneCompiler));
 const tmp=await mkdtemp(path.join(os.tmpdir(),'zodiac-palette-'));
 const production={version:'2.0',assets:{},scenes:[
  {id:'S01',environment:{scene_set_id:'scene-set-classroom',background_palette_id:'mint-air'},entities:[]},
  {id:'S02',environment:{scene_set_id:'scene-set-classroom',background_palette_id:'mint-air'},entities:[]},
  {id:'S03',environment:{scene_set_id:'scene-set-classroom',background_palette_id:'blush-paper'},entities:[]}
 ]};
 const result=await compileSceneSetWorkspace(tmp,{production,libraryRoot:sceneRoot,write:false});
 const mint=result.production.scenes[0].environment.scene_set;
 const mint2=result.production.scenes[1].environment.scene_set;
 const blush=result.production.scenes[2].environment.scene_set;
 assert.equal(mint.asset,mint2.asset);
 assert.equal(mint.asset_sha256,mint2.asset_sha256);
 assert.notEqual(mint.asset,blush.asset);
 assert.notEqual(mint.asset_sha256,blush.asset_sha256);
 assert.match(mint.asset,/__PAL_MINT_AIR$/u);
 assert.match(blush.asset,/__PAL_BLUSH_PAPER$/u);
 assert.equal(Object.keys(result.files).filter(x=>x.includes('scene-set-classroom--mint-air.svg')).length,1);
 assert.equal(result.receipt.scenes[0].background_palette_id,'mint-air');
});
