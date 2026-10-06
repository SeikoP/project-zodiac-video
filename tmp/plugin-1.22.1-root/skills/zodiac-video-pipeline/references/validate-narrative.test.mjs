import assert from "node:assert/strict";
import {mkdtemp,rm,writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import test from "node:test";

const root=path.dirname(fileURLToPath(import.meta.url));
const validator=path.join(root,"validate-narrative.mjs");
const basePlan=()=>({
  version:"1.0",
  story_shape:"character_deconstruction",
  delivery_mode:"conversational",
  audience_vibe:"student_peer",
  sign:{id:"scorpio",label:"Bọ Cạp",aliases:["Scorpio"]},
  topic:{focus:"mâu thuẫn giữa lời nói và hành vi"},
  selection_rationale:"Micro-behavior and relational contradiction support conversational delivery.",
  beats:[
    {id:"B01",purpose:"Name the sign and hook the tension.",support:"SOURCE-SUPPORTED",evidence_refs:["E1"],devices:["hook"]},
    {id:"B02",purpose:"Stage the stance in a tiny scene.",support:"FICTIONAL MICRO-EXAMPLE",evidence_refs:["E1"],devices:["micro_scene","interaction"],interaction_id:"I1"},
    {id:"B03",purpose:"Catch the supported tension.",support:"EDITORIAL EXAGGERATION",evidence_refs:["E1"],devices:["contradiction","narrator_reaction"],contradiction_basis:"The approved evidence explicitly contains both sides of the displayed tension."},
    {id:"B04",purpose:"Land the payoff.",support:"EDITORIAL EXAGGERATION",evidence_refs:["E1"],devices:["payoff"]}
  ]
});
const narration="Bọ Cạp có một cái rất buồn cười. Miệng thì nói không cần ai, nhưng tình huống này bắt đầu lệch ngay khi người kia thật sự lùi lại.";
const interaction={version:"1.0",scenes:[{scene_id:"S01",interactions:[{id:"I1"}]}]};

const run=async(plan,narr=narration,interactionValue=interaction)=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),"zodiac-narrative-"));
  try{
    const pp=path.join(dir,"plan.json"),np=path.join(dir,"narration.txt"),ip=path.join(dir,"interaction.json");
    await writeFile(pp,JSON.stringify(plan),"utf8");await writeFile(np,narr,"utf8");
    const args=[validator,pp,np];
    if(interactionValue!==null){await writeFile(ip,JSON.stringify(interactionValue),"utf8");args.push(ip);}
    return spawnSync(process.execPath,args,{encoding:"utf8"});
  }finally{await rm(dir,{recursive:true,force:true});}
};

test("conversational plan passes without enforcing a fixed beat template",async()=>{const r=await run(basePlan());assert.equal(r.status,0,r.stdout+"\n"+r.stderr);assert.match(r.stdout,/Narrative mode PASS/);});
test("direct mode does not require banter devices",async()=>{const p=basePlan();p.delivery_mode="direct";p.beats=[{id:"B1",purpose:"Direct insight.",support:"SOURCE-SUPPORTED",evidence_refs:["E1"],devices:["hook","payoff"]}];const r=await run(p,"Bọ Cạp: đây là insight đi thẳng vào vấn đề.",null);assert.equal(r.status,0,r.stdout+"\n"+r.stderr);});
test("late sign/topic identification fails",async()=>{const r=await run(basePlan(),"một hai ba bốn năm sáu bảy tám chín mười ".repeat(5)+" Bọ Cạp");assert.notEqual(r.status,0);assert.match(r.stderr,/first 40 normalized narration words/);});
test("more than three leading riff-only beats fails",async()=>{const p=basePlan();p.beats=[0,1,2,3].map(i=>({id:"R"+i,purpose:"riff",support:"EDITORIAL EXAGGERATION",evidence_refs:["E1"],devices:["riff"]})).concat(p.beats);const r=await run(p);assert.notEqual(r.status,0);assert.match(r.stderr,/more than three leading riff-only beats/);});
test("contradiction requires an explicit evidence-bounded basis",async()=>{const p=basePlan();delete p.beats[2].contradiction_basis;const r=await run(p);assert.notEqual(r.status,0);assert.match(r.stderr,/contradiction_basis/);});
test("interaction IDs must resolve during final cross-check",async()=>{const p=basePlan();p.beats[1].interaction_id="MISSING";const r=await run(p);assert.notEqual(r.status,0);assert.match(r.stderr,/does not resolve/);});

test("analysis-heavy conversational bridges trigger a soft warning",async()=>{const p=basePlan();const r=await run(p,"Bọ Cạp có một chuyện. Vấn đề là thế này. Chỉ là sau đó lại đổi. Đó chính là chỗ mọi người thấy lạ.");assert.equal(r.status,0,r.stdout+"\n"+r.stderr);assert.match(r.stderr,/ANALYSIS_VOICE_DENSITY/);});
test("student-peer vibe warns on adult workplace defaults",async()=>{const p=basePlan();const r=await run(p,"Bọ Cạp nói chuyện với sếp về tăng lương rồi xin remote.");assert.equal(r.status,0,r.stdout+"\n"+r.stderr);assert.match(r.stderr,/AUDIENCE_VIBE/);});
