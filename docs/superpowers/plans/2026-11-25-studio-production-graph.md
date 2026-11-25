# Studio Production Graph and GUI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Zodiac Studio into an episode management and video-building app whose main surface is a ComfyUI-style production graph (nodes = production steps with status, cache and re-run), where an agent performs everything plugin Phase 2 does (author, validate, assets, compile, inspect, cover, publish copy, repair) and the user only completes approval gates.

**Architecture:** A declarative node registry (`nodes.json`) defines a fixed episode pipeline; a pure function derives every node's status from evidence the Project Core already produces; a runner dispatches a node to existing services. An **autopilot** walks the graph: it runs ready nodes, asks the agent for structured proposals (the model never writes files), auto-applies proposals through the canonical revisioned commands once validators pass, feeds validator issues back for bounded repair, and stops only at approval gates or unrecoverable blockers. The React GUI draws the graph, a "Cần bạn" queue, and the matching tool in an inspector, with preview + timeline always visible.

**Tech Stack:** Python 3.10+ (`tools/studio_project`, `unittest`/`pytest`), React 19 + `@xyflow/react` 13.0.3 (already installed) + Tauri 2, TypeScript, Playwright-style `.mjs` browser tests with the existing fixture transport.

**Spec:** No separate design doc: the user chose to iterate ("cứ thử và sửa dần"). The decisions below are the spec. Supersedes `2026-11-25-studio-gui-refactor.md` (it kept the relationship graph) and the layout parts of `2026-11-24-studio-graph-workspace-implementation.md`. Does not change R5/R6 scope of `2026-11-24-studio-graph-roadmap.md`.

## Decisions (user's, then mine)

User: the relationship graph is dropped (no effect beyond monitoring); graph = production flow; fixed pipeline, easy to extend; try then refine; **the agent must be able to do everything plugin Phase 2 does so the user barely touches the app.**
Mine: user touches only the approval gates (listen to voice, Visual Review) plus import; everything else is autopilot with undoable revisions; plugin Phase 2 rules (`02-visual-production.md`/`.json`, `references/*`, validators) are the agent's contract; the agent's visual inspection is advisory evidence shown at the gate and never replaces the user's review; nodes come from a data file so a new step needs a manifest entry plus an executor, not a core change; v1 imports Phase 1 from the plugin capsule (in-app Phase 1 nodes later through the same registry); gates are user-only; keep Project Core, Tauri, HyperFrames.

## Global Constraints

- Approvals (content review, voice listening, visual review) are completed only by a GUI user action over the Tauri RPC. Autopilot, agent tasks, `pipeline.run` and `source.replace` may never create or imply one. "chốt" means: finish validation and repair, never waive a validator (plugin Phase 2 rule).
- The model never writes files. Agents return structured proposals; the backend validates and applies them through the existing canonical commands (revision-checked, idempotent, undoable). Auto-apply is per-project mode `autopilot` (default) or `confirm` (current click-to-apply behaviour).
- Fresh authoring contract = plugin Phase 2: `.authoring/visual-intent.json` is the single authored source; projections are compiler-owned; Phase 1 `story_visual_direction`/`story_visual_decision` missing is an upstream BLOCKED, never invented.
- Status is derived from evidence only; file existence never means approved. Technical `DONE` and human `PENDING` are shown separately (matches AGENTS.md).
- All user-facing strings Vietnamese. Layout/zoom preferences are UI-local, never canonical; storage failures must not block editing.
- No page-level scroll at 1366×768, 1060×650, 1093×614, 800×960; preview ≥190 px tall; visible keyboard focus.
- Canonical commands, revision checks and idempotency stay in `visual_workspace.py` / `voice_lab.py`; this plan adds no second writer.
- Commits are scoped per task, end with the two lines `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01AGF5oLNmJwpeRVifEcc8Z7`; push to the current branch per AGENTS.md; never stage unrelated dirty files.

## Review Focus

1. Voice take re-selected or re-assembled after scenes were built: `timing`, every `scene:*`, `build`, `visual_review`, `export` become `STALE`; nothing upstream changes.
2. `pipeline.run` on a gate node, or from an agent task, must fail with `PIPELINE_GATE_USER_ONLY` and write nothing.
3. Running a node whose input is not `DONE` fails with `PIPELINE_INPUT_NOT_READY` naming the first unready input.
4. Project with no voice and no visual intent: graph still returns, `voice` is `READY`/`BLOCKED` by content, the rest `PENDING`; no exception.
5. Episode with 1 scene and with 30 scenes: layout has disjoint node rectangles and the graph opens fitted.
6. Second `pipeline.run` while a job is running returns `PIPELINE_BUSY` and does not start another job.
7. Validator keeps failing after the repair budget (2 attempts): autopilot stops with `FAILED` and the issues listed in "Cần bạn"; it never applies an invalid proposal and never loops.
8. App closed mid-run: on reopen `RUNNING` is recovered to `READY`/`STALE` (never `DONE`) and autopilot resumes only when the user presses it.
9. Autopilot reaches a gate: it waits; user confirms; it continues. Editing the source after a gate is confirmed invalidates that gate and autopilot stops again.

