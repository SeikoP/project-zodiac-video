# Zodiac Video local runner

Import a `RENDER_READY` ZIP exported by **zodiac-video-pipeline 0.9.1**, check that its video-specific SVGs and Remotion scaffold are complete, attach the voice and measured timing, then preview or render with Remotion on your machine.

Each video keeps its own hand-authored SVG assets from the package. This repository does not ship a fixed character-pose collection or generate raster images.

## Requirements

- Python 3.9 or newer (standard library only)
- Node.js and npm, for the Remotion renderer

## Quick start

Clone this repository, open a terminal in its folder, then import the video package ZIP:

```bash
python tools/zodiac_local.py import "/path/to/zodiac-venus-virgo-render-ready.zip"
```

The package is extracted into `.zodiac-work/jobs/<package-name>/`. Check it with:

```bash
python tools/zodiac_local.py check zodiac-venus-virgo
```

Create `voice.wav` from `narration.txt` with your chosen Vietnamese TTS or recording workflow. Measure the scene and caption boundaries against that actual voice and save them using the schema in the package's `renderer/README.template.md`. Then attach both files:

```bash
python tools/zodiac_local.py attach zodiac-venus-virgo \
  --voice "/path/to/voice.wav" \
  --timing "/path/to/timing.json"
```

Open Remotion Studio to preview, or render the MP4:

```bash
python tools/zodiac_local.py preview zodiac-venus-virgo
python tools/zodiac_local.py render zodiac-venus-virgo
```

For this machine, the local flow can generate both voice and measured timing through `E:\projects\VieNeu-TTS`, then render with Remotion:

```powershell
python tools/zodiac_local.py voice zodiac-sun-gemini --voice "Hải Đăng"
python tools/zodiac_local.py render zodiac-sun-gemini
```

Or use the dependency-free TUI for import/check/voice/preview/render:

```powershell
python tools/zodiac_local.py tui --archive "ready\zodiac-sun-gemini-render-ready.zip"
```

For the Windows desktop controller:

```powershell
python tools/zodiac_gui.py
```

The GUI starts `uv run vieneu-web` from `E:\projects\VieNeu-TTS` if `http://127.0.0.1:7860` is not already available, then calls the running Gradio API for voice generation. This reuses the model already loaded by VieNeu instead of opening a second model process. Saved voices are listed from `%USERPROFILE%\.vieneu\user_voices_v3_turbo.json`; `cuongdepzai` is preselected when present. A selected background track loops beneath the narration; its volume defaults to 12%. The output card shows the latest MP4, opens it with the Windows default video player, or opens the output folder. Preview opens Remotion Studio.

The `voice` command synthesizes each scene separately, concatenates the PCM WAVs into `voice.wav`, and writes `.runtime/timing.json` from their measured sample durations. Pass `--vieneu-url http://127.0.0.1:7860` to reuse a running VieNeu Gradio server, or omit it to run the VieNeu SDK in its own process. Set `--tts-root` or `--tts-python` when VieNeu is installed elsewhere.

VieNeu checks Hugging Face's local cache on startup. Model files are normally reused after the first download; the app still loads the weights into memory each time the server starts. Downloads recur only when required files are missing, the cache location changes, or the Hub reports a newer revision. The current machine has a local cache entry for `pnnbao-ump/VieNeu-TTS-v3-Turbo` under `%USERPROFILE%\.cache\huggingface\hub`.

The output video is written to `.zodiac-work/jobs/zodiac-venus-virgo/out/zodiac-story.mp4`. The runner checks Python-side package and timing consistency, installs the renderer's pinned dependencies on first use (using an available TypeScript 5.8 patch when the old 5.8.0 pin is no longer published), runs TypeScript typechecking, and then runs Remotion.

On Windows PowerShell, use the same commands with Windows paths, for example:

```powershell
python tools/zodiac_local.py import "D:\Videos\zodiac-venus-virgo-render-ready.zip"
python tools/zodiac_local.py attach zodiac-venus-virgo --voice "D:\Videos\voice.wav" --timing "D:\Videos\timing.json"
python tools/zodiac_local.py render zodiac-venus-virgo
```

Use `--workspace <folder>` before the subcommand to store jobs somewhere else:

```bash
python tools/zodiac_local.py --workspace "/data/zodiac-work" import "/path/to/package.zip"
```

## Accepted input

Use the exported **video package ZIP** with `production.json`, `narration.txt`, video-specific `assets/`, and the `renderer/` scaffold. A `zodiac-content-pipeline` ZIP is a separate carousel/content skill and is not renderable: it does not contain the video production contract or Remotion project.

The importer validates ZIP paths before extraction, rejects links and duplicate paths, checks the canonical narration against ordered `scene.voice` text, checks every registered SVG and referenced object/actor asset, and verifies the renderer versions and scripts against plugin 0.9.1. It also validates measured scene frames and caption text before preview/render.

## Plugin review: 0.9.1

See [docs/plugin-review.md](docs/plugin-review.md) for the review notes and limitations. In short: the plugin correctly emits per-video SVGs and a Remotion scaffold, while voice creation and voice-derived timing remain local inputs. This runner automates extraction, validation, dependency setup, preview, and rendering around that boundary.

Only run a package exported by a plugin/version you trust. The renderer runs local Node.js code from the package, and its first run downloads the declared npm dependencies.
