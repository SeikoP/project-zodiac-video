# Zodiac Studio Phase 0 — Foundation & Evidence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status:** READY FOR REVIEW, NOT IMPLEMENTED, 2026-11-14.

**Goal:** Provide a crash-safe, verifiable **Studio-native** episode/project foundation that can import a legitimately approved Phase 1 v2 capsule **without needing Job@5 first**, preserve old imports, and expose a single state/evidence interface for the later one-window Studio and agent.

**Architecture:** Add a small Python `tools/studio_project` package for a durable SQLite metadata/ordered-event index and read-only source/receipt projections. Reuse the existing Node `inspectPhase1Handoff`/`materializePhase1Handoff` importer for exact hash/approval checks, existing Python Job@5 loader for older jobs, and existing artifact/state code as **readers**, not new sources of truth. No UI/renderer/App Server work occurs in this phase.

**Tech Stack:** Python 3.9-compatible stdlib domain module (`sqlite3`, `pathlib`, `unittest`) plus existing Node 20+ phase1 importer. Next phases may require Python 3.10+ for desktop PySide/React host. No new DB dependency.

**Spec:** [Unified design](../specs/2026-11-14-agent-native-creative-studio-design.md), [roadmap](./2026-11-14-unified-zodiac-studio-roadmap.md), [Compiler VNext architecture](../specs/2026-11-14-zodiac-compiler-refactor-design.md).

## Global Constraints

- Do not alter immutable Phase 1 handoff source, receipt, or narration; v2 must pass exact existing ZIP inventory and content source-hash checks.
- P0 must **freeze the existing compiler regression, quality and profiling surface** for Phase 3. **Record V1 contract versions, V4 palette/audio baselines and actual plugin asset selection ownership**: [V1 upgrade candidates](../../audits/2026-11-14-version-upgrade-candidates.md), [Visual V5](../specs/2026-11-14-zodiac-visual-v5-color-system-design.md), [Audio Design](../specs/2026-11-14-zodiac-audio-library-sound-design.md). Existing Mixkit catalog items are NOT playable files merely because metadata exists; record missing assets honestly. Specifically capture a **whole-episode throughput baseline** (handoff receipt→agent Visual Intent first complete→native build→candidate preview→visual review-ready→render/MP4 where actually observed) using existing `episode-profiler.mjs`, `diagnose-phase02.mjs` and Studio V2 performance logs. Count agent revisions/tool calls/retries, actual native child process launches, candidate scene count, cross-scene asset reuse, peak RAM/disk and unmeasured spans as `null`; never mistake a last-receipt native sum for a full job duration. Audit historical native last receipts and explicitly mark absent wall/agent time as UNMEASURED. P0 must not rewrite current V4 compilers or treat golden fixtures as actual user Visual Review.
- Do not replace or edit `.authoring/visual-intent.json` or derived projections; no fresh Visual Intent writer in P0.
- New metadata may be stored in a single SQLite `studio-index.sqlite3`, but canonical episode/project files and existing Job@5 artifacts stay in their own source trees. **Index is not production source**.
- Keep `tools/studio_v2/session.py`, `tools/application/service.py`, `tools/studio_qt/*` and old ZIP import functional. P0 has no UI change and cannot claim a one-window product.
- Events and user review evidence are different: `command.recorded` does not mean `PHASE1_APPROVED`, `VOICE_ACCEPTED` or `VISUAL_APPROVED`. No fake approval as a side effect of any command.
- On malformed ZIP, missing Node, absent review receipt, crash, path traversal, partial import or malformed old project, fail with a typed issue and leave existing healthy project/old ZIP untouched.
- Use test-generated synthetic approval *only inside isolated tests*. Never publish synthetic approval as real production evidence.
- TDD + one peer/reviewer gate per task; an end-of-phase integration smoke, tracked source version and rollback instructions are mandatory.

## Review Focus (five sharp edges, each pinned below)

