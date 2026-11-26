# Visual V5 — Prop Families, Meaningful Variation and Cross-Episode Diversity

> **Design addendum, 2026-11-14. Not implemented.** Parent: [Visual V5](./2026-11-14-zodiac-visual-v5-color-system-design.md), [Constraint-First Asset Decision Engine](./2026-11-14-zodiac-studio-asset-knowledge-graph.md), [Compiler VNext](./2026-11-14-zodiac-compiler-refactor-design.md), [eight-phase roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md).
>
> User-reported regression: three videos show apparently the same phone. Source inspection establishes the **structural reason** in V4, not a reviewed rendering of those three actual videos: `props/phone.svg`, `phone-busy.svg`, `phone-ping.svg`, `phone-quiet.svg`, `phone-silent.svg` all reuse **exactly the same exterior body path**, `M86 40 Q158 27 234 42 Q239 179 236 316 Q158 332 80 315 Q84 177 86 40Z`. They differ in display fill/notification badge/text and screen state. `props/index.json` associates four variants with `state_of: "phone"`. **Five state files = one physical phone silhouette**, not five recognizable prop designs.

## 1. Diagnosis: two distinct problems, not one

1. **Asset supply limitation:** V4 phone has only one external geometry master. Any recommender can only pick that silhouette. Changing its display state or the global palette doesn't solve actual model diversity.
2. **Scene direction repetition:** different episodes can choose the same prop, framing, hand gesture, screen angle and visual motif because plugin-driven authoring has no cross-episode **visual usage/variety** feedback. A new phone model alone won't fix repetitive shots.

**Do not** solve with a hard ban on repeated phone usage, pseudo-random colors, forced new prop per scene, or eager generation of every combination. If a story follows the same real character using the same owned device over three episodes, consistent device identity is a positive requirement. The variation policy needs creative intent + explicit continuity overrides.

## 2. Correct asset taxonomy: family ≠ model ≠ look ≠ story state ≠ camera

V5 must separate five axes explicitly:

| Axis | Example for phone | Meaning |
| --- | --- | --- |
| `family_id` | `phone` | Generic semantic capability: receives messages, shows evidence, is handed/held |
| `model_id` | `phone-rounded`, `phone-slab-angular`, `phone-compact` (proposed, **not current assets**) | **Actual silhouette / physical geometry** and hand-contact dimensions |
| `appearance_id` | protective case pattern, edge color, wear, sticker, transparent case | Physical look and identity. Pure recolors do NOT count as a new silhouette |
| `state_id` | `quiet`, `ping`, `busy`, `silent`, `open-message` | Runtime visual/meaning state of one physical model, not a new model |
| `view_id` | front close-up, 3/4 held in hand, back view, side/profile | Scene presentation/composition, with required real supported SVG geometry/occlusion/anchor |
| `owner_id` | `actor-lead` | In-episode/series identity; prevents random model changes within the same story |

This is a *proposed design interface*. The source of authored scene meaning remains canonical Visual Intent; model/appearance/state/view are resolved references and compiler outputs, not separate untracked editable files. Old V4 `phone-*` IDs map to `phone/model=v4-default/state=*` under a compatibility adapter preserving old SVG bytes.

## 3. Prop Family Compiler / V5 Asset Factory

**Recommendation: small native vector parametric families, not 20 handcrafted copies and not uncontrolled diffusion image generation.** Start with phone as a vertical pilot because the user observed its repetition.

- Build **three actually distinct approved phone masters** as a pilot: rounded tall slab, compact shorter handset, and angular/case-heavy design. Their path contours, body/camera placements and hand-grip geometry must be visually distinct in a tiny 1080×1920 frame, not simply a new fill color. The exact designs are examples to be authored and reviewed, not existing production assets.
- Each model must expose **stable slots**: `body`, `screen`, `notification`, `case`, `camera`, `left_grip`, `right_grip`, `front_surface`, `pivot`, `safe_overlay` and relevant scene transform bounds. Emit actual SVG for each supported model+state+appearance+view; unsupported perspective is blocked, not claimed by a 2D rotation transform.
- Allow deterministic **procedural appearance** variation through a versioned recipe and palette roles: shell/case shape, color scheme, subtle decorative details, message layout and notification badge. Prevent impossible touch points, screen/case clipping, text overflow and wrong badge meanings. **Changing procedural parameters cannot silently change the story-state or owner.**
- Use existing V4 SVG engine and same style/stroke identity. Distinct V5 silhouettes may be authored by artists/agent-mediated SVG creation with explicit Visual Review. Compiler can only materialize registered geometry and parameterized variants, **not invent unseen model masters**.
- All model/state/appearance combinations are **lazy compiled on demand** (no large model×state×view×palette eager explosion); exact geometry + model parameters + theme/fonts + compiler version + owner-independent state fingerprint feeds content-addressed cache. Repeat renders reuse bytes; a case-only change invalidates appearance/raster/scene output, not TTS or underlying audio timing.
- Prop interaction is binding: left/right hand grip, scale/rotation and character pose must be physically plausible; continuity and occlusion checks prove it can be held, passed, displayed, placed or hidden in the authored scene.

**No automatic new-art pass:** missing master geometric capability returns `NEW_VARIANT_MASTER_REQUIRED`; no fabricated SVG, stale generic prop substituted or auto-approved user Visual Review.

## 4. Episode/series visual diversity without randomness

The **Agent Asset Decision Engine** must see a compact **Visual Reuse Profile** derived from actual accepted/rendered episode manifests (not guessed from narration or from all past authoring drafts). An example per asset slot:

