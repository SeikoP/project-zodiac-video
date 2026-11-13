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
> **Spec:** [Unified Studio design](../specs/2026-11-14-agent-native-creative-studio-design.md), [platform ADR](../specs/2026-11-14-studio-platform-choice-adr.md), [migration inventory](../specs/2026-11-14-hyperframes-migration-inventory.md).
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

- **0.1** Baseline/compatibility fixture and ownership map: approved Phase 1 v2, representative V4 episode/asset, Job@5 legacy, voice take, checklist, archive; **freeze compiler/validator/preview owners and quality golden frames, profile **whole-episode** cold/warm/single-scene-edit and full handoff→review-ready/render spans including agent authoring/repairs, native time and tool overhead**. Capture commands and evidence; don't assume the historical 19–21s native last-receipt sums are a complete wall-time baseline.
- **0.2** Phase 1 importer and durable project identity: source byte freeze, immutable receipt/hash verification, idempotent reopen, malformed/untrusted input isolation.
- **0.3** Single project ledger/event/command boundary: durable monotonically ordered project events, revision checks, idempotent commands and restart recovery; reuse existing state/artifact primitives, no second Visual Intent writer.
- **0.4** Phase status/evidence and anti-omission gate: derived status from receipts, source hashes and exact output provenance; `BLOCKED` on missing evidence; no automatic human approval.

**Gate P0:** verified handoff imports/reopens once, doesn't mutate source; different/malformed handoff blocks; restart retains identity, event cursor and command idempotency; old Job@5 import still works; all new tests + related existing regressions pass. No GUI or TTS required yet. **Next:** detailed [Phase 0 plan](./2026-11-14-zodiac-studio-phase-00-foundation.md).

## 1 — One-window shell, agent bridge and task orchestration

**Deliverable:** `zodiac` opens ONE Zodiac Studio frontend connected to the P0 Project Core. The user sees live project state and an agent can inspect a legitimate task, perform one safe test command and receive completion feedback in that window.

- **1.1** Managed launcher/shell: React host, HyperFrames packages installed/pinned (verify the actual package API), native project picker and one shared status area; retain Qt safe fallback.
- **1.2** Project command + event transport from P0; authentication/origin/path boundaries; reconnect/replay; real error display and project selection persistence. Reserve typed `episode.build` (whole episode) and `scene.compile` (scoped edits) as P3 command handlers; P1 must **not** silently implement a mock successful compiler.
- **1.3** Managed Codex App Server adapter (confirm official current protocol before code), scoped capabilities, task capsule, cancellation/retry and user interaction gate; demonstrate agent can inspect a project and submit a harmless/validated update through the project API. Do not require user to open CLI.

**Gate P1:** single-window smoke on Windows; no standalone HyperFrames GUI/CLI terminal; real project data, API errors and reconnection; agent cannot write outside project or impersonate human approvals; measured idle RAM/startup compared with existing Qt. App Server absence degrades gracefully to manual Studio, not crash.

## 2 — Voice-first audio studio

**Deliverable:** import Phase 1 → actual Voice Lab audio playback/take selection → genuine user listening confirmation → measured speech timeline, with **unchanged approved narration**. The video visuals may still be pending.

- **2.1** Speech-unit adapter for approved exact source byte ranges and current VieNeu scene-WAV compatibility; evaluate phrase/breath chunk boundaries without changing the script; profile/generation parameters and cache identity.
- **2.2** UI audition + re-take + immutable take selection; waveform/selected WAV; distinguish `TECHNICAL_VALID`, `COMPAT_MIGRATED` and `USER_LISTENED_APPROVED`. Explicit selected take and assembled-voice/junction review.
- **2.3** ASR/alignment, stable speech anchors and voice quality diagnostics: bad word/timing recovery, pause/join controls where technically supported, naturalness review, scoped regeneration; downstream scene time map invalidation but unchanged SVG caches.

**Gate P2:** real VieNeu synthesis and human listening test on representative Vietnamese punchline; choose a different take only for the affected speech unit, keep old take and unaffected audio; no fake prosody verification; measurable caption/voice alignment; ASR error routes to review, not silent source rewrite.

## 3 — Compiler VNext: episode-wide production throughput, incremental speed and quality

**Deliverable:** ONE `episode.build` Studio command compiles the *entire* authored episode and shared V4 asset set with a versioned DAG, conditional bounded parallel tasks, native validators and verified episode receipts. `scene.compile(S03)` uses the same core only for scoped iteration; no agent-managed per-part build script sequence. Goal is to reduce **end-to-end completion time**, not just speed one native module.

- **3.1** One compiler owner/typed API, entire-episode required-components manifest (all scenes/actors/states/props/memes/story imagery/audio anchors/captions), pure compile seam and legacy script adapters; freeze V4 output/semantic golden fixtures.
- **3.2** One **episode-wide dependency DAG** over existing semantic/step/scene caches: compile shared assets once, schedule independent ready nodes concurrently, await dependencies for scene builds, use bounded worker pool adapted to Windows RAM/CPU/disk and remove redundant process/file hashing only if measured. Validate exact output SHA and rollback.
- **3.3** **Atomic `episode.build`:** plan/compile/verify all scenes, publish `episode.build_ready` with full proven output inventory only when complete; early per-scene previews tagged `scene.preview_candidate_ready` not approved; missing input/stale revision/cancel returns grouped blockers and retains last healthy episode. `scene.compile` shares the planner and compiles just dirty closure. Human Visual Review remains separate.
- **3.4** **Full-production throughput**: benchmark agent scene authoring, tool/context time, grouped repairs, native preflight/compiler, preview, review waits and export separately; compare cold/warm/single edit/shared-actor edit and full 6–10-scene episode; preserve story clarity and caption/voice parity. See [Compiler VNext design](../specs/2026-11-14-zodiac-compiler-refactor-design.md).

