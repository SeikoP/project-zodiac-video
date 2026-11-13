# Zodiac Visual V5 — Performance-Driven Art and Multi-Palette System

> **Status: ACCEPTED DIRECTION / DESIGN ADDENDUM ONLY — 2026-11-14.** Companion to [Zodiac Unified Studio](./2026-11-14-agent-native-creative-studio-design.md), [Compiler VNext](./2026-11-14-zodiac-compiler-refactor-design.md), and the [eight-phase roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md). No runtime code, gallery assets, tests, render benchmark or human art approval in this PR.

**Objective:** make Visual V5 an actual qualitative upgrade, not merely a version bump: more varied yet coherent art direction, natural character/object interactions and voice-triggered acting, versioned shared asset semantics, and fast full-episode compilation through the same DAG core. The end goal is **less time per good video**, not more presets/asset permutations.

## 1. Verified V4 baseline and current palette limitation

Source on repository main inspected November 14, 2026:

- `references/asset-library-v4/characters/components/catalog.json` v4.7 includes **6 body profiles, 18 hairs, 2 outfits, 19 expressions, 34 poses, 1 face profile**, and four named shirt colors. The present system compiles one baked SVG for each planned identity/state, with a within-identity state-key reuse plan. These are **catalog counts**, not usable cross-product guarantees.
- `art-direction/palette-registry.json` defines **six semantic palettes** (`school-warm`, `social-teal`, `anchor-grounded`, `friction-slate`, `impact-coral`, `callback-muted`) but policy explicitly contains `no_new_colors: true`: mostly permutations of the same white/ink/yellow/teal/coral/slate swatches.
- `references/asset-library-v4/background-palettes.json` (duplicated under `scene-set/background-palettes.json`) defines **six background variants** (`warm-paper`, `mint-air`, `blush-paper`, `cool-study`, `sand-coral`, `neutral-graphite`), with identical source role vocabulary and mostly soft pastel output. `scene-set/compile-background-palette.mjs` applies replacements of hardcoded hex literals inside SVG; this is fragile for fresh canvas-native composition and does not automatically recolor every actor/prop/caption element.
- `foundations/style-token.json` hardcodes a common doodle palette; `art-direction/validate-phase02-art-direction.mjs` verifies `palette_id` exists and `color_reason` is nonempty, but **not** per-element role coverage, visual distinction or contrast of final composited frames.
- `references/asset-library-v4/README.md` still describes Scene Set as authoring start, and `capability-index.json` still marks several scene sets `fresh:true`, although the newer fresh Visual Intent flow treats background as canvas-native Scene Accent instead of containing the actor inside an old wall. This is a documentation/registry consistency risk, not proof that the current fresh runtime always uses Scene Set.

**Diagnosis:** the user-visible monotony is plausible even though file counts exceed one palette. It comes from a fixed base style, repeated swatches, tightly coupled theme/background application, limited outfit/face variation and absence of a **single effective rendered-palette** proof. Do not claim the six entries have been visually benchmarked on a fresh real episode.

## 2. V5 visual principles and compatibility

- **Performance-driven:** author a compact **Performance Graph** per beat/event: actor, initiator/responders, gaze target, body/face state, contact/held prop, ownership transition, visual emphasis and measured spoken trigger. Reuse existing interaction-plan/contact-mechanics/scene-state-trace fields and adapters; do **not** introduce a second creative source to replace canonical `.authoring/visual-intent.json`.
- **Native V4 compatibility:** no bulk replacement of valid V4 SVG geometry, ID churn or forced re-render of old Job@5. Translate approved V4 identity/state/physical prop/meme records into V5 semantic roles through a versioned, testable adapter; preserve pinned recovery snapshots for past episodes.
- **Style identity:** maintain the recognizable handmade `paper-doodle-chibi-meme` family, line weights, proportions, readable outline, watermark and two-line Vietnamese captions; vary palettes and compositional accents without making every episode a different brand.
- **Story-based art direction:** avoid palettes mapped deterministically to zodiac sign or chosen randomly scene-by-scene. Colors emphasize real beat, location, contrast, callback and voice twist, with per-episode visual consistency.
- **Fast asset reuse:** keep SVG masters editable; compile/canonicalize visual geometry and recolor by **role tokens**; optional raster cache for repeated static states, not a forced full video rasterization or an AI image generator dependency.
- **Scene truth:** Narrative Visual and Story Text remain mutually exclusive where required; physical prop requires authored action/contact; Stage/Accent is independent of actor position, no retired Scene Set wall containment.

## 3. Semantic V5 color system: one registry, multiple genuinely different themes

**Replace the single fixed color vocabulary with versioned `zodiac-visual-theme@1` + `zodiac-palette-role@1` registry, not with N duplicate SVG asset libraries.** The palette is an input to the compiler; the renderer only consumes resolved tokens/artifacts.

