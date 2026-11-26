# Zodiac Studio V5 — HyperFrames build, editor and MP4 review export

This is an **experimental one-window Tauri 2 + React host**, the only Zodiac GUI (the old PySide6 app was removed). It uses the verified Python Project Core and shared V4/V5 compiler. Fresh review exports use pinned HyperFrames; existing Remotion packages retain their legacy rendering path.

## Run on Windows

Prerequisites: Rust (MSVC target), Visual Studio Build Tools including **Windows SDK** (`kernel32.lib`), WebView2, Python 3.11+, Node 24+ and pnpm 11.24.0 (pinned in `packageManager`). Run native development from a Visual Studio developer shell so `link.exe` and SDK libraries are available. See the [official Tauri Windows prerequisites](https://v2.tauri.app/start/prerequisites/#windows).

```powershell
cd apps/zodiac-studio
pnpm install --frozen-lockfile
pnpm desktop:dev
```

The app uses `pnpm-lock.yaml` only; root/legacy npm projects are unchanged. The local pnpm workspace permits esbuild's required install script and exempts only ten exact versions already present in the previous npm lock from the one-day release-age delay; future versions keep the default checks.

On this Windows workspace, a machine-local ignored helper reuses the existing
scoped SDK without installing or changing system tools. From the main2 root:

```powershell
.\.runtime\run-main2.cmd
```

This is equivalent to `pnpm desktop:dev` with the local compiler/SDK environment.
The helper files live under `.runtime/` and are not included in a fresh clone.

### CI-built Windows debug preview (no local Windows SDK required)

The GitHub Actions Windows job uploads a **debug-only** `zodiac-studio-p1-windows-debug` ZIP containing the executable, not a distributable installation. Download/unzip the artifact from the latest successful `Zodiac Studio V5 P1 Windows host` run, then launch it from the repo checkout:

```powershell
.\apps\zodiac-studio\scripts\launch-preview.ps1 -Executable "C:\path\to\zodiac-studio-v5.exe"
```

The script sets `ZODIAC_STUDIO_SOURCE_ROOT` to the **current repository**, and uses the locally installed Python interpreter. The compiler's GitHub runner source path is never treated as a valid runtime project directory. The preview remains **developer-only**: no embedded Python runtime, Node, V4 asset bundle, renderer or release installer has been shipped.

The Rust host starts **one** Python `tools.studio_project.rpc_stdio` child process automatically from the repo checkout. It uses stdin/stdout JSON lines, a strict RPC allowlist and a single P0 SQLite Registry. Project files are kept under the Tauri application data directory, unless `ZODIAC_STUDIO_PROJECTS` explicitly points to an isolated project root. `ZODIAC_STUDIO_PYTHON` may optionally point to a trusted interpreter. **Never run the desktop host with an elevated administrator account.**

This is **source-tree development mode**, not a standalone distributable build. Packaging Python/VieNeu/FFmpeg/Node and source provenance belongs to a later release gate. The Tauri configuration currently has `bundle.active=false` intentionally.

## Available in this pilot

- **Ý tưởng & tiến độ:** a searchable, paged concept list across love,
  breakup/healing and everyday comedy. Select a concept to copy the Vietnamese
  agent prompt and open its read-only twelve-sign progress. Copying never updates
  completion. Prompt preview supports full manual Ctrl+C if clipboard is blocked.
  Before sending the copied prompt in ChatGPT, select **@Zodiac-Video-Web** in
  the chat composer. Clipboard text cannot attach a plugin automatically. The
  prompt explicitly requires its current `zodiac-video-web:zodiac-video-web`
  skill/references, six creative microphases, editorial gates and source-bound
  Content Review/handoff. If unavailable, the agent must request the plugin
  rather than improvise a generic workflow. Copying grants no approval.
- **Xem & duyệt MP4:** open a local MP4, choose its concept/sign, watch it and tick
  approval yourself. Loading or playing a video never approves it. File/Blob
  playback stays local; the selected file is not uploaded or copied into the
  project store. Pick the file again after reopening the tab. Checklist progress
  persists in SQLite; it does not grant pipeline approvals.
- To add concepts, edit `tools/studio_project/idea_catalog.json` following its
  adjacent `AGENTS.md`, then run `python -m tools.studio_project.ideas` from the
  repository root. Stable IDs preserve progress. Both tabs read additions when
  reopened/focused; Ideas also has **Làm mới**. No rebuild for catalog-only edits.
- The Ideas RPC methods require the current development Rust host; older debug
  executables reject them. Restart with `pnpm desktop:dev` from this checkout in
  the configured Windows developer shell, rather than reusing an older binary.
- Import a genuine approved Phase 1 v2 ZIP, source-byte immutable, using the canonical Node verifier wrapped by Python.
- List, reopen and inspect projects and their derived content/voice/visual/video/published evidence statuses.
- Submit revision-checked, idempotent `project.note` metadata events; show the **100 newest events** after restart. The `events.list` API supports cursor pagination for complete replay.
- Filter real V4 prop asset IDs with their source catalog revision and SHA-256. **No actual preview thumbnails or semantic ranking in P1.**
- Native Codex App Server inspection with streamed output, durable task receipts, cancel/retry, and an explicit user-confirmed `project.note`. Stale project revisions require a fresh inspection. The model cannot grant creative approvals.
- Pinned HyperFrames SDK 0.9.45 with scene selection, semantic transform editing, measured voice timeline and actual generated SVG preview in the same window.
- **HyperFrames MP4:** in Visual Workspace, build the current episode, then
  **Xuất MP4 → Xem MP4 đã xuất**. HyperFrames CLI 0.9.63 captures the same
  deterministic acting/caption painter as preview at 1080×1920 and the authored
  fps; FFmpeg muxes the selected verified Voice Lab assembly. Copy the output
  path to open/share the file. The export has real progress, cancellation,
  retry and an immutable receipt; a failure preserves the last healthy MP4.
  New exports also keep `captions.srt` beside the MP4, with approved Vietnamese
  words grouped by the same six-word painter and measured global timestamps,
  plus `cover.png` extracted from the actual encoded video. Both have source
  hashes in the export receipt; the cover is a review candidate.
  Rebuild old previews once to produce export-bound source hashes. Review export
  does not grant voice/visual approval or complete the concept checklist.
- One Tauri window with an integrated draggable titlebar, project/connection context and minimize/maximize/close controls.
- Opt-in `zodiac --v5-preview` launches an existing native executable from `ZODIAC_STUDIO_V5_EXE`; it does not compile or install a release.

Voice Lab now splits approved narration into semantic speech units with exact UTF-8 ranges. Generate missing audio, retry one unit, select an immutable take, edit intentional pauses, assemble the episode and measure ASR word anchors. Waveforms and playback use actual WAV bytes. Pronunciation changes only the TTS input. `NORMAL`/`SHARP` records intent; it does not certify audible prosody.

The voice dropdown reads the existing VieNeu saved presets from `VIENEU_HOME/user_voices_v3_turbo.json` (default `~/.vieneu/`). New projects prefer the user's saved voice; the catalog refreshes while Voice Lab is open. Existing takes remain unchanged when a different voice is chosen for the next generation.

Listen to each selected take and the full assembly before explicitly accepting them. Technical validity and measured timing never grant listening approval. Retakes preserve other units; selecting changed audio invalidates its assembly/timing without invalidating SVG assets. Alignment reuses the existing per-unit timing cache.

TTS reports completed units as WAVs are saved. If a batch fails, valid completed
takes remain selected and the job reports `REVIEW`; retry generates only missing
units. Truncated or silent partial WAVs are excluded. Cancellation retains
candidate files without selecting work that finished after cancellation.

Visual Workspace accepts canonical Visual Intent JSON after voice assembly/alignment. Build the episode, select a scene/entity/state, move or resize it, choose a constrained prop candidate, switch light/dark, or undo/redo. Each change commits a revision; stale commands are rejected. Agent proposals use the same scoped commands and require explicit application. Missing exact voice anchors or missing assets block the build and preserve the last verified preview. The private preview server serves only generated, hash-verified compositions; SDK HTML is never the authoring source.

`episode.build` and `scene.compile` share the V4 compiler, dependency graph and verified content cache. Geometry, scene placement and appearance have separate keys. `assets.find_candidates` reports fit/rejection reasons and `NO_FIT_ASSET` instead of inventing art. Inspect cache miss reasons, required/satisfied/blocked nodes, resource use, source hashes and technical QA in the build receipt. Add art through the existing V4 catalog/compiler ownership; do not edit generated SVG/HTML. Validator/compiler/font/catalog changes invalidate their dependent cache entries.

The real SDK uses compiler-owned GSAP compositions on a private loopback origin rather than HyperFrames Studio's server-dependent Player wrapper. Old V4 SVG/state compatibility is tested separately; unsupported historical motion is labeled `LEGACY_STATE_ENDPOINTS_ONLY` and cannot silently enter fresh MP4 export. Current MP4 output is a technical review export. Licensed BGM/SFX mixing, final creative/listening acceptance, packaging and publication remain separate work. `EXPORTED`, `STALE` and genuine human approval are distinct statuses; changing timing/rebuilding at the same visual revision still makes an old export stale.

The agent uses the existing Codex login in an isolated temporary home without loading user plugins, MCP servers or hooks. On Windows the bridge owns the native `codex.exe` PID rather than the npm launcher, so cancellation targets the actual server. An unusual installation can set `ZODIAC_STUDIO_CODEX_BIN` to that native executable. Missing Codex or login reports an unavailable/failed task while manual Studio remains usable. Closing the host's stdio transport cancels and joins its managed worker before exit; forced OS termination remains a separate recovery case.

The Rust host whitelist and Python P0 command validation both reject arbitrary shell commands, creative approval commands and out-of-scope edits. The frontend's file picker is used to choose a ZIP, with the underlying importer rechecking proof and exact hashes.

## Validation

The P5 pilot adds a real paged V4/V5 gallery and three phone model masters, five
registered themes (including two compatibility themes), and revisioned
`scene.performance` editing under **Sự kiện → Chỉnh nhịp diễn theo lời kể**.
Gallery palette auditions change its background/caption; the asset preview keeps
source colors. Episode theme commands resolve explicitly tagged SVG roles during
compilation. Phone markings retain screen contrast on dark themes. Human palette,
phone and acting acceptance remains pending; see [P5 evidence](../../docs/audits/2026-11-18-studio-p5-progress.md).

The gallery's **Ngữ cảnh** inspector now shows exact-source asset use in other
registered episodes, with scene IDs and manifest/build provenance. Both gallery
and candidate queries verify actual current source, committed manifest and
preview/SVG bytes; corrupt, stale or unsafe evidence is excluded. These are
**technical builds, not reviewed videos** and do not lower candidate rankings.
The read-only projection scans up to 500 project IDs and returns the 50 latest
valid builds within that set; partial coverage is visible. No new approval or
database is created. Restart the dev app to load the updated Python backend.
See [usage evidence](../../docs/audits/2026-11-19-studio-p5-usage-progress.md).

```powershell
python -m unittest discover -s tests -p 'test_studio_p1_*.py' -q
python -m unittest discover -s tests -p 'test_studio_p2_*.py' -q
python -m unittest discover -s tests -p 'test_studio_project_*.py' -q
python -m unittest discover -s tests -p 'test_studio_p34_*.py' -q
node --test tests/studio_p34_visual.test.mjs
python -m unittest discover -s tests -p 'test_studio_p5_*.py' -q
node --test tests/studio_p5_assets.test.mjs
python -m unittest tests.test_studio_hyperframes_export -q
node --test tests/studio_hyperframes_export.test.mjs
cd apps/zodiac-studio
pnpm exec tsc --noEmit
cd src-tauri
cargo check --locked
cargo test --locked
```

GitHub Actions `studio-v5-tauri-p1.yml` uses the pinned pnpm lockfile and runs the Windows native checks with the Windows SDK. On this workstation, the missing SDK was supplied locally from Microsoft's `Microsoft.Windows.SDK.CPP` / `.x64` NuGet packages, version 10.0.28000.2957, under ignored `.runtime/windows-sdk/`; no administrator install or system environment changes were needed. `.runtime/studio_native.py` supplies the scoped MSVC/SDK environment for `cargo check`, `cargo test` and `cargo run` against `src-tauri/Cargo.toml`.

Native checking, Rust tests, window/titlebar controls and agent lifecycle were exercised on Windows. See [Windows acceptance evidence](../../docs/audits/2026-11-15-studio-v5-p1-windows-acceptance.md) for exact scope and measured resources. Local `.runtime/start-studio.py` and `.runtime/Zodiac Studio V5.lnk` reopen the existing debug executable with its dev server and normal preview project store. These machine-local helpers are not a standalone release or checked-in SDK distribution.

## Architectural ownership

The current dev workflow has three primary navigation groups: **Kế hoạch**
(Ý tưởng / Tiến độ), **Episode** (Tổng quan / Giọng đọc / Hình ảnh / Xuất & duyệt)
and **Tài nguyên**. Agent and Nhật ký belong to the selected episode. Switching
sub-tabs retains selections and proposals, pauses hidden media and stops hidden
workspace polling; slow reads cannot enqueue overlapping refreshes.

Import the approved Phase 1 ZIP once, generate/select/assemble real voice and
measure timing in Giọng đọc. In Hình ảnh, **Soạn bản dựng ban đầu** asks the real
managed agent for a bounded visual proposal; inspect it, then explicitly apply
it before building previews. Existing sources are edited scene by scene. Changed
voice/timing or visual revision invalidates dependent proposals. Model output is
validated through the canonical compiler and never grants quality approval.

Use **Xuất & duyệt** for export progress and the actual episode MP4. A separately
opened local MP4 can be closed with **Dùng MP4 của episode** to return to the
current export. Playback/export success is not human listening or visual approval.

For real GUI acceptance, `tests/studio_workflow_native.mjs` connects to the dev
app's WebView2 CDP endpoint (`STUDIO_CDP`, default port 9227). It requires an
actual imported approved episode with real selected WAVs and measured timing;
it drives visible controls only and never clicks quality-approval controls.
Set `PLAYWRIGHT_MODULE` to an existing Playwright `index.mjs`; evidence is written
to `STUDIO_E2E_OUTPUT` (default `.runtime/workflow-agent-e2e/`). GUI fixtures in
the other browser tests establish layout/interaction behavior only.

Each completed task must update its evidence, commit and push to the working
branch, per [AGENTS.md](../../AGENTS.md). Keep local media/credentials/runtime
stores out of Git; report the pushed commit and any remaining human gates.

- **Tauri/Rust:** process lifecycle, native window, method whitelist, single request transport. No narration/approval mutation.
- **React/TypeScript:** presentation, semantic inspector, SDK selection/edit bridge, timeline and bounded agent proposals.
- **Python P0/P1:** SQLite state, project/handoff import, source/approval/receipt verification, revisioned metadata.
- **Existing Node.js:** shared V4 visual compilation, semantic dependency graph,
  cache and generated HyperFrames preview/export. Remotion remains supported for
  old packages. Source-bound export evidence and current limits are recorded in
  [the production-path receipt](../../docs/audits/2026-11-19-studio-hyperframes-production.md).

P1 and P2 were integrated into `experiment/main-2` through PRs #223 and #224. Combined P3/P4 implementation, review fixes, benchmark scope and outstanding human acceptance are recorded in [the phase receipt](../../docs/audits/2026-11-15-studio-p34-acceptance.md).
