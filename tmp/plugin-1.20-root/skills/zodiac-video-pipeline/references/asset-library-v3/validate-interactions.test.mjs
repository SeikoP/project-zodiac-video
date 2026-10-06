import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import test from "node:test";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const validator=path.join(root,"validate-interactions.mjs");

const production=()=>({
  assets:{
    "alice.idle":{lineage:{source_master:"asym-bang"}},
    "bob.idle":{lineage:{source_master:"lopsided-bob"}},
    "prop.idle":{lineage:{source_master:"compact-safe"}}
  },
  scenes:[{
    id:"S01",
    entities:[
      {id:"alice",initial_state:"idle",states:{idle:{asset:"alice.idle"},give:{asset:"alice.idle"}}},
      {id:"bob",initial_state:"idle",states:{idle:{asset:"bob.idle"},take:{asset:"bob.idle"}}},
      {id:"prop",initial_state:"held_a",states:{held_a:{asset:"prop.idle"},transit:{asset:"prop.idle"}}}
    ],
    events:[
      {id:"E1",target:"alice",action:"offer",state_before:"idle",state_after:"give"},
      {id:"E2",target:"prop",action:"move",state_before:"held_a",state_after:"transit"},
      {id:"E3",target:"bob",action:"take",state_before:"idle",state_after:"take"}
    ]
  }]
});

const plan=()=>({
  version:"1.0",
  scenes:[{
    scene_id:"S01",
    interactions:[{
      id:"I1",
      type:"handoff",
      participants:["alice","bob"],
      initiator:"alice",
      responders:["bob"],
      shared_prop:"prop",
      ownership:{before:"alice",after:"bob"},
      anchors:[
        {entity:"alice",anchor:"right_hand",target_entity:"prop"},
        {entity:"bob",anchor:"left_hand",target_entity:"prop"}
      ],
      event_ids:["E1","E2","E3"],
      intent:"Alice transfers the shared prop to Bob.",
      resolution:"completed"
    }]
  }]
});

const run=async(productionValue,planValue)=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"zodiac-interaction-"));
  try{
    const productionPath=path.join(dir,"production.json");
    const planPath=path.join(dir,"plan.json");
    await writeFile(productionPath,JSON.stringify(productionValue),"utf8");
    await writeFile(planPath,JSON.stringify(planValue),"utf8");
    return spawnSync(process.execPath,[validator,productionPath,planPath],{encoding:"utf8"});
  }finally{await rm(dir,{recursive:true,force:true});}
};

test("valid handoff passes schema and choreography",async()=>{
  const result=await run(production(),plan());
  assert.equal(result.status,0,result.stdout+"\n"+result.stderr);
  assert.match(result.stdout,/Interaction choreography PASS/);
});

test("unknown interaction fields are rejected",async()=>{
  const value=plan(); value.scenes[0].interactions[0].surprise=true;
  const result=await run(production(),value);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/unknown field surprise/);
});

test("duplicate event ids are rejected by schema parity",async()=>{
  const value=plan(); value.scenes[0].interactions[0].event_ids=["E1","E2","E2"];
  const result=await run(production(),value);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/event_ids must contain unique values/);
});

test("empty intent is rejected",async()=>{
  const value=plan(); value.scenes[0].interactions[0].intent="";
  const result=await run(production(),value);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/intent must be a string with minLength 1/);
});

test("initiator needs an event before responder activity",async()=>{
  const value=plan(); value.scenes[0].interactions[0].event_ids=["E2","E3"];
  const result=await run(production(),value);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/initiator must receive an event/);
});

test("unknown character anchors are rejected",async()=>{
  const value=plan(); value.scenes[0].interactions[0].anchors[0].anchor="elbow";
  const result=await run(production(),value);
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/unknown anchor alice:elbow/);
});
