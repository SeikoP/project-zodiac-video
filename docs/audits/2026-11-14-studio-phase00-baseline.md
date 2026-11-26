# Studio Phase 00 baseline: source owners, regression and evidence

Status: **P0.1 source inventory; E2E/Windows renderer metrics UNMEASURED**.
Baseline production commit: `fa457a9351c33ace1da66bd089af8a1861e53838`.
Spec HEAD: `217cebe2471e24c6dab023b4cf5365ad5286fd1b`.
This is *not* a new human approval, compiled video, or a P0 gate receipt. The source inventory is guarded by `tests/test_studio_project_baseline.py`.

## Owners to preserve, not duplicate

| Ownership | Canonical existing path | Transition obligation |
| --- | --- | --- |
| Approved Web handoff | `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/contracts/phase1-handoff.mjs` | Keep approved v1/v2 import and approval-bound source SHA |
| Local handoff materialization | `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/import-phase1-handoff.mjs` | Reuse Node validator; P0 importer must not handwave a receipt |
| Job@5 importer | `tools/studio_v2/session.py` | Preserve old ZIP opening, distinct from Studio-native entry |
| Immutable voice takes | `tools/studio/artifacts.py`; `tools/studio_v2/voice.py` | TECHNICAL_VALID / COMPAT_MIGRATED must not become USER_LISTENED_APPROVED |
| Timing / artifact provenance | `tools/studio_v2/timing.py`; `tools/control_plane/artifact_graph.py` | Reuse selected WAV hashes and verified source anchors |
| Checklist and saved packages | `tools/studio_qt/production_checklist.py`; `tools/application/library.py` | Read-only migration/index, preserve reversible archives |
| Canonical Visual Intent | `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/features/visual-composition/compile-visual-intent.mjs` | One authoring owner, no alternate scene JSON |
| Scene workers and selective cache | `features/scene-production/native-scene-executor.mjs`; `core/cache/phase02-semantic-cache.mjs` | Preserve DAG dirty closure and scene worker behavior |
| Preview and compiler telemetry | `features/visual-composition/build-native-preview-pairs.mjs`; `core/performance/episode-profiler.mjs`; `core/performance/diagnose-phase02.mjs` | Baseline before optimizing cold/warm/edit E2E |
| Asset guidance | `core/policy/select-asset-guidance.mjs` | Existing ID/needs filter, **not** semantic candidate ranker |

Paths in the last four rows are relative to
`plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/`.

## Structural regressions and UX debt confirmed in source

- **Phone silhouette:** `props/phone.svg`, `phone-busy.svg`, `phone-ping.svg`, `phone-quiet.svg`, `phone-silent.svg` each use the identical SVG `<g id="body"><path d="M86 40 Q158 27 234 42 Q239 179 236 316 Q158 332 80 315 Q84 177 86 40Z"`. Their catalog `state_of` values associate states with one `phone` model. State/notification variance is **not** model diversity. P3 adapter must retain V4 default geometry; P5 adds new reviewed models.
- **Palette:** `art-direction/palette-registry.json` has 6 dramatic palettes but `no_new_colors: true`; `references/asset-library-v4/background-palettes.json` has 6 existing background sets. Neither count proves *rendered* contrast/diversity. Role-based V5 themes and real 1080×1920 QA belong to P3/P5.
- **Selection:** `core/policy/select-asset-guidance.mjs` consumes IDs and asset needs and resolves references; source does not expose the proposed `assets.find_candidates` semantic+contact ranking. Existing `props/index.json` contains contextual/contact metadata worth reusing.
- **Scene Set:** fresh Visual Intent compiler contains `FRESH_SCENE_SET_RETIRED`. Some older picker/catalog surfaces still suggest Scene Sets. The new Studio must filter by actual fresh compiler policy rather than resurrect old containment.
- **Audio:** `tools/livestream-pk/audio-pack.json` lists 16 Mixkit music metadata entries, not a proven installable/licensed MP3 inventory for Studio. Existing `tools/studio_v2/executor.py` offers one music-bed option with FFmpeg, not verified semantic SFX or sidechain ducking. `tools/livestream-pk/public/garden/audio` contains garden SFX that need editorial/rights review before video use.
- **Versioned formats:** `contracts/timing-v1.schema.json`, `performance-context-v1.schema.json`, `render-plan-v1.schema.json`, `publish-v1.schema.json` and `zodiac-job-v5.schema.json` are existing interfaces. Add explicit adapters; a cosmetic numeric bump is not an upgrade.
- **Golden corpus:** `tests/fixtures/phase2-gemini` and the existing Studio V2/renderer tests offer prior fixtures. Libra overhead scale, Gemini linked actors, Scorpio investigator motif and exact two-line Vietnamese captions require **real source-bound scene fixtures/reviews**, not fabricated visual acceptance in P0.

## Reproducible baseline checks

Run from repository root:

```powershell
python -m unittest discover -s tests -p test_studio_project_baseline.py -v
python -m unittest discover -s tests -p test_studio_v2_zip_import.py -v
python -m unittest discover -s tests -p test_studio_v2_voice.py -v
```

Native build/preview perf instrumentation already exists at `core/performance/episode-profiler.mjs` and `core/performance/diagnose-phase02.mjs`; it must be evaluated on *verified real episode workspace* before making throughput claims. Historical last-receipt step sums cannot be substituted for whole-episode elapsed time.

## Measurement manifest (unmeasured is explicitly null)

```json
{
  "format": "zodiac-studio-baseline@1",
  "scenario_id": "whole-episode-approved-handoff-to-reviewed-video",
  "source_sha256": null,
  "compiler_version": null,
  "cache_mode": "cold",
  "scene_count": null,
  "wall_ms": null,
  "step_ms": null,
  "agent_ms": null,
  "preview_ms": null,
  "review_ms": null,
  "render_ms": null,
  "cache_reuse": null,
  "agent_turns": null,
  "native_child_processes": null,
  "peak_ram_bytes": null,
  "peak_disk_bytes": null,
  "artifact_hashes": [],
  "measurement_environment": "UNMEASURED"
}
```

The same shape must be collected for unchanged warm cache and single-scene edit (and theme/audio-only edit in later phases). This document records **absence of measurements**, not zero duration or a benchmark pass.

## P0 risk gate

P0.2 registry must store metadata/evidence references, not writable narration or another `visual-intent.json`. P0.3 must enforce actual approved v2 capsule source bytes, protect path traversal/symlinks, stage writes transactionally and deduplicate import. P0.4 must derive UNKNOWN/BLOCKED instead of inventing approvals. Old Job@5 and source archive behavior remain functional. Do not advance to Studio UI, TTS or V5 asset creation until the P0 release gate has real test receipts.