## File Structure

- Create `tools/studio_project/pipeline/__init__.py` — public API: `load_registry`, `derive`, `collect_evidence`, `run_node`.
- Create `tools/studio_project/pipeline/nodes.json` — node manifest (`zodiac-pipeline-nodes@1`).
- Create `tools/studio_project/pipeline/registry.py` — `NodeSpec`, `Registry`, validation.
- Create `tools/studio_project/pipeline/derive.py` — pure status derivation.
- Create `tools/studio_project/pipeline/evidence.py` — adapter from existing services to `PipelineEvidence`.
- Create `tools/studio_project/pipeline/runner.py` — dispatch to existing services.
- Create `tools/studio_project/pipeline/validators.py` — run plugin Node validators through the existing bridge pattern (`handoff_bridge.mjs`), return structured issues.
- Create `tools/studio_project/pipeline/proposals.py` — proposal kinds, schema validation, canonical apply, auto-apply policy.
- Create `tools/studio_project/pipeline/context.py` — builds the agent's Phase-2 context (phase rules + selected references) from the plugin.
- Create `tools/studio_project/pipeline/autopilot.py` — orchestrator, repair loop, persisted run record `.runtime/pipeline/run.json`.
- Create `tools/studio_project/pipeline/review.py` — `visual_review` receipt (user gate).
- Modify `tools/studio_project/rpc_stdio.py` — methods `pipeline.get`, `pipeline.run`, `pipeline.cancel`, `pipeline.gate.confirm`, `pipeline.autopilot.start`, `pipeline.autopilot.stop`, `pipeline.mode.set`, plus executors `validators.run`, `assets.resolve`, `agent.cover.start`, `agent.publish.start`, `agent.inspect.start`.
- Modify `tools/studio_project/agent_bridge.py`, `agent_authoring.py` — new proposal kinds, two-attempt validation retry reused.
- Modify `tools/studio_project/status.py` — `visual` reads the review receipt instead of constant `UNKNOWN`.
- Create `apps/zodiac-studio/src/pipeline/` — `types.ts`, `layout.ts`, `pipeline-store.ts`, `PipelineGraph.tsx`, `NodeCard.tsx`, `AutopilotBar.tsx`, `NeedsYou.tsx`, `inspector-registry.tsx`, `EpisodeShell.tsx`.
- Modify `apps/zodiac-studio/src/backend.ts`, `App.tsx`, `studio-navigation.tsx`, `VisualEditor.tsx` (split), `VoiceLab.tsx`, `EpisodeExport.tsx`.
- Delete after Task 8: `SceneGraph.tsx`, `scene-graph.ts`, `StudioWorkspace.tsx`, `studio-workspace.css`, `tests/studio_scene_graph.test.mjs`, `tests/studio_graph_browser.mjs` (replaced).
- Tests: `tests/test_studio_pipeline_registry.py`, `test_studio_pipeline_derive.py`, `test_studio_pipeline_runner.py`, `test_studio_pipeline_review.py`, `tests/studio_pipeline_layout.test.mjs`, `tests/studio_pipeline_browser.mjs`.

---

### Task 1: Node manifest and registry

**Files:** Create `pipeline/nodes.json`, `pipeline/registry.py`, `pipeline/__init__.py`; Test `tests/test_studio_pipeline_registry.py`.

**Interfaces:**
- Produces: `NodeSpec(id: str, title: str, kind: Literal["step","gate","fan"], inputs: tuple[str,...], executor: str | None, fan_over: str | None)`; `Registry.nodes: tuple[NodeSpec,...]` in topological order; `load_registry(path: Path | None = None) -> Registry`; `Registry.expand(scene_ids: Sequence[str]) -> tuple[ExpandedNode,...]` where a `fan` node becomes `scene:<id>` instances; `ExpandedNode(node_id: str, spec_id: str, scene_id: str | None, inputs: tuple[str,...])`. Raises `StudioError("PIPELINE_REGISTRY_INVALID", ...)`.
- Manifest v1 (mirrors plugin Phase 2 `visual_compile`/`assets`/`publish_prep`): `content`(gate) → `voice`(step, `voice.start`) → `voice_review`(gate) → `timing`(step, `voice.start` align) → `visual`(step, `agent.author.start`: author Visual Intent) → `checks`(step, `validators.run`: progressive preflight, scene experience, authoring completeness, story-visual presence) → then in parallel `assets`(step, `assets.resolve`: select/bind components, record NO_FIT tasks) and `cover`(step, `agent.cover.start`) and `publish`(step, `agent.publish.start`) → `scene`(fan over scenes, `scene.compile`, input `assets`) → `build`(step, `episode.build`) → `inspect`(step, `agent.inspect.start`: phone-size frame/event review report) → `visual_review`(gate, inputs `inspect`,`cover`,`publish`) → `export`(step, `video.export`).
- Each step node may carry `agent: {proposal_kind: str, context_refs: [str], validators: [str], max_attempts: int}`; this is how the autopilot knows what to ask the agent and what to validate.

