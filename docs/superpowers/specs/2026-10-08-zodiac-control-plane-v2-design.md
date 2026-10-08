# Zodiac Control Plane v2 — Design Specification

**Status:** Proposed for implementation  
**Date:** 2026-10-08  
**Branch:** `refactor/zodiac-control-plane-v2`

## 1. Purpose

Zodiac v1 proved the content and visual-authoring direction, but the handoff/runtime boundary became unstable because the same rules were implemented independently in the plugin, Python runner, Studio state machine, Remotion runtime, JSON schema, style-token parser, and render script. A change in one layer repeatedly exposed a different incompatible rule later in the pipeline.

Control Plane v2 redesigns the boundary from **Handoff → Studio → Timeline → Renderer** while keeping the current content and Visual Grammar v4 authoring work.

The target outcome is:

- package incompatibility is rejected before TTS;
- semantic visual events are scheduled only after measured timing exists;
- target/event overlap is resolved or rejected before render;
- visual-only changes reuse voice and timing artifacts;
- the renderer does not infer, repair, schedule, or reinterpret creative intent;
- one canonical contract family is used by plugin, Studio, compiler, and renderer;
- renderer releases are immutable;
- the Scorpio “Hai phiên bản” job becomes the golden end-to-end regression fixture.

## 2. Non-goals

This redesign does not replace:

- Content Engine / evidence / narration flow;
- Visual Grammar v4;
- Character Assembly;
- environment compiler;
- SVG asset library;
- VieNeu / TTS selection;
- faster-whisper alignment;
- Remotion as the rendering engine;
- existing watermark/caption visual direction;
- the three user-facing plugin phases: `01-content → 02-visual-production → 03-handoff`.

The v1 plugin/runtime line remains available as legacy. No further feature work is added to runtime `1.21.0`.

## 3. Architecture

```text
01-content
    ↓
02-visual-production
    ↓
03-handoff
    ↓
zodiac-job@5
    ├─ production.ir.json
    ├─ design-token.json
    ├─ narration.txt
    ├─ assets/**
    └─ publish/**
            │
            ▼
      Studio Control Plane
            │
      ┌─────┴─────────────┐
      ▼                   ▼
   Voice/TTS          Static validation
      ▼
   voice.wav
      ▼
   Alignment
      ▼
   timing.json
      │
      └──────────┐
                 ▼
          Timeline Compiler
                 ▼
          render-plan.json
                 ▼
          Render Plan Validator
                 ▼
          zodiac-renderer@2.x
                 ▼
             MP4 / cover
```

### Ownership rule

Each concern has one owner:

| Concern | Owner |
|---|---|
| Story / visual intent | Plugin authoring |
| Schema compatibility | Canonical contracts |
| Measured speech timing | Alignment stage |
| Event frame scheduling | Timeline Compiler |
| Target-lane conflict resolution | Timeline Compiler |
| Render-plan correctness | Plan Validator |
| Frame rendering | Renderer |
| Cache/reuse and orchestration | Studio |
| Error presentation | Studio TUI from structured error objects |

No later layer may silently reinterpret an earlier layer’s responsibility.

## 4. Canonical contracts

Create a single canonical contract directory:

```text
contracts/
├─ zodiac-job-v5.schema.json
├─ authoring-ir-v1.schema.json
├─ timing-v1.schema.json
├─ render-plan-v1.schema.json
├─ design-token-v4.schema.json
├─ publish-v1.schema.json
└─ error-v1.schema.json
```

Python and Node validators load these files directly. Generated language bindings are allowed, copied rule logic is not.

### Package manifest

`package-manifest.json` for v2:

```json
{
  "format": "zodiac-job@5",
  "contract": {
    "id": "zodiac-authoring-ir",
    "version": "1.0.0",
    "sha256": "<canonical-contract-hash>"
  },
  "renderer": {
    "id": "zodiac-renderer",
    "version": "2.0.0"
  },
  "producer": {
    "plugin": "zodiac-video-pipeline",
    "version": "2.0.0"
  }
}
```

