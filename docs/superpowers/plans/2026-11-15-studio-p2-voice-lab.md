# P2 — complete Voice Lab slice

Base: `213a8c30`, branch `experiment/studio-v5-p2-20261115`.

User-directed execution: implement the entire phase before running the phase's verification suite; fix failures afterward. Do not run per-function/per-button test cycles or reopen design approvals.

1. Source-bound semantic speech units with exact UTF-8 ranges; reuse immutable VoiceArtifactStore, managed VieNeu synthesis and measured ASR. Keep technical validity, compatibility and explicit listening confirmation separate. Preserve prior takes and immutable narration.
2. Scoped project RPC and managed voice job lifecycle; waveform/playback, individual retakes, selected take, explicit per-unit/full-voice listening, intentional joins, measured words/anchors and diagnostics. Stale revisions/source drift reject writes; changing selected audio invalidates audio time maps, not SVG assets.
3. One integrated Voice Lab screen, real audio bytes, native allowlist and coherent status. After implementation, run the phase suite plus relevant legacy/P0/P1 regressions, TypeScript/native checks, real VieNeu/ASR and native-window smoke. Record human listening separately; automated fixtures cannot grant genuine creative approval.

No renderer migration, asset rewrite, release packaging, or unrelated plugin changes. Reuse P1 local SDK for native checks. Preserve production main and the experimental integration branch until the finished slice is verified.

## Phase receipt

Implementation state: **TESTED**. All P2 functionality is present. P3 can consume semantic unit IDs, exact approved UTF-8 ranges, immutable selected take hashes and `zodiac-speech-time-map@2` word anchors. Episode listening/creative acceptance remains a separate human action; the smoke fixture has synthetic content evidence and cannot approve production content.

Reused: `VoiceArtifactStore`, managed VieNeu batch worker, PCM concatenation/validation, existing V2 per-scene ASR cache, Project Registry, source locks, P1 RPC/native shell and pnpm lock. No dependency additions.

Verification on Windows, after the entire implementation:

- 140 Python tests passed in 93.106 seconds: P0/P1/P2 and relevant voice/timing/runner contracts. Command from repository root:
  `python -c "import unittest; l=unittest.TestLoader(); s=unittest.TestSuite(l.discover('tests',pattern=p) for p in ['test_studio_p*.py','test_studio_v2_voice.py','test_studio_v2_timing.py','test_zodiac_local_alignment.py','test_voice*.py','test_runner_modules.py']); r=unittest.TextTestRunner().run(s); raise SystemExit(not r.wasSuccessful())"`
- `pnpm install --frozen-lockfile` and `pnpm exec tsc --noEmit` passed in `apps/zodiac-studio`.
- `cargo check --locked`, `cargo test --locked` (one host allowlist test), and `cargo fmt -- --check` passed against `apps/zodiac-studio/src-tauri/Cargo.toml`, using the P1 local SDK environment.
- Actual VieNeu batch generated two units; a second take was generated for only one unit, preserving the other audio. Actual ASR mapped 14 words; first alignment 20.44 seconds, warm cache 0.51 seconds. Selected assembly is 2.88 seconds, SHA-256 `b6dcbd4211056307d8d34746caebae667bc35287b468f0675449858dc3bf6fb5`. Imported source hashes remained unchanged. Local receipt: `.runtime/p2-real-smoke/evidence.json`.
- Native WebView2 window loaded both actual WAV blobs (readyState 4), displayed measured waveforms, and played the full assembly to its `ended` event. Status remained `TECHNICAL_VALID`, with no listening approval written. Native screenshot: `.runtime/p2-native.png`.
- Fixed two Windows acceptance failures: deep ASR cache paths now use extended paths inside the worker; atomic state replacement retries transient reader sharing violations. Corrupt audio reports a typed repairable error. Cancellation kills the owned subprocess even when source validation subsequently fails.

Reproduce real smoke with a synthetic capsule produced by `tests/studio_phase1_synthetic_fixture.mjs <zip> valid <narration.txt>`. Import with `StudioProjectService`, call `voice.start` to generate, wait until the job completes, assemble, then align twice. The P2 unit suite demonstrates these exact service calls with deterministic audio. Real synthesis additionally requires the existing VieNeu installation and cached alignment model; do not treat the test capsule as genuine creative approval.

Not checked: human listening/prosody/junction acceptance, production episode E2E or remote CI. No release build/package generated. Rollback: revert the focused P2 commit; imported source bytes and old immutable takes are preserved. Production main is untouched.
