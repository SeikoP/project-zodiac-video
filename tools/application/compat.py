"""Explicit compatibility adapter for pre-Job@5 local packages."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from tools.studio.controller import StudioController
from tools.studio.pipeline import CANCELLED, DONE, FAILED, PENDING, RUNNING, SKIPPED


LEGACY_STAGES = {
    "PACKAGE": ("IMPORT_PACKAGE",),
    "VOICE": ("VOICE_SCENES", "CONCAT_VOICE"),
    "TIMING": ("ALIGN_TIMING", "VALIDATE_RUNTIME"),
    "PLAN": ("PREPARE_RENDERER",),
    "RENDER": ("RENDER_VIDEO",),
    "AUDIO": ("MIX_MUSIC",),
    "OUTPUT": ("MIX_MUSIC",),
}

LEGACY_RERUN = {
    "PACKAGE": "IMPORT_PACKAGE",
    "VOICE": "VOICE_SCENES",
    "TIMING": "ALIGN_TIMING",
    "PLAN": "PREPARE_RENDERER",
    "RENDER": "RENDER_VIDEO",
    "AUDIO": "MIX_MUSIC",
}


@dataclass(frozen=True)
class CompatibilityOpenResult:
    path: Path | None
    package_conflict: bool = False


class LegacyCompatibilityAdapter:
    """Own every legacy-specific controller decision behind one boundary."""

    def __init__(
        self,
        workspace_root: Path,
        *,
        tts_root: Path | None = None,
        vieneu_url: str | None = "http://127.0.0.1:7860",
        controller_factory=StudioController,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.controller = controller_factory(
            self.workspace_root,
            tts_root=tts_root,
            vieneu_url=vieneu_url,
        )

    @property
    def job(self) -> Path | None:
        return self.controller.job

    @property
    def video_path(self) -> Path | None:
        return self.controller.video_path

    @property
    def package_revision(self) -> None:
        return None

    @property
    def status_text(self) -> str:
        return self.controller.status_text

    @property
    def running(self) -> bool:
        worker = self.controller.worker
        return bool(worker and worker.is_alive())

    def import_archive(self, source: Path) -> CompatibilityOpenResult:
        self.controller.select_archive(Path(source))
        if self.controller.package_changed:
            return CompatibilityOpenResult(path=self.controller.job, package_conflict=True)
        self.controller.sync_package()
        return CompatibilityOpenResult(path=self.controller.job)

    def open_workspace(self, source: Path) -> CompatibilityOpenResult:
        self.controller.use_job(Path(source))
        return CompatibilityOpenResult(path=self.controller.job)

    def resolve_package_conflict(self, action: str) -> CompatibilityOpenResult:
        if action not in {"import", "keep"}:
            raise ValueError(f"unsupported package conflict action: {action}")
        self.controller.accept_package_conflict(action)
        return CompatibilityOpenResult(path=self.controller.job)

    def pipeline_rows(self) -> list[dict[str, Any]]:
        source = {row["step"]: row for row in self.controller.pipeline_rows()}
        rows: list[dict[str, Any]] = []
        rank = {FAILED: 5, RUNNING: 4, PENDING: 3, CANCELLED: 2, SKIPPED: 1, DONE: 0}
        for stage, steps in LEGACY_STAGES.items():
            candidates = [source[step] for step in steps if step in source]
            active = max(candidates, key=lambda row: rank.get(row["status"], 0), default={})
            states = [row["status"] for row in candidates]
            status = DONE if states and all(state in (DONE, SKIPPED) for state in states) else active.get("status", PENDING)
            rows.append(
                {
                    "step": stage,
                    "status": status,
                    "detail": active.get("message", ""),
                    "progress": active.get("progress", 0.0),
                }
            )
        return rows

    def run(self, request, observers=None) -> bool:
        rerun_step = LEGACY_RERUN.get(request.rerun) if request.rerun else None
        on_event = getattr(observers, "legacy_event", None) if observers else None
        started = self.controller.start_pipeline(
            resume=request.resume,
            rerun=rerun_step,
            voice=request.voice,
            music=request.music,
            volume=request.volume,
            align_model=request.align_model,
            on_event=on_event,
        )
        if not started:
            return False
        worker = self.controller.worker
        if worker is not None:
            worker.join()
        return True

    def cancel(self) -> None:
        self.controller.cancel()

    def preflight_checker(self):
        return self.controller.preflight()

    def install_dependencies(self, *, log_callback: Callable[[str], None] | None = None) -> tuple[int, str | None]:
        try:
            self.controller.install_dependencies(log_callback=log_callback)
            status = self.controller.status_text
            code = 0 if status.startswith("Đã cài") else 1
            return code, None if code == 0 else status
        except Exception as exc:  # GUI boundary preserves exact diagnostic text.
            return 1, str(exc)
