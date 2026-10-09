from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
import tempfile
from typing import Any

from tools.control_plane.cache import plan_key
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_io import extract_package_archive
from tools.control_plane.package_validation import validate_job5_package_root
from tools.control_plane.render_plan import validate_render_plan
from tools.control_plane.segments import plan_segments, props_for_segment, scene_asset_ids
from tools.control_plane.timeline import compile_render_plan

from .pipeline import PACKAGE, PLAN, PipelineStateV2
from .runner import run_structured_command
from .state import load_state, save_state


_ROOT = Path(__file__).resolve().parents[2]


_SUPPORTED_RENDERER_VERSIONS = {"2.0.0", "2.0.1"}


def workspace_renderer_version(workspace: Path) -> str:
    """Use the imported Job@5 pin; never choose a renderer from global defaults."""
    manifest_path = Path(workspace) / "package-manifest.json"
    if not manifest_path.is_file():
        return "2.0.0"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        renderer = manifest["renderer"]
        if renderer.get("id") != "zodiac-renderer":
            raise ValueError("unsupported renderer identity")
        version = renderer["version"]
    except (OSError, UnicodeError, ValueError, KeyError, TypeError, AttributeError) as exc:
        raise ControlPlaneError(
            code="PACKAGE_RENDERER_MISMATCH", stage="PACKAGE",
            message=f"cannot resolve imported renderer: {exc}",
        ) from exc
    if version not in _SUPPORTED_RENDERER_VERSIONS:
        raise ControlPlaneError(
            code="PACKAGE_RENDERER_MISMATCH", stage="PACKAGE",
            message=f"unsupported renderer version {version!r}",
        )
    return version


def _read_json(path: Path, *, code: str, stage: str) -> dict[str, Any]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code=code,
            stage=stage,
            message=f"cannot read {path.name}: {exc}",
            detail={"path": str(path)},
        ) from exc
    if not isinstance(payload, dict):
        raise ControlPlaneError(
            code=code,
            stage=stage,
            message=f"{path.name} root must be an object",
            detail={"path": str(path)},
        )
    return payload


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _package_hash(root: Path) -> str:
    rows: list[tuple[str, str]] = []
    for relative in (
        "package-manifest.json",
        "production.ir.json",
        "design-token.json",
        "narration.txt",
        "publish/publish.json",
        "publish/publish-copy.txt",
    ):
        path = root / relative
        if path.is_file():
            rows.append((relative, _sha256_file(path)))
    assets = root / "assets"
    if assets.is_dir():
        for path in sorted(assets.rglob("*")):
            if path.is_file():
                rows.append((path.relative_to(root).as_posix(), _sha256_file(path)))
    return _sha256_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")))


