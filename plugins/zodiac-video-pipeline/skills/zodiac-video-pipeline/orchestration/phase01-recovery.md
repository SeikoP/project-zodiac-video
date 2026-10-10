# Phase 01 evidenced recovery and late hook review

This procedure is part of Phase 01 and not an additional phase. It does not bypass required manifest validators.

## Release-version consistency (before workspace recovery)
Check `plugin.json`, `.codex-plugin/plugin.json`, and `orchestration/pipeline-state.template.json` with `node orchestration/validate-release-consistency.mjs <plugin-root>`. If they differ, classify as **plugin orchestration release defect** (`RELEASE_VERSION_MISMATCH`), not an Evidence, Narration or Phase-02 failure. Never paper over mismatch by changing only the workspace `plugin_version`, rewriting receipts, or bumping the version without synchronizing the three source files. For future plugin edits, run `node orchestration/prepare-release.mjs X.Y.Z <plugin-root>` with an **explicit higher** version, then the release-consistency test suite before uploading the overlay; do not rely on automatic Plugin Creator patch bumps. Keep user-approved content byte-identical until a requested content change.

## Recovery trigger
When the user resumes Phase 01 with approved narration but missing `.authoring/pipeline-state.json`, do not restart creative work and do not immediately abandon recovery. Perform an inventory of narration files, user approval evidence, evidence/concept artifacts, validator receipts, and plugin source access. Record a recovery diagnostic listing exact missing inputs.

1. Preserve the precise approved narration and its approval message. Create a checksum snapshot of the actual narration bytes. Approval is evidence for *human review only*; it never implies validator PASS.
2. Restore canonical outputs (`evidence-ledger.json`, `evidence-summary.md`, `viral-analysis.json`, `reference-mechanics.json`, `narrative-plan.json`, `phase3-writer-brief.json`, `narration.txt`, `narrative-qc.json`, `story-spine-performance.json`) exclusively from observed source facts or genuinely reconstructed work. Do not invent past receipts, references or research. Preserve `character_deconstruction`/other approved story shape and hook selection. If files cannot be recovered, obtain actual fresh evidence and rebuild only the missing contracts. Newly generated contracts are marked as reconstructed, not prior PASS.
3. When source is unavailable, use the documented source transport recovery. A plugin connector read alone is NOT an on-disk source. Never claim to have run a validator based on reading its source.
4. After authentic on-disk source is available, run execution-preflight, validate/reconstruct state using canonical plugin version and *actual* history, and run all required Phase-01 validators through `run-validator-with-receipt.mjs` in manifest order. Record exit code, tool locator, input checksum and readable validator receipts.
5. If narration bytes changed, obtain fresh human approval. If narration is unchanged, preserve existing user review approval, but re-check the gates after required outputs and receipts exist. Do not set Phase 01 PASS unless validators and review gate pass.
6. Persist a single `.authoring/phase01-recovery-report.json` with `source_transport`, `approved_narration_sha256`, `artifact_inventory`, `missing_inputs`, `validators_executed`, `validator_receipts`, `approval_evidence`, and `status` (`READY`, `BLOCKED`, or `PASS`). No placeholder receipts.

## Authoring order and conditional Viral assistance
Determine story shape and Story Spine from evidence and character identity first. Draft and revise narration on those foundations. External Viral Analysis guidance may be consulted conditionally at Concept as editorial *guidance* if the manifest flag requires it, but it must not replace Story Spine or dictate the character arc. When requested by the user, review and A/B-select hooks *after the narrative core exists*, keep the story shape unchanged, and validate the final narration including the chosen hook. The Concept `viral-analysis.json` remains a provenance-bearing editorial artifact and does not certify that a hook test succeeded.

## Failure separation
Report plugin release mismatch, source transport, missing workspace contracts, state recovery, validator errors, and human review separately. Neither a missing state nor a transport failure belongs to Phase 02 by default.
