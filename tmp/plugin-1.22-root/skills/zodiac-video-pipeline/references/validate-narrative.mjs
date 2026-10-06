#!/usr/bin/env node
import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const args=process.argv.slice(2);
if(args.length<2){
  console.error("Usage: node validate-narrative.mjs <narrative-plan.json> <narration.txt> [interaction-plan.json]");
  process.exit(2);
}
const [planPath,narrationPath,interactionPath]=args;
const plan=JSON.parse(await readFile(planPath,"utf8"));
const narration=await readFile(narrationPath,"utf8");
const root=path.dirname(fileURLToPath(import.meta.url));
const schema=JSON.parse(await readFile(path.join(root,"narrative-plan.schema.json"),"utf8"));
const fail=(m)=>{throw new Error("NARRATIVE_MODE_INVALID: "+m);};
const warn=(m)=>console.warn("NARRATIVE_MODE_WARNING: "+m);

const assertObject=(value,spec,label)=>{
  if(!value||typeof value!=="object"||Array.isArray(value))fail(label+" must be an object");
  const allowed=new Set(Object.keys(spec.properties??{}));
  if(spec.additionalProperties===false)for(const key of Object.keys(value))if(!allowed.has(key))fail(label+" contains unknown field "+key);
  for(const key of spec.required??[])if(!(key in value))fail(label+" is missing required field "+key);
};
const assertString=(value,label,min=0)=>{if(typeof value!=="string"||value.length<min)fail(label+" must be a non-empty string");};
const assertStringArray=(value,spec,label)=>{
  if(!Array.isArray(value))fail(label+" must be an array");
  if(spec.minItems!==undefined&&value.length<spec.minItems)fail(label+" needs at least "+spec.minItems+" item(s)");
  for(const item of value)assertString(item,label+" item",spec.items?.minLength??0);
  if(spec.uniqueItems&&new Set(value).size!==value.length)fail(label+" must contain unique values");
};
const normalize=(s)=>String(s).normalize("NFD").replace(/\p{M}/gu,"").toLowerCase().replace(/đ/g,"d").replace(/[^\p{L}\p{N}]+/gu," ").trim();
const words=normalize(narration).split(/\s+/u).filter(Boolean);
const opening=words.slice(0,40).join(" ");

assertObject(plan,schema,"narrative plan");
if(plan.version!==schema.properties.version.const)fail("version must be "+schema.properties.version.const);
if(!schema.properties.story_shape.enum.includes(plan.story_shape))fail("unsupported story_shape");
if(!schema.properties.delivery_mode.enum.includes(plan.delivery_mode))fail("unsupported delivery_mode");
assertObject(plan.sign,schema.properties.sign,"sign");
assertString(plan.sign.id,"sign.id",1);assertString(plan.sign.label,"sign.label",1);
if(plan.sign.aliases!==undefined)assertStringArray(plan.sign.aliases,schema.properties.sign.properties.aliases,"sign.aliases");
assertObject(plan.topic,schema.properties.topic,"topic");assertString(plan.topic.focus,"topic.focus",1);
assertString(plan.selection_rationale,"selection_rationale",1);
if(plan.audience_vibe!==undefined&&!schema.properties.audience_vibe.enum.includes(plan.audience_vibe))fail("unsupported audience_vibe");
if(!Array.isArray(plan.beats)||!plan.beats.length)fail("beats must be non-empty");

const aliases=[plan.sign.label,...(plan.sign.aliases??[])].map(normalize).filter(Boolean);
if(!aliases.some((alias)=>opening.includes(alias)))fail("sign/topic label must appear within the first 40 normalized narration words");

