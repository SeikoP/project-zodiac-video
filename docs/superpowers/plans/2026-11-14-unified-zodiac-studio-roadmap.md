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
- Keep V4 Character Assembly, meme/prop/environment compilers, genuine Visual Review and source-bound validation; no revival of retired fresh Scene Sets. Narrative Visual is scene-authored and mutually exclusive with Story Text in one scene.
- No full-featured animation editor: hold, cut, state swap, show/hide, and only justified simple fades/slides/zoom. Image/story legibility and voice timing come first.
- Keep `VoiceArtifactStore`, scene/timing cache, semantic dirty graph, artifact graph, Job@5 import/export, reversible archive restore and pinned Remotion runtime until real parity tests authorize retirement.
- No fake progress, no pass-through approval, no direct agent JSON/ZIP rewriting, no accepted orphan source without ownership/lineage, no deletion of original handoffs or last recoverable ZIP/MP4.
- Each code phase lives in its **own focused implementation PR**, with frozen dependencies and a recorded rollback path. This spec PR #221 stays documentation-only; code PRs depend on accepted previous gates.

## Phase sizing rule: medium, reviewable vertical slices

- **Seven phases, 3 independently reviewable tasks each**, except Phase 0 which has 4 contract-level tasks. A task crosses UI/domain/testing layers when necessary to deliver observable behavior; don't split by each button/file.
- Each phase delivers **one user-verifiable outcome**, including real backend wiring and a replayable smoke test. A screen that only displays a mock is NOT phase completion.
- One agent takes one work task from `READY` to `TESTED`. Each task must include schema/contract, source owner, implementation files, tests, positive and negative behaviors, migration/rollback, committed evidence.
- Agent receives a **small scope capsule**, not the full repository context. It cannot mark its task DONE without actual test receipts and a reviewer verdict.
- A phase may be split into two PRs **only** if separately independently runnable and revertible. A large review requiring broader context triggers division at an interface boundary, not arbitrary micro-tasks. Avoid an entire phase spanning weeks of unreviewed changes.
- No parallel writers of the same canonical artifact; parallelize read-only auditing or disjoint fixture/review tasks only.
- Maintain a `requirements-to-evidence` ledger, defined below; missing/untested items block phase handoff instead of being lost in narrative summaries.

## 0 — Foundation, evidence and single Project Core

**Deliverable:** the Studio-native backend can safely register/open a verified Phase 1 episode, persist one project identity and report *real* status without importing Job@5 as a fake precondition.

- **0.1** Baseline/compatibility fixture and ownership map: approved Phase 1 v2, representative V4 episode/asset, Job@5 legacy, voice take, checklist, archive; capture existing regression commands.
- **0.2** Phase 1 importer and durable project identity: source byte freeze, immutable receipt/hash verification, idempotent reopen, malformed/untrusted input isolation.
- **0.3** Single project ledger/event/command boundary: durable monotonically ordered project events, revision checks, idempotent commands and restart recovery; reuse existing state/artifact primitives, no second Visual Intent writer.
- **0.4** Phase status/evidence and anti-omission gate: derived status from receipts, source hashes and exact output provenance; `BLOCKED` on missing evidence; no automatic human approval.

**Gate P0:** verified handoff imports/reopens once, doesn't mutate source; different/malformed handoff blocks; restart retains identity, event cursor and command idempotency; old Job@5 import still works; all new tests + related existing regressions pass. No GUI or TTS required yet. **Next:** detailed [Phase 0 plan](./2026-11-14-zodiac-studio-phase-00-foundation.md).

## 1 — One-window shell, agent bridge and task orchestration

**Deliverable:** `zodiac` opens ONE Zodiac Studio frontend connected to the P0 Project Core. The user sees live project state and an agent can inspect a legitimate task, perform one safe test command and receive completion feedback in that window.