**Role separation** (no arbitrary literal hex in fresh authored scene/prop templates):
- `canvas`, `surface`, `surface_alt`, `ink`, `muted_ink`, `line`, `shadow`;
- `primary`, `secondary`, `accent`, `emphasis`, `interaction_highlight`;
- optional `floor`, `context`, `caption_surface`, `caption_ink`, `subtitle_outline`;
- `skin`, `hair`, `outfit_base`, `outfit_accent` are **character-specific identity slots**, not automatically rewritten when scene mood changes; explicit per-character mapping must preserve distinction when multiple actors share a frame.
- `brand_mark` and `watermark` remain accessible and recognizable.

**Initial V5 visual-theme candidates** (proposals for review, NOT existing compiled assets, not user-approved palettes):

| theme_id | visual goal | canvas | ink | primary | secondary | accent |
| --- | --- | --- | --- | --- | --- | --- |
| `apricot-campus` | warm casual everyday scene | `#FFF8EE` | `#2B2B37` | `#F2B66D` | `#80BDB1` | `#E26E72` |
| `rose-social` | teasing, friends, romance | `#FFF2F4` | `#342B39` | `#D96B87` | `#A989D2` | `#ECAF71` |
| `mint-reveal` | clean setup / new evidence | `#EFFAF5` | `#203A3B` | `#65B8A5` | `#F3B06C` | `#6B7DC1` |
| `blue-study` | restrained thinking, comparison | `#EAF2FF` | `#26304B` | `#6689CF` | `#EE9B80` | `#A48AC5` |
| `sunset-rush` | urgency / impact | `#FFF0E8` | `#3A272C` | `#EA8B65` | `#E9C45B` | `#B36A89` |
| `graphite-comedy` | dry irony / deadpan | `#F2F0EB` | `#202329` | `#59636E` | `#DAB56D` | `#E46D60` |
| `indigo-noir` | detective / suspense | `#161C2B` | `#F7F3EB` | `#7ABBB9` | `#E5AE62` | `#E87983` |
| `plum-electric` | expressive twist / contrast | `#20162B` | `#F7F2FA` | `#B38EF1` | `#F1A8C6` | `#90CCB7` |

These are eight **visually distinct candidate bases** rather than only remapping six existing accent swatches. They need final composite color-contrast, anti-banding, caption legibility, actor skin/hair and accessibility tests before acceptance. Do not blindly use `primary` as text color. Existing warm-paper V4 must remain a valid compatibility theme.

**Theme hierarchy:** episode chooses `base_theme_id`; scenes inherit it by default; explicit `palette_variant_id`/semantic overrides may change at a real story beat (reveal, flashback, tension, comedic payoff). Preserve actor identity and line quality across themes; allow a controlled limited set of overrides, not unrestricted random per-frame colors. Theme/style presets are **selectable visual directions**, not zodiac-sign stereotypes.

**Strict resolution:** `resolveVisualTheme(themeId, variantId, characterIdentity, outputContext)` yields a frozen role map and a `theme_fingerprint` from registry version + resolved role bytes + relevant font/style overrides. Missing role/unknown theme/unsafe contrast returns typed errors; do not silently default to original yellow/teal/coral. Use token-tagged SVG fills/strokes (CSS vars or explicit semantic roles in authored templates), **not** global regular-expression replacement of coincidental hex literals. Legacy V4 can retain a separate compatibility color adapter.

**Legibility gate:** test foreground/background luminance contrast on actual composited text and key ink controls (target text contrast >=4.5:1 for normal-size text), inspect real 1080×1920 screenshots with Vietnamese 2-line captions/watermark, and include a visual smoke with two actors using different outfits. Dark palettes must not invert skin/hair or make the primary prop disappear; line weight/outline remains stable.

## 4. V5 performance engine and asset factory

**Performance Graph (derived from Visual Intent, not another writable source):** events and transitions bind identity, acting requirements, gaze, contact points, prop ownership, before/after state, voice timestamp and reveal timing. The system should support subtle reactions rather than creating full rigged 3D animation. Start with V4 pose/expression states and lightweight anchors for hands/head/eyes/prop attachment; add rig capabilities only for movements proven valuable by real narrative fixtures.

**V5 Asset Factory:** one registry for V4 component IDs + optional V5 authored procedural assets. A new prop/story symbol is generated from a real authored scene requirement with provenance and style/theme role bindings, not generic decor to satisfy quotas. No automatic creativity claims: a one-off illustration not supported by current geometry is a distinct generation/review task before its compilation. Keep `assetId`, content fingerprint, style version, theme-independent geometry hash and theme-dependent appearance hash separated where possible.

**V5 character improvements:** broaden facial silhouette/profile options, outfit families and hair/face coherence; introduce meaningful physical hand/contact anchors; prioritize selected real female tall/slim actor path and varied hair before exhaustive cross-product. New combinatorial options are lazy; do not eager-render 6×18×34×19 variants or duplicate every theme into asset library.

## 5. Compiler, scene cache and render parity

