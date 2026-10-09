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


## 2026-10-09 UI refactor — operational console and Publish

The Workbench was refactored from separate small summary/log areas into a
**prominent, unified pipeline monitor** with a central console and slim stage
inspector. The stage rail remains the single navigation surface.

### Operational console
- Displays local receipt timestamp, observed pipeline step, and source channel
  (STATE / STDOUT / STDERR / EVENT / ERROR / DIAGNOSTIC).
- Uses independent filters: severity/source and stage; the filters do not erase
  the job's log file.
- Captures real-time stdout/stderr from both `run_managed_subprocess` and
  Job@5 `run_structured_command`; control-plane errors preserve their full
  structured `to_dict()` payload in the log.
- RUNNING / DONE / FAILED events reflect **observed changes to the actual
  persisted pipeline state**; do not fabricate percentages or missing events.
- `.runtime/studio-gui.log` is append-only per job. Qt only displays the last
  3,000 rows to remain responsive, labels visible/total counts, and copies the
  full file via **Sao chép toàn bộ**. Received timestamps are not interpreted
  as the subprocess's own wall clock.
- STDERR is a stream, **not necessarily an error**: ffmpeg's routine progress
  on stderr is not highlighted as an ERROR; it can be filtered separately.

### Single Media and publishing flow
- The Workbench has one **Mở Media / Xem đầu ra** entry point.
- Media hides root-level `out/publish.json` and `out/publish-copy.txt` as
  duplicate technical files **without deleting them** (Job@5 still requires
  both for backwards compatible import).
- The selected job's **Nội dung đăng** panel reads the structured JSON first,
  then fallback TXT for older packages. It shows and copies the actual
  caption + hashtags **without field labels**. COVER IDENTITY and HOOK are
  technical cover metadata and are excluded from publishing clipboard payload.
- Other JSON/TXT/SRT/Markdown/log outputs remain browseable and read-only.

### Diagnostics and boundaries
- Console log completeness means all messages emitted by the two observed
  subprocess routes and GUI state events are recorded; tools that emit no
  stdout/stderr cannot have output invented.
- A success result from CLI, schema, or CI is not equivalent to a visually
  approved Remotion video.
- PySide6 tests include filter/provenance, subprocess stream, hidden publish
  duplicates, value-only clipboard, workspace ready dropdown, and legacy
  media/job import regressions.


## Stage rail and progress semantics

The seven Job@5 stage cards are **navigation plus state evidence**:
- Stage title and purpose stay stable: PACKAGE, VOICE, TIMING, PLAN,
  RENDER, AUDIO, OUTPUT.
- Cards show the actual `PENDING / RUNNING / DONE / FAILED / SKIPPED /
  CANCELLED` status. When present, cache reuse or verified diagnostics
  are displayed; the latest observed runtime output is shown for a running
  step, with the full line available as a tooltip.
- Clicking a card selects its detailed inspector; it does not re-execute it.

**Two fundamentally different progress metrics must not be confused:**

1. Overall progress = 100 × (DONE + SKIPPED) / total stages. For example,
   six DONE and one RUNNING = **86% by completed stage count (6/7)**.
   This is *not* a wall-clock percentage, estimated time or render percentage.
   The overall QProgressBar is always determinate.
2. Step progress = a real measured fractional progress value, only when
   supplied by the runner (currently legacy stage progress). Job@5's stage
   state schema does not yet store a measured fraction, therefore Job@5
   RUNNING must display **"chưa có % đo được"**, recent observed events,
   and no animated indeterminate QProgressBar.

The placeholder `0.5` progress for every RUNNING Job@5 stage has been
removed from `v2_pipeline_rows()`. Future per-scene or per-segment progress
should be added by extending the runner's event contract with a concrete
`completed_units/total_units` measurement; never synthesize 50% or infer
seconds remaining from step count. Running logs can include validation
receipts such as `SPATIAL_BINDINGS_VALID` without pretending they are a
percentage of all OUTPUT work.

Acceptance includes at least: 6/7 overall = 86%; all done = 100%; 0/7
= 0%; a failed step has visible diagnostic text; cached stage displays
cache state; the active step shows actual recent output; and the rail
remains vertically scrollable in compact windows.
