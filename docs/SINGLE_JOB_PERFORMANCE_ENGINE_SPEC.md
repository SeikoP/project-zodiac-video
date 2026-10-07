# Zodiac Single-Job Performance Engine Spec

Status: **architecture locked, implementation pending**

Scope: optimize the execution time and iteration cost of **one Zodiac video job**, with a design target that remains practical when videos grow toward **10–20 minutes**.

This is not a multi-job queue/batch spec.

```text
one job
  ↓
less duplicated work
  ↓
safe intra-job parallelism
  ↓
fast scene/segment iteration
  ↓
predictable final render
```

This spec builds on `docs/ZODIAC_STUDIO_REFACTOR_SPEC.md`, `docs/ZODIAC_TUI_REFACTOR.md` and `docs/AUDIT_RENDER_PIPELINE.md`. Where older performance notes conflict with this document, this document is the source of truth for **single-job performance**.

---

## 1. Problem

The current pipeline is resumable and already has scene-level TTS checkpoints, but long-form video changes the cost model. A 10–20 minute job can contain dozens of scenes and tens of thousands of frames. One local edit must not require full TTS, alignment and full-video render again.

There are two performance modes:

### Cold run

```text
package
→ voice
→ alignment
→ runtime preparation
→ Studio review
→ final render
→ audio mix
```

Cold-run optimization is about process/model setup, controlled parallelism, Remotion concurrency and measured resource usage.

### Incremental run

```text
edit one scene
→ rebuild only affected artifacts
→ reuse validated unaffected artifacts
```

For 10–20 minute videos, incremental execution is the primary optimization.

---

## 2. Goals

1. Keep one `PipelineWorker` as owner of one job lifecycle.
2. Allow expensive stages to use internal executors without uncontrolled worker pools.
3. Treat voice as a reusable production artifact.
4. Cache timing against the exact audio artifact it was measured from.
5. Invalidate visual/render work at scene/segment granularity.
6. Reuse unchanged rendered segments.
7. Preview one scene/segment in Remotion without treating the full long-form video as the smallest unit.
8. Benchmark and bound resource usage rather than guessing from CPU count.
9. Let TUI explain reuse/dirty reasons without becoming a visual editor.
10. Let runtime 2.0 add performance semantics without another engine rewrite.

### Non-goals

- multi-job scheduling;
- distributed/remote workers;
- GPU requirements;
- cross-job voice reuse in the first implementation;
- immediate package-format changes;
- immediate `production.json` v2 replacement;
- a second visual editor in TUI;
- forcing multiple VieNeu instances;
- FPS changes before timing/motion semantics are FPS-safe.

---

## 3. Existing baseline to preserve

- [x] one background `PipelineWorker` per active job
- [x] scene-level TTS checkpoints
- [x] resume after interruption/failure
- [x] voice/timing survive visual-only edits
- [x] music-only invalidation avoids TTS
- [x] exact runtime selection
- [x] renderer preparation separated from final render
- [x] `Prepare Studio → Studio review → Final Render` workflow
- [x] performance records already exist in the worker
- [x] renderer smoke/typecheck coverage in CI

---

## 4. Target architecture

```text
                         ONE JOB
                            │
                      PipelineWorker
                            │
             ┌──────────────┼───────────────┐
             │              │               │
        VoiceExecutor  TimingExecutor   RenderExecutor
             │              │               │
         artifacts      artifacts       segments
             └──────────────┼───────────────┘
                            │
                      Artifact Graph
                            │
                       final output
```

`PipelineWorker` owns cancellation, lifecycle, pipeline state and user-visible stage status. Executors own only internal work of a stage.

No executor may independently mutate pipeline state outside the canonical artifact/invalidation API.

---

## 5. Artifact model

File existence alone is not enough to decide reuse.

Every expensive reusable artifact needs:

```text
Artifact
├─ artifact_id
├─ artifact_type
├─ content_hash
├─ input_fingerprint
├─ producer
├─ producer_version
├─ created_at
├─ validation_status
├─ approval_status
├─ provenance
└─ path
```

Initial job-local artifact classes:

```text
voice.scene.S01.take.*
timing.scene.S01.*
voice.assembled
timing.assembled
runtime.render_props
render.segment.*
render.cover
video.assembled
video.final
```

