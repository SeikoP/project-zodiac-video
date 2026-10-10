# B1 transition gate — Phase 01 → Phase 02

Run `node orchestration/phase02-transition-gate.mjs --workspace <workspace>` on a real, version-pinned skill source before starting native compilers.

- `BLOCKED` (exit 2): missing real Content approval, invalid phase state/version, invalid JSON or source. Do not substitute phase label PASS, dummy files or fabricated review proof.
- `AUTHORING_REQUIRED` (exit 0): approved narration is available, but original Phase 02 authoring inputs are missing. Author the missing files using the approved narration and the current schemas/director/casting/visual instructions. Never copy a generic empty template, and never move their responsibility to Phase 01.
- `AUTHORING_READY` (exit 0): files exist, parse, and production has scenes. Run `execution-preflight.mjs <workspace> 02-visual-production --require-authoring-inputs`, then `phase02-execute.mjs --workspace <workspace> --run`. READY does not imply native compile, schema, creative review, or manifest PASS.

The gate has no side effects; it prints hashes for review and must run again when any input changes. Preserve the existing three phases, approval provenance, and revision semantics. Do not use this gate as evidence of completed Visual Review or Remotion playback.


## Phase02 evidence reconciliation (v2.4.22)
After native steps and manifest recording, run `node orchestration/phase02-evidence-audit.mjs --workspace <workspace>` BEFORE `seal-phase02-review.mjs`. The read-only audit reports missing manifest steps, capability receipts, operations, outputs, gate results, version-drifted native checkpoints and genuine Visual Review approval. An `EVIDENCE_READY_FOR_STRICT_VALIDATOR` result is only a precondition: independently run `validate-pipeline-state.mjs` and existing seal/lock checks; never turn audit readiness into PASS or manufacture evidence. If files or approvals are missing, perform real manifest steps and record actual outputs, not placeholders. This makes H32 defects observable but does not claim autonomous receipt generation.
