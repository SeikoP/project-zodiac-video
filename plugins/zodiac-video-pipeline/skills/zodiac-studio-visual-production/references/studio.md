# How Studio maps onto Phase 2

## Pipeline nodes
`content` (gate) → `voice` → `voice_review` (gate) → `timing` → **`visual`** (author the Visual Intent) → `checks` → `assets` → `cover` → `publish` → `scene` (per-scene fan-out) → `build` → `inspect` → `visual_review` (gate) → `export`. Status is derived from on-disk evidence; the UI never stores it. Gates are completed only from the GUI.

## Authoring chain (constructive)
cast → per scene **stage** (frame, mechanic, who is present with which state, props with a role, dressing, the **accent** that sets the place) → per scene **act** (events: anchor, target, short action, new state) → Core assembles the scene → compile that scene → look at its frame. The agent chooses from menus of ids that exist; the answer schema makes any other id impossible. Core adds coordinates, asset keys, layers, trigger text, profile and focus.

What Core already guarantees, so do not spend effort on it: one prop per family (dressing included, extras dropped with a note); no overlapping actors and props; the story visual in its own top band; props standing on the actors' floor line; frame and mechanic compatible (it substitutes the nearest valid pair and reports it); events of one target never overlapping in time; centred composition. It reports what it changed in `core_notes`.

## What the agent must still decide well
Cast and identity reasons; the story mode and focus of each scene; which props the narration physically needs and which anchor each event lands on; the **setting of each scene** (scene accent, see `scene.md`); whether a Story Visual earns its place; acting that moves the story and reads at phone size. An agent that picks the same prop family for dressing and a handled prop, or an event on every word, is not using the skill.

## Known gaps (state them, do not paper over them)
- The scene accent is drawn by Core from the parts you choose (window, awning, door, shelf, lamp, clock, board, menu board, sign, string lights, plant, curtain, picture, map, calendar, counter, tree), or is one of the registered library cues. Part drawings are Core's own and still need the owner's visual review. A place these parts cannot draw is a request for new art (`none_fits`), never a filler prop.
- Cover opening, background music and sound effects are not yet supported by the HyperFrames export; unsupported requests are blocked, not silently dropped.

## Renderer: HyperFrames only
Preview and export share one deterministic painter, so what the editor shows is what exports. A composition is HTML over a seekable timeline: no wall-clock time, no randomness, no network. HyperFrames' own `check` (lint, safe zones, contrast, overlap, line hold, sound) is the free quality gate; its findings are advisory until the owner decides otherwise. The legacy Remotion path is not part of Studio.

## Never
Fabricate art or SVG; invent ids outside the menus; write coordinates; approve a gate; claim a build "passes" without the check's own output.