**Decision:** start job-local. Do not add cross-job voice reuse until identity, context and invalidation are proven inside one job.

---

## 6. Voice artifact policy

Voice reuse is required for long-form performance, but not as:

```text
same text → reuse WAV
```

Correct rule:

```text
same semantic voice input
+ compatible performance intent
+ validated artifact
→ eligible for reuse
```

### 6.1 Candidate and approved take

A scene may have multiple takes:

```text
S17
├─ take-01.wav
├─ take-02.wav
└─ take-03.wav
```

Take lifecycle:

```text
GENERATED → TECH_VALID → APPROVED → SUPERSEDED
```

Rules:

- `GENERATED`: TTS produced a WAV.
- `TECH_VALID`: format/duration/required validation passes.
- `APPROVED`: active creative take.
- `SUPERSEDED`: retained for history but no longer active.
- An `APPROVED` WAV is immutable.
- Regeneration creates a new take; it never overwrites the approved file.
- Regeneration failure leaves the approved take untouched.

### 6.2 Real voice identity

A display label such as `cuongdepzai` is not a stable cache identity.

Introduce `voice_profile_hash` from the relevant real inputs, for example:

```text
preset config
+ reference-audio hash
+ speaker/embedding data if available
+ relevant voice settings
```

The preset name remains UI metadata only.

### 6.3 Generation profile

Record provenance:

```text
tts_engine
tts_engine_version
tts_mode
model identity/hash where available
backend
precision
frame-cap settings
max_chars
other output-affecting controls
```

Hash as `generation_profile_hash`.

A generation-profile change must **not automatically invalidate an approved artifact**. The old approved WAV remains valid. If missing/changed scenes must be generated with a new profile while old scenes remain from the old profile, surface `VOICE_PROFILE_DRIFT` instead of silently mixing profiles.

### 6.4 Performance context

Text can remain equal while intended delivery changes.

Future runtime 2.0 may provide compact semantic context:

```json
{
  "delivery": "sarcastic",
  "energy": 0.65,
  "emotion": "annoyed",
  "pace": "medium",
  "emphasis": ["quay xe"],
  "continuity_group": "gemini-switch"
}
```

Hash as `performance_context_hash`.

Do **not** hash arbitrary neighboring scene text. That causes cascading invalidation. Context must be explicit and semantic.

Initial compatibility:

```text
performance_context_hash = NONE
```

Do not change `production.json` v2 just to add this in Phase P1.

### 6.5 Voice reuse reasons

The engine must explain decisions using stable reason codes:

```text
REUSED_APPROVED
REUSED_CANDIDATE
DIRTY_TEXT
DIRTY_VOICE_PROFILE
DIRTY_PERFORMANCE_CONTEXT
FORCE_REGENERATE
PROFILE_DRIFT
NO_ARTIFACT
```

---

## 7. Timing/alignment cache

Timing belongs to the actual audio artifact, not merely the narration text.

Per-scene timing cache key:

```text
wav_sha256
+ canonical_text_hash
+ aligner_model
+ aligner_version
+ aligner_config
```

Rules:

- same text + different WAV → align again;
- same WAV + same aligner profile → reuse timing;
- visual-only change → timing reused;
- aligner-model change → voice reused, timing dirty;
- scene-gap change → scene alignment reused, global positions rebuilt.

Target:

```text
timing.scene.S01.json
timing.scene.S02.json
...
        ↓
TimingAssembler
        ↓
.runtime/timing.json
```

Milliseconds remain the canonical measured representation. Frame conversion belongs to the render profile/runtime.

---

## 8. Invalidation matrix

| Change | Voice | Scene timing | Global timing | Render | Final mix |
| --- | --- | --- | --- | --- | --- |
| visual transform | reuse | reuse | reuse | affected segment dirty | dirty |
| asset in S10 | reuse | reuse | reuse | S10 segment dirty | dirty |
| narration S10 | S10 dirty | S10 dirty | rebuild | S10 segment dirty | dirty |
| explicit voice-profile change | selected scope dirty | regenerated scope dirty | rebuild | affected segments dirty | dirty |
| TTS engine update only | keep approved | keep | keep | keep | keep |
| performance context S10 | S10 dirty unless explicit keep-approved | dirty only if WAV changes | rebuild if needed | S10 segment dirty | dirty |
| aligner-model change | reuse | dirty | rebuild | timing-dependent segments dirty | dirty |
| scene gap | reuse | reuse | rebuild positions | timing-dependent segments dirty | dirty |
| music only | reuse | reuse | reuse | reuse | mix only |
| render profile/FPS | reuse | reuse measured ms | retime | render dirty | dirty |