Studio validates this handshake during package import. Unsupported contract or renderer compatibility fails at `PACKAGE`; no TTS, alignment, or render step starts.

## 5. Authoring IR

The plugin exports **semantic intent**, not final frame scheduling.

Example:

```json
{
  "id": "E22",
  "target": "scorpio",
  "intent": "reaction",
  "trigger": {
    "type": "voice_anchor",
    "text": "..."
  },
  "state_before": "guarded",
  "state_after": "side_eye",
  "desired_motion": "reaction_pop",
  "scheduling": {
    "max_drift_frames": 8,
    "merge_policy": "same_intent_same_state"
  }
}
```

The IR must not contain runtime-derived `start_frame`, `end_frame`, `anticipation_frames`, `hold_frames`, or `settle_frames`.

Legacy `zodiac-job@4` may be imported through an adapter, but new production jobs are emitted only as `zodiac-job@5`.

## 6. Timeline Compiler

The Timeline Compiler is the only component allowed to convert semantic events into executable frame ranges.

### Inputs

- `production.ir.json`
- `timing.json`
- `design-token.json`
- canonical contract version

### Output

- `render-plan.json`

### Required scheduling algorithm

For each scene:

1. Resolve each trigger to a preferred frame from measured word timing.
2. Group events by target lane.
3. Preserve authored event order.
4. If a preferred interval is free, schedule it unchanged.
5. If it overlaps a prior event on the same target:
   - merge only when policy explicitly allows the same semantic intent/state;
   - otherwise shift the later event to the prior event end.
6. If the required shift exceeds `max_drift_frames`, emit `TIMELINE_TARGET_CONFLICT`.
7. Enforce scene bounds.
8. Freeze deterministic intervals.
9. Revalidate zero same-target overlap.

The compiler must be deterministic: identical inputs produce byte-identical normalized `render-plan.json`.

### Render-plan event

```json
{
  "event_id": "E22",
  "scene_id": "S02",
  "target": "scorpio",
  "start_frame": 192,
  "end_frame": 204,
  "state_before": "guarded",
  "state_after": "side_eye",
  "motion": "reaction_pop"
}
```

The Scorpio E22 overlap that currently fails in the renderer becomes a compiler regression case: either it is serialized within drift allowance or fails in `PLAN`, never in `RENDER`.

## 7. Render Plan Validator

The validator runs before renderer startup and owns executable-plan checks:

- contract/schema validity;
- scene frame bounds;
- event IDs unique;
- event order deterministic;
- no same-target overlap;
- valid state transitions;
- asset/state references exist;
- visual density measured from final scheduled frames;
- caption ranges inside scenes;
- camera lane validity;
- SFX references;
- final landing hold;
- renderer-compatible design token;
- no unresolved semantic triggers.

A render plan accepted by this validator must not later fail because of semantic scheduling.

## 8. Renderer 2.0

`zodiac-renderer@2.0.0` is a **dumb renderer**.

It may:

- load and schema-check `render-plan.json`;
- read assets;
- render captions, characters, props, camera, SFX, cover, watermark;
- write video and image outputs.

It must not:

- resolve voice anchors;
- infer event timing;
- materialize semantic defaults;
- merge/shift events;
- validate narration progression;
- compile style tokens from markdown;
- repair lineage;
- classify business errors.

`design.md` becomes documentation only. Runtime input uses `design-token.json`.

Renderer releases are immutable. Any changed byte requires a new renderer version and manifest hash generated by CI.

## 9. Studio state machine

New user-visible pipeline:

```text
PACKAGE → VOICE → TIMING → PLAN → RENDER → AUDIO → OUTPUT
```

Each stage records:

- input hash;
- output artifact hash;
- status;
- structured error;
- whether the output was generated or reused.

Example UI semantics:

```text
PACKAGE   ✓ validated
VOICE     ↺ reused       12/12
TIMING    ↺ reused
PLAN      ✓ compiled     90 events
RENDER    ● running      63%
AUDIO     ○ waiting
OUTPUT    ○ waiting
```

