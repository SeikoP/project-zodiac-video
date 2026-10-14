# Studio Production Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Studio checklist that tracks registered plugin episodes, optional series completion, explicitly linked Job@5 covers, and a complete copyable next-step prompt for the current plugin workflow.

**Architecture:** Keep source reading and Studio preference persistence in one small Python module, render the checklist in one Qt screen, then wire that screen into the existing Studio tabs and Job@5 inventory. The module reads the current plugin manifests and authoring artifacts; the UI stores only explicit references and the Cover visibility preference.

**Tech Stack:** Python 3, PySide6, `pathlib`, `json`, atomic `os.replace`, and the repository's `unittest` suite.

**Spec:** `docs/superpowers/specs/2026-10-14-production-checklist-design.md`

## Global Constraints

- Read authoring workspaces, plugin manifests/state, the explicitly linked series ledger, Runner job metadata, and cover images without writing to them.
- Write Studio preferences transactionally so an interrupted update cannot leave a partial configuration.
- Show missing workspaces, missing or malformed state/tracker, unsupported schema, and plugin/state version mismatches as visible diagnostics. Do not repair source files, silently fall back to guessed state, or present an error as PASS.
- If a linked job is missing or its cover has not rendered, keep the explicit link visible and show a placeholder/error in the card; do not silently relink it.
- Do not change the plugin `defaultPrompt` value, authoring contracts, phase state, approval rules, Job@5 package/import contracts, Runner execution, or rendered cover composition. The clipboard may quote the current prompt and manifest contract, but remains a read-only snapshot.
- Do not add automatic episode/job matching, plugin invocation, automatic sign planning, concept generation, or creative approval.

## Review Focus

- Malformed or unsupported Studio preferences: show a blocking diagnostic and do not overwrite the existing bytes; pin with `test_invalid_preferences_are_not_overwritten` in Task 1.
- Missing, malformed, or version-mismatched plugin state: show a diagnostic and no guessed phase/step; pin with `test_workspace_state_errors_are_diagnostic` in Task 1.
- Missing episode scope or an unselected/mismatched concept: show unavailable scope or **Chưa chốt**, never a candidate as selected; pin with `test_episode_scope_and_concept_are_not_guessed` in Task 1.
- An unlinked, malformed, or unsupported series tracker: show no linked ledger or a diagnostic and never infer sign completion; pin with `test_series_tracker_requires_valid_twelve_sign_contract` in Task 1.
- A removed Runner job or a job without `out/cover.png`: preserve the explicit ID and show a placeholder; pin with `test_missing_job_and_cover_keep_explicit_link` in Task 2.
- Unhashable `current_phase` or `current_step` data: show a state diagnostic without a traceback or guessed phase; pin in `test_workspace_state_errors_are_diagnostic` in Task 1.
- A continuation prompt for a multi-sign episode includes episode scope, concept state, each member's ledger status, member/overall progress, explicit Job@5, current defaultPrompt, and the current step's manifest outputs, gates, capabilities, context boundaries and references.

## File Structure

- Create `tools/studio_qt/production_checklist.py` for read-only source parsing and validated, atomic checklist-preference reads/writes.
- Create `tools/studio_qt/screens/production_checklist.py` for the Qt checklist, file pickers, job links, Cover cards, Cover visibility control, and plugin handoff clipboard action.
- Modify `tools/studio_qt/app.py` only to construct the screen, add the tab, and pass refreshed local job inventory to it.
- Create `tests/test_studio_production_checklist.py` for the pure data/config checks and Qt screen/integration checks; reuse the existing PySide6 test setup style in `tests/test_studio_qt.py`.

---

### Task 1: Checklist data and preference contracts

**Files:**
- Create: `tools/studio_qt/production_checklist.py`
- Create: `tests/test_studio_production_checklist.py`

