# Studio titlebar and loading refinement — 2026-11-24

User scope: remove sidebar, place navigation in titlebar, consolidate Episode tools, replace cards with line surfaces, investigate slow GUI loading.

## Changes

- Titlebar holds main navigation, Episode tools, project selector, next action and connection status. Removed sidebar and obsolete layout rules.
- Voice, visual and export/review share the Episode manager and retain mounted state after first use. Heavy tools mount only when first opened. The initial view is Overview.
- Project list renders without awaiting the separate health response. Tauri serializes Python RPC through a mutex; this removes health from the list display dependency. This is source-level evidence, not a measured cold-start latency claim.
- VisualEditor loads HyperFrames SDK only when a preview is available. Removed the studio UI package import used solely for a logo.
- Hidden Voice Lab no longer fetches both selected-unit and episode WAVs. Only the visible audio tab mounts its player. Hidden visual editor stops preparing previews.
- Flat dividers, square controls and transparent surfaces replace rounded card treatment. Short-window Agent inspector spacing now fits.

## Verification

- `pnpm.cmd -C apps/zodiac-studio build`: PASS (TypeScript + Vite).
- `node tests/studio_compact_layout.mjs`: PASS at 1366x768, 1060x650, 1093x614; navigation, pagination, voice tabs, inspector, source editing and hidden Voice Lab polling.
- `node tests/studio_workbench_browser.mjs`: PASS; scene/object persistence, timeline, preview playback, voice/visual/review transitions and initial authoring readiness through fixture transport.
- `node tests/studio_ideas_browser.mjs`: PASS; titlebar navigation, dynamic catalog refresh, MP4 decoding/playback, failed save and invalid media guards, persistence at three window sizes.
- `git diff --check`: PASS.
- Browser: installed Edge 158, installed Playwright from local npm cache; Vite on 127.0.0.1:1420. Browser tests use fixture backend and do not approve production media.
- Visual inspection: temporary screenshot `studio-compact-1093.png` confirms flat editor and titlebar arrangement. Screenshots are local runtime artifacts, not committed.
- Bundle before SDK split: HyperframesWorkspace 1172.13 kB / 319.34 kB gzip. After: tool 34.49 kB / 11.24 kB gzip; deferred SDK 1055.12 kB / 287.99 kB gzip. Initial app entry 267.95 kB / 82.99 kB gzip. SDK remains large when a real preview needs it.

## Boundaries

Native Tauri cold-start timings and a fresh production episode E2E were not measured. Human voice/visual/video approval remains pending. Vite reports the existing recast browser externalization and large deferred SDK warnings.

Existing Ideas mode/progress changes are a required dependency of App's existing `mode` prop; preserve them in the handoff. Unrelated workflow and migration audit changes remain outside this task.

During verification, workspace commit `15f1d6bb` appeared containing the GUI changes plus other existing workspace work. It was preserved without rewriting; this follow-up commits only the remaining Ideas navigation test and this evidence/roadmap update.