- Primary `episode.build` builds whole episode from one canonical Visual Intent plus `base_theme_id`; one shared DAG plans geometry/identity and palette-independent nodes, appearance variants and scene composition per selected role map. `scene.compile(S03)` shares the same DAG for scoped refresh.
- When changing palette ONLY: **reuse source narration/voice/audio/semantic acting/geometry**, rebuild affected theme-bound SVG appearance/raster previews and composited scenes, not all poses/semantics/voice. When changing pose, rebuild its geometry and dependent appearance/scene.
- Store immutable theme registry version/role fingerprints on every generated SVG/raster artifact and preview/episode receipt. Never reuse a warm-paper thumbnail as indigo-noir by accident; tamper/retired theme/missing token invalidate deterministically.
- Reuse existing `phase02-semantic-cache`, `native-scene-executor`, `incremental-cache`, V4 character state keys, preview and resource budgets. The new typed core owns a single topological plan; do not create separate V5 worker pools or a shadow DAG unrelated to Compiler VNext.
- Present unchanged SVG directly when editing; optional PNG/WebP static cache for repeatedly reused states at needed size/zoom, measured per platform and validated for transparency, skin, outline, color correctness. HyperFrames output and video export consume one scene snapshot; compare pixel parity at setup/reaction/payoff frames.

## 6. Phase ownership within the existing eight-phase roadmap

**Keep eight phases, not a ninth mega-phase.** V5 is a cross-cutting **versioned vertical capability**, rolled out in reviewable increments:

- **P0 (baseline):** freeze and count all existing palette registry entries, role sources, gallery screenshots/golden V4 frames, color/contrast problems, input-output hashes and where Scene Set references persist. Do not prematurely delete old data or fake baseline image approval.
- **P3 (compiler core):** add versioned theme+palette-role and Performance Graph contracts to the new compiler DAG API; implement one theme resolver and safe V4 adapter; deterministic palette-aware scene/asset caching; at least light/dark palette and one V4 compatibility input with golden frame parity.
- **P4 (editor):** scene inspector/agent semantic edits for acting/contact/prop/voice timing **and** base episode palette + bounded scene theme override, all round-trip to canonical intent; preview updates from committed revision, no direct HTML color edits.
- **P5 (V5 visual catalog and Gallery):** extend current asset-gallery phase with **four** moderate tasks: (5.1) unify real V4/V5 catalog+capabilities and remove deprecated Scene Set references from fresh surface; (5.2) add three initial diverse palette families including at least one dark, actual previews, compile token maps and contrast gate; (5.3) add the remaining vetted families (initial target eight candidates) and character/prop procedural variations, lazy render/cache; (5.4) a real in-Studio gallery to select palette, actor hair/body/outfit/pose/face, props/meme before-after with live scene effect. **If this exceeds a reviewable PR, split after the stable catalog+theme interface and keep both chunks part of Phase 5**, with independent test/evidence gates.
- **P7 (end-to-end):** compare identical episode under two materially different approved themes and at least one dark palette; ensure visual QA, V5 actor identity, narrator timing, caption watermark legibility, render parity and renderer memory/disk throughput. Keep V4 pinned package compatibility.

**Non-goals:** full skeletal animation/After Effects, freehand vector editing system, AI image generation as mandatory step, 100 palette combinations, hardcoded sign→palette assignment, new independent theme editor application or replacing SVG for every asset.

## 7. Quality and regression acceptance

1. **Color variety:** eight *candidate* palettes must be distinct in real 1080×1920 frames, not six role permutations; at least three approved variants by Phase 5 early gate and at least one dark theme. Human visual accept/reject evidence is separate from technical token/contrast checks.
2. **Consistency:** two scenes in one episode share actor identity and base color theme; an explicit voice reveal may switch a scene theme with recorded story rationale. A palette change must not alter narration, voice timing, hair silhouette, actor role, prop event, stage geometry or already-approved unrelated scenes.
3. **Interaction:** repeat Libra 3-state balance actor-relative test; Scorpio detective setup→reaction; Gemini social reversal; hand-held prop attachment/ownership and eye/gaze targets. Freeze both V4 compatibility and V5 look, compare screenshot golden frames and event timing.
4. **Caching:** unchanged warm build fully reuses verified V5 outputs; single palette switch invalidates only theme-bound appearance/preview/export nodes; single pose edit invalidates geometry+appearance only for involved actor and consumers; stale font/role config invalidates captions correctly.
5. **Stability:** unknown/retired palette blocks with typed error; skin/hair not accidentally recolored; missing SVG tokens do not silently render default; dark scene does not make caption/watermark illegible; interrupted build retains previous healthy preview and whole episode; source/hash check covers all generated themed artifacts.
6. **Performance:** log and compare whole-episode end-to-end and cold/warm/theme-switch/single-scene-edit time, worker counts and RAM/disk on Windows; do not promise a particular multiplier before benchmark. Do not remove semantic/visual validator or user approval to improve numbers.

**Stop condition:** a theme looks different in catalog only but not in actual HyperFrames render; a new style requires cloning all character SVGs; changing colors invalidates speech synthesis; previous V4 finished package breaks; one actor identity shifts between themes; or generated files are declared PASS without a true reviewed frame. Roll back V5 theme selection while retaining the old V4 art.