**Interfaces:**
- `new_checklist_config() -> dict` returns `{"format": "zodiac-studio-checklist@1", "workspaces": [], "series_tracker_path": None, "cover_visible": True}`.
- `load_checklist_config(path: Path) -> tuple[dict, str | None]` returns defaults with no error only when the file is absent; malformed or unsupported files return defaults plus a diagnostic so the UI can remain read-only.
- `save_checklist_config(path: Path, config: dict) -> None` validates the format and reference fields, writes a same-directory temporary file, flushes it, then atomically replaces the destination.
- `load_episode_row(workspace: Path, plugin_root: Path, linked_job: Path | None = None) -> dict` returns workspace path, episode ID/format, localized member labels, title/topic, selected concept or `None`, phase and step IDs/titles/statuses, the active step contract, run mode/flags, optional job ID/cover path, and diagnostics.
- `load_series_tracker(path: Path) -> dict` returns the validated 12-sign ID/status rows or a diagnostic. Neither source loader mutates its inputs.

- [ ] **Step 1: Write failing `unittest` cases** for config defaults/round-trip, invalid config preservation, failed atomic replacement preserving prior bytes, live phase-index/manifest labels, valid and mismatched workspace state, selected versus absent/mismatched concept, and valid/invalid series tracker contract.
- [ ] **Step 2: Run the new data tests and verify the initial failure.** Run `python -m unittest tests.test_studio_production_checklist.ProductionChecklistDataTests -v`; expected: import/attribute failures for the unimplemented module/functions.
- [ ] **Step 3: Implement the module interfaces** using `zodiac-phase-index@2`, each referenced `zodiac-phase-manifest@2`, `zodiac-pipeline-state@2`, `zodiac-episode-scope@1`, the matched `narrative-plan.json.selected_concept_id` / `concept-candidates.json.selected_candidate_id`, and `zodiac-series-checklist@1`. Resolve the selected concept by candidate ID; use its premise as the display name.
- [ ] **Step 4: Run the data tests.** Run `python -m unittest tests.test_studio_production_checklist.ProductionChecklistDataTests -v`; expected: all pass and source fixture bytes remain unchanged.
- [ ] **Step 5: Commit** the module and data tests as `feat: add production checklist data reader`.

### Task 2: Checklist screen and user actions

**Files:**
- Create: `tools/studio_qt/screens/production_checklist.py`
- Modify: `tests/test_studio_production_checklist.py`

**Interfaces:**
- `ProductionChecklistScreen(config_path: Path, plugin_root: Path, runner_jobs: list[dict], parent=None)` builds the screen from the stored preferences and supplied local job inventory.
- `set_runner_jobs(jobs: list[dict]) -> None` refreshes the explicit link choices while preserving any configured job ID that is no longer present.
- `refresh() -> None` rereads the registered workspaces/tracker and rebuilds the visible checklist; malformed preference files disable mutations and show their diagnostic.

- [ ] **Step 1: Write failing Qt tests** for registered episode rows, **Chưa chốt**, explicit Job@5-only selection, stale/missing job and cover placeholders, persisted Cover toggle, unlinked/linked tracker display separate from episode state, tracker link persistence/unlinking, and clipboard prompt with complete episode context, member/overall tracker progress, explicit Job@5, current defaultPrompt, and active-step manifest outputs/gates/capabilities.
- [ ] **Step 2: Run the new Qt tests and verify the initial failure.** Run `$env:QT_QPA_PLATFORM='offscreen'; python -m unittest tests.test_studio_production_checklist.ProductionChecklistScreenTests -v`; expected: import/attribute failures for the unimplemented screen.
- [ ] **Step 3: Implement `ProductionChecklistScreen`** with add/remove workspace controls, one optional series-tracker file picker, a persisted Cover visibility checkbox, a per-row explicit Job@5 selector and handoff action, and a Cover card that loads only the linked job's actual `out/cover.png` or displays a placeholder. Keep the job link when the job or image is missing.
- [ ] **Step 4: Run the Qt screen tests.** Run `$env:QT_QPA_PLATFORM='offscreen'; python -m unittest tests.test_studio_production_checklist.ProductionChecklistScreenTests -v`; expected: all pass and the persisted paths/settings survive screen recreation.
- [ ] **Step 5: Commit** the screen and tests as `feat: add Studio production checklist screen`.

### Task 3: Studio tab and Job@5 inventory wiring

