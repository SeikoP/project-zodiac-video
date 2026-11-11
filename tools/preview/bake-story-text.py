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
scale = 96 / font['head'].unitsPerEm
count = 0
for scene in intent['scenes']:
    for entity in scene['entities']:
        for state_id, text in entity.get('story_text', {}).get('states', {}).items():
            assert text.strip() and '\n' not in text and all(ord(c) in cmap for c in text)
            asset = intent['assets'][entity['states'][state_id]['asset']]
            assert asset['category'] == 'overlay' and entity['visual_role'] == 'overlay'
            target = (root / asset['path']).resolve()
            assert target.is_relative_to(root / 'assets'), 'Lettering must stay inside assets/'
            paths, x = [], 24.0
            for char in text:
                glyph = glyphs[cmap[ord(char)]]
                pen = SVGPathPen(glyphs, ntos=lambda n: str(round(n, 2)))
                glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 112)))
                if pen.getCommands():
                    paths.append(f'<path d="{pen.getCommands()}" fill="#2F3C44"/>')
                x += glyph.width * scale
            width = max(260, round(x + 24, 2))
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 156" role="img" aria-label="{html.escape(text, quote=True)}"><title>{html.escape(text)}</title><metadata>asset_role=story_text;style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;lettering=PatrickHand-outlined;production_safe=true</metadata>{"".join(paths)}<path d="M24 137 Q{width * .48:.2f} 130 {width - 24} 138" fill="none" stroke="#E97A66" stroke-width="5" stroke-linecap="round"/></svg>\n'
            assert paths and '<text' not in svg and '<image' not in svg
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(svg, encoding='utf-8', newline='\n')
            count += 1
assert count, 'No story_text states authored'
print(f'Outlined {count} story text states')
