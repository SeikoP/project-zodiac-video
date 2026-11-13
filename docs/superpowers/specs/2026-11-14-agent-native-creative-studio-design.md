# Zodiac Unified Studio — Voice-First, HyperFrames-Embedded Architecture

> **Status: REVISED DESIGN / NOT IMPLEMENTED · 2026-11-14.** This is the canonical new-flow specification for PR #221. It supersedes the previous post-handoff-script-editor-led proposal. The [platform ADR](./2026-11-14-studio-platform-choice-adr.md), [migration inventory](./2026-11-14-hyperframes-migration-inventory.md) and [Compiler VNext addendum](./2026-11-14-zodiac-compiler-refactor-design.md) are subordinate technical decisions.
>
> Audited against `SeikoP/project-zodiac-video` main (`fa457a9351c33ace1da66bd089af8a1861e53838`) and the source modules listed in §3. **Code inspection only**; no local Windows benchmark, actual audio listening, implementation or end-to-end test occurred in this revision.

## 1. Product contract: one window, one episode, one engine

**The user starts `zodiac` and works in ONE Zodiac Studio application.** All features are screens within that one window, bound to the same active project ID. The user must not have to open a second HyperFrames desktop app, Remotion Studio, a separate browser editor, or a terminal to finish a newly authored video.

- **Embedded editor:** integrate the Apache-licensed `@hyperframes/studio` React components and `@hyperframes/sdk` inside the Zodiac React frontend. `EditorShell`, `NLEPreview`, `Player`, `Timeline`, `PropertyPanel` are building blocks, **not drop-in independent editors**: supply project state, API contexts, callbacks and asset resolver. Favor an integrated small storyboard/timeline over copying the entire generic Studio interface. Do not fork/assume access to the separate HeyGen desktop AI app.
- **Zodiac Core:** one local Python production/domain service manages imports, projects, voice, review, character/asset compilation, scene intent, cache, exports, state and security. It is a backend or managed sidecar process, **not a second GUI**.
- **Launcher:** preserve the `zodiac` command. Its future desktop shell may use a single embedded webview (Tauri or an equivalent) once measured. Current Qt remains working until replacement passes parity. Any local server is started/stopped automatically by the application.
- **Agent:** local CLI and a thin MCP adapter speak to the same commands/events as the human editor. The agent cannot write arbitrary JSON, invoke user approval, or create a second source of truth. A ChatGPT Web plugin cannot assume access to local `127.0.0.1`; remote access is a separate optional secure connector, not an MVP dependency.

### All required screens in the same application

| Screen | User can do | Authoritative backend |
| --- | --- | --- |
| **Home / Episodes** | Create/import approved episode, resume pending task, inspect job/phase status, failures, cover, final media, disk usage | Episode registry + actual receipts |
| **Concept × 12 signs** | Choose concept, see which signs have drafts/approved narration/video/published; filter projects and spot gaps; support multi-sign videos | Concept and episode identities + evidence graph |
| **Voice Lab** | Listen to phrase/scene/full-episode takes; switch NORMAL↔SHARP delivery intent, pronunciation/pause, choose usable audio, retry limited units | Approved locked text + voice performance/take store |
| **Editor** | Storyboard, scene preview, actor and prop inspection, basic timing, captions, changes by agent or human | Visual Intent, timing and renderer adapter |
| **Asset Gallery** | Browse and preview **every supported selectable V4 component** and generated variant/state; select and inspect usage | V4 authoritative registries + preview generators |
| **Packages & Media** | Find ZIPs, Job@5 jobs, raw/selected WAV, captions, covers, MP4, export metadata and history; safe archive/recover | Manifest/ArtifactGraph + existing library scanner |

One active episode selector, one status/progress area and one contextual action such as **Continue**, **Listen**, **Review** or **Export**. Advanced logs, hashes and detailed validation remain in expandable diagnostics, never required as ordinary manual steps.

## 2. Creative priorities and non-goals

Priorities: **(1) approved story → (2) natural Vietnamese narration → (3) legible story images, character expression and physical props → (4) precise speech/caption/scene timing → (5) minimal motion**. A good static frame must still communicate the scene. Never create effects to fill a motion quota.