```json
{
  "family_id": "phone",
  "model_id": "phone-rounded",
  "appearance_id": "navy-clear-case",
  "state_ids": ["quiet", "ping"],
  "view_ids": ["front-held"],
  "usage_context": "evidence",
  "actor_owner_id": "lead",
  "source_episode_id": "example-only",
  "source_revision": "sha256:...",
  "approval_status": "REVIEWED"
}
```

The source and IDs above are **illustrative future data**, not currently existing assets or a real reviewed episode. History lookback is bounded and configurable (e.g. recent 5–10 eligible episodes, not all data on every turn). The retrieval/ranking logic:

1. Start from **story and actual visual action**: does the beat even require a phone? Consider actor reaction, an overlay, scene-specific symbolic visual or simple Story Text where appropriate. Never force a quota of different physical props.
2. Hard-filter available, compatible and owner-consistent physical models, states, contacts, views and source rights. Reusing the same phone within the same series character is expected unless intentionally changed.
3. Soft-penalize **unmotivated repeated full visual signatures** across unrelated episodes: `family+model+appearance+view+shot+action`, weighting whether the asset was central and recently visible. This penalty is **not** a blanket prohibition on the family `phone`.
4. Offer two or three *genuinely different* viable scene approaches: same phone with meaningful new visual action, a different actual physical model if appropriate, or a no-phone framing where the story still works. Explanations must call out if every candidate is the same geometry.
5. Keep actor/prop design stable through one scene and connected episodes. Use deterministic `episode_seed` only as a tie-breaker after constraints/ranking, never as a random script-independent prop generator.
6. Human review feedback (e.g. "same phone again", "screen is too generic", "prop unrelated to twist") informs the ranking/asset backlog with source, not bogus predicted engagement scores.

**Design novelty is multi-dimensional:** prop silhouette, actor hairstyle/face/outfit, primary action, camera distance, layout, composition, theme/mood, unique Narrative Visual and meaningful meme reaction. Avoid rewarding superficial phone recolors or forcing visual busyness where one facial expression is strongest.

## 5. Studio capability and agent UX

- `assets.find_candidates` returns `family_id`, `model_id`, `appearance_id`, `state_id`, `view_id`, compatibility/owner constraints, **distinct_geometry: true/false**, recent-usage summary, exact source refs/sha and explanation.
- `assets.inspect` displays actual thumbnail previews for each **physical model** and supported view, not a carousel of five notifications with identical silhouette.
- `assets.request_variant` creates a bounded **new model/appearance authoring task** with source art need, contact slots and review requirements; it does not generate unsanctioned art or mark approval.
- `visual_intent.apply_selection` commits one revisioned selection and triggers targeted scene preview; shared owner/model choices stay consistent. App UI may warn "same model+shot in 3 recent distinct episodes" with an explanation and viable alternatives, but a user can explicitly retain a reused model.
- **Before compiling full episode**, shortlisting runs across all beats to reduce redundant geometry/props/visual treatment. Approved coherent cast/prop identity takes priority over forced variety.

## 6. Phase ownership and acceptance tests

Keep eight phases. **P0:** measure asset reuse across real imported episode manifests if available; classify **state-only repetition vs true silhouette repetition** and actual review outcomes. Save V4 five-phone-same-body fixture and source SHA. **P3:** introduce typed family/model/state/view resolver + single source-derived manifest and compatibility adapter; add diversity features to candidate ranking, hard consistency checks, scoped cache identities and 6–10-scene cross-episode fixture. No visual art production burden in DAG work. **P4:** agent/editor see exact model and variant, real thumbnails/preview and warning/override UI. **P5:** build and visually review 3 actual different phone master SVGs (pilot), multi-state compatibility, grip/view/occlusion; expand only proven high-reuse prop families, not all 57 at once; incorporate distinctive procedural cases and selected camera views. **P7:** benchmark across 3 distinct episode fixtures for repeated center-of-frame phone treatment, visual reviewer ratings, cache/compile time, and continuity.

**Required tests:**
1. V4 phone, busy, ping, quiet, silent all map to **one** `v4-default` physical model; states remain distinct and previous package output unchanged.
2. Different V5 phone masters are **actually different source geometry/silhouettes**, proven by generated SVG and thumbnail/image review; recolor or notification swap does not count.
3. Same owner within a scene retains `model_id` across state transitions; actor hand-contact and scene occlusion valid.
4. Same story actor using a continuing phone is allowed/encouraged; history penalty is soft and independently overrideable.
5. Three unrelated episodes with central repeated identical model+appearance+view+action must generate a meaningful alternative suggestion or explicit scarcity warning, **not silently claim variety**.
6. No-fit model or unsupported 3/4 view returns `NEW_VARIANT_MASTER_REQUIRED` / typed incompatibility, not invented geometry or partial PASS.
7. Appearance-only or model-only edit invalidates exact downstream nodes, does not trigger voice regeneration or unrelated scene rebuild; unchanged warm builds reuse cached verified output.
8. A scene can use no physical prop; narrative quality/human review outranks a diversity quota. Captions and prop readable after all selected model/theme variants.
9. Produced 1080×1920 snapshots and render parity for front/held/message reveal; same fonts, contact/occlusion and correct voice timing.
10. Compare source-provenance-backed 3-episode reuse metrics, human reject reasons, end-to-end authoring+repair time and RAM/disk before claiming improved visual variety.

**Stop:** counting the five V4 phone states as five models, merely rotating/recoloring one model and advertising new silhouettes, creating arbitrary props as filler, replacing recurring owner identity between adjacent scenes, loading every past ZIP to answer a selection query, or making cache invalidation worse than old V4 without measurable review benefits.
