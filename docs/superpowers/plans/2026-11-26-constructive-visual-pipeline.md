# Constructive visual pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "one agent writes the whole Visual Intent, then checks, then loops" with a chain where the model only chooses from menus, Core assembles and places every scene, and each scene is built and looked at as it is made.

**Architecture:** New modules under `tools/studio_project/` build per-scene menus and a JSON Schema (`outputSchema` for Codex), a Core assembler turns the model's few choices into the existing scene-part shape (so `agent_parts.validate_scene`, `merge`, the compiler and export are unchanged), and an `authoring_chain` orchestrates cast → stage → act → build → look with bounded retries and owner cards. The old pipeline nodes stay; the GUI collapses the phase to a progress bar plus a stills strip (approach **A** of the spec). Tasks 1–4 prove the bet on two real scenes; Tasks 5–9 run only if Task 4's gate passes.

**Tech Stack:** Python 3.11 (`tools/studio_project`), Node ESM (`visual_compiler.mjs`), React/TS (`apps/zodiac-studio`), Codex app-server (`turn/start.outputSchema`, `localImage`), pytest + node:test.

**Spec:** `docs/superpowers/specs/2026-11-26-constructive-visual-pipeline-design.md`

## Global Constraints

- Quota policy (`agent_bridge.ROLE_DEFAULTS`): luna chooses and repairs; `gpt-6.1-sol` only for the `vision` role.
- A missing prop/model returns `NEW_VARIANT_MASTER_REQUIRED`; no fabricated SVG (Visual V5 spec).
- Voice listening, visual review and export approval stay owner-only; nothing here approves anything (AGENTS.md).
- At most **2** model re-choices per scene, then an owner card with a default. Scenes run 2 at a time (`PARALLEL_AGENTS`).
- Coordinates are never written by the model; story field is 1080×1400, caption lane starts at y=1470 (`layout_contract.caption_safe_zone`).
- A new RPC method must also be added to the Rust allowlist (`apps/zodiac-studio/src-tauri/src/lib.rs`).
- Python tests: `python -m pytest tests/test_studio_*.py -q -p no:cacheprovider`; node tests one file at a time.
- Commit after each task (AGENTS.md); git author trailer per the session's attribution rule.

## Review Focus

- A scene with no character, or only a story-visual (no Stage choice fits) must still assemble: Task 2 test.
- Voice/timing or catalog changes while the chain runs must discard parts, not mix them: Task 5 test.
- App reset mid-chain must resume from stored parts and lose nothing: Task 5 test.
- A repeated word in a scene: anchors are chosen by id, each mapped to the first unused occurrence: Task 1 test.
- Menus with nothing relevant (all props "none", 0 anchors, 12+ anchors): Task 1/2 tests.

---

### Task 1: Menus and choice schema

**Files:**
- Create: `tools/studio_project/authoring_menus.py`
- Test: `tests/test_studio_authoring_menus.py`

**Interfaces:**
- Consumes: `agent_authoring.prompt_catalog()`, `agent_authoring.catalog()`, `prop_families_manifest()`, capsule dict (`scene_ranges`, `narrative_plan`), skeleton intent (`cast` with `entity_id`, `states`), voice `timing.words`.
- Produces:
  - `scene_menus(capsule: dict, skeleton_intent: dict, scene_id: str, words: list[dict]) -> dict` with keys `frames: list[str]`, `mechanics: list[str]`, `cast: dict[str, list[str]]` (entity → state ids), `props: list[str]` (file ids, no meme labels), `dressing: list[str]` (prop ids + `"none"`), `anchors: list[{"id": "a1", "text": str}]`.
  - `stage_schema(menus: dict) -> dict` and `act_schema(menus: dict) -> dict`: JSON Schemas (objects, `additionalProperties: false`, every id field an `enum` of the menu).
  - Stage choice: `{"frame_id", "mechanic_id", "present": [{"entity_id","state_id"}], "props": [{"prop_id","role": "focus"|"support"}], "dressing"}`. Act choice: `{"events": [{"anchor_id","target","action","state_after"}]}` (`action` is free text ≤ 80 chars, the only free field).