**Phase 1 approved script is LOCKED**, not a normal mutable Studio document. The user has explicitly deprioritized editing the script after handoff. An exceptional source correction may use a separate future review/re-anchoring path, but that is not an MVP blocker. **Changing how the text is spoken must not mutate the approved narration bytes.**

Voice style should follow the approved Voice Profile and favor natural NORMAL↔SHARP changes where required; do not impose an extra “warm” mode. Avoid artificial punctuation tricks, forced excitement or robotic pauses merely to meet a metadata checklist.

For new production use only **hold, cut, show/hide, state swap**, with optional small fade/slide/zoom when justified. No animation graph, advanced easing, elaborate camera rig, 60 FPS requirement, broad multi-track professional NLE or heavy VFX pipeline.

## 3. Source-grounded audit: strengths, gaps and preservation rules

| Priority | Existing source | Verified capability / problem | Requirement |
| --- | --- | --- | --- |
| P0 | `orchestration/phases/01-content.md`; `contracts/phase1-handoff.mjs` | Voice-first *creative* Web Phase 1; approved v2 handoff bound to source hashes | **KEEP** approved narration, Voice Profile, Narrative Plan and receipt immutable; import once |
| P0 | `orchestration/phases/02-visual-production.md`, `03-handoff.md`; `tools/studio_v2/executor.py` | Current route completes visual/ZIP before local VOICE→TIMING | **CHANGE ORDER** for fresh Studio projects: audible voice first, measured timing, then visuals |
| P0 | `tools/studio_v2/voice_performance.py`, `tools/zodiac_local.py` | Requested `performance_context` is carried/hashed but `prosody_verified:false`, `applied_controls:[]` on current VieNeu text/voice path | **DON'T CLAIM** instructions automatically changed the generated sound; real listening and tested mechanisms |
| P0 | `tools/studio/artifacts.py`, `tools/studio_v2/voice.py` | Immutable voice take store, hashes and restore logic EXIST. The compatibility path can `register_approved(... approval_source="studio-v2-compatibility", migrated_from_checkpoint=True)` without proof of user listening | **SPLIT** technical validity/legacy compatibility from human listening approval; no false VOICE_ACCEPTED |
| P0 | `tools/studio_v2/session.py`, `tools/studio_v2/executor.py` | Execution requires a Job@5 import with PACKAGE DONE | **NEW** Studio-native entrypoint from Phase 1 source. Do not patch ZIP-import-only session to fake the state |
| P1 | `tools/studio/pipeline.py`, `tools/studio_v2/pipeline.py` and `tools/studio_qt/app.py` | Legacy and V2 workflow/status vocabularies still coexist | **CONSOLIDATE** one project-level state machine and event bus, with legacy adapters |
| P1 | `tools/studio_qt/production_checklist.py` and `screens/production_checklist.py` | Phase manifest, episode scope/concept and 12-sign binary checklist ALREADY EXIST | **REUSE + EXTEND**, unify concept×sign×episode evidence instead of adding another checklist |
| P1 | `tools/studio_qt/screens/concepts.py` | Concept backlog exists as separate planned-concepts.json | **MIGRATE/INDEX** and link concept IDs to real episodes; no second manual backlog |
| P1 | `tools/application/library.py`; `screens/library.py` | ZIP/workspace scan, exported video discovery, safe archive/restore and cleanup ALREADY EXIST | **KEEP** reversible cleanup/legacy import; use as scanners, not a second source of status truth |
| P1 | `features/asset-selection/build-current-asset-review.mjs`, `characters/build-identity-preview.mjs`, `core/audit/preview-meme-acting.mjs` | Real native SVG gallery/character/meme previews already exist | **EMBED/EXTEND** rather than rewriting preview generation |
| P1 | `features/visual-composition/compile-visual-intent.mjs`, `core/cache/phase02-semantic-cache.mjs` | One authoring source and scene/asset dirty graph already exist | **KEEP**, use for bounded invalidation; SDK edits round-trip through the owner |
| P1 | `phases/phase02/phase02-execute.mjs`, `phase02-selected-dependencies.mjs`, `core/cache/incremental-cache.mjs` | Multi-step native coordinator with source-bound receipts, signature/checkpoint caching and selected-dependency mode; full-source dependency collection still exists as a fallback | **COMPILER VNEXT P3:** one owned graph/planner with exact hashes, measured dependency collection and less redundant startup, not a blind cache rewrite |
| P1 | `features/scene-production/native-scene-executor.mjs`, `build-native-preview-pairs.mjs`, `core/performance/critical-path.mjs` | Per-scene workers and cache exist, in-process mode for <=3 scenes; preview has its own per-scene hash cache, profiler exists | **REUSE + UNIFY** for one-scene preview, repeated cold/warm/single-edit comparison and the same scene graph for preview/export |
| P1 | `tools/control_plane/artifact_graph.py`, `tools/control_plane/segments.py`, `tools/studio_v2/timing.py` | Validated content-addressed artifacts, cut-safe render segmentation and per-scene timing cache | **KEEP** as backend infrastructure, adapt to speech-unit scheduling |
| P1 | `tools/studio_v2/runner.py` and `tools/studio_v2/progress.py` | Structured subprocess progress/error reporting exists | **REUSE** via one visible job progress UI |
| P1 | `tools/studio_qt/vieneu_service.py` | VieNeu service lifecycle/reuse, ownership and readiness check already exist | **PRESERVE** lifecycle semantics; don't spawn a duplicate server |
| P1 | `phases/phase03/run-phase03-production.mjs`; `tools/studio_v2/session.py` | Versioned, manifest-validated Job@5 handoff and importer; published ZIP != rendered video | **KEEP** portable export / import compatibility while eliminating mandatory intermediate ZIP for fresh Studio projects |
| P1 | `runtime/zodiac-renderer/2.0.2` | Pinned Remotion rendering/cover/caption/fonts and QA | **KEEP** as rollback and reference while assessing HyperFrames renderer separately |

