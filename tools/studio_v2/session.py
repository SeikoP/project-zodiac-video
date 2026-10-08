"""Shared Job@5 import and execution session for Studio frontends."""

from __future__ import annotations

import json
from threading import Event
from pathlib import Path
from typing import Any
import zipfile

from tools.control_plane.errors import ControlPlaneError
from tools.studio_v2.controller import StudioV2Controller, _package_hash
from tools.control_plane.package_validation import validate_job5_package_root
from tools.studio_v2.state import save_state
from tools.studio_v2.executor import ExecutorConfig, StudioV2Executor
from tools.studio_v2.pipeline import (
    AUDIO,
    DONE,
    FAILED,
    OUTPUT,
    PACKAGE,
    PENDING,
    PLAN,
    RENDER,
    RUNNING,
    TIMING,
    VOICE,
    PipelineStateV2,
)


_LABELS = {
    PACKAGE: "GÓI",
    VOICE: "GIỌNG",
    TIMING: "TIMING",
    PLAN: "KẾ HOẠCH",
    RENDER: "RENDER",
    AUDIO: "ÂM THANH",
    OUTPUT: "OUTPUT",
}

_GLYPHS = {
    DONE: "✓",
    RUNNING: "●",
    FAILED: "✕",
    PENDING: "○",
}


def _read_manifest(root: Path) -> dict[str, Any]:
    path = Path(root) / "package-manifest.json"
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message=f"cannot read package-manifest.json: {exc}",
        ) from exc
    if not isinstance(value, dict):
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="package-manifest.json root must be an object",
        )
    return value


def detect_job5_manifest(source: Path) -> dict[str, Any] | None:
    source = Path(source).resolve()
    if source.is_dir():
        if not (source / "package-manifest.json").is_file():
            return None
        manifest = _read_manifest(source)
        return manifest if manifest.get("format") == "zodiac-job@5" else None
    if not source.is_file() or source.suffix.casefold() != ".zip":
        return None

    try:
        with zipfile.ZipFile(source) as handle:
            infos = [info for info in handle.infolist() if not info.is_dir()]
            names = [info.filename.replace("\\", "/") for info in infos]
            if "package-manifest.json" in names:
                manifest_name = "package-manifest.json"
            else:
                candidates = [
                    name for name in names
                    if name.endswith("/package-manifest.json") and len(name.split("/")) == 2
                ]
                if len(candidates) != 1:
                    return None
                manifest_name = candidates[0]
            info = infos[names.index(manifest_name)]
            if info.file_size > 64 * 1024:
                raise ControlPlaneError(
                    code="PACKAGE_INVALID",
                    stage="PACKAGE",
                    message="package-manifest.json is larger than 64 KiB",
                )
            manifest = json.loads(handle.read(info).decode("utf-8"))
    except (OSError, zipfile.BadZipFile):
        return None
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message=f"cannot read package-manifest.json: {exc}",
        ) from exc
    if not isinstance(manifest, dict):
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="package-manifest.json root must be an object",
        )
    return manifest if manifest.get("format") == "zodiac-job@5" else None


def job5_workspace_path(
    workspace_root: Path,
    manifest: dict[str, Any],
    *,
    archive_name: str | None = None,
) -> Path:
    del archive_name
    job = manifest.get("job")
    if not isinstance(job, dict):
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="zodiac-job@5 manifest is missing stable job identity",
        )
    job_id = job.get("id")
    if not isinstance(job_id, str) or not job_id:
        raise ControlPlaneError(
            code="PACKAGE_INVALID",
            stage="PACKAGE",
            message="zodiac-job@5 job.id is invalid",
        )
    jobs_root = Path(workspace_root).resolve() / "v2" / "jobs"
    target = jobs_root / job_id
    if target.resolve().parent != jobs_root.resolve() or target.is_symlink():
        raise ControlPlaneError(code="PACKAGE_INVALID", stage="PACKAGE",
                                message="job.id must name one safe workspace directory")
    return target


def _error_detail(error: dict[str, Any] | None) -> str:
    if not error:
        return ""
    code = str(error.get("code") or "UNKNOWN")
    message = str(error.get("message") or "")
    context = " · ".join(
        str(value)
        for value in (
            error.get("scene_id"),
            error.get("event_id"),
            error.get("target"),
        )
        if value
    )
    if code == "TIMING_ALIGNMENT_FAILED" and ("ALIGNMENT_MISMATCH" in message or "TIMING_REVIEW_REQUIRED" in message):
        import re
        match = re.search(r"\b(S\d+)(?:\.wav|\b)", message)
        scene = match.group(1) if match else "scene không xác định"
        message = f"{scene}: lời đọc và ASR chưa khớp. Xem nhật ký và kiểm tra WAV."
    elif len(message) > 180:
        message = message[:177] + "..."
    result = f"{code}: {message}".strip()
    return f"{result} · {context}" if context else result


