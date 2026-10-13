# Deterministic workflow reliability — evidence status

PR #125 introduces dependency validation, duplicate-step detection, state transition checks, bounded repair recommendations and machine-readable trace without a second executor. Existing Phase 2 lease/checkpoint code remains owner.

Source: `phases/phase02/phase02-execute.mjs`, `core/workflow/deterministic-execution.mjs`, `features/visual-composition/write-phase02-authoring.mjs`. Cache reuse requires matching content-derived input and output signatures. Receipt is written before releasing the lease. Artifact writer verifies staging and committed bytes, with best-effort rollback on errors.

CI: https://github.com/SeikoP/project-zodiac-video/actions/runs/38437056778 — SUCCESS at integration merge SHA 63bfc62.

**Not yet verified:** actual process kill during multi-file rename and reconstruction; real concurrent desktop instance execution; stale lease owner recovery; TTS-related step replay; true all-or-nothing atomic commit across unrelated filesystem paths. Do not imply these tests have passed.

Escalate creative or environmental faults instead of auto-approving; bounded deterministic repair is only a proposal, not unbounded retry.