The audit identifies **workflow seams**, not proof of actual memory/runtime bottleneck percentages. No E2E or live Windows benchmark was performed here.

## 4. Unified project model: no duplicate checklists or hidden state

A single local project registry links six concepts:

- **Concept**: durable concept ID, theme/premise, planned sign coverage, whether it is draft/selected/approved. Distinguish general theme (“tình yêu”) from a specific approved episode idea.
- **Episode**: stable episode ID, concept ID, scope format (`single_sign`, `element_group`, `ranked_shortlist`, `comparison`), member sign IDs, approved Phase 1 source, production revision, status.
- **Voice take**: phrase/speech-unit ID, source excerpt fingerprint, actual generation settings, WAV hash, review provenance, selection, measured timing.
- **Scene**: stable scene ID, semantic goal, Visual Intent, asset refs, current preview and validation/review state.
- **Artifact/package**: path, hash, type (imported handoff, Job@5, WAV, SRT, MP4, cover, metadata), producer version, source episode/revision and status.
- **Series coverage**: derived view over `(concept_id, sign_id)` linked to one or more episodes, with **separate evidence-based columns** for PLANNED, PHASE1_APPROVED, VOICE_ACCEPTED, VISUAL_REVIEWED, VIDEO_EXPORTED, PUBLISHED. A multi-sign episode may cover more than one member without pretending each has a separate finished single-sign video.

**No new manual “done” field if a receipt/output can establish it.** Unknown/missing source data becomes UNKNOWN or NEEDS_LINK, never DONE. Publication needs actual user-confirmed publish evidence/link rather than a ZIP or MP4.

Import/migrate old `planned-concepts.json`, `zodiac-series-checklist@1`, known workspaces, Job@5 manifests and `ready/*.zip` via scanners. Normalize identities with a migration report and an ambiguous-match review. Maintain legacy files read-only during parallel validation. Do not infer which concept was made from filenames or generic tags. The currently separate checklist and backlog views become projections of the same registry.

**Packages & Media management** must retain safe archive/restore (`_archive/<timestamp>/moved.json`) and idempotent import, deduplicate identical content by hash, show source lineage, resolve corrupted/missing files, and **never auto-delete** referenced/approved assets, active jobs or last recoverable exports. Use actual status distinctions: HANDOFF_READY != VIDEO_READY != PUBLISHED.

