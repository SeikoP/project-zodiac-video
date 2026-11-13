# Unified Zodiac Studio — Phased Refactor Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans for a phase's detailed implementation plan. This roadmap is a gate/ownership contract, NOT permission to implement all phases at once.
>
> **Status:** PLAN ONLY · 2026-11-14 · no production source changed.
>
> **Goal:** Replace the multi-application and plugin-directed local production experience with **one** Zodiac Studio window: approved Phase 1 → Voice Lab → measured audio → V4 visual scene editing in embedded HyperFrames → video/package export; with concept×12 coverage, gallery, and a scoped agent.
>
> **Architecture:** Zodiac Python Core is domain authority; HyperFrames `@hyperframes/studio` + SDK is the embedded React editor, not a second GUI. The agent is a managed Codex App Server process communicating through a bounded Zodiac command API; it never owns sources or approval. Production Remotion and Job@5 remain supported during migration.
>
> **Tech Stack:** Python 3.10+ for current desktop (existing Python 3.9-compatible domain code remains compatible where needed); current Python/Node V4 compilers; React/TypeScript; version-pinned HyperFrames Studio/SDK; managed Codex App Server integration after verifying its real local protocol during Phase 1; SQLite stdlib for new project index/ordered events (proposed implementation decision, review in Phase 0); existing VieNeu, ASR, FFmpeg and pinned Remotion.
>
> **Spec:** [Unified Studio design](../specs/2026-11-14-agent-native-creative-studio-design.md), [platform ADR](../specs/2026-11-14-studio-platform-choice-adr.md), [migration inventory](../specs/2026-11-14-hyperframes-migration-inventory.md). [Visual V5](../specs/2026-11-14-zodiac-visual-v5-color-system-design.md), [Studio Asset Decision Engine](../specs/2026-11-14-zodiac-studio-asset-knowledge-graph.md), [Audio Library + Mix V2](../specs/2026-11-14-zodiac-audio-library-sound-design.md), [V1 contract audit](../../audits/2026-11-14-version-upgrade-candidates.md).
>
> **Immediate detailed plan:** [Phase 0: foundation and contracts](./2026-11-14-zodiac-studio-phase-00-foundation.md).

## Global Constraints (every phase)

- Exactly **one** user-visible application launched by `zodiac`; embedded HyperFrames React editor, managed local Python Core and agent sidecar; no separately opened HyperFrames/Remotion GUI in the fresh flow.
- Phase 1 `zodiac-phase1-handoff@2` + genuine Content Review remains immutable. No routine rewrite of approved narration.
- Voice Lab is a first-class stage **before** visual authoring; generated TTS prosody metadata is not evidence of actual audible delivery.
- Only genuine user actions can grant human voice, visual or publish approval. Technical PASS, compatibility migration and approval are separate evidence classes.
- The only fresh visual authoring owner is `.authoring/visual-intent.json` (`zodiac-visual-intent@1`); `production.json` / render plans and previews are derived.
- The V4 compiler must be maintained as **one episode-wide modular build/quality system**, not copied into HyperFrames or rewritten from scratch: source-bound dependencies, incremental assets/scenes/previews, deterministic receipts, full review gates and rollback. The detailed contract is [Compiler VNext design](../specs/2026-11-14-zodiac-compiler-refactor-design.md).
- The HyperFrames **renderer** is a separate Phase 7 benchmark decision from the HyperFrames **editor**. Static state-frame + FFmpeg export is an experimental fast path, not an assumed correct replacement for dynamic caption/voice timing.
- Keep V4 Character Assembly, meme/prop/environment compilers, genuine Visual Review and source-bound validation; no revival of retired fresh Scene Sets. Narrative Visual is scene-authored and mutually exclusive with Story Text in one scene.
- **Visual V5** is a versioned capability atop the existing V4 SVG masters: one derived Performance Graph, semantic theme roles, actual character/prop contact, up to eight *vetted candidate* color families and separate geometry/appearance cache. Do not copy all assets for each palette.
- **Agent Asset Intelligence:** **constraint-first decision engine**, not graph-first: episode beat planning → existing catalog capability maps → hard role/prop/contact/fresh constraints → bounded viable bundles → story-aware ranking + real preview. Relationships are derived metadata, not a required graph DB. No Neo4j/FTS/vector index unless a measured need, no shadow catalog or repeated full plugin-context reload.
- **Audio V2** preserves approved Vietnamese narration as the leading track; background music is optional, SFX are sparse/event-bound, cue timing follows measured voice, provenance/rights must be verified. Music/SFX-only changes must not trigger TTS or video rerender; raw third-party audio cannot silently ship in Studio/ZIP.
- No full-featured animation editor: hold, cut, state swap, show/hide, and only justified simple fades/slides/zoom. Image/story legibility and voice timing come first.
- Keep `VoiceArtifactStore`, scene/timing cache, semantic dirty graph, artifact graph, Job@5 import/export, reversible archive restore and pinned Remotion runtime until real parity tests authorize retirement.
- No fake progress, no pass-through approval, no direct agent JSON/ZIP rewriting, no accepted orphan source without ownership/lineage, no deletion of original handoffs or last recoverable ZIP/MP4.
- Each code phase lives in its **own focused implementation PR**, with frozen dependencies and a recorded rollback path. This spec PR #221 stays documentation-only; code PRs depend on accepted previous gates.

