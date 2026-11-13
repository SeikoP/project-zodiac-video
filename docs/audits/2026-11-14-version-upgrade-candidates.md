# Zodiac Studio Refactor — V0/V1 Contract and Subsystem Upgrade Audit

> **Status: SOURCE AUDIT / PROPOSED MIGRATIONS ONLY · 2026-11-14.** Repository main inspected, without running full tests or reading the user's Windows working copy. "Version 1" in a filename does **not** prove low implementation quality. Only create v2/v3 when the wire format/semantics must change and preserve validated legacy readers.
>
> Parent: [Unified Studio](../superpowers/specs/2026-11-14-agent-native-creative-studio-design.md) · [Compiler VNext](../superpowers/specs/2026-11-14-zodiac-compiler-refactor-design.md) · [Visual V5](../superpowers/specs/2026-11-14-zodiac-visual-v5-color-system-design.md) · [Audio System](../superpowers/specs/2026-11-14-zodiac-audio-library-sound-design.md).

## 1. Confirmed relevant existing V1 contracts

| Current on main | Next major / treatment | Why upgrade or preserve | Owner and phase |
| --- | --- | --- | --- |
| `contracts/performance-context-v1.schema.json`; `tools/control_plane/performance.py` | **v2 HIGH**: scene/beat-anchored performance graph, performer action, gaze, contact, ownership, reaction reveal, measured voice anchor; truthfully separate TTS *requested* direction from audible control | Existing v1 delivery/energy/emotion/pace and transition duration cannot fully express V5 semantic acting. No automatic voice-performance verification claim | P3 compiler / P4 editor, keep v1 adapter |
| `plugins/.../contracts/motion-registry-v1.json` | **v2 HIGH**: semantic transitions/hand-contact/reaction anchors with capability flags and renderer-independent fallback | Existing registry maps a small set of named transitions to renderer motion/duration, not richer V5 interaction | P3/P4; old motion IDs still legal |
| `contracts/timing-v1.schema.json` | **v2 HIGH**: selected take/audio hashes, exact approved narration byte ranges, measured speech units/pauses and stable trigger anchors | Existing v1 expresses frame/scene/caption timings, but lacks first-class source-bound speech-unit anchors and precise audio-cue timing | P2, migration v1→v2; never infer speech |
| `contracts/render-plan-v1.schema.json` | **v2 HIGH**: renderer-neutral validated scene graph/asset, state, motion, theme fingerprint and audio-cue references; export adapter compatibility | Current v1 is the pinned Remotion-facing plan. Moving to HyperFrames requires a common derived source with no second authoring owner | P3/P7, keep Remotion v1 adapter until full parity |
| `contracts/authoring-ir-v1.schema.json` | **CONDITIONAL v2** *only if retained as an active interchange*: narrowed actor/prop contact and source links; otherwise treat as legacy compiled/interchange adapter | The canonical creative source is `.authoring/visual-intent.json`. Do **not** create a second editable Authoring IR v2 with competing ownership | P3 owner review and adapter tests |
| `zodiac-visual-intent@1` currently authored in `.authoring/visual-intent.json` | **CONDITIONAL v2, HIGH migration risk**: only if first-class theme/performance refs cannot be added compatibly | Must remain ONE creative source. A changed format needs explicit decoder, versioned schema, golden fixtures and byte-locked narration; new rich fields alone are not a reason for a freeform second source | P3/P4, preserve v1 read compatibility |
| `contracts/publish-v1.schema.json` | **v2 MEDIUM**: actual export artifacts, cover/caption/voice/mix provenance, track license/attribution notes, "exported" != "published" | v1 is minimal and shouldn't be mistaken for a complete publish receipt | P6/P7, retain old ZIP v1 reader |
| `docs/contracts/caption-rendering-v1.md` | **v2 CONDITIONAL**, only if adding *new* source-aware segment/anchor/safe-area data not representable in current runtime | Current renderer already supports two-line Vietnamese caption machinery; rewrite docs/tests before a schema bump | P2/P7 |
| `contracts/design-token-v4.schema.json`, V4 `foundations/style-token.json` | **v5 HIGH, not v1→v2**: role-based diverse theme, character identity-safe colors, contrast and stable font tokens | Keep old V4 style token for legacy, new `zodiac-visual-theme@1` for V5 as a distinct contract | P3 base resolver, P5 vetted theme library |
| `plugins/.../references/contracts/director-plan-v1.schema.json` | **Do not blindly v2**; investigate source-of-truth and retire duplicate director authoring if newer Visual Intent/Director V2 already supersedes it | File title says “Director v2” while its format is `zodiac-director-plan@1`; this is a naming/ownership red flag, not evidence that simply renaming it fixes quality | P0 ownership audit / P3 compatibility |
| `plugins/.../contracts/production-model-v1.schema.json` | **Keep v1 as legacy adapter** unless new functionality truly consumes it | New canonical Visual Intent / typed scene graph supersedes full model duplication | P3 compatibility |
| `contracts/error-v1.schema.json` and `contracts/manifest.json` (`zodiac-contract-registry@1`) | **Keep v1** unless their *own* wire semantics change | Stable error and registry metadata aid backward compatibility; version inflation has no benefit | P0/P3 regression |
| `contracts/zodiac-job-v5.schema.json` | **Keep v5** for existing package import/export | No need to bump old Job@5 merely because Studio adopts V5 artwork; optional new package must negotiate or embed versioned media manifest | P6/P7 |
| `tools/studio_v2/executor.py` `AUDIO` stage, internal producer version `1` | **Audio mix engine v2 HIGH** (internal implementation version) + new **`zodiac-audio-design@1`** contract; don't pretend an old audio-design schema exists | Current path can mix one looping music track with voice at fixed gains, but has no cue tracks/ducking/rights proof/preview score | P5 library and P7 mixer, optionally P2 audition/preview |

