# Voice approval that sticks, scene revision, page-turn transitions, GUI polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop re-listening to voice that was already approved, make the visual agent edit the scenes it made instead of rewriting them, add paper/page-turn scene transitions, and tidy the Studio GUI.

**Architecture:** Voice approval becomes per-segment proof (what you heard stays approved when only one unit changes) and timing is recomposed from cached per-unit words instead of re-running ASR. Scene changes go through a small operation list (`ops`) that Core applies to the existing scene, so ids, states and assets stay stable. Transitions are a new Studio-only registry (`visual_transitions.mjs`) painted by the same code in the preview and the MP4 export.

**Tech Stack:** Python 3.11 (`tools/studio_project`), Node ESM (`*.mjs` painters/compiler), React 19 + TypeScript (`apps/zodiac-studio`), HyperFrames/GSAP painters, pytest, `node --test`, Chrome DevTools Protocol against the real Tauri window.

**Spec:** `docs/superpowers/specs/2026-11-25-limited-2d-cutout-style.md` (approved style) and `docs/audits/2026-11-25-nhanma-gui-e2e-findings.md` (what the real GUI run showed). Transitions extend the style spec; Task 7 appends a "Transitions" section to it.

## Global Constraints

- Human gates stay user-owned: no code path may create `user_listened`, a visual-review approval or an export approval. Tests assert this for every new function.
- Never rename existing IDs or edit approval stores by hand; new fields are additive (`format` strings versioned, e.g. `zodiac-voice-segment-proof@1`).
- Visible text is Vietnamese; agent-facing prompts are English; code identifiers English.
- `pipeline.get` must stay under 0.6 s warm on the Nhân Mã project (32 units, 8 scenes); no task may add a per-poll hash of media.
- TTS output is not deterministic: never assume re-synthesis reproduces a WAV.
- Scene change style the user wants: the page turns (book/paper page-turn) AND the incoming scene's components fly in from outside the screen. Studio has no off-screen entrance today (`slide` is capped at 360 px and `quality()` flags `OUTSIDE_CANVAS`), so this is a new motion `enter`, not a reuse. Both effects are pure functions of the frame number.
- Every task is verified in the real app through the GUI (CDP clicks), not by calling backend RPCs from a script. Reuse `tools/studio_e2e` from Task 10.
- Commit per task with scoped staging (`git add <paths>`); never blanket-stage: the worktree has unrelated dirty files. Push to `experiment/main-2` after the task's checks pass.

## Review Focus

- Pause edit only (`gap_after_ms` changed, same take): must not force re-listening the whole episode or re-running ASR.
- A single unit retaken in a 32-unit episode: only that unit (plus its two seams) needs listening.
- Same episode re-imported or voice regenerated: approved takes with identical text, voice and generation profile are reused, not re-synthesised.
- Agent asked to fix one scene: other scenes' bytes are unchanged, and the fixed scene keeps entity/state/asset ids unless an op names them.
- Components flying in from outside the screen: the off-canvas start must not raise `OUTSIDE_CANVAS`, the resting pose must stay inside the canvas and clear of the caption lane, and the entrance must finish before the first voice anchor of that scene (else the beat is shown half-built).
- Scene with transition at its boundary and measured words ending right at the cut: captions never turn with the page and no word is hidden.
- Transition on the first/last scene, or between two scenes with zero hold time: clamped, never negative frames.
- Reduced-motion / export frame stepping: the transition is a pure function of frame number (no wall-clock), so preview and MP4 match.

---

### Task 1: Prove the voice-dependency guard the Codex review asked for

The review found that stale voice/timing could enter visual authoring. `docs/superpowers/plans/2026-11-25-studio-workflow-hardening.md` and commit `cbe808a0` already carry `voice_dependencies` through `default_agent` and `proposals.apply_proposal`. This task only pins it with a regression test so it cannot silently regress.

**Files:**
- Test: `tests/test_studio_pipeline_autopilot.py`

**Interfaces:**
- Consumes: `proposals.submit_proposal(..., voice_dependencies: str | None)`, `visual.command(..., voice_dependencies=...)`.
- Produces: nothing new.

