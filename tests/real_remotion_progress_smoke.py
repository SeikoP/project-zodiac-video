"""Actual pinned Remotion 4.0.530 CLI -> Python observer -> MP4 acceptance smoke.

The renderer fixture comes from runtime/zodiac-renderer/2.0.1/renderer/tests.
This is a short real video render, not a substitute for full Windows production.
"""
from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

from tools.studio_v2.progress import observe_frame_progress, track_render_segment_frames
from tools.studio_v2.runner import observe_structured_command_output, run_structured_command


def main() -> int:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: real_remotion_progress_smoke.py <prepared-workspace>")
    root = Path(sys.argv[1]).resolve()
    renderer = (Path(__file__).resolve().parents[1] /
                "runtime/zodiac-renderer/2.0.1/renderer")
    node = shutil.which("node")
    assert node, "node required"
    props = root / ".runtime/renderer-v2-props.json"
    assert props.is_file(), "prepare.mjs failed to create renderer props"
    target = root / "frame-progress-smoke.mp4"
    frames = []
    logs = []
    with observe_frame_progress(lambda *args: frames.append(args)), \
         observe_structured_command_output(lambda *args: logs.append(args)), \
         track_render_segment_frames("smoke-seg01", 12):
        result = run_structured_command([
            node, str(renderer / "scripts/local-remotion-cli.mjs"),
            "render", "src/index.ts", "ZodiacRenderPlan", str(target),
            f"--props={props}", "--duration=12", "--concurrency=1",
        ], cwd=renderer, stage="RENDER", fallback_code="RENDER_FAILED")
    assert result.returncode == 0 and target.is_file() and target.stat().st_size > 1000
    render = [e for e in frames if e[3] == "rendering" and e[1] == 12 and e[2] == 12]
    encode = [e for e in frames if e[3] == "encoding" and e[1] == 12 and e[2] == 12]
    if not render or not encode:
        print(json.dumps({
            "error": "REAL_PROGRESS_NOT_OBSERVED",
            "rendered_12": bool(render), "encoded_12": bool(encode),
            "frames_tail": frames[-12:], "output_tail": result.stdout[-2500:],
            "stderr_tail": result.stderr[-1200:],
        }, ensure_ascii=False), file=sys.stderr)
        return 1
    print(json.dumps({
        "status": "REAL_RENDER_PROGRESS_PASS", "segment": "smoke-seg01",
        "rendered": "12/12", "encoded": "12/12",
        "mp4_bytes": target.stat().st_size, "events": len(frames),
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