## 5. Target pipeline: Voice FIRST after approved Web Phase 1

### Stage A — Single import, automatic preflight

Verify approved Phase 1 v2 manifest, source hashes and real review receipt, preserve original exact bytes and create one Studio episode. The Studio opens its overview and Voice Lab. No native tools added to Web Phase 1; no fake local PASS. A duplicate import reopens the same episode or explicitly creates a new revision, never silently duplicates jobs.

### Stage B — Voice Lab, the first major production task

Use the existing `spoken-performance-plan` and voice profile as guidance; **do not create a competing approved narration script**. The operator must be able to audition the actual synthesized voice while seeing locked narration, the selected voice identity and waveform.

- Build a **speech-unit plan** from semantic phrases/breath groups independent of visual scene boundaries. Preserve exact source byte spans and stable IDs. MVP may use existing scene-WAV adapters as a compatibility transition, but should not create unnatural breaks merely because a later video scene ends. This is a *real refactor*, not a renaming of the existing per-scene TTS.
- Keep one voice identity and reproducible generation settings. Produce default take, evaluate objective audio problems, then offer bounded alternate takes for poor units. Retake only the affected audio units; no automatic unbounded sampling.
- Requested NORMAL/SHARP, energy, pace, emphasis and punctuation in metadata are **intended delivery**, not proof VieNeu executed them. Only apply controls actually supported and verified in the selected VieNeu backend. Spoken pronunciation overrides must affect speech input with full traceability without changing canonical captions or approved source.
- Automatic QC detects empty/clipped WAV, implausible duration, missing/duplicated words where alignment provides evidence, abrupt joins and long pauses. WPS is diagnostic only, not a reason to regenerate every scene.
- **Approval semantics:** TECHNICAL_VALID means WAV is readable and measurable. CANDIDATE or COMPAT_MIGRATED is not USER_LISTENED_APPROVED. Actual voice approval requires an explicit user action on the selected take plus a complete-episode (or junction-level) listening confirmation. Preserve compatibility-import labels separately from trusted approval receipts.
- Use `VoiceArtifactStore` for immutable take hashes/reuse; correct the migration path so an artifact automatically marked APPROVED is never presented as a genuine human-listening approval. Keep previous takes and undo selection; reusing identical audio must not require regenerating TTS.
- After selection, stitch/join voice with measured boundaries and intentional pauses; avoid automatic equal-length gaps between every scene. Run measured ASR/word alignment against the approved text and generate the time map. Final timings must come from selected WAV bytes, not predicted words-per-second.

Changing a selected take invalidates affected audio alignment and downstream absolute time positions/captions/scene preview, but **not** unaffected V4 SVG source assets or scene meaning. Preserve exact source. If downstream scene anchors cannot be reliably mapped, show review-needed for those scenes, not a silent rewrite.

### Stage C — Storyboard, characters, asset selection and real previews

Use the approved Story Spine/Narrative Visual direction and the measured speech timeline to create scene intent. A static scene must show a concrete relationship/reaction; an expressive character/physical prop has more value than generic symbols and animation. Use the existing `zodiac-visual-intent@1` canonical source, V4 character/meme/prop compiler and selective scene/asset dirty closure.

IMPORTANT: Visual Intent currently uses **contiguous UTF-8 byte ranges `narration_range`** and a narration SHA check. Audio time and byte range are different coordinates: compute original source ranges deterministically and map scene time through measured word/phrase anchors; never replace UTF-8 byte offsets with a visual timeline timestamp or reserialize the approved script.

Scene Accent is canvas-native; fresh Scene Set containment is retired by current compiler. Narrative Visual carries only approved Phase-1 story meaning, is **scene-authored** rather than a generic asset choice, and cannot coexist with Story Text in the same scene. Character identity remains stable across states. No mandatory VFX or motion quotas.

**Progressive preview:** as soon as one scene's assets and visual source are ready, render a still plus short transition if necessary at the correct scale, with draft/correct audio labels; update HyperFrames viewport without waiting for all scenes, a ZIP or full MP4. Preserve current playhead where safe. Invalidations only rebuild actual dependencies; retain authored edits and stable IDs.

