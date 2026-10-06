import {readFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root=path.dirname(fileURLToPath(import.meta.url));
const fail=(message)=>{throw new Error("ASSET_LIBRARY_INVALID: "+message);};
const manifest=JSON.parse(await readFile(path.join(root,"manifest.json"),"utf8"));
if(manifest.version!=="3.4") fail("manifest.version must be 3.4");

const forbiddenStatePart=/(?:^|_)(?:open|closed|on|off|visible|hidden|reaching)$/iu;
const sections=[["character_masters","characters"],["prop_masters","props"],["scene_modules","scenes"],["effect_packs","effects"]];
const idsByKind=Object.fromEntries(sections.map(([key,kind])=>[kind,new Set((manifest[key]??[]).map((entry)=>entry.id))]));

const rules=[
  {names:["open","close"],parts:/(door|lid|flap|drawer|curtain|cabinet|closet|canopy|cover|latch|interior|handles)/u},
  {names:["lamp_on","lamp_off","light_change"],parts:/(lamp|light|glow)/u},
  {names:["weather_change"],parts:/(rain|weather|window|glass)/u},
  {names:["window_change"],parts:/(window|glass)/u},
  {names:["screen_change","notify"],parts:/(screen|notification|badge|display|lines)/u},
  {names:["clear"],parts:/(screen|notification|badge|display|lines|marker|information_surface)/u},
  {names:["turn_page"],parts:/(page|pages|cover|information_surface)/u},
  {names:["insert_item","remove_item","insert_letter","remove_letter"],parts:/(interior|contents|slot|tray|tissues|bag|letter|flap)/u},
  {names:["reveal"],parts:/(interior|contents|slot|surface|photo|shadow|glow|notes|reflection|clothing|bill|board)/u},
  {names:["reveal_information"],parts:/(information_surface|evidence_surface|photo_surface|caption_strip|message_card|card|paper|lines|rows|checks|route|note|total|pages)/u},
  {names:["reveal_reflection"],parts:/(reflection|mirror_surface|glass)/u},
  {names:["lock","unlock","insert_key"],parts:/(latch|keyhole|lock_indicator)/u},
  {names:["reflect"],parts:/mirror_surface/u},
  {names:["connect_clue"],parts:/clue_lines/u},
  {names:["add_note","post_note"],parts:/(note|notes|board)/u},
  {names:["turn_faucet"],parts:/faucet/u},
  {names:["stove_on","stove_off"],parts:/(stove|stove_glow)/u},
  {names:["signal_change"],parts:/(signal|red_light|green_light)/u},
  {names:["locker_open"],parts:/locker_door/u},
  {names:["fridge_open"],parts:/fridge_door/u},
  {names:["drawer_open"],parts:/drawer/u},
  {names:["closet_open","closet_close"],parts:/closet/u},
  {names:["cabinet_open"],parts:/cabinet/u},
  {names:["open_curtain","close_curtain"],parts:/curtain/u},
  {names:["door_open","door_close","classroom_door_open"],parts:/door/u},
  {names:["route_change"],parts:/route/u},
  {names:["indicator_change"],parts:/indicator/u},
  {names:["bus_arrive"],parts:/bus_indicator/u},
  {names:["bill_reveal"],parts:/bill/u},
  {names:["ring"],parts:/ring_marks/u},
  {names:["set"],parts:/(hands|face)/u},
  {names:["break_seal"],parts:/seal/u},
  {names:["dial"],parts:/dial/u},
  {names:["swap_photo"],parts:/photo_surface/u},
  {names:["dispense"],parts:/(tissues|slot)/u},
  {names:["scan"],parts:/scanner/u},
  {names:["call"],parts:/panel/u},
  {names:["sit_left","sit_right"],parts:/(seat|bench|chair)/u},
  {names:["hang_item"],parts:/(hook|hanger)/u},
  {names:["cross"],parts:/(crosswalk|road)/u},
];
const ruleByName=new Map();
for(const rule of rules) for(const name of rule.names) ruleByName.set(name,rule.parts);

for(const [key] of sections){
  for(const entry of manifest[key]??[]){
    const svgPath=path.join(root,entry.path);
    let svg;try{svg=await readFile(svgPath,"utf8");}catch{fail(`${entry.id} path missing: ${entry.path}`);}
    const svgIds=new Set([...svg.matchAll(/\sid=["']([^"']+)["']/gu)].map((m)=>m[1]));
    const parts=entry.anatomy?.semantic_parts;
    if(parts!==undefined){
      if(!Array.isArray(parts)||parts.length===0) fail(`${entry.id} semantic_parts must be a non-empty array`);
      for(const part of parts){
        if(part==="inspect_svg_groups") fail(`${entry.id} uses forbidden placeholder anatomy`);
        if(forbiddenStatePart.test(part)) fail(`${entry.id} semantic part encodes a state: ${part}`);
        if(!svgIds.has(part)) fail(`${entry.id} declares missing semantic part: ${part}`);
      }
    }
    if(key==="scene_modules"&&(!Array.isArray(parts)||parts.length<5)) fail(`${entry.id} scene needs at least 5 concrete semantic parts`);
    const partText=(parts??[]).join(" ");
    for(const affordance of entry.affordance_hints??[]){
      const required=ruleByName.get(affordance);
      if(required&&!required.test(partText)) fail(`${entry.id} affordance ${affordance} has no supporting semantic mechanism`);
    }
    if((manifest.forbidden_for_new_work??[]).some((prefix)=>entry.path.includes(prefix))) fail(`${entry.id} points at forbidden legacy root`);
  }
}

for(const kitPath of manifest.kits??[]){
  const kit=JSON.parse(await readFile(path.join(root,kitPath),"utf8"));
  for(const [kind,ids] of Object.entries({characters:kit.characters??[],props:kit.props??[],scenes:kit.scenes??[],effects:kit.effects??[]})){
    for(const id of ids) if(!idsByKind[kind].has(id)) fail(`${kit.id} references unknown ${kind.slice(0,-1)}: ${id}`);
  }
}
console.log(`Asset library ${manifest.version} OK: ${manifest.character_masters.length} characters, ${manifest.prop_masters.length} props, ${manifest.scene_modules.length} scenes, ${manifest.effect_packs.length} effects, ${manifest.kits.length} kits.`);