---

## 9. Segment render architecture

A 10–20 minute composition must not require a full Remotion render after every local edit.

```text
production + timing + assets
          ↓
      SegmentPlanner
          ↓
  ┌───────┼────────┐
segment A segment B segment C
 cached    dirty     cached
             ↓
           render
  └──────────┼──────────────┘
             ↓
        FinalAssembler
             ↓
        background mix
             ↓
          final.mp4
```

### Segment policy

Initial target:

- scene-aware boundaries;
- roughly 20–60 seconds per segment;
- do not split a normal scene unless required;
- prefer cut-safe boundaries;
- transitions that require neighboring frames use overlap/handles or keep both sides in one segment.

Exact default duration must be benchmarked before becoming a hard contract.

### Segment fingerprint

Include only relevant dependencies:

```text
runtime/render-core version
render profile
production slice
resolved timing/events
caption/style dependencies
referenced asset hashes
transition/overlap dependencies
SFX dependencies
```

Music is not part of the pristine visual-segment fingerprint.

### Assembly spike

Before locking container/codec strategy, benchmark:

1. identical segment codec settings + FFmpeg concat/stream-copy;
2. controlled assembly re-encode fallback;
3. frame and audio continuity;
4. transition boundaries;
5. output size and elapsed time.

---

## 10. Remotion for long-form review

Keep `ZodiacVideo` for full QC, but add smaller preview surfaces later:

```text
ZodiacVideo
ScenePreview
SegmentPreview
ActorLab
StateLab
PerformanceLab
```

Typical edit:

```text
ScenePreview(S37)
→ SegmentPreview(segment containing S37)
→ full ZodiacVideo only when needed
```

---

## 11. Controlled intra-job parallelism

Correctness/cache first, concurrency second.

### Voice

Default:

```text
TTS slots = 1
```

Later benchmark `1 vs 2`. Do not make more TTS instances the first optimization.

### Alignment

Benchmark:

```text
A: workers=1, cpu_threads=4
B: workers=2, cpu_threads=2
C: workers=2, cpu_threads=4
```

### Remotion

Benchmark actual hardware with:

```text
concurrency = 2 / 4 / 6 / 8
```

Benchmark x264 preset separately.

### Shared resource budget

Before stage-level parallelism becomes configurable:

```text
ResourceBudget
├─ logical_cpu
├─ memory_budget_mb
├─ heavy_cpu_slots
└─ stage-specific limits
```

Do not create independent high-concurrency TTS, Whisper and Remotion pools that oversubscribe the same CPU.

---

## 12. Observability and benchmark contract

Every expensive operation should record:

```text
stage
substage
elapsed_ms
cache_hit
cache_reason
input_fingerprint
output_hash
execution/concurrency profile
```

Where practical:

```text
peak RSS
CPU usage
rendered frames
output size
```

Required benchmark scenarios:

- cold;
- warm unchanged;
- one visual-only scene edit;
- one narration-scene edit;
- music-only edit;
- explicit voice-profile change.

No performance claim is accepted without before/after data.

---

## 13. Storage

Initial cache remains job-local.

Suggested layout:

```text
.runtime/
├─ artifacts/
│  ├─ voice/
│  │  ├─ S01/
│  │  │  ├─ takes/
│  │  │  └─ index.json
│  │  └─ ...
│  ├─ timing/
│  │  └─ S01/
│  └─ render/
│     └─ segments/
├─ manifests/
└─ timing.json
```

GC must never delete:

- active approved take;
- artifacts referenced by current job state;
- last successful final output;
- required rollback/history artifacts.

---

## 14. TUI behavior

TUI stays operational, not editorial.

Useful summaries:

```text
VOICE   48 reused · 1 dirty · 1 approved-new
TIMING  49 reused · 1 align
RENDER  11 segments reused · 1 render
```

Selected stage may show a concise reason:

