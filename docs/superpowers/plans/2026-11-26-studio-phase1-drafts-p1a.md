# Studio Phase 1 Drafts (P1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Studio hold a Phase 1 draft in the web workspace layout, edit and diff it, approve it on the GUI, export the same handoff ZIP the web makes, and import it through the existing ZIP importer. No agent in P1a.

**Architecture:** A `Phase1Drafts` store (Python, under the projects root) keeps revisioned snapshots of the 5 source files. Node bridge commands `unpack` and `export` reuse `export-phase1-handoff.mjs` and the portable-zip parser. Export output is imported only through `Service.import_capsule`. Frontend adds one screen reachable from Ideas.

**Tech Stack:** Python 3.11 (unittest/pytest), Node 24 `.mjs`, React + TypeScript, Tauri host allowlist.

**Spec:** `docs/superpowers/specs/2026-11-26-studio-phase1-in-app-design.md`

## Global Constraints

- Handoff format is unchanged: `export-phase1-handoff.mjs` is the only ZIP writer; `Service.import_capsule` is the only entry to a project.
- Draft layout is the web layout: `narration.txt`, `.authoring/narrative-plan.json`, `.authoring/episode-scope.json`, `.authoring/phase3-writer-brief.json`, `.authoring/voice-profile.json`, `.authoring/content-review-receipt.json`.
- Approval is GUI-only. Receipt proof: `{kind:"user_message", ref:"studio-gui:<draft_id>:<revision>", text:<confirmation text the user submitted>}`; `format:"zodiac-content-review@2"`, `phase_id:"01-content"`, `status:"APPROVED"`, `source_hashes` for `narration, plan, scope, brief, voice`.
- Saving any file deletes the receipt (approval is bound to one revision).
- A new RPC method must also be added to the allowlist in `apps/zodiac-studio/src-tauri/src/lib.rs` and `ALLOWED` in `tools/studio_project/rpc_stdio.py`.
- Opening a ZIP as a draft never modifies the ZIP. Export never overwrites a file (`flag:'wx'`); each export gets a new path.
- Plain CSS, flat divider look; no nested bordered boxes. Do not click human approval controls from automation.
- Commit and push per task (AGENTS.md).

## Review Focus

- Edit after approval: receipt must vanish and export must refuse until re-approved.
- Opening a ZIP whose narration has CRLF or a trailing-newline difference: unpack then export must not change bytes of untouched files.
- Draft id or path from the UI containing `..` or separators must be rejected.
- Same draft exported twice: second export gets a new file, ZIP imports idempotently (same source hash → same project).
- Empty or whitespace-only narration saved: save succeeds, approve refuses.

---

### Task 1: Bridge commands `unpack` and `export`

**Files:**
- Modify: `tools/studio_project/handoff_bridge.mjs`
- Test: `tests/studio_phase1_bridge.test.mjs`

**Interfaces:**
- Produces: `node handoff_bridge.mjs unpack <zip> <dir>` writes the 5 source files in draft layout (receipt dropped) and prints `{ok:true, files:[rel...], run_id, source_sha256}`. `node handoff_bridge.mjs export <dir> <out.zip>` calls `exportPhase1Handoff` and prints `{ok:true, path, sha256, bytes, run_id}`.

- [ ] **Step 1: Write failing test** `unpack then export keeps untouched bytes`: build a ZIP with `tests/studio_phase1_synthetic_fixture.mjs`, `unpack` into a temp dir, assert the 5 files exist and `content-review-receipt.json` does not; write a receipt by hand with matching hashes, `export`, then parse both ZIPs with `parsePortableZip` and assert `narration.txt`, `narrative-plan.json`, `episode-scope.json`, `writer-brief.json`, `voice-profile.json` bytes are equal.
- [ ] **Step 2:** Run `node --test tests/studio_phase1_bridge.test.mjs`; expect FAIL (usage error).
- [ ] **Step 3: Implement** both commands in `main()`; `unpack` uses `parsePortableZip`, maps payload `writer-brief.json` → `.authoring/phase3-writer-brief.json`, others to `.authoring/<name>`, writes only into `<dir>` after rejecting any rel with `..` or absolute path. `unpack` reuses `inspect` first so a corrupt ZIP fails the same way the importer fails.
- [ ] **Step 4:** Run the test; expect PASS.
- [ ] **Step 5: Commit** `feat(studio): handoff bridge can unpack a ZIP to a draft and export a draft`.

### Task 2: Draft store with revisions and diff

**Files:**
- Create: `tools/studio_project/phase1_drafts.py`
- Test: `tests/test_studio_phase1_drafts.py`

