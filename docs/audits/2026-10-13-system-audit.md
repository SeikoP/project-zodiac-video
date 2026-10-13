# System-wide Zodiac audit — 2026-10-13

Baseline: main `e656b690d68d660d95dc86593f715d6e572f9815`. Work is isolated in `audit/2026-10-13-pipeline-stabilization`. No source changes to main in this audit. GitHub Actions run: https://github.com/SeikoP/project-zodiac-video/actions/runs/38426544323.

## Evidence
- Python compile fails because an escaped newline was checked into the category table in `semantic_qc.py`.
- Renderer 2.0.1 test 46 fails: symbolic story object collision with caption is being skipped. New validation must still reject visible narrative entities colliding with captions.
- Plugin-native suite has 15 failed tests; see root-cause inventory for clustered failures. A green CI job is insufficient for video correctness.
- Control Plane failure is secondary to Python SyntaxError.

## Scope of current pass
Source review and CI for Python, renderer and selected plugin-native tests. No local repository checkout: network access for git clone is unavailable in the inspection container; changes are made through the GitHub connector on a separate branch. No local Node/pytest test execution against the complete checkout has occurred. No media rendering/GUI E2E has been performed.

## Risks
- Scene Plan gate may block legitimate fresh producer fixtures.
- Story symbol alias remains compatibility-only; legacy paths need real fixture coverage.
- New density count must be verified against frame-visible states and event transitions.
- Narration, TTS, audio tail, final MP4, GUI cancellation/resume and performance are not yet audited.

Status: **IN PROGRESS — NOT PRODUCTION READY**.
