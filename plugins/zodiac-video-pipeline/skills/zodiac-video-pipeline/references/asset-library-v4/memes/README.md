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

Keep wording brief and tied to the scene. When the words carry the joke, make them the focal payoff with supporting acting; see `references/story-text.md`. Use an independent authored Story Text overlay for scene-specific wording and omit the stock `label` binding. Do not add lettering to every beat, cover a face or let it compete with spoken captions. The gallery's text toggle compares acting and lettering; text-free acting alone does not validate a wording-led joke and does not grant episode approval.

The inventory now includes 30 situations. The 2026-11-13 user references add pleading, sarcastic applause, stunned surprise, contempt, ultimatum, remorse, confusion, interruption, mock authority and a call for help. The water-pistol reference enriches `take-that-back`. References guide native acting and wording; they do not replace the channel cast. Longer stock phrases use two outlined lines with a coral payoff line rather than smaller lettering.

All 30 demo situations and stock phrases were reworked after the initial review rejected their humor. They now pair concrete social situations with a reversal, native `meme-*` facial performance and explicitly authored semantic line breaks. Quiet dialogue expressions remain separate. Solo reactions use closer framing; held-prop layouts now meet the performed grip instead of floating over a face. These are candidates for creative review, not an approved humor library. The gallery shows the setup beside the reaction and suppresses a demo caption only when it actually repeats the stock wording.

## Humor review

- Pleading/regret: `plead-mercy`, `never-again`; distinguish anxious clasped hands from seated tears.
- Mock praise/sudden surprise: `sarcastic-applause`, `stunned-wow`.
- Contempt/ultimatum: `contempt-dismissal`, `ultimatum-choice`.
- Confusion/cutting someone off: `confused-shrug`, `stop-talking`.
- Mock authority/overreaction: `serious-please`, `call-for-help`; the phone must meet the hand and ear.

Choose the meme's social move and verbal turn, not merely a different pose. Avoid repeating the same reaction in adjacent beats unless it is an intentional callback. For wording-led memes, make the recognizable phrase the focal Story Text at the reaction anchor; use the text hierarchy and phone-size check in `references/story-text.md`. Keep the normal setup quiet so the reaction and words arrive together.

The native adapters use performed `meme-*` expressions, not the small dialogue faces. Keep the setup face ordinary; exaggerate eyebrows, mouth, gaze, tears or asymmetry at the reversal. Close up a solo reaction when its face carries the joke; preserve hand/prop contact for physical actions. A stock phrase plus a neutral sticker is not a finished meme.

Test the joke with a concrete setup and consequence: a muted speaker mistaken for a muted microphone, a long shopping receipt contradicting “có tí”, or praise that exposes obviously bad logic. The reaction must reveal, contradict or escalate something the setup made us expect. “Mình hoàn toàn ổn / Ổn được ba giây” and labels naming emotions are insufficient by themselves. Registry demos are review candidates, never lines to paste into approved narration or evidence that viewers will laugh.
