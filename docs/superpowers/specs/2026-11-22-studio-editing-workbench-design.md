# Studio editing workbench — design draft

Status: IMPLEMENTATION AUTHORIZED by user on 2026-11-23. Scene-based workbench first; original timing/order retained.

## Intent and approaches

The user finds the GUI confusing and selected a video editor with a large preview, timeline and editing tools. Opening an episode should reveal its video and useful next action. Preserve one window, approved story, measured voice and genuine approval gates.

1. **Scene-based workbench (recommended):** full-episode navigation timeline, large preview and contextual inspector, reusing existing edits, assets, voice, export and undo. This is a proposal, not confirmed detailed scope.
2. **Free-form NLE:** trimming, duration changes, reorder and layered editing. This requires new canonical timing/edit contracts and voice/caption re-anchoring beyond GUI refactoring.

The user authorized implementation after the recommended scene-based first delivery. Trimming/reordering remains future scope; approved narration and measured timing are preserved.

## Behavior

- Header: episode selector, meaningful save/build state, undo and `Xuất video`.
- Left: scene/resource browser; Ideas, progress and project management remain reachable through a compact library entry.
- Center: largest practical portrait preview, play/pause and timecode. Empty states explain the actual blocker and provide its next action: import, prepare voice/timing or request initial visuals.
- Right: properties of the selected scene/object, voice controls or agent proposal. Use Vietnamese labels; IDs, hashes, JSON and logs belong in details.
- Bottom: full-episode ruler, scene blocks, real measured voice and available captions. Scrub selects scene/local time; playback continues across boundaries. Never fabricate waveforms or unavailable tracks.
- One shared selection links timeline, preview and inspector. Switching panels preserves context, pauses hidden media and avoids duplicate polling.
- Agent request, proposal, apply/reject live beside the selected scene. Completion, application, build and human approval remain distinct.
- Assets come from the current catalog/candidate service with actual previews, fit/rejection reasons and provenance. Explain no-fit rather than substituting unrelated props.
- Export uses a contextual panel and plays the immutable output; genuine listening/visual/video approval stays separate.

## Constraints and acceptance

Reuse React/Tauri/Python and pinned HyperFrames. No new renderer, shadow catalog or credential store. Derive timeline from measured build intervals, not equal-width guessed durations. Fit 1366×768, 1060×650 and 1093×614 without document scrolling; allow bounded timeline panning/dock navigation.

Require real native import/open → voice/timing → initial agent/apply → scene edit/undo → whole-episode playback → export/playback → restart/reopen. Full E2E must include real TTS/ASR at least once; label reused-audio iterations separately. Verify encoded media and user-visible recovery, not screenshots alone. No release or artistic approval follows from technical tests.

## Agent and follow-ups

Current agent is a managed Codex App Server proposal worker with catalog/candidate context precomputed by Studio. A dynamic read-only resource/tool loop is separate work requiring an installed-protocol spike and explicit bounded contracts. No arbitrary shell/files/plugins or approval tools.

Review this design and trimming/reorder scope before implementation. Audio Library/Mix V2 and remaining P5/P6/P7 gates remain separate from the GUI refactor.