### Stage D — Human/agent edit loop and final QA

One command/event API handles `project.get`, `scene.inspect`, `asset.search`, `scene.apply_patch`, `asset.select`, `voice.get_takes`, `voice.select_take`, `preview.request`, `validation.get`, `events.subscribe`, `undo`. Use transactional `base_revision`, idempotent commands, per-scene scope, structured conflicts and recent edit history. Avoid remote chat round trips for every pixel of a drag: local UI may display a transient preview, and commits one validated semantic edit on drag-end.

No agent operation may grant creative review or spoken take approval. Show agent activity and human edits in one shared activity timeline; respect a visible user override.

**Renderer boundary:** choose HyperFrames editor components for the new UI, but keep renderer selection a separate decision. During integration pilot, preview can use HyperFrames with clearly labeled fidelity; final Remotion path remains available until HyperFrames rendering passes parity for character positions, font/caption breaks, voice timing, cover, MP4 audio and story visuals. No claim of pixel-exact output across different engines.

### Stage E — One-click export, packages and publish artifacts

Export pins immutable project source revision, selected and genuinely approved voice takes, measured alignment, compiled assets, renderer version and QA receipt. User gets one consistent output set: final MP4, cover first-frame parity, captions/SRT, voice/media source, caption + TikTok publish text/hashtags and lineage manifest. Keep old Job@5 ZIP as **optional** portable/export/legacy-compatibility format, not a mandatory internal transfer.

Apply existing atomic/staged package validation, source hash checks, render segmentation and final audiovisual QA. Preserve a verified prior output if export is canceled or crashes; mark stale exports as belonging to older revisions, not as current. No publishing status without user evidence.

## 6. Asset gallery: preview **each real component**, not a decorative catalog

Reuse the current authoritative library `references/asset-library-v4` and its generators:
- `features/asset-selection/build-current-asset-review.mjs` for selectable V4 components and selected-source preview receipt.
- `characters/build-identity-preview.mjs` for compiled identity/body/hair/shirt preview.
- `core/audit/preview-meme-acting.mjs` for all current meme action situations and before/after states.
- Existing prop/Scene Accent/environment SVG and selected baked character state SVGs.

**MVP gallery behaviors:** searchable category filters; real still thumbnail generated from the native source SVG; choose body/hair/outfit/pose/expression and inspect representative assembled identities; show meme setup/reaction before/after; see SVG source hash, compatibility, role, source licensing/provenance, used-in scenes, current/retired policy; click to use a compatible asset. Refresh thumbnails by source hash; lazy-generate only visible/selected entries and cap in-memory cache on weak Windows hardware.

The existing selected-asset HTML preview is **not proof every possible identity combination and all generated states are already browsable**. New index/virtualized view must support coverage without eagerly generating a combinatorial explosion of SVG variants. The gallery may show a catalog component on a standardized mannequin and generate an actual selected-state thumbnail on demand.

Do not present historical Scene Set artifacts as current selectable fresh backgrounds. Respect current `FRESH_SCENE_SET_RETIRED` validation even though V4 README/manifest still mention scene-set. Narrative Visual is an approved scene-specific creative decision, not a random reusable icon to select. The Gallery must not create a second asset ownership system.

## 7. Frontend / backend boundaries and reliability

~~~text
                         zodiac launcher
                    ONE UI / one active project
┌───────────────────────────────────────────────────────────────────────┐
│ React Zodiac shell: Home / Concepts x Signs / Voice / Editor / Assets │
│ Packages / agent activity / one status/progress bar                   │
│ Embedded HyperFrames Studio primitives + SDK (not separate app)      │
└───────────────────────────────┬───────────────────────────────────────┘
                                │ typed commands + ordered events
