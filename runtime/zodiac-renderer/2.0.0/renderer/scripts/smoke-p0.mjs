import {mkdtemp, mkdir, readFile, writeFile, copyFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {resolve, join} from "node:path";
import {spawnSync} from "node:child_process";
import {prepareRendererProps} from "./prepare.mjs";
const root=await mkdtemp(join(tmpdir(),"zodiac-p0-smoke-"));
await mkdir(join(root,"assets"),{recursive:true});
await mkdir(join(root,".runtime"),{recursive:true});
const characterSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 330"><g stroke="#40565a" stroke-width="5" stroke-linecap="round"><circle cx="130" cy="100" r="60" fill="#f0c9a6"/><ellipse cx="130" cy="232" rx="85" ry="70" fill="#83b7ac"/><path d="M96 93h12m43 0h12m-44 30q20 16 40 0" fill="none"/></g></svg>';
const phoneSvg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 180"><rect x="7" y="6" width="96" height="168" rx="14" fill="#fffef8" stroke="#40565a" stroke-width="6"/><rect x="19" y="25" width="72" height="118" fill="#8eb9b6"/><circle cx="55" cy="158" r="8" fill="#40565a"/></svg>';
await writeFile(join(root,"assets/character.svg"),characterSvg);
await writeFile(join(root,"assets/phone.svg"),phoneSvg);
const zone={canvas:{width:1080,height:1920},caption_safe_zone:{x:80,y:1320,width:920,height:350},character_zone:{x:24,y:360,width:1032,height:545},prop_zone:{x:100,y:930,width:880,height:340},effect_zone:{x:20,y:380,width:1040,height:510}};
const density={max_characters:3,max_prominent_props:2,max_prominent_effects:2};
const entity=(id,asset,x,y,width,height)=>({id,initial_state:"visible",states:{visible:{asset,visible:true,layer:10,transform:{x,y,width,height}}}});
const scene=(id,start,entities,text)=>({id,start_frame:start,duration_frames:72,measured_duration_frames:72,events:[],entities,captions:[{text,start_frame:start,end_frame:start+70}],layout_contract:zone,render_density_budget:density});
const plan={format:"zodiac-render-plan@1",fps:24,video:{width:1080,height:1920},
 assets:{"character":{path:"assets/character.svg"},"phone":{path:"assets/phone.svg"}},
 presentation:{paper:"#f7f1e8",ink:"#40565a",caption:{font_family:"Patrick Hand",font_size_px:76,font_weight:400,max_lines:2,color:"#40565a",safe_zone:zone.caption_safe_zone},watermark:{enabled:true,text:"✦ bungmoto",font_family:"Patrick Hand",font_size_px:29,layer:100,opacity:.45}},
 scenes:[
  scene("S01",0,[entity("actor-a","character",20,430,300,390),entity("actor-b","character",380,390,300,430),entity("actor-c","character",740,430,300,390)],"Hai người quen cùng một Bọ Cạp"),
  scene("S02",72,[entity("actor-a","character",365,420,340,430),entity("story_prop","phone",460,965,180,280)],"Tin nhắn này khiến Bọ Cạp phải suy nghĩ."),
  scene("S03",144,[entity("actor-b","character",335,420,360,430)],"Bọ Cạp không thay đổi vì muốn làm vừa lòng mọi người."),
 ]};
await writeFile(join(root,".runtime/render-plan.json"),JSON.stringify(plan));
const {output,props}=await prepareRendererProps(root);
if(!props.presentation.caption.font_data_uri?.startsWith("data:font/ttf;base64,"))throw Error("Patrick Hand not bundled");
if(props.presentation.watermark.text!=="✦ bungmoto")throw Error("watermark mismatch");
const artifactDir=resolve("tests/renderer-smoke/out/p0");
await mkdir(artifactDir,{recursive:true});
const report={status:"PASS",font_requested:"Patrick Hand",font_embedded:true,watermark:"✦ bungmoto",cases:[]};
for(const [id,frame] of [["S01",24],["S02",96],["S03",168]]){
 const out=join(root,id+".png");
 const r=spawnSync(process.platform==="win32"?"npx.cmd":"npx",["remotion","still","src/index.ts","ZodiacRenderPlan",out,"--props="+output,"--frame="+frame],{cwd:resolve("runtime/zodiac-renderer/2.0.0/renderer"),stdio:"inherit"});
 if(r.status!==0)throw Error("render failed: "+id);
 const bytes=await readFile(out);if(bytes.length<1000)throw Error("empty smoke frame "+id);
 await copyFile(out,join(artifactDir,id+".png"));
 report.cases.push({scene:id,frame,file:id+".png",size_bytes:bytes.length,caption:plan.scenes.find(s=>s.id===id).captions[0].text});
}
await writeFile(join(artifactDir,"smoke-report.json"),JSON.stringify(report,null,2));
console.log("P0_SMOKE_PASS",JSON.stringify(report));
