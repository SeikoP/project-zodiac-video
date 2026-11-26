# Studio package and GUI review, 2026-11-26

## Actual package

Native Tauri Preview running this worktree's Vite source, backed by
`%APPDATA%/com.bungmoto.zodiac.studio.preview/projects`.

- Episode: **Nhân Mã bảo không thiên vị. Hội bạn thử một lần là biết.**
- Project: `studio-2b0c3a549a069efd273809f2`; visual revision 1.
- Build: `765187734ac649d887bbbb987c4821c6`; eight scenes, approximately 86.7 s.
- Initial state: content and voice approved, build/checks/inspect done,
  visual_review AWAITING_USER, export PENDING. Preview was current.
- A real GUI review receipt subsequently appeared at 20:06:52 +07:00 for this
  build/source. These automation scripts never clicked its confirmation button.
  This is distinct from fixture-only confirmation tests. No final MP4 approval
  or publication was performed by this task.

## Cause and changes

Review lived inside the scene inspector, which whole-video mode hides. Its
start button only issued a token; it did not open playback. A broad CSS rule
also hid the whole-video transport, and the player's fixed height overflowed.

Review now has its own full stage: whole-episode playback beside user controls.
Its row lives outside collapsed technical steps. Opening the panel issues no
playback token; successful audio playback does. The ten-second backend rule is
retained and explained with a countdown. Changing build/revision/project/status
remounts the review session. Mismatched audio and failed previews cannot enable
confirmation. Blocked review names its prerequisite steps.

Technical source controls, revision, cache/renderer statistics and logs are
hidden by default. Core editing and undo/redo remain. Whole-video controls fit
the window and remain visible. Leaving the editor unmounts its player and pauses
its captured audio element, preventing overlapping hidden playback.

Included dependencies: the existing local whole-episode cache and player/editor
seek/autoplay work, required by the review player and the hidden-playback fix.
Unrelated VoiceLab, backend type additions, style titlebar tweak, voice approval,
agent_bridge and zodiac_local edits are preserved outside this commit.

## Verification

- Red: new browser regression timed out on the hidden visual_review row before
  implementation.
- `pnpm build` in apps/zodiac-studio: PASS; existing large SDK chunk and recast/os
  browser-externalization warnings remain.
- Node: preview cache, pipeline layout/store and playback clock: **24 passed**.
- Pytest: pipeline review and RPC: **32 passed**.
- `studio_visual_review_browser.mjs`: PASS, including playback registration,
  minimum delay, explicit fixture confirmation, build reset, audio mismatch,
  preview failure, prerequisite explanation, quiet toolbar and hidden audio stop.
- `studio_pipeline_browser.mjs`: PASS, including four window sizes.
- `studio_compact_layout.mjs`: PASS, including three window sizes, editor tabs,
  source/log overlays, navigation and voice selection. Updated stale selectors to
  the existing Nâng cao tab rather than removed Sự kiện/Hình ảnh tabs.
- Review checked at 1366x768, 1060x650, 1093x614 and 800x960. Page does not scroll;
  preview, playback controls and confirmation remain inside the viewport.
- Native Tauri + Rust/Python transport: real composition timeline advanced to
  3.75 s, real caption/actors rendered, no captured page/console errors. Paused
  after checking; no approval click. Sampled real frames at 7/18/29/40/51/62/73/84 s.
- Self-review only; no independent reviewer or remote CI run.

## Visual observations and limits

Actor identities and Vietnamese captions are legible in sampled frames. Several
later scenes repeat a similar two-person arrangement with substantial empty
space; the comparison artwork at 18 s and route diagram at 40 s need phone-size
creative review. The 7 s sample is in a transition and contains overlapping
outgoing/incoming actors. These observations are not approval or a media rewrite.
An existing s02 owner card about STORY_VISUAL_PHASE1_ORIGIN_REQUIRED was present;
this GUI task did not silently dismiss it or change package source.

## Local artifacts (media intentionally not committed)

- `tmp/studio-visual-review/native-review-playing.png`
  SHA256 `d11e5319fea626abfc066a2b11e7ee58c87b8fc637942c277bc0ff3a30b05fca`
- `tmp/studio-visual-review/package-contact-sheet.jpg`
  SHA256 `ddc6f18bf3519bfa9eea68cfbe8b69e90f7ac4d50841dcec2c4b30c8ef3be8c6`
- `tmp/studio-visual-review/native-result.json`
  SHA256 `2f4c5f40258f80a68027bdbef994fd31720b2734c4a540336e3065b1de0fd015`

Reproduce fixture checks with PLAYWRIGHT_MODULE pointing to a local
playwright-core/index.mjs, STUDIO_BROWSER to Chromium, and Vite on 127.0.0.1:1420.
Native inspection used a loopback-only WebView debug endpoint at 127.0.0.1:9227.
