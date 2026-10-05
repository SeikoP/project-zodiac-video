# Zodiac Video local runner

Local runtime for current **zodiac-video-pipeline production contract v2.0**.

The plugin owns evidence, story, narration, visual compile, `design.md`, `production.json` and video-specific SVG assets. This repository owns local voice generation/attachment, measured word timing, Remotion preview/render, background-music audition and final audio mix.

## Requirements

- Python 3.9+
- Node.js + npm
- FFmpeg on `PATH` for background-music preview/final mix
- VieNeu-TTS at `E:\\projects\\VieNeu-TTS` for the built-in local voice flow, or attach your own `voice.wav`
- `faster-whisper` for automatic word-level timing:

```bash
python -m pip install -r requirements-local.txt
```

The first alignment run may download the selected Whisper model. Default alignment is `small` on CPU/int8.

## Accepted package

A package must contain:

```text
design.md
narration.txt
production.json          # version 2.0
README.md
assets/
renderer/
```

The runner validates the v2 entity/state/event contract, compiled design-token hash, Be Vietnam Pro caption contract, SVG paths/style IDs, renderer scripts/dependencies and package narration before import.

Old v1 packages using `actors/objects/actions/motion` are intentionally rejected.

## Quick start

Import:

```bash
python tools/zodiac_local.py import "/path/to/zodiac-render-ready.zip"
```

Check:

```bash
python tools/zodiac_local.py check zodiac-sun-gemini
```

### Generate VieNeu voice + measured words

```powershell
python tools/zodiac_local.py voice zodiac-sun-gemini --voice "Hải Đăng"
```

The voice flow:

1. generates one PCM WAV per production scene;
2. concatenates them into `voice.wav`;
3. uses faster-whisper forced word timing against each approved `scene.voice`;
4. writes word-level `.runtime/timing.json`.

The aligner does **not** distribute a scene duration evenly across words. If recognized word order does not match approved narration, the command stops instead of inventing timing.

Optional aligner controls:

```bash
--align-model small
--align-device cpu
--align-compute-type int8
```

To reuse a running VieNeu Gradio service:

```powershell
python tools/zodiac_local.py voice zodiac-sun-gemini \
  --voice "Hải Đăng" \
  --vieneu-url http://127.0.0.1:7860
```

### Attach externally measured voice/timing

```bash
python tools/zodiac_local.py attach zodiac-sun-gemini \
  --voice "/path/to/voice.wav" \
  --timing "/path/to/timing.json"
```

Timing must contain one measured token per spoken word. This is required by v2 for:

- phrase/page captions;
- active-word highlighting;
- `voice_anchor` event resolution;
- intra-scene character/object/camera animation.

## Preview vs render

```bash
python tools/zodiac_local.py preview zodiac-sun-gemini
python tools/zodiac_local.py render zodiac-sun-gemini
```

**Preview means Remotion Studio**, an interactive long-running process. It is not a short MP4 preview.

Before preview/render the runner:

1. validates local voice + word timing;
2. installs pinned renderer dependencies if needed;
3. runs `npm run compile:style`;
4. runs renderer contract tests;
5. runs TypeScript typecheck;
6. lets the canonical renderer create `.runtime/render-props.json` and resolve `voice_anchor` events.

The renderer package itself owns captions, event resolution, visual states, SFX and transitions. The local runner no longer regex-patches `ZodiacComposition.tsx`.

## Background music

GUI volume range is **0–100%**. 100% means gain `1.0` relative to the source file.

The selected track is copied to package-local `media/` and its local setting is stored in:

```text
.runtime/audio.json
```

Remotion renders voice + SFX first. The local runner then post-mixes the selected background track into the final MP4 with FFmpeg. This keeps the plugin's canonical renderer unchanged.

CLI example:

```bash
python tools/zodiac_local.py render zodiac-sun-gemini \
  --music "/path/to/music.mp3" \
  --music-volume 0.45
```

Disable:

```bash
python tools/zodiac_local.py render zodiac-sun-gemini --no-music
```

### Nghe thử

The GUI has **Nghe thử**. It creates a 10-second `voice.wav + music` mix at the current slider value.

If `voice.wav` is shorter than 10 seconds, silence is padded so the preview still lasts exactly 10 seconds. The file is opened with the native launcher:

- Windows: `startfile`
- macOS: `open`
- Linux: `xdg-open`

## Desktop GUI

```powershell
python tools/zodiac_gui.py
```

The GUI:

- imports the selected RENDER_READY ZIP when needed;
- starts/reuses VieNeu;
- generates voice + measured word timing;
- controls music at 0–100%;
- creates an audio mix preview;
- opens **Remotion Studio** without locking the rest of the GUI;
- changes the Studio button to **Dừng Studio** while running;
- terminates the full Studio process tree on Windows and the full POSIX process group on macOS/Linux;
- renders the final MP4 and post-mixes background music.

Output:

```text
.zodiac-work/jobs/<job>/out/zodiac-story.mp4
```

## Editor Workspace (v1)

**Mở Editor** in the desktop GUI opens a separate window over one imported v2 job. It edits only the v2 scene model — `scene.entities[].states[].transform/layer/visible` — and never touches `design.md`, `visual_system.style_token` or the compiled `source_hash`.

```text
tools/editor/
  document.py     EditorDocument: load, dirty tracking, edits, validate, atomic save, revert
  geometry.py     CanvasTransform: 1080x1920 production <-> fitted 9:16 display
  commands.py     StateCommand + History for undo/redo (in memory only)
  runtime.py      invalidate_runtime_for(edit_type): SAFE edits drop render-props only
  scene_list.py   scene navigator with a short voice preview
  canvas.py       layer-ordered items, hit test, drag, corner resize, safe-zone overlay
  inspector.py    read-only identity + editable X/Y/W/H/Layer/Visible, two-way sync
  workspace.py    window shell: Save / Revert / Validate / Undo / Redo
```

Behaviour:

- drag updates the working copy only; `production.json` is written on **Save**;
- **Save** runs the canonical v2 validator first and writes atomically (temp file + `os.replace`), so an invalid edit never overwrites the file;
- **Revert** re-reads the file from disk (no Git);
- `Ctrl+Z` / `Ctrl+Shift+Z` cover move, resize, layer and visibility;
- the window title shows `Zodiac Editor — S03 *` while dirty, and closing while dirty asks Save / Discard / Cancel;
- if `production.json` changed on disk, Save asks Reload / Overwrite / Cancel and never silently overwrites;
- `voice.wav` and `.runtime/timing.json` survive every edit; only `.runtime/render-props.json` is invalidated.

Canvas artwork is a best-effort vector preview of the same SVG/primitive data Remotion renders; geometry is exact, fidelity is not pixel-identical.

## Safety

ZIP import rejects traversal, links, duplicate paths, oversized entries and suspicious compression ratios. SVG assets must remain self-contained vector files under `assets/`.

FFmpeg/npm calls pass validated executables and arguments as argv with `shell=False`; user-selected paths are never interpreted as shell source.

Only run renderer packages exported by a trusted plugin/workflow because a package contains executable Node.js renderer code.