- [ ] **Step 1: Write failing tests** in `test_studio_pipeline_registry.py`: `test_default_manifest_is_valid_dag_in_topological_order` (every input appears earlier); `test_gates_have_no_executor` (`content`, `voice_review`, `visual_review` have `executor is None`); `test_cycle_rejected` (tmp manifest where `a` needs `b`, `b` needs `a` → `PIPELINE_REGISTRY_INVALID`); `test_unknown_input_rejected`; `test_unknown_executor_rejected` (executor not in `ALLOWED_EXECUTORS`); `test_agent_block_validated` (`max_attempts` ≥1 and ≤3, `proposal_kind` required when `agent` present); `test_visual_review_inputs_include_inspect_cover_publish`; `test_new_node_needs_no_code_change` (tmp manifest adds `music` step after `timing` with executor `audio.mix` registered via `ALLOWED_EXECUTORS` extra argument → loads); `test_expand_fan_nodes` (`expand(["s01","s02"])` yields `scene:s01`, `scene:s02`, each with input `visual`, and `build` input list `["scene:s01","scene:s02"]`).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_registry.py -q` → FAIL (module missing).
- [ ] **Step 3: Implement** `registry.py` and `nodes.json` per interfaces. `ALLOWED_EXECUTORS` is the set of existing RPC method names the runner may call; `load_registry(path, extra_executors=())`.
- [ ] **Step 4: Run** same command → PASS.
- [ ] **Step 5: Commit** `feat(studio): pipeline node manifest and registry`.

### Task 2: Pure status derivation

**Files:** Create `pipeline/derive.py`; Test `tests/test_studio_pipeline_derive.py`.

**Interfaces:**
- Consumes: `Registry.expand` from Task 1.
- Produces: `NodeStatus = Literal["PENDING","READY","RUNNING","DONE","FAILED","STALE","BLOCKED","AWAITING_USER"]`; `PipelineEvidence` frozen dataclass: `content_approved: bool`, `voice_units_total: int`, `voice_units_selected: int`, `voice_assembled: bool`, `voice_listened: bool`, `timing_ready: bool`, `visual_revision: int | None`, `visual_source_hash: str | None`, `scene_ids: tuple[str,...]`, `built_scene_ids: frozenset[str]`, `build_revision: int | None`, `build_voice_fingerprint: str | None`, `current_voice_fingerprint: str | None`, `review_receipt_valid: bool`, `export_state: Literal["NONE","EXPORTED","STALE","BLOCKED"]`, `running_node: str | None`, `failed: Mapping[str,str]`; `NodeState(node_id, title, kind, status, inputs, detail: str, scene_id: str | None)`; `PipelineGraph(project_id, revision, nodes: tuple[NodeState,...])`; `derive(registry: Registry, evidence: PipelineEvidence, *, project_id: str, revision: int) -> PipelineGraph`.
- Rules: a node is `DONE` only if its own evidence holds and no input is `STALE`/`FAILED`/`BLOCKED`; an input that is not `DONE` makes a step/fan `PENDING`; all inputs `DONE` and no evidence → `READY` (step/fan) or `AWAITING_USER` (gate); `running_node` → `RUNNING`; if `current_voice_fingerprint != build_voice_fingerprint` or `build_revision != visual_revision`, `scene:*` with a build, `build`, `visual_review`, `export` → `STALE`; `export_state=="STALE"` → `export` `STALE`; `content` not approved → `BLOCKED`.

- [ ] **Step 1: Write failing tests**, one per rule: `test_fresh_project_only_voice_ready`, `test_unapproved_content_blocks_everything` (`content` BLOCKED, downstream PENDING), `test_gate_awaiting_user_not_ready`, `test_voice_listened_makes_review_done_and_timing_ready`, `test_voice_reselect_stales_downstream_only` (Review Focus 1: upstream statuses unchanged), `test_running_and_failed_overlay`, `test_no_voice_no_visual_does_not_raise` (Review Focus 4), `test_scene_fan_status_per_scene` (one scene missing from `built_scene_ids` → that `scene:*` READY, others DONE).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_derive.py -q` → FAIL.
- [ ] **Step 3: Implement** `derive` as a single pass over `registry.expand(evidence.scene_ids)`; no I/O.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(studio): derive pipeline node status from evidence`.

### Task 3: Evidence adapter and `pipeline.get` RPC

**Files:** Create `pipeline/evidence.py`; Modify `pipeline/__init__.py`, `rpc_stdio.py`; Test `tests/test_studio_pipeline_registry.py` (add) or new `tests/test_studio_pipeline_rpc.py`.

**Interfaces:**
- Consumes: `PipelineEvidence`, `derive`, `StudioProjectService.visual.snapshot(project_id)`, `service.voice` open/state, `resolve_episode_status`.
- Produces: `collect_evidence(service: StudioProjectService, project_id: str) -> PipelineEvidence`; RPC `pipeline.get {project_id}` → `{format:"zodiac-pipeline@1", project_id, revision, nodes:[{id,title,kind,status,inputs,detail,scene_id}]}`.

- [ ] **Step 1: Write failing tests** mirroring the service fixture in `tests/test_studio_p1_rpc.py`: `test_pipeline_get_returns_graph_for_imported_project` (contains `content` and `voice`, `content` DONE); `test_pipeline_get_unknown_project` → `PROJECT_NOT_FOUND`; `test_pipeline_get_is_read_only` (registry revision and event count unchanged after the call).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_rpc.py -q` → FAIL.
- [ ] **Step 3: Implement** `collect_evidence` using existing read APIs only (no new file parsing); add `pipeline.get` branch in `rpc_stdio.dispatch` with `_exact(params, "project_id")`.
- [ ] **Step 4: Run** → PASS; also run `python -m pytest tests/test_studio_p1_rpc.py -q` (no regression).
- [ ] **Step 5: Commit** `feat(studio): pipeline.get RPC`.

