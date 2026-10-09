# Design System: Zodiac Production Desk — Obsidian

## 1. Information architecture

The app header carries Zodiac Studio identity, the active job, and shared settings. It exposes exactly two top-level workspaces:

- **Công việc / Workspace** combines recent-job selection and the seven-stage production workbench. Opening a job changes the content inside this shared tab; it does not create a separate top-level Workspace tab. Keep the job identity and revision in the page heading, show the aggregate job state once, and do not repeat the package badge or Settings action.
- **Media** groups every Job@5 and local job that has an `out/` folder, then browses the complete contents of the selected job's `out/`. It includes nested folders and non-media outputs such as JSON and text files. Video and audio play in the app; still images preview in the same workspace; other outputs show file metadata. Workbench output actions navigate here and select the corresponding job and file or folder.

## 2. Visual theme

Premium dark desktop workstation for producing Zodiac videos. Disciplined, cinematic, and quiet: tonal layers, warm readable text, precise spacing, and restrained champagne highlights. Density 7/10, asymmetry 5/10, motion 2/10. Calibrated for Windows at 1024×680, 1280×800, and 1366×768.

## 3. Color palette

- Obsidian canvas `#121516` — root window.
- Graphite surface `#1A1F20` — work areas and dialogs.
- Raised slate `#232A2B` — list wells, inputs, hover states.
- Divider `#343D3E` — structural edges.
- Ivory text `#ECE9E1` — primary content.
- Ash text `#A5AEAB` — secondary content.
- Champagne `#C6A76A` — the only brand accent for primary actions, active stage, and focus.
- Semantic states: success `#86B89A`, warning `#D7B36A`, error `#E08A82`; each state also includes a word and glyph.

## 4. Typography

Use Geist when available; fall back to Segoe UI. Use Cascadia Code or Consolas for paths, logs, and identifiers. Preserve Vietnamese diacritics. Body text 10–11pt, secondary text at least 9pt. Use weight and contrast for hierarchy instead of oversized headings.

## 5. Layout and components

- Home has a concise heading, one primary import action, and a legible recent-job list with meaningful state and a visible open action.
- Workbench has a 168–184px seven-stage rail, a dominant process summary (completed, running, failed, and pending stage counts), the selected-stage detail, and persistent Continue / Run All / Stop controls. Keep the job summary, latest activity, and verified output visible without expanding the full log.
- Workbench headings elide long job names while preserving the full name in the accessible name and tooltip. Use one aggregate job-status chip; keep selected-stage status in its own detail area.
- Media uses a focused horizontal split: grouped job picker, searchable full `out/` file tree with flexible filename and compact size/type columns, large embedded preview, and compact play/seek/volume controls. Show actual filename, full path on demand, file size, and media-player duration only; never invent codec, dimensions, dates, or render progress.
- At 1024×680, keep primary actions and Media playback controls reachable. Collapse contextual spacing first; scroll the stage rail only when the optional full log is open.
- Settings labels and actions stay in Vietnamese; truncated file paths retain a full-path tooltip.
- Use an 8px spacing rhythm, 20–24px window gutters, 8px controls, and 10px surfaces. Prefer separators to equal-card grids.
- Buttons have visible hover, pressed, disabled, and keyboard-focus states. Inputs and menus share the dark surface palette.
- Progress shows percentages only when measured. Otherwise show the active stage, an indeterminate indicator, and the latest useful event.
- Music audition uses Qt Multimedia inside the app and stops after 10 seconds; it never launches an external audio player.
- Logs use a selectable, bounded monospace view. Errors remain attached to the failing stage and give a recovery action.

## 6. Motion and accessibility

Use only restrained 120–180ms interaction feedback. Preserve native reduced-motion behavior. Maintain at least 4.5:1 text contrast, visible focus on every control, keyboard navigation in visual order, and text plus glyph for status.

## 7. Anti-patterns

No pure black, neon, purple/cyan glow, gradients, glass, emoji icons, decorative zodiac art, fake percentages or system metrics, color-only status, clipped Vietnamese, or copied Tk panel layout.