1. **Corrupted v2 ZIP / approval-source drift:** Task 3 tests negative import, zero visible project and preserved original ZIP.
2. **Same capsule imported twice or concurrent import:** Task 3 checks one project identity, stable exact source hash and idempotent event.
3. **Interrupted DB/file operation or process restart:** Task 2 tests replay; Task 3 tests cleanup of uncommitted temp materialization.
4. **Legacy take labeled APPROVED but not human listened; missing receipts:** Task 4 tests independent status classifications and UNKNOWN.
5. **Untrusted path / symlink escape / missing Node:** Task 3 verifies import can't escape projects root and reports actionable errors.

---

## File/ownership map (before touching code)

| Owner | Create / modify | Owns and does not own |
| --- | --- | --- |
| P0 compatibility | `docs/audits/2026-11-14-studio-phase00-baseline.md`; `tests/test_studio_project_baseline.py` | Owned source/test matrix **plus compiler step/scene-quality/benchmark coverage**, not rewritten runtime |
| Project models | `tools/studio_project/__init__.py`; `models.py` | `ProjectHandle`, `StudioIssue`, `EpisodeStatus` typed shapes; no second visual source |
| Index/event store | `tools/studio_project/registry.py`; `events.py` | SQLite episode index, unique source identity, ordered events, idempotent command records |
| Node importer bridge | `tools/studio_project/handoff_bridge.mjs`; `importer.py` | Verified Phase 1 import and filesystem-safe materialization; invoke current canonical importer, don't reimplement validator |
| Status + evidence | `tools/studio_project/status.py`; `evidence.py` | Status derived from real file hashes/receipts, phase acceptance ledger; never approve by itself |
| Tests | `tests/test_studio_project_baseline.py`; `tests/test_studio_project_registry.py`; `tests/test_studio_project_import.py`; `tests/test_studio_project_evidence.py` | New unit and cross-language integration tests with temporary isolated roots |

These names are **proposed interfaces**, not claims that these files currently exist. If existing code supplies an equivalent primitive, wrap it and update this map instead of duplicating.

### Cross-task API types (one shared naming contract)

```python
@dataclass(frozen=True)
class ProjectHandle:
    project_id: str
    workspace: Path
    imported_source_sha256: str
    episode_id: str

@dataclass(frozen=True)
class StudioIssue:
    code: str
    message: str
    stage: str

@dataclass(frozen=True)
class EpisodeStatus:
    project_id: str
    content: str   # APPROVED / BLOCKED / UNKNOWN
    voice: str     # USER_LISTENED_APPROVED / TECHNICAL_VALID / COMPAT_MIGRATED / UNKNOWN
    visual: str    # REVIEWED / BLOCKED / UNKNOWN
    video: str     # EXPORTED / UNKNOWN
    published: str # CONFIRMED / UNKNOWN
```

P0 defines statuses, not approvals. Later phase add take and scene evidence, but must preserve `UNKNOWN` instead of inventing PASS.

## Task 0.1: Freeze compatibility and make the owner/test map executable

**Files:**
- Create `docs/audits/2026-11-14-studio-phase00-baseline.md`
- Create `tests/test_studio_project_baseline.py`
- Read-only references: `tests/test_studio_v2_zip_import.py`, `tests/test_studio_v2_voice.py`, `tests/test_studio_production_checklist.py`, `tests/test_library.py`; `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/import-phase1-handoff.mjs`

**Interfaces:** fixture helper `baseline_sources(repo_root: Path) -> dict[str, Path]`, indicating actual existing sources. This is a test/audit utility, not a new public application API. Define a benchmark manifest (baseline-only) with `scenario_id`, `source_sha256`, `compiler_version`, `cache_mode`, `wall_ms` or `null`, `step_ms`, `agent_ms` or `null`, `preview_ms` or `null`, `cache_reuse`, `scene_count`, `artifact_hashes`, `measurement_environment`; NEVER invent a duration for an unobserved step.

