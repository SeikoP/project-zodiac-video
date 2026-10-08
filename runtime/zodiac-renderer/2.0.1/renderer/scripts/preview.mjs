// Exact Remotion event preview, owned by local runner (not plugin).
import {mkdir,writeFile} from "node:fs/promises";
import {resolve,dirname,join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
import {prepareRendererProps} from "./prepare.mjs";

export const resolvePreviewEventPairs = (scene) => {
  const first = scene.start_frame, last = first + scene.duration_frames - 1;
  if (!Number.isInteger(first) || !Number.isInteger(last) || last < first)
    throw new Error("PREVIEW_SCENE_FRAME_RANGE_INVALID " + String(scene.id));
  const events = scene.events ?? [];
  if (!events.length) return [{
    event_id:"scene-overview",target:null,motion_only:false,before_frame:first,
    second_frame:last,second_role:"end",fallback:true,distinct_frames:first !== last
  }];
  const used = new Set();
  return events.map(event => {
    const id = String(event.event_id ?? event.id ?? "");
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(id) || used.has(id))
      throw new Error("PREVIEW_EVENT_ID_INVALID " + id);
    used.add(id);
    const a = event.start_frame, b = event.end_frame;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < first || b <= a || b > last + 1)
      throw new Error("PREVIEW_EVENT_RANGE_INVALID " + id);
    const sameAssetState = event.state_before === event.state_after &&
      (event.asset_before ?? null) === (event.asset_after ?? null);
    if (sameAssetState && event.motion === "state_swap")
      throw new Error("PREVIEW_NOOP_STATE_SWAP "+id);
    const staticHold = sameAssetState && event.motion === "hold";
    const motionOnly = sameAssetState && !staticHold;
    const before = Math.max(first,a-1);
    const mid = Math.max(a,Math.min(b-1,Math.floor((a+b-1)/2)));
    const after = Math.min(last,b+Math.min(4,Math.max(1,b-a)));
    const second = motionOnly ? mid : after;
    return {event_id:id,target:event.target ?? null,motion_only:motionOnly,static_hold:staticHold,
      before_frame:before,second_frame:second,second_role:motionOnly?"during":"after",
      fallback:false,distinct_frames:before !== second};
  });
};

export const previewFrames = async (workspace,outputDir) => {
  const {output,props} = await prepareRendererProps(workspace);
  const out = resolve(outputDir);
  await mkdir(out,{recursive:true});
  const rendererDir = resolve(dirname(fileURLToPath(import.meta.url)),"..");
  const report={contract:"renderer-faithful-preview@2",source:"zodiac-render-plan@1",
    font:props.presentation?.caption?.font_family ?? "sans-serif",
    sampling:"two-real-remotion-frames-per-event",
    frames_per_event:2,scenes:[],event_pairs:[]};
  for (const scene of props.scenes) {
    if (!/^[A-Za-z0-9_-]{1,100}$/.test(String(scene.id ?? "")))
      throw new Error("PREVIEW_SCENE_ID_INVALID " + String(scene.id));
    for (const pair of resolvePreviewEventPairs(scene)) {
      const frames=[];
      for (const [role,frame] of [["before",pair.before_frame],[pair.second_role,pair.second_frame]]) {
        const file=scene.id+"-"+pair.event_id+"-"+role+"-f"+frame+".png";
        const command=process.platform==="win32"?"npx.cmd":"npx";
        const result=spawnSync(command,["remotion","still","src/index.ts","ZodiacRenderPlan",
          join(out,file),"--props="+output,"--frame="+frame],{cwd:rendererDir,stdio:"inherit"});
        if (result.error || result.status!==0)
          throw new Error("PREVIEW_RENDER_FAILED scene="+scene.id+" event="+pair.event_id+" frame="+frame+" status="+result.status+": "+(result.error ?? ""));
        frames.push({role,frame,file});
        report.scenes.push({id:scene.id,event_id:pair.event_id,frame,file,role});
      }
      report.event_pairs.push({scene_id:scene.id,event_id:pair.event_id,target:pair.target,
        motion_only:pair.motion_only,static_hold:pair.static_hold??false,distinct_frames:pair.distinct_frames,
        fallback:pair.fallback,frames});
    }
  }
  const esc=s=>String(s??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
  const rows=report.event_pairs.map(pair=>{
    const pics=pair.frames.map(item=>'<figure><img src="'+esc(item.file)+'" alt="'+esc(pair.event_id+" "+item.role)+'"><figcaption>'+item.role.toUpperCase()+' · frame '+item.frame+'</figcaption></figure>').join("");
    return '<section><h2>'+esc(pair.scene_id+" · "+pair.event_id+" · "+(pair.target??"scene"))+'</h2><p>'+
      (pair.static_hold?"BEFORE/AFTER — static hold (no animation)":pair.motion_only?"BEFORE/DURING — active motion":"BEFORE/AFTER — state or visibility change")+
      (pair.distinct_frames?"":" — WARNING: same sampled frame, temporal check required")+'</p><div class="pair">'+pics+'</div></section>';
  }).join("");
  const html='<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Remotion event preview</title>'+
    '<style>body{font:16px system-ui;background:#eee9e0;color:#29363d;margin:24px}section{border-top:1px solid #bbb;padding:12px 0}.pair{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;background:white;padding:10px;border-radius:8px;max-width:280px}img{width:100%;aspect-ratio:9/16;object-fit:contain}figcaption{padding:6px 0;font-weight:600}</style>'+
    '<h1>Two actual Remotion frames per event</h1><p>Source: render-plan.json · Font: '+esc(report.font)+
    ' · Same composition as final video. Motion-only events sample BEFORE/DURING; visibility/state events sample BEFORE/AFTER.</p>'+rows+'</html>';
  await writeFile(join(out,"index.html"),html);
  await writeFile(join(out,"preview-report.json"),JSON.stringify(report,null,2)+"\n");
  return report;
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const workspace=process.argv[2],output=process.argv[3];
  if (!workspace || !output) throw new Error("Usage: node scripts/preview.mjs <job-workspace> <output-dir>");
  const report=await previewFrames(workspace,output);
  console.log("RENDERER_PREVIEW_PASS pairs="+report.event_pairs.length+" frames="+report.scenes.length);
}
