# Post-refactor plugin and asset audit — 2026-10-12

Status: fixed and verified on `codex/zodiac-maintainability-refactor`.

## Scope

Audit after executable-architecture Phase F. The review covered fresh context routing, Phase 2 cache/source recovery, Phase 3 canonical entrypoints, compatibility isolation, V4 asset validation, and a real 1080x1920 asset showcase rendered from the current compiler/library.

## Fixed mismatches

1. **Fresh Phase 2 context loaded extension/legacy catalogs without selection.**
   - Root cause: `selected_guidance_uri` filtering only ran when asset selection was explicitly bound.
   - Fix: guidance filtering always runs; fresh default is `scene_set`; explicit `legacy` mode still retains full compatibility guidance.
   - Result: fresh `visual_compile` dropped from **25 refs / 125,853 bytes** to **22 refs / 76,784 bytes** while selecting `scene_set + character_assembly + story_object`.

2. **Phase 3 production entrypoint still pointed at an orchestration wrapper.**
   - Fix: `orchestration/phases/03-handoff.json` now uses `phases/phase03/run-phase03-production.mjs`.

3. **Phase 2 snapshot restore used a pre-refactor local path.**
   - Fix: restore resolves `core/release/restore-plugin-source.mjs`.

4. **Phase 2 fallback source fingerprint ignored canonical owner trees.**
   - Fix: fallback scan includes `core/`, `features/`, `phases/`, `bootstrap/`, `art-direction/`, the V4 asset library and orchestration wrappers.
   - Missing optional owner roots are skipped so minimal fixtures remain valid.

5. **Selection documentation contradicted fresh compatibility isolation.**
   - Fix: selection guide now states that fresh unbound context keeps core guidance only; complete extension/legacy guidance requires explicit selection or compatibility mode.

6. **SKILL runtime instructions retained pre-F3 wrapper paths.**
   - Fix: Phase 2 transition/execute and Phase 3 production instructions reference canonical phase owners.

Permanent regression coverage lives in `orchestration/tests/post-refactor-audit.test.mjs`.

## Verification

GitHub Actions run `38274287993`:

- post-refactor regression gate: PASS;
- full plugin orchestration/reference suite: **624/624 PASS**;
- V4 asset validator: **PASS**;
- V4 coverage: 6 scene sets, 6 shot layouts, 15 mechanics, 11 meme templates, 14 props, 2 accessories, 6 body profiles, 10 hair profiles, 4 face profiles, 17 outfits, 21 poses;
- fresh visual-compile context: **22 refs / 76,784 bytes**.

## Remaining bottlenecks — not functional failures

These are intentionally not changed before visual review:

- **Character authoring monolith:** most body/hair/pose/outfit geometry is embedded in `characters/compile-character-assembly.mjs`; `characters/components/` currently contains metadata rather than independently authored geometry modules. This is the largest remaining asset-maintenance bottleneck.
- **Fresh context is still ~75 KB:** the remaining largest items are canonical visual-intent, character, Director, Story Object and scene-set contracts/catalogs. Further reduction should be capability-conditional, not blanket trimming.
- **Thin wrapper volume:** orchestration retains many forwarding files for compatibility. They are not active implementation debt now, but physical deletion should wait for a reverse-dependency/deprecation gate.
- **Historical runtime source duplication:** still blocked from pruning by registered compatibility consumers; not on the fresh plugin hot path.

## Visual review candidates exposed by the showcase

The showcase is diagnostic and intentionally exceeds normal production density. It does not imply creative approval.

- Scene-set families are structurally consistent but visually close to one another at thumbnail scale; differentiation may need richer authored cues rather than more background complexity.
- Character silhouette/body/hair variation is readable in the three-character frame.
- Story Object reads separately from scene-set/background when shown as a state progression.
- Semantic effects are visually distinct enough as a family, but their prominence should remain narration-driven in production.
- Meme/contact props should stay socket/contact-driven; the showcase deliberately keeps pants out of the character face/torso interaction to avoid the old semantic failure.

## Preview artifacts

- `docs/previews/zodiac-v4-full-asset-showcase.png`
- `docs/previews/zodiac-v4-full-asset-showcase.svg`
- `docs/previews/zodiac-v4-full-asset-showcase.json`
- reproducible builder: `tools/preview/build-zodiac-v4-asset-showcase.mjs`
