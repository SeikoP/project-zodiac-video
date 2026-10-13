# Zodiac Video Channel Design — Paper Doodle Chibi Meme

Document revision: 4.0  
Token ID: `zodiac-paper-doodle-meme-v4`  
Token version: `4.0`  
Style family: `paper-doodle-chibi-meme`  
Status: **HARD STYLE LOCK**

V4 formalizes the same channel identity for native production. Historical V3 lineage remains in the migration record; its geometry is never copied directly into V4 output.

## Core identity
Warm paper, visibly handmade doodle lines, compact chibi figures with varied silhouettes, low-detail props, sparse reaction marks, and intentional micro-imperfection.

The channel must **not** look like clean vector iconography with doodle colors applied afterward. A useful test is: if the ink were black-only, would the drawing still look hand-made?

Character identity is **body profile + hair silhouette + outfit cue**. Pose, expression, and crop are state only. Body variation is neutral representation, authored as geometry rather than scale transforms.

## Handmade imperfection grammar — hard lock
Imperfection is controlled, not noisy.

For hero contours and reusable props/effects:
- major silhouettes should be path-authored rather than dominated by perfect `<rect>`, `<circle>` or `<ellipse>` primitives; whole characters receive a warm-white sticker edge beneath the ink;
- parallel edges should drift slightly instead of remaining mathematically parallel;
- circles/round objects should be subtly egg-shaped or path-wobbled;
- cards/screens/notebooks should have 1–4% corner/edge misalignment;
- curves may overshoot or flatten slightly; paired curves should not mirror perfectly;
- icon dots/marks may vary in spacing, size, or baseline;
- small rotations around ±0.5°–2.5° are welcome when semantically harmless;
- use one or two visible imperfections per focal object, not random jitter on every point;
- do not use SVG turbulence/filter noise, roughen filters, or generated scribble textures.

Forbidden visual feel:
- perfectly centered circles as the dominant silhouette;
- exact rounded rectangles as the dominant silhouette;
- evenly spaced UI rows/dots that read as app UI;
- mirrored reaction marks;
- perfectly repeated curves;
- mechanically identical stroke endpoints.

## Composition
Use the full 1080×1920 canvas. No content card. Captions overlay the scene. Never expose Beat/Scene/Panel/Step labels or authoring order.

## Caption
Use the exact demo CSS font stack: `"Patrick Hand", "Segoe Print", cursive`. `Patrick Hand` remains the primary family for compatibility; `Segoe Print` and generic `cursive` are explicit runtime fallbacks. Default 84px, preferred 80–90px, minimum 64px, weight 400, max two lines. **Semantic-first pagination only**; prefer a complete spoken sentence when it fits, otherwise split at a natural clause/punctuation boundary. No arbitrary fixed-word slicing.

## Runtime brand overlay
Watermark is runtime-owned, never baked into character/environment assets. Canonical overlay is `✦ bungmoto`, top-left, using the same demo CSS font stack as captions. Keep it below subtitles and above ordinary scene art.

## Prop/effect style lock
Reusable props/effects must look like the same artist drew them as the characters:
- canonical palette only;
- dominant source stroke 4–9px, rounded joins/caps where applicable;
- flat fills and low detail density;
- `handmade=human-stroke-v2` metadata on production non-character SVGs;
- at least one real handmade geometry cue in each production prop/effect: curved/wobbled path, gentle skew/rotation, or intentionally nonparallel contour;
- no photorealistic shading, gradients, SVG filters, glossy UI, neon, corporate iconography or alternate legacy palettes;
- no `<text>` in reusable SVGs;
- legacy/perfect geometry is source material only and must be re-authored into a package-owned derivative.

Canonical palette: `#F6F0E6 #FFFDF9 #2F3C44 #5C6B75 #4B5B61 #F1C6A0 #D0C1B3 #8EC0B9 #E97A66 #F2C45C #435064`