┌───────────────────────────────▼───────────────────────────────────────┐
│ Zodiac Project Engine (managed Python sidecar / existing compilers)   │
│ Episode Registry, Voice Takes, Story Scenes, V4 Assets, Cache, Export  │
│ One state reducer, ArtifactGraph, validation, transaction & undo      │
└──────────────┬───────────────────────────────────────┬────────────────┘
               │                                       │
      Local CLI/MCP agent                    Renderer adapter
      same commands/state                    HyperFrames pilot
                                             Remotion fallback
               └───────────────┬───────────────────────┘
                               ▼
            pinned artifacts + audio/video QA + exports
~~~

- Single local engine process and single app window; any worker/TTS process auto-managed without a second manually opened GUI. Keep process ownership, readiness checks, graceful shutdown and crash restart; never kill an external VieNeu server merely because the UI closes.
- One durable project/episode registry and one state machine; legacy scanner/job/checklist files become readers/adapters. Explicit schema versioning and migration from legacy planned-concepts, series-checklist, Job@5 and Qt workspace. Read-only fallback when migration/identity matching is ambiguous.
- One event stream (project_id, revision, sequence, changed IDs, artifact hashes). Reconnect/replay and stale revision conflict. Scheduler batches/deduplicates requests, one writer per canonical source, guarantees atomic commit and hash-validated cache reuse; no duplicate voice/render/export when resumed.
- Local-only loopback listener, authentication and origin checks if using HTTP/WebSocket. File access restricted to project-owned sandbox paths. No raw arbitrary shell or filesystem API for agent.
- Preview markers: PLACEHOLDER, DRAFT, RENDERER_READY, USER_REVIEWED. A rendered still is useful even without animated playback; a generated frame is not proof of user approval. Progressive UI should report actual checks, not fake completion percentages.
- Windows low-resource mode: one foreground preview, lazy thumbnails, capped parallel TTS/asset jobs, no duplicate browser+Qt+Remotion Studio apps, disk-space preflight and bounded cache retention.

## 8. Required user journeys and acceptance tests

| Journey | Acceptance criterion |
| --- | --- |
| Start `zodiac` | **One application window** with all six views; sidecar ready without manual terminal/app launch |
| Import Phase 1 | Immutable, hash-verified approved source and one episode; reopen is idempotent |
| Voice Lab | Generate/listen/retake/select one unit, previous WAV retained; actual user listening status separated from technical audio validity |
| Natural voice | Listen through whole assembled audio, adjust pauses/joins, no fake “verified prosody” flag and no changes to approved narration |
| Draft image appears | S01 preview visible while later scenes remain pending, no ZIP/full MP4 prerequisite |
| Compiler change | Single-scene edit rebuilds only correctly dependent assets/scene/preview, no stale outputs; corrupt/tampered outputs trigger rebuild; benchmark cold/warm/single-edit using one frozen fixture |
| Visual quality | Libra 3-state balance, Gemini actor continuity, Scorpio meme setup→reaction and an actual voice reveal preserve actor/prop/event/focus and readable caption/layers; technical native PASS is not a human Visual Review |
| Edit with agent | Agent moves one actor or changes a prop by semantic ID, single commit, validated preview refresh, correct undo/conflict |
| Full episode build | Agent submits whole-episode Visual Intent once and calls `episode.build` via Studio; shared assets compiled once, all scenes validated, complete revision-aware episode artifact inventory emitted; partial scene previews are labeled candidates, missing scene input BLOCKS |
| One-shot S03 build | Agent triggers one `scene.compile` through Studio after authoring; all required actors/states/props/events/text/voice anchors/preview are built or returned as a typed BLOCKED list; Studio displays the exact committed revision after `scene.preview_ready` |
| Concept coverage | For a concept, see all 12 sign states and linked episodes; missing evidence shows UNKNOWN; multi-sign episode counted accurately |
| Asset gallery | Preview a body, hair, outfit, pose, expression, prop, accent and representative meme setup/reaction without a second app; no retired fresh Scene Set |
| Packages | Find approved handoff, generated video, captions/cover, ZIP and archive; distinguish handoff-ready/video-ready/published, restore archive safely |
| Recovery | Crash/reopen resumes last committed task/voice selection/scenes without redoing valid cached assets |
| Render migration | Same episode through Remotion reference and HyperFrames pilot, caption/character/audio and story parity reviewed; benchmarks RAM/latency on actual target PC |
| Source integrity | Compiler projections and reviewed source snapshots are not casually writable; no ghost creative approval or fake PASS |

