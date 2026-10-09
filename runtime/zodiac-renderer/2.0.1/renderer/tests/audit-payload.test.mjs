import test from "node:test";
import assert from "node:assert/strict";
import {auditJob5Payload} from "../scripts/audit-payload.mjs";
import {spawnSync} from "node:child_process";
import {mkdtemp,mkdir,writeFile,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";

const fixture=()=>({
  ir:{scenes:[{id:"S01",entities:[
    {id:"scorpio",states:{idle:{asset:"actor.svg"}}},
    {id:"story_prop",states:{idle:{asset:"phone.svg",visible:true}}}
  ],events:[{id:"E01"}],spatial_bindings:[{entity:"story_prop",anchor:"scorpio",relation:"held_by",max_distance_px:300}]}]},
  plan:{assets:{"actor.svg":{},"phone.svg":{}},scenes:[{id:"S01",entities:[
    {id:"scorpio",states:{idle:{asset:"actor.svg"}}},
    {id:"story_prop",states:{idle:{asset:"phone.svg",visible:true}}}
  ],events:[{event_id:"E01"}],spatial_bindings:[{entity:"story_prop",anchor:"scorpio",relation:"held_by",max_distance_px:300}]}]}
});
test("pass when visual payload and spatial roles survive compilation",()=>{const {ir,plan}=fixture();assert.equal(auditJob5Payload(ir,plan).ok,true)});
test("fail when prop disappears despite present package asset",()=>{const {ir,plan}=fixture();plan.scenes[0].entities.pop();assert.match(auditJob5Payload(ir,plan).errors.join(" "),/ENTITY_DROPPED.*story_prop/)});
test("fail when spatial ownership disappears",()=>{const {ir,plan}=fixture();plan.scenes[0].spatial_bindings=[];assert.match(auditJob5Payload(ir,plan).errors.join(" "),/SPATIAL_BINDINGS_CHANGED/)});
test("fail when every prop state is hidden",()=>{const {ir,plan}=fixture();plan.scenes[0].entities[1].states.idle.visible=false;assert.match(auditJob5Payload(ir,plan).errors.join(" "),/VISUAL_ROLE_INVISIBLE/)});

test("real CLI writes report and structured stderr on audit mismatch",async()=>{
  const root=await mkdtemp(join(tmpdir(),"zodiac-parity-test-"));
  try{
    const {ir,plan}=fixture();
    plan.scenes[0].entities.pop(); // remove story_prop => parity failure
    await mkdir(join(root,".runtime"));
    await writeFile(join(root,"production.ir.json"),JSON.stringify(ir));
    await writeFile(join(root,".runtime","render-plan.json"),JSON.stringify(plan));
    const result=spawnSync(process.execPath,[
      fileURLToPath(new URL("../scripts/audit-payload.mjs",import.meta.url)),root
    ],{encoding:"utf8"});
    assert.equal(result.status,2);
    const diagnostic=JSON.parse(result.stderr.trim());
    assert.equal(diagnostic.code,"RENDER_PLAN_PAYLOAD_MISMATCH");
    assert.equal(diagnostic.stage,"PLAN");
    assert.match(diagnostic.message,/S01 story_prop/);
    assert.equal(diagnostic.detail.issue_count,2);
    assert.ok(diagnostic.detail.errors.some(x=>x.includes("ENTITY_DROPPED S01 story_prop")));
    assert.ok(diagnostic.detail.errors.some(x=>x.includes("VISUAL_ROLE_INVISIBLE S01 story_prop")));
    const report=JSON.parse(await readFile(join(root,".runtime","payload-parity-report.json"),"utf8"));
    assert.equal(report.ok,false);
    assert.deepEqual(report.errors,diagnostic.detail.errors);
  }finally{await rm(root,{recursive:true,force:true})}
});
