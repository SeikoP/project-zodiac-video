# Hình kể chuyện Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rejected concepts with `story_visual`, finish the Ma Kết build-input package, audit and synchronize the plugin distributions.

**Architecture:** Reuse the existing SVG/state/compiler pipeline. Optional lettering belongs to the same entity and asset. Keep Job@5 transport stable.

**Tech Stack:** Node ESM, Python/fontTools, native SVG, existing phase manifests and ZIP builders.

**Spec:** `docs/superpowers/specs/2026-11-17-story-visual-design.md`

## Global Constraints

- Sole current authoring concept: `story_visual`; optional metadata: `lettering`.
- Narration stays byte-identical. Missing input, invalid geometry, stale source evidence or native failures block progression.
- No new dependency, separate renderer, dual semantic layer or integration flag.
- Preserve original capsules and bind genuine user proof only after current validation.

## Review Focus

- Current context must not deliver obsolete vocabulary or contradictory exclusion rules.
- Words and drawings must change together in one visible state at the correct narration anchor.
- Text-only images must receive the same coverage, lineage and safe-SVG checks as illustrated images.
- A package must include every referenced state asset and retain the existing renderer transport contract.
- Cache, source and Git synchronization must be verified independently of episode readiness.

### Task 1: Replace the authoring contract

**Files:** `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/{contracts,features/visual-composition,references,orchestration}`; corresponding tests; `tools/release/build_split_plugin_bundle.py`; `tools/preview/bake-story-visual-lettering.py`.

**Interfaces:** `validateStoryVisualDirection(plan)`, `validateStoryVisualPresence(workspace)`, `validateStoryVisualLettering(intent,production)`; entity kind/role and asset category `story_visual`; `story_visuals`, `story_visual_decision`, coverage `story_visual`.

- [ ] Update tests to require one visual containing illustration plus optional lettering and reject obsolete role/layer declarations.
- [ ] Run the focused checks and confirm failures before correcting the validators.
- [ ] Rename current modules/imports/manifests, remove duplicate focus conflicts and update safety/provenance checks.
- [ ] Condense prompts into the unified direction/execution guidance; validate Web/Local bundle import closure.

### Task 2: Author and validate the Ma Kết package

**Files:** the explicit `processing/zodiac-capricorn-nguoi-thua-20261116/workspace` and a preserved review backup; native Phase-2/Phase-3 tools.

**Interfaces:** canonical Visual Intent and Narrative Plan → existing authoring/compiler APIs → validated Job@5 build input.

- [ ] Preserve source bytes, add the three demonstrated directions and unified artwork/lettering states, and verify unchanged narration.
- [ ] Run creative input validation before recording the user's actual implementation instruction and exact source hashes.
- [ ] Run native checks, repair their owning source and regenerate only valid affected closures.
- [ ] Inspect phone-size scene and event endpoints, then validate phase evidence and package contents before publishing build input.

### Task 3: Cleanup, audit and synchronization

**Files:** `docs/superpowers/plans/2026-11-17-plugin-cleanup.md`, evidenced fixture/guidance mismatches, source distributions and installed caches.

**Interfaces:** audit findings → narrow fixes with tests → reproducible Web/Local archives and verified installed inventories.

- [ ] Apply only deletions supported by caller/import/package evidence; preserve compatibility required by existing imports.
- [ ] Repair identified fixture closure and context mismatches, and run the relevant regression checks.
- [ ] Obtain a fresh code review, fix material findings and record the final validation limits.
- [ ] Commit/push without force, verify remote refs, rebuild both profiles and verify their installed files against the archives.

## Execution ledger

- Ruling: the current explicit request approves implementation of the demonstrated direction; do not restart design confirmation. The correction replaces both prior concepts rather than adding an embedded mode to either.
- Ruling: cleanup runs after the build-input package, with a separate audit worker limited to evidence gathering and two isolated fixture fixes during implementation.