- [ ] **Step 1: Write failing tests** — `test_menus_list_only_real_ids` (every `props` id exists in `agent_authoring._library_props()`; none starts with `meme-label-`; `dressing` ends with `"none"`), `test_anchors_are_unique_phrases_in_scene_order` (words repeating "để xem" yield distinct ids `a1,a2` whose texts are exact substrings of the scene text, mapped to first unused occurrence), `test_schemas_enumerate_menus` (schema `enum`s equal menus; `additionalProperties` false everywhere), `test_empty_and_large_menus` (scene with 0 anchors → `act_schema` still valid with `events` max 0; 14 anchors → `maxItems` ≤ 8).
- [ ] **Step 2:** Run `python -m pytest tests/test_studio_authoring_menus.py -q` → FAIL (module missing).
- [ ] **Step 3: Implement** both functions. Frames/mechanics come from `catalog()`; props from `prop_families_manifest()` (default model first); anchors from `words` inside the scene's `narration_range`, splitting into phrases at punctuation (≥2 words, ≤6).
- [ ] **Step 4:** Run the tests → PASS.
- [ ] **Step 5: Commit** `feat(studio): per-scene menus and choice schemas`.

### Task 2: Core scene assembler

**Files:**
- Create: `tools/studio_project/scene_assembler.py`
- Test: `tests/test_studio_scene_assembler.py`

**Interfaces:**
- Consumes: Task 1 menus and choice shapes; `agent_parts.validate_scene`; `scene_repairs.prune_non_story_references`; plugin `compileProduction` (via `visual_compiler.mjs` action) **or** the `PLACEMENT` table below, whichever Task 3 question 2 selects.
- Produces: `assemble_scene(menus: dict, stage: dict, act: dict, scene_id: str, scene_range: list[int], scene_text: str, goal: str) -> dict` returning `{"kind":"scene.part","payload":{"scene":…,"assets":…}}` accepted by `agent_parts.validate_scene` unchanged. Also `PLACEMENT: dict[str, dict[str, dict]]` = frame id → slot → `{x,y,width,height}`.

- [ ] **Step 1: Write failing tests** — `test_assembled_scene_passes_part_validation_and_compiler` (assembled from fixture choices; `validate_scene` returns without change count > 0; `visual_compiler.mjs validate_authoring` → `VALID`), `test_no_geometry_faults` (`autofix_geometry` returns `changes == []`: nothing off-canvas or in the caption lane), `test_scene_without_characters` (stage with empty `present` and a story-visual asset assembles), `test_dressing_is_added_by_core_and_not_in_story_focus` (a `depth__` entity exists; `experience_profile` never names it), `test_unknown_ids_are_rejected_not_repaired` (prop id outside menus raises `ValueError`).
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3: Implement** `assemble_scene`: entity ids, asset keys `f"{scene_id}-{prop}"`, transforms from `PLACEMENT` (characters ~390×780, props sized by viewBox aspect), `experience_profile.story_mode` from the mechanic family, `story_focus` from `focus` role, `events` from act (trigger text = anchor text, `enter` rules via `scene_repairs`).
- [ ] **Step 4:** Run → PASS. **Step 5: Commit** `feat(studio): core assembles scenes from menu choices`.

### Task 3: Structured output through the bridge, and the spike

**Files:**
- Modify: `tools/studio_project/agent_bridge.py` (`start(..., output_schema=None)`; pass `outputSchema` in `turn/start`; validate with `agent_frame_review`-style hook per kind `scene.choice`)
- Create: `tools/studio_project/authoring_spike.py` (CLI, throwaway but kept as the measuring tool), `docs/audits/2026-11-26-constructive-spike.md` (results)
- Test: `tests/test_studio_choice_bridge.py`

**Interfaces:**
- Consumes: Tasks 1–2; `AgentManager.start`; stored skeleton from the latest failed/finished run (`agent_runs.latest_run`).
- Produces: `AgentManager.start_choice(project_id: str, schema: dict, prompt_data: dict, role: str = "creative") -> dict` (task kind `scene.choice`, `suggestion` = schema-valid JSON text); `python -m tools.studio_project.authoring_spike --project <id> --scenes s01,s02 --runs 3` writing the measurements table.

