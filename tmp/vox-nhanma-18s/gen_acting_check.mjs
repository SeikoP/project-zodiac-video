import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';
import {renderPreview,previewRuntime} from '../../tools/studio_project/visual_preview.mjs';
const A='tmp/vox-nhanma-18s/assets/',svg=async f=>({svg:await readFile(A+f,'utf8'),source_sha256:'a'.repeat(64)});
const assets={sag:await svg('sagittarius-idle.svg'),fr:await svg('friend-idle.svg'),frh:await svg('friend-hurt.svg'),wb:await svg('classroom-whiteboard.svg'),dk:await svg('classroom-desk-edge.svg')};
const st=(asset,t,layer=20)=>({asset,layer,visible:true,transform:t});
const T=(x,y,w,h)=>({x,y,width:w,height:h});
const scene={id:'s02',entities:[
 {id:'wb',kind:'environment',visual_role:'background',initial_state:'v',states:{v:st('wb',T(112,300,494,306),2)}},
 {id:'dk',kind:'environment',visual_role:'foreground_environment',initial_state:'v',states:{v:st('dk',T(128,628,784,235),5)}},
 {id:'sag',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:st('sag',T(141,450,328,480))}},
 {id:'fr',kind:'character',visual_role:'character',initial_state:'idle',states:{idle:st('fr',T(611,450,328,480)),hurt:st('frh',T(611,450,328,480))}}]};
const time={scene_id:'s02',fps:24,startMs:0,endMs:4000,measured:true,words:[{text:'Xin',startMs:0,endMs:400}],events:[
 {id:'lean',target:'sag',state_before:'idle',state_after:'idle',at:.4,preview_motion:'lean',preview_duration:.6,preview_params:{degrees:12,dx:60}},
 {id:'hurt',target:'fr',state_before:'idle',state_after:'hurt',at:2.0,preview_motion:'state_swap',preview_duration:.1},
 {id:'rec',target:'fr',state_before:'hurt',state_after:'hurt',at:2.0,preview_motion:'recoil',preview_duration:.3,preview_params:{degrees:-8,dx:-22}}],
 camera:[{at:1.5,duration:0,from:{x:775,y:650,zoom:1.7},to:{x:775,y:650,zoom:1.7}},{at:1.5,duration:1.5,from:undefined,to:{x:775,y:640,zoom:1.85}}]};
// camera shots: first is a hard cut to the framing, second pushes in
time.camera=[{at:1.5,duration:1.5,from:{x:775,y:650,zoom:1.7},to:{x:775,y:640,zoom:1.85}}];
const rt=await previewRuntime(path.resolve('.'));
const out=renderPreview(scene,assets,time,'indigo-noir',rt.gsap,rt.font);
await writeFile('tmp/vox-nhanma-18s/acting_check.html',out.html);console.log(out.fidelity,out.unsupported_motions);