def v2_pipeline_rows(state: PipelineStateV2) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for step in (PACKAGE, VOICE, TIMING, PLAN, RENDER, AUDIO, OUTPUT):
        item = state.steps[step]
        detail = _error_detail(item.error)
        if not detail and item.status == DONE:
            detail = item.cache_reason or ("Dùng lại" if item.reused else "Tạo mới")
        rows.append(
            {
                "step": step,
                "label": _LABELS[step],
                "status": item.status,
                "glyph": _GLYPHS.get(item.status, "?"),
                "progress": 1.0 if item.status == DONE else (0.5 if item.status == RUNNING else 0.0),
                "scene_done": 0,
                "scene_total": 0,
                "detail": detail,
                "reused": item.reused,
            }
        )
    return rows



class StudioV2Session:
    """Import, resume, and execute one Job@5 workspace."""

    def __init__(
        self,
        workspace_root: Path,
        *,
        executor_factory=StudioV2Executor,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.executor_factory = executor_factory
        self.controller: StudioV2Controller | None = None
        self.executor: StudioV2Executor | None = None
        self.manifest: dict[str, Any] | None = None
        self.archive: Path | None = None
        self._job: Path | None = None
        self.running = False
        self.status_text = "Chưa nạp zodiac-job@5."
        self.last_error: dict[str, Any] | None = None
        self.cancel_event = Event()

    def open_workspace(self, workspace: Path) -> Path:
        workspace = Path(workspace).resolve()
        if workspace.parent != self.workspace_root / "v2" / "jobs":
            raise ValueError("Job nằm ngoài thư mục workspace.")
        package = validate_job5_package_root(workspace, local_workspace=True)
        manifest = package["manifest"]
        if job5_workspace_path(self.workspace_root, manifest) != workspace:
            raise ValueError("Danh tính job không khớp thư mục workspace.")
        controller = StudioV2Controller(workspace)
        package_hash = _package_hash(workspace)
        if controller.state.package.package_hash != package_hash:
            controller.state.invalidate_for("package")
        for step in controller.state.steps.values():
            if step.status == RUNNING:
                step.reset()
        controller.state.set_package_revision(
            display_name=workspace.name, package_hash=package_hash,
            package_version=str(manifest["producer"]["version"]),
        )
        controller.state.mark_done(PACKAGE, input_hash=package_hash,
                                   output_hash=package_hash, reused=True)
        save_state(workspace, controller.state)
        self.controller = controller
        self.executor = self.executor_factory(controller)
        self.manifest = manifest
        self.archive = None
        self._job = workspace
        self.last_error = None
        self.status_text = f"Đã mở lại Job@5: {workspace.name}."
        return workspace

    def cancel(self) -> None:
        self.cancel_event.set()

    @property
    def job(self) -> Path | None:
        return self._job

    @property
    def job_name(self) -> str | None:
        return self._job.name if self._job is not None else None

    @property
    def package_revision(self) -> str | None:
        job = (self.manifest or {}).get("job")
        if not isinstance(job, dict):
            return None
        value = job.get("revision")
        return str(value) if value is not None else None

    @property
    def video_path(self) -> Path | None:
        if self._job is None:
            return None
        return self._job / "out" / "zodiac-story.mp4"

    def import_archive(self, archive: Path) -> Path:
        archive = Path(archive).resolve()
        manifest = detect_job5_manifest(archive)
        if manifest is None:
            raise ControlPlaneError(
                code="PACKAGE_FORMAT_UNSUPPORTED",
                stage="PACKAGE",
                message="archive is not zodiac-job@5",
                detail={"path": str(archive)},
            )
        workspace = job5_workspace_path(
            self.workspace_root,
            manifest,
            archive_name=archive.name,
        )
        controller = StudioV2Controller(workspace)
        controller.import_package(archive)

        self.controller = controller
        self.executor = self.executor_factory(controller)
        self.manifest = manifest
        self.archive = archive
        self._job = workspace
        self.last_error = None
        self.status_text = (
            f"Đã nhập job@5 {manifest['job']['id']} "
            f"revision {manifest['job']['revision']}."
        )
        return workspace

    def pipeline_rows(self) -> list[dict[str, Any]]:
        if self.controller is None:
            return v2_pipeline_rows(PipelineStateV2(workspace_id="inactive"))
        return v2_pipeline_rows(self.controller.state)

    def run(self, config: ExecutorConfig, *, rerun_from: str | None = None):
        if self.controller is None or self.executor is None:
            raise ControlPlaneError(
                code="PACKAGE_NOT_READY",
                stage="PACKAGE",
                message="import a zodiac-job@5 package before running Studio v2",
            )
        self.running = True
        self.last_error = None
        self.status_text = "Studio v2 đang chạy."
        try:
            state = self.executor.run(config, rerun_from=rerun_from,
                                      cancel_event=self.cancel_event)
        except ControlPlaneError as exc:
            self.last_error = exc.to_dict()
            self.status_text = f"{exc.stage} [{exc.code}] {exc.message}"
            raise
        except Exception as exc:
            self.status_text = f"Job@5 không hoàn tất: {exc}"
            raise
        else:
            self.status_text = "Studio v2 hoàn tất."
            return state
        finally:
            self.running = False
