# Parallel PySide6 Task Workbench Implementation Plan

> Current launch contract: `zodiac` opens PySide6. The standalone Tk Studio and the Qt menu action that opened the Tk Editor have been removed. This supersedes the earlier launcher and Editor mapping below.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a new, task-centered PySide6 GUI alongside the usable Tk GUI, retaining the old default while the new frontend reaches real-workflow acceptance.

**Architecture:** Keep `zodiac` unchanged and add `zodiac-qt`. Put the new interface in `tools/studio_qt/` with a focused start screen and a distinct stage-centered Task Workbench. Reuse current controllers, Job@5 session/executor, workers, services, and job state; bridge background events into Qt with signals.

**Tech Stack:** Python 3.10+ for optional Qt use, PySide6 Essentials 6.10+ (Qt Widgets) and Addons (Qt Multimedia), existing Python backend, `unittest`, Qt offscreen platform.

**Spec:** `docs/superpowers/specs/2026-10-09-parallel-pyside6-gui.md`

## Global Constraints

- Keep `zodiac = "tools.zodiac_gui:main"` unchanged and fully usable.
- Add `zodiac-qt = "tools.zodiac_qt:main"` and optional dependency extra `qt`.
- Keep PySide6 optional; only the new frontend requires Python 3.10+.
- All new UI code lives in `tools/studio_qt/`; do not import Tk widgets or `tools.studio.views`.
- Do not copy the old GUI's panel layout, theme, or widget structure.
- Keep controllers, sessions, workers, package contracts, persisted state, and output paths compatible.
- Render percent only from measured backend progress; otherwise show indeterminate progress and the active stage name.
- Do not change the default launcher, remove Tk, create new persistence formats, or enable concurrent pipeline runs against one workspace.

## Review Focus

- Empty workspace: show import/recent jobs with no blank pipeline/settings controls; test empty state.
- Worker event from background thread: update UI on Qt main thread and retain useful event text; test cross-thread delivery.
- Job@5 with no trustworthy percentage: show indeterminate active stage and never `50%`; test rendered state.
- Cancel/window close during a stage: request current safe cancellation and remain open until worker/session stops; test cancel and close.
- Read-only open/reopen: do not rewrite package/render artifacts; test job and settings restoration against fixture hashes.

---

### Task 1: Add the separate Qt launcher and an independent design system

**Files:**
- Create: `tools/zodiac_qt.py`
- Create: `tools/studio_qt/__init__.py`
- Create: `tools/studio_qt/theme.py`
- Create: `tools/studio_qt/app.py`
- Modify: `pyproject.toml`
- Test: `tests/test_studio_qt.py`

**Interfaces:**
- `zodiac-qt` maps to `tools.zodiac_qt:main`.
- Development launch: `uv run --extra qt zodiac-qt`.
- Optional dependency: `PySide6-Essentials>=6.10,<7; python_version >= '3.10'` (contains the Qt Widgets modules; avoid unused add-on/WebEngine wheels).
- `tools.zodiac_qt.main() -> int` reports missing PySide6 or unsupported Python clearly, then delegates to `tools.studio_qt.app.main() -> int`.
- Independent design tokens: cool neutral light background, blue primary, semantic success/warning/error, system UI font, 8px spacing scale, visible focus.

- [ ] Add tests for the separate launcher, import isolation from Tk, and missing dependency/version messages.
- [ ] Run `python -m unittest discover -s tests -p test_studio_qt.py -v` and confirm feature-specific failures.
- [ ] Add the optional Qt extra and `zodiac-qt` without modifying the `zodiac` mapping.
- [ ] Implement the launcher, design-token module, and minimal QApplication lifecycle.
- [ ] Run the focused test with `QT_QPA_PLATFORM=offscreen` and confirm pass; verify importing the Qt launcher does not load Tk modules.

### Task 2: Build the new start screen and Task Workbench shell

**Files:**
- Create: `tools/studio_qt/screens/__init__.py`
- Create: `tools/studio_qt/screens/home.py`
- Create: `tools/studio_qt/screens/workbench.py`
- Create: `tools/studio_qt/widgets/__init__.py`
- Create: `tools/studio_qt/widgets/stage_rail.py`
- Create: `tools/studio_qt/widgets/activity_drawer.py`
- Modify: `tools/studio_qt/app.py`
- Test: `tests/test_studio_qt.py`

**Interfaces:**
- `ZodiacQtApp(QMainWindow)` selects `HomeScreen` when no job is active and `WorkbenchScreen` after opening/importing a job.
- `StageRail.set_rows(rows: list[dict])` renders ordered stage, state, and selectable rerun target.
- `WorkbenchScreen.set_active_stage(step: str, row: dict, *, percent: float | None = None)` updates the main task area; `percent=None` is indeterminate.
- Header hosts job identity and secondary menu; sticky footer hosts current primary action and active-run stop action; full logs open in a drawer.

- [ ] Add offscreen tests for empty state, active-job hierarchy, all seven stage labels, keyboard-selectable stages, and absence of old panel/theme strings.
- [ ] Run the focused Qt tests and confirm the new layout expectations fail.
- [ ] Implement the no-job home and task-centered workbench with adaptive Qt layouts; do not reproduce the Tk section grid.
- [ ] Implement stage state cues with text/icon plus shape; show measured percentage only when passed an actual progress value.
- [ ] Run focused offscreen tests and confirm both screen states pass.

### Task 3: Connect legacy and Job@5 workflows to the Workbench

