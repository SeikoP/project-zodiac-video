# Nhân Mã v7 — real Studio E2E

Input: `phase1-done/love-sincere-nhan-ma-phase1-handoff-v7.zip` in the
main checkout. The Studio importer verified its actual Content Review and
frozen bytes. Project: `studio-2b0c3a549a069efd273809f2`, under this worktree's
ignored `.runtime/nhanma-e2e/projects/`. No synthetic approval or test tone was
used for this episode.

The real path runs through Project Core import, 32 VieNeu speech units using
`cuongdepzai`, selected take assembly, measured ASR, canonical Visual Intent
commands, an eight-scene V4/HyperFrames build, actual HyperFrames capture,
FFmpeg mux/probe, persisted MP4 and native WebView2 playback. Source narration
and original handoff remain unchanged. The two actors retain their native
identity; the chat comparison implements the approved story point, with
voice-anchored setup/reaction states and outlined Vietnamese lettering.

## Repairs and missing outputs

- TTS previously remained at 0/32 while the direct engine had saved completed
  WAVs. Both direct and Gradio paths now report the same completed-unit marker.
- A failed batch previously left completed WAVs outside selected Voice Lab
  takes, so retry regenerated them. Valid partial results now commit together
  with `REVIEW`; retry generates only missing units. Truncated/silent outputs
  are excluded; cancellation cannot select late work. A failing regression
  reproduced the loss before the fix.
- New review exports write `captions.srt` from the measured global word ranges,
  keeping Vietnamese source and six-word groups consistent with the painter.
  A second test checks cue numbering/timing across scene boundaries.
- New exports extract `cover.png` from the encoded video, with its video SHA
  and both output hashes in the immutable receipt. A cover is a review
  candidate, not a creative approval.
- Encoded-frame review and HyperFrames checks exposed captions below platform
  safe areas. A 320 px bottom-inset trial still failed the pinned CLI's stricter
  social presets. Both preview and whole-episode export now use the clear
  lane at y=740 between the chat board and actors, with matching occlusion QA.
  The episode was rebuilt and checked before encoding again; the previous MP4
  was retained and intermediate exports cancelled before starting the final
  export through the real Rust/Python native transport.

## Verification

Final immutable export: `28f82ad177cb4589b27655fd23b281d4`, visual revision 4.
The [persistent review MP4](../../.runtime/nhanma-e2e/episode.mp4) has 2,232 frames,
30 fps, 74.4 s, 1080×1920 H.264/AAC and 2,738,324 bytes; SHA-256
`490690d1368825465ddf125078c643d820c7b70f657f6a45d3ab43251bf65c91`.
Its [63-cue SRT](../../.runtime/nhanma-e2e/captions.srt) retains every approved
source word in order, and [cover](../../.runtime/nhanma-e2e/cover.png) is a verified
1080×1920 PNG from that same MP4. Full video decoding passed. The final actual
HyperFrames check reported zero runtime errors and zero layout/safe-area warnings.

Fresh checks: 19 Voice Lab tests, 33 related Python regression tests, 11 export
tests rerun after sidecar changes, 16 Node tests, TypeScript and CRLF-aware diff
checking passed. Counts overlap where an export suite was rerun. A real native
single-unit retake completed while retaining the original selected WAV and
measured timing hashes. Native final playback advanced with the exact final
video SHA, `stale=false`, 1080×1920 and 74.4 s; evidence is
`.runtime/nhanma-e2e/native-playback-final.json`.

The machine-readable companion receipt records final output paths/hashes and
test logs. Local scripts/logs and captures remain in `.runtime/nhanma-e2e/`.
The dev app uses that same actual project store, rather than mock UI transport.
Native playback decoded 1080×1920 video with duration 74.4 seconds; playback
was muted for automation and is not a listening review. Extracted encoded
frames were inspected for Vietnamese lettering, cast continuity, story-board
changes, caption clearance and reaction states.
The non-strict CLI retains structural/reused-media warnings and speech-rate
reading heuristics; its composition audio warning precedes the separately
verified AAC mux. These warnings were not relabeled as human artistic PASS.

Reopen locally with `ZODIAC_STUDIO_PROJECTS` pointing at the directory above,
then `.runtime/run-main2.cmd`. In Visual Workspace use **Xem MP4 đã xuất**.
The MP4, SRT, cover and receipt live together in the immutable export folder.
The original healthy export remains available when a later export runs.

## Roadmap boundary

This exercises the real P2 → P3/P4 → P7 technical path and supplies the missing
review sidecars. It does not close P5/P6/P7 human gates. Voice/listening,
scene performance and final video approval remain PENDING. The work uses
story-board graphics rather than asserting untested physical phone/hand
contact; phone geometry/palette approvals, full physical interaction authoring,
reviewed history and licensed Audio V2 library/mixing remain on their owning
roadmap tasks. Voice-only audio is deliberate; no third-party audio was added.

No release build, installer, delivery ZIP, publication, concept completion,
commit, push or remote CI was requested/performed. Existing dirty work and
original media remain intact. Roll back only this slice's TTS progress/recovery
and export-sidecar hunks plus their tests/docs; retain episode source, takes
and immutable output folders. Full agent/authoring E2E wall time was not
instrumented, so it is recorded as null rather than inferred from file dates.
