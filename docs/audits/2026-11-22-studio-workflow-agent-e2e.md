# Nhân Mã: real agent authoring through the native GUI

The approved [workflow repair](../superpowers/specs/2026-11-20-studio-workflow-agent-design.md)
now has a complete technical GUI run. A real initial agent proposal was confirmed,
eight scenes were built, a real scene-agent patch was confirmed and rebuilt, and
a new full MP4 was exported and played through Tauri/Rust/Python/WebView2.
After restarting the native app, the applied task and exact MP4 were restored.
No external script authored visual source in this run.

This closes the technical workflow repair tasks, not the remaining production
quality gates of the broader roadmap. Listening, acting/model/palette acceptance
and final video review remain PENDING; `handoff_ready` remains false.

## Inputs and boundaries

The actual approved archive was `phase1-done/love-sincere-nhan-ma-phase1-handoff-v7.zip`
in the main checkout. It was imported through the native file dialog into the
isolated ignored `.runtime/workflow-agent-e2e/projects/` store. Project ID:
`studio-2b0c3a549a069efd273809f2`.

Fixture setup copied 34 existing real WAVs and their measured timing with exact
hash checks, preserving narration and all pending listening state. It copied no
visual source, build, export or human approval. The selected whole voice hash is
`e5f35bb23d0897bdf8a23fce95d03a7fdb203772eed82cbe2740f03806689394`.
This run does not claim newly generated TTS or a fresh ASR pass.

The initial source came from real task `9ab42cd670834eeea8de39ae1cf149a0`, followed
by the real scene edit `ff86ee3bdfbf4c09a5da4e528d173969`. Both retain App Server
thread/turn IDs, source dependencies and applied canonical command IDs in the
[machine-readable receipt](2026-11-22-studio-workflow-agent-e2e.json). Both writes
were confirmed with GUI controls, not fabricated by editing task receipts.
Earlier failed empty-chat/font proposals and a cancelled dev-restart task remain
in the isolated store. Those failures led to regression checks; they were not
relabeled successful.

## Persisted result

- [Review MP4](../../.runtime/workflow-agent-e2e/episode.mp4): **74.4 seconds,
  2,232 frames, 30 fps, 1080×1920 H.264/AAC**, 2,561,746 bytes.
- SHA-256: `012871b8ef9937181f441fe52d8925b9d700e1c9b84306726ae1c14b2962753f`.
- [Captions](../../.runtime/workflow-agent-e2e/captions.srt) and
  [cover](../../.runtime/workflow-agent-e2e/cover.png) match their immutable receipt;
  cover provenance binds the same encoded video SHA.
- Immutable export `29d4feff5c804ad3a8eb7c45837b7a13`, visual revision **2**.
- Full FFmpeg decoding passed. Native playback advanced with 1080×1920 / 74.4s
  before and after restarting. Playback was muted for automation, not listening review.

Measured GUI step timings from actual recorded start/end events:

| Step | Seconds |
| --- | ---: |
| Open real voice and measured timing | 31.519 |
| Initial agent proposal and GUI confirmation | 199.289 |
| Build episode and open actual preview | 14.385 |
| Agent scene edit, confirmation and rebuild | 24.172 |
| Whole MP4 export and native playback | 564.532 |
| Total with reused real voice | **833.897** |

The export uses one worker on this workstation. It is a measured technical
completion, not a fast-export or throughput claim. The cold voice snapshot was
separately measured at 25.454s; UI refreshes now apply backpressure and stop when
hidden. Backend audio-analysis startup optimization remains separate work.

## Verification and reproduction

Related backend checks passed **93 Python**, **25 Node** and **2 Rust** tests;
TypeScript and CRLF-aware diff checking passed. See the
[backend task receipt](2026-11-22-studio-workflow-agent-backend.md) and
[UI task receipt](2026-11-22-studio-workflow-ui.md) for commands and browser scopes.
Independent code review identified and verified fixes for the apply/timing race
and local MP4 readiness reset.

Start the dev app with `ZODIAC_STUDIO_PROJECTS` set to the isolated store and
`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9227`. Use the existing
Windows SDK/dev launcher; no release build is required. The actual GUI scripts are:

```powershell
# PLAYWRIGHT_MODULE points to an installed Playwright index.mjs.
# Fresh run: import the real approved episode and prepare/reuse validated real voice first.
node tests/studio_workflow_native.mjs
# Restart the dev app on that same store, then verify the prior run:
node tests/studio_workflow_native_reopen.mjs
```

The scripts operate visible controls and media elements, not backend APIs. They
never click human quality approval controls. Local evidence includes
`gui-evidence.json`, `reopen.json`, `voice-reuse.json`, `probe.json`, `decode.log`,
actual task receipts, native screenshots and an encoded-frame contact sheet.
Media stays ignored locally; code, instructions and these reports are pushed for
remote repair. Remote CI status is reported separately from local test success.

No release, installer, delivery ZIP, publication or merge into production was
performed. Original handoff, original Nhân Mã project/takes/export and unrelated
temporary demos remain intact. Remaining P5/P6/P7 human and broader roadmap tasks
are not silently completed by this technical run.