### Task 4: Runner, busy/gate rules, staleness

**Files:** Create `pipeline/runner.py`; Modify `rpc_stdio.py`; Test `tests/test_studio_pipeline_runner.py`.

**Interfaces:**
- Produces: `run_node(service: StudioProjectService, project_id: str, node_id: str, base_revision: int, *, caller: Literal["gui","agent"]) -> dict` returning the fresh `pipeline.get` payload; RPC `pipeline.run {project_id,node_id,base_revision}` (caller always `"gui"`), `pipeline.cancel {project_id}` (delegates to `visual.cancel`/`voice.cancel` for the running node). Errors: `PIPELINE_GATE_USER_ONLY`, `PIPELINE_INPUT_NOT_READY`, `PIPELINE_BUSY`, `PIPELINE_NODE_UNKNOWN`.
- Dispatch table: `voice`→`voice.start(generate)`, `timing`→`voice.start(align)`, `visual`→`agent.author.start`, `checks`→`validators.run`, `assets`→`assets.resolve`, `cover`→`agent.cover.start`, `publish`→`agent.publish.start`, `scene:<id>`→`scene.compile`, `build`→`episode.build`, `inspect`→`agent.inspect.start`, `export`→`video.export`. Where a Studio executor for `cover`/`publish` does not exist yet (check `visual_opening.mjs` and plugin `features/cover`, `features/publish` first), the node reports `BLOCKED` with detail "Chưa hỗ trợ trong Studio" instead of faking success.

- [ ] **Step 1: Write failing tests** with a fake service recording calls: `test_gate_node_refused` and `test_agent_caller_refused` (Review Focus 2, no service call recorded); `test_unready_input_refused_names_first_input` (Review Focus 3); `test_busy_refused` (Review Focus 6); `test_scene_node_calls_scene_compile_with_scene_id`; `test_build_node_calls_episode_build_with_base_revision`; `test_unknown_node`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_runner.py -q` → FAIL.
- [ ] **Step 3: Implement** `run_node`: derive graph, check node/gate/inputs/busy in that order, then call the mapped existing method; never write files itself.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(studio): pipeline.run dispatches nodes to existing services`.

### Task 5: Validator executor (plugin checks as structured issues)

**Files:** Create `pipeline/validators.py`; Modify `rpc_stdio.py`; Test `tests/test_studio_pipeline_validators.py`.

**Interfaces:**
- Produces: `run_validators(service, project_id: str, names: Sequence[str]) -> ValidationReport` where `ValidationReport(ok: bool, issues: tuple[Issue,...], receipt_sha256: str)` and `Issue(code: str, owner: str, scene_id: str | None, message: str, repair_group: str)`; RPC `validators.run {project_id, names}`. Allowed names come from the node's `agent.validators`: `progressive-preflight`, `scene-experience`, `authoring-completeness`, `story-visual-presence`. Each maps to the plugin script named in `02-visual-production.md` (`validate-phase02-progressive-preflight.mjs`, `validate-scene-experience.mjs`, `validate-phase02-authoring-completeness.mjs`, `features/visual-composition/validate-story-visual-presence.mjs`) via a Node subprocess with `shell=False`, argv only, workspace path validated (same safety rules as `handoff_bridge.mjs`). The runner executes all names as one bounded parallel batch and groups issues by owning canonical source (`repair_group`).