- [ ] **Step 1: Add `test_stale_voice_fingerprint_blocks_agent_application`**: build a service whose `voice.snapshot` changes between capsule creation and apply (reassemble); assert the proposal returns `applied False` with an issue code `VOICE_DEPENDENCY_STALE` (use the code the existing guard raises; read `visual_workspace.py:216-220`) and that `visual.snapshot()["revision"]` is unchanged.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_autopilot.py -q -k stale_voice` → expected PASS (guard exists). If it FAILS, the Codex finding is real: carry `item["voice_dependencies"]` from `default_agent` into `submit_proposal` (see `autopilot.py:126,392`) and rerun.
- [ ] **Step 3: Commit** `git add tests/test_studio_pipeline_autopilot.py` → `test(studio): pin voice dependency guard on agent apply`.

---

### Task 2: Say why approval was lost, and pin which edits may lose it

Today `select()` with an unchanged take but a changed pause sets `listened=None` and `_invalidate()` clears `assembly`, `timing` and `playbacks`; a retake clears the same. The GUI never says which. Start by making it visible and testable.

**Files:**
- Modify: `tools/studio_project/voice_lab.py` (`select`, `_invalidate`, `assemble`, snapshot)
- Create: `tests/test_studio_voice_approval_matrix.py`
- Modify: `apps/zodiac-studio/src/pipeline/inspectors/VoiceInspector.tsx` (show the reason)

**Interfaces:**
- Produces: `state["approval_note"]: {"reason": "take_changed"|"pause_changed"|"narration_changed"|"voice_changed", "unit_ids": list[str], "at": float}` set by `_invalidate`, cleared when a new episode listen is confirmed. Snapshot exposes it as `approval_note`.

- [ ] **Step 1: Write the matrix test.** Operations that must KEEP `status == "USER_LISTENED_APPROVED"`: assemble twice; run ASR again; backend restart (new `VoiceLab` on same workspace); export/build. Operations that must DROP it and set the matching `approval_note.reason`: select another take; change a pause by 50 ms; narration hash change. Names: `test_keep_after_reassemble`, `test_keep_after_realign`, `test_keep_after_restart`, `test_drop_reason_take_changed`, `test_drop_reason_pause_changed`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_voice_approval_matrix.py -q` → expected: keep-tests PASS, drop-tests FAIL on the missing `approval_note`.
- [ ] **Step 3: Implement** `_invalidate(state, unit_ids, reason)` writing `approval_note`; thread the reason from `select` (take vs pause) and from the generate path.
- [ ] **Step 4: GUI:** in `VoiceInspector.tsx` show "Cần nghe lại vì: <reason in Vietnamese> (đoạn 07)" above the listen button when `approval_note` exists. Map reasons to Vietnamese in one `const REASON_TEXT` record.
- [ ] **Step 5: Verify in the real app:** change one pause, observe the note, confirm no ASR re-run is triggered yet (Task 3 fixes that). Run `python -m pytest tests/test_studio_voice_approval_matrix.py tests/test_studio_p2_voice_lab.py -q` → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 6: Commit** `git add tools/studio_project/voice_lab.py tests/test_studio_voice_approval_matrix.py apps/zodiac-studio/src/pipeline/inspectors/VoiceInspector.tsx` → `feat(voice): say why listening approval was dropped`.

---

### Task 3: Segment proofs — re-listen only what changed

Listening to the whole assembled episode is the approval (commit `99f72001`). Keep that, but record what it covered, so a later change needs only the changed part.

**Files:**
- Modify: `tools/studio_project/voice_lab.py` (`confirm_listened` near line 655, `voice_evidence` near line 147, `assemble`)
- Create: `tests/test_studio_voice_segments.py`

**Interfaces:**
- Produces: `assembly["listened"]["segments"]: list[{"unit_id": str, "wav_sha256": str, "gap_after_ms": int}]` (format `zodiac-voice-segment-proof@1`), written when an episode listen is confirmed. `voice_evidence()` returns `"USER_LISTENED_APPROVED"` when every segment of the current selection has a matching proof, even if the assembly hash differs.
- Produces: `VoiceLab.segments_needing_listen(project_id) -> list[str]` (unit ids whose take or pause has no proof).
- Produces: `VoiceLab.confirm_segment(project_id, unit_id, playback_id, base_revision)`: confirms one unit's playback through the end (same 95% rule as the episode) and records its proof.

