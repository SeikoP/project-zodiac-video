# Job0–Job5 × Runtime 0–2 audit — evidence inventory

Audit baseline: runner `main@c5380f91` plus the current `video-pipelines` plugin 2.1.6. This is an **inventory**, not a certificate of end-to-end feature parity.

## Terminology and historical coverage

The currently installed plugin has three review phases: `01-content`, `02-visual-production`, `03-handoff`. The current runner has seven executable Studio steps: `PACKAGE → VOICE → TIMING → PLAN → RENDER → AUDIO → OUTPUT`. These names are not equivalent to old Job0–Job5 numbers. Mapping historical Job0–Job4 to either set without source revisions would be speculation; restore their versioned specifications from Git history before stating exact migrations.

Repository runtime directories checked under `runtime/`:
- `zodiac-remotion`: 1.14.0, 1.15.0, 1.16.0, 1.17.0, 1.18.0, 1.18.1, 1.19.0, 1.19.1, 1.20.0, 1.21.0.
- `zodiac-renderer`: 2.0.0.
- **No runtime 0.x source was found in the current repo tree.** Historic runtime 0.x parity cannot be certified without recovering its commit/archive.

## Current end-to-end evidence and failure surfaces

| Boundary | Producer → consumer | Existing proof | Unverified or known regression |
| --- | --- | --- | --- |
| Idea → script | Plugin content phase | Evidence/concept/narrative validators | Narrative quality & visuals must be reviewed |
| Script → V4 visuals | Plugin visual phase | Character identity, environment, meme/visual validators | Asset generation and spatial semantics can disagree |
| Visuals → Job@5 ZIP | `compile-job-v5.mjs` → handoff workspace/ZIP validator | Canonical IR and contract hash, exact asset references | Schema validity does **not** prove the intended prop/effect is prominent |
| ZIP → Studio PACKAGE | Job@5 importer → `production.ir.json` | Contract hash and safe filesystem package checks | Metadata may be present but not consumed by every runtime output |
| PACKAGE → VOICE | narration → per-scene WAV and `voice.wav` | Text identity and scene caching | Scene gaps formerly defaulted 0ms; sentence pauses not enabled in current Studio v2 |
| VOICE → TIMING | measured WAVs → global words/timeline | Aligner and per-scene cache | Gaps must match the actual concatenated audio; verify total duration within 1 frame |
| TIMING → PLAN | Authoring IR + measured timing → render plan | Timeline tests, state/event checks | Semantics of action may be lost although state IDs survive |
| PLAN → RENDER | hydrated SVG → Remotion | Renderer smoke and frame tests | Composition correctness, shot roles, font line fit, temporal prop/effect readability |
| RENDER → AUDIO | video frames + voice + background music | Studio AUDIO step exists | Auditory mix quality, SFX catalog equivalence still unproven |
| AUDIO → OUTPUT | final MP4 + publish metadata + cover | Cover still was restored by PR #63, but invoked as separate command | Confirm automatic cover export in Studio, full publish artifact set, end-of-video tail |
| Review → production | actual Remotion stills, end-user review | renderer-faithful preview CLI | Three sample frames are not proof of every animated beat |

## Job@4 / runtime 1.21 vs Job@5 / runtime 2.0 confirmed parity gaps

- Legacy `ZodiacCover`, cover/export still and publish metadata were not fully wired in new runtime; PR #63 restores the Remotion still and CLI, **not automatic Studio OUTPUT orchestration**.
- Legacy semantic/performance animations (`semantic-animation.mjs`, `performance-animation.mjs`, `ZodiacComposition.tsx`) do not have proven feature-complete replacements in `ZodiacRenderPlan.tsx`.
- `generate-sfx.mjs` exists in legacy renderer; determine whether the external AUDIO step replaces it rather than treating the absent renderer file as proof SFX is unavailable.
- The original HTML review mocked scene positions, timing and font. Use `scripts/preview.mjs` stills of the actual renderer instead.
- `spatial_bindings` verify anchor distances but not the intended storyteller's actor/receiver. An image can pass validators and still depict the wrong action.
- Output acceptance must include full final syllable/tail, cover and publish copy, not solely an imported ZIP or a passing unit test.

## New voice pacing baseline

- `scene_gap_ms` default: **180 ms** (previously 0 ms) in BOTH Studio v2 voice concatenation and measured-timing generation. Overrides remain respected, including 0 ms.
- Speech synthesis rate is **unchanged**. Pauses are separate from vocal speed, so requests for a livelier voice must be solved at the TTS engine, not with smaller time gaps masquerading as faster speech.
- `sentence_pause_ms` remains 0 in Studio v2 timing and is intentionally **not advertised as fixed**; implementing it correctly requires rebuilding `voice.wav` after word alignment, synchronizing caches/plan, and testing punctuation-token boundaries. Never update timing only while WAV remains unmodified.
- Recommended later voice experiments: tune a **short** 180ms inter-scene default, preserve speech speed, and compare against 0/120/250ms using actual 12-scene waveform and final MP4. Don't confuse intentional pauses with CPU generation latency.

## Production gate (must all pass)

1. Gather historical Job0–Job4 design docs/commits and runtime 0.x if they actually existed; otherwise explicitly record unavailable evidence.
2. Introduce a machine-generated per-scene asset/role/state/event trace from ZIP → plan → first/median/final render still.
3. Run a known Job@4 sample through its compatible legacy runner and an equivalent Job@5 sample through renderer 2.0; compare feature and story semantics, not exact pixels.
4. Verify the post-render audio matches timing, subtitle lines fit, cover/publish artifacts exist, and no scene's visual payload disappears.
5. Keep production status **NOT VERIFIED** until real video and all 12 representative stills receive visual approval.
