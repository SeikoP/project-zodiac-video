# Native dual-endpoint visual preview contract — 2.2.14

## Source and ownership
- Phase 02 plugin runs `node orchestration/build-native-preview-pairs.mjs <workspace>` after all native character/environment/scene-direction/semantic-asset compilers and validators; then `node orchestration/validate-native-preview-pairs.mjs <workspace>`.
- Output `.authoring/preview-pairs/index.html` plus `preview-report.json`; **two visual source-state snapshots per authored event**, with corresponding source SVGs, layers, and transforms. Source hash must match current `production.json`. Both frames must exist and the event count must match.
- These are authored semantic state **endpoints**, not measured render frames. `zodiac-job@5` IR preserves states/events; the producer also accepts `production.ir.json` inspection, but must never resolve voice anchors or invent runtime frame timing.
- Actual motion-only events (`subtle-tilt`, `focus-shift`, `small-bounce`, `slide`) with matching SVG endpoints are listed as `runner_motion_check_required=true`. **Do not** call this a rendered-motion PASS. They must be inspected in the local runner's event-aware two-frame Remotion still sampling (sample BEFORE/DURING for a motion-only event) once Job@5 is imported and timing is resolved.

## Review acceptance
- For every event inspect the before and after endpoints, actor/prop/effect identity and layer, contact/anchor semantics, safe zone, clarity of visually meaningful state changes, and effect show/hide lifecycle.
- A missing/stale/unsafe asset, missing target, invalid coordinates or fewer than 2 frames/event is a blocking failure. No independent mock images or SVG redraws may be used to satisfy the gate.
- Phase 02 ends only after executed native QC, built+validated preview pairs and explicit human visual approval. No Remotion process, voice.wav, timing, resolved frame numbers, MP4 or final video required in the plugin.
- After Phase 03 Job@5 import, the **local runner** is responsible for real-frame timing, 2-frame samples per semantic event, actual animation amplitude, captions/voice sync and preview/final parity.

## Required motion semantics QC (2.2.14)
- `hold` is an intentional **static_hold**, not motion; preview still shows two frames for context but do not count it as active animation.
- `state_swap` with unchanged state, asset, visibility and geometry is rejected (`NOOP_STATE_SWAP`); choose an active preset for emphasis or author an actual changed state before recompiling.
- Same-state motions must advertise deterministic expected peak amplitude; native preview after frame shows a schematic peak pose, **not measured Remotion timing**.
- `slide` of the authored pen toward notebook requires `spatial_bindings.points_to`, valid in-frame path, at least 24px travel, and its pen tip contacting notebook paper; report the precise target point and delta. Two frames verify semantic endpoints; renderer samples before/during for temporal parity.
- A change to motion preset, production or source asset invalidates existing approval hashes. Do not reuse an older review receipt as approval for changed visual semantics.

## Safe portable review HTML (2.2.14)
- The exported `preview-pairs/index.html` must embed actual trusted native V4 SVG markup directly into its own 1080x1920-scaled frame surfaces. It is a single portable HTML file and does not load other files to display previews.
- No `iframe`, `script`, SVG `data:` image sources, remote requests or file-relative fetches in the review index; these can be blocked in hosted artifact viewers.
- Individual before/after HTML files remain for debugging, but also inline native SVG markup and carry asset SHA256. Do not substitute mock images or modify asset geometry.
- `validate-native-preview-pairs.mjs` must reject blocked embedding mechanisms and require 2 inline review panels per event plus source/frame/index SHA256 consistency.
- Optional PNG contact sheets are viewer fallbacks only, not equivalent to a native validation receipt or real Remotion frame.
