# Zodiac TUI Control Plane

Status: **Phase 1 implemented alongside the existing Tkinter GUI**

## Decision

Zodiac no longer needs a second visual editing stack beside Remotion.

The target boundary is:

```text
Zodiac TUI  ->  Python engine / jobs / TTS / timing / render orchestration
                         |
                         v
                 production.json
                         |
                         v
Remotion Studio -> scene / actor / caption / animation / visual debugging
                         |
                         v
                    final render
```

The TUI is an operator control plane, not a video editor.

## Phase 1 implemented

Entry point:

```powershell
python tools/zodiac_tui.py
```

Install local dependencies first:

```powershell
python -m pip install -r requirements-local.txt
```

Implemented in the first TUI slice:

- terminal-native ZIP picker (`*.zip`) with mouse and keyboard;
- explicit package fingerprint conflict modal: **Nhập lại / Giữ job cũ / Hủy**;
- existing-job selector;
- current `StudioController` / `PipelineWorker` reuse;
- compact six-stage operator view over the existing nine-node resumable DAG;
- voice selection;
- alignment model selection;
- music picker and volume;
- run-all / continue / stop;
- environment check;
- live worker logs;
- launch / stop Remotion Studio;
- open final video / output folder;
- keyboard shortcuts (`I`, `R`, `C`, `S`, `X`, `Q`).

The existing Tkinter GUI remains available during migration. No pipeline or
runtime contract is deleted in this phase.

## Intentionally not duplicated in TUI

Do not add these to the TUI:

- visual scene canvas;
- actor positioning canvas;
- animation timeline;
- caption visual preview;
- camera preview;
- asset visual inspector.

Those belong in Remotion/render-core so preview and final output share one
visual source of truth.

## Next phases

1. Add rerun-step drill-down for the internal nine-node DAG.
2. Move dependency install and VieNeu service controls from Tkinter.
3. Add Remotion authoring compositions: `ScenePreview`, `ActorLab`,
   `AssetLab`, `PerformanceLab`.
4. Extract shared `render-core` used by Studio preview and final Remotion render.
5. Retire `tools/studio/app.py` and Tkinter views only after parity/regression
   checks pass.
6. Retire the duplicate Tk visual editor after Remotion authoring parity exists.

## Migration rule

CLI, TUI and tests must converge on the same Python application/domain layer.
The TUI must not become a second implementation of pipeline rules.
