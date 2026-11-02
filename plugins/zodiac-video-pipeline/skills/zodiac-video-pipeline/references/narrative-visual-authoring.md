# Narrative Visual authoring (fresh runs)

No story motifs are stored. Each episode invents its picture; the kit constrains form only (style, safety, size, placement), never content. Human Stroke v2 stays: focal shapes are authored paths, no runtime jitter, filters or wobble.

## Per narrative beat
1. **Brief** (`zodiac-narrative-brief@1`, in the scene's art direction as `narrative_brief`): `claim` (one sentence the viewer must grasp), `anchor_phrase` (exact words in the scene voice), `state_changes[]` (`from`, `to`, `anchor_phrase`, optional `event_id`). Required when any coverage beat uses the `narrative_visual` layer. Checked by `validate-narrative-brief.mjs`.
2. **Three concepts** as text only: literal, metaphor, exaggeration. Pick one and write why. Variety comes from this ladder and from the reuse check, not from stock images.
3. **Reuse check**: `auditNarrativeBriefReuse` (in `audit-creative-reuse.mjs`) compares the claim with earlier episodes' briefs. A repeat is `EDITORIAL_REVIEW`, never a block. Pass earlier briefs as `priorNarrativeBriefs` when they are available.
4. **Author the SVG**: one SVG per identity, states as visibility groups driven by voice-anchored events.
5. **Kit lint** (`validate-narrative-visual-assets.mjs`, run by the precompile boundary on fresh runs): no text glyphs, no filter/script/image/animation, valid viewBox, at least two focal paths, minimum placed area `KIT_MIN_AREA` (30,000 px² by default; override per call with `minArea` when a placement justifies it), inside the canvas, clear of the caption safe zone. Palette and stroke-token checks exist in the module but are not wired to a global list yet, because stroke tokens are ranges.
6. **Blind readback (offered, not required)**: rasterize the compiled frame and give a fresh reviewer (`zodiac-reviewer`) only that image and the narration line. Ask what story it tells and compare the answer with the brief's `claim`. A mismatch returns NEEDS_REVISION with the reviewer's own words. It is a pre-review aid; the user's Visual Review stays the approval.

## Coverage ceremony
On fresh runs a layer with no entity in the beat is derived as `omit` ("no entity in beat") by the validator. A layer that has entities still needs its authored reason. The caption layer stays explicit. Old workspaces keep the strict rule.

## Who does what
| Task | Agent | Model |
| --- | --- | --- |
| Brief, three concepts, SVG authoring | `zodiac-narrative-visual` | opus |
| Kit lint, previews, receipts | `zodiac-gatekeeper` | haiku |
| Blind readback | `zodiac-reviewer` | opus, sees only the frame and the line |