- [ ] **Step 1: Write failing test** — fake app-server (as in `tests/test_studio_frame_review_bridge.py`): `turn/start` params contain the given `outputSchema`; a reply violating the schema fails the task; a valid reply completes with the same text.
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `start_choice` and the schema check (`jsonschema`-free: recursive check of enum/required/additionalProperties, as the schemas use only those). **Step 4:** PASS.
- [ ] **Step 5: Run the spike (ask the owner first: spends luna calls).** For scenes `s01`,`s02` × 3 runs, record per call: schema-valid (Y/N), assembled scene accepted by `validate_scene` and compiler (Y/N), seconds, retries. Also try `compileProduction` placement on one assembled scene and record whether it yields transforms.
- [ ] **Step 6: Commit** code and the audit doc.

### Task 4: Gate (decision, no code)

- [ ] **Step 1:** Read `docs/audits/2026-11-26-constructive-spike.md`. Proceed to Task 5 only if: schema-valid rate ≥ 90%, both scenes compile with zero model retries, each scene < 60 s, a placement route exists (compileProduction or `PLACEMENT`), and the owner approves the stills. Otherwise adjust menus (Task 1) and repeat Task 3 step 5, or stop and revisit approach B with the owner.
- [ ] **Step 2:** Record the outcome and the chosen placement route at the top of the audit doc; commit.

### Task 5: The chain

**Files:**
- Create: `tools/studio_project/authoring_chain.py`; `tools/studio_project/pipeline/failure_policy.py`
- Test: `tests/test_studio_authoring_chain.py`

**Interfaces:**
- Consumes: Tasks 1–3; `vision.review_current_build`; `agent_parts.merge`; `agent_authoring.proposal`; `agent_runs.track`.
- Produces: `run_chain(service, project_id, *, stopped: Callable[[], bool]) -> ChainResult`; `ChainResult(proposal: dict | None, cards: list[Card], scenes: dict[str, SceneOutcome])`; `SceneOutcome(status: "ok"|"card"|"failed", rechoices: int, still: str | None)`; `Card(scene_id: str, options: tuple[str, ...] = ("accept","restage","redo"), default: str = "accept", reason: str)`; `route(issue: dict) -> "core" | "model" | "owner"` in `failure_policy.py`.

- [ ] **Step 1: Write failing tests** with fake service/agent — `test_chain_authors_cast_then_each_scene_in_order_two_at_a_time`; `test_core_fixable_issue_never_calls_the_model` (`route` returns `"core"` for OUTSIDE_CANVAS, CAPTION_OCCLUSION, missing derived fields); `test_model_rechoices_are_capped_at_two_then_a_card` (default `accept`); `test_missing_story_prop_makes_a_card_not_a_substitute` (dressing missing → closest real prop used and reported); `test_changed_voice_or_catalog_discards_parts` (dependency fingerprint mismatch → parts not reused); `test_app_reset_resumes_from_stored_parts` (second `run_chain` after a simulated restart calls the model only for unfinished scenes).
- [ ] **Step 2:** Run → FAIL. **Step 3: Implement** `run_chain` (cast schema from `catalog()["components"]` grouped by `catalog_v5` groups; parts persisted in the task as `part_texts`, reusing `_reusable_parts` identity rules; scene loop stage → act → assemble → compile one scene via `visual.start(project_id, revision, scene_id)` → look; after the last scene the existing drafted steps run unchanged: transitions, cover, publish, episode build). **Step 4:** PASS. **Step 5: Commit** `feat(studio): constructive authoring chain with bounded rechoices`.

### Task 6: Owner cards and advisory checks

**Files:**
- Modify: `tools/studio_project/pipeline/derive.py` (checks no longer block: warnings carried as `notes`), `tools/studio_project/rpc_stdio.py` (+ method `pipeline.card.resolve`), `apps/zodiac-studio/src-tauri/src/lib.rs` (allowlist), `tools/studio_project/pipeline/cards.py` (create)
- Test: `tests/test_studio_pipeline_cards.py`, `tests/test_studio_pipeline_derive.py`

