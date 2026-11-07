# Zodiac Video — plugin and local runner

This is the single development repository for the Zodiac video plugin and local
runner. The former plugin repository is retired; do not fetch source from it.

- `plugins/zodiac-video-pipeline/`: plugin manifests, skills, orchestration,
  contracts, asset registries, native assets and producer tests.
- `runtime/` and local application/tools: pinned rendering, voice attachment or
  generation, measured timing, final rendering and audio mix.
- `.github/workflows/zodiac-source-bundle.yml`: commit-pinned execution source
  archive, with file hashes and installed-plugin release provenance.
- `docs/zodiac-plugin-release.json`: installed release mapping. Plugin version,
  plugin release ID and source commit are separate identifiers.

Development flows from a reviewed repository commit to an installed plugin
release. GitHub commits do not automatically update ChatGPT's installed plugin.
During episode work, the active installed plugin governs workflow and the user's
approved narration, scope and reviews govern the episode. Downloaded source must
match the installed version and integrity checks; repository examples and prose
never substitute for an approved episode or a genuine review.

The current handoff is `zodiac-job@5`. Its manifest selects the exact renderer
version; do not infer it from this README or fall back to latest. Executable-source
archives include contracts, registries and native assets as well as code. Episode
ZIPs, generated voice/timing and rendered media remain separate deliverables.


## Web/Local producer split

Zodiac 2.8 separates producer entrypoints while keeping one canonical source tree.

- `zodiac-video-web` owns Phase 1: Evidence → Concept → Narration → Content Review → `zodiac-phase1-handoff@1` ZIP.
- Put the downloaded handoff ZIP directly in repository `phase1-done/` (or under `ZODIAC_QUEUE_ROOT`).
- Invoke `zodiac-video-local`. It automatically resumes one existing `processing/<run-id>/` workspace or claims the oldest valid ZIP from `phase1-done/`, validates it, activates Phase 2, and continues Phase 2–3.
- Failed imports go to `blocked/<run-id>/`; no background watcher is required.
- After genuine Visual Review, the local Phase-3 wrapper validates Job@5 in private staging and publishes it atomically into repository `ready/`.
- Existing Zodiac Studio/LocalRunner continues to read `ready/`; TTS, measured timing, Remotion and MP4 remain local-runner responsibilities.

The two plugin distributions share contracts and implementation from `plugins/zodiac-video-pipeline/`; do not fork the source into separate repositories.

## Requirements

- Python 3.9+ for local tools; Python 3.10+ for the desktop GUI
- Node.js + npm
- FFmpeg on `PATH` for background-music preview/final mix
- VieNeu-TTS at `E:\\projects\\VieNeu-TTS` for the built-in local voice flow, or attach your own `voice.wav`

The desktop workbench accepts optional per-machine environment overrides:

```powershell
$env:ZODIAC_TTS_ROOT = 'D:\\Tools\\VieNeu-TTS'
$env:ZODIAC_VIENEU_URL = 'http://127.0.0.1:7860'
uv run zodiac
```

These options configure the existing VieNeu Gradio integration, not the newer
OpenAI-compatible `/v1/audio/speech` server. Leave the URL unset to keep the
existing default. The path must refer to a valid local VieNeu installation.

- `faster-whisper` for automatic word-level timing:

```bash
python -m pip install -r requirements-local.txt
```

The first alignment run may download the selected Whisper model. Default alignment is `small` on CPU/int8.

## Current package: Job@5

The Job@5 ZIP contains exactly:

```text
package-manifest.json
production.ir.json
design-token.json
narration.txt
assets/**                 # only assets referenced by production.ir.json
publish/publish.json
publish/publish-copy.txt
```

The incoming ZIP must not contain timing or other local runtime state. Import
checks the package schema, canonical contract hash, renderer version, ordered
narration, publish references, and exact asset references before writing the
workspace. Measured timing lives at `.runtime/timing.json`; it is created or
attached after import.

The PySide6 Task Workbench is the default GUI:

```bash
uv run zodiac
```

For Job@5, **Tiếp tục** reuses validated artifacts, while **Chạy toàn bộ**
regenerates voice and every following stage. Select a pipeline row and use
**Chạy lại từ bước** to regenerate that stage and its downstream outputs.
**Dừng** waits for the current stage to finish, saves progress, and stops before
the next stage; closing the window during a run follows the same safe stop.
The last job and its voice/music settings reopen automatically, and imported
Job@5 workspaces are also available in the job picker without the source ZIP.
Use **Kiểm tra** to validate the current package and check VieNeu, alignment,
Renderer 2, Node/npm, FFmpeg and ffprobe, with suggested fixes for failures.

