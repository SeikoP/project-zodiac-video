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

- [ ] Update browser test navigation to fail against old eight-item shell.
- [ ] Implement navigation, shared episode selector/status/next step, contextual agent/journal, initial authoring and readable proposals, export/review placement.
- [ ] Run TypeScript and layout tests at existing viewport sizes; exercise switch/restore/error behavior.

### Task 3: Native GUI acceptance

Files: scoped native GUI automation under `.runtime/workflow-agent-e2e/`, checked-in evidence docs.

- [ ] Start dev app on an isolated project store; import actual approved Nhân Mã handoff through UI. Preserve real WAV provenance if reused.
- [ ] Drive agent initial authoring, apply, build, scene edit/apply and export through UI only. Fix any capability failures; never substitute scripts for authoring.
- [ ] Record task/thread/turn, revisions, hashes, duration, screenshots, decode/probe and actual native playback. Reopen and verify receipts/media.
- [ ] Keep human listening/visual/final review pending; report exact blockers if any.

### Task 4: Review and handoff

- [ ] Run related regressions and CRLF-aware diff checks. Review changes independently per executing-plans; fix material findings.
- [ ] Update README and evidence report with commands, outputs and remaining gates; report dev acceptance separately from production approval.

## Execution ledger

2026-11-20: Spec approved; worktree `experiment/main-2`, existing dirty work preserved. CodeGraph index belongs to main checkout, so inspect current worktree directly. Inline execution selected under existing authorization. No commits because design explicitly excludes them.

2026-11-22: User superseded the commit/push exclusion: finish each task, verify, update roadmap/evidence, commit and push to the working branch. Instruction/spec/plan handoff is its own documentation task. Implementation tasks remain IN_PROGRESS until their checks pass; the initial 17 focused agent tests passed, but the broad visual fixture needs its new dependency hash and compact Voice Lab still has a 614 px overflow to fix. No native agent-authoring E2E success claimed yet.

2026-11-22 Task 1: complete. Final related Python sweep passed 93 tests in 482.039s; Node passed 25 tests; native Rust passed 2 tests. Independent review found and confirmed the fix for a voice/timing apply race: compare under visual→voice locks through commit. Existing synthetic scene/performance receipts were updated to supply the new dependency fingerprint. Initial agent and scene-edit commands have also executed in the actual app; whole GUI export acceptance is still Task 3. Commit includes the pre-existing compatible backend gallery/ideas/export/TTS dependencies required to run these APIs remotely, preserving their tests and evidence.