## Phase sizing rule: medium, reviewable vertical slices

- **Eight medium-sized phases, ~3 reviewable tasks each**, except Phase 0 and the dedicated Compiler Phase 3 (4 tasks each). Do not create a giant compiler rewrite or dozens of micro-PRs. A task crosses UI/domain/testing layers when necessary to deliver observable behavior; don't split by each button/file.
- Each phase delivers **one user-verifiable outcome**, including real backend wiring and a replayable smoke test. A screen that only displays a mock is NOT phase completion. For compiler tasks, **one logical `episode.build` request must assemble every authored scene and shared asset or explicitly BLOCK**; `scene.compile(S03)` is a targeted incremental subgraph, not the main production goal. The agent must not orchestrate each of the native scripts manually.
- One agent takes one work task from `READY` to `TESTED`. Each task must include schema/contract, source owner, implementation files, tests, positive and negative behaviors, migration/rollback, committed evidence.
- Agent receives a **small scope capsule**, not the full repository context. It cannot mark its task DONE without actual test receipts and a reviewer verdict.
- A phase may be split into two PRs **only** if separately independently runnable and revertible. A large review requiring broader context triggers division at an interface boundary, not arbitrary micro-tasks. Avoid an entire phase spanning weeks of unreviewed changes.
- No parallel writers of the same canonical artifact; parallelize read-only auditing or disjoint fixture/review tasks only.
- Maintain a `requirements-to-evidence` ledger, defined below; missing/untested items block phase handoff instead of being lost in narrative summaries.

## 0 — Foundation, evidence and single Project Core

**Deliverable:** the Studio-native backend can safely register/open a verified Phase 1 episode, persist one project identity and report *real* status without importing Job@5 as a fake precondition.

- **0.1** Baseline verified import/voice/Job@5/V4 and compiler golden fixtures; inventory current asset selection guides, registries and agent behavior, retired Scene Set entries, static HTML picker mismatch, plugin context loads/repair turns; measure full episode cold/warm/single-edit and agent/tool/native/render spans separately. Record unmeasured fields as null, never historical native last-receipt time as E2E wall time.
- **0.2** Phase 1 importer and durable project identity: source byte freeze, immutable receipt/hash verification, idempotent reopen, malformed/untrusted input isolation.
- **0.3** Single project ledger/event/command boundary: durable monotonically ordered project events, revision checks, idempotent commands and restart recovery; reuse existing state/artifact primitives, no second Visual Intent writer.
- **0.4** Phase status/evidence and anti-omission gate: derived status from receipts, source hashes and exact output provenance; `BLOCKED` on missing evidence; no automatic human approval.

**Gate P0:** verified handoff imports/reopens once, doesn't mutate source; different/malformed handoff blocks; restart retains identity, event cursor and command idempotency; old Job@5 import still works; all new tests + related existing regressions pass. No GUI or TTS required yet. **Next:** detailed [Phase 0 plan](./2026-11-14-zodiac-studio-phase-00-foundation.md).

## 1 — One-window shell, agent bridge and task orchestration

**Deliverable:** `zodiac` opens ONE Zodiac Studio frontend connected to the P0 Project Core. The user sees live project state and an agent can inspect a legitimate task, perform one safe test command and receive completion feedback in that window.

