import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import test from "node:test";
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));

test("attachment contract is readability-aware v1.4",async()=>{const x=await read("attachment-resolution.json");assert.equal(x.version,"1.4-readability-aware");assert.equal(x.precedence.visual_intent,"visual-intent-contract.json");assert.equal(x.precedence.pose_readability,"pose-readability-contract.json");assert.equal(x.policy.visual_intent_required,true);assert.equal(x.policy.pose_readability_required,true);assert.ok(x.resolution_order.indexOf("resolve_pose_readability")<x.resolution_order.indexOf("place_prop_contacts"));});
test("Rose Peek geometry follows reveal right, not occluder edge",async()=>{const x=await read("attachment-resolution.json"),r=x.geometry_rules.rose_peek;assert.equal(r.occluder_side,"left");assert.equal(r.reveal_side,"right");assert.equal(r.effect_side,"right");assert.equal(r.effect_direction,"outward");});
test("Damage Run uses eye tears and explicit right trail",async()=>{const x=await read("attachment-resolution.json"),r=x.geometry_rules.damage_run;assert.deepEqual(r.contact,["left_eye","right_eye"]);assert.equal(r.motion_direction,"left");assert.equal(r.trail_side,"right");assert.ok(x.policy.forbid.includes("tear_stream_from_mouth"));});
test("all eight recipes have geometry resolution entries",async()=>{const x=await read("attachment-resolution.json");for(const id of ["fake_flex","awkward","emotional_damage","heart_offer","damage_run","banner_bonk","rose_peek","receipt_shame"])assert.ok(x.geometry_rules[id],id);});
test("validator accepts the current attachment contract",()=>{const r=spawnSync(process.execPath,[path.join(root,"validate-attachment-resolution.mjs")],{encoding:"utf8"});assert.equal(r.status,0,r.stdout+"\n"+r.stderr);assert.match(r.stdout,/ATTACHMENT_RESOLUTION_PASS/);});