**Interfaces:**
- Produces (class `Phase1Drafts(root: Path)`, root = projects root, data under `root/".phase1-drafts"`):
  - `create(concept_code: str | None, sign: str | None, title: str) -> dict` → draft record `{draft_id, concept_code, sign, title, revision, approved: bool, files: {name: text}}`; seeds minimal valid-shaped files (empty narration, scope with `episode_id`, `concept_code`, `sign`, `title_working`).
  - `open_zip(path: Path) -> dict` via bridge `unpack`; records `source_zip_sha256`.
  - `get(draft_id) -> dict`, `list() -> list[dict]`.
  - `save(draft_id, base_revision: int, files: dict[str, str]) -> dict` → new revision; `STALE_REVISION` StudioError when `base_revision` is not current; deletes receipt; only keys in the 5 source names are accepted; JSON files must parse.
  - `diff(draft_id, from_revision: int, to_revision: int) -> dict` → `{narration: [{kind:"same|add|del|change", old, new}], files: {name: [{path, old, new}]}}`; narration compared by paragraph (split on blank line, else per line) using `difflib.SequenceMatcher`; JSON files compared by flattened key path.
- Draft id: `uuid4().hex`; any id not matching `^[0-9a-f]{32}$` raises `STUDIO_DRAFT_ID_INVALID`.

- [ ] **Step 1: Write failing tests**: `test_create_get_list`, `test_save_makes_new_revision_and_rejects_stale_base`, `test_save_rejects_unknown_file_and_invalid_json`, `test_invalid_draft_id_rejected` (`"../x"`, 31-char hex), `test_diff_narration_paragraph_change_and_plan_key_path`, `test_open_zip_leaves_zip_bytes_unchanged` (fixture ZIP, compare SHA before/after), `test_crlf_narration_roundtrips_byte_exact` (write/read as bytes, assert stored text equals input).
- [ ] **Step 2:** Run `python -m pytest tests/test_studio_phase1_drafts.py -q -p no:cacheprovider`; expect FAIL (module missing).
- [ ] **Step 3: Implement** the class. Each revision is a directory `rev-NNNN/` in the draft folder holding the files in web layout plus `draft.json` at the draft root (`draft_id, concept_code, sign, title, revision, source_zip_sha256?`). Read and write files as bytes decoded `utf-8` with `newline=''` semantics so CRLF survives. Atomic write through temp dir + `os.replace`.
- [ ] **Step 4:** Run tests; expect PASS.
- [ ] **Step 5: Commit** `feat(studio): revisioned Phase 1 draft store with paragraph diff`.

### Task 3: Approve, export, re-import

**Files:**
- Modify: `tools/studio_project/phase1_drafts.py`, `tools/studio_project/service.py`
- Test: `tests/test_studio_phase1_drafts.py`