- **1.1** Managed launcher/shell: React host, HyperFrames packages installed/pinned (verify the actual package API), native project picker and one shared status area; retain Qt safe fallback.
- **1.2** Project command + event transport from P0; authentication/origin/path boundaries; reconnect/replay; real error display and project selection persistence.
- **1.3** Managed Codex App Server adapter (confirm official current protocol before code), scoped capabilities, task capsule, cancellation/retry and user interaction gate; demonstrate agent can inspect a project and submit a harmless/validated update through the project API. Do not require user to open CLI.

**Gate P1:** single-window smoke on Windows; no standalone HyperFrames GUI/CLI terminal; real project data, API errors and reconnection; agent cannot write outside project or impersonate human approvals; measured idle RAM/startup compared with existing Qt. App Server absence degrades gracefully to manual Studio, not crash.

## 2 — Voice-first audio studio

**Deliverable:** import Phase 1 → actual Voice Lab audio playback/take selection → genuine user listening confirmation → measured speech timeline, with **unchanged approved narration**. The video visuals may still be pending.

- **2.1** Speech-unit adapter for approved exact source byte ranges and current VieNeu scene-WAV compatibility; evaluate phrase/breath chunk boundaries without changing the script; profile/generation parameters and cache identity.
- **2.2** UI audition + re-take + immutable take selection; waveform/selected WAV; distinguish `TECHNICAL_VALID`, `COMPAT_MIGRATED` and `USER_LISTENED_APPROVED`. Explicit selected take and assembled-voice/junction review.
- **2.3** ASR/alignment, stable speech anchors and voice quality diagnostics: bad word/timing recovery, pause/join controls where technically supported, naturalness review, scoped regeneration; downstream scene time map invalidation but unchanged SVG caches.

**Gate P2:** real VieNeu synthesis and human listening test on representative Vietnamese punchline; choose a different take only for the affected speech unit, keep old take and unaffected audio; no fake prosody verification; measurable caption/voice alignment; ASR error routes to review, not silent source rewrite.

## 3 — Embedded HyperFrames scene editor (S01 → full episode)

**Deliverable:** Agent authors Visual Intent, V4 compilers produce real assets, a scene appears in the **same Zodiac window**, and SDK edits round-trip into canonical source with a fresh preview.

- **3.1** Visual Intent ↔ HyperFrames presentation/source-map for real V4 SVG, scene IDs, actor states, props, context accents and simple timeline/captions; use existing compilers, correct UTF-8 narration ranges and P2 measured anchors.
- **3.2** UI scene editor + agent semantic commands: move/scale actor, choose state, place props, set/show/hide events; command commit, optimistic concurrency, undo and guaranteed invalidation of dependent previews, no direct edit of generated HTML/plan.
- **3.3** Progressive preview/review: S01 before remaining scenes done, captions, phone-safe positions, Narrative Visual vs Story Text invariant, validator receipts, genuine Visual Review gate; preview and final renderer fidelity declared clearly.

**Gate P3:** one real episode S01 with native actor/prop/meme reaction, voice-anchored timing and caption; agent edit visible to user without ZIP/full render; crash/reopen preserves source edits; unsupported SDK ops rejected; old compiled V4 and approved narration unaffected. Remotion continues final-render fallback.

## 4 — Real V4 asset gallery within Studio

**Deliverable:** browse/inspect/choose **real previews of selectable components** and selected variants, all inside Zodiac; agent can query same catalog.

- **4.1** Index current V4 catalog IDs/roles/status/refs as read-through adapters, not another manually curated library; retire/hide legacy assets correctly.
- **4.2** Embed existing character identity and native asset preview compilers into thumbnail grid with lazy generation and bounded disk/memory cache; meme before/after and physical prop/context preview included.
- **4.3** Selected asset → Scene intent update with compatibility/provenance validation, linked scene usage, invalidation and undo; agent asset.search/select accesses identical indexed surface.

**Gate P4:** manually preview body, hair, outfit, pose, face, prop, accent, meme before/after, select a compatible asset for S01 and see it in preview; invalid/retired selected asset is blocked. No eager explosion of all possible character combinations.

