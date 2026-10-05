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

The output video is written to `.zodiac-work/jobs/zodiac-venus-virgo/out/zodiac-story.mp4`. The runner checks Python-side package and timing consistency, installs the exact direct dependency versions from the renderer package on first use, runs TypeScript typechecking, and then runs Remotion.

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