```text
REUSED_APPROVED
DIRTY_TEXT
DIRTY_ASSET
DIRTY_TIMING
PROFILE_DRIFT
FORCE_REGENERATE
```

Hashes/provenance remain in diagnostics/logs.

---

## 15. Compatibility rules

1. Keep `production.json` v2 valid during initial cache work.
2. Keep thin package v4 unchanged initially.
3. New cache/provenance data stays under runtime-owned local state.
4. The plugin does not ship local cache artifacts.
5. Runtime 1.x packages keep working without new optional metadata.
6. Runtime 2.0 performance context comes only after local artifact identity is proven.
7. Updating TTS code does not automatically invalidate an approved WAV.
8. Never silently mix incompatible generation profiles when new generation creates audible drift.

---

# 16. Implementation checklist

Order matters. Do not start segment rendering before artifact/timing invalidation is correct.

## Phase P0 — contracts and measurement — DO NOW

- [ ] define stable artifact IDs and manifest schemas
- [ ] define cache-decision reason enum
- [ ] extend current performance telemetry with `cache_reason`
- [ ] create a fixed long-ish benchmark fixture/profile
- [ ] capture cold and warm baseline timings
- [ ] test: visual-only change never calls TTS/ASR
- [ ] test: music-only change never calls Remotion
- [ ] test: approved artifact cannot be overwritten in place
- [ ] define resource-profile file format, without auto-tuning yet
- [ ] keep runtime behavior otherwise unchanged until telemetry/tests are green

**Exit:** reuse decisions are measurable and explainable.

## Phase P1 — voice artifact store — DO NEXT

- [ ] per-scene voice artifact manifest
- [ ] take IDs
- [ ] `GENERATED / TECH_VALID / APPROVED / SUPERSEDED`
- [ ] `voice_profile_hash`
- [ ] `generation_profile_hash`
- [ ] optional `performance_context_hash`
- [ ] migrate current valid scene WAV checkpoint as initial take without regeneration
- [ ] force-regenerate creates new take
- [ ] approved take immutable
- [ ] detect `VOICE_PROFILE_DRIFT`
- [ ] preserve approved take on regeneration failure
- [ ] restart/resume/rollback tests
- [ ] no cross-job reuse

**Exit:** one-scene change never regenerates unrelated approved voice.

## Phase P2 — per-scene timing artifacts

- [ ] store alignment per scene
- [ ] key by WAV hash + text + aligner profile
- [ ] add `TimingAssembler`
- [ ] scene-gap change only rebuilds global positions
- [ ] aligner change never regenerates TTS
- [ ] same WAV/profile never aligns twice
- [ ] audio/timing mismatch tests
- [ ] restart/resume tests

**Exit:** unchanged audio is never re-aligned unnecessarily.

## Phase P3 — canonical artifact graph

- [ ] artifact dependency graph service
- [ ] explicit dependency edges
- [ ] cache reason stored per artifact
- [ ] TUI reused/dirty counts
- [ ] selected stage explains dirty reason
- [ ] invalidation-matrix tests

**Exit:** engine, not individual modules, owns cache validity.

## Phase P4 — segment planner, no renderer switch yet

- [ ] deterministic scene-aware `SegmentPlanner`
- [ ] safe transition-boundary policy
- [ ] segment fingerprints
- [ ] segment plan emitted as runtime/debug artifact
- [ ] unchanged plan is stable
- [ ] one-scene change dirties only its segment plus necessary transition neighbor
- [ ] final render path remains unchanged in this phase

**Exit:** engine knows exactly which long-form segments require work.

## Phase P5 — incremental segment renderer

- [ ] render one segment independently
- [ ] cache pristine segment
- [ ] assembly prototype
- [ ] frame continuity validation
- [ ] audio continuity validation
- [ ] caption/event boundary validation
- [ ] stream-copy benchmark
- [ ] re-encode fallback benchmark
- [ ] unchanged rerun uses cached segments
- [ ] one-scene visual change renders only affected segment(s)
- [ ] music remains downstream
- [ ] public output remains one canonical MP4

**Exit:** local edit no longer forces full-video render.

## Phase P6 — measured performance tuning

