# Studio workflow and agent Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement task-by-task. User authorized implementation on 2026-11-20; execute inline without another approval round.

**Goal:** Complete the approved episode UI, initial agent authoring and native GUI E2E.

**Architecture:** Retain Project Core and canonical visual commands. Group existing screens; keep episode components mounted while switching sub-tabs. Extend bounded AgentManager with initial authoring, validated before confirmed writes.

**Tech Stack:** React/TypeScript, Tauri/Rust, Python, current V4/HyperFrames compiler.

**Spec:** `docs/superpowers/specs/2026-11-20-studio-workflow-agent-design.md`

## Global Constraints

- Preserve dirty work, approved source, takes and immutable exports. No release/installer/publish. User update 2026-11-22 authorizes and requires commit/push after each completed task.
- Human quality approvals remain PENDING; automation may confirm edit commands only.
- No new dependencies or renderer rewrite. Use existing component patterns and validators.

## Review Focus

- A delayed agent response must never appear in another episode.
- Changing selected voice/timing invalidates dependent proposals.
- Existing authored intent cannot be overwritten by initial authoring.
- Malformed, oversized and out-of-catalog model output cannot write files.
- Hidden media must pause; native receipts must survive restart.

### Task 1: Initial authoring capability

Files: `agent_bridge.py`, new `agent_authoring.py`, `rpc_stdio.py`, Rust allowlist, `backend.ts`; tests `test_studio_agent_authoring.py`.

Interface: `agent.author.start(project_id, instruction)` returns AgentTask kind `episode.propose`; existing `agent.apply` commits validated `source.replace` only when no source exists. Use task-bound narration/voice/timing/catalog hashes, canonical validation, and deterministic command ID. Existing scene proposals retain API compatibility.

- [x] Add failing tests for initial capability, invalid/no timing, forbidden paths/assets, stale dependencies, existing intent, and idempotent apply.
- [x] Implement capsule and output validation using installed compiler/library; no model filesystem access.
- [x] Run focused agent/RPC/visual tests and fix failures.

### Task 2: Grouped UI and contextual workflow

Files: `App.tsx`, `style.css`, `VisualEditor.tsx`, `VideoReview.tsx`, new `EpisodeExport.tsx` if needed.

Interface: three primary navigation groups and episode sub-tabs. Retain mounted VoiceLab/VisualEditor for the selected episode, reset by project key; agent receipts restore on open. Export/review consumes current backend video receipt and existing concept picker.

- [x] Update browser test navigation to fail against old eight-item shell.
- [x] Implement navigation, shared episode selector/status/next step, contextual agent/journal, initial authoring and readable proposals, export/review placement.
- [x] Run TypeScript and layout tests at existing viewport sizes; exercise switch/restore/error behavior.

### Task 3: Native GUI acceptance

Files: scoped native GUI automation under `.runtime/workflow-agent-e2e/`, checked-in evidence docs.

- [x] Start dev app on an isolated project store; import actual approved Nhân Mã handoff through UI. Preserve real WAV provenance if reused.
- [x] Drive agent initial authoring, apply, build, scene edit/apply and export through UI only. Fix any capability failures; never substitute scripts for authoring.
- [x] Record task/thread/turn, revisions, hashes, duration, screenshots, decode/probe and actual native playback. Reopen and verify receipts/media.
- [x] Keep human listening/visual/final review pending; report exact blockers if any.

### Task 4: Review and handoff

- [x] Run related regressions and CRLF-aware diff checks. Review changes independently per executing-plans; fix material findings.
- [x] Update README and evidence report with commands, outputs and remaining gates; report dev acceptance separately from production approval.

## Execution ledger

2026-11-20: Spec approved; worktree `experiment/main-2`, existing dirty work preserved. CodeGraph index belongs to main checkout, so inspect current worktree directly. Inline execution selected under existing authorization. No commits because design explicitly excludes them.

2026-11-22: User superseded the commit/push exclusion: finish each task, verify, update roadmap/evidence, commit and push to the working branch. Instruction/spec/plan handoff is its own documentation task. Implementation tasks remain IN_PROGRESS until their checks pass; the initial 17 focused agent tests passed, but the broad visual fixture needs its new dependency hash and compact Voice Lab still has a 614 px overflow to fix. No native agent-authoring E2E success claimed yet.

2026-11-22 Task 1: complete. Final related Python sweep passed 93 tests in 482.039s; Node passed 25 tests; native Rust passed 2 tests. Independent review found and confirmed the fix for a voice/timing apply race: compare under visual→voice locks through commit. Existing synthetic scene/performance receipts were updated to supply the new dependency fingerprint. Initial agent and scene-edit commands have also executed in the actual app; whole GUI export acceptance is still Task 3. Commit includes the pre-existing compatible backend gallery/ideas/export/TTS dependencies required to run these APIs remotely, preserving their tests and evidence.

2026-11-22 Task 1 pushed: `8de1f612` on `origin/experiment/main-2`.

2026-11-22 Task 2: complete. Three primary navigation groups, episode sub-tabs, source-bound next action, readable/restored proposals, contextual agent/journal and export/review are implemented. Hidden media pause and hidden workspace polling stops; slow reads are single-flight after a real cold Voice Lab read measured 25.454s. TypeScript, compact/expanded Ideas/review, gallery and export browser fixtures pass at the established sizes. Regression also covers a newly exported episode not disabling an independently opened local MP4. Full native workflow has produced and played its new 74.4s MP4; Task 3 still verifies reopen and publishes its source-bound evidence.

2026-11-22 Task 2 pushed: `3ab63d34` on `origin/experiment/main-2`.

2026-11-22 Tasks 3/4: complete. Actual GUI-native run passed in 833.897s with reused real voice. Initial task `9ab42cd670834eeea8de39ae1cf149a0` and scene task `ff86ee3bdfbf4c09a5da4e528d173969` were confirmed through GUI; export `29d4feff5c804ad3a8eb7c45837b7a13` is a new 74.4s H.264/AAC MP4, SHA `012871b8ef9937181f441fe52d8925b9d700e1c9b84306726ae1c14b2962753f`. Full decode, sidecar hashes and actual playback after native process restart passed. Review fixed the two Important findings; layout/Ideas/gallery/export fixtures and TypeScript passed. One verified dev app remains open on the isolated store. See `docs/audits/2026-11-22-studio-workflow-agent-e2e.{md,json}`. Human quality and broader P5/P6/P7 gates remain PENDING; no release/publication/production merge.
