import test from "node:test";
import assert from "node:assert/strict";
import {auditJob5Payload} from "../scripts/audit-payload.mjs";

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
