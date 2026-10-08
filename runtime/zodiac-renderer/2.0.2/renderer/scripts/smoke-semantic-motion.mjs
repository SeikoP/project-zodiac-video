#!/usr/bin/env node
import {mkdtemp, readFile, writeFile, rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join, resolve} from "node:path";
import {spawnSync} from "node:child_process";
import {createHash} from "node:crypto";

const root=await mkdtemp(join(tmpdir(),"zodiac-motion-proof-"));
const svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="100" cy="100" r="77" fill="#df5b54"/><path d="M35 105 L85 146 L165 50" fill="none" stroke="#101920" stroke-width="16"/></svg>';
const sprite='data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64');
const box={asset:"FX",transform:{x:420,y:600,width:240,height:240},layer:10};
const props={
 contract:"zodiac-render-plan@1",fps:24,video:{width:1080,height:1920},
 assets:{FX:{category:"effect",src:sprite}},
 scenes:[{id:"semantic-motion",start_frame:0,duration_frames:48,
 entities:[{id:"story_effect",initial_state:"hidden",states:{
   hidden:{...box,visible:false},shown:{...box,visible:true}
 }}],
 events:[
   {event_id:"enter",target:"story_effect",motion:"effect_pop",start_frame:8,end_frame:20,
    state_before:"hidden",state_after:"shown",asset_before:"FX",asset_after:"FX"},
   {event_id:"exit",target:"story_effect",motion:"effect_dissolve",start_frame:32,end_frame:40,
    state_before:"shown",state_after:"hidden",asset_before:"FX",asset_after:"FX"}
 ]}]
};
const output=join(root,"props.json");
try {
 await writeFile(output,JSON.stringify(props));
 const hashes={};
 for(const frame of [4,14,24,36,44]){
   const dest=join(root,`frame-${frame}.png`);
   const result=spawnSync(process.platform==="win32"?"npx.cmd":"npx",[
    "remotion","still","src/index.ts","ZodiacRenderPlan",dest,
    `--props=${output}`,`--frame=${frame}`
   ],{cwd:resolve("."),stdio:"inherit"});
   if(result.status!==0 || result.error) throw new Error(`still failed frame=${frame} ${result.error??result.status}`);
   hashes[frame]=createHash("sha256").update(await readFile(dest)).digest("hex");
 }
 if(hashes[4]!==hashes[44])throw Error("effect failed to clear after release");
 if(hashes[4]===hashes[14]||hashes[4]===hashes[24])throw Error("effect absent during/after enter");
 if(hashes[24]===hashes[36])throw Error("effect dissolve has no visible lifecycle");
 console.log("SEMANTIC_RENDER_FRAME_PASS "+JSON.stringify({frames:Object.keys(hashes),hashes}));
}finally{
 if(!process.env.KEEP_MOTION_FRAMES)await rm(root,{recursive:true,force:true});
 else console.log("MOTION_FRAMES "+root);
}
