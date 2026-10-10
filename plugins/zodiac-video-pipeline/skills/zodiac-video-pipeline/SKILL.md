---
name: zodiac-video-pipeline
description: Use when producing or resuming a Vietnamese Zodiac sticker-story video.
---

# Zodiac Video Pipeline

Follow `orchestration/router.md`: 01-content → 02-visual-production → 03-handoff.

**Fresh Run Isolation:** do NOT use account/personal memory; do NOT auto-load old approved packages. Preserve only evidenced approvals.

**Character:** Read `references/character-depth-v2.md` and `references/character-viral-performance.md`.

Use structural environment cues. Missing source needs verified GitHub Actions source-artifact fallback.

**Phase 01:** `references/content-quality-engine.md` requires three premises before hooks and a six-criterion critique after Narration; no automatic creative PASS. Keep `character_deconstruction`, evidence/Story Spine-first order, `TONE_GAT_DEFAULT` sharp Vietnamese narrator and immutable approvals. Fresh 2.4.13+ requires `concept-candidates.json` and `story-quality-review.json` with native validators. Weak stories return to Concept.

**Environment Frame:** Preserve authored slots, contacts, foreground and state motion; see `references/environment-frame-system.md`.

**Story Object:** Require metaphor, escalating effect events and callback; see `references/story-object-effects.md` and `orchestration/validate-story-object.mjs`.

**Story Object Composition v2 (fresh 2.4.11+):** Read `references/story-object-composition-v2.md`. Choose `thought_metaphor`, `physical_interaction` or `visual_cutaway` before background. Author object, actor and environment independently; metaphorical object never replaces background. Director Review and release gate `validate-story-object-composition.mjs`. Preserve older reviewed compatibility.

Require story-first `character-assembly-plan@2` before SVGs; see `references/character-design-intent.md`.

**Phase 02:** Follow `references/director-performance-v2.md`, Visual Grammar v4, Human Stroke v2, native V4 assets and `references/design.md`. Create `.authoring/director-plan.json` before drawing; state count by action. Preserve identity, contacts and prop/effect lifecycle. Renderer does not animate limb groups. After compilers, run `node orchestration/run-director-v2-review.mjs <workspace>` with `build-native-preview-pairs.mjs` and `validate-native-preview-pairs.mjs`. Reject stale receipts; require human Visual Review approval.

**Phase 03:** Preserve `zodiac-job@5`, `zodiac-renderer@2.0.1`, naming `zodiac-<sign>-<concept>` and a single ZIP via `run-phase03-production.mjs`. Seal approved source; verify immutable Narration/assets, model/IR parity, role sizes, spatial/effect lifecycle, font, `✦ bungmoto`, cover/publish, runner import and ZIP roundtrip. No bypass or extra phase.

TTS, measured timing, Remotion preview, MP4/audio and frame-by-frame parity belong to the local runner; ZIP-ready is not video-ready. Use `execution-bootstrap.md` and `execution-preflight.mjs`; missing source blocks. Plugin Creator updates releases only, not production source transport.


## Cover Composition v2 (new v2.4.14)
Fresh Publish Prep must read `references/cover-composition-v2.md`, include `cover.design` derived exclusively from V4 style token and scene-native assets, run `node orchestration/validate-cover-design.mjs <workspace>` before Visual Review. Explicitly note the runtime must implement title shadow and scale; producer validation cannot assert final cover.png pixel parity. Do not replace environment with story object. Old approved covers remain compatible via `--allow-legacy` only.

**Phase-02 Art Direction:** Follow `orchestration/scene-art-direction.md`; bind narration to environment, palette and actions. Keep exploratory scene-specific validators optional; preserve native compile, human review and runner parity.

**Background-only Policy v2.4.38:** Read `references/background-only-policy.md`; Environment Compile auto-creates architectural ambiance only, never story furniture. Narration-required desks/beds/chairs remain separate semantic props with explicit event/relations; backgrounds must remain visibly distinct and scene-set color-aware.

**Precompile:** Read `orchestration/phase02-precompile-seam.md`.

**Composition 2.4.44:** Read `orchestration/phase02-composition-contract.md`. Persist components, geometry, roles, depth in Art Direction; rehydrate with `phase02-composition.mjs --context` on resume. Precompile and Director Review enforce it. Update runner for matching schema.
