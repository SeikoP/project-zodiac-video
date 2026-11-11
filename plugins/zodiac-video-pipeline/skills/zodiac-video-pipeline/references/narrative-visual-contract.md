# Narrative Visual — Hình ảnh diễn giải

Fresh authoring uses a single symbolic visual category: `narrative_visual`. It represents thoughts, emotions, comparisons and metaphor according to **narrative purpose**, never merely its SVG shape.

- Independent of background, Scene Accent, effect and physical interactive prop.
- Every fresh video requires at least one visible Narrative Visual, with `narrative_visual_decision.mode=required`. Provide a narration-anchored transition between meaningfully different visual states and a narrative brief stating the claim; actor pose or phone states do not replace this layer.
- Placement: canvas, above-head, near-actor or between actors, without physical grip/contact.
- Maintain identity across states; avoid duplicate `story_symbol` / `story_object` entities.
- Use optional accenting effects only when narration warrants them.
- Actor coordinates and captions remain independent and frame-safe.

Compatibility: producer projects new `narrative_visual` into the existing Job@5 `story_object` role. Legacy Story Object, Story Symbol and Visual Metaphor contracts are read only through explicit compatibility; no unsupported IR/schema hash change. Do not fabricate review approvals.
