# Phase 3 — Production Handoff (plugin-owned)

Phase 03 remains **Assemble → Validate → Export** within the original three editorial phases. There is **one** production entrypoint: `orchestration/run-phase03-production.mjs`. Direct low-level `export-zodiac-job-v2.mjs` is a library/legacy test utility and MUST NOT be used as an unsealed production command. No TTS, MP4, Remotion or fake runtime evidence in the plugin.

Story Object V1: the source review fingerprint includes the authored metaphor/effect plan. Phase 03 rejects an opted-in missing or changed plan before staging; `validatePhase03Release` rechecks real object/effect event semantics. The plan is **never inside Job@5 ZIP**. Legacy approved source without the opt-in marker keeps old compatibility, not a false Story Object PASS.

## Mandatory sequence, fail closed before ZIP bytes

1. **Seal actual Visual Review:** After Phase-01 and Phase-02 both have real `APPROVED` `user_message` receipts and `PASS` state, run `node orchestration/seal-phase02-review.mjs <approved-authoring-workspace>`. It writes `.authoring/phase02-review-lock.json` outside ZIP, committing SHA-256 of narration, `production.json`, `design.md`, assets and publish metadata/copy. Missing approvals or changed inputs block.
2. **One-shot Phase 03:**

   `node orchestration/run-phase03-production.mjs --source-workspace <approved-authoring-workspace> --output-dir <output-dir> --sign "Bọ Cạp" --concept "Tên concept" --revision 1.0`

3. **Assemble:** Verify review lock before staging; copy only required files; compile Job@5 (`production.ir.json`, `design-token.json`, canonical `package-manifest.json`) with approved narration immutable and watermark `✦ bungmoto` / Patrick Hand. Existing motion boundary must PASS. Unsupported old runners remain BLOCKED rather than receiving aliased motion silently.
4. **Validate:** Mandatory checks include contract/schema/version and exact asset references, channel brand/font, source-to-IR scene/entity/action/spatial parity, ProductionModel round-trip, effect/prop spatial anchors and effect enter/release, 30,000 px² effect minimum / prop size, caption/voice identity, publish/cover integrity, runner import preflight, semantic animation P1=0. Asset and publish bytes must still match the Phase-02 approved fingerprint. Any mismatch **blocks before ZIP creation**.
5. **Export:** Build exactly one root-flat Job@5 ZIP into a private temporary location only AFTER preflight passes; verify CRC, Windows-safe filenames, exact byte round-trip and semantic QC on the real archive. Atomically move it to the output directory if all gates PASS. Never overwrite an earlier released ZIP. No extra packaging.
6. **Claim:** `PRODUCTION_READY_ZIP` means producer-ready-to-import, **not** `PRODUCTION_READY_VIDEO`. Local runner retains TTS, measured word/scene timing, actual Remotion frames, effect contact during playback, MP4, SFX/audio mixing, caption parity, watermark rendering, cover and end-tail acceptance.

Fix failures in approved source with a new Visual Review lock, **not** by mutating a staged ZIP. Never fabricate an approval, checksum, validator result, or runner receipt. A legacy video with missing spatial bindings or disabled watermark remains blocked until repaired and reviewed.

The manifest exposes owned substages, not three public export commands. Keep approved_source, review_lock and actual_review_receipts available through the production invocation. The entrypoint returns a ZIP-bound handoff receipt and attempts an atomic write under source .authoring/phase03-handoff-<zip-sha>.json (outside ZIP). WRITE_FAILED is explicitly reported; the returned receipt remains available for durable retry without another ZIP. Actual local import, TTS rhythm, measured timing, playback, cover/audio/end-tail checks remain PENDING until real runner evidence. Do not call them PASS from producer schema checks.
