# Narrative Visual authoring — design (no pre-built library)

Status: implemented. Brief validator, derived-omit coverage (fresh runs), kit lint (wired into the precompile boundary), narrative reuse check, the `zodiac-narrative-visual` agent and `references/narrative-visual-authoring.md` are in the plugin. Blind readback is a protocol (offered), not code.

## Problem
Fresh episodes need a narrative visual that tells the story at that moment. Today:
- the only reusable material is 6 abstract diagrams (`asset-library-v4/visual-metaphors`); everything else is hand-drawn per episode with no help;
- every beat carries a use/omit decision with a reason for all six coverage layers, so even one small visual costs a long form;
- nothing checks that the picture is *readable*, only that the structure is valid (`story-object-contract.md`: "a valid state change cannot substitute for an actual readable rendered frame").

## Principles
1. **No story motifs are stored.** Each episode invents its image. Creativity stays with the author.
2. **The kit constrains form, never content.** Style, safety, size, state encoding and legibility are mechanical; what to draw is not.
3. **Anchor to the story, not to a shape.** The author states what the viewer must understand; checks verify that claim, not the geometry.
4. **Human Stroke v2 stays.** Focal geometry is authored paths; no runtime jitter, filters or random wobble. The kit never generates strokes.

## The loop (per narrative beat)
1. **Brief** (one short record, authored): `claim` (one sentence the viewer must grasp), `subject`, `relation_or_change`, `emotion`, `anchor_phrase` (exact words in the scene's voice), `states` (A, then B at which anchor), `placement`.
2. **Three concepts** along a ladder, as text only: literal, metaphor, exaggeration. The author picks one and writes why. This replaces a catalogue: variety comes from the ladder and from the reuse check, not from stock images.
3. **Reuse check**: `audit-creative-reuse` is extended to compare the chosen concept against earlier episodes' briefs. A repeat is reported for editorial review, never blocked (its existing rule: "reuse is not prohibited").
4. **Author the SVG**: one SVG per identity, states as visibility groups driven by voice-anchored events (already supported). Focal shapes are paths.
5. **Kit lint** (mechanical): palette and stroke tokens, no text glyphs, viewBox and minimum area (30,000 px² for effects, role size limits for story objects), focal path count, caption safe zone, no filter/turbulence.
6. **Blind readback** (the legibility check): rasterize the compiled frame, show only that image plus the narration line to a fresh reviewer, and ask what story it tells. Compare the answer with the brief's `claim`. A mismatch returns NEEDS_REVISION with the reviewer's own words, which tell the author what is unclear. This is a pre-review aid; the user's Visual Review stays the approval.

## Cutting the ceremony
Coverage today forces a reasoned decision for six layers on every beat. Proposal:
- the `narrative_visual` layer keeps an explicit brief (above);
- a layer with **no entity in that beat** is derived as `omit` with the reason "no entity in beat", written by the tool, not the author;
- a layer that **has** entities still needs its authored reason.

Trade-off: this relaxes the deliberate "think about every layer" rule for empty layers. It removes noise, not decisions. Needs explicit approval because it changes validator semantics.

## Who does what
| Task | Agent | Model |
| --- | --- | --- |
| Brief, three concepts, SVG authoring | `zodiac-narrative-visual` (new) | opus |
| Kit lint, previews, receipts | `zodiac-gatekeeper` | haiku |
| Blind readback | `zodiac-reviewer` | opus, sees only the frame and the line |

## Build order
1. Brief schema + validator (anchor exists in voice, state change tied to an anchor, `claim` present) and derived-omit coverage, behind a flag so old workspaces keep validating.
2. Kit lint module (reuses existing visual-structure/style validators; adds area, safe-zone, no-text).
3. Reuse-check extension, blind-readback protocol and the new agent.
4. Reference doc replacing the current coverage guidance for fresh runs.

## Decisions on the open questions
- Area floor: keep 30,000 px² as the default and allow a per-call `minArea` override; revisit with real episodes before adding per-placement numbers.
- Blind readback: offered, not required. It costs a model call, cannot be verified in CI, and the user's Visual Review is the approval.