- [ ] **Step 1: Write failing tests** with a stub Node runner: `test_all_pass_returns_ok_with_receipt`; `test_issues_grouped_by_repair_group`; `test_review_status_is_not_ok` (a validator returning REVIEW counts as not ok, plugin rule: REVIEW blocks); `test_unknown_validator_name_rejected`; `test_missing_story_visual_decision_is_upstream_block` (issue `owner="phase1"`, never auto-repairable); `test_runner_uses_argv_without_shell`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_validators.py -q` → FAIL.
- [ ] **Step 3: Implement** `run_validators`; receipt hash binds validator names, source hash and outputs.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(studio): run plugin validators as structured issues`.

### Task 6: Agent proposal kinds, Phase-2 context, auto-apply

**Files:** Create `pipeline/proposals.py`, `pipeline/context.py`; Modify `agent_bridge.py`, `agent_authoring.py`, `rpc_stdio.py`; Test `tests/test_studio_pipeline_proposals.py`.

**Interfaces:**
- Consumes: existing `AgentManager` task lifecycle, two-attempt validation retry, `VisualWorkspace.command`.
- Produces: `ProposalKind = Literal["visual.intent","assets.select","cover.design","publish.copy","inspect.report"]`; `validate_proposal(kind: ProposalKind, payload: dict, evidence: PipelineEvidence) -> tuple[Issue,...]`; `apply_proposal(service, project_id: str, kind: ProposalKind, payload: dict, base_revision: int, command_id: str) -> dict` that maps to existing commands only (`visual.intent`→`source.replace`/`scene.patch`/`scene.performance`, `assets.select`→`asset.select`, `cover.design` and `publish.copy` → their canonical writers, `inspect.report`→stored evidence file, no source change); `build_context(project_id: str, node_id: str, issues: Sequence[Issue]) -> str` that composes the node's `context_refs`, the plugin Phase-2 work-loop text, bounded selected references (via the plugin's capability registry `bootstrap/capabilities.json` and `plan-step-context.mjs`) and the previous attempt's issues; RPC `pipeline.mode.set {project_id, mode:"autopilot"|"confirm"}` persisted per project. In `confirm` mode proposals wait for the existing click-to-apply button; in `autopilot` mode `apply_proposal` runs automatically after `validate_proposal` returns no issues.

