# Follow-up Remotion → HyperFrames: media contract + E2E (2026-11-22)

## Context
- Branch: `experiment/main-2`, initial head `ffbf815c`. Keep pre-existing dirty worktree intact; do not auto-commit/merge/push.
- Prior audit: `docs/audits/2026-11-22-remotion-to-hyperframes-handoff-audit.md`.
- Real fixture: approved Nhân Mã Visual Intent revision 4, 8 scenes, 74.4s. No user-supplied BGM/SFX, no authored Remotion cover opening in this episode.
- Important distinction: **renderer frame parity does not imply cover/audio feature parity**. Previous comparison: 114/114 fixture images pixel-matched; human visual/audio approval remains NOT_GRANTED.

## Bugs addressed
1. **HF-10 silent cover metadata loss**: the old guard rejected only `publish.cover.opening.enabled=true`; cover hook, design, visuals or identity without enabled opening could silently be dropped by the exporter. `validateIntent` now rejects any nonempty `publish.cover` with `VISUAL_COVER_DESIGN_UNSUPPORTED`, retaining the targeted `VISUAL_COVER_OPENING_UNSUPPORTED` for enabled opening. Synthetic regression covers both.
2. **HF-11 silent audio track loss**: the old path always did FFmpeg `voice.wav` mux and would ignore a supplied legacy `audio`, `audio_mix`, `music`, `background_music`, `soundtrack` or `sfx` field. `validateIntent` now fails with `VISUAL_AUDIO_MIX_UNSUPPORTED` rather than exporting voice-only under a false feature parity claim. Regression tests cover representative payloads.
3. **HF-12 ambiguous export receipt**: `visual_export.mjs` emits `audio_contract={mode:'approved-voice-only@1', voice_sha256, music_tracks:0, sfx_tracks:0}` and `cover_contract={mode:'first-encoded-video-frame@1'}`. Python `_render_export` verifies both before committing the export, and `cover.source_frame=0` is retained.
4. **HF-13 compiler cache policy change**: `visual_contract.json` advanced to `zodiac-visual-presentation@3` with explicit legacy media / audio rules, invalidating earlier builds that did not record these constraints. The user's old revision-4 MP4 is preserved but not adopted as new build evidence.

## Tests already executed
- 16/16 Node tests PASS across caption contract, HyperFrames export and renderer migration tests (including new media guard tests).
- Rebuilt actual Nhân Mã revision 4, 8/8 scenes, build `380ae999e38243d3b7be35d1f562b3d7`, `stale_preview=false`, `renderer_parity=NOT_ASSERTED`, `human_approval=NOT_GRANTED`.
- Scenes S03/S04/S06 remain `ACTING_BEATS_SPARSE`, an advisory artistic warning; no false creative PASS.
- Independent media export + full decode / first-frame cover pixels / SRT text visibility still gated on the current E2E export receipt.

## Feature migration still missing (do not silently mark complete)
- **Remotion cover opening**: `ZodiacCover.tsx` supports hook, identity, composition, selected character/prop visuals and a timed overlay that keeps narration starting frame zero. HyperFrames has no equivalent validated cover-painter and publish manifest yet. Do not copy only the thumbnail and claim cover parity. Future implementation must bind cover source assets, share caption-over-overlay timing, validate special design constraints, and perform Remotion/HyperFrames screenshot parity before removing the guard.
- **BGM/SFX creative mix**: Studio v2 supported optional music with `amix` at default volume 0.2; the current V5 exporter has no audio asset/rightsholder registry, no music/SFX source hashes, no time-aligned SFX timeline and no independent mix review. Proposed separate downstream `AUDIO_MIX` DAG node so changes in gain/music never trigger TTS regeneration or visual rerender. Inputs should be content-addressed, license/provenance checked; voice and BGM gain/ducking should be explicit; audit loudness/peaks/channel count and A/V duration. The existing Garden live SFX pack is unrelated and must not be implicitly reused in zodiac videos.
- **Creative performance**: eliminating text boards left sparse actor action in three scenes; this is not a renderer parity mismatch. Must be improved by adding grounded props/gestures and intentional state transitions, then human review of the final MP4.

## No false completion
- A new media receipt is technical evidence, not human approval.
- Keep old MP4 and immutable receipts; copy the corrected export to a separate `.runtime/audit-hyperframes-20261122-fixed/` folder.
- Do not run older Remotion output as a fallback when HyperFrames policy rejects an unsupported feature.

## Evidence after real full export
- Corrected actual build: `380ae999e38243d3b7be35d1f562b3d7`, revision 4, 8 scenes.
- Native HyperFrames CLI + FFmpeg mux export **COMPLETED**: export ID `2dc9433980ac494fb5e5caa236cb9c19`; separate review output `.runtime/audit-hyperframes-20261122-fixed/episode.mp4`. H.264 1080×1920, AAC voice, 74.4s, 4,458,625 bytes, SHA-256 `d8c8fbfb3d3f4cc1ed9e889a1df2ed482355266318481b5bfaa6c24b9ee4decc`.
- Independent whole-file FFmpeg decode PASS, SRT 38 contiguous cues; no overlaps or cue gaps. Pixel-exact cover (first encoded video frame) confirmed by fresh independent FFmpeg extraction.
- At 67.7, 68.0, 68.5, 70.2 and 72.2s, caption-lane pixel presence test PASS. The formerly missing caption at 68.0s was observed in an actual decoded MP4 frame. Independent artifact: `.runtime/audit-hyperframes-20261122-fixed/media-qa.json`; receipt and export evidence: `audit-export.json`, `receipt.json`.
- The GUI receipt section now shows explicitly `approved-voice-only@1` / 0 music / 0 SFX and cover provenance when present. Legacy exports with no such contract are marked unverified by UI instead of silently gaining new labels. Frontend TypeScript/Vite build PASS.
- Human review remains PENDING and no MP4 was automatically approved. The current first-frame cover is *not* equivalent to a designed hook/identity overlay; this remains a separate feature gap.
- GUI smoke after showing media provenance in `EpisodeExport.tsx`: `pnpm.cmd -C apps/zodiac-studio build` PASS; `tests/studio_compact_layout.mjs` PASS (3 viewports), `tests/studio_ideas_browser.mjs` PASS (review/MP4 playback/approval fixture routes, 3 viewports). Vite test server stopped afterward. This is browser+fixture regression, **not** a new native Tauri GUI E2E.
- Git diff whitespace check PASS. All changes remain local on `experiment/main-2`, uncommitted, with unrelated existing dirty files preserved.