**Interfaces:**
- Consumes: `Card` from Task 5.
- Produces: `cards.list_cards(workspace) -> list[Card]`, `cards.resolve(workspace, scene_id: str, choice: str) -> None` (records the owner's choice as a receipt; never a gate approval), RPC `pipeline.card.resolve {project_id, scene_id, choice}`.

- [ ] **Step 1: Write failing tests** — a `checks` report with only quality issues leaves `checks` DONE with notes and the pipeline continues; a structural failure ("cannot build") still blocks that scene; `resolve` with an unknown choice raises; the Rust allowlist test lists the new method.
- [ ] **Step 2:** Run → FAIL. **Step 3–4:** Implement, run pytest and `cargo test --manifest-path apps/zodiac-studio/src-tauri/Cargo.toml` → PASS. **Step 5: Commit.**

### Task 7: Wire the chain into the node and autopilot

**Files:**
- Modify: `tools/studio_project/pipeline/runner.py` (`_author`), `tools/studio_project/pipeline/autopilot.py` (`default_agent` for `visual`)
- Test: `tests/test_studio_pipeline_chain_wiring.py`

**Interfaces:**
- Consumes: `run_chain`, `agent_runs.pending_proposal`.
- Produces: env switch `ZODIAC_STUDIO_CHAIN` (`on` default after the gate, `off` keeps the old single-blob path); the `visual` node result is the same proposal item shape as today.

- [ ] **Step 1: Write failing tests** — with the switch on, `Chạy` starts the chain, not `start_authoring_scenes`; with it off the old path runs; a finished unapplied proposal is still applied rather than re-authored (existing behavior).
- [ ] **Step 2:** Run → FAIL. **Step 3–4:** Implement and pass. **Step 5: Commit.**

### Task 8: Compact GUI

**Files:**
- Create: `apps/zodiac-studio/src/pipeline/StillsStrip.tsx`
- Modify: `apps/zodiac-studio/src/pipeline/StepList.tsx`, `apps/zodiac-studio/src/pipeline/status.ts` (phase summary), `apps/zodiac-studio/src/pipeline/pipeline.css`, `apps/zodiac-studio/src/backend.ts` (cards RPC)
- Test: `tests/studio_pipeline_layout.test.mjs`, browser check via `tests/studio_pipeline_browser.mjs`

**Interfaces:**
- Consumes: graph nodes + `cards` from `pipeline.get`; scene stills from the build previews.
- Produces: phase "3 · Hình ảnh" renders one progress bar, one primary button (Chạy / Chạy lại), a stills strip (click enlarges), owner cards inline, and the old rows under a collapsed "Chi tiết".

- [ ] **Step 1: Write failing node test** — for a fixture graph the phase renders ≤ 1 button plus the strip, the 9 old rows exist only inside a `<details>`, a card renders its three options with the default marked.
- [ ] **Step 2:** `node --test tests/studio_pipeline_layout.test.mjs` → FAIL. **Step 3–4:** Implement; run `npx tsc --noEmit`, the node test, and the browser suite → PASS. **Step 5: Commit.**

### Task 9: Dead-weight cleanup and full run

**Files:**
- Modify: `tools/studio_project/pipeline/nodes.json` notes only (`checks`/`assets` marked advisory), remove `agent_parts` free-text fields the chain no longer asks for (list in the PR)
- Test: whole suites

- [ ] **Step 1:** `python -m pytest tests/test_studio_*.py -q -p no:cacheprovider` and every node test named in this plan → all pass.
- [ ] **Step 2: End-to-end on the real episode** (owner present): one click from Giọng ✓ to the visual-review gate; record time, model calls by role (luna/sol), cards raised, in `docs/audits/2026-11-26-constructive-run.md`.
- [ ] **Step 3: Commit** `docs(studio): constructive pipeline end-to-end evidence`.
