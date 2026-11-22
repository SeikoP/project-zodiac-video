# Studio workflow: bounded initial agent authoring

Task 1 of [the approved workflow plan](../superpowers/plans/2026-11-20-studio-workflow-agent.md)
is technically complete. `agent.author.start` produces a bounded initial Visual
Intent proposal from verified narration, narrative plan, measured timing and the
existing asset catalog. The native host/RPC allowlists expose it. `agent.apply`
requires explicit confirmation, matching visual source/revision and matching
selected voice/timing. Initial authoring cannot replace an existing source.

Native text boards accept structured titles/lines and use the existing licensed
font as outlined SVG, including an explicit native right-arrow stroke. No model
SVG, arbitrary file path, shell or approval capability is accepted. The compiler
validates the complete source before commit. Apply rechecks voice dependencies
under the established visual→voice lock order, held through source mutation.
Task receipts retain real App Server thread/turn IDs and applied command IDs;
same-command retries remain idempotent.

The commit also includes previously pending compatible gallery/ideas/export and
TTS recovery code required by the current backend. Their original scoped evidence
is retained. Temporary design demos and all media/runtime stores remain outside Git.

Verification on 2026-11-22:

- `python -m unittest tests.test_studio_agent_authoring tests.test_studio_p1_agent tests.test_studio_p1_rpc tests.test_studio_p1_tauri_host tests.test_studio_p34_visual tests.test_studio_ideas tests.test_studio_p5_performance tests.test_studio_p5_transport tests.test_studio_p5_usage tests.test_studio_hyperframes_export tests.test_studio_p2_voice_lab -v`: **93 passed**, 482.039 seconds. Log: `.runtime/workflow-agent-e2e/backend-final.log`.
- `node --test tests/studio_p34_visual.test.mjs tests/studio_p5_assets.test.mjs tests/studio_hyperframes_export.test.mjs tests/studio_ideas_prompt.test.mjs`: **25 passed**. Log: `.runtime/workflow-agent-e2e/node-tests.log`.
- `python .runtime/studio_native.py cargo test --manifest-path src-tauri/Cargo.toml --lib --locked`: **2 passed**. The wrapper supplies this workstation's existing scoped SDK; use an installed Windows SDK on another machine. Log: `.runtime/workflow-agent-e2e/rust-tests.log`.
- Independent read-only review confirmed the apply-race repair and found no remaining Critical/Important issue in that repair. No production approval was granted.

Two actual initial-authoring failures exposed empty-chat and missing-arrow font
handling; both received regression checks. Failed/cancelled receipts are retained.
The replacement full native GUI acceptance is tracked separately in Task 3; this
backend receipt does not assert final MP4, listening or artistic acceptance.

Rollback only this task's code hunks. Preserve narration, handoffs, takes, authored
history, task receipts and immutable exports. No release, installer, publication
or production merge is part of this task.
