"""Bake optional meme lettering to portable Patrick Hand SVG paths. Runtime needs no font tools."""
from pathlib import Path
import html
import json
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

repo = Path(__file__).resolve().parents[2]
library = repo / 'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4'
font = TTFont(repo / 'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf')
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
scale = 84 / font['head'].unitsPerEm
registry = json.loads((library / 'memes/index.json').read_text(encoding='utf-8'))
labels = [m for m in registry['compositions'] if m.get('text_label')]
assert labels, 'No meme labels selected'
for meme in labels:
    text = meme['text_label']['text']
    assert text and '\n' not in text and all(ord(c) in cmap for c in text), 'Label requires supported single-line glyphs'
    if meme['text_label'].get('lines'):
        lines = meme['text_label']['lines']
        assert 1 <= len(lines) <= 2 and all(line.strip() for line in lines) and ' '.join(lines) == text, 'Authored lines must preserve the exact meme wording'
    elif len(text) > 20:
        words = text.split()
        split = min(range(1, len(words)), key=lambda i: abs(len(' '.join(words[:i])) - len(' '.join(words[i:]))))
        lines = [' '.join(words[:split]), ' '.join(words[split:])]
    else:
        lines = [text]
    paths, x = [], 22.0
    width = max(240, max(sum(glyphs[cmap[ord(c)]].width * scale for c in line) for line in lines) + 44)
    for row, line in enumerate(lines):
        x = 22.0 if len(lines) == 1 else (width - sum(glyphs[cmap[ord(c)]].width * scale for c in line)) / 2
        for char in line:
            glyph = glyphs[cmap[ord(char)]]
            pen = SVGPathPen(glyphs, ntos=lambda n: str(round(n, 2)))
            glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 103 + row * 100)))
            if pen.getCommands():
                color = '#E97A66' if row else '#2F3C44'
                paths.append(f'<path d="{pen.getCommands()}" fill="{color}"/>')
            x += glyph.width * scale
    width = round(width, 2)
    height = 140 + (len(lines) - 1) * 100
    rel = next(r['source_path'] for r in meme['asset_requirements'] if r['role'] == 'label')
    target = (library / 'memes' / rel).resolve()
    assert target.is_relative_to(library / 'props'), 'Label target must stay in props'
    underline = f'<path d="M24 {height - 18} Q{width * .48:.2f} {height - 24} {width - 24} {height - 17}" fill="none" stroke="#E97A66" stroke-width="5" stroke-linecap="round"/>'
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{html.escape(text, quote=True)}"><title>{html.escape(text)}</title><metadata>asset_role=meme_label;style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;lettering=PatrickHand-outlined;production_safe=true</metadata>{"".join(paths)}{underline}</svg>\n'
    assert '<text' not in svg and '<image' not in svg and paths
    target.write_text(svg, encoding='utf-8', newline='\n')
print(f'Baked {len(labels)} optional labels as native paths')
