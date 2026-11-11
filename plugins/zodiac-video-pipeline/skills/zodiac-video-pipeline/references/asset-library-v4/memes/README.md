# Native meme actions

`index.json` is the production adapter inventory; `templates/index.json` maps each adapter to its semantic reference. The preview tool enumerates the actual registry, not a curated subset:

```sh
node plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/core/audit/preview-meme-acting.mjs
```

Run from the project checkout, or pass an empty output directory explicitly. The generated `index.html` includes all meme compositions, every catalog pose/expression, setup/reaction replay, search and optional lettering. It uses native SVG assets and scene transforms. Playback is illustrative, without measured audio timing or production approval. Existing episode workspaces cannot be used as demo output.

## Acting

Bind roles to the episode's existing characters. Keep hair/body/shirt identity and select reaction states using `meme_composition.state_bindings`. Reach each reaction with a normal voice-anchored event. Native cast planning and independent validation enforce the adapter's pose/expression/crop at that state.

Adapter IDs, role bindings and entity kinds must match the registry. Frame/mechanic overrides must match the adapter; unknown entities, missing participants and mandatory props fail closed. Semantic interaction templates list character participants only; optional labels/props stay in adapter bindings, outside the interaction participant-role contract. Scene Direction owns final transforms. Explicit effect entities/specifications remain rejected; do not add effect receipt steps.

Six additions adapt the supplied images: waiting, broom warning, farewell, cheek poke, exhaustion and retraction. Three further situation adapters cover innocent shrugging, awkward concession and silent judgment, with reference links in their templates/cards. All eleven older adapters now support optional lettering; heart-offer uses a native heart and mirror-self-check uses an embarrassed expression. Production artwork preserves the channel cast.

## Optional short lettering

All adapters expose an optional object role named `label`. Omit it when the action already communicates the joke. To use it, bind `label` to an authored object with hidden/shown states, layer it clear of faces/captions, and add a voice-anchored reveal at the relevant reaction. Do not change approved narration to fit a stock phrase.

```json
"meme_composition": {
  "id": "polite-exit",
  "bindings": {"actor": "hero", "label": "exit_words"},
  "state_bindings": {"actor": "farewell"}
}
```

The existing prop compiler materializes the bound label asset and its receipt. Unbound optional labels create no asset requirement; required props and participants still fail closed when missing. Labels use outlined Patrick Hand glyph paths, with accessible titles and canonical colors. They contain no SVG `<text>`, script, external image or font dependency and pass Human Stroke validation. Authoring maintenance can regenerate these paths with `python tools/preview/bake-meme-labels.py` in the repository; this is not a runtime dependency.

Keep labels brief, tied to the scene and subordinate to the acting. Do not add them to every beat, cover a face or let them compete with spoken captions. The gallery's text toggle is for comparing legibility; it does not grant episode approval.
