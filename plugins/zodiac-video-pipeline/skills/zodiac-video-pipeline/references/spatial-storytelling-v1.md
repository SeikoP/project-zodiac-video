# Spatial Storytelling v1 — V4 / Job@5

Purpose: stop narratively incorrect visuals caused by applying one generic prop/effect coordinate across unrelated scenes. This is a **semantic authoring contract**, not a new runtime motion system.

## Who owns what
Before generating or positioning sprites, identify each scene's speaker, listener, owner, receiver, focal prop and reaction locus. Resolve actor identity and outfit from V4, then build the scene's `spatial_bindings`. For each `story_prop` and `story_effect` in a newly authored scene, emit a separate row:

```json
{"entity":"story_effect","anchor":"scorpio","relation":"emitted_by","max_distance_px":375}
```

Fields: `entity` and `anchor` must name distinct existing scene entities; `relation` is one of `near`, `held_by`, `on_surface`, `emitted_by`, `points_to`; `max_distance_px` is an explicit positive image-space bound. Never silently assume `scorpio` is always the owner. For example, a notification effect may belong to the **receiver** rather than the sender.

## Required quality gates
1. Verify the intent in the narration: who acts, who reacts, and what changes between before/after.
2. Pre-plan V4 SVG assets. Reuse assets only when the same semantic role fits. If a composite prop refers to opposing speakers, split roles before asset creation or return the scene for review; a single `story_prop` cannot be simultaneously held by two people.
3. Check every visible state against its anchor, not only its initial state. A dimension/distance pass is a necessary but insufficient proof of the story.
4. Keep props and effect labels out of the caption safe zone, respect visual size while allowing narrow phone shapes, and ensure reaction effects are salient enough to read.
5. When voice triggers imply ordered prop actions, author actual before/after states and explicit motion events rather than relying on a generic initial fade.
6. Review beginning/middle/end images from the **real Remotion renderer**, with the same Job@5, measured timing, bundled font and render plan that will produce the MP4. A bespoke CSS mock is not parity evidence.

## Compatibility
- The optional field permits import of historical Job@5 packages. **New** V4 scenes with `story_prop` or `story_effect` must author bindings before approval.
- Plugin and runner must share the exact `authoring-ir-v1.schema.json` fingerprint. Required fields, enum and distance validation are common. Contract changes require synchronized PRs.
- Timing and transitions are runner-owned. Authoring must not export measured audio timing or executable frames.