The active package revision is independent from the physical workspace folder name.

## 10. Artifact cache v2

Cache keys are dependency-based:

```text
voice_key =
hash(narration + voice_id + TTS_settings + TTS_engine_version)

timing_key =
hash(voice.wav + narration + aligner_settings + aligner_version)

plan_key =
hash(production.ir + timing + design-token + timeline_compiler_version)

render_key =
hash(render-plan + assets + renderer_version + renderer_hash)

audio_key =
hash(rendered_video + music + mix_settings)
```

Required behavior:

- visual-only patch: reuse VOICE and TIMING;
- narration change: invalidate VOICE and downstream;
- timing configuration change: reuse VOICE, invalidate TIMING and downstream;
- renderer-only upgrade: reuse VOICE/TIMING/PLAN when render-plan contract remains compatible;
- music-only change: reuse through RENDER and rebuild AUDIO only.

ZIP filename and workspace directory are never cache keys.

## 11. Structured errors

All executable stages return the canonical error schema.

Example:

```json
{
  "ok": false,
  "code": "TIMELINE_TARGET_CONFLICT",
  "stage": "PLAN",
  "scene_id": "S02",
  "event_id": "E22",
  "target": "scorpio",
  "detail": {
    "preferred_start": 188,
    "prior_end": 192,
    "max_drift_frames": 3
  }
}
```

Studio displays the error object. It must not infer error codes from substrings such as `npm`, `node`, `close`, or `schema`.

## 12. Scorpio golden fixture

Add:

```text
tests/fixtures/scorpio-two-versions/
├─ package/
├─ voice.wav
├─ timing.json
└─ expected/
   └─ render-plan.json
```

The fixture preserves dense real-world events, including an overlap equivalent to E22.

Golden CI sequence:

```text
import job@5
→ static package validation
→ reuse fixture voice
→ reuse fixture timing
→ compile timeline
→ validate zero target overlap
→ renderer prepare
→ short render smoke
```

Required clean output:

```text
PACKAGE_VALID
VOICE_REUSED
TIMING_REUSED
PLAN_COMPILED
PLAN_VALID
TARGET_OVERLAP_COUNT=0
RENDER_SMOKE_PASS
```

## 13. Migration

Legacy support is isolated behind an adapter:

```text
zodiac-job@4
    ↓
legacy adapter
    ↓
authoring-ir-v1
```

The adapter may preserve legacy jobs but may not become the source contract for new production.

New plugin production target:

- `zodiac-video-pipeline@2.0.0`
- `zodiac-job@5`
- `zodiac-renderer@2.0.0`

Legacy line remains:

- plugin `1.58.x`;
- `zodiac-job@4`;
- runtime `1.21.0`.

## 14. Rollout strategy

Implementation occurs only on `refactor/zodiac-control-plane-v2`.

Milestones:

1. Canonical contracts.
2. Authoring IR.
3. Timeline Compiler + conflict resolver.
4. Render Plan + validator.
5. Renderer 2.0 dumb execution.
6. Dependency cache v2.
7. Studio state machine + structured errors.
8. Plugin 2.0 job@5 handoff.
9. Scorpio golden E2E.
10. Migration adapter and production cutover.

The branch is not merged until the production-readiness gate passes.

## 15. Production-readiness gate

The Scorpio fixture must run three consecutive scenarios:

### Clean build
- no cached artifacts;
- complete PACKAGE → OUTPUT succeeds.

### Visual-only patch
- VOICE reused;
- TIMING reused;
- PLAN rebuilt;
- RENDER rebuilt;
- AUDIO rebuilt;
- output succeeds.

### Renderer-only patch
- VOICE reused;
- TIMING reused;
- PLAN reused when contract-compatible;
- RENDER rebuilt;
- output succeeds.

Additional hard requirements:

- zero same-target overlap reaches renderer;
- no renderer semantic/default/scheduling logic;
- no string-based error classification;
- no copied canonical validation rules;
- no mutable released renderer version;
- no stage may begin when package handshake is incompatible.

Only after all gates are green may v2 become the default production path.