## 5 — Concept × 12, episode library and packages

**Deliverable:** Studio shows all approved/planned/produced/published work, with accurate concept×sign coverage and safe ZIP/MP4/cover/voice discovery.

- **5.1** Merge existing checklist/series tracker/planned concepts into one indexed concept×sign×episode projection using evidence. Unknown != done; single- vs multi-sign scopes are distinct.
- **5.2** Episode browser with progress/review blockers/cover, videos, voice selection, workspace and actual package state. No duplicate manual tracker or user-entered “done” when receipts exist.
- **5.3** Packages/media scanner, publish artifact history, provenance and safe archive/restore. Import old Job@5; preserve the last good export and file-system safety.

**Gate P5:** one concept shows correct 12-sign coverage and two multi-sign/single-sign cases, correctly separates Phase 1 approved vs video exported vs published; a legacy ZIP and a current Studio project appear exactly once; archive+restore round-trip does not delete approved assets.

## 6 — Full E2E, export and legacy retirement gate

**Deliverable:** one real episode travels Phase 1 → approved audio → actual V4 scenes → Visual Review → MP4, cover, captions, copy and optional Job@5 ZIP, with no manual app switching.

- **6.1** Studio-native export adapter consumes pinned immutable revision, approved take hashes, Visual Intent, media QA and existing Phase 3 validation semantics; ZIP is optional portable artifact, not mandatory internal transit.
- **6.2** Real full-video parity/acceptance: captions exactly two lines with Vietnamese font, watermark, cover opening frame, audio mix and punchline sync, no missing assets/states, checkpoint/resume on cancellation; benchmark cold/warm single-edit RAM and render time on actual Windows PC.
- **6.3** Migration and rollback: run old and new jobs, verify old ZIP open/replay; mark Qt/Zodiac Video Local orchestration as compatibility only **after** all user workflows pass; keep pinned Remotion for legacy and production until HyperFrames encoder is separately proven.

**Gate P6:** all user journeys, technical/native gates, genuine voice/Visual Review and full audio/visual QA pass with real artifacts; resource budget acceptable; no old project lost. If HyperFrames renderer parity fails, **release one-window editor with Remotion production fallback**, not a broken renderer migration.

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
P0 Project Core
   ↓
P1 One-window shell + Agent adapter
   ↓
P2 Voice Lab / measured timeline
   ↓
P3 HyperFrames scene editor
   ├──────────────┐
   ↓              ↓
P4 Asset Gallery  P5 Concepts/Packages (can be implemented separately after P1/P3)
   └──────┬───────┘
          ↓
P6 Full E2E + optional ZIP + migration gate
~~~

P4 and P5 can be independently developed on separate branches after their prerequisites, but integrated one at a time because they share the same project registry and Studio UI. Do not simultaneously mutate shared registry contracts or Qt launcher. Distinguish full Studio deployment from a throwaway HyperFrames compatibility spike.

## What is deliberately NOT in the MVP

- A normal post-approved script rewrite/editor, regeneration of Phase 1 creative evidence.
- Full professional animation/keyframe composer, generic NLE/video-editing feature parity.
- Full rewrite of V4 compilers, audio aligner, VoiceArtifactStore, package/cleanup logic.
- Automatic cloud bridge to remote ChatGPT Web, multiple distributed UI instances or multi-user CRDT.
- Mandatory HyperFrames final renderer replacement: editor and renderer decisions remain separate.

## Before implementation begins

- Review/accept this roadmap and P0 detailed plan. Write detailed P1–P6 implementation plans **at each phase gate**, using observed previous phase APIs, benchmarks and failures; do not pre-author invented exact signatures for future unbuilt modules.
- Use isolated worktrees/branches for code phases, red/green TDD, short commits, fresh reviews. Do not apply code changes to this docs-only PR #221.
- Maintain a phase summary at the end of each PR: what shipped, user workflow demo, test receipts, unresolved issues with scope, dependency updates and next phase's actual ready prerequisites.