- [ ] **Step 1: Tests:** `test_episode_listen_records_a_proof_for_every_segment`; `test_pause_change_needs_only_that_unit`; `test_retake_needs_only_that_unit_and_listening_it_restores_approval`; `test_unit_listen_alone_never_approves_other_units`; `test_no_function_creates_proof_without_a_completed_playback` (calls with an unfinished playback token → `VOICE_PLAYBACK_INCOMPLETE`).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_voice_segments.py -q` → FAIL (functions missing).
- [ ] **Step 3: Implement** proofs on episode confirm; `voice_evidence` accepts segment-complete selections (compare `(unit_id, wav_sha256, gap_after_ms)` sets); `segments_needing_listen` returns the diff; `confirm_segment` mirrors `confirm_listened` for one unit.
- [ ] **Step 4: Keep the seam rule:** a changed unit also requires its neighbours' boundary: listening a segment plays unit-1 tail (1 s) + unit + unit+1 head (1 s) client-side; the backend only checks the unit's own playback token. Document this in the docstring.
- [ ] **Step 5: GUI:** replace the single "Tôi đã nghe hết" button with "Nghe lại 1 đoạn đã đổi" (when `segments_needing_listen` is non-empty) and the full-episode button otherwise. File: `VoiceLab.tsx` + `VoiceInspector.tsx`; add `backend.voiceConfirmSegment`.
- [ ] **Step 6: Verify:** pytest for the two voice test files plus `tests/test_studio_p1_rpc.py` PASS; in the real app change one pause, listen only that segment, confirm the graph shows "Nghe và duyệt giọng · Xong" without a full listen.
- [ ] **Step 7: Commit** scoped paths → `feat(voice): approve by segment so one edit needs one listen`.

---

### Task 4: Recompose timing without ASR and reuse approved takes

`_invalidate` sets `timing=None`, so any pause edit re-runs ASR (33–70 s). Per-unit local words are already cached per WAV; offsets are just durations plus pauses.

**Files:**
- Create: `tools/studio_project/voice_bank.py`
- Modify: `tools/studio_project/voice_lab.py` (`_invalidate`, generate path, `_run` align branch)
- Test: `tests/test_studio_voice_bank.py`

**Interfaces:**
- Produces: `recompose_timing(state: dict, local_words: dict[str, list[dict]], durations_ms: dict[str, float]) -> dict` returning the `zodiac-speech-time-map@2` object (same shape as the align branch builds), pure function.
- Produces: `class VoiceBank(root: Path)` with `lookup(text_hash: str, voice_profile_hash: str, generation_profile_hash: str) -> dict | None` and `remember(take: dict, wav: Path, listened_by_user: bool) -> None`, stored under `<projects root>/voice-bank/<text_hash>/<profile hash>/` as WAV + `index.json` (content-addressed, never edited in place).
- Consumes: `VoiceArtifactStore.register_candidate/register_approved` (`tools/studio/artifacts.py`).

- [ ] **Step 1: Tests:** `test_recompose_matches_a_full_align_for_unchanged_units`; `test_pause_change_keeps_timing_ready_without_asr` (assert the align worker is not spawned: patch `run_managed_subprocess`); `test_bank_reuses_identical_take_for_same_text_voice_profile`; `test_bank_never_reuses_across_voice_profile`; `test_bank_take_carries_no_listening_proof_by_itself` (reuse supplies audio only; approval still comes from segment proofs of this episode).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_voice_bank.py -q` → FAIL.
- [ ] **Step 3: Implement** `recompose_timing`; call it from `select()` instead of clearing timing when every changed unit already has cached local words; clear only if a unit has none.
- [ ] **Step 4: Implement** `VoiceBank` and consult it in the generate branch before calling `run_tts_batch` for each unit (reuse = copy WAV into the job folder, register as candidate, `origin: "bank"`). Show "Dùng lại giọng đã có: 20/32" in the job message (Vietnamese mapping in `VoiceLab.tsx` `JOB_MESSAGES`).
- [ ] **Step 5: Verify in the real app:** re-import the same zip into a fresh store: voice step reports reuse and finishes in seconds; listening still required once, then Task 3 keeps it. `python -m pytest tests/test_studio_voice_bank.py tests/test_studio_p2_voice_lab.py -q` PASS.
- [ ] **Step 6: Commit** → `feat(voice): recompose timing and reuse approved takes across projects`.

---

### Task 5: Scene revision by operations (backend)

The agent currently rewrites a whole scene, so ids, states and props drift. Revisions become small ops applied by Core.

