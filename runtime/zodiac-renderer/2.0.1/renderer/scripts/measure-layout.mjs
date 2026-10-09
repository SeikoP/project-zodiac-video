import {createRequire} from 'node:module';
import {resolveCaptionLayout} from '../src/caption-layout.mjs';

export async function measurePlanLayout(plan) {
  if (!plan.scenes.some(s=>s.captions?.length)) return plan;
  // Resolve the renderer already installed for the pinned CLI, including nested npm installs.
  const require=createRequire(import.meta.url);
  const cliRequire=createRequire(require.resolve('@remotion/cli/package.json'));
  const {openBrowser}=cliRequire('@remotion/renderer');
  const browser=await openBrowser('chrome',{logLevel:'error'});
  try {
    const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
    const measurements=await page.evaluate(async ({assets,presentation,scenes})=>{
      const caption=presentation.caption ?? {};
      if(caption.font_data_uri) {
        const font=new FontFace(caption.font_family,`url("${caption.font_data_uri}")`,{weight:String(caption.font_weight??400)});
        await font.load();document.fonts.add(font);
      }
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),bounds={};
      for(const [id,asset] of Object.entries(assets)) {
        const img=new Image();img.src=asset.src;await img.decode();
        const svg=new DOMParser().parseFromString(atob(asset.src.split(',')[1]),'image/svg+xml').documentElement;
        const viewBox=svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
        const width=Number(svg.getAttribute('width')) || viewBox?.[2] || img.naturalWidth;
        const height=Number(svg.getAttribute('height')) || viewBox?.[3] || img.naturalHeight;
        canvas.width=Math.ceil(width);canvas.height=Math.ceil(height);
        ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let minX=canvas.width,minY=canvas.height,maxX=-1,maxY=-1;
        for(let y=0;y<canvas.height;y++) for(let x=0;x<canvas.width;x++) if(pixels[(y*canvas.width+x)*4+3]>0) {minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
        bounds[id]={intrinsic_size:{width,height},visual_bounds:maxX<0?{x:0,y:0,width:0,height:0}:{x:minX/canvas.width,y:minY/canvas.height,width:(maxX-minX+1)/canvas.width,height:(maxY-minY+1)/canvas.height}};
      }
      ctx.font=`${caption.font_weight??400} ${caption.font_size_px??84}px "${caption.font_family??'sans-serif'}"`;
      const widths={},inkHeights={};
      for(const scene of scenes) for(const c of scene.captions??[]) {
        const metrics=ctx.measureText(c.text.replaceAll('\n',' '));
        inkHeights[c.text]=metrics.actualBoundingBoxAscent+metrics.actualBoundingBoxDescent;
      }
      for(const scene of scenes) for(const c of scene.captions??[]) for(const paragraph of c.text.split('\n')) {
        const words=paragraph.split(/\s+/).filter(Boolean);
        for(let a=0;a<words.length;a++) for(let b=a+1;b<=words.length;b++) {const text=words.slice(a,b).join(' ');widths[text]=ctx.measureText(text).width;}
      }
      return {bounds,widths,inkHeights};
    },{assets:plan.assets,presentation:plan.presentation??{},scenes:plan.scenes});
    for(const [id,bounds] of Object.entries(measurements.bounds)) Object.assign(plan.assets[id],bounds);
    for(const scene of plan.scenes) for(const caption of scene.captions??[]) {
      try {caption.resolved_layout=resolveCaptionLayout(scene,plan.presentation,plan.video,caption.text,text=>measurements.widths[text]??0);}
      catch(error) {throw new Error(`${error.message} frame=${caption.start_frame}`);}
      const {zone,lines}=caption.resolved_layout;
      if(measurements.inkHeights[caption.text]>zone.fontSize*zone.lineHeight)
        throw new Error(`CAPTION_OVERFLOW scene=${scene.id} frame=${caption.start_frame} actual_lines=${lines.length} max_lines=${zone.maxLines} ink_height=${measurements.inkHeights[caption.text]} line_height_px=${zone.fontSize*zone.lineHeight}`);
    }
    return plan;
  } finally {await browser.close({silent:true});}
}