**Files:**
- Create: `tools/studio_qt/events.py`
- Modify: `tools/studio_qt/app.py`
- Modify: `tools/studio_qt/screens/home.py`
- Modify: `tools/studio_qt/screens/workbench.py`
- Modify: `tools/studio_qt/widgets/stage_rail.py`
- Test: `tests/test_studio_qt.py`

**Interfaces:**
- `WorkerEventBridge(QObject)` exposes `event_received = Signal(str, dict)`; connected slots update Qt controls on the main thread.
- Legacy path uses `StudioController` for archive selection/import, job switch, `start_pipeline`, `handle_event`, and `cancel`.
- Job@5 path uses `StudioV2Session` for import, workspace open, `run`, `pipeline_rows`, and `cancel`.
- Job@5 running rows with placeholder progress are shown indeterminate; logs/activity remain useful when no percentage is available.
- Use current GUI session/settings paths and shared workspace; no Qt-specific state schema.

- [ ] Add failing tests for legacy archive routing and Job@5 fixture routing.
- [ ] Add a thread test: emit a real Qt signal from a Python worker thread, process the Qt event loop, and assert the stage/activity view updates on its owning thread.
- [ ] Add progress tests asserting no fabricated percentage for Job@5 rows and exact percentage only for measured values.
- [ ] Add cancel/close tests asserting existing safe-stop APIs are called and the window closes only after work ends.
- [ ] Run the focused offscreen suite and verify failures are for missing routes/behavior.
- [ ] Implement event bridge and workflow wiring, including asynchronous imports/runs and stable selection/focus.
- [ ] Run focused offscreen suite; verify both formats, thread delivery, truthful progress, and cancellation pass.

### Task 4: Add contextual settings, validation, and output completion

**Files:**
- Create: `tools/studio_qt/dialogs/__init__.py`
- Create: `tools/studio_qt/dialogs/settings.py`
- Modify: `tools/studio_qt/app.py`
- Modify: `tools/studio_qt/screens/home.py`
- Modify: `tools/studio_qt/screens/workbench.py`
- Modify: `tests/test_studio_qt.py`
- Reference: `tests/test_music_preview.py`, `tests/test_studio_gui.py`

**Interfaces:**
- Settings dialog exposes voice, align model, music, 0–100% volume, and audition; values normalize to `[0.0, 1.0]` and persist in existing GUI settings JSON.
- Package/environment errors appear beside the relevant stage with error code and actionable detail; full diagnostics also reach the activity drawer.
- Completion state shows final file details and open-video/open-folder actions; existing Editor/Remotion actions remain in the job overflow menu.
- Preflight/dependency installation and package-conflict decisions reuse current services/semantics.

- [ ] Add failing tests for settings persistence and 0%, 25%, 100% volume mapping, audition callback, package errors, recent/unfinished jobs, and output actions.
- [ ] Run focused tests and confirm new behavior fails before implementation.
- [ ] Implement settings dialog, contextual error/repair states, recent job opening, output actions, preflight/install, and secondary Editor/Remotion actions.
- [ ] Run the Qt tests plus existing `test_studio_gui.py` and `test_music_preview.py`; Tk tests must remain unmodified and pass or skip only when headless.

### Task 5: Document and validate the parallel rollout

**Files:**
- Modify: `.github/workflows/tests.yml`
- Modify: `README.md`
- Test: `tests/test_studio_qt.py`

**Interfaces:**
- CI installs the optional Qt extra and runs Qt tests using `QT_QPA_PLATFORM=offscreen`.
- Existing Tk launcher check and tests remain.
- README shows `uv run zodiac` and `uv run --extra qt zodiac-qt`; clarify one pipeline at a time per workspace.
- Do not remove existing `zodiac` command, Tk docs/tests, or workflow coverage.

- [ ] Add CI checks for both launchers and the offscreen Qt suite.
- [ ] Update stale README launch descriptions to accurately explain both desktop GUIs.
- [ ] Run focused Qt, existing GUI/audio tests, then `python -m unittest discover -s tests -v`.
- [ ] Confirm `zodiac` still points to `tools.zodiac_gui:main` and `zodiac-qt` resolves from the optional extra.

### Task 6: Unified workspace and in-app Media management

**Files:**
- Create: `tools/studio_qt/screens/media.py`
- Modify: `tools/studio_qt/app.py`, `tools/studio_qt/screens/workbench.py`, `tools/studio_qt/dialogs/settings.py`, `tools/studio_qt/theme.py`, `pyproject.toml`, `uv.lock`, `README.md`
- Test: `tests/test_studio_qt.py`

**Interfaces:**
- The main window exposes exactly two tabs: `Công việc / Workspace` (job selection plus active workbench) and `Media` (active job outputs).
- Workbench output actions navigate to the internal Media tab and select the video or output folder.
- Qt Multimedia plays music audition, audio files, and videos in the app; still images preview in the same workspace.
- Media listing filters non-media files and displays actual file metadata only.

- [x] Add failing tests for the two-tab shell, internal output routing, supported media kinds, and in-app audition.
- [x] Add the optional `PySide6-Addons` dependency and synchronize `uv.lock`.
- [x] Implement the Media workspace, in-app playback, and tab routing without replacing the Tk GUI.
- [x] Run Qt, Tk GUI, and music-preview regression suites; inspect the new and legacy GUI acceptance paths.

### Parallel-rollout acceptance gate

- [ ] Open a legacy package and resume its pipeline from the new Qt Workbench.
- [ ] Open/import a Job@5 package and resume its pipeline from the new Qt Workbench.
- [ ] Open existing jobs sequentially through Tk and Qt; verify state, package, and render artifacts are unchanged by opening.
- [ ] Retain Tk as default until a separate user-approved cutover.
