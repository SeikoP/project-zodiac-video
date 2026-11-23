"""Assemble a local style audition from the installed HyperFrames components."""
from pathlib import Path
import re

root = Path(__file__).parent
vox = root / 'compositions/components/vox-annotate.html'
source = vox.read_text(encoding='utf-8')
# Dark callout ink keeps the yellow marker readable on paper.
source = source.replace('noteEl.style.color = accentColors[accent];', 'noteEl.style.color = "#242424";')
source = source.replace('connPath.style.stroke = accentColors[accent];', 'connPath.style.stroke = "#242424";')
source = source.replace('data-duration="4"', 'data-duration="10"').replace('data-composition-duration="4"', 'data-composition-duration="10"')
source = source.replace('font-size: min(2.4cqw, 4.4cqh);', 'font-size: 30px;')
vox.write_text(source, encoding='utf-8')
chart = (root / 'compositions/components/animated-bar-chart.html').read_text(encoding='utf-8')
chart_css = re.search(r'<style>(.*?)</style>', chart, re.S).group(1)
html = '''<!doctype html>
<html lang="vi"><head><meta charset="utf-8"><title>Vox style — 10 giây</title>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>
CHART_CSS
*{box-sizing:border-box}html,body{margin:0;width:1080px;height:1920px;overflow:hidden;background:#f3f0e7}
:root{--bg:#f3f0e7;--fg:#242424;--brand:#f4ce29;--font-display:Arial,sans-serif}
#main{width:1080px;height:1920px;font-family:Arial,sans-serif;color:#242424;position:relative;background:#f3f0e7}
.clip{position:absolute;inset:0}.paper{position:absolute;inset:0;background-image:radial-gradient(#24242414 .8px,transparent .8px);background-size:7px 7px;pointer-events:none}
.masthead{position:absolute;left:108px;right:108px;top:130px;display:flex;justify-content:space-between;border-bottom:3px solid #242424;padding-bottom:24px;font-size:25px;font-weight:700;letter-spacing:3px}
.tag{background:#f4ce29;padding:9px 15px;letter-spacing:1px}
.question{position:absolute;left:108px;top:245px;font-size:32px;letter-spacing:2px;font-weight:700;margin:0}
#vox-slot{position:absolute;top:320px;left:0;width:1080px;height:660px}
.chart{position:absolute;left:130px;top:980px;width:820px;background:transparent;box-shadow:none;padding:0;border-radius:0;min-height:0;gap:18px}
.chart h3{font-size:37px;letter-spacing:-1px;margin:0}.chart p{font-size:26px;margin:14px 0 0;color:#555}
.chart .bars{height:270px;grid-template-columns:1fr 1fr;gap:65px;border-bottom:3px solid #242424;padding:0 70px}
.chart .bar{display:block;border-radius:0;background:#242424}.chart .bar:last-child{background:#f4ce29}
.labels{display:flex;justify-content:space-around;font-size:35px;font-weight:bold}
.payoff{position:absolute;left:108px;top:1510px;width:864px;border-top:3px solid #242424;padding-top:35px}
.payoff h2{font-size:64px;line-height:1.12;letter-spacing:-2px;margin:0}.payoff p{font-size:27px;line-height:1.5;margin:22px 0 0;color:#555}
.footer{position:absolute;left:108px;top:1775px;font-size:22px;letter-spacing:1px;color:#555}
.masthead,.chart p,.payoff p,.footer{font-size:28px}
</style></head><body>
<div id="main" data-composition-id="main" data-start="0" data-duration="10" data-width="1080" data-height="1920">
<div class="paper" data-layout-ignore></div>
<div id="graphics" class="clip" data-start="0" data-duration="10" data-track-index="0">
<div class="masthead"><span>ZODIAC / MOTION STUDY</span><span class="tag">10 GIÂY</span></div>
<p class="question">AI BẤM NÚT ĐẦU TIÊN?</p>
<div class="hf-catalog-animated-bar-chart chart">
<header><div><h3>Khi cả nhóm còn đang nghĩ…</h3><p>Biểu đồ minh họa tính cách • không phải số liệu</p></div></header>
<div class="bars"><span class="bar" style="--h:32%"></span><span class="bar" style="--h:95%"></span></div>
<div class="labels"><span>NGHĨ</span><span>LÀM</span></div>
</div>
<div class="payoff"><h2>Bạch Dương đã làm rồi.</h2><p>Chữ lớn · nét bút · chú thích · biểu đồ · punch-in</p></div>
<div class="footer">VOX-INSPIRED / DEMO HIỆU ỨNG</div>
</div>
<div id="vox-slot" class="clip" data-composition-id="vox-annotate" data-composition-src="compositions/components/vox-annotate.html" data-start="0" data-duration="10" data-track-index="1" data-width="1080" data-height="660" data-variable-values='{"text":"Bạch Dương đi trước.","keyword":"Bạch Dương","note":"HÀNH ĐỘNG TRƯỚC","style":"highlight","draw_at":1.1,"accent":"green","exit":"none"}'></div>
</div>
<script>
const tl=gsap.timeline({paused:true});
tl.fromTo('.masthead',{opacity:0,y:20},{opacity:1,y:0,duration:.35},0);
tl.fromTo('.question',{opacity:0,y:24},{opacity:1,y:0,duration:.45,ease:'power3.out'},.25);
tl.fromTo('.chart',{opacity:0,y:45},{opacity:1,y:0,duration:.45,ease:'power3.out'},3);
tl.fromTo('.chart',{'--hf-grow':0},{'--hf-grow':1,duration:1.4,ease:'power3.out'},3.4);
tl.fromTo('.labels',{opacity:0},{opacity:1,duration:.3},4);
tl.fromTo('.chart',{scale:1},{scale:1.045,duration:.2,ease:'power3.out',transformOrigin:'50% 50%'},5.9);
tl.to('.chart',{scale:1,duration:.4,ease:'power2.out'},6.4);
tl.fromTo('.payoff',{opacity:0,y:32},{opacity:1,y:0,duration:.5,ease:'power3.out'},7.1);
window.__timelines=window.__timelines||{};window.__timelines.main=tl;
</script></body></html>'''.replace('CHART_CSS',chart_css)
assert 'data-duration="10"' in html and 'vox-annotate.html' in html
assert len(re.findall(r'\sid="main"', html)) == 1
(root / 'index.html').write_text(html, encoding='utf-8')
(root / 'BRIEF.md').write_text('''# Vox style audition
10s, portrait 1080x1920, silent. Requested demo before deciding integration.
Reuses HyperFrames vox-annotate and animated-bar-chart, installed from registry.
Vietnamese fictional Zodiac example; bars are illustrative, not measured data.
No changes to Studio, idea catalog, production pipeline or approvals.
''', encoding='utf-8')
