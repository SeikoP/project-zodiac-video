"""Audition the existing Ma Ket package; never write to its source workspace."""
from pathlib import Path
import hashlib
import html
import json
import shutil
import subprocess

ROOT = Path(__file__).parent
SOURCE = Path(r'E:\projects\project-zodiac-video\.zodiac-work\v2\jobs\maket-nguoi-thua')
plan = json.loads((SOURCE / '.runtime/render-plan.json').read_text(encoding='utf-8'))
scene = plan['scenes'][0]
assert scene['id'] == 'S01' and plan['fps'] == 24
assets = ROOT / 'assets'
assets.mkdir(exist_ok=True)
names = ['capricorn-neutral.svg', 'capricorn-stop.svg', 'partner-neutral.svg', 'partner-reach.svg']
for name in names:
    shutil.copy2(SOURCE / 'assets/characters' / name, assets / name)
shutil.copy2(SOURCE / 'assets/props/capricorn-shopping-bag.svg', assets)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(SOURCE/'out/zodiac-story.mp4'),'-t','10','-vn','-c:a','pcm_s16le',str(assets/'source-audio.wav')],check=True)
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(SOURCE/'out/zodiac-story.mp4'),'-t','10','-c:v','libx264','-crf','18','-c:a','aac',str(ROOT/'maket-original-10s.mp4')],check=True)
captions = []
for i, cap in enumerate(scene['captions']):
    start = cap['start_frame']/24
    end = min(10, cap['end_frame']/24)
    if start >= 10:
        continue
    captions.append(f'<div id="caption-{i}" class="clip caption" data-start="{start:.5f}" data-duration="{end-start:.5f}" data-track-index="3"><p>{html.escape(cap["text"])}</p></div>')