class StudioV2Controller:
    def __init__(self, workspace: Path) -> None:
        self.workspace = Path(workspace).resolve()
        self.workspace.mkdir(parents=True, exist_ok=True)
        self.state = load_state(self.workspace) or PipelineStateV2(
            workspace_id=self.workspace.name
        )

    def import_package(self, source: Path) -> Path:
        source = Path(source).expanduser()
        if source.is_symlink():
            raise ControlPlaneError(
                code="PACKAGE_CONTENT_INVALID",
                stage="PACKAGE",
                message="package source must not be a symbolic link",
                detail={"path": str(source)},
            )
        source = source.resolve()
        if source.is_dir():
            return self._import_package_root(source, display_name=source.name)
        if source.is_file() and source.suffix.casefold() == ".zip":
            with tempfile.TemporaryDirectory(prefix="zodiac-job5-import-") as temp:
                package_root = extract_package_archive(
                    source,
                    Path(temp) / "package",
                )
                return self._import_package_root(
                    package_root,
                    display_name=source.name,
                )
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="package source must be a directory or .zip archive",
            detail={"path": str(source)},
        )

    def _import_package_root(self, source: Path, *, display_name: str) -> Path:
        package = validate_job5_package_root(source)
        manifest = package["manifest"]
        for relative in (
            "package-manifest.json",
            "production.ir.json",
            "design-token.json",
            "narration.txt",
        ):
            shutil.copy2(source / relative, self.workspace / relative)

        target_assets = self.workspace / "assets"
        source_assets = source / "assets"
        if target_assets.exists():
            shutil.rmtree(target_assets)
        if source_assets.is_dir():
            shutil.copytree(source_assets, target_assets)

        target_publish = self.workspace / "publish"
        if target_publish.exists():
            shutil.rmtree(target_publish)
        shutil.copytree(source / "publish", target_publish)

        package_hash = _package_hash(self.workspace)
        producer_version = str(manifest["producer"]["version"])
        self.state.set_package_revision(
            display_name=display_name,
            package_hash=package_hash,
            package_version=producer_version,
        )
        self.state.mark_done(
            PACKAGE,
            input_hash=package_hash,
            output_hash=package_hash,
            reused=False,
        )
        save_state(self.workspace, self.state)
        return self.workspace

    def build_plan(self) -> Path:
        ir = _read_json(
            self.workspace / "production.ir.json",
            code="AUTHORING_IR_INVALID",
            stage="PACKAGE",
        )
        timing = _read_json(
            self.workspace / ".runtime" / "timing.json",
            code="TIMING_INVALID",
            stage="TIMING",
        )
        design = _read_json(
            self.workspace / "design-token.json",
            code="DESIGN_TOKEN_INVALID",
            stage="PLAN",
        )
        plan = compile_render_plan(ir, timing, design)
        validate_render_plan(plan, ir)

        runtime = self.workspace / ".runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        path = runtime / "render-plan.json"
        normalized = json.dumps(
            plan,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        ) + "\n"
        path.write_text(normalized, encoding="utf-8", newline="\n")

        timing_hash = _sha256_file(runtime / "timing.json")
        input_hash = plan_key(
            _sha256_file(self.workspace / "production.ir.json"),
            timing_hash,
            _sha256_file(self.workspace / "design-token.json"),
            "1.0.0",
        )
        self.state.mark_done(
            PLAN,
            input_hash=input_hash,
            output_hash=_sha256_file(path),
            reused=False,
        )
        save_state(self.workspace, self.state)
        return path

    def prepare_renderer(self) -> Path:
        script = (
            _ROOT
            / "runtime"
            / "zodiac-renderer"
            / workspace_renderer_version(self.workspace)
            / "renderer"
            / "scripts"
            / "prepare.mjs"
        )
        run_structured_command(
            ["node", str(script), str(self.workspace)],
            stage="RENDER",
            fallback_code="RENDERER_PREPARE_FAILED",
        )
        output = self.workspace / ".runtime" / "renderer-v2-props.json"
        if not output.is_file():
            raise ControlPlaneError(
                code="RENDERER_PREPARE_FAILED",
                stage="RENDER",
                message="renderer prepare completed without renderer-v2-props.json",
            )
        return output

    def _write_preview_props(self, scene_ids: list[str], preview_id: str) -> Path:
        props_path = self.prepare_renderer()
        props = _read_json(props_path, code="RENDERER_PROPS_INVALID", stage="RENDER")
        selected = set(scene_ids)
        scenes = [scene for scene in props.get("scenes", []) if scene.get("id") in selected]
        if len(scenes) != len(selected):
            raise ControlPlaneError(
                code="PREVIEW_SCENE_MISSING",
                stage="RENDER",
                message="preview references a scene that is absent from the current plan",
                detail={"scene_ids": scene_ids},
            )
        segment = {
            "scene_ids": scene_ids,
            "start_frame": min(int(scene["start_frame"]) for scene in scenes),
            "asset_ids": sorted(set().union(*(scene_asset_ids(scene) for scene in scenes))),
        }
        output = self.workspace / ".runtime" / "previews" / f"{preview_id}.props.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(props_for_segment(props, segment), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        return output

    def prepare_scene_preview(self, scene_id: str) -> Path:
        return self._write_preview_props([scene_id], f"scene-{_sha256_text(scene_id)[:16]}")

    def prepare_segment_preview(self, segment_id: str) -> Path:
        props = _read_json(
            self.prepare_renderer(),
            code="RENDERER_PROPS_INVALID",
            stage="RENDER",
        )
        version = workspace_renderer_version(self.workspace)
        segments = plan_segments(
            props,
            renderer_version=version,
            renderer_hash=f"zodiac-renderer@{version}",
        )
        segment = next((item for item in segments if item["segment_id"] == segment_id), None)
        if segment is None:
            raise ControlPlaneError(
                code="PREVIEW_SEGMENT_MISSING",
                stage="RENDER",
                message=f"segment {segment_id!r} is not present in the current plan",
            )
        output = self.workspace / ".runtime" / "previews" / f"segment-{segment_id}.props.json"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(
            json.dumps(props_for_segment(props, segment), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        return output
