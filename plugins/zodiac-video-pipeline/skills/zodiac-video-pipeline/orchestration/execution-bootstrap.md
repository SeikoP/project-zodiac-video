# Execution bootstrap & recovery — v2

This is an orchestration prerequisite, **not an additional phase** and not a validator substitute.

## Source acquisition
1. Read the installed skill and router; inspect the locally available skill root rather than assuming a `skill_read` result is a local file.
2. If local source files are missing, request the current plugin archive once. If archive transfer fails, use Plugin Creator `get_plugin_files` (inventory with `next_offset`, then `read_paths` of exact paths) to restore only text compiler dependencies and existing SVG assets needed by the current phase. Preserve plugin-root relative paths and bytes; never redraw a canonical asset and label it as plugin-native.
3. If restoration cannot faithfully reproduce required source/assets, set `BLOCKED: SOURCE_UNAVAILABLE`; do not endlessly retry the same download URL and do not fall back to independently authored HTML/SVG as an official preview.
4. Verify `plugin.json` version and root, ensure Node works, then run `node orchestration/execution-preflight.mjs <workspace> <phase>` inside the restored skill root. A `READY` preflight is environment readiness only.

## GitHub Actions source-artifact fallback (verified 2.2.23)

Use only **after** the current Plugin Creator archive transfer failed and connector-to-CAAS snapshot transport is unavailable. Do not claim GitHub is newer or trustworthy by repository name alone.

1. Confirm authenticated access to the exact configured source repository `SeikoP/video-pipelines` and its intended branch `main`; read the repository `plugin.json`, compare it with the installed Plugin Creator `plugin.version` and `current_release_id`. If versions differ, first synchronize the **exact current release** using Plugin Creator `get_plugin_files` inventory (all pages) and `read_paths` batches (<=20), pinned to one release. Preserve all source file bytes, original paths, and repo-only files; never destructively overwrite unknown user edits or push to unrelated repositories. Require explicit authorization to modify a different repository.
2. Run or wait for its GitHub Actions workflow `Zodiac Plugin CI` (push/dispatch), which uploads the named `zodiac-video-pipeline-source-snapshot` artifact. CI may upload this diagnostic artifact even when tests fail. Do **not** treat artifact availability as passing CI.
3. Use authorized GitHub connector artifact listing/download, such as `fetch_workflow_run_artifacts` then `download_workflow_artifact`, to transfer the ZIP into an **actual CAAS path**. Verify ZIP integrity and a safe member list (no absolute paths/traversal/symlinks), check the root `plugin.json`, `.codex-plugin/plugin.json` and state template are identical version, and compare the full plugin-source inventory with Plugin Creator. If the source is stale, incomplete, or unverified, stop with `SOURCE_INTEGRITY_MISMATCH`.
4. Extract into an isolated version-pinned directory, never over the approved workspace. Run `validate-release-consistency.mjs`, then `execution-preflight.mjs`, restore evidenced state and execute the native validators/compilers with receipts. Failed CI tests must be recorded and assessed independently; no visual or handoff PASS until required active gates and human review pass.
5. If GitHub access/artifact delivery fails, keep `SOURCE_TRANSPORT_UNAVAILABLE` rather than fabricating a source snapshot. Do not retry identical failed signed download links indefinitely.

This is an **alternative source transport**, not a new workflow phase, production proof, or replacement for runtime QC.

## Workspace recovery
- Preserve existing approved narration, tracker and authoring files. Reconstruct state only from genuine recorded operations and review approvals; never infer approvals, emit fake receipts, or set prior steps PASS based on filenames alone.
- A missing `.authoring/pipeline-state.json` is a BLOCKER. If state template is copied, replace only placeholders and verify the template version matches `plugin.json`; validate with `validate-pipeline-state.mjs` before advancing.
- Re-run failed/missing compilers and validators via manifest order, with `run-validator-with-receipt.mjs`. Do not continue if source, inputs, dependencies or authorization remain unresolved.
- Preserve `run_mode=fresh` when a tracker is supplied without explicit artifact continuation; do not inject old creative content.

## Visual review & local runner handoff ownership
- Phase 02 reviews native compiled SVGs, entity/layout/role/prop/effect semantics, native validator receipts and Publish Prep; user approval is sufficient for the *native visual-design review gate*. Build and validate two-endpoint native event previews for every scene event using `orchestration/build-native-preview-pairs.mjs` and `orchestration/validate-native-preview-pairs.mjs`; artifacts live under `.authoring/preview-pairs/` and must match current production SHA-256. Static contact sheets may assist inspection only when built from those exact compiled assets/coordinates; an independently authored HTML mock or replacement asset never proves native compilation. This generated HTML is source-backed inspection evidence, not proof of rendered motion/timing.
- Phase 03 consumes only the approved authoring data, exports one Job@5 ZIP and validates `LOCAL_RUNNER_IMPORT_READY`. The producer must not demand audio, word timing, Remotion preview, frame timings, MP4 or final cover rendering before export.
- After local import, the runner owns voice, measured timing, render-plan resolution, Remotion Studio/stills, video/audio/cover output and preview-to-final parity. Inspect opening/middle/end, event transitions and last word **in the runner**, not in Phase 02. Never invent a renderer receipt or claim a finished-video PASS for a producer ZIP.
- No Phase 2 ZIP: ZIP is owned exclusively by Phase 3 Export. Do not change the series tracker until ZIP_READY.