**Files:**
- Modify: `tools/studio_qt/app.py`
- Modify: `tests/test_studio_production_checklist.py`

**Interfaces:**
- `ZodiacQtApp` owns `self.checklist`, configured under its existing `self.workspace` root and using the repository's current Zodiac plugin root.
- `_refresh_media_jobs()` continues to update Media and also calls `self.checklist.set_runner_jobs(self._media_jobs())`; the checklist itself filters the existing `group == "Job@5"` rows.

- [ ] **Step 1: Write a failing app integration test** proving the new **Checklist sản xuất** tab is present, preferences are stored under the supplied Studio workspace, and refreshing inventory exposes Job@5 rows without offering legacy Job local rows.
- [ ] **Step 2: Run the integration test and verify the initial failure.** Run `$env:QT_QPA_PLATFORM='offscreen'; python -m unittest tests.test_studio_production_checklist.ProductionChecklistAppTests -v`; expected: missing tab/screen wiring.
- [ ] **Step 3: Wire the screen into `ZodiacQtApp`** beside the existing Workspace and Media tabs and update it from `_refresh_media_jobs()` without changing Runner discovery or Job@5 contracts.
- [ ] **Step 4: Run targeted Studio tests.** Run `$env:QT_QPA_PLATFORM='offscreen'; python -m unittest tests.test_studio_production_checklist tests.test_studio_qt tests.test_studio_qt_usability -v`; expected: all pass.
- [ ] **Step 5: Run required repository checks.** Run `python -m unittest discover -s tests -v` and `python -m pytest`; expected: both exit successfully. If the local environment lacks GUI/media dependencies, report that exact skipped check instead of treating it as passed.
- [ ] **Step 6: Commit** app wiring and integration tests as `feat: wire production checklist into Studio`.

### Task 4: Contract-aware continuation prompt and plugin 2.6.0 release

**Files:**
- Modify: `tools/studio_qt/production_checklist.py`
- Modify: `tools/studio_qt/screens/production_checklist.py`
- Modify: `tests/test_studio_production_checklist.py`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/SKILL.md`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/router.md`
- Modify: `plugins/zodiac-video-pipeline/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/.codex-plugin/plugin.json`
- Modify: `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/orchestration/pipeline-state.template.json`

- [ ] Add regression cases for malformed state pointers, missing preference keys, empty concept selections, and a two-member episode with `1/2` signs marked done.
- [ ] Copy a contract-aware continuation prompt using the live plugin `defaultPrompt`, current phase manifest, tracker ledger and explicit Job@5 association. The agent re-reads sources and follows current approval gates.
- [ ] Strengthen the existing router/skill resume procedure around state → active manifest → bounded step context → verified outputs/receipts → phase gate. Keep manifests as the single contract source and preserve the defaultPrompt value.
- [ ] Synchronize release metadata to `2.6.0`; run repository and plugin orchestration suites; build and inspect the deterministic plugin package.
- [ ] Update the existing private ChatGPT plugin with its verified ID/release ID, then read back version, manifests, skill, router and preserved defaultPrompt.
- [ ] Commit and push scoped changes to `main`; preserve pre-existing `.gitignore` and `.codegraph/` changes.

## Final acceptance

- Open the GUI with two registered source workspaces (Gemini and Libra), link one actual local Job@5, and confirm rows keep their own scope/phase data.
- Confirm the actual linked `out/cover.png` loads in its card; if no real output exists locally, report that media-preview acceptance separately from the passing fixture-based UI tests.
- Toggle Cover visibility and relaunch the checklist; confirm it persists independently of per-job GUI settings.
- Select an exported tracker file and confirm only its recorded `done` signs appear complete; confirm unlinking changes no tracker bytes.
- Confirm a copied continuation prompt carries topic/concept/member ledger status/series progress/Job@5 and the active-step contract; verify it tells the agent to re-read current state and honor router and approvals.
- Confirm phase resume improvements reuse existing manifests and gates, without another orchestrator or changed creative approval.
- Confirm the plugin package and account readback use version `2.6.0`, preserve plugin identity and defaultPrompt, and contain only required runtime source, contracts, guidance and assets.
