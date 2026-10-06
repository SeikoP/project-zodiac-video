# Zodiac Video Channel Design — Paper Doodle Chibi Meme

Version: 3.1  
Token ID: `zodiac-paper-doodle-meme-v3`  
Style family: `paper-doodle-chibi-meme`  
Status: **HARD STYLE LOCK**

## Core identity
Warm paper, controlled hand-drawn asymmetry, compact chibi characters, stable unusual hair silhouettes, simple props and restrained meme reactions.

## Composition
Use the full 1080×1920 canvas for the story. There is no dedicated content card and no reserved subtitle panel. Do not shrink or clip characters, props, backgrounds, or camera motion to make room for captions.

Captions are a high-z-index overlay. They may overlap the visual canvas, but the renderer chooses among lower/middle overlay positions and minimizes intersection with visible authored state rectangles. A caption must never force the underlying scene into a smaller frame.

## Caption
Canonical subtitle face: **Patrick Hand 400**, loaded locally with its Vietnamese subset. Default 84px, minimum 64px, maximum two lines. Prefer 4–7 words/page with target 6; paginate before shrinking.

The subtitle background stays transparent. Readability comes from a paper-colored halo/stroke and shadow around the glyphs, not a rectangular panel. The overlay envelope is `x=72, y=960, w=936, h=620`; it is placement space, not reserved content space.

## Asset rule
Prefer canonical v3.4 production-safe masters and package-owned semantic derivatives. Character identity is hair-silhouette based. Production SVGs are transparent, label-free and self-contained.

## Compiled VisualStyleToken
<!-- STYLE_TOKEN_BEGIN -->
```json
{
  "id": "zodiac-paper-doodle-meme-v3",
  "version": "3.1",
  "style_family": "paper-doodle-chibi-meme",
  "hard_style_lock": true,
  "palette_roles": {
    "paper": "#F6F0E6",
    "card": "#FFFDF9",
    "ink": "#2F3C44",
    "soft_ink": "#5C6B75",
    "hair_ink": "#4B5B61",
    "skin": "#F1C6A0",
    "sticker_edge": "#FFFDF9",
    "soft_shadow": "#D0C1B3",
    "teal": "#8EC0B9",
    "coral": "#E97A66",
    "ochre": "#F2C45C",
    "slate": "#435064"
  },
  "character_construction": {
    "head_to_body_ratio": [
      1.15,
      1.4
    ],
    "outline_px_at_1080": [
      5,
      8
    ],
    "sticker_edge_px_at_1080": [
      6,
      12
    ],
    "shadow": "short-flat-warm-paper-shadow",
    "hands": "simple-mitten-or-round-hand",
    "eyes": "small-readable-doodle-eyes-no-gloss",
    "body": "compact-soft-asymmetric-paper-doodle",
    "line_language": "slightly-imperfect-hand-drawn-controlled",
    "identity_rule": "choose-one-hair-silhouette-per-character-and-preserve-it-across-all-states",
    "hair_silhouette_catalog": [
      "asym_bang",
      "lopsided_bob",
      "spiky_overthink",
      "antenna_short",
      "blocky_cut"
    ],
    "meme_reactions": [
      "side_eye",
      "deadpan",
      "micro_panic",
      "smug_reframe",
      "mild_annoyed",
      "relieved"
    ]
  },
  "shape_language": {
    "medium": "handmade-paper-doodle-stickers",
    "cards": "slightly-crooked-paper-note-with-soft-corners",
    "connectors": "short-hand-drawn-line-or-arrow",
    "reaction_marks": "one-small-doodle-mark-or-three-dot-bubble",
    "props": "simple-readable-doodle-silhouette-with-controlled-asymmetry",
    "geometry_preference": "rect-ellipse-circle-line-polyline-and-simple-paths",
    "density": "one-focal-interaction-one-hero-prop-one-reaction"
  },
  "caption_emphasis": {
    "font_family": "Patrick Hand",
    "font_weight": 400,
    "font_size_px": 84,
    "min_font_size_px": 64,
    "max_lines": 2,
    "color_role": "ink",
    "highlight_role": "coral",
    "background_role": "sticker_edge",
    "ghost_frame": true
  },
  "safe_zone": {
    "x": 72,
    "y": 960,
    "width": 936,
    "height": 620
  },
  "caption_overlay": {
    "mode": "collision_aware",
    "preferred_anchor": "lower_center",
    "max_visual_overlap_ratio": 0.24,
    "edge_margin_px": 72,
    "paper_halo_px": 18
  },
  "motion_grammar": {
    "sticker_peel": "paper-sticker-entry",
    "paper_nudge": "small-handmade-recoil-or-reaction",
    "card_flip": "paper-note-reveal-or-reframe",
    "state_swap": "voice-anchored-pose-or-meme-reaction-change",
    "route_trace": "hand-drawn-relationship-disclosure",
    "camera_focus": "restrained-focus-shift",
    "freeze_then_release": "hold-deadpan-or-reaction-then-resume"
  },
  "asset_style_contract": {
    "required_visual_cues": [
      "warm-paper-background",
      "controlled-hand-drawn-asymmetry",
      "small-readable-face",
      "stable-weird-hair-silhouette",
      "paper-note-props",
      "limited-flat-palette",
      "sparse-meme-reaction"
    ],
    "forbidden": [
      "noncanonical-style-token",
      "photoreal",
      "glossy-3d",
      "anime-gloss-eyes",
      "clean-corporate-mascot",
      "neon-glow",
      "purple-ai-gradient",
      "emoji-sheet",
      "perfect-geometric-box-body"
    ]
  }
}
```
<!-- STYLE_TOKEN_END -->

Every `production.json.visual_system.style_token.id` and every asset `style_id` must equal `zodiac-paper-doodle-meme-v3`.
