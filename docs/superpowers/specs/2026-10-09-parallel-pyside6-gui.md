# Parallel PySide6 Task Workbench Design

> Current launch contract: `zodiac` opens PySide6. The standalone Tk Studio and the Qt menu action that opened the Tk Editor have been removed. This supersedes the earlier launcher and Editor mapping below.

## Goal

Add a new PySide6 desktop GUI alongside the working Tkinter GUI. Give production work a clearer, faster task-centered flow; do not reproduce the old GUI's panel layout, visual theme, or widget structure.

## User and workflow

The app is a local operator workstation for one Zodiac video job at a time. The operator imports or reopens a job, sees what is ready or blocked, runs/resumes a stage, monitors real activity, and opens the final video. The existing GUI is a feature reference only; its arrangement is not a design input.

## Screen model

### Shared Công việc / Workspace tab

This is one top-level area with an internal switch between job selection and the active workbench. With no active job, show the primary `Nhập gói video` action and a compact list of recent or unfinished jobs. Do not show disabled pipeline controls or empty panels.

### Active job: Task Workbench

- Header: job name/revision, package validity, environment readiness, and a small `…` menu for secondary actions.
- Stage rail: `Package → Voice → Timing → Plan → Render → Audio → Output`; show state with text/icon and shape, not color alone. Selecting a stage reveals its status, relevant artifact/output, and allowed rerun action.
- Main area: one focused current-stage workspace with a plain-language state, a truthful progress indicator, the latest useful event, and any next action or repair guidance. Do not show a percentage unless the backend provides a measured percentage.
- Secondary detail: show only the selected stage's relevant metadata, validation, or artifact path. Avoid a permanent settings column or a card for every backend subsystem.
- Footer: one context-sensitive primary action (`Tiếp tục` or `Chạy toàn bộ`) and `Dừng` only while work is active. Keep focus and selection stable after actions.
- Activity: compact recent-event strip by default, expandable log drawer for full output; errors keep code, stage, and actionable detail together.
- Settings: an on-demand dialog opened from the job header; voice, alignment model, music, 0–100% volume and `Nghe thử` live together. Preserve values through the existing session/settings paths.
- Completion: output actions navigate to the separate Media tab and select the requested video or folder.

### Media tab

- Keep media management separate from job selection and pipeline controls.
- Show the active job's output folder, media-only file tree (video, audio, still images), large in-app preview, playback/seek/volume controls, selected name and full path.
- Play video and audio inside the app; preview still images in the same view. Do not open the system player for these actions.
- Display only actual file size, path, and duration reported by the player. Do not invent codec, frame-rate, dates, or progress.
- Keep directory browsing and file filtering in this tab; output actions from Workbench navigate here.

## Visual and interaction direction

- Premium Obsidian desktop palette: `#121516` canvas, `#1A1F20` surface, `#232A2B` raised surfaces, `#ECE9E1` primary text, `#A5AEAB` secondary text, and restrained champagne `#C6A76A` active/primary accent. Semantic success, warning, and error remain separately labeled.
- Use system UI font for controls, monospace only for paths/log details, a consistent 8px spacing rhythm, restrained motion, native Qt controls, and visible keyboard focus.
- Preserve keyboard operation, named controls, visible labels, sensible tab order, and disabled/loading states. Never rely on hue as the only status cue.
- No emoji icons, decorative animations, QML, or mirrored Tk panels.

## Architecture and boundaries

- Keep `zodiac` mapped to the existing Tk GUI. Add a separate `zodiac-qt` launcher and place all new UI code in `tools/studio_qt/`.
- Use PySide6 Qt Widgets and a Qt signal bridge for worker events. Qt widgets are updated only on the UI thread.
- Reuse existing controllers, sessions, workers, package checks, renderer/audio services, and persisted state. Do not import Tk widgets or `tools.studio.views` into the Qt frontend.
- Keep PySide6 optional under the `qt` extra. Use Essentials for Qt Widgets and Addons for Qt Multimedia playback. The Qt frontend requires Python 3.10+; the current Tk path retains the repository's Python 3.9 floor.
- The GUI builds/releases run against one shared workspace sequentially; do not run pipelines simultaneously from both frontends.
- Do not migrate state, change package formats, replace the default launcher, or remove the Tk GUI in this rollout.

## Required behavior

Support legacy and Job@5 import/reopen, recent/unfinished job discovery, preflight and dependency-install feedback, continue/run-all/rerun, safe stop/close, settings restore, truthful progress and useful live logs, output/folder opening, and the existing Editor/Remotion actions.

## Acceptance

- `zodiac` still launches the current Tk GUI without the Qt extra.
- `zodiac-qt` launches independently and gives a clear error if the Qt extra/Python version is unavailable.
- The new Qt GUI has a distinct Task Workbench layout and does not reuse old view classes, panel composition, or theme tokens.
- Qt offscreen tests cover no-job and active-job layouts, both package generations, settings, worker events, progress truthfulness, cancellation, and outputs.
- Qt offscreen checks verify exactly two top-level tabs, in-app output routing, supported media classification, and music audition through `QMediaPlayer`.
- Existing Tk GUI/music tests remain unchanged and pass where a display is available.
- Merely opening a workspace does not alter job/package/render files; both frontends reuse current state formats.
- README documents both launchers and the one-pipeline-per-workspace operating rule.