- [ ] **Step 1: Write failing tests** `test_existing_import_contract_is_present`, `test_existing_voice_take_contract_is_present`, `test_existing_asset_and_library_adapters_exist`, `test_compiler_modules_and_perf_collectors_mapped`, `test_v1_contract_catalog_and_audio_mix_baseline`, `test_theme_registry_and_missing_media_are_not_approved`, `test_selection_is_id_filter_not_ranker`, `test_fresh_scene_set_exclusion_is_documented`, `test_unknown_agent_wall_time_is_null`; assert canonical compiler, preview, semantic cache, native scene worker, profiler and V4 owner paths, not synthetic PASS.
- [ ] **Step 2: Verify RED** via `python -m unittest discover -s tests -p 'test_studio_project_baseline.py' -v` (missing module/helper).
- [ ] **Step 3: Implement `baseline_sources`**; add baseline map and benchmark manifest to audit MD. Document current behavior: Job@5 precondition for V2 session, `local-bootstrap` queue, V4 Character Assembly / scene-direction worker / preview-pair cache / semantic dependency graph / preflight validators / legacy renderer and pins. Capture regression commands and actual fixture IDs. Identify golden scene tests for Libra 3-state scale, Gemini actor relation, Scorpio meme before/after and caption/hand overlap; **inventory V4 six art-direction palettes, six background palettes, current scene-set hex substitution and fresh-policy drift, `select-asset-guidance.mjs` ID filtering, static picker `environment_mode:scene_set`, actual `props/index.json` context/contact relations, capability catalog source owners, and missing Studio agent semantic ranker, `timing-v1`/`performance-context-v1`/`render-plan-v1`/`publish-v1`/`motion-registry-v1`, Studio V2 optional one-track audio mixer, 16 cataloged Mixkit music metadata rows, absent tracked Mixkit MP3s and garden CC0 WAVs**; **reuse already approved review evidence only when it exists**, else label fixture synthetic or PENDING. Run read-only `core/performance/diagnose-phase02.mjs` on a verified available workspace if possible, and otherwise document unmeasured instead of manufacturing numbers.
- [ ] **Step 4: Verify GREEN** with the new test and a focused existing baseline set: `python -m unittest discover -s tests -p 'test_studio_v2_zip_import.py' -v`; `python -m unittest discover -s tests -p 'test_studio_v2_voice.py' -v`. Record whole-episode handoff-to-preview/export plus cold / unchanged warm / one-scene-edit **only when a runnable representative fixture and reproducible cache state are actually available**; also record missing run cases and unmeasured categories. Record any environment-dependent failure, never change expected verdict to green.
- [ ] **Step 5: Commit** source/test map and tests, e.g. `test(studio): freeze project import and voice compatibility baseline`.

**Task done:** a new engineer can identify the exact authoritative import/voice/checklist/library paths **and compiler/quality/perf baseline**, distinguishing measured data from missing data; existing source untouched.

## Task 0.2: Durable project index, typed events and restart recovery

**Files:**
- Create `tools/studio_project/__init__.py`, `models.py`, `registry.py`, `events.py`
- Create `tests/test_studio_project_registry.py`

**Interfaces:**
- `EpisodeRegistry(root: Path)`
- `EpisodeRegistry.register(project: ProjectHandle, source_manifest_hash: str) -> ProjectHandle` (one record per verified source identity; mismatch raises typed conflict)
- `EpisodeRegistry.get(project_id: str) -> ProjectHandle | None`
- `EpisodeRegistry.find_by_source(source_sha256: str) -> ProjectHandle | None`
- `EpisodeRegistry.record_command(project_id: str, command_id: str, base_revision: int, kind: str, payload: dict) -> dict` (idempotent, strictly advances revision only for new authorized metadata command)
- `EpisodeRegistry.events_since(project_id: str, after_seq: int) -> list[dict]`

