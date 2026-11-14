# Zodiac Studio V5 — Phase 1 Tauri pilot

This is an **experimental one-window Tauri 2 + React host**, separate from production `zodiac` (PySide6). It is based on the verified Phase 0 Python Project Core and existing Node/Remotion runtime, not a backend rewrite.

## Run on Windows

Prerequisites: Rust (MSVC target), Visual Studio Build Tools including **Windows SDK** (`kernel32.lib`), WebView2, Python 3.11+, Node 24+ and pnpm 11.24.0 (pinned in `packageManager`). Run native development from a Visual Studio developer shell so `link.exe` and SDK libraries are available. See the [official Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

```powershell
cd apps/zodiac-studio
pnpm install --frozen-lockfile
pnpm desktop:dev
```

The app uses `pnpm-lock.yaml` only; root/legacy npm projects are unchanged. The local pnpm workspace permits esbuild's required install script and exempts only ten exact versions already present in the previous npm lock from the one-day release-age delay; future versions keep the default checks.

### CI-built Windows debug preview (no local Windows SDK required)

The GitHub Actions Windows job uploads a **debug-only** `zodiac-studio-p1-windows-debug` ZIP containing the executable, not a distributable installation. Download/unzip the artifact from the latest successful `Zodiac Studio V5 P1 Windows host` run, then launch it from the repo checkout:

```powershell
.\apps\zodiac-studio\scripts\launch-preview.ps1 -Executable "C:\path\to\zodiac-studio-v5.exe"
```

The script sets `ZODIAC_STUDIO_SOURCE_ROOT` to the **current repository**, and uses the locally installed Python interpreter. The compiler's GitHub runner source path is never treated as a valid runtime project directory. The preview remains **developer-only**: no embedded Python runtime, Node, V4 asset bundle, renderer or release installer has been shipped.

The Rust host starts **one** Python `tools.studio_project.rpc_stdio` child process automatically from the repo checkout. It uses stdin/stdout JSON lines, a strict RPC allowlist and a single P0 SQLite Registry. Project files are kept under the Tauri application data directory, unless `ZODIAC_STUDIO_PROJECTS` explicitly points to an isolated project root. `ZODIAC_STUDIO_PYTHON` may optionally point to a trusted interpreter. **Never run the desktop host with an elevated administrator account.**

This is **source-tree development mode**, not a standalone distributable build. Packaging Python/VieNeu/FFmpeg/Node and source provenance belongs to a later release gate. The Tauri configuration currently has `bundle.active=false` intentionally.

## Available in this pilot

- Import a genuine approved Phase 1 v2 ZIP, source-byte immutable, using the canonical Node verifier wrapped by Python.
- List, reopen and inspect projects and their derived content/voice/visual/video/published evidence statuses.
- Submit revision-checked, idempotent `project.note` metadata events; show the **100 newest events** after restart. The `events.list` API supports cursor pagination for complete replay.
- Filter real V4 prop asset IDs with their source catalog revision and SHA-256. **No actual preview thumbnails or semantic ranking in P1.**
- Native Codex App Server inspection with streamed output, durable task receipts, cancel/retry, and an explicit user-confirmed `project.note`. Stale project revisions require a fresh inspection. The model cannot grant creative approvals.
- Pinned HyperFrames Studio/SDK 0.9.45; lazy-loaded read-only workspace skeleton. This is not an embedded scene editor or verified preview.
- One Tauri window with an integrated draggable titlebar, project/connection context and minimize/maximize/close controls. Legacy Qt remains the default fallback.
- Opt-in `zodiac --v5-preview` launches an existing native executable from `ZODIAC_STUDIO_V5_EXE`; it does not compile or install a release.

**Not implemented:** embedded HyperFrames editing, Voice Lab/audio audition, preview/render or package publication. Creative approval always requires genuine human review.

The agent uses the existing Codex login in an isolated temporary home without loading user plugins, MCP servers or hooks. On Windows the bridge owns the native `codex.exe` PID rather than the npm launcher, so cancellation targets the actual server. An unusual installation can set `ZODIAC_STUDIO_CODEX_BIN` to that native executable. Missing Codex or login reports an unavailable/failed task while manual Studio remains usable. Closing the host's stdio transport cancels and joins its managed worker before exit; forced OS termination remains a separate recovery case.

The Rust host whitelist and Python P0 command validation both reject arbitrary shell commands, creative approval commands and out-of-scope edits. The frontend's file picker is used to choose a ZIP, with the underlying importer rechecking proof and exact hashes.

## Validation

```powershell
python -m unittest discover -s tests -p 'test_studio_p1_*.py' -q
python -m unittest discover -s tests -p 'test_studio_project_*.py' -q
cd apps/zodiac-studio
pnpm exec tsc --noEmit
cd src-tauri
cargo check --locked
cargo test --locked
```

GitHub Actions `studio-v5-tauri-p1.yml` uses the pinned pnpm lockfile and runs the Windows native checks with the Windows SDK. On this workstation, the missing SDK was supplied locally from Microsoft's `Microsoft.Windows.SDK.CPP` / `.x64` NuGet packages, version 10.0.28000.2957, under ignored `.runtime/windows-sdk/`; no administrator install or system environment changes were needed. `.runtime/studio_native.py` supplies the scoped MSVC/SDK environment for `cargo check`, `cargo test` and `cargo run` against `src-tauri/Cargo.toml`.

Native checking, Rust tests, window/titlebar controls and agent lifecycle were exercised on Windows. See [Windows acceptance evidence](../../docs/audits/2026-11-15-studio-v5-p1-windows-acceptance.md) for exact scope and measured resources. Local `.runtime/start-studio.py` and `.runtime/Zodiac Studio V5.lnk` reopen the existing debug executable with its dev server and normal preview project store. These machine-local helpers are not a standalone release or checked-in SDK distribution.

## Architectural ownership

- **Tauri/Rust:** process lifecycle, native window, method whitelist, single request transport. No narration/approval mutation.
- **React/TypeScript:** presentation, safe project actions, asset ID filter and event timeline.
- **Python P0/P1:** SQLite state, project/handoff import, source/approval/receipt verification, revisioned metadata.
- **Existing Node.js and Remotion:** future visual compilation and rendering. Not launched by P1.

The native P1 technical workflow is now tested with an isolated synthetic source fixture: import/reopen, notes/revisions, reconnect, agent cancellation/retry/confirmation, shutdown and titlebar controls. This does not create genuine content/voice/visual approval. P1 remains `TESTED` pending review and experimental integration; the three existing GitHub Draft PRs have not been merged by this continuation. HyperFrames scene editing remains P4.
