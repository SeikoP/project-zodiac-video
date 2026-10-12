# Environment Frame V1 — Story-Integrated Staging

## Scene-set-first clarification
For fresh Phase 02, the selected `scene-set` is the primary visual stage. `environment.frame` is staging metadata for actors/fixtures **inside or in front of that stage**; it does not own or replace the scene-set. Retired room profiles require an external recovery snapshot; current authoring chooses explicit scene accents or narrated props. Scene accents are minimal context cues and must remain inside the scene-set wall region. Characters may overlap in front of the scene-set and are not required to be contained by its outer frame.

The environment is **an acting scaffold**, not a fixed wallpaper image. Decide
scene action + Story Object first. Then define `scene.environment.frame` on the
authored `production.json` before running native Scene Direction.

```json
{
  "version": "zodiac-environment-frame@1",
  "intent": "Two friends on different sides of the locked door",
  "slots": [
    {"entity":"scorpio","role":"performer","box":{"x":120,"y":490,"width":300,"height":440}},
    {"entity":"friend","role":"listener","box":{"x":740,"y":490,"width":300,"height":440}},
    {"entity":"door","role":"story_fixture","box":{"x":420,"y":300,"width":260,"height":620},"layer":15}
  ],
  "contacts": [{"entity":"door","anchor":"scorpio","relation":"near","max_distance_px":850}]
}
```

All geometry is 1080x1920 pixel-space and must belong to actual source entities.
The frame only reuses native V4 assets. It preserves meaningful relative state
movements and item identity, and refuses to overwrite conflicting spatial edges.
Source asset IDs, actual SVG palette and the channel token must remain V4.

On a primary scene-set, actor-only frames are valid: use performer/listener slots to stage the cast, and add contacts only when a real spatial relation matters. Do not invent furniture merely to satisfy the frame contract.\n\nFor a physical foreground fixture (e.g. cafe table), author a separate foreground
asset/entity, with `role: foreground_fixture`, `layer: 27`, and `occlusions:
[{"fixture":"table","actors":["scorpio","friend"]]`. Its geometry
**must intersect the lower body, not the face**. A single whole-wall SVG cannot
stand in for this foreground silhouette. The compositor uses `state.layer`;
**do not emit new `occlusion_relations` into Job@5** because Renderer 2.0.1
does not declare that contract. Use existing `spatial_bindings` vocabulary.

Required execution order: Story Spine → approved narration → object/scene intent
→ character identity and selected native state assets → authored frame/contacts
→ Scene Direction → Director v2 → Environment Frame Validator → native preview
→ human Visual Review → source lock → Phase 03 ZIP. Static preview endpoints
are not equivalent to actual Remotion frame-by-frame parity.

Legacy projects without frames remain supported. For new fresh plugin 2.4.7+
a scene with a real environment profile and a character requires a frame.
Intentionally isolated character closeups need not introduce a fake backdrop.