document = '''<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ma Kết — Vox style animation — 10s</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#f3f0e7}
#main{position:relative;width:1080px;height:1920px;color:#222;font-family:Arial,sans-serif}
.clip{position:absolute;inset:0}.paper{position:absolute;inset:0;background:#f3f0e7}
.mast{position:absolute;left:120px;top:175px;width:840px;border-bottom:3px solid #222;padding-bottom:18px;display:flex;justify-content:space-between;font-size:28px;font-weight:700;letter-spacing:2px}
.mast strong{background:#f4ce29;padding:6px 12px}
.head{position:absolute;left:120px;top:310px;width:840px}
.head h1{font-size:94px;line-height:1.02;letter-spacing:-4px;margin:0;font-weight:900}
.head p{font-size:44px;line-height:1.2;margin:24px 0 0}
.marker{background:#f4ce29;display:inline-block;padding:5px 12px}
#intro,#surplus,#tasks,#help,#quote,#warm{position:absolute;left:0;top:0;width:840px}
#surplus h1{font-size:110px;line-height:1.05}
.receipt{background:#fffdf8;border:2px solid #222;padding:28px 32px;margin:0 0 22px;box-shadow:9px 9px 0 #222;font-size:42px;line-height:1.25}
.receipt strong{display:block;font-size:32px;letter-spacing:2px;margin-bottom:12px}
#quote h1{font-size:112px;line-height:1.1;background:#f4ce29;padding:28px 35px}
#warm h1{font-size:82px;line-height:1.1}
#stage{position:absolute;top:650px;left:0;width:1080px;height:800px}
.actor{position:absolute;width:500px;height:730px;object-fit:contain;top:0}
.cap{left:15px}.partner{left:560px}#partner-reach{transform:scaleX(-1)}#bag{position:absolute;left:450px;top:350px;width:190px;height:280px;object-fit:contain;z-index:4}
.label{position:absolute;top:670px;font-size:32px;letter-spacing:2px;font-weight:bold;background:#fffdf8;border:2px solid #222;padding:8px 16px}
#cap-label{left:175px}#partner-label{left:745px}
#ring{position:absolute;left:620px;top:135px;width:340px;height:360px;overflow:visible;z-index:5}
#ring path{stroke:#d24a36;stroke-width:5;fill:none;stroke-linecap:round}
.caption{inset:1500px auto auto 120px;width:840px;height:230px;display:flex;align-items:center;justify-content:center;text-align:center}
.caption p{margin:0;font-size:49px;line-height:1.28;font-weight:700;background:#fffdf8;padding:20px 26px;border-top:5px solid #f4ce29}
.footer{position:absolute;left:120px;top:1780px;font-size:28px;color:#555}
</style></head><body>
<div id="main" data-composition-id="main" data-start="0" data-duration="10" data-width="1080" data-height="1920">
<div class="paper"></div>
<div id="graphics" class="clip" data-start="0" data-duration="10" data-track-index="0">
<div class="mast"><span>MA KẾT / NGƯỜI THỪA</span><strong>VOX STYLE ANIMATION</strong></div>
<div class="head">
<div id="intro"><h1>CHĂM BẠN</h1><p>đến mức…</p></div>
<div id="surplus"><p>bạn bắt đầu thấy mình thành</p><h1><span class="marker">NGƯỜI THỪA.</span></h1></div>
<div id="tasks"><div id="route" class="receipt"><strong>ĐI CHƠI</strong>Họ đã <b>xem đường.</b></div><div id="table" class="receipt"><strong>CHỌN CHỖ ĂN</strong>Họ đã <b>đặt bàn.</b></div></div>
<div id="help"><p>Bạn vừa đưa tay</p><h1><span style="display:block">xách giúp</span>cái túi…</h1></div>
<div id="quote"><h1><span style="display:block">“THÔI,</span>ĐỂ TÔI.”</h1></div>
<div id="warm"><h1><span style="display:block">Mới đầu nghe</span>cũng <span class="marker">ấm áp</span> thật.</h1></div>
</div>
<div id="stage">
<img id="cap-neutral" class="actor cap" src="assets/capricorn-neutral.svg" alt="Ma Kết — nhân vật từ gói gốc">
<img id="cap-stop" class="actor cap" src="assets/capricorn-stop.svg" alt="Ma Kết ngăn lại — pose gốc">
<img id="partner-neutral" class="actor partner" src="assets/partner-neutral.svg" alt="Người bạn — nhân vật từ gói gốc">
<img id="partner-reach" class="actor partner" src="assets/partner-reach.svg" alt="Người bạn đưa tay — pose gốc">
<img id="bag" src="assets/capricorn-shopping-bag.svg" alt="Túi xách từ gói gốc">
<svg id="ring" viewBox="0 0 100 100" aria-hidden="true"><path d="M22 7 C58 1 95 8 97 48 C99 81 74 98 44 97 C16 96 2 79 3 49 C4 20 22 4 52 4.5" /></svg>
<span id="cap-label" class="label">MA KẾT</span><span id="partner-label" class="label">BẠN</span>
</div>
<div class="footer">BẢN THỬ PHONG CÁCH · NỘI DUNG VÀ VOICE GỐC</div>
</div>
CAPTIONS
<audio id="original-audio" src="assets/source-audio.wav" data-start="0" data-duration="10" data-track-index="4"></audio>
</div>
<script>
const tl=gsap.timeline({paused:true});
gsap.set('#surplus,#tasks,#help,#quote,#warm,#cap-stop,#partner-reach',{opacity:0});
gsap.set(['#surplus','#tasks','#help','#quote','#warm','#cap-stop','#partner-reach'],{opacity:0});
tl.fromTo('#intro',{opacity:0,y:24},{opacity:1,y:0,duration:.35,ease:'power4.out'},0);
tl.fromTo('#stage',{y:70,opacity:0},{y:0,opacity:1,duration:.55,ease:'power4.out'},0);
tl.to('#intro',{opacity:0,duration:.12},1.48);
tl.fromTo('#surplus',{opacity:0,scale:1.08},{opacity:1,scale:1,duration:.25,ease:'power3.out',transformOrigin:'0% 0%'},1.54);
tl.to('#stage',{scale:1.07,x:-20,duration:.35,ease:'power2.inOut',transformOrigin:'50% 55%'},1.6);
const ink=document.querySelector('#ring path'),length=ink.getTotalLength();
gsap.set(ink,{strokeDasharray:length,strokeDashoffset:length,opacity:0});
tl.set(ink,{opacity:1},2.15);
tl.fromTo(ink,{strokeDashoffset:length},{strokeDashoffset:0,duration:.6,ease:'power2.inOut'},2.15);
tl.to('#surplus',{opacity:0,duration:.12},2.96);
tl.set('#tasks',{opacity:1},3.04);
tl.fromTo('#route',{x:-80,opacity:0,rotation:-3},{x:0,opacity:1,rotation:-1,duration:.42,ease:'power4.out'},3.04);
tl.fromTo('#table',{x:80,opacity:0,rotation:3},{x:0,opacity:1,rotation:1,duration:.42,ease:'power4.out'},4.44);
tl.to('#ring',{opacity:0,duration:.15},3.04);
tl.to('#stage',{scale:1,x:0,duration:.4,ease:'power2.inOut'},3.04);
tl.to('#tasks',{opacity:0,duration:.12},5.78);
tl.fromTo('#help',{opacity:0,x:-50},{opacity:1,x:0,duration:.35,ease:'power4.out'},5.9);
tl.set('#partner-neutral',{opacity:0},142/24);tl.set('#partner-reach',{opacity:1},142/24);
tl.to('#bag',{x:20,rotation:4,duration:.38,ease:'power2.inOut'},6.5);
tl.to('#help',{opacity:0,duration:.1},7.82);
tl.fromTo('#quote',{opacity:0,scale:1.12,rotation:-2},{opacity:1,scale:1,rotation:0,duration:.22,ease:'power4.out',transformOrigin:'50% 50%'},7.9);
tl.set('#cap-neutral',{opacity:0},190/24);tl.set('#cap-stop',{opacity:1},190/24);
tl.to('#bag',{x:-100,y:10,rotation:-8,duration:.3,ease:'power3.out'},190/24);
tl.to('#stage',{scale:1.08,x:20,duration:.22,ease:'power3.out'},7.9);
tl.to('#quote',{opacity:0,duration:.12},8.7);
tl.fromTo('#warm',{opacity:0,y:18},{opacity:1,y:0,duration:.3,ease:'power3.out'},8.8);
window.__timelines=window.__timelines||{};window.__timelines.main=tl;
</script></body></html>'''.replace('CAPTIONS','\n'.join(captions))
assert len(captions) == 6 and 'Bạch Dương' not in document
assert all(x['text'] in (SOURCE/'narration.txt').read_text(encoding='utf-8').replace('\n',' ') for x in scene['captions'][:4])
(ROOT/'index.html').write_text(document,encoding='utf-8')
ledger={'source_package':'zodiac-maket-nguoi-thua.zip','source_workspace':str(SOURCE),'source_video_sha256':hashlib.sha256((SOURCE/'out/zodiac-story.mp4').read_bytes()).hexdigest(),'source_range_seconds':[0,10],'audio':'unaltered first 10 seconds of original MP4 audio; PCM decode only','captions':'original S01 render plan, original 24fps anchors','assets':names+['capricorn-shopping-bag.svg'],'approval':'demo only; no production approval'}
(ROOT/'source-ledger.json').write_text(json.dumps(ledger,ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'hyperframes.json').write_text(json.dumps({'$schema':'https://hyperframes.heygen.com/schema/hyperframes.json','authoringSkill':'hyperframes'},indent=2),encoding='utf-8')
