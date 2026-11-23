"""Animate only existing Ma Ket artwork, captions and audio in an isolated demo."""
from pathlib import Path
import hashlib
import html
import json
import shutil
import subprocess

ROOT = Path(__file__).parent
SOURCE = Path(r'E:\projects\project-zodiac-video\.zodiac-work\v2\jobs\maket-nguoi-thua')
plan = json.loads((SOURCE / '.runtime/render-plan.json').read_text(encoding='utf-8'))
design = json.loads((SOURCE / 'design-token.json').read_text(encoding='utf-8'))
assets = ['characters/capricorn-neutral.svg', 'characters/partner-neutral.svg',
          'characters/partner-reach.svg', 'characters/partner-sidelined.svg',
          'characters/partner-giveup.svg', 'props/capricorn-shopping-bag.svg',
          'environment/capricorn-s01-accent.svg']
ledger = {}
for name in assets:
    origin = SOURCE / 'assets' / name
    target = ROOT / 'assets' / origin.name
    shutil.copyfile(origin, target)
    ledger[name] = hashlib.sha256(origin.read_bytes()).hexdigest()
    assert target.read_bytes() == origin.read_bytes()
font = ROOT.parents[1] / 'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf'
shutil.copyfile(font, ROOT / 'assets/PatrickHand-Regular.ttf')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(SOURCE / 'out/zodiac-story.mp4'), '-t', '10', '-vn', '-c:a', 'pcm_s16le', str(ROOT / 'assets/original-audio.wav')], check=True)

captions = []
highlight = []
original_words = []
for index, caption in enumerate(plan['scenes'][0]['captions']):
    words = caption['words']
    original_words.extend(w['text'] for w in words)
    # Same source words and anchors; split the long cue at its existing clause boundary.
    groups = [words[:8], words[8:]] if index == 4 else [words]
    for group_index, group in enumerate(groups):
        start = group[0]['start_frame'] / 24
        end = min(10, group[-1]['end_frame'] / 24)
        chunks = []
        for word_index, word in enumerate(group):
            key = f'w-{index}-{group_index}-{word_index}'
            chunks.append(f'<span id="{key}">{html.escape(word["text"])}</span>')
            highlight.append(f"tl.set('#{key}',{{color:'#E97A66'}},{word['start_frame']/24:.5f});tl.set('#{key}',{{color:'#2F3C44'}},{min(10,word['end_frame']/24):.5f});")
        captions.append(f'<div id="caption-{index}-{group_index}" class="clip caption" data-start="{start:.5f}" data-duration="{end-start:.5f}" data-track-index="2"><p>{" ".join(chunks)}</p></div>')

