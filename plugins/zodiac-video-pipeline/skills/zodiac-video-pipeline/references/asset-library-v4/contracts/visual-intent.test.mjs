import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));

test("all eight selected recipes have visual intent",async()=>{const x=await read("visual-intent-contract.json");for(const id of ["fake_flex","awkward","emotional_damage","heart_offer","damage_run","banner_bonk","rose_peek","receipt_shame"])assert.ok(x.recipes[id],id);});
test("Rose Peek regression is reveal-right outward",async()=>{const x=await read("visual-intent-contract.json"),r=x.recipes.rose_peek;assert.equal(r.occluder_side,"left");assert.equal(r.reveal_side,"right");assert.equal(r.effect.side,"right");assert.equal(r.effect.direction,"outward");assert.equal(r.effect.locus,"reveal_side");});
test("Damage Run regression is motion-left trail-right with eye tears",async()=>{const x=await read("visual-intent-contract.json"),r=x.recipes.damage_run;assert.equal(r.motion_direction,"left");assert.equal(r.trail_side,"right");assert.deepEqual(r.facial_origin,["left_eye","right_eye"]);assert.equal(r.effect.side,"right");assert.equal(r.effect.locus,"trail_side");});
test("derived anchor vocabulary protects cross-character semantics",async()=>{const x=await read("visual-intent-contract.json");for(const a of ["left_eye","right_eye","left_cheek","right_cheek","face_core","torso_left","torso_right","body_front","body_rear","reveal_left","reveal_right","trail_left","trail_right"])assert.ok(x.derived_semantic_anchors[a],a);});
test("compatibility matrix is 15 x 8 and QA matrix is 5 x 8",async()=>{const x=await read("visual-intent-contract.json"),q=await read("visual-qa-matrix.json");assert.equal(x.compatibility_matrix.assets.length,15);assert.equal(x.compatibility_matrix.recipes.length,8);assert.equal(x.compatibility_matrix.expected_cases,120);assert.equal(q.representatives.length,5);assert.equal(q.cases.length,40);assert.equal(new Set(q.cases.map(c=>`${c.asset}:${c.recipe}`)).size,40);});
test("runtime remains compile-only intent",async()=>{const skill=await readFile(path.resolve(root,"../../../SKILL.md"),"utf8");assert.match(skill,/zodiac-renderer@2\.0\.1/);const x=await read("visual-intent-contract.json");assert.equal(x.runtime_recipe_ids,false);});
