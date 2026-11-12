"""Outline authored story lettering; runtime only loads portable SVGs."""
import argparse
import html
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
parser.add_argument('--intent', type=Path)
args = parser.parse_args()
root = args.workspace.resolve()
intent = json.loads((args.intent or root / '.authoring/visual-intent.json').read_text(encoding='utf-8'))
font = TTFont(Path(__file__).resolve().parents[2] / 'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf')
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
styles = {'note', 'stamp', 'score', 'title'}

def line(text, size, center, baseline, max_width, color='#2F3C44'):
    units = sum(glyphs[cmap[ord(c)]].width for c in text)
    assert units > 0
    scale = min(size / font['head'].unitsPerEm, max_width / units)
    paths, x = [], center - units * scale / 2
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        pen = SVGPathPen(glyphs, ntos=lambda n: str(round(n, 2)))
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        if pen.getCommands():
            paths.append(f'<path d="{pen.getCommands()}" fill="{color}"/>')
        x += glyph.width * scale
    assert paths
    return ''.join(paths)

def compose(text, style):
    paper = '<path d="M43 45 Q275 33 509 43 L951 35 Q964 143 949 239 L51 247 Q31 145 43 45Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/>'
    if style == 'note':
        return '<g transform="rotate(-1 500 140)">' + paper + '<path d="M410 20 L580 24 L576 61 L414 57Z" fill="#8EC0B9"/><path d="M104 192 Q472 177 886 193 L888 213 Q472 197 103 212Z" fill="#F2C45C"/>' + line(text, 138, 500, 183, 830) + '</g>'
    if style == 'stamp':
        return '<g transform="rotate(-3 500 140)"><path d="M80 60 Q492 40 921 48 L928 223 Q502 242 73 230Z" fill="#E97A66" stroke="#2F3C44" stroke-width="7"/><path d="M97 76 Q489 58 906 65 M92 212 Q493 224 909 207" fill="none" stroke="#2F3C44" stroke-width="4"/>' + line(text, 184, 500, 194, 790) + '</g>'
    if style == 'score':
        label, number = text.rsplit(':', 1)
        assert number.strip().isdigit(), 'Score lettering needs a numeric payoff'
        return paper + '<path d="M689 50 Q793 35 924 52 L931 228 Q800 242 685 224Z" fill="#F2C45C"/>' + line(label + ':', 111, 349, 173, 548) + line(number.strip(), 240, 804, 225, 205)
    words = text.split()
    assert len(words) >= 3, 'Title lettering needs a setup and emphasis line'
    return paper + line(' '.join(words[:-2]), 98, 500, 117, 840) + line(' '.join(words[-2:]), 154, 500, 226, 850, '#E97A66')

count = 0
lettering_by_path = {}
art_by_path = {}
for scene in intent['scenes']:
    for entity in scene['entities']:
        for state_id, text in entity.get('story_text', {}).get('states', {}).items():
            target = (root / intent['assets'][entity['states'][state_id]['asset']]['path']).resolve()
            assert target.is_relative_to(root / 'assets'), 'Lettering must stay inside assets/'
            style = entity['story_text'].get('styles', {}).get(state_id, 'note')
            assert style in styles, 'Unknown story text style'
            assert text.strip() and '\n' not in text and all(ord(c) in cmap for c in text)
            signature = (text, style)
            assert target not in lettering_by_path or lettering_by_path[target] == signature, 'Conflicting story text for one asset path'
            lettering_by_path[target] = signature
            art_by_path[target] = compose(text, style)
for scene in intent['scenes']:
    for entity in scene['entities']:
        for state_id, text in entity.get('story_text', {}).get('states', {}).items():
            assert text.strip() and '\n' not in text and all(ord(c) in cmap for c in text)
            asset = intent['assets'][entity['states'][state_id]['asset']]
            assert asset['category'] == 'overlay' and entity['visual_role'] == 'overlay'
            target = (root / asset['path']).resolve()
            assert target.is_relative_to(root / 'assets'), 'Lettering must stay inside assets/'
            style = entity['story_text'].get('styles', {}).get(state_id, 'note')
            art = art_by_path[target]
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 280" role="img" aria-label="{html.escape(text, quote=True)}"><title>{html.escape(text)}</title><metadata>asset_role=story_text;style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;lettering=PatrickHand-outlined;treatment={style};production_safe=true</metadata>{art}</svg>\n'
            assert '<text' not in svg and '<image' not in svg
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(svg, encoding='utf-8', newline='\n')
            count += 1
assert count, 'No story_text states authored'
print(f'Outlined {count} story text states')