## 7.1. Agent → Studio → episode build → preview → video

The main new-production path is **episode-centric**, not one externally orchestrated scene at a time:

```text
Approved Phase 1 + user-selected voice/time anchors
     ↓
Agent makes one complete episode storyboard / Visual Intent (source-revisioned)
     ↓
Studio: episode.build(project, revision, mode)  [ONE logical task]
     ↓
Zodiac Core computes one shared dependency DAG:
    V4 actor/identity/pose SVGs + memes/props/context shared across scenes
       →  scene composition/events/voice/captions on dependent ready scenes
       →  progressive candidate previews / grouped technical and visual QA
       →  one coherent episode artifact inventory and build receipt
     ↓
Studio receives episode progress + candidate scene previews; eventual episode.build_ready
     ↓
User reviews actual image/voice (never auto-approved) → selected export renderer
     ↓
Validated MP4/cover/subtitles/copy with real status and archive lineage
```

- **Primary public action: `episode.build`** compiles all scenes of the active episode from one canonical Visual Intent. Agent does not have to call the 15+ native scripts or create a Job@5 ZIP to view/edit an unfinished video. The compiler coordinates reusable assets across scenes once and schedules independent tasks concurrently within the measured Windows memory/disk budget.
- **Secondary public action: `scene.compile(S03)`** is an *incremental iteration* command reusing the same episode DAG/contract, not the primary production job. Its scope prevents unrelated scenes from rebuilding.
- **Fast feedback without fake completion:** Studio may display individual `scene.preview_candidate_ready` events while the full candidate builds. Only a complete verified episode produces `episode.build_ready`; candidate scene previews are not a full build/review PASS.
- **Agent creativity is a separate bottleneck:** give the agent a compact episode-level planning capsule and structured first-draft contract, then a single grouped preflight issue report and targeted repair batch. Don't allow repeated agent context reload and full build for each single validator. Compiler quality checks protect required story/actor/prop/voice meaning.
- **Ownership:** Studio owns source edits and approved project revision; Zodiac Core owns generated assets/build/receipts and local artifact service; agent submits semantic changes and commands only. No direct agent image upload into Studio, no silent human approval.
- **Latency/evidence:** report entire handoff→review-ready and handoff→MP4 wall time as well as agent authoring, tool wait, native startup, cache, candidate preview, review and renderer spans. Existing native last-receipt figures are not overall episode duration.

See [Compiler VNext §3.2](./2026-11-14-zodiac-compiler-refactor-design.md) for the normative proposed `episode.build` request, DAG, caching and transaction contract. Both commands are **planned, not implemented yet**; Phase 3 implements the core and Phase 4 connects the HyperFrames UI.

## 8.1. Compiler VNext is a dedicated production dependency, not an editor detail

The compiler refactor is **Phase 3** of the [eight-phase implementation roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md), between Voice Lab and HyperFrames scene editor. Its full [architecture and acceptance contract](./2026-11-14-zodiac-compiler-refactor-design.md) is normative for its implementation PR.

- Preserve `.authoring/visual-intent.json` as sole authoring source; don't fork the story into editor DOM, Scene Set variants or a second narrative compiler.
- Define module ownership and the pure stages: source contract/semantic event planning → V4 component and physical prop assembly → layout and timed state changes → validated scene graph → preview/export adapters. Each compiler/asset family has one owner and versioned input/output types; legacy scripts call adapters.
- Reuse the existing semantic graph, selected dependency mode, native scene cache/workers and preview cache; connect them as one observable build plan, rather than throwing out working optimizations.
- Run cheap checks and **progressive single-scene preview** during authoring; retain all native and Visual Review gates at the correct boundary. Preserve event-by-event story meaning and explicit phase approval provenance.
- Measure agent authoring vs native compilation vs preview vs render separately, capturing cache hit/miss and cold/warm/single-scene-edit modes. Don't optimize for fake speed by removing validators, omitting actors, using stale cached passes or simplifying approved beats.
- Visual quality is a first-class output: golden frames for actors, hair/face/hands, spatial relationships, props, Narrative Visual vs Story Text, meme reaction timing and 2-line Vietnamese caption collision. Verify preview/export parity.
- HyperFrames Producer and a possible static-frame + FFmpeg fast path are **export adapters in Phase 7**, not a reason to rebuild character geometry. Remotion remains proven legacy/rollback until the renderer trials pass.

