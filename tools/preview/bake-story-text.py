"""Outline authored story lettering; runtime only loads portable SVGs."""
import argparse
import html
import json
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('workspace', type=Path)
parser.add_argument('--intent', type=Path)
args = parser.parse_args()
root = args.workspace.resolve()
intent = json.loads((args.intent or root / '.authoring/visual-intent.json').read_text(encoding='utf-8'))
font = TTFont(Path(__file__).resolve().parents[2] / 'runtime/zodiac-renderer/2.0.2/renderer/fonts/PatrickHand-Regular.ttf')
glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
compact_styles = {'bubble', 'thought', 'burst', 'whisper', 'tag', 'ribbon', 'underline', 'sfx'}
styles = {'note', 'stamp', 'score', 'title'} | compact_styles

def line(text, size, center, baseline, max_width, color='#2F3C44', *, top=55, bottom=205):
    bounds = BoundsPen(glyphs)
    advance = 0
    for char in text:
        glyph = glyphs[cmap[ord(char)]]
        glyph.draw(TransformPen(bounds, (1, 0, 0, 1, advance, 0)))
        advance += glyph.width
    assert bounds.bounds, 'Lettering requires visible glyphs'
    x_min, y_min, x_max, y_max = bounds.bounds
    scale = min(size / font['head'].unitsPerEm, max_width / (x_max - x_min),
                (bottom - top) / (y_max - y_min))
    # Include actual Vietnamese accent outlines, not only advance width or font size.
    baseline = max(top + y_max * scale, min(baseline, bottom + y_min * scale))
    paths, x = [], center - (x_min + x_max) * scale / 2
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
    if style == 'bubble':
        return '<path d="M36 35 Q285 13 564 34 Q588 118 557 201 L166 206 L109 276 L116 207 L39 202 Q16 115 36 35Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/>' + line(text, 116, 300, 156, 470, top=57, bottom=180)
    if style == 'thought':
        return '<path d="M63 61 Q49 17 125 28 Q171 0 224 27 Q293 0 344 26 Q422 7 454 43 Q535 23 551 75 Q593 114 552 151 Q554 207 483 211 Q432 244 373 216 Q310 244 251 222 Q185 250 139 219 Q60 236 53 184 Q5 148 39 106 Q19 75 63 61Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/><path d="M131 252 Q158 240 168 266 Q171 292 144 291 Q122 283 131 252Z M104 312 Q116 303 127 316 Q129 332 113 335 Q99 329 104 312Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="5"/>' + line(text, 106, 300, 156, 440, top=65, bottom=185)
    if style == 'burst':
        return '<path d="M45 99 L102 93 L91 42 L172 68 L205 15 L266 57 L337 17 L354 74 L451 41 L439 102 L493 134 L452 171 L489 235 L408 229 L401 294 L325 268 L271 330 L230 274 L146 311 L141 251 L46 267 L67 206 L14 170Z" fill="#F2C45C" stroke="#2F3C44" stroke-width="6"/>' + line(text, 144, 260, 213, 350, '#E97A66', top=100, bottom=240)
    if style == 'whisper':
        return '<path d="M36 34 Q285 16 559 35 L553 185 Q300 199 117 188 L87 225 L92 188 L38 183 Q23 113 36 34Z" fill="#FFFDF9" stroke="#5C6B75" stroke-width="4" stroke-dasharray="10 8"/>' + line(text, 97, 300, 142, 460, '#5C6B75', top=55, bottom=165)
    if style == 'tag':
        return '<path d="M33 42 Q259 29 497 40 L570 117 L497 199 Q262 210 36 197Z" fill="#8EC0B9" stroke="#2F3C44" stroke-width="6"/><path d="M516 108 Q532 98 539 113 Q541 130 525 132 Q512 127 516 108Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="4"/>' + line(text, 110, 270, 159, 400, top=60, bottom=175)
    if style == 'ribbon':
        return '<path d="M14 60 L101 63 L100 196 L17 207 L46 132Z M498 64 L589 53 L557 126 L586 196 L498 194Z" fill="#D0C1B3" stroke="#2F3C44" stroke-width="5"/><path d="M79 42 Q299 26 519 43 L515 188 Q298 207 81 190Z" fill="#E97A66" stroke="#2F3C44" stroke-width="6"/>' + line(text, 113, 300, 156, 390, top=60, bottom=172)
    if style == 'underline':
        return line(text, 132, 300, 154, 510, top=30, bottom=155) + '<path d="M46 185 Q291 169 555 187 M83 204 Q297 192 515 205" fill="none" stroke="#E97A66" stroke-width="7" stroke-linecap="round"/>'
    if style == 'sfx':
        return '<g transform="rotate(-7 300 140)">' + line(text, 188, 300, 194, 450, '#E97A66', top=45, bottom=205) + '<path d="M34 64 Q23 43 17 22 M554 56 Q568 33 586 19 M39 216 Q24 224 13 244 M555 214 Q575 223 589 240" fill="none" stroke="#2F3C44" stroke-width="7" stroke-linecap="round"/></g>'
    paper = '<path d="M43 45 Q275 33 509 43 L951 35 Q964 143 949 239 L51 247 Q31 145 43 45Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/>'
    if style == 'note':
        return '<g transform="rotate(-1 500 140)">' + paper + '<path d="M410 20 L580 24 L576 61 L414 57Z" fill="#8EC0B9"/><path d="M104 192 Q472 177 886 193 L888 213 Q472 197 103 212Z" fill="#F2C45C"/>' + line(text, 138, 500, 183, 800, top=75, bottom=180) + '</g>'
    if style == 'stamp':
        return '<g transform="rotate(-3 500 140)"><path d="M80 60 Q492 40 921 48 L928 223 Q502 242 73 230Z" fill="#E97A66" stroke="#2F3C44" stroke-width="7"/><path d="M97 76 Q489 58 906 65 M92 212 Q493 224 909 207" fill="none" stroke="#2F3C44" stroke-width="4"/>' + line(text, 184, 500, 194, 750, top=90, bottom=195) + '</g>'
    if style == 'score':
        label, number = text.rsplit(':', 1)
        assert number.strip().isdigit(), 'Score lettering needs a numeric payoff'
        return paper + '<path d="M689 50 Q793 35 924 52 L931 228 Q800 242 685 224Z" fill="#F2C45C"/>' + line(label + ':', 111, 349, 173, 525, top=65, bottom=210) + line(number.strip(), 240, 804, 225, 185, top=65, bottom=210)
    words = text.split()
    assert len(words) >= 3, 'Title lettering needs a setup and emphasis line'
    title_paper = '<path d="M43 45 Q275 33 509 43 L951 35 Q964 200 949 359 L51 367 Q31 205 43 45Z" fill="#FFFDF9" stroke="#2F3C44" stroke-width="6"/>'
    return title_paper + line(' '.join(words[:-2]), 98, 500, 140, 800, top=65, bottom=150) + line(' '.join(words[-2:]), 154, 500, 310, 800, '#E97A66', top=185, bottom=330)

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
            box = '0 0 1000 400' if style == 'title' else '0 0 520 350' if style == 'burst' else '0 0 600 350' if style == 'thought' else '0 0 600 300' if style in compact_styles else '0 0 1000 280'
            svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{box}" role="img" aria-label="{html.escape(text, quote=True)}"><title>{html.escape(text)}</title><metadata>asset_role=story_text;style=zodiac-paper-doodle-meme-v4;handmade=human-stroke-v2;lettering=PatrickHand-outlined;treatment={style};production_safe=true</metadata>{art}</svg>\n'
            assert '<text' not in svg and '<image' not in svg
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(svg, encoding='utf-8', newline='\n')
            count += 1
assert count, 'No story_text states authored'
print(f'Outlined {count} story text states')