In **Thiết lập**, the voice dropdown refreshes from the running VieNeu service
and shows each voice's description. **Nghe thử giọng** generates a short sample
and plays it inside the app; **Dừng nghe thử giọng** stops playback.
The workbench shows completed scenes separately from VieNeu's current chunk
updates. Queue/reference/model-loading states have no invented percentage.
Drag the divider above **LIVE CONSOLE** to resize the persistent log panel.

The direct compiler uses the same canonical timing path:

```bash
zodiac-control build "/path/to/imported-job"
```

Gói zodiac-job@1–4 cũ đã được gỡ khỏi Studio; hãy tạo lại bằng plugin hiện tại (Job@5).

## Background music

GUI volume range is **0–100%**. 100% means gain `1.0` relative to the source file.

The selected track is copied to package-local `media/` and its local setting is stored in:

```text
.runtime/audio.json
```

Renderer renders voice + SFX first. The local runner then post-mixes the selected background track into the final MP4 with FFmpeg. This keeps the plugin's canonical renderer unchanged.

### Nghe thử

Settings includes **Nghe thử**, which plays a 10-second `voice.wav + music`
mix at the selected volume directly in the app.

## Pipeline and resume

```text
IMPORT_PACKAGE → PREFLIGHT → VOICE_SCENES → CONCAT_VOICE → ALIGN_TIMING
               → VALIDATE_RUNTIME → PREPARE_RENDERER → RENDER_VIDEO
               → MIX_MUSIC → PACKAGE_PUBLISH
```

Mỗi bước có trạng thái `PENDING / RUNNING / DONE / FAILED / SKIPPED / CANCELLED` và được ghi vào `.runtime/pipeline-state.json` (ghi atomic bằng temp file + `os.replace`).

| Nút | Việc làm |
| --- | --- |
| **Chạy toàn bộ** | chạy từ bước đầu tiên chưa `DONE` |
| **Tiếp tục** | chạy lại bước `FAILED`/`CANCELLED` hiện tại rồi đi tiếp phía dưới |
| **Chạy lại bước** | chạy lại một bước đã chọn và vô hiệu hoá đúng các bước phụ thuộc |
| **Dừng** | dừng worker và tiêu diệt cây process (taskkill /T trên Windows, process group trên POSIX); bước đang chạy thành `CANCELLED`, bước đã xong giữ nguyên |
| **Kiểm tra** | kiểm tra gói + môi trường, không chạy TTS/render |

`VOICE_SCENES` checkpoint **từng scene**: `S01…S0N` trong `.runtime/tts-scenes/`. Một scene chỉ được dùng lại khi scene id, `scene.voice`, giọng VieNeu, chế độ TTS không đổi, file tồn tại, `validate_voice` đạt và hash khớp state. Bấm **Tiếp tục** chỉ tạo lại scene chưa xong.

Invalidation đúng phạm vi, không xóa bừa runtime:

```text
đổi lời thoại 1 scene → scene đó + CONCAT_VOICE → ALIGN_TIMING → runtime → render
đổi giọng VieNeu     → toàn bộ chuỗi giọng
đổi anchor/layout    → PREPARE_RENDERER → RENDER_VIDEO → MIX_MUSIC → PACKAGE_PUBLISH (voice + timing giữ nguyên)
đổi nhạc nền         → MIX_MUSIC → PACKAGE_PUBLISH
```

Mở lại app: bước `RUNNING` bị ngắt được đưa về `PENDING` (không bao giờ coi là xong). Job cũ chưa có `pipeline-state.json` vẫn mở được — lần đầu chỉ đánh dấu `DONE` khi artifact kiểm chứng được (package hợp lệ, `voice.wav` + `timing.json` hợp lệ, đủ scene WAV); không bịa provenance.

### Preflight và lỗi faster-whisper

Trước khi tạo bất kỳ giọng đọc nào, preflight kiểm tra: Python đang chạy, `faster-whisper`, Node.js, npm, FFmpeg, gói video, VieNeu. `faster-whisper` được kiểm tra **trong chính interpreter đang chạy Zodiac Studio**, không dùng `python` khác trên PATH.

Nếu thiếu, badge đầu cửa sổ chuyển sang *Thiếu dependency* và nút **Cài dependency còn thiếu** xuất hiện (không tự cài âm thầm). Lệnh cài luôn là:

```powershell
<sys.executable> -m pip install -r requirements-local.txt
```