- **1.1** Managed launcher/shell: React host, HyperFrames packages installed/pinned (verify the actual package API), native project picker and one shared status area; retain Qt safe fallback.
- **1.2** Project command + event transport from P0 with permission/origin/revision/replay and typed errors; expose a **real read-only Studio asset catalog query** returning available IDs/roles/source revisions, without fake rankings. Reserve `episode.build`, `scene.compile`, and future `assets.find_candidates` for P3, not mock successful handlers.
- **1.3** Managed Codex App Server adapter (confirm official current protocol before code), scoped capabilities, task capsule, cancellation/retry and user interaction gate; demonstrate agent can inspect a project and submit a harmless/validated update through the project API. Do not require user to open CLI.

**Gate P1:** single-window smoke on Windows; no standalone HyperFrames GUI/CLI terminal; real project data, API errors and reconnection; agent cannot write outside project or impersonate human approvals; measured idle RAM/startup compared with existing Qt. App Server absence degrades gracefully to manual Studio, not crash.

## 2 — Voice-first audio studio

**Deliverable:** import Phase 1 → actual Voice Lab audio playback/take selection → genuine user listening confirmation → measured speech timeline, with **unchanged approved narration**. The video visuals may still be pending.

- **2.1** Speech-unit adapter for approved exact source byte ranges and current VieNeu scene-WAV compatibility; evaluate phrase/breath chunk boundaries without changing the script; profile/generation parameters and cache identity.
- **2.2** UI audition + re-take + immutable take selection; waveform/selected WAV; distinguish `TECHNICAL_VALID`, `COMPAT_MIGRATED` and `USER_LISTENED_APPROVED`. Explicit selected take and assembled-voice/junction review.
- **2.3** ASR/alignment, stable speech anchors and voice quality diagnostics: bad word/timing recovery, pause/join controls where technically supported, naturalness review, scoped regeneration; downstream scene time map invalidation but unchanged SVG caches.

**Gate P2:** real VieNeu synthesis and human listening test on representative Vietnamese punchline; choose a different take only for the affected speech unit, keep old take and unaffected audio; no fake prosody verification; measurable caption/voice alignment; ASR error routes to review, not silent source rewrite.

## 3 — Compiler VNext, Visual V5 foundation and whole-episode build

**Deliverable:** one `episode.build` assembles a verified entire episode, with a shared dependency DAG and safe legacy compatibility. Base V5 performance and semantic color contracts are integrated into this *same* build engine, not forked into a second V5 compiler.

- **3.1** One compiler API/owner, complete episode asset/scene manifest and pure seam; build **typed BeatVisualRequirement and source-derived capability maps, hard feasibility constraints and bounded candidate-bundle contract** from V4 catalogs/retired policies; derived V5 Performance Graph and versioned performance/motion/theme contracts with legacy adapters and golden fixtures.
- **3.2** Episode-wide ready-queue DAG over existing scene/step/asset caches: build shared geometry once, cache **palette-independent geometry vs theme-dependent appearance** separately, parallelize nonconflicting ready nodes within Windows CPU/RAM/disk budget, validate all output/source hashes and rollback atomically.
- **3.3** Atomic `episode.build` and targeted `scene.compile` with verified full scene inventory. Agent candidate resolver enforces actual source hash, roles/physical-contact/fresh-policy constraints, returns `NO_FIT_ASSET` and a new-asset task instead of substituting random props; early previews are explicitly candidate-only, human approval remains separate and interrupted builds preserve old outputs.
- **3.4** Benchmark cold/warm/scene-edit/shared-character/theme-only edit and 6–10-scene episode including agent authoring/retries/native/preview/render; Visual V5 compatibility and at least one light and one dark **technical** theme prototype, with quality review still pending.

**Gate P3:** complete verified episode from one request, shared assets compiled once, warm/scoped reuse proven and no narration/voice invalidation on theme-only edit; V4/Job@5 compatibility and real Libra/Gemini/Scorpio actor/prop/reaction parity, technical light/dark theme contrast and measured CPU/RAM/disk evidence. No fabricated human acceptance.
## 4 — Embedded HyperFrames scene editor and V5 art direction

**Deliverable:** within the one Zodiac window, agent/human can edit actual V4/V5 states and interactions and choose an episode palette / justified scene override, with actual same-source preview.

- **4.1** Visual Intent → HyperFrames source map for real SVG assets, derived Performance Graph, acting/prop/meme state transitions, voice anchors, captions and resolved V5 palette. Editor DOM stays non-authoritative.
- **4.2** Semantic Studio agent/UI `assets.describe` and `assets.find_candidates` with 2–3 feasible, story-ranked alternative **scene compositions**, explicit fit/contact/rejection reasons and source revision; selecting a candidate updates canonical Visual Intent through authorized edit/undo with scoped `scene.compile` or full `episode.build`. Agent/UI never write generated assets directly.
- **4.3** Preview V5 light/dark, reaction/reveal timing and real caption-safe/contrast/identity/occlusion QA; emit candidate/committed revision events; preserve last good preview. Optional Audio Design timeline markers never count as listened/approved sounds.