**Interfaces:**
- Consumes: Task 1 bridge `export`; Task 2 `Phase1Drafts`.
- Produces: `Phase1Drafts.approve(draft_id, revision: int, confirmation: str) -> dict` (refuses when `revision` is not current, narration empty after strip, or `confirmation` strip is empty; writes receipt per Global Constraints using SHA-256 of each file's bytes; `run_id` = scope `episode_id`). `Phase1Drafts.export_zip(draft_id) -> dict` → `{path, sha256, bytes}` into `<draft>/exports/<n>-<sha8>.zip`; refuses with `STUDIO_DRAFT_NOT_APPROVED` when receipt missing or its `source_hashes` differ from current files. `Service.draft_import(draft_id) -> dict` exports then calls `import_capsule` and returns the project snapshot.

- [ ] **Step 1: Write failing tests**: `test_edit_after_approval_blocks_export` (approve, save, expect `STUDIO_DRAFT_NOT_APPROVED`); `test_empty_narration_cannot_be_approved`; `test_approve_export_import_roundtrip` (create from fixture ZIP via `open_zip`, approve with text, `draft_import`, assert a project exists and `narration.txt` in its workspace equals the draft's); `test_exports_never_overwrite_and_reimport_is_idempotent` (import twice → registry `project_count() == 1`); `test_receipt_proof_shape` (kind `user_message`, ref starts `studio-gui:<draft_id>:`).
- [ ] **Step 2:** Run; expect FAIL.
- [ ] **Step 3: Implement** `approve`, `export_zip`; add `Service.draft_import` and a `Service.drafts` attribute created from `self.registry.root`.
- [ ] **Step 4:** Run `python -m pytest tests/test_studio_phase1_drafts.py tests/test_studio_project_import.py -q -p no:cacheprovider`; expect PASS.
- [ ] **Step 5: Commit** `feat(studio): approve, export and re-import a Phase 1 draft through the ZIP importer`.

### Task 4: RPC surface and host allowlist

**Files:**
- Modify: `tools/studio_project/rpc_stdio.py`, `apps/zodiac-studio/src-tauri/src/lib.rs`
- Test: `tests/test_studio_phase1_drafts.py` (RPC dispatch), existing allowlist test if one enumerates methods (`grep -rn "projects.import" tests` to find it)

**Interfaces:**
- Produces methods: `drafts.list {}`, `drafts.get {draft_id}`, `drafts.create {concept_code, sign, title}`, `drafts.open_zip {path}` (`.zip` only), `drafts.save {draft_id, base_revision, files}`, `drafts.diff {draft_id, from_revision, to_revision}`, `drafts.approve {draft_id, revision, confirmation}`, `drafts.import {draft_id}`. Parameters checked with `_exact` like neighbors.

- [ ] **Step 1: Write failing test** dispatching `drafts.create` then `drafts.get` through the same entry the other RPC tests use; and `drafts.open_zip` with a non-zip path → `HANDOFF_SOURCE_INVALID`.
- [ ] **Step 2:** Run; expect FAIL (unknown method).
- [ ] **Step 3: Implement** dispatch, add names to `ALLOWED` and the Rust allowlist.
- [ ] **Step 4:** Run the test and `cargo check --manifest-path apps/zodiac-studio/src-tauri/Cargo.toml` if the Windows SDK is present (otherwise say not run); expect PASS.
- [ ] **Step 5: Commit** `feat(studio): drafts.* RPC methods`.

### Task 5: Frontend screen

**Files:**
- Modify: `apps/zodiac-studio/src/backend.ts`, `apps/zodiac-studio/src/studio-navigation.tsx`, `apps/zodiac-studio/src/App.tsx`, `apps/zodiac-studio/src/Ideas.tsx`, `apps/zodiac-studio/src/style.css`
- Create: `apps/zodiac-studio/src/Phase1Drafts.tsx`
- Test: `tests/studio_phase1_drafts_browser.mjs` (fixture pattern from `tests/studio_settings_browser.mjs`)

**Interfaces:**
- Produces in `backend.ts`: type `Phase1Draft = {draft_id; concept_code: string|null; sign: string|null; title: string; revision: number; approved: boolean; files: Record<string,string>}`, type `DraftDiff`, and `backend.drafts{List,Get,Create,OpenZip,Save,Diff,Approve,Import}` wrapping the RPC names above.
- `View` gains `"drafts"`; tab "Bản nháp Phase 1" under group `ideas`; Ideas concept card gets button "Viết Phase 1" → `draftsCreate(concept.id, sign, title)` then opens that draft.

- [ ] **Step 1: Write failing browser test** with a `request()` fixture: list shows a draft; editing paragraph 2 then Lưu calls `drafts.save` with `base_revision` and shows "Đã đổi" on that paragraph in the diff; Duyệt button stays disabled until the confirmation box is filled; after save the "Đã duyệt" badge disappears; "Nhập vào Studio" is disabled unless approved.
- [ ] **Step 2:** Run with Vite dev server up (see CLAUDE.md browser suites); expect FAIL.
- [ ] **Step 3: Implement** `Phase1Drafts.tsx`: left list of drafts + "Mở ZIP…" (file path input via the same dialog used by import in App.tsx); right pane shows narration as editable paragraphs, the five JSON files as read-only collapsible text (P1a does not edit JSON in UI), revision picker with diff view, approval box (checkbox + free-text confirmation, never auto-filled), buttons Lưu, Duyệt, Nhập vào Studio. Refresh drafts on focus.
- [ ] **Step 4:** `cd apps/zodiac-studio; npx tsc --noEmit; npx vite build`, then the browser test; expect PASS.
- [ ] **Step 5: Commit** `feat(studio): Phase 1 drafts screen with edit, diff, approval and ZIP import`.

### Task 6: Full check and doc note

**Files:** Modify `apps/zodiac-studio/README.md` (one paragraph: drafts, ZIP stays the only entry).

- [ ] **Step 1:** Run `python -m pytest tests/test_studio_phase1_drafts.py tests/test_studio_project_import.py tests/test_studio_v2_zip_import.py -q -p no:cacheprovider` and `node --test tests/studio_phase1_bridge.test.mjs`; expect all pass.
- [ ] **Step 2:** Start the app per CLAUDE.md with an isolated `ZODIAC_STUDIO_PROJECTS`, create a draft from Ideas, edit, approve (a human clicks Duyệt), import; report what was and was not verified.
- [ ] **Step 3: Commit** `docs(studio): note Phase 1 drafts`.

## Out of scope for P1a

Agent steps, concept pinning, JSON editing in the UI (P1b), polishing (P1c).