<!-- STYLE_TOKEN_BEGIN -->
```json
{
  "id": "zodiac-paper-doodle-meme-v4",
  "version": "4.0",
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
    "body": "varied-soft-asymmetric-paper-doodle",
    "line_language": "controlled-wobble-hand-drawn",
    "identity_rule": "body_profile + hair silhouette + outfit cue + shirt color; pose, expression, and crop are state only; outfit alone never defines identity",
    "body_profiles": [
      "standard_compact",
      "round_soft",
      "lean_tall",
      "stocky_short",
      "petite_compact",
      "lanky_slouch"
    ],
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
    ],
    "handmade_profile": "human-stroke-v2",
    "body_variation": "authored_geometry_not_scale_transform"
  },
  "shape_language": {
    "medium": "handmade-paper-doodle-stickers",
    "cards": "crooked-paper-note-with-uneven-soft-corners",
    "connectors": "short-wobbled-hand-drawn-line-or-arrow",
    "reaction_marks": "asymmetric-small-doodle-mark-or-uneven-three-dot-bubble",
    "props": "simple-readable-doodle-silhouette-with-visible-controlled-asymmetry",
    "geometry_preference": "path-first-for-hero-contours; primitives-only-for-secondary-parts",
    "density": "one-focal-interaction-one-hero-prop-one-reaction",
    "sticker_edge": "whole-character warm-white paper cutout, 6–12px at 1080px, beneath all character ink"
  },
  "handmade_imperfection": {
    "profile": "human-stroke-v2",
    "hero_contour": "path-first",
    "edge_misalignment_ratio": [
      0.01,
      0.04
    ],
    "micro_rotation_deg": [
      0.5,
      2.5
    ],
    "paired_shape_symmetry": "avoid-perfect-mirroring",
    "dot_spacing": "slightly-irregular",
    "imperfection_budget": "1-2-visible-cues-per-focal-object",
    "forbidden": [
      "perfect-dominant-rounded-rect",
      "perfect-dominant-circle",
      "mechanical-even-spacing",
      "mirrored-reaction-marks",
      "filter-generated-roughness"
    ]
  },
  "caption_emphasis": {
    "font_family": "Patrick Hand",
    "font_stack": [
      "Patrick Hand",
      "Segoe Print",
      "cursive"
    ],
    "css_font_family": "\"Patrick Hand\", \"Segoe Print\", cursive",
    "font_weight": 400,
    "font_size_px": 84,
    "min_font_size_px": 64,
    "max_lines": 2,
    "color_role": "ink",
    "highlight_role": "coral",
    "background_role": "sticker_edge",
    "ghost_frame": true,
    "segmentation": "semantic-sentence-or-natural-clause",
    "fixed_word_target": false,
    "orphan_fragment_policy": "merge-with-neighbor-unless-intentional-emphasis",
    "line_balance": "balanced-two-line-wrap"
  },
  "brand_overlay": {
    "enabled": true,
    "text": "✦ bungmoto",
    "symbol": "✦",
    "brand": "bungmoto",
    "anchor": "top-left",
    "offset_px": {
      "x": 68,
      "y": 40
    },
    "font_family": "Patrick Hand",
    "font_stack": [
      "Patrick Hand",
      "Segoe Print",
      "cursive"
    ],
    "css_font_family": "\"Patrick Hand\", \"Segoe Print\", cursive",
    "font_size_px": 29,
    "font_weight": 800,
    "symbol_scale": 0.82,
    "gap_px": 18,
    "opacity": 0.45,
    "tone": "ink",
    "paper_halo": true,
    "layer": 30,
    "subtitle_layer": 40
  },
  "safe_zone": {
    "x": 72,
    "y": 1420,
    "width": 936,
    "height": 350
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
      "controlled-wobble-hand-drawn-asymmetry",
      "small-readable-face",
      "varied-human-silhouette",
      "paper-note-props",
      "limited-flat-palette",
      "sparse-meme-reaction",
      "path-first-hero-contours",
      "token-conformant-props-effects"
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
      "perfect-geometric-box-body",
      "perfect-dominant-rounded-rect",
      "perfect-dominant-circle",
      "mechanical-even-spacing",
      "legacy-detective-palette",
      "visible-authoring-metadata"
    ],
    "prop_effect_palette": "canonical-only",
    "prop_effect_source_stroke_px": [
      4,
      9
    ],
    "legacy_direct_copy": false,
    "handmade_profile": "human-stroke-v2",
    "style_token": "zodiac-paper-doodle-meme-v4",
    "legacy_v3_direct_copy": false
  },
  "visible_metadata": {
    "authoring_labels": "forbidden",
    "scene_numbers": "forbidden",
    "beat_numbers": "forbidden",
    "natural_story_numbers": "allowed"
  },
  "handmade_profile": "human-stroke-v2"
}
```
<!-- STYLE_TOKEN_END -->

Every production `visual_system.style_token.id` and every asset `style_id` must equal `zodiac-paper-doodle-meme-v4`. Historical source material can inform semantics only; newly authored output uses the V4 token and `human-stroke-v2`.
