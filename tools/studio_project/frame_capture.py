"""Photograph the CURRENT build at the backend layer (no GUI, no playback) and lay the frames out on a contact sheet.

    python -m tools.studio_project.frame_capture --projects-root <dir> --project <project_id> [--per-scene 3] [--out <dir>]

It calls the same `visual.review_frames` the in-app frame review uses (HyperFrames snapshot of the composition the export
renders), so what a person, an agent or the app's own review looks at here is what the MP4 will contain. Read-only with
respect to the project: nothing is edited, no gate is touched, no playback or approval is recorded.
Prints JSON: {build_id, scenes: {scene_id: [png...]}, sheet: path}.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

from .service import StudioProjectService


def plan_times(build: dict, per_scene: int) -> dict[str, list[float]]:
    """`per_scene` moments spread inside each built scene (episode-timeline seconds), away from the cut edges."""
    count = max(1, per_scene)
    times: dict[str, list[float]] = {}
    for scene in build.get("scenes", []):
        start, end = scene["start_ms"] / 1000, scene["end_ms"] / 1000
        span = max(end - start, 0.1)
        times[scene["id"]] = sorted({round(start + span * (index + 0.5) / count, 2) for index in range(count)})
    return times


def contact_sheet(frames: dict[str, list[str]], path: Path, width: int = 240) -> Path:
    """One row per scene, one column per frame; the scene id is printed in the corner. Needs Pillow."""
    from PIL import Image, ImageDraw
    rows = [(scene_id, [Image.open(p).convert("RGB") for p in paths]) for scene_id, paths in frames.items() if paths]
    if not rows:
        raise ValueError("no frames")
    ratio = rows[0][1][0].height / rows[0][1][0].width
    height = round(width * ratio)
    columns = max(len(images) for _, images in rows)
    sheet = Image.new("RGB", (width * columns, height * len(rows)), "white")
    draw = ImageDraw.Draw(sheet)
    for row, (scene_id, images) in enumerate(rows):
        for column, image in enumerate(images):
            sheet.paste(image.resize((width, height)), (column * width, row * height))
        draw.rectangle((0, row * height, 34, row * height + 14), fill="black")
        draw.text((3, row * height + 2), scene_id, fill="white")
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    return path


def capture(service: StudioProjectService, project_id: str, per_scene: int = 3, out: Path | None = None) -> dict:
    snapshot = service.visual.snapshot(project_id)
    build = snapshot.get("build")
    if not build or build.get("revision") != snapshot.get("revision"):
        raise SystemExit("Bản dựng không khớp nguồn hình ảnh hiện tại: dựng lại trước khi chụp.")
    frames = service.visual.review_frames(project_id, plan_times(build, per_scene))
    result = {"build_id": build["id"], "scenes": frames}
    if out is not None:
        out.mkdir(parents=True, exist_ok=True)
        copied = {}
        for scene_id, paths in frames.items():
            copied[scene_id] = [str(shutil.copy2(p, out / f"{scene_id}-{Path(p).name}")) for p in paths]
        result["scenes"] = copied
        result["sheet"] = str(contact_sheet(copied, out / "contact-sheet.png"))
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--projects-root", required=True, type=Path)
    parser.add_argument("--project", required=True)
    parser.add_argument("--per-scene", type=int, default=3)
    parser.add_argument("--out", type=Path, default=None, help="copy the frames here and write contact-sheet.png")
    args = parser.parse_args(argv)
    service = StudioProjectService(args.projects_root)
    result = capture(service, args.project, args.per_scene, args.out)
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
