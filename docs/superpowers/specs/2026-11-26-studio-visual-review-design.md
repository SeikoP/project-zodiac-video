# Visible visual review and quieter Studio

Approved in the conversation on 2026-11-26: preview and timeline are primary,
visual review stays easy to find, technical controls move under technical details.

The current Nhân Mã package has eight built scenes and visual_review is
AWAITING_USER. Review disappears because whole-video mode hides the editor's
inspector. The review-start button currently issues a token without opening playback.

Approaches: keep review in the editor sidebar, or give review its own stage using
the existing whole-episode player. Use the latter: review controls stay beside the
video and remain independent of editor overlays. Keep its gate row outside the
collapsed technical steps, even when it is waiting on prerequisites.

Preserve the existing backend approval contract, source/build binding and minimum
review time. Automation must never approve the real episode. Hide cache, revision,
renderer, source and build-log details by default. Keep undo/redo and core editing
available. Fit playback and review controls inside the window.

No new dependencies, narration changes, media generation, production merge or release.