const beatSchema=schema.$defs.beat;
const beatIds=new Set();
for(const beat of plan.beats){
  assertObject(beat,beatSchema,"beat");
  assertString(beat.id,"beat.id",1);
  if(beatIds.has(beat.id))fail("beat IDs must be unique: "+beat.id);
  beatIds.add(beat.id);
  assertString(beat.purpose,beat.id+".purpose",1);
  if(!beatSchema.properties.support.enum.includes(beat.support))fail(beat.id+" has unsupported support class");
  assertStringArray(beat.evidence_refs,beatSchema.properties.evidence_refs,beat.id+".evidence_refs");
  if(!Array.isArray(beat.devices))fail(beat.id+".devices must be an array");
  if(new Set(beat.devices).size!==beat.devices.length)fail(beat.id+".devices must be unique");
  for(const device of beat.devices)if(!beatSchema.properties.devices.items.enum.includes(device))fail(beat.id+" has unsupported device "+device);
  if(beat.devices.includes("contradiction")){
    assertString(beat.contradiction_basis,beat.id+".contradiction_basis",1);
  }
  if(beat.devices.includes("interaction")){
    assertString(beat.interaction_id,beat.id+".interaction_id",1);
  }
}

if(plan.delivery_mode==="conversational"){
  const conversationalDevices=new Set(["riff","micro_scene","narrator_reaction","contradiction","interaction"]);
  if(!plan.beats.some((beat)=>beat.devices.some((device)=>conversationalDevices.has(device))))fail("conversational mode needs at least one conversational delivery device");
  const isRiffOnly=(beat)=>{
    const allowed=new Set(["hook","riff","narrator_reaction","bridge"]);
    return beat.support!=="SOURCE-SUPPORTED" && beat.devices.length>0 && beat.devices.every((device)=>allowed.has(device));
  };
  let leadingRiff=0;
  for(const beat of plan.beats){if(isRiffOnly(beat))leadingRiff++;else break;}
  if(leadingRiff>3)fail("conversational opening has more than three leading riff-only beats before substantive content");

  let reactionOnlyRun=0,maxReactionOnlyRun=0;
  for(const beat of plan.beats){
    const reactionOnly=beat.devices.length>0&&beat.devices.every((device)=>["narrator_reaction","riff","bridge"].includes(device));
    reactionOnlyRun=reactionOnly?reactionOnlyRun+1:0;
    maxReactionOnlyRun=Math.max(maxReactionOnlyRun,reactionOnlyRun);
  }
  if(maxReactionOnlyRun>=3)warn("three or more reaction/riff-only beats occur consecutively; review narrator spam");

  const analysisBridgePatterns=[
    /\bvấn đề là\b/giu,
    /\bđiểm chính(?: là)?\b/giu,
    /\bđó chính là\b/giu,
    /\bchỉ là\b/giu,
    /\bnói cách khác\b/giu,
    /\bđiều này (?:cho thấy|có nghĩa)\b/giu
  ];
  const analysisBridgeCount=analysisBridgePatterns.reduce((sum,pattern)=>sum+(narration.match(pattern)?.length??0),0);
  if(analysisBridgeCount>=3)warn("ANALYSIS_VOICE_DENSITY: conversational narration uses several explanatory bridge phrases; review for post-scene over-explanation");

  if(plan.audience_vibe==="student_peer"){
    const adultWork=/\b(remote|kpi|tăng lương|lương thưởng|nghỉ việc|sếp|văn phòng|công ty|họp công ty|deadline công sở)\b/giu;
    if(adultWork.test(narration))warn("AUDIENCE_VIBE: student_peer narration contains adult-workplace language; confirm the context is intentional");
  }
}

const interactionBeats=plan.beats.filter((beat)=>beat.devices.includes("interaction"));
if(interactionBeats.length){
  if(!interactionPath){
    warn("interaction beats exist; re-run with interaction-plan.json after Visual Compile for final cross-check");
  }else{
    const interactions=JSON.parse(await readFile(interactionPath,"utf8"));
    const ids=new Set((interactions.scenes??[]).flatMap((scene)=>(scene.interactions??[]).map((item)=>item.id)));
    for(const beat of interactionBeats)if(!ids.has(beat.interaction_id))fail(beat.id+" interaction_id does not resolve in interaction plan: "+beat.interaction_id);
  }
}

console.log("Narrative mode PASS: "+plan.story_shape+" + "+plan.delivery_mode);