**Files:**
- Create: `tools/studio_project/scene_ops.py`
- Modify: `tools/studio_project/agent_parts.py` (`revise_task`, `revise_prompt`, `validate_ops`)
- Modify: `tools/studio_project/agent_bridge.py` (`start_scene_revision`, part kind `"revise"`)
- Test: `tests/test_studio_scene_ops.py`

**Interfaces:**
- Produces: `apply_scene_ops(scene: dict, ops: list[dict]) -> dict` — pure, returns a new scene; op shapes: `{"op":"set","path":"entities/<id>/states/<state>/transform/x","value":number}`, `{"op":"add","path":"entities","value":{...entity}}`, `{"op":"add","path":"events","value":{...event}}`, `{"op":"remove","path":"entities/<id>"|"events/<id>"}`, `{"op":"set","path":"grammar","value":{...}}`. Paths address entities, states and events by id, never by index. Unknown id → `ValueError`.
- Produces: `scene_changes(old: dict, new: dict) -> list[str]` (Vietnamese one-liners such as "Nhân vật gemini: x 40 → 120", used by the GUI diff).
- Produces: `AgentManager.start_scene_revision(project_id: str, scene_id: str, instruction: str) -> dict` (task kind `"scene.revise"`, suggestion JSON `{"kind":"scene.ops","payload":{"scene_id","ops":[...]}}`).
- Consumes: `agent_parts.scene_task` data, `agent_bridge` part-task machinery (Task from the scene-by-scene work).