- [ ] **Step 1: Write failing tests** `test_register_and_reopen_same_source`, `test_reject_identity_collision`, `test_replay_events_after_reopen`, `test_stale_revision_conflicts`, `test_repeated_command_id_reuses_result`, `test_failed_write_has_no_partial_event`. Use temporary directories and explicit expected revisions/sequence numbers.
- [ ] **Step 2: RED:** `python -m unittest discover -s tests -p 'test_studio_project_registry.py' -v`.
- [ ] **Step 3: Implement** SQLite transactionally with unique `(source_sha256)`, `(project_id, command_id)`, ordered event sequence and durable WAL. Store IDs + source paths + digests + event metadata only, never a mutable narration or Visual Intent duplicate. Reopening must replay committed events and leave incomplete work as recoverable; typed `REVISION_CONFLICT`, `COMMAND_SCOPE_FORBIDDEN` and `REGISTRY_INVALID`.
- [ ] **Step 4: GREEN:** same command; run focused `test_studio_v2_state.py` and `test_studio_v2_session.py` to assert old session behavior remains.
- [ ] **Step 5: Commit** `feat(studio): add durable episode registry and event log`.

**Task done:** stable event stream and project identity survive process restart; no raw agent writes or human approvals in API.

## Task 0.3: Real Phase 1 import without mandatory Job@5 ZIP

