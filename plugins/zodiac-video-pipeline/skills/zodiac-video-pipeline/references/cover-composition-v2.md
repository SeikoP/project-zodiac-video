# Cover Composition v2 — token-locked producer/runner contract

## Source of truth and ownership
Read `references/design.md` STYLE_TOKEN (`zodiac-paper-doodle-meme-v4`) before composing a cover. The designer must reuse source-scene native V4 characters and story objects rather than generating cover-only characters. Publish Prep selects `cover.visuals` with a **semantic** purpose; the local runner renders 1080 × 1920 `cover.png` and verifies actual pixels. New covers must use `cover.design.version = "zodiac-cover-design@2"`; older reviewed packages remain readable without design.

## Paper title frame (not generic UI)
- Shape: visibly hand-drawn *crooked paper-note* path with subtle 1–4% edge asymmetry, NOT a perfect CSS pill or generic rounded box.
- Fill role `card` (#FFFDF9), ink stroke role `ink` (#2F3C44), warm shallow shadow role `soft_shadow` (#D0C1B3). Shadow layer under paper, never SVG turbulence, blur filters, gradients, neon, or black halo; render soft shadow as a small low-alpha displaced warm shape in the local renderer (2–8px y, 0–4px x at 1080, opacity 0.22–0.38) and optional 2px softer edge. Shadow must be perceivable on 180px-wide thumbnail but not look like floating UI.
- Title type: use token font stack `Patrick Hand`, `Segoe Print`, cursive. No unlicensed font file included. Title remains legible at thumbnail size; use 2–3 balanced lines maximum. Identity glyph/sign separate from hook.
- Palette only canonical V4 roles (`paper`, `card`, `ink`, `soft_ink`, `soft_shadow`, `teal`, `coral`, `ochre`, `slate`, `sticker_edge`). No invented color or extra sticker visual family.

## Native asset sizing and visual hierarchy
- 1080×1920 canvas. Cover readability zone must accommodate platform crop; reserve safe margins no less than 72px each lateral edge, and avoid important hook/face detail near extreme top/bottom. Title region concept target 30–35% composition visual weight; not a hard pixel quota.
- Hero character should be **composed** to 0.82–0.90 of the previous default *display footprint* (do not mutate underlying character geometry or body identity). Supporting prop display footprint 0.75–0.85 default. These are compositional hints, not universal object transforms. If a meaningful expression becomes unreadable, increase hero until face legible and reduce/omit secondary elements first.
- Focal set: one hero/group + one story object and 1–2 related reaction/effect accents. Every extra element has narrative function. No density quota that forces decorative props.
- Draw order/read sequence: (1) title/short hook, (2) sign name/glyph, (3) character+primary story object; accents do not compete. Keep faces, glyph, and key prop visually distinct and non-overlapping with title frame.
- Actor/object/environment remain separate in `Story Object Composition v2`; story object **never replaces background**. Background structural cues are simplified by opacity/density, not discarded to make the cover look like a generic stock poster.

## New `publish.json` cover authoring fields
Add this object within `cover`, keeping `layout: tilted_top_hook`, `identity`, `hook`, `source_scene_id`, `visuals` and `source` unchanged (backward compatible Job@5):

```json
"design": {
 "version":"zodiac-cover-design@2",
 "style_token":"zodiac-paper-doodle-meme-v4",
 "canvas":{"width":1080,"height":1920},
 "title_frame":{"shape":"crooked-paper-note","fill_role":"card","stroke_role":"ink","shadow_role":"soft_shadow","shadow_dx_px":3,"shadow_dy_px":6,"shadow_opacity":0.3,"font_family":"Patrick Hand","max_lines":3},
 "composition":{"hero_scale":0.86,"supporting_prop_scale":0.80,"read_order":["hook","identity","character_story_object"],"max_supporting_accents":2,"min_side_margin_px":72,"background_policy":"preserve-native-environment"}
}
```

The above is **producer intent** metadata. It does not prove the runtime has implemented `cover.design`; renderer must either apply it or explicitly report `COVER_DESIGN_UNSUPPORTED` (never silently ignore it). Runtime screenshot QA checks shadow pixels, thumbnail readability, character/story-object scale, native assets, crop and visible token palette. If `cover.design` is not handled in the local runner, output must be reported as `COVER_RUNTIME_PARITY_UNVERIFIED`, NOT PASS.

## Review process
## Cover as the video opening — 2.4.49
For new videos, author `cover.opening: {"enabled":true,"duration_sec":0.75,"transition_sec":0.2}` in publish metadata. It reuses the exact cover component/title/identity/native visuals from frame zero and dissolves into the first scene; it is not a separate silent intro. Narration, captions, audio and scene/event frame ranges begin normally and are never delayed or extended. Choose 0.5–3 seconds total, with a positive transition no longer than 0.6 seconds and shorter than the total. Actual runtime duration must fit inside the first measured scene; a shorter scene requires revising opening metadata rather than silently clipping it.

Hide captions while the opening cover is present, including its dissolve, and resume on the first uncovered global frame. Caption segments and voice/event timing remain unchanged; never display a stale first caption on release. The video retains its runtime brand watermark, omitting the standalone cover's additional footer watermark. Static `cover.png` remains the same independent feed deliverable. Inspect frame 0, the dissolve and the first uncovered scene for title/face/caption collisions and narrative continuity. A metadata PASS is not evidence of pixel or temporal quality. Old approved packages without `opening` do not acquire an intro implicitly; explicit `enabled:false` opts out. Runner source must include cover-opening support before rendering enabled openings; original older Renderer 2.0.1 installations do not gain this behavior from metadata alone.

Publish Prep runs `orchestration/validate-cover-design.mjs <workspace>` before Visual Review for all fresh covers, then `validate-publish-prep.mjs` as usual. A valid JSON report is **not** visual QC. On runner import, verify transform and safe-area parity at 1080×1920 and thumbnail downscale. Legacy ZIPs keep the old layout unless explicitly revised; don't mutate approved title, identity, narration, or scene evidence.

## Episode cover
For Narrative 2.1 multi-member episodes use `cover.identity={episode_id,label,glyph}` without sign_id. Label: NHÓM LỬA/KHÍ/ĐẤT/NƯỚC, TOP N for ranked_shortlist, or all compared member labels/shared title. Glyph is authored presentation, not a guessed zodiac sign. Single legacy keeps sign_id. Cover opening and feed cover use the same scope; explicit episode identity never prepends time or delays narration.
