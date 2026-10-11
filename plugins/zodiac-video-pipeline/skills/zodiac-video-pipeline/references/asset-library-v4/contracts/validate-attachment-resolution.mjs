import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const root=path.dirname(fileURLToPath(import.meta.url));
const x=JSON.parse(await readFile(path.join(root,"attachment-resolution.json"),"utf8"));
const fail=m=>{throw new Error("ATTACHMENT_RESOLUTION_INVALID: "+m);};
if(x.version!=="1.4-readability-aware")fail("version");
if(x.precedence?.visual_intent!=="visual-intent-contract.json")fail("visual intent precedence");
if(x.precedence?.pose_readability!=="pose-readability-contract.json")fail("pose readability precedence");
if(x.policy?.visual_intent_required!==true)fail("visual intent required");
if(x.policy?.pose_readability_required!==true)fail("pose readability required");
if(!x.resolution_order?.includes("resolve_pose_readability"))fail("pose readability resolution step");
if(!x.resolution_order?.includes("validate_joint_readability"))fail("joint readability validation step");
if(!x.resolution_order?.includes("validate_contact_readability"))fail("contact readability validation step");
const rose=x.geometry_rules?.rose_peek;if(!rose)fail("rose geometry");
if(rose.occluder_side!=="left"||rose.reveal_side!=="right"||rose.effect_side!=="right"||rose.effect_direction!=="outward")fail("rose geometry intent");
const d=x.geometry_rules?.damage_run;if(!d)fail("damage geometry");
if(JSON.stringify(d.contact)!==JSON.stringify(["left_eye","right_eye"]))fail("damage facial contact");
if(d.motion_direction!=="left"||d.trail_side!=="right")fail("damage trail geometry");
for(const id of ["fake_flex","awkward","emotional_damage","heart_offer","damage_run","banner_bonk","rose_peek","receipt_shame"]){
  if(!x.geometry_rules?.[id])fail("missing geometry rule "+id);
}
for(const key of ["geometry_pass_overrides_readability_fail","single_segment_scratch_arm","scratch_arm_through_face_core","tear_stream_from_mouth","copy_cross_character_coordinates"]){
  if(!x.policy?.forbid?.includes(key))fail("missing forbid "+key);
}
console.log("ATTACHMENT_RESOLUTION_PASS: readability-aware precedence + 8 recipe geometry rules");