**Gate P4:** real V4/V5 S01 acting, one voice reveal, and two visibly different light/dark theme renders round-trip through source/Studio with identity unchanged and no narration drift; crash/reopen and unsupported ops are safe.

## 5 — Visual V5 palette, performance asset factory and real gallery

**Deliverable:** the new **V5 visual-theme system** and performance-aware actor/prop/meme library can be inspected and edited inside Zodiac, with real scene previews and no duplicate renderer or shadow asset catalog.

- **5.1** One authoritative V4/V5 catalog and local index for body/hair/outfit/face/pose/prop/meme/contact; extend the P3 **capability maps and candidate constraints** with V5 character/prop anchors, context/provenance, usage history and incremental refresh, retaining old package readers and excluding retired Scene Set from fresh recommendations.
- **5.2** Role-based visual theme resolver and source/appearance fingerprints; vet first **three genuinely distinct palettes including one dark** with real 1080×1920 frames, caption/character/prop contrast QA, no blind hex substitutions.
- **5.3** Expand to **up to eight V5 visual theme candidates**, quality improvements in hair/face/outfit/hand-contact and selected procedurally-authored story props; lazy preview/raster cache without a theme × actor cross-product.
- **5.4** In-Studio real component/meme/gallery **plus agent selection inspector**: semantic queries, viable scene bundles, why-fit/why-rejected, previous usage, image previews, palettes, chosen component IDs and versioned provenance. Same read-only capability service and canonical write API for agent and human, never full plugin guide dump per proposal.

**Gate P5:** at least three human-reviewed distinct visual palettes including one dark, actual V4/V5 body/hair/outfit/pose/face/prop/context/meme previews; source-backed agent recommendations respect roles, hand-contact and retired Scene Set policies, visibly explain no-fit art requests, and avoid repetitive irrelevant stock props; verified hashes/identity/contrast, and old Job@5 reproducibility remain.

## 6 — Concept × 12, episode library, licensed audio catalog and packages

**Deliverable:** one evidence-based concept×sign×episode registry and in-Studio media browser including a **real local rights-aware BGM/SFX catalog**, finished MP4/covers/voice/ZIP and reversible archive operations. No playable files fabricated from catalog metadata.

- **6.1** Merge existing checklist/series/concept backlog into evidence-based concept×sign×episode projection; unknown != finished, single/multi-sign scopes distinct.
- **6.2** Episode project library reports genuine Content Review, voice-take selection, Visual Review, exported-vs-published states and blockers; no manual unverified DONE flag.
- **6.3** **Audio Library**: scan/import legitimate local music/SFX plus optional original CC0 samples, model Mixkit entries as metadata-only until independently imported; catalog by mood/action, license/rights SHA and `FILE_MISSING` status. Audition/select BGM and event-anchored optional SFX in Studio from the measured audio timeline. No raw third-party audio in publicly distributed Studio/ZIP by default.
- **6.4** Existing media/package scanners, ZIP/cover/voice video records and provenance, safe archive/restore; preserve last healthy source/video and old Job@5 importer.

**Gate P6:** accurate concept×12 status; selected playable audio files must be verifiably present/licensed and audio audition functional, event cue anchors source-bound, silence also valid; legacy/current projects de-duplicated, archive+restore safe, media artifact evidence unambiguous.

## 7 — Full E2E, Audio Mix V2, export backend trial and retirement gate

**Deliverable:** one real episode moves from immutable approved Phase 1/voice to V5 storyboard, Visual Review, optional **licensed BGM + semantic SFX** and validated MP4/cover/captions/copy and optional ZIP without another app.

