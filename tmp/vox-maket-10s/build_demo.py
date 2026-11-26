"""A/B variant: same existing Ma Ket artwork/acting, different editorial camera."""
from pathlib import Path
import hashlib
import json
import re
import shutil

ROOT = Path(__file__).parent
BASE = ROOT.parent / 'maket-acting-10s'
ledger = json.loads((BASE / 'source-ledger.json').read_text(encoding='utf-8'))
scene = (BASE / 'compositions/acting.html').read_text(encoding='utf-8')
original_text = re.findall(r'>([^<>]+)<', scene.split('<script')[0])
scene, removed = re.subn(r"^tl\.to\('#camera'.*\n", '', scene, flags=re.M)
assert removed == 4
camera = '''
// Cut framing on the original voice anchors; no extra visual elements.
tl.set('#camera',{scale:1.08,x:0,y:0},0);
tl.to('#camera',{scale:1.12,duration:1.3,ease:'none'},0);
tl.set('#camera',{scale:1.65,x:-377,y:65},1.54);
tl.to('#camera',{scale:1.72,x:-395,duration:1.35,ease:'none'},1.54);
tl.set('#camera',{scale:1.04,x:0,y:0},3.04);
tl.to('#camera',{scale:1.08,duration:1.25,ease:'none'},3.04);
tl.set('#camera',{scale:1.18,x:0,y:-55},4.44);
tl.to('#camera',{scale:1.22,duration:1.2,ease:'none'},4.44);
tl.set('#camera',{scale:1.6,x:144,y:-240},5.9);
tl.to('#camera',{scale:1.66,x:155,y:-250,duration:1.8,ease:'none'},5.9);
tl.set('#camera',{scale:1.8,x:422,y:116},7.9);
tl.set('#camera',{scale:1.48,x:-170,y:-20},8.74);
tl.to('#camera',{scale:1.52,x:-180,duration:1.2,ease:'none'},8.74);
'''
scene = scene.replace('window.__timelines=window.__timelines||{};', camera + '\nwindow.__timelines=window.__timelines||{};')
assert re.findall(r'>([^<>]+)<', scene.split('<script')[0]) == original_text
for name in ['assets', 'compositions']:
    (ROOT / name).mkdir(exist_ok=True)
for origin in (BASE / 'assets').iterdir():
    if origin.is_file():
        shutil.copyfile(origin, ROOT / 'assets' / origin.name)
(ROOT / 'compositions/acting.html').write_text(scene, encoding='utf-8')
index = (BASE / 'index.html').read_text(encoding='utf-8').replace('Ma Kết — thử diễn xuất 10s', 'Ma Kết — Vox sửa 10s')
(ROOT / 'index.html').write_text(index, encoding='utf-8')
ledger['comparison_baseline'] = str(BASE)
ledger['difference'] = 'editorial camera cuts and slow pushes only; same acting, caption words, audio and assets'
ledger['audio_sha256'] = hashlib.sha256((ROOT / 'assets/original-audio.wav').read_bytes()).hexdigest()
(ROOT / 'source-ledger.json').write_text(json.dumps(ledger, ensure_ascii=False, indent=2), encoding='utf-8')
(ROOT / 'hyperframes.json').write_text('{"authoringSkill":"hyperframes"}', encoding='utf-8')