Cài xong preflight chạy lại; chỉ khi mọi thứ xanh mới chạy TTS. Nếu thiếu mà bấm **Chạy toàn bộ**/**Tiếp tục**, bước *Kiểm tra môi trường* fail với mã `DEPENDENCY_MISSING` và **không scene nào** được tạo.

### Xử lý sự cố

| Tình huống | Cách xử lý |
| --- | --- |
| Báo *Thiếu dependency* | bấm **Cài dependency còn thiếu**, hoặc chạy lệnh pip ở trên bằng đúng interpreter |
| Bước *Tạo giọng đọc* đỏ | xem chi tiết trong **NHẬT KÝ**; bấm **Tiếp tục** — chỉ scene chưa xong được tạo lại |
| Bước *Căn thời gian từ* đỏ (`ALIGNMENT_MISMATCH`) | lời thoại đã duyệt không khớp giọng đã tạo; sửa lời thoại hoặc tạo lại giọng rồi **Tiếp tục** |
| Bước *Kết xuất video* đỏ | `voice.wav` và `timing.json` được giữ; **Tiếp tục** chỉ chạy lại renderer |
| Muốn làm lại từ đầu | **Chạy lại bước** ở bước *Nhập gói video* (vô hiệu hoá phía dưới), hoặc xóa riêng `.runtime/pipeline-state.json` để app suy luận lại từ artifact |Output sau render/publish:

```text
.zodiac-work/v2/jobs/<job>/out/
├─ zodiac-story.mp4              # final MP4; nhạc nền được mix trực tiếp vào file này nếu bật
├─ cover.png
├─ publish-copy.txt
├─ publish.json
└─ FINAL_VALIDATION.json         # receipt local runtime cho zodiac-job@4
```

Studio không tạo ZIP publish thứ hai và không giữ `zodiac-story.with-music.mp4`; các tên legacy này được dọn nếu còn sót. Nhạc bundled trong repo là tùy chọn; nếu không có file mặc định, Studio bắt đầu ở trạng thái chưa chọn nhạc thay vì coi đó là lỗi môi trường.

## PySide6 Task Workbench (default GUI)

This is a dark workstation with two top-level tabs: **Công việc / Workspace**
combines recent-job selection with the seven-step production workbench, and
**Media** manages the active job's video, audio, and image outputs. Video and
music previews play inside the Qt app. It provides environment checks, audio
settings, Remotion Studio, resume/run-all, rerun, safe
stop, and output navigation. It adds keyboard shortcuts: `Ctrl+O` import,
`Ctrl+R` continue, `Ctrl+Shift+R` run all, `Ctrl+L` logs, `Esc` back to jobs.
Run `uv run zodiac` to open this GUI. PySide6 installs with the project's default
dependencies.

Luồng GUI: chọn ZIP trong `ready/` hoặc **Chọn ZIP từ máy…** → nhập và kiểm tra
gói → Workspace tự kiểm tra môi trường → **Thiết lập** giọng/nhạc →
**Tiếp tục quy trình**. Khi hoàn tất, nút chính chuyển thành **Xem video đầu ra**.
Màn nhập hiện trạng thái/lỗi và giữ lựa chọn job khi làm mới. Media ưu tiên
`zodiac-story.mp4` khi chưa chọn tệp, giữ tệp đang xem khi làm mới, và có
**Mở Workspace** để quay về đúng job.

Job@5 ghi thời gian các bước thành công vào `.runtime/performance.jsonl`.
PLAN bao gồm audit payload và phục hồi cache; RENDER bao gồm QC và kiểm tra
đầu vào. Kiểm tra Remotion CLI trước TTS có dòng riêng với `stage=RENDER`,
`substage=CLI_CHECK`; cộng cả dòng này khi tổng hợp thời gian backend.

Renderer 2.0.1 thêm viền phụ đề đen 2px. Từ đang đọc dùng màu nhấn của job
và nảy nhẹ theo timing Whisper; các từ còn lại giữ màu gốc. Render plan giữ
timing từng từ và điều chỉnh offset khi render theo phân đoạn. Nếu chỉ có
timing cả cụm, phụ đề giữ dạng tĩnh. Chạy lại bước **Render** để cập nhật MP4;
cache giọng và timing được dùng lại nếu còn hợp lệ.

## Safety

ZIP import rejects traversal, links, duplicate paths, oversized entries and suspicious compression ratios. SVG assets must remain self-contained vector files under `assets/`.

FFmpeg/npm calls pass validated executables and arguments as argv with `shell=False`; user-selected paths are never interpreted as shell source.

Job@5 ZIPs contain data only; executable Node.js renderer code comes from the trusted `zodiac-renderer` runtime bundled with Zodiac Studio.


## Zodiac plugin source

The canonical Zodiac producer source lives in `plugins/zodiac-video-pipeline/`. Version 2.8.0 builds two installable distributions, `zodiac-video-web` and `zodiac-video-local`, while the monolithic archive is retained only as a transition/rollback artifact. GitHub commits do not automatically update installed plugins. Run native implementation commands with `plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/` as the canonical skill root.