- **7.1** Versioned export from actual approved voice-take SHA, validated V5 scene graph and **`zodiac-audio-design@1`** cue/rights plan; **Audio Mix V2** uses FFmpeg voice-first ducking, optional beat/voice-anchor SFX, fades, clipping/peak checks and human audition. Keep legacy one-track music handler for old Job@5; no redistribution of third-party raw audio.
- **7.2** Compare HyperFrames Producer vs pinned Remotion vs conditional static-state FFmpeg, same V5 scenes/themes at 1080×1920 with two-line Vietnamese font/cover/watermark, audio/caption sync, event SFX timing, RAM/disk/speed and voice intelligibility. **Music/SFX-only edits rebuild only audio mix/mux**, not TTS/ASR/geometry/video-only segments.
- **7.3** Choose new default only after measurable whole-episode output quality/resource performance; retain stable Remotion/legacy ZIP until parity. Test reopen/archive/retry/cancel without losing licensed-audio provenance, last healthy video, human voice/visual approval.

**Gate P7:** a genuine reviewed V5 whole video with legible approved palettes, optional verified licensed music/SFX and voice-first mix, accurate audio rights receipt and full source-bound QA; legacy packages reopen; no silent status promotion or fabricated reviewer hearing. Renderer choice follows observed parity/benchmark, not preference.
## Anti-omission delivery protocol — required in every code PR

Every task PR must contain a machine-readable `phase-evidence.json` or structurally equivalent checked-in report (format `zodiac-studio-phase-evidence@1`), whose schema and generator are defined in P0. Required fields:

| Field | Why |
| --- | --- |
| `phase_id`, `task_id`, `baseline_commit`, `implementation_commit` | Exact scope and source |
| `requirements[]` with unique IDs and owning tests | Nothing in scope silently omitted |
| `contracts[]` with preserved/broken version checks | Detect drift |
| `reused_components[]`, `changed_files[]` | Show no accidental duplicate stack |
| `test_runs[]` with command/status/log ref/time | Verifiable PASS, not assertion |
| `smoke_artifacts[]` with path/hash/fidelity | Real preview/audio/video for affected phases |
| `review_gates[]` with actual user evidence or PENDING | Never fabricate human approval |
| `risks[]`, `deferred[]` with owner and next phase | No invisible skipped work |
| `rollback`, `handoff_ready` | Safe release/recovery |

**State machine:** `PLANNED → READY → IN_PROGRESS → TESTED → REVIEWED → MERGE_READY`. `BLOCKED` or `DEFERRED` are explicit, and `MERGE_READY` is forbidden if mandatory evidence is missing. Existing phase/Job@5 PASS must **not** be inferred from this planning-state machine.

Review at task completion: (1) contract/data correctness, (2) actual user-facing behavior, (3) negative/error cases, (4) cache/recovery, (5) QA and artifacts, (6) clean rollback; then one **phase-level E2E** before opening the next phase. A reviewer must be able to reproduce verification using exact commands and the fixture, not screenshots alone.

## Dependency and rollout

~~~text
P0 Project Core + compiler baseline/quality fixtures
   ↓
P1 One-window shell + agent bridge
   ↓
P2 Voice Lab / measured timeline
   ↓
P3 Compiler VNext modular refactor + incremental scene/asset build + quality gates
   ↓
P4 HyperFrames scene editor with SDK round-trip
   ├──────────────────┐
   ↓                  ↓
P5 Asset Gallery   P6 Concepts/Packages
   └────────┬─────────┘
            ↓
P7 Full E2E + renderer benchmark + optional ZIP + migration
~~~

P5 and P6 can be developed in isolated worktrees with shared P3/P4 interface frozen; integrate one at a time. P3 itself is a bounded dedicated refactor PR, not concurrent edits with the editor PR. The P7 rendering trial does NOT determine the source/asset compiler ownership.

## What is deliberately NOT in the MVP

- A normal post-approved script rewrite/editor, regeneration of Phase 1 creative evidence.
- Full professional animation/keyframe composer, generic NLE/video-editing feature parity.
- Full rewrite of V4 compilers, audio aligner, VoiceArtifactStore, package/cleanup logic.
- Automatic cloud bridge to remote ChatGPT Web, multiple distributed UI instances or multi-user CRDT.
- Mandatory HyperFrames final renderer replacement: editor and renderer decisions remain separate.

## Before implementation begins

- Review/accept this roadmap and P0 detailed plan. Write detailed P1–P7 implementation plans **at each phase gate**, using observed previous phase APIs, benchmarks and failures; do not pre-author invented exact signatures for future unbuilt modules.
- Use isolated worktrees/branches for code phases, red/green TDD, short commits, fresh reviews. Do not apply code changes to this docs-only PR #221.
- Maintain a phase summary at the end of each PR: what shipped, user workflow demo, test receipts, unresolved issues with scope, dependency updates and next phase's actual ready prerequisites.
