# Studio Ideas Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Select a concept, copy an agent prompt and persist MP4-approved progress for twelve signs.

**Architecture:** Global board backed by the existing SQLite registry and exact RPC transport. React view reuses the shell and Paged component.

**Tech Stack:** React/TypeScript, Tauri/Rust, Python sqlite3, JSON catalog.

**Spec:** ../specs/2026-11-18-studio-ideas.md

## Global Constraints

- Main2 only; no dependencies, production changes or release build.
- Completion is manual user confirmation of an approved MP4, never copy success.
- One-frame layout with pagination; all 12 signs remain reachable.

## Review Focus

- Invalid RPC identifiers and extra parameters must not write progress.
- Existing databases must open and preserve their projects.
- Restart and independent cell updates must preserve progress.
- Clipboard denial must leave a readable prompt and honest error.
- All-complete concepts must not generate a duplicate-production prompt.

## Tasks

- [x] Add failing `tests/test_studio_ideas.py` for catalog, durable independent progress,
  invalid values, reset and exact RPC boundary. Run with pytest and observe failure.
- [x] Add `tools/studio_project/idea_catalog.json` and `ideas.py`; extend registry
  schema, service, Python dispatch and Rust whitelist for `ideas.list` and `ideas.update`.
  Re-run new and existing RPC/registry tests.
- [x] Add failing prompt tests in `tests/studio_ideas_prompt.test.mjs`; implement
  `apps/zodiac-studio/src/idea-board.ts`, typed backend API and `Ideas.tsx`.
- [x] Add the view to `App.tsx`, style the bounded board in `style.css`; add browser
  checks for copy, clipboard denial, no automatic completion, paging, all-complete,
  status persistence and three viewport sizes in `tests/studio_ideas_browser.mjs`.
- [x] Run Python, prompt, browser, TypeScript and desktop host checks; review diff
  for caller/whitelist coverage. Record evidence and remaining limitations here.

## Execution notes

User's instruction to implement authorizes execution of the displayed design.
Use existing main2 worktree, clean at start. No deployment or packaging.

User revision: use a simple list -> detail flow and a separate MP4 review tab;
remove the twelve status dropdowns. Only the review checkbox writes completion.
Add stable JSON catalog instructions for future concept additions and read the
catalog again on requests/focus. New entries require no native/frontend rebuild.

Verification: 31 Python tests and 31 subtests passed across Ideas, RPC, registry,
host-contract and project-service suites; two prompt tests passed. TypeScript
and Rust `cargo check --locked` passed. Browser checks passed library/detail,
focus refresh with additions, real generated MP4 decode/playback, explicit
approval, failed save, corrupted/audio-only MP4 rejection, clipboard fallback,
persistence, all-complete behavior and compact/expanded menus at 1366x768,
1060x650 and 1093x614. Existing six-view layout regression also passed.

Independent review identified audio-only MP4 containers enabling approval. A
browser regression reproduced the failure before positive video dimensions and
finite duration checks fixed it. Native dev launch passed using the current
Tauri host and an isolated test project store: real clipboard copy, local MP4
decode/playback, explicit test-only approval through Python/SQLite, and Ideas
readback. No real episode approvals were modified. The test window was closed.

Machine-local helper `.runtime/run-main2.cmd` reuses the existing scoped Windows
SDK environment in `.runtime/studio_native.py`; both are ignored local files.
Portable source command remains `pnpm desktop:dev` in `apps/zodiac-studio` from a
Windows developer shell. No release or installer build and no push performed.
