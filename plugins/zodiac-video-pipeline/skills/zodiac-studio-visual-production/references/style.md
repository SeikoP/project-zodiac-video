# Channel style (hard lock)

Token `zodiac-paper-doodle-meme-v4`, style family `paper-doodle-chibi-meme`, handmade profile `human-stroke-v2`. Every production asset's `style_id` equals the token id. The test: if the ink were black only, would the drawing still look hand-made?

## Look
Warm paper, visibly hand-drawn lines, compact chibi figures with varied silhouettes, low-detail props, sparse reaction marks, controlled imperfection. Whole characters get a warm-white sticker edge (6–12 px at 1080) beneath the ink. Use the full canvas; no content card; never show Beat/Scene/Step labels.

## Palette (canonical only)
`#F6F0E6` paper · `#FFFDF9` card · `#2F3C44` ink · `#5C6B75` soft ink · `#4B5B61` hair ink · `#F1C6A0` skin · `#D0C1B3` soft shadow · `#8EC0B9` teal · `#E97A66` coral · `#F2C45C` ochre · `#435064` slate. Flat fills; no gradients, filters, neon, gloss, photoreal shading, purple-AI looks, emoji sheets.

## Handmade rules for props/effects/accents
Path-first hero contours (not dominant perfect rect/circle/ellipse); parallel edges drift; round things slightly egg-shaped; 1–4 % edge misalignment; small ±0.5–2.5° rotations; paired curves never mirror exactly; 1–2 visible imperfections per focal object; source stroke 4–9 px, rounded joins; **no `<text>` inside reusable SVGs**; no SVG turbulence or random jitter. Legacy or perfect geometry is source material only.

## Caption and brand overlay (runtime-owned, never baked into art)
Font stack `"Patrick Hand", "Segoe Print", cursive`; default 56 px (52–60), minimum 48, weight 400, at most two lines, balanced wrap. Pagination is semantic (a full sentence or a natural clause), never fixed word slices. Highlight color is coral; keep contrast readable. Brand overlay `✦ bungmoto` top-left (offset 68, 40), opacity 0.45.

## Identity rule
Identity = body profile + hair silhouette + outfit cue + shirt color. Pose, expression and crop are state only. Body variation is authored geometry, never scaling.