- [ ] **Step 1: Write failing tests**: `test_invalid_proposal_never_applied` (stale base revision, dangling asset, missing story-visual reference → issues, no command issued); `test_valid_visual_intent_applied_via_canonical_command` (revision increments by one, undo restores source); `test_apply_is_idempotent_on_command_id`; `test_inspect_report_changes_no_source`; `test_confirm_mode_waits_for_click`; `test_context_contains_phase02_loop_and_previous_issues_and_bounds_size` (context ≤ configured byte budget); `test_proposal_cannot_set_any_approval_field` (payload containing `receipt`/`approved`/`listened` keys → rejected).
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_proposals.py -q` → FAIL.
- [ ] **Step 3: Implement** modules; reuse existing validation retry (two model turns) and failure retention from `agent_authoring.py`.
- [ ] **Step 4: Run** → PASS; run `python -m pytest tests/test_studio_agent_authoring.py tests/test_studio_p1_agent.py -q` (no regression).
- [ ] **Step 5: Commit** `feat(studio): agent proposals with validated auto-apply`.

### Task 7: Autopilot orchestrator

**Files:** Create `pipeline/autopilot.py`; Modify `rpc_stdio.py`; Test `tests/test_studio_pipeline_autopilot.py`.

**Interfaces:**
- Consumes: `derive`, `collect_evidence`, `run_node`, `run_validators`, `validate_proposal`/`apply_proposal`, `build_context`.
- Produces: `Autopilot(service, project_id)` with `start(base_revision: int) -> RunRecord`, `stop() -> RunRecord`, `resume_after_gate() -> RunRecord`, `step() -> RunRecord` (one scheduling decision, used by tests); `RunRecord(run_id, state: Literal["IDLE","RUNNING","WAITING_GATE","WAITING_USER","DONE","STOPPED"], node: str | None, needs_you: tuple[NeedsYou,...], log: tuple[LogLine,...])`; `NeedsYou(node_id, kind: Literal["gate","blocked","failed"], title, detail, issues: tuple[Issue,...])`. Persisted at `.runtime/pipeline/run.json` (atomic write, same pattern as existing runtime state). Scheduling rule: pick the first node in topological order whose status is `READY`, `STALE` or `FAILED` with attempts left; for a node with an `agent` block run `agent task → validate → apply → run validators`, repair up to `max_attempts` using issues as feedback; gate node → state `WAITING_GATE` and stop; `BLOCKED` with an upstream owner → `WAITING_USER`; on reopen `RUNNING` is reset (Review Focus 8). RPCs `pipeline.autopilot.start|stop`, polled through `pipeline.get` which also returns the run record.

- [ ] **Step 1: Write failing tests** with fake executors: `test_runs_nodes_in_order_until_first_gate` (stops at `voice_review`, state `WAITING_GATE`); `test_resumes_after_gate_confirmed`; `test_repair_loop_uses_issues_then_succeeds_on_second_attempt`; `test_repair_budget_exhausted_marks_failed_and_lists_issues` (Review Focus 7, exactly `max_attempts` agent calls); `test_upstream_block_waits_for_user_without_agent_call`; `test_restart_recovers_running_to_ready` (Review Focus 8); `test_edit_after_gate_stops_again` (Review Focus 9); `test_stop_cancels_running_job_and_keeps_done_nodes`; `test_never_calls_gate_confirm`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_autopilot.py -q` → FAIL.
- [ ] **Step 3: Implement** a single-threaded scheduler loop driven by `step()`; a background thread calls `step()` until a terminal/waiting state; cancellation uses existing job cancel.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(studio): autopilot walks the production graph`.

### Task 8: Visual review gate receipt

**Files:** Create `pipeline/review.py`; Modify `status.py`, `rpc_stdio.py`; Test `tests/test_studio_pipeline_review.py`.

**Interfaces:**
- Produces: `confirm_visual_review(service, project_id: str, base_revision: int, build_id: str, playback_id: str) -> dict` writing `.runtime/visual-workspace/review.json` `{format:"zodiac-visual-review@1", build_id, build_manifest_sha256, source_hash, revision, confirmed_at, proof:{kind:"user_gui", playback_id}}`; `review_receipt_valid(root: Path, state: dict) -> bool` (receipt hashes match current build manifest and source hash); RPC `pipeline.gate.confirm {project_id,gate:"visual_review",base_revision,build_id,playback_id}`. `resolve_episode_status().visual` returns `"APPROVED"` only when the receipt is valid, `"STALE"` when a receipt exists but no longer matches, else `"UNKNOWN"`.
- Reuse the playback-proof pattern of `voice.playback`/`voice.confirm` in `voice_lab.py` (a confirm requires a prior playback id issued by the backend). The gate payload shown to the user includes the `inspect` report and `checks` receipt so the user reviews evidence, not a blank approval; the gate is unavailable (`AWAITING_USER` hidden behind "Agent đang hoàn thiện") until `checks`, `inspect`, `cover`, `publish` are `DONE`.

- [ ] **Step 1: Write failing tests**: `test_confirm_requires_issued_playback_id`; `test_confirm_binds_build_and_source_hash`; `test_edit_after_review_makes_receipt_stale` (visual status `STALE`, `visual_review` node `STALE` via derive); `test_agent_cannot_confirm` (call through agent scope → `COMMAND_SCOPE_FORBIDDEN`); `test_status_visual_unknown_without_receipt`.
- [ ] **Step 2: Run** `python -m pytest tests/test_studio_pipeline_review.py -q` → FAIL.
- [ ] **Step 3: Implement** per interfaces; update `evidence.py` to fill `review_receipt_valid`.
- [ ] **Step 4: Run** → PASS; run `python -m pytest tests/test_studio_project_evidence.py tests/test_studio_p1_agent.py -q` (no regression).
- [ ] **Step 5: Commit** `feat(studio): user-only visual review receipt`.

### Task 9: Frontend types, layout and store

**Files:** Create `src/pipeline/types.ts`, `layout.ts`, `pipeline-store.ts`; Modify `backend.ts`; Test `tests/studio_pipeline_layout.test.mjs` (load TS the same way `tests/studio_scene_graph.test.mjs` does).

**Interfaces:**
- Produces: `PipelineNode = {id:string; title:string; kind:"step"|"gate"|"fan"; status:NodeStatus; inputs:string[]; detail:string; scene_id:string|null}`; `layoutPipeline(nodes: PipelineNode[]): Record<string,{x:number;y:number}>` (column = longest-path depth from roots; rows within a column ordered by input order; fixed node box 200×84, gap 56×28; no overlap); `backend.pipelineGet(project_id)`, `backend.pipelineRun(project_id,node_id,base_revision)`, `backend.pipelineCancel(project_id)`, `backend.pipelineConfirmVisual(...)`; store: `createPipelineStore(api): {subscribe, getSnapshot, refresh(), run(nodeId), select(nodeId|null), startAutopilot(), stopAutopilot(), setMode("autopilot"|"confirm")}`; snapshot includes `run: RunRecord` and `needsYou: NeedsYou[]` with one poll loop (1.5 s while a node is `RUNNING`, 5 s otherwise, paused when `document.hidden`), snapshot identity unchanged when payload equal.

- [ ] **Step 1: Write failing tests**: `layout puts fan instances in one column`; `layout has disjoint rectangles for 1, 8 and 30 scenes` (Review Focus 5); `layout is deterministic`; `store keeps snapshot identity on equal payload`; `store polls faster while running and stops when hidden`; `store.run rejects when node is gate` (never calls api); `snapshot exposes needsYou from run record`.
- [ ] **Step 2: Run** `node tests/studio_pipeline_layout.test.mjs` → FAIL.
- [ ] **Step 3: Implement** the three modules; `selection` is `{nodeId, sceneId}` only.
- [ ] **Step 4: Run** → PASS; `pnpm.cmd -C apps/zodiac-studio build` → success.
- [ ] **Step 5: Commit** `feat(studio): pipeline store and layered layout`.

### Task 10: PipelineGraph surface

**Files:** Create `src/pipeline/PipelineGraph.tsx`, `NodeCard.tsx`, `src/pipeline/pipeline.css`; Test `tests/studio_pipeline_browser.mjs` (fixture transport from `tests/studio_workbench_fixture.mjs`; add `pipeline.get/run` handlers there).

**Interfaces:**
- Consumes: `layoutPipeline`, `createPipelineStore`.
- Produces: `<PipelineGraph store={...} onOpen={(node)=>void}/>` read-only React Flow (`nodesConnectable={false}`, `nodesDraggable={false}`, `elementsSelectable`), edges from `inputs`, node card shows title, Vietnamese status chip, `detail`, a Chạy lại button (hidden for gates, disabled unless `READY`/`STALE`/`FAILED`), and an `aria-label` `"<title>, <trạng thái>"`; keyboard: arrow keys move selection along edges, Enter opens. Status labels: DONE "Xong", READY "Sẵn sàng", RUNNING "Đang chạy", STALE "Cũ", FAILED "Lỗi", BLOCKED "Bị chặn", AWAITING_USER "Chờ bạn duyệt", PENDING "Chờ bước trước". Status is text plus icon, never color only. Fits view on first load of a project and on "Khớp Graph". `AutopilotBar`: Chạy tự động / Dừng, mode switch Tự động ↔ Xác nhận từng đề xuất, current node and elapsed time. `NeedsYou`: the only list that asks for the user (gates and failed/blocked nodes with their issues); empty state "Không cần bạn lúc này".

- [ ] **Step 1: Write failing browser test**: graph shows 13+ nodes for the fixture; pressing Chạy tự động calls `pipeline.autopilot.start` once and the NeedsYou list shows the voice gate when the fixture run record is `WAITING_GATE`; mode switch calls `pipeline.mode.set`; gate node has no run button; clicking a `STALE` node's run calls `pipeline.run` once with the current `base_revision`; arrow-key navigation reaches `export`; identical poll causes no node re-render (count renders via a test hook `window.__pipelineRenders`); at 1366×768, 1060×650, 1093×614, 800×960 the graph canvas is ≥190 px tall and nothing is clipped.
- [ ] **Step 2: Run** `node tests/studio_pipeline_browser.mjs` → FAIL.
- [ ] **Step 3: Implement** components; memoize `NodeCard` on `(id,status,detail)`.
- [ ] **Step 4: Run** → PASS; `pnpm.cmd -C apps/zodiac-studio build`.
- [ ] **Step 5: Commit** `feat(studio): production graph surface`.

### Task 11: Episode shell with inspector registry

**Files:** Create `src/pipeline/EpisodeShell.tsx`, `inspector-registry.tsx`; Modify `App.tsx` (route Episode → shell), `studio-navigation.tsx`; Delete the files listed in File Structure; update `tests/studio_workbench_browser.mjs`, `tests/studio_compact_layout.mjs`, `tests/studio_ideas_browser.mjs` navigation selectors.

**Interfaces:**
- Produces: `INSPECTORS: Record<string, LazyExoticComponent<ComponentType<InspectorProps>>>` keyed by node id (scene fan instances use key `scene`); `InspectorProps = {project: Project; node: PipelineNode; onChanged: () => void}`. Mapping: `content`→Nội dung summary, `voice`/`voice_review`/`timing`→`VoiceLab` (embedded), `visual`→authoring/Agent panel, `scene`→scene editor (preview overlay + object/event/asset tabs), `build`→build log, `visual_review`→review (MP4/preview playback then confirm), `export`→`EpisodeExport`. Unknown node id falls back to a generic detail panel (this is the extension point).
- Shell layout (grid areas): top bar (episode picker, build/job status); left or top graph (collapsible); center preview (always mounted, ≥190 px tall); right inspector; bottom timeline. One drawer for gallery/source/log. One Agent entry in the inspector with capability selector.

- [ ] **Step 1: Write failing browser assertions** (extend `studio_pipeline_browser.mjs`): selecting `voice` shows the Voice Lab and keeps preview + timeline mounted; selecting `export` does not hide the preview; unknown fixture node shows the generic panel; no sidebar/dashboard metric cards remain in Episode view; no horizontal or page scroll at the four sizes.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** shell and registry; remove `contextPanel`, `graphTarget`, `onData` props; delete files listed above; move Activity and Agent pages into inspector tab/drawer.
- [ ] **Step 4: Run** `node tests/studio_pipeline_browser.mjs tests/studio_workbench_browser.mjs tests/studio_compact_layout.mjs tests/studio_ideas_browser.mjs` individually → all PASS; `pnpm.cmd -C apps/zodiac-studio build`.
- [ ] **Step 5: Commit** `refactor(studio): episode shell driven by production graph`.

### Task 12: Split VisualEditor under the store

**Files:** Modify `VisualEditor.tsx` → thin composer; Create `src/scene/usePreviewPlayer.ts`, `PreviewStage.tsx`, `TransformOverlay.tsx`, `SceneInspector.tsx` (object/event/asset tabs), `AgentPanel.tsx`; Test existing `tests/studio_p34_visual.test.mjs`, `studio_workbench_browser.mjs` stay green, plus new `tests/studio_scene_modules.test.mjs`.

**Interfaces:**
- Produces: `usePreviewPlayer(projectId, sceneId): {preview, frameReady, playing, timeMs, play(), pause(), seek(ms)}` (sole owner of SDK, iframes, audio and the playhead); selection `{sceneId, entityId, stateId, timeMs}` lives only in the pipeline store; each file ≤250 lines; no `useEffect` that mirrors a prop into local state.

- [ ] **Step 1: Write failing tests**: `studio_scene_modules.test.mjs` asserts every file in `src/scene/` and `VisualEditor.tsx` is ≤250 lines and that no file under `src/` references `onData` or `graphTarget`; `usePreviewPlayer pauses audio when sceneId changes`; browser: scene drag-box commit still issues one `visual.command scene.patch` with `base_revision`.
- [ ] **Step 2: Run** `node tests/studio_scene_modules.test.mjs` → FAIL.
- [ ] **Step 3: Extract** modules one at a time (player → stage/overlay → inspector tabs → agent panel), running `studio_p34_visual.test.mjs` after each extraction.
- [ ] **Step 4: Run** all three test files → PASS; build.
- [ ] **Step 5: Commit** `refactor(studio): split VisualEditor into scene modules`.

### Task 13: Style consolidation, verification, handoff

**Files:** Modify `src/style.css` → `tokens.css` + `layout.css`; delete `voice-layout.css` overrides and unused dashboard rules; update `docs/superpowers/plans/2026-11-24-studio-graph-roadmap.md` status line and `2026-11-24-studio-graph-workspace-implementation.md` header (superseded); write `docs/audits/2026-11-25-studio-production-graph.md` with commands and results.

- [ ] **Step 1: Write failing check** `tests/studio_css_hygiene.test.mjs`: no selector with a repeated class (`.a.a`), `style.css` removed, every CSS file imported.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Consolidate** CSS; keep behaviour identical (screenshots at the four sizes compared with the Task 7/8 captures).
- [ ] **Step 4: Run full verification**: `python -m pytest tests/test_studio_pipeline_*.py tests/test_studio_p1_rpc.py tests/test_studio_project_evidence.py tests/test_studio_agent_authoring.py -q`; every `node tests/studio_*.mjs` test; `pnpm.cmd -C apps/zodiac-studio build`; `git diff --check`; native Tauri maximize/restore smoke when available. Record actual output in the audit; leave human listening/visual/video gates PENDING.
- [ ] **Step 5: Commit and push** `docs(studio): record production graph verification`; report commit and branch.

---

## Later (not in this plan)

In-app Phase 1 nodes (Evidence → Voice profile → Narrative → Narration → Content Review) as registry entries with the same agent/autopilot machinery; Job@5 ZIP handoff node for the legacy runner; audio mix node (roadmap R6); free node wiring is explicitly out of scope.

## Known risks (stated, not hidden)

- The agent's phone-size visual inspection needs a model that accepts images; if the configured model cannot, `inspect` reports structural frame checks only (contrast, bounds, contact from the compiler QA) and the gate says "Cần bạn xem trực tiếp". It never claims creative PASS.
- Cover and publish copy may not have Studio-native writers yet; those nodes stay `BLOCKED: Chưa hỗ trợ` until Task 6 wraps the plugin's `features/cover` and `features/publish`.
- Autonomy raises the cost of a bad proposal: every auto-applied proposal is one revision and undoable; autopilot stops after `max_attempts`.

## Self-Review

- Coverage: graph-as-production-flow (Tasks 1–3, 9–10), re-run/cache/staleness (2, 4), plugin Phase 2 duties by an agent (author 6, validate 5, assets/cover/publish/inspect 6, compile 4, repair loop 7), user-only gates (4, 7, 8), GUI refactor and always-visible preview (11, 12, 13), easy extension (1 manifest + 11 inspector fallback).
- Types: `PipelineEvidence`, `NodeStatus`, `NodeState`/`PipelineNode` field names match across Tasks 2, 3, 6, 7; node ids `content, voice, voice_review, timing, visual, scene:<id>, build, visual_review, export` consistent.
- Proportion: code blocks omitted in favour of signatures, test names and rules; each task names its failing test before implementation.
