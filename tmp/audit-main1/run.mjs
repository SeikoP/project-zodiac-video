import {readFile,readdir} from 'node:fs/promises';import path from 'node:path';
import {renderPreview,previewRuntime,quality} from '../../tools/studio_project/visual_preview.mjs';
const JOBS=process.env.JOBS,rt=await previewRuntime(path.resolve('.'));
const rows=[];
for(const job of (await readdir(JOBS)).sort()){
  const row={job,scenes:0,ok:0,errors:{},unsupported:[],qa_issues:{},warnings:{},fx:0,fps:null};
  try{
    const plan=JSON.parse(await readFile(path.join(JOBS,job,'.runtime/render-plan.json'),'utf8')),fps=plan.fps;row.fps=fps;
    const assets={};
    for(const [id,a] of Object.entries(plan.assets??{})){try{assets[id]={svg:await readFile(path.join(JOBS,job,a.path),'utf8'),source_sha256:'a'.repeat(64),metadata:{category:a.category,...a}};}catch(e){row.errors['ASSET_FILE_MISSING']=(row.errors['ASSET_FILE_MISSING']??0)+1;}}
    for(const s of plan.scenes){
      row.scenes++;
      const events=s.events.map(e=>({...e,id:e.event_id,at:(e.start_frame-s.start_frame)/fps,preview_motion:e.motion,preview_duration:(e.end_frame-e.start_frame)/fps}));
      const words=s.captions.flatMap(c=>c.words.map(w=>({text:w.text,startMs:(w.start_frame)/fps*1000,endMs:(w.end_frame)/fps*1000})));
      const time={scene_id:s.id,fps,startMs:s.start_frame/fps*1000,endMs:(s.start_frame+s.duration_frames)/fps*1000,measured:true,words,events};
      const scene={...s,entities:s.entities.map(e=>({...e,states:Object.fromEntries(Object.entries(e.states).map(([k,v])=>[k,{...v,asset:v.asset}]))}))};
      try{
        const out=renderPreview(scene,assets,time,'light',rt.gsap,rt.font,plan.presentation);
        if(out.unsupported_motions.length)row.unsupported.push(...out.unsupported_motions);
        const q=quality(scene,'light',time);for(const i of q.issues)row.qa_issues[i.code]=(row.qa_issues[i.code]??0)+1;
        for(const w of q.review_warnings)row.warnings[w.code]=(row.warnings[w.code]??0)+1;
        row.ok++;
      }catch(e){const k=String(e.message).split(' ')[0].slice(0,60);row.errors[k]=(row.errors[k]??0)+1;}
    }
  }catch(e){row.errors['PLAN_'+String(e.code??e.message).slice(0,40)]=1;}
  row.unsupported=[...new Set(row.unsupported)];rows.push(row);
}
console.log(JSON.stringify(rows));
