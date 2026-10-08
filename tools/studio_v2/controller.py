from __future__ import annotations

import hashlib
import json
from pathlib import Path
import shutil
from typing import Any

from tools.control_plane.cache import plan_key
from tools.control_plane.contracts import (
    canonical_contract_hash,
    validate_contract_shape,
)
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.render_plan import validate_render_plan
from tools.control_plane.timeline import compile_render_plan

from .pipeline import DONE, PACKAGE, PLAN, TIMING, PipelineStateV2
from .runner import run_structured_command
from .state import save_state


_ROOT = Path(__file__).resolve().parents[2]


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
        self.state = PipelineStateV2(workspace_id=self.workspace.name)

    def import_package(self, source: Path) -> Path:
        source = Path(source).resolve()
        manifest = _read_json(
            source / "package-manifest.json",
            code="PACKAGE_INVALID",
            stage="PACKAGE",
        )
        issues = validate_contract_shape("zodiac-job-v5", manifest)
        if issues:
            raise ControlPlaneError(
                code="PACKAGE_INVALID",
                stage="PACKAGE",
                message="package manifest does not match zodiac-job@5",
                detail={"issues": [{"path": item.path, "message": item.message} for item in issues]},
            )

        expected_hash = canonical_contract_hash("authoring-ir-v1")
        contract = manifest["contract"]
        if contract["sha256"] != expected_hash:
            raise ControlPlaneError(
                code="PACKAGE_CONTRACT_MISMATCH",
                stage="PACKAGE",
                message="package authoring contract hash does not match canonical local contract",
                detail={"expected": expected_hash, "actual": contract["sha256"]},
            )
        renderer = manifest["renderer"]
        if renderer != {"id": "zodiac-renderer", "version": "2.0.0"}:
            raise ControlPlaneError(
                code="PACKAGE_RENDERER_MISMATCH",
                stage="PACKAGE",
                message="package requires an unsupported renderer",
                detail={"renderer": renderer},
            )

        required = ("production.ir.json", "design-token.json", "narration.txt")
        for relative in required:
            if not (source / relative).is_file():
                raise ControlPlaneError(
                    code="PACKAGE_INVALID",
                    stage="PACKAGE",
                    message=f"package is missing {relative}",
                    detail={"path": relative},
                )

        for relative in ("package-manifest.json", *required):
            shutil.copy2(source / relative, self.workspace / relative)
        source_assets = source / "assets"
        if source_assets.is_dir():
            target_assets = self.workspace / "assets"
            if target_assets.exists():
                shutil.rmtree(target_assets)
            shutil.copytree(source_assets, target_assets)

        runtime = self.workspace / ".runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        source_timing = source / "timing.json"
        if source_timing.is_file():
            timing_target = runtime / "timing.json"
            shutil.copy2(source_timing, timing_target)
            timing_hash = _sha256_file(timing_target)
            self.state.mark_done(
                TIMING,
                input_hash=timing_hash,
                output_hash=timing_hash,
                reused=True,
            )

        package_hash = _package_hash(self.workspace)
        producer_version = str(manifest["producer"]["version"])
        self.state.set_package_revision(
            display_name=source.name,
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
            / "2.0.0"
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