## Failure reporting
Provide the exact failed source path, command, exit code and receipt or log path. Distinguish download transport errors, authorization errors, absent workspace input, contract validation errors and renderer failures. A missing capability may never silently downgrade to success.

## Executable source restore (2.2.5)
- This plugin has no direct bridge from Plugin Creator connector results to the CAAS filesystem. Reading `get_plugin_files` alone **does not create local files**. Never imply otherwise.
- An orchestrator with connector + filesystem access must create a `zodiac-plugin-source-snapshot@1` JSON file from the exact `get_plugin_files` returned UTF-8 contents and archive-provided binary bytes. Every entry has `path`, canonical `base64`, and lowercase `sha256`. Include exact `plugin.json` and version. For bundled binary SVG, obtain the actual bytes; do not reconstruct or replace them.
- Transfer or stage this JSON in CAAS using an actual file-capable host path. Run `node orchestration/restore-plugin-source.mjs --source /path/to/snapshot.json --target /path/to/recovery-root [--dry-run]` from the currently available plugin tools. It rejects traversal, bad checksums, wrong plugin identity/version, and unsafe destination links. It emits `source-restore-receipt.json`, which proves bytes restored, **not** compiler correctness.
- If no snapshot can be staged, report `SOURCE_TRANSPORT_UNAVAILABLE` and stop. Do not repeatedly query the same archive or construct a fake placeholder plugin tree.
- Then run source preflight on restored root, restore genuinely evidenced workspace state separately, and run **all** phase compilers/validators in prescribed order. The restore receipt never substitutes for `compiler_result` or `validator_result`.
- This is a generic source restoration facility, not an automatic Plugin Creator download or a self-healing render.

## Plugin Creator connector bridge (2.2.6)
The connector and CAAS do not share an automatic file API. An orchestrator with an authorized host file-transfer capability MUST: (1) fetch the complete inventory using `get_plugin_files` and `next_offset`; (2) fetch exact `read_paths` in batches of at most 20, pinned to a single current_release_id; (3) stage the unmodified results as `{ "pages": [<tool result objects>] }`; (4) run `node orchestration/build-source-snapshot.mjs --input staged.json --output snapshot.json --require-complete`; (5) run `restore-plugin-source.mjs --source snapshot.json --target restored-root`; (6) execute preflight. If there is no file transfer, return `SOURCE_TRANSPORT_UNAVAILABLE` without claiming a bridge is operational. All requests must return real source, not regenerated equivalents. Native SVGs that are UTF-8 can be read as exact text when the API returns them intact.


## Phase 02 native execution + checkpoint recovery (2.2.9)

The preferred local entrypoint after a **verified on-disk** source is `node orchestration/phase02-execute.mjs --workspace <absolute-path> --source-root <plugin-root> --run`.

- Inspect first without `--run` to get exact `SOURCE_UNAVAILABLE`, workspace-input or state failures. Never equate skill-read text with local source. If transport cannot stage real bytes, this remains `BLOCKED: SOURCE_TRANSPORT_UNAVAILABLE`; the plugin cannot itself break the connector/CAAS boundary.
- If a source snapshot has already been staged by an authorized host, use `--snapshot <snapshot.json> --restore-target <plugin-root>`; `restore-plugin-source.mjs` verifies identity, checksums and paths before native execution.
- Confirm plugin version == state-template version == existing pipeline state version. No auto-invention of approvals when state is absent. Keep approved narration and published metadata intact.
- Native order is Character Components → Character Plan (`--plan-only`) → Character Assembly (`--write`) → Character Identity & Outfit validators → Environment + binding validator → Scene Direction & validator → Scene Events → Visual Quality → Publish Prep. Execute validators with `run-validator-with-receipt.mjs`; hold on first real failure.
- Checkpoints are **additional evidence** and must be invalidated if compiler source, authoring inputs or expected output hashes change. They are not pipeline-state gate receipts by themselves and cannot mark human reviews PASS. `--force` re-runs everything from first step; do not use it to bypass a blocking validator.
- Source bootstrap is a technical prerequisite, not a new phase, new sub-agent, separate ZIP or visual mock. `NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED` never means a completed Phase 02: execute all remaining native manifest gates, produce/validate all event preview pairs, and obtain explicit human approval of the native design before `PASS`. Do not wait for renderer-faithful preview; this is a local runner operation after Phase 03 Job@5 import.
