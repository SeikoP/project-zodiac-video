# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

`AGENTS.md` at the repo root holds binding rules (concept-library edits, per-task commit and push, human approval gates). Read it first; this file does not repeat it.

## What this repo is

One source tree for the Zodiac video system. Two products live in it:

- `apps/zodiac-studio/` is **Zodiac Studio V5** (Tauri 2 + React + a Python backend). This is the app under active development on `experiment/main-2`.
- `plugins/zodiac-video-pipeline/` is the plugin (skills, compilers, validators, asset library) that Studio's Python core calls into. Phase 1 (web) makes a handoff ZIP; Phase 2-3 (local) are what Studio drives.

Studio V5 is the only GUI. The old PySide6 app was removed; `tools/zodiac_studio.py` (the `zodiac` command) only launches the Tauri executable, and `tools/studio/`, `tools/runner/`, `tools/studio_v2/` keep only the modules Studio Project Core imports (artifact store, voice catalog, process/audio helpers, voice and timing).

## Run the Studio app (Windows)

Prerequisites: Rust MSVC target, VS Build Tools **with the Windows SDK**, WebView2, Python 3.11+, Node 24+, pnpm 11.24.0.

```powershell
cd apps/zodiac-studio
pnpm install --frozen-lockfile
pnpm desktop:dev          # Vite on 127.0.0.1:1420 + Tauri window + Python rpc_stdio child
```

On this machine `.\.runtime\run-main2.cmd` (ignored, machine-local) wraps the same command with the local compiler environment.

- `ZODIAC_STUDIO_PROJECTS` points the app at an isolated project store; `ZODIAC_STUDIO_PYTHON` picks the interpreter; never run as administrator.
- Frontend only (no Rust): `pnpm dev`. Outside Tauri `backend.ts` throws `DESKTOP_ONLY`, so browser tests replace `request()` with a fixture (see `tests/studio_workbench_fixture.mjs`).
- Run a prebuilt debug exe against this checkout: `pwsh apps/zodiac-studio/scripts/launch-preview.ps1 -Executable <exe> -ProjectsRoot <dir> [-CdpPort 9227]`. `CdpPort` exposes the window to `tools/studio_e2e` (real-click GUI e2e; never click human approval controls from automation).
- Release builds, installers and publication need explicit user authorization; `bundle.active` is intentionally false.

## Checks

```powershell
# Python (run from repo root; ~6 min for the whole studio set, pytest or unittest both work)
python -m pytest tests/test_studio_*.py -q -p no:cacheprovider
python -m pytest tests/test_studio_pipeline_review.py -q                 # one file
python -m pytest tests/test_studio_pipeline_review.py::ReviewTests::test_playback_is_single_use -q   # one test

# Node unit tests (one file at a time; some take minutes because they do real builds)
node --test tests/studio_acting.test.mjs

# Types + production bundle (CI runs `pnpm build` = tsc --noEmit && vite build)
cd apps/zodiac-studio; npx tsc --noEmit; npx vite build

# Rust host (needs the Windows SDK)
cargo check --manifest-path apps/zodiac-studio/src-tauri/Cargo.toml
cargo test  --manifest-path apps/zodiac-studio/src-tauri/Cargo.toml

# Browser suites (Playwright-driven, need the Vite dev server on :1420 running)
$env:PLAYWRIGHT_MODULE = '<path>/playwright-core/index.mjs'   # e.g. from the npx cache
$env:STUDIO_BROWSER    = '<path>/ms-playwright/chromium-*/chrome-win64/chrome.exe'
node tests/studio_pipeline_browser.mjs     # also studio_workbench_browser, studio_compact_layout, studio_ideas_browser, ...
```

CI definition: `.github/workflows/studio-v5-tauri-p1.yml`. Tests set `ZODIAC_REVIEW_MIN_SECONDS=0` via `tests/pipeline_fakes.py`; production requires 10 s of viewing before the visual review can be confirmed.

## Architecture (Studio)

**Request path.** React (`apps/zodiac-studio/src/backend.ts`) → Tauri command `studio_request` → Rust host (`src-tauri/src/lib.rs`, strict method allowlist: a new RPC method must be added there too) → one long-lived Python child `python -m tools.studio_project.rpc_stdio` (JSON lines on stdin/stdout) → `tools/studio_project/service.py`, which owns a single SQLite project registry. Frontend reads are coalesced in `rpc-reads.ts`.

**Production pipeline graph** (`tools/studio_project/pipeline/`). `nodes.json` declares the DAG: content gate → voice → voice_review gate → timing → visual → checks → assets/cover/publish → scene fan-out → build → inspect → visual_review gate → export. `derive.py` turns on-disk evidence (`evidence.py`, receipts, voice/visual snapshots) into per-node status (DONE/READY/STALE/AWAITING_USER/...); the UI never stores status. `runner.py` runs steps, `autopilot.py` chains them and stops at human gates, `agent_runs.py` tracks agent failures, `proposals.py` validates agent output, `drafts.py` makes deterministic drafts for steps with no agent. Gates (voice listening, visual review, export approval) can only be completed from the GUI; `review.py` issues a single-use playback proof, and no code path may create an approval for the user.

**Agent authoring.** `agent_authoring.py` / `agent_parts.py` / `agent_bridge.py` drive a model through a skeleton task and then one task per scene (2 in parallel), merge in Core, and re-run only scenes the compiler names. Core owns deterministic fields (scene ids, narration ranges, asset keys); the model supplies intent.

**Visual workspace.** `visual_workspace.py` plus the `visual_*.mjs` modules (compiler, preview, export, acting, transitions, candidates, gallery, themes) build HyperFrames compositions from the Visual Intent and the V4 asset library under `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/asset-library-v4/`. Python talks to them through Node child processes (`handoff_bridge.mjs`, `pipeline/validators_bridge.mjs`). Preview and export use the same deterministic painter; export is HyperFrames CLI capture + FFmpeg mux.

**Voice.** `voice_lab.py` / `voice_worker.py` / `voice_bank.py` generate VieNeu takes, cache them by text and voice hash, assemble them, and measure timing with faster-whisper (batched in `BatchedWordSource`). The approved narration is source-locked; Studio imports a Phase 1 handoff ZIP byte-immutably (`importer.py`).

**Frontend shape.** `App.tsx` + `studio-navigation.tsx` (three sections: Kế hoạch / Episode / Tài nguyên); the Episode section is the pipeline UI in `src/pipeline/` (step list, inspector registry, episode shell). `VisualEditor.tsx`, `VoiceLab.tsx`, `EpisodeExport.tsx`, `VideoReview.tsx` render inside step inspectors. Styling is plain CSS (`style.css`, `pipeline/*.css`) with a flat, divider-based look: avoid nesting bordered or tinted boxes inside other boxes.

**Concept catalog.** `tools/studio_project/idea_catalog.json` is the single source for the Ideas screen and the MP4 review picker; follow `tools/studio_project/AGENTS.md` and validate with `python -m tools.studio_project.ideas`.

## Where to read more

`apps/zodiac-studio/README.md` (run modes, env vars), `docs/superpowers/specs/` and `docs/superpowers/plans/` (design and roadmap), `docs/audits/` (dated evidence; the newest `2026-11-25-*` files describe current gaps), `tools/studio_e2e/README.md`.
