# Zodiac Studio V5 — Phase 1 Tauri pilot

This is an **experimental one-window Tauri 2 + React host**, separate from production `zodiac` (PySide6). It is based on the verified Phase 0 Python Project Core and existing Node/Remotion runtime, not a backend rewrite.

## Run on Windows

Prerequisites: Rust (MSVC target), Visual Studio Build Tools including **Windows SDK** (`kernel32.lib`), WebView2, Python 3.11+, Node 22+. See the [official Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

```powershell
cd apps/zodiac-studio
npm ci
npm run desktop:dev
```

The Rust host starts **one** Python `tools.studio_project.rpc_stdio` child process automatically from the repo checkout. It uses stdin/stdout JSON lines, a strict RPC allowlist and a single P0 SQLite Registry. Project files are kept under the Tauri application data directory, unless `ZODIAC_STUDIO_PROJECTS` explicitly points to an isolated project root. `ZODIAC_STUDIO_PYTHON` may optionally point to a trusted interpreter. **Never run the desktop host with an elevated administrator account.**

This is **source-tree development mode**, not a standalone distributable build. Packaging Python/VieNeu/FFmpeg/Node and source provenance belongs to a later release gate. The Tauri configuration currently has `bundle.active=false` intentionally.

## Available in this pilot

- Import a genuine approved Phase 1 v2 ZIP, source-byte immutable, using the canonical Node verifier wrapped by Python.
- List, reopen and inspect projects and their derived content/voice/visual/video/published evidence statuses.
- Submit revision-checked, idempotent `project.note` metadata events; show the **100 newest events** after restart. The `events.list` API supports cursor pagination for complete replay.
- Filter real V4 prop asset IDs with their source catalog revision and SHA-256. **No actual preview thumbnails or semantic ranking in P1.**
- One Tauri window; legacy Qt `zodiac` remains untouched as fallback.

**Not implemented:** Codex App Server task/session bridge, embedded HyperFrames editing, Voice Lab/audio audition, preview/render, automatic review approval or package publication. These are not clickable fake workflows.

The Rust host whitelist and Python P0 command validation both reject arbitrary shell commands, creative approval commands and out-of-scope edits. The frontend's file picker is used to choose a ZIP, with the underlying importer rechecking proof and exact hashes.

## Validation

```powershell
python -m unittest discover -s tests -p 'test_studio_p1_*.py' -q
python -m unittest discover -s tests -p 'test_studio_project_*.py' -q
cd apps/zodiac-studio
npm run build
cd src-tauri
cargo check --locked
cargo test --locked
```

GitHub Actions `studio-v5-tauri-p1.yml` runs the Windows native build with the Windows SDK, because the initial local machine has MSVC Build Tools but **does not currently have the SDK libraries**, so local `cargo check` failed specifically at `kernel32.lib`. This is an environment blocker, not a test PASS.

## Architectural ownership

- **Tauri/Rust:** process lifecycle, native window, method whitelist, single request transport. No narration/approval mutation.
- **React/TypeScript:** presentation, safe project actions, asset ID filter and event timeline.
- **Python P0/P1:** SQLite state, project/handoff import, source/approval/receipt verification, revisioned metadata.
- **Existing Node.js and Remotion:** future visual compilation and rendering. Not launched by P1.

P1 is not considered accepted until a native Windows app launches, real project import and restart work in the desktop window, agent bridge/cancellation are verified and startup/idle RAM are measured against Qt. Passing only frontend and Python tests does not satisfy that gate.
