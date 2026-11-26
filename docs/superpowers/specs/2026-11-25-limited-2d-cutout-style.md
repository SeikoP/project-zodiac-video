# Limited 2D cut-out style for Zodiac Studio (proposal, pending user approval)

Status: APPROVED by user 2026-11-25 ("ổn"); Tier 1 IMPLEMENTED, Tier 2 pending. Decisions taken by default: camera cuts allowed only with a stated `reason` above 1.25x (max 2.0x, framing must stay inside the canvas); Tier 2 after Tier 1 is verified on a real episode. Builds on the user-selected direction of 2026-11-18 (agent-native-creative-studio-design §2.1). No code is implemented until approved. Human visual/video approval stays PENDING.

## Name and meaning
**Limited 2D cut-out** (digital): flat paper-doodle characters and props act as rigid cut-out pieces. Only the part that carries the beat moves (lean, reach, recoil, pose swap); everything else holds. Motion is stepped on twos; poses and expressions change by hard cut, never crossfade (crossfades show ghost limbs, already fixed in the 2026-11-19 export). `maket-acting-10s` is the idea source, not the canonical output.

## Why this fits (evidence)
- Limited animation = animate selected parts, hold the rest (Scooby-Doo era). Cut-out = pieces rotate about pivots; digital cut-out is how South Park-style shows are made. Both are cheap per episode and suit recurring characters, repeated locations and predictable dialogue coverage. Hybrid: puppet motion for body, frame swaps for hands/faces/expressions. Sources: Motionographer "7 ways to mix frame by frame and rigged animation"; Godot cut-out animation docs; Creative Bloq animation styles.
- It matches existing channel assets (flat SVG poses, paper-doodle palette), the 2.0.2 "on twos" renderer, and HyperFrames/GSAP seekable painting. No new renderer or skeletal rig is required.
- Vox-style editorial cutting stays an optional experiment (spec §2.1); only its restrained cuts and camera are reused.

## Style rules
1. Beat structure: intention → action/contact → reaction hold, tied to measured voice anchors.
2. Motion vocabulary (small): pose/expression hard-cut swap, lean/recoil pivoting at the feet (≤20°), short translation, contact-preserving group move (actor + held prop, ≤2px hand error), mirrored reach pose, justified camera cut or push (≤1.25x, inside canvas), hold.
3. Stepped on twos (24fps → 12 poses/s). Hard cuts for swaps.
4. No added text, titles, labels, rings, cards or footers; captions use measured words only.
5. Missing pose/expression/contact geometry is reported as a limit, not hidden.

## Delivery tiers
- **Tier 1 (existing whole-pose SVGs):** add motions `lean`, `recoil`, `pull-with-prop`, `camera-push` and a mirror flag to the motion registry; validators for contact and camera bounds; tests incl. a Ma Kết 0–10s regression.
- **Tier 2 (new assets, workstream C):** rebuild characters as cut-out layers (head/expression set, torso, arm poses with circular joints and pivots) so reach/point/shrug need no full-pose redraws; tone down over-acted expressions.

## Open decisions for the user
- Approve naming and rules above, or edit.
- Camera: allow Vox-style punch-in cuts by default, or only when the agent justifies them?
- Tier 2 now, or after Tier 1 is verified on a real episode (recommended)?

## Tier 1 implementation record (2026-11-25)
- `tools/studio_project/acting_registry.json` (zodiac-studio-acting@1, Studio-only), `visual_acting.mjs` (resolveActing, resolveCamera, validators), wired into `visual_compiler.mjs` (validation, measured `preview_params` + per-scene `camera`), `visual_preview.mjs` and `visual_presentation.mjs` (shared painter, on twos, lean pivots at the feet, camera applied to every entity, captions untouched) and the compiler identity fingerprint.
- Semantics: lean/recoil absolute offsets from rest (unspecified fields keep the held pose); pull-with-prop relative to each member's held pose; settle hold by default, `settle:"return"` to spring back.
- Tests: `tests/studio_acting.test.mjs` 10/10; regression studio_p34_visual 13/13, studio_hyperframes_export 13/13, p5_assets 6/6, visual_migration 4/4, episode_timeline 3/3, caption_contract 2/2, test_studio_p1_agent 14 passed. Visual check of the real painter (lean about the feet, camera cut+push, recoil) via Chromium on a Nhân Mã classroom scene.
- Known gaps: `scene.camera` is authored in source only; the agent `scene.performance` proposal can emit lean/recoil/pull events but not camera shots yet; `quality()` QA does not yet include acting offsets in OUTSIDE_CANVAS/CAPTION_OCCLUSION; no mirror flag yet; the Ma Kết 0–10s regression against the demo frames is not built. Plugin motion registry and the pinned Remotion renderer are untouched.
