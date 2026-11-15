# Studio V5 combined P3/P4 technical acceptance

The experimental native app now builds canonical Visual Intent through the shared V4 compiler/cache and edits actual source-mapped HyperFrames compositions. Revisioned commands, undo/redo, measured voice anchors, constrained candidates, scoped Codex proposals, cancellation and last-good publication share the Python command owner. Production `main`, original narration and existing WAV files are unchanged.

Machine-readable results: [acceptance.json](2026-11-15-studio-p34-acceptance.json). Implementation plan and rulings: [combined plan](../superpowers/plans/2026-11-15-studio-p34-build-editor.md).

## Verification

- Node P3/P4: 11/11, including the actual pinned SDK edit/serialization API, tamper recovery, exact anchors, frame contacts and source-backed Libra/Gemini/Scorpio compatibility.
- Python affected suite: 48/48 in 82.443 seconds, including Windows long paths/lock contention, ownership, source transactions, interruption, undo, drift, agent scope and private preview boundaries. Prior P0/P1/P2/voice/timing/Job5 regression suite: 117/117; affected cases rerun after shared helper changes.
- TypeScript/Vite build, locked Rust check, Rust host test and formatting passed locally. The Windows workflow now runs P3/P4 tests after installing the pinned frontend dependencies. Remote CI is a separate result.
- Actual Tauri/WebView2: SVG actor/phone loaded, real SDK selection/style API, semantic inspector move, scene-only invalidation, light/dark and undo, actual GSAP state reveal and WAV metadata verified. Native Codex produced a scoped scene patch; applying it changed revision 13 to 14 without changing voice bytes. Automated application used synthetic content and grants no human creative approval.
- Frontend fault injection restored the last good preview after cancellation and cleared preview when no valid fallback existed or source revision changed. Python recovery tests cover reopening and live/dead worker ownership.

One independent review found no Critical and four Important issues: missing exact anchors fell forward, frame contacts were ignored, progressive preview could remain stale, and a second reader could misclassify a live owner. All were fixed with regression checks. No second review pass was used.

## Performance scope

The isolated service fixture has eight scenes with a real existing 2.88-second WAV and measured ASR. Observed cold/warm/scene/theme/shared-character builds were 3222/2829/3009/3118/3310 ms, with reused/rebuilt nodes 0/18, 18/0, 16/2, 10/8 and 1/17. These include Python service, process and publication overhead. Narration/audio hashes remained unchanged.

A second compiler-only run uses the existing `songtu-bi-tuong-doi-phe` narration, 48.56-second WAV and 244 measured words across eight scenes. Every legacy caption token exactly matches its sequential source token before adapting byte ranges; existing absolute ASR milliseconds remain unchanged. Current visual artwork is an explicitly synthetic technical fixture, not a rewrite of that episode's approved cast or staging. Cold/warm measured 920/741 ms. Scene/theme/shared-character cases and CPU/RSS/disk/output bytes are in the JSON receipt. Do not compare compiler-only latency directly with service latency.

These measure visual build/cache behavior, not production episode throughput. Authoring, TTS/ASR generation, final rendering/encoding and human review are excluded. Reproduce service measurements with `python -m tools.studio_project.benchmark_visual --help`, an approved source capsule, its matching measured Voice Lab workspace and an isolated output root; the helper rejects source/audio mismatches and verifies unchanged hashes.

## Compatibility and acceptance boundaries

Libra's three exact historical balance SVG blobs are frozen with commit/blob/hash provenance under `tests/fixtures/studio-p34-legacy/libra/`; they are not restored to the current catalog. Gemini/Scorpio tests preserve existing baked SVGs and compare state endpoints with the pinned V4 resolver. Unsupported old motion is explicitly `LEGACY_STATE_ENDPOINTS_ONLY`, not production renderer parity.

Light/dark checks are technical prototypes. Human visual acceptance, human listening, artistic narrative/reaction quality and full renderer parity are **not granted**. Final encoding, audio mixing and packaging belong to later phases. No release installer or MP4 is claimed by this delivery.

## Integration and remote CI

[PR #225](https://github.com/SeikoP/project-zodiac-video/pull/225) merged to `experiment/main-2` as `28e4f3f86160accd4db1201de0bb404f67ca60d6`. A single native app then opened using that checkout's frontend and Python source. Native edit/theme/undo/actual SVG checks passed again; selected source was current with eight completed scenes. Voice Lab displayed the user's existing `cuongdepzai` and `cuongdepzaiver2` presets and preferred the former without changing old takes.

Initial PR CI found two integration setup defects: Linux's full Python discovery lacked the pinned Studio dependencies, and Windows Git converted LF in the hash-frozen narration/SVG fixtures to CRLF. The follow-up adds locked pnpm installation to the Linux job and marks only those byte-sensitive fixtures `-text`; validators retain exact byte checks. The unrelated plugin-native job has 40 baseline failures. Renderer/control-plane/live/frame-progress/integrity jobs passed. Remote results remain separate from local validation.
