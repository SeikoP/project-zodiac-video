# Web/Local Zodiac Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship separately installable Web and Local Zodiac plugin distributions with an immutable Phase-01 handoff capsule, zero-configuration local bootstrap, resumable Phase 2–3 processing, and atomic Job@5 delivery into `ready/`.

**Architecture:** Keep `plugins/zodiac-video-pipeline/` as the canonical implementation. Add shared handoff exporter/importer modules and two thin entry skills; release tooling builds two profile archives from the same source. Local queue state is filesystem-backed under `phase1-done/`, `processing/`, `blocked/`, and existing `ready/`.

**Tech Stack:** Node.js ESM, Python release tooling/tests, existing Job@5/ZIP core, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-11-08-web-local-zodiac-split-design.md`

## Global Constraints

- Preserve approved narration bytes and genuine source-bound reviews.
- Web owns only Phase 01; Local owns import plus Phase 02–03.
- No episode transport through Git.
- No background watcher.
- `ready/` remains LocalRunner's canonical repository inbox.
- No overwrite of an existing ready ZIP.
- No production ZIP before genuine Visual Review.
- Handoff format is `zodiac-phase1-handoff@1`.
- Baseline 2.7.16 remains recoverable via `backup/zodiac-2.7.16`.

## Review Focus

- Tampered or traversal ZIP must fail before writing a processing workspace.
- A crash/reinvoke must resume the same claimed run without duplicate import.
- Multiple pending capsules must be selected deterministically; multiple active workspaces must not be guessed.
- Approval hash drift must block Local Phase-02 activation.
- A Phase-03 failure must never leave a partial ZIP visible in `ready/`.

---

### Task 1: Phase-01 handoff contract and exporter

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/contracts/phase1-handoff.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/phase01/export-phase1-handoff.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/phase1-handoff-export.test.mjs`

**Interfaces:**
- Produces: `buildPhase1HandoffManifest(workspace)`, `exportPhase1Handoff(workspace, outputPath)`.
- Consumes existing approval hash and Phase-02 entry gate behavior.

- [ ] Write tests for valid export, Phase-02-already-active rejection, and approval drift.
- [ ] Run the test and verify RED.
- [ ] Implement deterministic handoff manifest + ZIP export using existing ZIP core.
- [ ] Run targeted test and full Node test suite.
- [ ] Commit.

### Task 2: Local secure importer and queue bootstrap

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/import-phase1-handoff.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/local-bootstrap.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/local-phase1-bootstrap.test.mjs`

**Interfaces:**
- Consumes: `zodiac-phase1-handoff@1`.
- Produces: `importPhase1Handoff(zipPath, processingRoot)`, `bootstrapLocal(queueRoot)` with status `PHASE2_LOCAL_READY` or explicit blocker.

- [ ] Write tests for tamper/traversal rejection, deterministic oldest inbox selection, claim/resume idempotency, and approval drift.
- [ ] Verify RED.
- [ ] Implement safe parse, inventory verification, canonical workspace materialization, atomic claim, Phase-02 activation and resume context.
- [ ] Run targeted and full Node tests.
- [ ] Commit.

### Task 3: Web and Local entry skills

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-web/SKILL.md`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-local/SKILL.md`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/split-entrypoint-contract.test.mjs`

**Interfaces:**
- Web entrypoint invokes Phase 01 then exporter and stops.
- Local entrypoint invokes local bootstrap then current Phase 02/03 router.

- [ ] Write contract tests asserting forbidden/owned phases and exact bootstrap/export entrypoints.
- [ ] Verify RED.
- [ ] Add entry skills with no duplicate workflow implementation.
- [ ] Run tests.
- [ ] Commit.

### Task 4: Two deterministic plugin distributions

**Files:**
- Create: `plugins/zodiac-video-pipeline/distributions/web.plugin.json`
- Create: `plugins/zodiac-video-pipeline/distributions/local.plugin.json`
- Create: `tools/release/build_split_plugin_bundle.py`
- Create: `tests/test_split_plugin_bundle_builder.py`
- Modify: `.github/workflows/zodiac-plugin-release.yml`

**Interfaces:**
- Produces `zodiac-video-web-plugin.zip` and `zodiac-video-local-plugin.zip` from canonical source.
- Archives use names `zodiac-video-web` and `zodiac-video-local` and expose only their matching top-level entry skill while retaining shared implementation bytes.

- [ ] Write Python tests for deterministic builds, entry-skill presence, distinct manifests and no stale monolithic default prompt.
- [ ] Verify RED.
- [ ] Implement profile builder and workflow artifact generation.
- [ ] Run Python tests and candidate integrity build.
- [ ] Commit.

### Task 5: Atomic Phase-03 delivery to ready/

**Files:**
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/run-local-phase03.mjs`
- Create: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/tests/local-ready-delivery.test.mjs`

**Interfaces:**
- Consumes existing `run-phase03-production.mjs`.
- Produces a validated archive under `<queue-root>/ready/` only after existing Phase-03 validation succeeds.

- [ ] Write tests for successful atomic publish, collision rejection and failure-with-no-ready-file.
- [ ] Verify RED.
- [ ] Implement private staging + existing Job@5 validation + atomic rename.
- [ ] Run targeted and full Node tests.
- [ ] Commit.

### Task 6: Release/version/docs and end-to-end smoke

**Files:**
- Modify: `plugins/zodiac-video-pipeline/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`
- Modify: `README.md`
- Modify: `docs/zodiac-release-process.md`
- Create: `tests/test_web_local_handoff_contract.py`
- Create: `docs/backups/zodiac-2.7.16.json`

**Interfaces:**
- Version all canonical/shared code coherently.
- Document install/release and user flow: download Phase-01 ZIP → put in `phase1-done/` → invoke local plugin → final Job@5 appears in `ready/`.

- [ ] Write integration smoke that builds both archives and exercises export → local import/activate using fixture workspace.
- [ ] Verify RED where new release expectations are absent.
- [ ] Bump release version and add backup metadata/docs.
- [ ] Run Node tests, Python tests, archive builds and release consistency checks.
- [ ] Commit.

### Final verification

- [ ] Run repository CI-equivalent test commands.
- [ ] Build both plugin archives twice and compare hashes.
- [ ] Run handoff export/import smoke against a real approved Phase-01 fixture.
- [ ] Confirm no partial artifact appears in `ready/` on injected Phase-03 failure.
- [ ] Perform whole-branch review and fix Critical/Important findings with RED→GREEN tests.