- [ ] benchmark Remotion `2/4/6/8`
- [ ] benchmark x264 presets
- [ ] benchmark Whisper worker/thread profiles
- [ ] benchmark VieNeu 1 vs 2 slots
- [ ] implement shared `ResourceBudget`
- [ ] persist host-specific benchmark profile
- [ ] safe fallback profile
- [ ] reject oversubscribed configuration
- [ ] record profile in telemetry

**Exit:** defaults come from measured throughput, not CPU-count guesses.

## Phase P7 — Remotion long-form surfaces

- [ ] `ScenePreview`
- [ ] `SegmentPreview`
- [ ] `ActorLab`
- [ ] `StateLab`
- [ ] `PerformanceLab`
- [ ] same render-core as final render
- [ ] scene/segment preview requires no final full render

**Exit:** Studio remains practical on a 10–20 minute job.

## Phase P8 — runtime 2.0 semantics

- [ ] canonical performance-context schema
- [ ] time-based semantic motion/transition durations
- [ ] Performance Compiler
- [ ] `render-plan.json`
- [ ] continuity groups
- [ ] compiler-owned `performance_context_hash`
- [ ] FPS becomes render-profile conversion
- [ ] backwards compatibility with v2/frame-authored packages

---

## 17. Recommended future PR sequence

1. **PR A — artifact/telemetry contracts**: schemas, reason codes, benchmark baseline; no behavior change.
2. **PR B — voice takes**: manifests, profile hashes, immutable approved takes, checkpoint migration.
3. **PR C — scene timing cache**: per-scene alignment + `TimingAssembler`.
4. **PR D — artifact graph + TUI reasons**.
5. **PR E — segment planner only**.
6. **PR F — segment render/assembly prototype**.
7. **PR G — enable incremental render after parity passes**.
8. **PR H — measured resource/concurrency profiles**.
9. **PR I — Remotion long-form labs**.
10. **PR J — runtime 2.0 performance context/compiler**.

---

## 18. Required regression matrix

- [ ] crash/restart during voice generation
- [ ] crash/restart during alignment
- [ ] crash/restart during segment render
- [ ] regenerate one take without touching approved take
- [ ] change one narration scene
- [ ] change one visual transform
- [ ] change one asset
- [ ] change music only
- [ ] intentional voice-profile change
- [ ] TTS upgrade without approved-take invalidation
- [ ] mixed-generation profile drift detected
- [ ] alignment-model change
- [ ] scene-gap change
- [ ] runtime change
- [ ] render-profile change
- [ ] transition at segment boundary
- [ ] unchanged warm rerun
- [ ] final MP4 parity against non-segment baseline
- [ ] cancellation remains resumable
- [ ] GC preserves active approved artifacts

---

## 19. Acceptance criteria for 10–20 minute readiness

- [ ] one-scene narration edit does not regenerate unrelated voice
- [ ] one-scene narration edit does not re-align unrelated audio
- [ ] visual-only edit never invokes TTS/ASR
- [ ] music-only edit never invokes Remotion
- [ ] approved voice takes are immutable/auditable
- [ ] profile drift is visible, never silently mixed
- [ ] unchanged rerun shows artifact/segment cache hits
- [ ] changed scene dirties only expected segment(s)
- [ ] ScenePreview/SegmentPreview work without final full render
- [ ] final output remains one canonical MP4
- [ ] cold/warm/one-scene benchmarks are recorded
- [ ] concurrency profile is benchmark-backed
- [ ] cancellation/resume remains correct

---

## 20. Decisions locked by this spec

1. This is **single-job performance**, not multi-job batching.
2. Incremental reuse is more important than blindly increasing thread count.
3. `PipelineWorker` remains the job lifecycle owner.
4. Voice cache is a production artifact system.
5. Approved voice artifacts are immutable.
6. Voice identity uses the real profile, not only its display name.
7. Timing cache is tied to exact WAV content.
8. Engine upgrades do not automatically invalidate an approved WAV.
9. Performance-context invalidation is explicit/semantic, not arbitrary neighboring text.
10. Start with job-local artifact caches.
11. Segment rendering comes only after artifact/timing invalidation is correct.
12. Music remains downstream of pristine visual rendering.
13. TUI reports operational state; Remotion owns visual authoring/preview.
14. Concurrency is benchmarked after correctness.
15. Runtime 2.0 semantics build on this artifact graph rather than replacing it.