## 2. What was NOT found

- No standalone public “v0” contract path appears in the audited root `contracts/` tree. Internal legacy naming, version numbers and plugin versions may exist elsewhere; a comprehensive schema registry scan in P0 remains required.
- V4 already has content state dedup planning, scene-native worker/cache and several V1 scene concepts; making every ID v3 does not optimize execution.
- The current Studio V2 audio mixer already accepts `music_path` and `mix_settings`, with defaults `volume=0.2`, `voice_volume=1.0`, loops music via `-stream_loop -1` and mixes with FFmpeg `amix`. Audio v2 is justified by **new behavior**, not just a file rename.

## 3. Versioning and migration policy

- **Contract major** only for incompatible semantic or structural changes. Define validator+decoder per version, deterministic v1→v2 projections where possible, and source/handoff/output fingerprints including contract version.
- **Runtime/plugin/package version** is an independent lifecycle: do not infer it from a schema name, or unilaterally bump plugin version on a docs-only PR. Every migration requires unit/negative tests and legacy completed-episode open/replay.
- **New contracts start @1:** `zodiac-audio-design@1`, `zodiac-visual-theme@1`, `zodiac-v5-performance-graph@1` if a separately materialized **derived** performance graph is needed. Do not call them v2 because nearby contracts use v1.
- **No duplicated native and plugin schema owners:** retain `contracts/manifest.json` as public contract registry; use generated plugin bundle and hash tests for mirrored schemas, not independent manual copies.
- **Priority:** first ship P2 timing semantics and P3 compiler/performance/motion/theme contracts; P5 media library schema and P7 audio/export metadata follow. Keep untouched formats pinned when old runtime needs them.

## 4. Required migration tests

For each bumped schema: v1 fixture still loads through explicit legacy adapter; invalid v2 is BLOCKED with a named issue; render output follows same approved narration SHA; unknown/missing optional fields never cause fabricated approvals; old ZIP retains deterministic hash; theme-only edit doesn't invalidate voice; music-only or SFX-only edit doesn't rerender visual segments; SFX cue referencing missing audio/time is BLOCKED; rights-unknown music cannot be marked publish-ready.
