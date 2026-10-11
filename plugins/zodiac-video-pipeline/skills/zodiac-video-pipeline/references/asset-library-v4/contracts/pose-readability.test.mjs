import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import test from "node:test";
const root=path.dirname(fileURLToPath(import.meta.url));
const read=async p=>JSON.parse(await readFile(path.join(root,p),"utf8"));

test("awkward requires a readable bent scratch pose",async()=>{
  const x=await read("pose-readability-contract.json"),a=x.recipes.awkward;
  assert.equal(a.scratch_hand,"right_hand");
  assert.equal(a.scratch_target,"head_right_scratch_region");
  assert.equal(a.elbow_required,true);
  assert.ok(a.elbow_angle_deg.min>=45 && a.elbow_angle_deg.max<=135);
  assert.ok(a.arm_forbidden_overlap.includes("face_core"));
  assert.equal(a.snot_locus,"nostril_under_nose_zone");
});

test("rose peek enforces meaningful partial occlusion",async()=>{
  const x=await read("pose-readability-contract.json"),r=x.recipes.rose_peek;
  assert.deepEqual(r.silhouette_occlusion_ratio,{min:0.30,max:0.45});
  assert.ok(r.face_visible_ratio.min>=0.55);
  assert.equal(r.accent_side,"right");
  assert.equal(r.accent_direction,"outward");
});

test("receipt shame requires visible grip and expression adapter",async()=>{
  const x=await read("pose-readability-contract.json"),r=x.recipes.receipt_shame;
  assert.ok(r.hand_prop_overlap_ratio.min>=0.08);
  assert.ok(r.hand_visible_ratio.min>=0.25);
  assert.equal(r.adapter_required_when_incompatible,true);
  assert.equal(r.specialist_expression_adapter,"deadpan_embarrassed");
  assert.ok(r.incompatible_expression_cues.includes("toothy_grin"));
});

test("readability failure outranks geometry pass",async()=>{
  const x=await read("pose-readability-contract.json");
  assert.equal(x.precedence.conflict_rule,"readability_failure_blocks_compile_even_when_geometry_is_valid");
  assert.deepEqual(x.review_status,["GEOMETRY_PASS","SEMANTIC_PASS","VISUAL_REVIEW","PASS"]);
});
