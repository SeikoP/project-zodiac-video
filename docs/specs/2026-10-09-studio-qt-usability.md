# Zodiac Studio PySide6 — usability improvements (2026-10-09)

## Sources and scope

UI references: two Stitch ZIPs provided by the user, both using the Obsidian Production Desk palette. The first describes an integrated stage/console workbench; the second is a Media file-browser/preview. Reuse the existing PySide6 implementation and theme; HTML is reference only, not a new web GUI.

## Implemented user journeys

1. **Ready ZIPs** — Home scans repository `<repo>/ready/*.zip` and `<workspace>/ready/*.zip` (direct children only, excludes symlinks), preferring the repository path when browsing. Select a ZIP in the dropdown, refresh, then click **Nhập ZIP đã chọn**. Ordinary file picker remains a fallback for ZIPs elsewhere. Never import arbitrary folders or silently choose a ZIP.
2. **Overview + activity** — Current stage summary and log occupy one Workbench view. Log panel is visible by default, collapsible with Ctrl+L. A per-job UTF-8 append-only `.runtime/studio-gui.log` stores every message delivered to the UI and can be copied in full. Existing CLI/worker messages are still surfaced by the EventBridge.
3. **Media text** — Files under a job's `out/` can preview UTF-8 `.txt`, `.json`, `.md`, `.log`, `.srt`, `.vtt`, `.ass`, `.csv`, `.yaml`, `.yml`, `.xml`, `.html`. Preview is read-only, text is selectable, and individual previews are limited to 2 MiB to protect the GUI. Files are never edited.
4. **Single Publish action** — **Sao chép nội dung đăng** provides only caption and hashtags, preferring `out/publish.json` then `publish/publish.json`, with fallback to `publish-copy.txt`. The copied text is ready to paste into TikTok/YouTube; no extra ZIP is required to copy it.

## Compatibility and decisions

- Job@5 input requires both `publish/publish.json` and `publish/publish-copy.txt`; **this update intentionally does not delete either** or modify the canonical manifest/schema. The redundancy is removed from the **user interaction**, not from compatibility-sensitive packages. A single-file output contract would need a separately versioned migration with both plugin and runner tests.
- Output media is limited to a registered job's `out/`; ZIPs are limited to the ready directory before guarded import; no generic filesystem browsing from Media.
- Source of truth for rendered MP4, timing, cover, and acceptance stays in local runner, not the GUI.
- Logs represent messages actually emitted through GUI event callbacks; this change does not synthesize missing subprocess output. If a lower-level worker never emits stdout/stderr, capture must be improved there independently.

## Acceptance / UX smoke

- Home: empty ready; multiple ZIPs; refresh; select; file-picker fallback; path safety.
- Workbench: stage statuses, progress, log visible by default, log collapse, copy complete per-job log, no output overlay.
- Media: video/audio/image still work; text preview, non-text fallback, >2 MiB truncation, select/copy caption, no cross-job leakage.
- Preserve Windows layout readability at 1024×680 and 1280×800; no new runtime requirements.
