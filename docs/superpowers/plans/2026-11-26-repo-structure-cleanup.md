# Repo structure cleanup plan (Studio V5 era)

Status: PLAN ONLY. Nothing here is executed by the PR that carries it. Each phase is its own PR, with a "no behaviour change" rule:
moves and deletions only, tests green before and after, one concern per PR.

## Why

Snapshot of `experiment/main-2` on 2026-11-26 (tracked files unless stated):

| Area | Files | Problem |
|---|---|---|
| `tools/studio_project/` | 74, flat | Python, `.mjs` and `.json` mixed; the biggest files are 900 lines (`visual_workspace.py`, `voice_lab.py`, `agent_bridge.py`) |
| `tests/` | 209, flat | `test_studio_*.py`, `studio_*.mjs` and browser suites share one directory; fixtures sit beside tests |
| `tools/` | 5 competing UIs/runtimes | `studio_qt`, `studio`, `studio_v2`, `runner`, `livestream-pk` (340 files, an unrelated product) next to `studio_project` |
| `docs/` | 20+ sub-folders | `audits`, `reviews`, `evidence`, `previews`, `backups`, `historical`, `branch-hygiene` overlap in purpose |
| `tmp/` | 153 MB, untracked | machine-local scratch that appears in `git status` of every session |
| Branches | 20+ local, several stale worktrees | `experiment/studio-v5-p*`, `sync/*`, `backup/*`, `.claude/worktrees/*` |

The cause is the same everywhere: a new concern is added next to whatever is nearest, and nothing says where it belongs.

## Rules (the part that prevents regrowth)

1. **One home per concern.** Each product owns one top-level directory and nothing else may implement it:
   `apps/zodiac-studio` (UI + Tauri host), `tools/studio_project` (Studio Core, Python), `plugins/zodiac-video-pipeline` (pipeline skills, compilers, asset library),
   `tools/livestream-pk` (separate product, see phase 5), `docs/` (see phase 4), `tests/` (see phase 2).
2. **A file's directory says what it is.** In `tools/studio_project/`: `pipeline/` (DAG, gates, autopilot), `authoring/` (agent, chain, menus, assembler, motion),
   `visual/` (workspace, compiler `.mjs`, preview, export, themes), `voice/` (lab, worker, bank), `audio/` (mix, settings), `data/` (catalog and registry `.json`).
3. **Size budget.** A source file over 600 lines needs a split in the next PR that touches it; a directory over 25 files needs sub-folders.
4. **Machine-local output never enters the tree.** `tmp/`, `.runtime/`, exports, backups and baselines live outside the repo or are git-ignored; reports commit the hash and the command, not the media (already in `AGENTS.md`).
5. **Every move is mechanical.** `git mv` only, imports fixed in the same commit, no edits to logic. Review is "does the diff contain only renames and import lines".
6. **Guard in CI.** A small `tests/test_repo_layout.py` fails when: a new top-level directory appears, a file exceeds the budget, `tmp/` or a media file is tracked, or a test file is added outside its folder. The rules above become checks, not memory.

## Phases (each = one PR, in order)

**0. Land the experiment.** Merge `experiment/main-2` into `main` with a merge commit (no fast-forward). Nothing is moved in this PR.

**1. Hygiene, zero risk.** Add `tmp/` to `.gitignore`. Delete stale local branches and worktrees after confirming each is merged or has an owner (`git branch --merged main`; list the rest in the PR for a decision, never `-D` blindly).
Move `docs/backups`, `docs/historical`, `docs/branch-hygiene` into `docs/archive/`.

**2. Tests by area.** `tests/studio/{python,node,browser}/`, `tests/fixtures/` stays. Keep the commands in `CLAUDE.md` in sync (they name test files).
Rule: a test lives next to the area it tests; shared helpers (`pipeline_fakes.py`, `studio_workbench_fixture.mjs`) go to `tests/support/`.

**3. Split Studio Core.** Introduce the sub-packages from rule 2 in this order, one PR each, smallest first:
`audio/` (settings, audio_mix) → `data/` → `voice/` → `authoring/` → `visual/`. Then split the three 900-line files along their natural seams
(`visual_workspace`: snapshot / commands / build / export; `voice_lab`: takes / assemble / measure; `agent_bridge`: tasks / apply / transport).
The RPC allowlist (`rpc_stdio.py` and `src-tauri/src/lib.rs`) is the public surface: it must not change in these PRs.

**4. Docs by purpose.** `docs/superpowers/{specs,plans}` (design intent), `docs/audits` (dated evidence, read-only), `docs/archive`.
Fold `reviews`, `evidence`, `previews`, `zodiac-simplification-preview` into those; add `docs/README.md` with one line per folder.

**5. Legacy and unrelated products.** Decide per directory, with the owner: `tools/studio_qt`, `tools/studio`, `tools/studio_v2`, `tools/runner` (legacy PySide6; keep, freeze, or remove after Studio V5 covers it);
`tools/livestream-pk` (move to its own repository or `apps/`). Nothing is deleted without a green Studio test run and an explicit yes.

**6. Guard.** Add `tests/test_repo_layout.py` (rule 6) and a short "where does this go" table to `CLAUDE.md`.

## Done means

`git status` is clean after a normal session; each rule has a failing-test counterpart; a new contributor can name the directory for a given change without searching.
