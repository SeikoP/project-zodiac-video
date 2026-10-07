# Meme v3.1 cross-asset integration

This repository intentionally does **not** add a new runtime schema for Meme v3.1.
The plugin compiles reusable pose recipes into the existing production v2 entity/state/event contract before handoff.

## Compatibility boundary

- Runtime remains `zodiac-remotion@1.16.0`.
- Recipe IDs are authoring-time hints only; `production.json` must not require the runtime to understand `fake_flex`, `rose_peek`, or any other recipe name.
- Existing performance metadata, semantic captions, local TTS/timing, and render flow remain unchanged.
- Existing pacing defaults remain authoritative: playback `0.95x`, scene gap `350ms`, sentence pause `320ms`.

## Approved compile-time recipes

`fake_flex`, `awkward`, `emotional_damage`, `heart_offer`, `damage_run`, `banner_bonk`, `rose_peek`, `receipt_shame`.

Recipes are accelerators, not a whitelist. A story-required state may be derived without a named recipe.

## Hard attachment semantics

- `fake_flex`: one hand visibly grips/pulls the chain.
- `awkward`: snot is the primary seasoning; reaction clutter is not stacked.
- `emotional_damage`: both hands cup the broken heart.
- `heart_offer`: both hands present the heart as an offered object.
- `damage_run`: lean + tear stream + optional speed lines; no heavy loop animation.
- `banner_bonk`: both hands visibly support/contact the lowered board; floating board fails.
- `rose_peek`: the rose stem touches the mouth anchor; near-face floating fallback fails.
- `receipt_shame`: reuse the existing receipt master and keep emphasis tiny.

## Repo responsibility

The repo validates the unchanged local runtime boundary and pacing defaults. Asset recipe selection, cross-asset anchor resolution, and attachment validation remain plugin authoring concerns. If a future compiled production package requires a new runtime field, that is the point where a runtime version bump must be considered.