scene = '''<!doctype html><html lang="vi"><body><template>
<style>
@font-face{font-family:PatrickHand;src:url('assets/PatrickHand-Regular.ttf')}
*{box-sizing:border-box}#root{position:absolute;inset:0;color:#2F3C44;font-family:PatrickHand,cursive}
.clip{position:absolute;inset:0}#paper{position:absolute;inset:0;background:#F6F0E6}
#camera{position:absolute;inset:0;transform-origin:540px 900px}
#awning{position:absolute;left:70px;top:100px;width:900px;height:420px}
.actor{position:absolute;top:500px;width:470px;height:686.923px}
#cap{left:80px;z-index:3}#partner{position:absolute;left:570px;top:500px;width:470px;height:686.923px;z-index:3}
#partner .actor{inset:0}.pose{position:absolute;width:470px;height:686.923px}
#reach{transform:scaleX(-1)}
#bag{position:absolute;left:378.3px;top:986.2px;width:150px;height:217.969px;z-index:2}
.caption{inset:1460px auto auto 80px;width:920px;height:260px;display:flex;align-items:center;justify-content:center}
.caption p{font-size:56px;line-height:1.2;font-weight:400;margin:0;text-align:center;text-wrap:balance}
.brand{position:absolute;left:68px;top:40px;font-size:29px;opacity:.45}
</style>
<div id="root" data-composition-id="acting" data-duration="10">
<div id="paper"></div>
<div id="art" class="clip" data-start="0" data-duration="10" data-track-index="0">
<div id="camera">
<img id="awning" src="assets/capricorn-s01-accent.svg" alt="Bối cảnh gốc">
<img id="cap" class="actor" src="assets/capricorn-neutral.svg" alt="Ma Kết, pose gốc">
<img id="bag" src="assets/capricorn-shopping-bag.svg" alt="Chiếc túi gốc">
<div id="partner">
<img id="neutral" class="pose" src="assets/partner-neutral.svg" alt="Người bạn">
<img id="reach" class="pose" src="assets/partner-reach.svg" alt="Người bạn đưa tay">
<img id="sidelined" class="pose" src="assets/partner-sidelined.svg" alt="Người bạn hụt hẫng">
<img id="giveup" class="pose" src="assets/partner-giveup.svg" alt="Người bạn buông tay">
</div></div></div>
<span class="brand">BRAND</span>
CAPTIONS
</div>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<script>
const tl=gsap.timeline({paused:true});
gsap.set('#reach,#sidelined,#giveup',{opacity:0});
// Existing hand (413,608) and bag handle (160,30) coincide within 2px.
tl.to('#camera',{scale:1.12,x:-28,y:15,duration:.4,ease:'power2.inOut'},1.54);
tl.set('#neutral',{opacity:0},2.36);tl.set('#sidelined',{opacity:1},2.36);
tl.to('#partner',{rotation:2,transformOrigin:'50% 100%',duration:.18,ease:'power2.out'},2.36);
tl.to('#camera',{scale:1,x:0,y:0,duration:.4,ease:'power2.inOut'},3.04);
tl.set('#sidelined',{opacity:0},3.04);tl.set('#neutral',{opacity:1},3.04);
tl.to('#partner',{rotation:0,duration:.2},3.04);
tl.to('#camera',{scale:1.16,x:0,y:-20,duration:.45,ease:'power2.inOut'},5.9);
tl.set('#neutral',{opacity:0},5.9);tl.set('#reach',{opacity:1},5.9);
tl.to('#partner',{x:-98,rotation:-19,transformOrigin:'50% 100%',duration:.6,ease:'power2.inOut'},5.9);
// Pull actor and held bag together to preserve hand-to-handle contact.
tl.to(['#cap','#bag'],{x:-70,duration:.28,ease:'power3.out'},7.9);
tl.to('#partner',{x:-80,rotation:-12,duration:.12,ease:'power2.out'},7.97);
tl.set('#reach',{opacity:0},8.3);tl.set('#giveup',{opacity:1},8.3);
tl.to('#partner',{x:-40,y:9,rotation:2,transformOrigin:'50% 100%',duration:.3,ease:'power2.out'},8.3);
tl.to('#camera',{scale:1.1,x:-15,y:5,duration:.4,ease:'power2.inOut'},8.74);
HIGHLIGHT
window.__timelines=window.__timelines||{};window.__timelines.acting=tl;
</script></template></body></html>'''
scene = scene.replace('CAPTIONS', '\n'.join(captions)).replace('HIGHLIGHT', '\n'.join(highlight)).replace('BRAND', html.escape(design['brand_overlay']['text']))
(ROOT / 'compositions/acting.html').write_text(scene, encoding='utf-8')
(ROOT / 'index.html').write_text('''<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Ma Kết — thử diễn xuất 10s</title><style>html,body{margin:0;width:1080px;height:1920px;overflow:hidden}#main{position:relative;width:1080px;height:1920px}</style></head><body><div id="main" data-composition-id="main" data-start="0" data-duration="10" data-width="1080" data-height="1920"><div id="acting" class="clip" data-composition-id="acting" data-composition-src="compositions/acting.html" data-start="0" data-duration="10" data-width="1080" data-height="1920" data-track-index="0" data-track-kind="graphics"></div><audio id="original-audio" src="assets/original-audio.wav" data-start="0" data-duration="10" data-track-index="1"></audio></div><script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script><script>window.__timelines=window.__timelines||{};window.__timelines.main=gsap.timeline({paused:true});</script></body></html>''', encoding='utf-8')
assert len(captions) == 7
assert 'NGƯỜI THỪA' not in scene and '<svg' not in scene and '<h1' not in scene
assert set(p.name for p in (ROOT/'assets').glob('*.svg')) == {Path(p).name for p in assets}
hand = (80+413*470/520,500+608*470/520)
handle = (378.3+160*150/320,986.2+135*150/320)
assert sum((a-b)**2 for a,b in zip(hand,handle)) < 4
assert max(abs(a-b) for a,b in zip(hand,handle)) < 2, (hand,handle)
(ROOT/'source-ledger.json').write_text(json.dumps({'source_workspace':str(SOURCE),'range_seconds':[0,10],'source_assets_sha256':ledger,'original_caption_words':original_words,'added_visual_assets':[],'added_text':[],'hand_to_handle_error_px':[a-b for a,b in zip(hand,handle)],'source_mp4_sha256':hashlib.sha256((SOURCE/'out/zodiac-story.mp4').read_bytes()).hexdigest()},ensure_ascii=False,indent=2),encoding='utf-8')
(ROOT/'hyperframes.json').write_text('{"authoringSkill":"hyperframes"}',encoding='utf-8')