**Gate P3:** one request builds a complete 6–10 scene fixture with verified hashes/receipts and reused shared actor/prop/meme assets compiled once. Independent safe tasks run concurrently; unchanged and one-scene edits reuse unaffected results; broken shared assets return grouped errors, interrupted builds never become full PASS and candidate previews cannot count as episode approval. Compare real elapsed time/agent turns and Windows RAM/disk, not native-step totals alone; keep old V4 and Job@5 reproducible.

## 4 — Embedded HyperFrames scene editor (S01 → full episode)

**Deliverable:** a scene backed by the P3 compiler appears in the **same Zodiac window**, and SDK edits round-trip into Visual Intent with a fresh scoped preview.

- **4.1** Visual Intent ↔ HyperFrames visual source map, scene IDs, actual V4 SVG elements and P2 measured speech anchors; HyperFrames DOM is a derived view, not a new Zodiac authoring schema.
- **4.2** UI scene editor + agent semantic commands: move/scale actor, choose state, place props, show/hide/swap actions; command commit, optimistic concurrency and undo. Agent invokes `scene.compile` to update one scene or `episode.build` to finish all scenes; Studio handles the DAG/build, artifact inventory and progress, **agent never uploads asset bytes or writes generated files**. Unsupported SDK override is rejected.
- **4.3** S01 preview → edit → re-preview with existing real V4 props/meme/caption/speech, geometry and source-bound validation; UI subscribes to `scene.preview_ready` and retrieves a revisioned local artifact from Zodiac Core, showing `BLOCKED` or `FAILED` without concealing the last valid preview. True Visual Review gate before finishing all scenes. No full ZIP or MP4 needed merely to view one scene.

**Gate P4:** one real V4 episode S01 with setup/reaction/voice reveal renders correctly inside Zodiac; agent edit visible without a second GUI; crash/reopen retains source; preview matches reviewed scene within declared tolerances; approved narration unaffected.

## 5 — Real V4 asset gallery within Studio

**Deliverable:** browse/inspect/select **real compiled and thumbnailed V4 components** and selected variants, all inside Zodiac, with the agent seeing the same registry.

- **5.1** Index current V4 IDs/roles/status/version/ref and actual usage as read-through compiler adapters, not a manually duplicated library.
- **5.2** Reuse character identity compilation and native meme before/after preview; use resvg-js *if benchmarked and needed* for thumbnails, lazy render/cache to bound RAM/disk; include hair, body, outfit, face, pose, prop and context.
- **5.3** Selected asset → safe canonical scene edit with provenance/compatibility, preview refresh, usage links and undo; no cross-product eager asset generation.

**Gate P5:** body/hair/outfit/pose/face/physical prop/context/meme previews display from the real compiler and can be selected in S01; retired/incompatible assets are blocked; single-asset edit invalidates only dependent scenes.

## 6 — Concept × 12, episode library and packages

**Deliverable:** one truthful concept×sign×episode registry and usable voice/video/ZIP/cover browsing, with existing cleanup/restore reused.

- **6.1** Merge existing checklist/series tracker/planned concepts into evidence-based concept×sign×episode projection. Unknown != finished; single-/multi-sign scopes remain distinct.
- **6.2** Episode library displays blockers, approvals, voice takes, covers, video and package status from one index. No manual "done" flag substituted for receipts.
- **6.3** Reuse package/media scanners, artifact lineage and reversible archive/restore; import old Job@5; never delete last healthy ZIP or source.

**Gate P6:** 12-sign coverage correct for single/multi-sign cases; approved content, accepted voice, reviewed visual, exported video and published states stay distinct; old/current projects appear once; archive+restore proven.

## 7 — Full E2E, export backend trial and legacy retirement gate

**Deliverable:** a real episode travels Phase 1 → approved audio → P3 compiler + V4 assets → P4 editor + genuine Visual Review → MP4/cover/captions/copy and optional Job@5 ZIP with no app switching.

- **7.1** Versioned export adapter consumes a pinned immutable source revision, actual voice-take hashes and validated scene graph, maintaining Phase 3/Job@5 and performance-review semantics. ZIP is optional portable artifact rather than a compulsory intermediate.
- **7.2** Compare **HyperFrames Producer**, pinned **Remotion** and conditional **static-state-frame + FFmpeg** fast path on the *same representative Zodiac scenes*: 1080×1920, voice/caption alignment, 2-line Vietnamese captions, glyph/font/watermark, cover opening frame, scene/meme fidelity, disk/RAM/cold/warm render time. Streaming/intermediate frames must respect Windows disk budget.
- **7.3** Default renderer selection only after measured quality/performance gate. Keep Remotion as legacy/rollback while old packages require it. Compare one whole final real episode plus restart/cancel/retry recovery, QA and Visual Review; only then mark old Zodiac Video Local orchestration/Qt GUI as compatibility.

**Gate P7:** all real user journeys and exact source-bound technical/human review gates PASS, full MP4 proof with captions/voice/visual parity, no source/data loss and acceptable measured resource use. HyperFrames Producer is the preferred **candidate**, not an automatic win; if it fails, ship the unified editor with the best proven production renderer until fixed.

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
