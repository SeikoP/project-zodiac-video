import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {validateHumanStroke} from './validate-human-stroke.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const validator=path.join(here,'validate-human-stroke.mjs');
async function run(svg,kind='focal'){const d=await mkdtemp(path.join(os.tmpdir(),'zodiac-v4-stroke-'));const p=path.join(d,'a.svg');await writeFile(p,svg);const r=spawnSync(process.execPath,[validator,p,kind],{encoding:'utf8'});await rm(d,{recursive:true,force:true});return r;}
const meta='<metadata>style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2</metadata>';
test('perfect primitive focal asset fails even with v4 metadata',async()=>{const r=await run(`<svg>${meta}<rect x="10" y="10" width="100" height="100" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/><circle cx="40" cy="40" r="10" fill="#E97A66"/></svg>`);assert.notEqual(r.status,0);assert.match(r.stderr,/HUMAN_STROKE_INVALID.*primitive|HUMAN_STROKE_INVALID.*curved/i);});
test('legacy handmade profile cannot masquerade as v4',async()=>{const r=await run('<svg><metadata>style=zodiac-paper-doodle-meme-v4;handmade=controlled-wobble-v1</metadata><path d="M0 0 Q10 3 20 0 Q30 -2 40 1" stroke="#2F3C44" stroke-width="6"/></svg>');assert.notEqual(r.status,0);assert.match(r.stderr,/human-stroke-v2/);});
test('character with straight mirrored limbs fails bilateral rhythm gate',async()=>{const svg=`<svg>${meta}<g id="sticker_edge"><path d="M10 10 Q25 2 40 12" fill="#FFFDF9" stroke="#FFFDF9" stroke-width="18"/></g><g id="head_outline"><path d="M10 10 Q25 2 40 12 Q45 28 38 42"/></g><g id="hair_back"><path d="M11 14 Q25 1 42 15 Q31 8 12 20"/><path d="M14 18 Q26 5 39 17"/></g><g id="face_eyes"><path d="M16 27 Q20 24 24 27"/><path d="M29 27 Q34 23 38 27"/></g><g id="face_mouth"><path d="M21 35 Q27 39 34 35"/></g><g id="torso"><path d="M15 45 Q25 41 36 46 Q38 65 18 67"/></g><g id="left_arm"><path d="M18 50 L5 64"/></g><g id="right_arm"><path d="M34 50 L47 64"/></g><g id="left_leg"><path d="M21 66 L18 85"/></g><g id="right_leg"><path d="M31 66 L34 85"/></g></svg>`;const r=await run(svg,'character');assert.notEqual(r.status,0);assert.match(r.stderr,/BILATERAL|limb/i);});
test('canonical v4 exemplars pass human-stroke-v2',async()=>{for(const [rel,kind] of [['../characters/masters/female-messy-bun.svg','character'],['../props/phone.svg','focal'],['../effects/reaction-accent.svg','support']]){const r=spawnSync(process.execPath,[validator,path.resolve(here,rel),kind],{encoding:'utf8'});assert.equal(r.status,0,rel+'\n'+r.stderr);}});
test('paint policy rejects CSS overrides and noncanonical paint syntax',async()=>{const svg=await readFile(new URL('../props/phone.svg',import.meta.url),'utf8');validateHumanStroke(svg,'focal');for(const changed of [svg.replace('<svg ','<svg style="fill:#FF0000" '),svg.replace('</svg>','<style>path {fill:red}</style></svg>'),svg.replace('</svg>','<?xml-stylesheet href="x.css"?></svg>'),svg.replace(/fill="#[0-9a-fA-F]{6}"/,'fill="rgb(255,0,0)"'),svg.replace(/fill="#[0-9a-fA-F]{6}"/,'fill="currentColor"')])assert.throws(()=>validateHumanStroke(changed,'focal'),/CSS|PAINT|COLOR/);});