- [ ] **Step 1: Tests:** `test_set_changes_only_the_named_field`; `test_remove_entity_drops_its_events_only_when_op_says_so` (removing an entity referenced by an event → `ValueError` naming the event); `test_ops_leave_every_other_scene_byte_identical` (apply to a merged intent and compare other scenes' JSON); `test_scene_changes_lists_human_readable_diff`; `test_revision_prompt_forbids_rewriting_and_includes_current_scene`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_scene_ops.py -q` → FAIL.
- [ ] **Step 3: Implement** `scene_ops.py`; `revise_prompt` states: "Return ONLY ops that change what the instruction asks; keep every id; do not resend the scene". `validate_ops` rejects ops touching ids absent from the scene and rewrites that remove > 30% of entities without an explicit instruction word ("xóa", "bỏ").
- [ ] **Step 4: Implement** `start_scene_revision` building a one-part task (`part: "revise"`) with the current scene and `story_visual_assets`; result goes through `apply_scene_ops`, then `agent_authoring.proposal()` on the whole intent with that scene replaced; failures name the scene.
- [ ] **Step 5: Run** `python -m pytest tests/test_studio_scene_ops.py tests/test_studio_agent_parts.py tests/test_studio_p1_agent.py -q` → PASS.
- [ ] **Step 6: Commit** → `feat(agent): revise a scene with ops instead of rewriting it`.

---

### Task 6: Scene revision in the GUI and in autopilot repair

**Files:**
- Modify: `tools/studio_project/rpc_stdio.py` (`agent.scene.revise`), `tools/studio_project/pipeline/autopilot.py` (`default_agent` repair path)
- Modify: `apps/zodiac-studio/src/VisualEditor.tsx` (Agent tab), `apps/zodiac-studio/src/AgentProposal.tsx`, `apps/zodiac-studio/src/backend.ts`
- Test: `tests/test_studio_pipeline_autopilot.py`, `tests/studio_workbench_browser.mjs`

**Interfaces:**
- Consumes: `AgentManager.start_scene_revision`, `scene_ops.scene_changes`.
- Produces: RPC `agent.scene.revise {project_id, scene_id, instruction}`; `AgentTask.changes?: string[]` filled when the task completes (`scene_changes` output).

- [ ] **Step 1: Autopilot test** `test_repair_revises_only_scenes_named_by_the_validator` using stub agent: assert only s03 and s08 receive revise tasks and other scenes' JSON is byte-identical after apply.
- [ ] **Step 2: Implement** the repair path: group `checks` issues by `scene_id`, one revise per scene (`PARALLEL_AGENTS` at a time), merge ops, submit one `source.replace`. Fall back to the old whole-scene regeneration only when ops fail validation twice.
- [ ] **Step 3: GUI:** in the scene inspector's Agent tab add "Sửa cảnh này" (instruction box + button). `AgentProposal` renders `changes` as a checklist ("Nhân vật gemini: x 40 → 120") above "Áp dụng". Apply is a single undoable `source.replace`.
- [ ] **Step 4: Verify in the real app:** open scene 3, instruction "cho Nhân Mã lớn hơn", confirm only that scene changes (timeline thumbnails of others unchanged), Undo restores.
- [ ] **Step 5: Run** `python -m pytest tests/test_studio_pipeline_autopilot.py tests/test_studio_scene_ops.py -q` PASS; `npx tsc --noEmit` clean; `node --test tests/studio_pipeline_layout.test.mjs` PASS.
- [ ] **Step 6: Commit** → `feat(studio): revise one scene from the GUI and during repair`.

---

### Task 7: Scene transition registry and painters (preview + export)

Scenes currently hard-cut. Add a deterministic transition between scene i and i+1.

**Files:**
- Create: `tools/studio_project/visual_transitions.mjs`, `tools/studio_project/transitions.json` (registry), `tests/studio_transitions.test.mjs`
- Modify: `tools/studio_project/visual_compiler.mjs` (validate + default), `tools/studio_project/visual_preview.mjs`, `tools/studio_project/visual_export.mjs`, `docs/superpowers/specs/2026-11-25-limited-2d-cutout-style.md` (append "Transitions")

**Interfaces:**
- Produces: `transitions.json`: `{"format":"zodiac-studio-transitions@1","presets":{"cut":{"max_frames":0},"paper-slide":{"min_frames":6,"max_frames":18},"page-turn":{"min_frames":9,"max_frames":24}}}`; the `enter` entrance motion lives in `tools/studio_project/acting_registry.json` (see Step 3a).
- Produces: scene field `transition: {"preset": "cut"|"paper-slide"|"page-turn", "frames": int}` meaning the boundary AFTER this scene (absent on the last scene; default for others filled by the compiler: `page-turn`, 12 frames, clamped to ≤ 40% of the shorter neighbour's frame count).
- Produces: `resolveTransition(scene, next, fps) -> {preset, frames, startFrame} | null` and `paintTransition(root: HTMLElement, outgoing: HTMLElement, incoming: HTMLElement, preset: string, progress: number): void`, both pure functions of `progress ∈ [0,1]`.
- Consumes: scene frame counts from `manifest.performance_graph`.

- [ ] **Step 1: Check the registry before building:** run the `hyperframes-registry` skill / `hyperframes catalog` filtered by "transition" and "curl"; adopt a ready page-curl block's CSS/GSAP if one fits the paper style, otherwise implement `page-turn` with a CSS 3D page: outgoing scene on a `transform-origin: left center` plane rotating `rotateY(0 → -160deg)` with `backface-visibility: hidden`, a gradient shadow sweeping the incoming scene, and a paper-grain highlight at the fold.
- [ ] **Step 2: Failing tests** (`node --test tests/studio_transitions.test.mjs`): `resolveTransition` clamps frames to ≤ 40% of the shorter neighbour and returns null for `cut`/last scene; `paintTransition` at progress 0 leaves outgoing fully visible (rect identical), at 1 leaves incoming fully visible; two calls with the same progress produce identical `style.transform` strings (determinism); frames outside `[min,max]` rejected by the compiler with `VISUAL_TRANSITION_INVALID [scene sNN]`.
- [ ] **Step 3: Implement** `visual_transitions.mjs`, add compiler validation and default fill, and call `paintTransition` from the preview painter (episode playhead) and from `prepareExport` frame stepping, so the same function drives both. Stepped on twos: round progress to the 12 fps grid like other motion.
- [ ] **Step 3a: Add the `enter` motion (fly in from outside the screen).** Extend `tools/studio_project/acting_registry.json` (`motions`) and `tools/studio_project/visual_acting.mjs` with `enter`: event `{preset:'enter', duration_frames: 9..24, params:{from:'left'|'right'|'top'|'bottom', overshoot_px: 0..24, ease:'out'}}`, `state_before == state_after`; the target starts fully off-canvas on the named side and ends at its authored transform; moves stepped on twos with ease-out and an optional small overshoot-and-settle. `validateActingEvent` allows the off-canvas start only for `enter` and rejects an end pose outside the canvas. `quality()` in `visual_preview.mjs:134` must skip `OUTSIDE_CANVAS` for frames where an `enter` event is still running on that entity.
- [ ] **Step 4a: Compose the two effects.** In a page-turn, the incoming scene's `enter` events start at the frame the page has turned past 60% (so they are visible, not hidden behind the outgoing page) and the transition's total length is clamped so every `enter` finishes before that scene's first voice anchor. Tests in `tests/studio_transitions.test.mjs`: `test_enter_starts_off_canvas_and_ends_on_the_authored_pose` (frame 0 rect fully outside the canvas on the `from` side, last frame equals the authored transform), `test_enter_is_deterministic_per_frame`, `test_enter_does_not_raise_outside_canvas_qa`, `test_enter_finishes_before_the_first_voice_anchor`, `test_page_turn_reveals_incoming_scene_before_its_components_fly_in`.
- [ ] **Step 4: Keep captions out of the page:** captions render in a layer above both scenes (`visual_captions.mjs`); add test `test_captions_stay_static_during_a_transition` asserting caption element has no transform at progress 0.5.
- [ ] **Step 5: Run** `node --test tests/studio_transitions.test.mjs tests/studio_acting.test.mjs tests/studio_episode_timeline.test.mjs` → PASS; `python -m pytest tests/test_studio_p34_visual.py -q` PASS (compiler identity includes the registry hash so builds rebuild).
- [ ] **Step 6: Verify in the real app:** build, scrub the timeline across a boundary: the page turns over ~0.5 s and captions stay put; export a short MP4 and confirm frame at boundary matches the preview (`tests/studio_hyperframes_export_browser.mjs` pixel check).
- [ ] **Step 7: Commit** → `feat(studio): paper-slide and page-turn scene transitions`.

---

### Task 8: Choose transitions (agent default + GUI control)

**Files:**
- Modify: `tools/studio_project/agent_parts.py` (scene schema/prompt mention), `apps/zodiac-studio/src/VisualEditor.tsx` (scene inspector tab "Chuyển cảnh"), `apps/zodiac-studio/src/backend.ts`
- Test: `tests/test_studio_agent_parts.py`, `tests/studio_workbench_browser.mjs`

**Interfaces:**
- Consumes: scene `transition` field and registry from Task 7; existing `scene.patch` command extended with `changes.transition`.
- Produces: `validate_scene` rejects `transition` on a scene with an unknown preset (`"preset phải là cut, paper-slide hoặc page-turn"`); scene prompt says "do not set transition unless the story calls for a hard cut or a chapter change; Core fills the default; each character/prop that first appears in a scene may carry one `enter` event (`from` chosen by the agent, Core defaults to the side nearest its x position — DECIDED by the user 2026-11-25; the GUI lets the user override `from` per component)".

- [ ] **Step 1: Test** `test_unknown_transition_preset_is_rejected_and_absent_is_allowed` in `tests/test_studio_agent_parts.py`.
- [ ] **Step 2: Implement** the validator and prompt line.
- [ ] **Step 3: GUI:** a "Chuyển cảnh" tab in the scene inspector: preset select (Cắt thẳng / Trượt giấy / Lật trang), frames slider within the preset range, "Áp dụng cho mọi cảnh" button; persists through `scene.patch`. Preview replays the boundary on change.
- [ ] **Step 4: Verify in the real app** by changing scene 2's transition to "Cắt thẳng" and scrubbing; then Undo.
- [ ] **Step 5: Run** `python -m pytest tests/test_studio_agent_parts.py tests/test_studio_p34_visual.py -q`, `npx tsc --noEmit`; **Commit** → `feat(studio): pick scene transitions in the GUI`.

---

### Task 9: GUI polish from the real run

Findings from the GUI run that are still open.

**Files:**
- Modify: `apps/zodiac-studio/src/pipeline/StepList.tsx`, `apps/zodiac-studio/src/pipeline/episode-shell.css`, `apps/zodiac-studio/src/studio-navigation.tsx`, `apps/zodiac-studio/src/pipeline/NextAction.tsx`, `apps/zodiac-studio/src/VisualEditor.tsx`
- Test: `tests/studio_pipeline_layout.test.mjs`, `tests/studio_pipeline_browser.mjs`

**Interfaces:**
- Produces: `buildBlockedText(raw: string): {summary: string, detail: string}` in `apps/zodiac-studio/src/build-error.ts` mapping `VISUAL_ASSET_MISSING s05-phone` → "Cảnh s05 thiếu tài nguyên s05-phone".

- [ ] **Step 1: Failing tests:** `buildBlockedText` cases for `VISUAL_ASSET_MISSING`, `VISUAL_LAYER_INVALID`, `TRACE_STATE_BEFORE` (summaries name the scene); layout test that the step list has no horizontal overflow (`scrollWidth <= clientWidth`) at 1060×650 and 1366×768, and step `detail` wraps to ≤ 2 lines.
- [ ] **Step 2: Implement:** one source for "what next": keep the episode-bar `NextAction`; remove the titlebar "Tiếp theo" pill and the right-panel duplicate ("Mở phần giọng đọc"); the project name appears once in the titlebar (not in the tab strip and the dropdown and the bar); build-blocked banner uses `buildBlockedText` with the detail collapsed; step detail text wraps instead of truncating; stale "Đang chạy" autopilot bar is reconciled when `run.state==="RUNNING"` and no step is running.
- [ ] **Step 3: Run** `node --test tests/studio_pipeline_layout.test.mjs` PASS and the Playwright/CDP suites from Task 10; `npx tsc --noEmit` clean.
- [ ] **Step 4: Verify in the real app** at both viewports with screenshots saved under `.runtime/` (not committed).
- [ ] **Step 5: Commit** → `fix(studio): one next-step, wrapped step text, readable build errors`.

---

### Task 10: Repeatable GUI e2e harness, then design-skill audit

The ad-hoc CDP scripts used so far live in ignored `.runtime/`; make them a tested tool, then use the design skills for a structured GUI review.

**Files:**
- Create: `tools/studio_e2e/cdp.mjs`, `tools/studio_e2e/run_step.mjs`, `tools/studio_e2e/README.md`, `tests/studio_e2e_cdp.test.mjs`
- Modify: `apps/zodiac-studio/scripts/launch-preview.ps1` (optional `-Cdp` switch setting `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`)

**Interfaces:**
- Produces: `connect(port = 9227): Promise<{eval(expr): Promise<any>, click(selectorExpr): Promise<void>, shot(path): Promise<void>, close(): void}>` (real mouse events via `Input.dispatchMouseEvent`); `runStep(page, title, {timeoutSec}): Promise<{seconds: number, text: string}>` waiting on the step row text.

- [ ] **Step 1: Test** `tests/studio_e2e_cdp.test.mjs` against a stub CDP WebSocket server: `click` sends mouseMoved, mousePressed, mouseReleased at the element centre; `eval` returns by value; `runStep` resolves when the row text matches `Xong` and times out otherwise.
- [ ] **Step 2: Implement** the two modules by moving the logic of the existing scratch `cdp.mjs`/`runstep.sh` (do not keep Python or bash dependencies).
- [ ] **Step 3: Install the design skills (user action):** the plugin card shown with this plan offers **Design** (critique, accessibility review, UX copy), **VectorLab UI/UX Skills** (motion, transitions, loaders, empty states, errors, keyboard, viewports) and **UI/UX Behaves** (state-by-state rules, audit/walkthrough). Enable the ones you want; `frontend-design` is already enabled.
- [ ] **Step 4: Audit loop:** capture screenshots of Quy trình, Giọng đọc, Hình ảnh, Duyệt at 1366×768 and 1060×650 with `tools/studio_e2e`; run the installed `design-critique`, `accessibility-review` and `ui-ux-audit` skills on them; file each finding as a line in `docs/audits/2026-11-25-gui-design-audit.md` with severity; fix findings of severity high in this task, queue the rest.
- [ ] **Step 5: Run** `node --test tests/studio_e2e_cdp.test.mjs` PASS; **Commit** → `feat(studio): committed CDP e2e harness and GUI design audit`.

---

## Self-Review

- **Coverage:** Codex finding → Task 1; TTS re-approval (cause: pause/take edits drop whole-episode approval and clear timing; re-import regenerates non-deterministic audio) → Tasks 2–4; agent rewriting scenes → Tasks 5–6; transitions with page/paper turn → Tasks 7–8; GUI optimisation and skill/plugin → Tasks 9–10. Unverified assumption: the user's re-approval is caused by the pause/retake/re-import paths above; Task 2's matrix and `approval_note` exist to confirm or refute that before Tasks 3–4 change behaviour.
- **Types:** `segments_needing_listen`, `confirm_segment`, `recompose_timing`, `VoiceBank`, `apply_scene_ops`, `scene_changes`, `start_scene_revision`, `resolveTransition`, `paintTransition`, `buildBlockedText` are each defined once and referenced identically in later tasks.
- **Order:** 2 → 3 → 4 (voice) and 5 → 6 (agent) and 7 → 8 (transitions) are independent chains; 9 and 10 can start any time (10 first makes verification cheaper).
