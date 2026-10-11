# Story Object & Semantic Effects — channel visual contract v1

## Why
The Libra balance scale is a useful reference because **the object itself acts out the thesis**. Our system must not add scattered question marks, rays or generic reaction SVGs to compensate for an absent visual idea. One recognizable prop can communicate multiple turns more effectively than many assets.

## Upstream creative decision (Phase 01)
Before visual authoring, Story Spine identifies the **central sign-specific contradiction**, a **physical metaphor** that communicates it, and an **object callback** that changes its interpretation. This is not a second Story Shape: keep `character_deconstruction` and `TONE_RHYTHM_DEFAULT`. Do not pull old examples into a new run, or claim a new approved Narration. Duration follows the active short-form channel brief.

## Phase 02 — real authored plan, BEFORE drawing
Write `.authoring/story-object-plan.json` with `format: zodiac-story-object-plan@1`, `style_token: zodiac-paper-doodle-meme-v4`, SHA-256 of exact approved `narration.txt` bytes, one `central_metaphor` (`id`, `meaning`, `payoff_transformation`), and `beats` with at least `setup` → `friction` → `payoff` across meaningful scenes.

Each beat records: `beat_id`, `scene_id`, `role`, exact `voice_anchor`, `object_entity`, `object_event_ids`, `visual_change`, `narrative_meaning`, and `effect` (`entity_id`, `event_ids`, `semantic_role`, `tier`). `payoff_beat_id` must reference the terminal payoff. Object event IDs MUST target a real native V4 prop entity and show a material change in SVG, transform/visibility, or a runner-supported dynamic motion; a state rename with unchanged visuals is invalid. Effects require authored enter/release and a real spatial binding. Never invent contact geometry or receipts.

### Effect tiers — semantic strength, not SVG count
- **Tier 1, setup:** introduce the metaphor visibly (tilt, point, reveal). Viewer reads the setup even with audio muted.
- **Tier 2, friction:** the SAME conceptual object changes meaning or relationship (pressure, split, block, displacement). This is not another generic reaction mark.
- **Tier 3, payoff:** a striking, justified callback/reversal that completes the promised contradiction. Prefer object state/position/camera focus changes over disposable decorative overlays.

The tier is an editorial *intention* confirmed by actual events plus human Visual Review. The number does not prove visual intensity. `effect.semantic_role` belongs to `compare | block | reveal | pressure | split | highlight | callback | collapse`. Use large legible silhouettes when relevant, but NEVER force larger effects into caption/face safe zones to satisfy a metric. Reuse native assets that already carry the intended meaning. Before generating new SVGs, justify why existing prop states/transform/motion cannot communicate the beat.

### Referential checks
`validate-story-object.mjs <workspace> --write` verifies: exact Narration hash, real voice quotes, V4 `style_id`, central prop, object/action events with visible state change or actual motion, effect entity/enter/release and spatial anchor, nonrepeating beat-level visual change, tiers 1→2→3, and payoff callback. It emits `.authoring/story-object-qc.json`. It DOES NOT visually certify that a tier is impressive: native endpoint review and later Remotion temporal QA still required.

The Phase 02 Director wrapper invokes the validator before native preview for new runs. A `story-object-required.json` marker or new fresh plugin state opts in. For old reviewed runs without either marker or plan, the result is explicitly `LEGACY_NOT_APPLICABLE`, never `PASS` for the new system.

## Phase 03
Review lock SHA includes `.authoring/story-object-plan.json` and `.authoring/story-object-required.json`, so after Visual Review no changes can creep into the production ZIP. The Phase-03 one-shot runner checks the plan BEFORE staging/ZIP, and checks the same semantics once more during export validation. The plan/receipt remain outside Job@5, preserving strict root allowlist and runner ownership of TTS, measured timing, frames, cover rasterization and MP4 QA.

## Quality questions for human Visual Review
1. Is the object essential to understanding this specific Zodiac contradiction? If removed, does the beat lose meaning?
2. Are the setup, friction and payoff visually distinct with the audio muted?
3. Does the callback reuse the *same idea* while changing its interpretation rather than merely using the same SVG again?
4. Do the object, character, environment and effects share V4 line weight, palette, silhouette/handmade marks and physical contact, without the "sticker on wallpaper" appearance?
5. Does tier 3 actually land, and does the last voice sentence have room to finish?

No arbitrary quotas of character poses, prop SVGs or effect count are imposed. A powerful static reaction can be valid; an important metaphor without any meaningful action across the video cannot pass.

## Fresh >=2.4.48: Story Object Plan @2
Use zodiac-story-object-plan@2. Keep existing narration hash, token, beats, actual entities/events and presentation modes. Add central_metaphor.sign_contradiction and removal_test. Author selection {selected_id,rationale,candidates:[{id,object_idea,sign_specificity,removal_test,rejected_reason for rejected candidates}]}; compare useful alternatives, or one candidate plus comparison_not_needed_reason when obvious. Do not manufacture alternatives to reach a quota.

Each beat adds semantic_delta {before_read,after_read,added_meaning}; the object should add an implication/emotional read, not repeat the sentence. Payoff adds relation_transformation {from,to,meaning}: the same idea changes relation/interpretation. object_instances [{scene_id,entity_id,metaphor_id}] preserves conceptual identity across real prop instances. Refer to actual events; no invented runtime motion. Effects are optional when object action carries the consequence; supplied effects retain real lifecycle/contact. No 1→2→3 tier quota for @2. @1 keeps legacy validation.

These checks validate authored structure and lineage, not story merit. Visual Review must discuss the actual removal test, silent setup/friction/payoff and relational callback, supported by preview pairs. After TTS, runner must verify whether timing makes the reveal readable. Weak premises return to Phase1; Phase2 cannot silently rewrite approved narration to rescue them.

## Explicit intent decision
Visual intent records required, optional or omitted with reason and review_ref. Omitted returns OMITTED_EXPLICIT, not creative PASS; required flags cannot be disabled implicitly. A situation prop may carry the metaphor through changed shape, relation or consequence. Repeated reveal of the same object is insufficient. Effects are optional in v2, motion alone is not metaphor progression. Human mute-review remains required.
