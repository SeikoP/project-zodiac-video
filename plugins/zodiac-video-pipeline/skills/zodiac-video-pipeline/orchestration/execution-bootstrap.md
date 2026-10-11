# Execution bootstrap & recovery

Bootstrap is an execution prerequisite, not an extra phase or approval.

## Authority and source acquisition
Current user direction and genuine reviews govern the episode. The active installed plugin skill/router/manifests govern the workflow. Approved narration, plan, scope and pipeline-state govern this workspace. Downloaded code implements the pinned contract; its transport location grants no editorial authority. Never read repository prose as a replacement brief or import its sample episode. Source of truth must always name the object: workflow, episode or executable bytes.

Read the active skill first, then use an available local source root if verified. A skill:// read does not imply on-disk code. When code is unavailable, use the configured version-pinned GitHub source artifact directly; Plugin Creator is for inspecting/updating the plugin and is not a mandatory runtime download step. Do not spend a phase repeatedly attempting unavailable download routes. Record actual release version, commit/artifact identity and file hashes. A missing/stale artifact reports SOURCE_TRANSPORT_UNAVAILABLE or SOURCE_INTEGRITY_MISMATCH, not an invented local source.

## GitHub Actions source-artifact fallback
Configured repository: SeikoP/project-zodiac-video. Select the explicit branch/commit from release provenance; never assume main contains the active plugin. Retain current_release_id when it is available through maintenance inspection, plus the actual installed skill entry/version loaded in this run. Compare the artifact plugin.json, alternate manifest and state template; require the same release and verify loaded entry against source using verify-entry-freshness.mjs. A higher version number alone is not permission to change instruction authority.

Use authorized GitHub artifact listing/download to stage a real local ZIP. Verify ZIP integrity, safe paths (no traversal/absolute paths/symlinks), completeness and checksums. Extract into an isolated pinned directory, never over an approved episode. CI can upload an artifact when tests fail; availability is not a CI PASS. A stale/incomplete artifact blocks with SOURCE_INTEGRITY_MISMATCH. If this basic transport fails, report SOURCE_TRANSPORT_UNAVAILABLE with the actual command/path; do not retry identical signed URLs endlessly or change repositories silently. Updating the source mirror is a maintenance action, not an implicit requirement for a video run.

A monorepo may retain plugin guidance mirrors, implementation, contracts, tests and assets for development. The execution download should contain code plus the contracts, registries, native assets and release provenance that code requires. A code-only repository/archive is insufficient. Guidance copies exist for matching implementation/testing; they do not override the active plugin/user. Runtime bundles and production episode ZIPs are different artifacts.

## Phase 01 → Phase 02 handoff
Run phase02-transition-gate.mjs --workspace <workspace>. Its handoff_context carries exact source hashes, scope/Spine, compact creative_direction, approval references, contract ownership and the next action. Read that output before authoring; do not rely on remembered phase rules. It is read-only context, not a review receipt or serialized state.

Missing authoring inputs means AUTHORING_REQUIRED: author substantive inputs from approved narration, not placeholders. AUTHORING_READY means only inputs are present. A genuine prior Content Review should be recovered with its actual user_message proof and bound source hashes; never request it repeatedly because state was lost, and never fabricate it. A draft without genuine approval remains in review. Preserve approved narration bytes. Run execution-preflight.mjs <workspace> 02-visual-production --require-authoring-inputs, then phase02-execute.mjs --workspace <workspace> --source-root <verified-plugin-root> --run. Source, state and template versions must agree; migration is explicit and never creates approvals.

Native order remains Character Components → state asset plan before SVG → Character Assembly → identity/outfit validators → environment/bindings → scene direction/events/quality → publish prep and all active manifest gates. Execute real validators with run-validator-with-receipt.mjs. Keep no fabricated receipts. Native checkpoints invalidate on changed code, inputs or output hashes; NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED is not completed Phase2. Lease recovery requires evidence, not elapsed time.

## Review and release
Build/validate cumulative native endpoint previews from actual compiled SVGs and transforms, then obtain genuine user Visual Review. Contract tests, contact sheets and generated HTML do not prove creative quality or motion parity. Phase03 exports one reviewed Job@5 ZIP via run-phase03-production.mjs; approval/source seal and ZIP roundtrip remain mandatory. Phase 02 creates no official production ZIP. An explicitly requested diagnostic/checkpoint archive must be marked non-production and never substituted for a sealed handoff.

TTS, word timing, Remotion temporal preview, MP4/audio and rendered cover checks belong to the local runner after Job@5 import. Do not demand Remotion or measured audio before producer export. They are not producer export prerequisites. ZIP-ready is not video-ready. Preserve the existing archive on recovery; verified ZIP-bound receipts may reconcile state without publishing a second release. Report exact missing inputs and executed errors, rather than promoting receipts with stale hashes to PASS.

## Checksummed snapshot compatibility
Existing zodiac-plugin-source-snapshot@1 restoration remains supported: actual path/base64/sha256 entries, no reconstructed native assets; run build-source-snapshot.mjs then restore-plugin-source.mjs and preflight. A restore receipt proves transferred bytes only. If no host transport can stage them, stop with SOURCE_TRANSPORT_UNAVAILABLE. This maintenance route never changes episode approvals or active guidance authority.

### Final native source binding

After all three Phase 02 manifest steps have actually committed PASS, run `phase02-execute.mjs --workspace <episode> --source-root <plugin-root> --run --finalize-manifest` before sealing. This mode requires the same visual-intent source as the genuine prior native core receipt and all completed manifest steps; it verifies every non-production projection, validates strict state, forces native compilers/validators and Director review, then binds the final production hash. It returns `REVALIDATION_REQUIRED` at entry rather than granting PASS to compiler drift. Normal entry and seal still reject an unbound production hash. Do not edit receipts or adopt generated files merely to silence a drift gate.

## Unified repository and release mapping

SeikoP/project-zodiac-video owns both plugin and runner development source. The former plugin repository is retired. Publish the installed plugin from a reviewed commit, then record its plugin_version, plugin_release_id and source_commit in docs/zodiac-plugin-release.json. The archive's commit identifies the exact checked-out transport; the release record identifies the plugin source commit. They need not be the same commit when only documentation or release metadata changed. Require release version parity and retain both identifiers. The installed plugin and approved episode still govern execution; a repository download never imports approvals.