**Files:**
- Create `tools/studio_project/handoff_bridge.mjs`, `tools/studio_project/importer.py`, `tests/test_studio_project_import.py`
- Reuse, do NOT fork: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/phases/local/import-phase1-handoff.mjs`

**Interfaces:**
- Node bridge CLI `node tools/studio_project/handoff_bridge.mjs inspect <capsule.zip>` → one machine JSON object with verified manifest/source SHA, or typed nonzero error.
- Node bridge CLI `node tools/studio_project/handoff_bridge.mjs materialize <capsule.zip> <temporary-project-root>` → verified native source files + manifest/receipt.
- Python `import_handoff(projects_root: Path, capsule_path: Path, registry: EpisodeRegistry) -> ProjectHandle`; use `inspectPhase1Handoff` and `materializePhase1Handoff` directly in Node; never rebuild ZIP validation in Python.

- [ ] **Step 1: Write failing tests** `test_valid_v2_import_immutable_original`, `test_same_zip_idempotent`, `test_source_hash_drift_blocks`, `test_missing_content_approval_blocks`, `test_traversal_or_symlink_escape_blocks`, `test_node_missing_is_typed_error`, `test_interrupted_import_keeps_prior_episode_and_can_retry`. Use a synthetic *test-only* fixture with real ZIP inventory/hashes and v2 approval shape, plus one manually supplied real handoff for release E2E.
- [ ] **Step 2: RED:** `python -m unittest discover -s tests -p 'test_studio_project_import.py' -v`.
- [ ] **Step 3: Implement** Node subprocess bridge and staged import. Validate before any visible registry record; preserve original bytes; materialize into private temporary path inside projects root; verify `CONTENT_APPROVAL_SOURCE_DRIFT` protection, then atomic rename and register. Handle crash between rename/registry commit via deterministic adoption/recovery or quarantine, never duplicate. For concurrent same-source imports use a bounded lock plus registry uniqueness.
- [ ] **Step 4: GREEN:** same new tests; rerun `test_studio_v2_zip_import.py` and `test_episode_job5_import.py`. Verify Node bridge JSON on one valid isolated fixture, errors on corrupted ZIP and no unexpected stdout.
- [ ] **Step 5: Commit** `feat(studio): import approved Phase 1 into source-safe project`.

**Task done:** direct Studio project creation is real and idempotent; old Job@5 import continues unchanged.

## Task 0.4: Derived evidence/status view and phase gate that cannot fake PASS

**Files:**
- Create `tools/studio_project/status.py`, `tools/studio_project/evidence.py`, `tests/test_studio_project_evidence.py`
- Reuse readers: `tools/studio_qt/production_checklist.py`, `tools/control_plane/artifact_graph.py`, `tools/studio_v2/state.py`, `tools/application/library.py`.

**Interfaces:**
- `resolve_episode_status(handle: ProjectHandle) -> EpisodeStatus`; resolves from **bound source bytes + genuine receipts/artifacts** rather than an edited status field.
- `evaluate_phase_gate(report: dict, required_ids: set[str]) -> dict` returns `{"status":"MERGE_READY" | "BLOCKED", "issues":[...], "format":"zodiac-studio-phase-evidence@1"}`. Never writes review evidence.
- Report required keys: `phase_id`, `task_id`, `baseline_commit`, `implementation_commit`, `requirements`, `contracts`, `reused_components`, `changed_files`, `test_runs`, `smoke_artifacts`, `review_gates`, `risks`, `deferred`, `rollback`, `handoff_ready`.

- [ ] **Step 1: Write failing tests** `test_approved_content_requires_bound_real_receipt`, `test_missing_visual_review_is_unknown`, `test_compatibility_approved_take_not_human_listened`, `test_zip_does_not_mean_video_or_published`, `test_evidence_missing_required_item_blocks`, `test_failed_test_or_missing_artifact_blocks`, `test_report_includes_source_and_rollback`. Explicitly reject `"PASS"` text with no hash/receipt proof.
- [ ] **Step 2: RED:** `python -m unittest discover -s tests -p 'test_studio_project_evidence.py' -v`.
- [ ] **Step 3: Implement** thin reader/adapters; preserve `UNKNOWN` and `BLOCKED` distinctions. Gate may verify tool-reported test commands/log paths and artifact hashes but cannot generate human review. Legacy user-facing `done/todo` is a hint, not video publication evidence.
- [ ] **Step 4: GREEN:** same tests; run existing `test_studio_production_checklist.py`, `test_library.py`, `test_control_plane_cache.py` and `test_studio_v2_voice.py`. Then combined `python -m unittest discover -s tests -p 'test_studio_project_*.py' -v`.
- [ ] **Step 5: Commit** `feat(studio): derive status and enforce evidence-gated handoff`.

**Task done:** project stage visibility is truthful and the next agent cannot silently omit mandatory work in this phase.

## Phase 0 end-to-end integration and handoff gate

- [ ] Execute Phase 0 tests and focused existing regression commands above; document exact command, exit code, test count, commit and failures. Preserve compiler quality/bench manifest, including cold/warm/one-scene edit if measurable and UNMEASURED if not. No test execution is claimed by this plan.
- [ ] Run one **real** approved Phase 1 v2 capsule in an isolated workspace: import → reopen → status derived → restart registry → import again (idempotent) → read events. The imported source SHA and exact bytes must match the capsule.
- [ ] Run an invalid/tampered capsule and missing Node scenario: no healthy episode mutated or marked APPROVED.
- [ ] Reopen a completed old Job@5 package using existing Studio V2 and confirm it is not orphaned by new index. Keep Qt unchanged.
- [ ] Review source ownership: a `.authoring/visual-intent.json`, WAV, cover or ZIP is **not** recreated by this phase. Project events are metadata, not creative approval.
- [ ] Record `zodiac-studio-phase-evidence@1` with P0.1–P0.4 task results, reviewer signoff, baseline/implementation commit, rollback and `handoff_ready`. The user must see remaining PENDING items rather than false DONE.
- [ ] Confirm isolated worktree/branch PR and rollback: revert the new `tools/studio_project` entrypoint/index, preserve all existing ZIPs/projects; no destructive migration ran.

**Definition of ready for Phase 1:** real project registry/event API and importer are tested; one approved episode reopens without Job@5; old Job@5 and V4 pipeline regressions stay valid; compiler/preview/quality ownership and baseline scenarios are documented with actual vs unknown timings; agent/context ownership documented; P0 report has no missing mandatory ID or fabricated review.

**Out of scope until next plans:** HyperFrames installation and editor UI, Codex App Server launch, VieNeu synthesis quality tuning, asset gallery, concept×12 UI, scene authoring, media export. Their phase charters are in the [roadmap](./2026-11-14-unified-zodiac-studio-roadmap.md). Create detailed task-level plans for them only after measuring P0 actual artifacts and stability.
