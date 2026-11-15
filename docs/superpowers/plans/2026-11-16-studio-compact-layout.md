# Compact Studio implementation plan

User approved the one-frame layout proposed in conversation on 2026-11-16.

Goal: fit Studio into one viewport, preserve every action, replace long lists with pages.
Architecture: existing React/Tauri shell and backend contracts; no new dependencies.

- [x] Compact shell and collapsible navigation; bounded flex/grid layout and fitting preview.
- [x] Shared pagination and paged text; apply to projects, assets, activity, scenes, candidates and logs.
- [x] Inspector tabs and source/log workspaces; Voice Lab tabs for takes, assembly and settings.
- [x] Build and browser checks at 1366x768, 1060x650 and scaled equivalent; verify late-page access and unchanged backend actions.

Scope: App.tsx, VisualEditor.tsx, VoiceLab.tsx, style.css, small shared pagination UI, browser regression check. No backend, phase gates, approved sources or build/package changes.

Validation: TypeScript/Vite build passed. Browser fixtures passed all six views, inspector/voice/source/log tabs, populated JSON pages, composition results, timing pages and completed build receipt at 1366x768, 1060x650 and 1093x614. No document scroll or controls outside viewport. Independent review findings fixed: multiline source pagination and explicit whole-source replacement. Audio pauses when switching Voice Lab tabs or opening source/log workspace.

Not verified: native WebView2/DPI, actual preview playback, production audio/content or MP4. Browser checks use isolated synthetic backend fixtures and send no production commands. No installer/package produced.