## 9. Implementation plan waves: cohesive vertical slices

**Phase 0 — Source evidence + compiler benchmark fixtures:** freeze approved Phase 1, existing V4 compile outputs/golden scenes, real native-source ownership and cold/warm/single-edit measuring commands. Record unknown timings as unmeasured, not zero.

**Phase 1 — One-window shell and task/agent bridge:** manage Studio project/event data, embedded HyperFrames skeleton and local agent. No second GUI.

**Phase 2 — Real Voice Lab:** actual take listening/selection and measured speech timing before scene work, with immutable narration.

**Phase 3 — Compiler VNext:** unify V4 compiler ownership with an **episode-wide dependency DAG** and a one-command `episode.build` for all scenes; dedupe shared asset compilation, bounded parallelism, targeted `scene.compile` for edits, full story/visual QA and real end-to-end timing proof. Keep old entrypoints until parity.

**Phase 4 — HyperFrames editor round-trip:** render S01 through new scene compiler API, bind editor SDK semantic edits → canonical Visual Intent → scoped rebuild and preview.

**Phase 5 — V4 asset gallery:** on-demand verified real SVG/component/meme thumbnails and one click selection via the same compiler API.

**Phase 6 — Concepts × 12 and Packages:** re-index existing concepts/checklist and media/ZIP scanner into the one-window project registry.

**Phase 7 — Full video and renderer gate:** test full source-to-MP4 experience, HyperFrames Producer vs pinned Remotion vs conditional static FFmpeg path with frame/audio/quality/resource parity. Choose default only with evidence, keep rollback.

Every phase must leave a runnable, tested integrated slice; don't ship an editor UI without real compiled V4 imagery. The [phase roadmap](../plans/2026-11-14-unified-zodiac-studio-roadmap.md) owns the detailed scopes, stop conditions and anti-omission evidence ledger.

## 10. Decisions, risks and remaining questions

- **Chosen editor direction:** HyperFrames browser React components/SDK embedded **inside Zodiac**; no second GUI or desktop app; this is the intended build direction, contingent on a small compatibility spike.
- **Renderer:** HyperFrames Producer is the leading future default **candidate**, not yet performance-proven on Zodiac. Benchmark against pinned Remotion and a conditional static-state + FFmpeg path; retain Remotion as production/legacy fallback until exact frame, caption, audio and hardware parity is demonstrated.
- **Voice:** Speech units and selection must preserve current signed source, voice artifact cache and timing. The existing per-scene TTS path requires an adapter and regression tests; do not silently flatten units into scene chunks. Objective audio validation cannot replace actual listening.
- **Approval:** Content Review is imported immutable. Voice user listening, Visual Review, native validation and final video QA are distinct. Auto/migrated voice take flags from legacy are not trusted human review.
- **Concept status:** published means genuinely published, not just exported; evidence-based coverage can include multiple episodes of the same concept/sign.
- **Gallery:** do not generate every cross-product of character states; lazy selected variants satisfy “preview each component” without exponential storage.
- **Compiler:** do not reimplement V4 characters/memes/environments merely to rename modules. Phase 3 must preserve source-specific dependency/cache/worker behavior, use progressive QA, show clean extension points and report measured warm/single-edit gains without cold regression.
- **Version/rollback:** source/projection/adapter/renderer versions in artifact keys, atomic output and legacy ZIP compatibility. Do not delete Qt or Remotion before a proven complete episode.
- **Security:** local agent process can connect directly; ChatGPT Web needs explicitly authorized connectivity and cannot assume a localhost tunnel.

**Next implementation artifact:** a separate task-by-task TDD plan with concrete source owners, migrations, proof of performance, stop/go thresholds and a real selected episode. This design is not an implementation or test result.
