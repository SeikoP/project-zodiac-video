"""One application service for current Job@5 execution and explicit legacy compatibility."""

from __future__ import annotations

from dataclasses import dataclass
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Callable

from tools.application.compat import LegacyCompatibilityAdapter
from tools.studio_v2.executor import ExecutorConfig
from tools.studio_v2.session import StudioV2Session, detect_job5_manifest

MODE_CURRENT = "job5"
MODE_LEGACY = "legacy"
MODE_NONE = "none"


@dataclass(frozen=True)
class ApplicationOpenResult:
    mode: str
    path: Path | None
    package_conflict: bool = False


@dataclass(frozen=True)
class ApplicationLaunchSpec:
    command: tuple[str, ...]
    cwd: Path
    message: str


@dataclass(frozen=True)
class ApplicationRunRequest:
    resume: bool = True
    rerun: str | None = None
    voice: str | None = None
    music: Path | None = None
    volume: float = 1.0
    align_model: str = "small"
    scene_gap_ms: float = 180.0


@dataclass(frozen=True)
class ApplicationObservers:
    legacy_event: Callable[[str, dict], None] | None = None
    subprocess: Callable[..., None] | None = None
    native: Callable[..., None] | None = None
    unit: Callable[..., None] | None = None
    frame: Callable[..., None] | None = None


class ApplicationService:
    """Route package lifecycle through one current-path API.

    Job@5 is the primary path. Legacy behavior is reachable only through the
    compatibility adapter and never selected as an implicit fallback for a
    package that declares Job@5.
    """

    def __init__(
        self,
        workspace_root: Path,
        *,
        tts_root: Path | None = None,
        vieneu_url: str | None = "http://127.0.0.1:7860",
        current_factory=StudioV2Session,
        compat_factory=LegacyCompatibilityAdapter,
        detector=detect_job5_manifest,
    ) -> None:
        self.workspace_root = Path(workspace_root).resolve()
        self.tts_root = Path(tts_root).resolve() if tts_root is not None else None
        self.vieneu_url = vieneu_url
        self.detector = detector
        self.current = current_factory(self.workspace_root)
        self.compat = compat_factory(
            self.workspace_root,
            tts_root=self.tts_root,
            vieneu_url=self.vieneu_url,
        )
        self.mode = MODE_NONE

    @property
    def active(self):
        if self.mode == MODE_CURRENT:
            return self.current
        if self.mode == MODE_LEGACY:
            return self.compat
        return None

    @property
    def job(self) -> Path | None:
        active = self.active
        return active.job if active is not None else None

    @property
    def video_path(self) -> Path | None:
        active = self.active
        return active.video_path if active is not None else None

    @property
    def package_revision(self) -> str | None:
        active = self.active
        return active.package_revision if active is not None else None

    @property
    def status_text(self) -> str:
        active = self.active
        return active.status_text if active is not None else "Chưa mở công việc."

    @property
    def running(self) -> bool:
        active = self.active
        return bool(active and active.running)

    def open(self, operation: str, source: Path) -> ApplicationOpenResult:
        if operation not in {"import", "open"}:
            raise ValueError(f"unsupported application operation: {operation}")
        source = Path(source).resolve()
        v2_root = self.workspace_root / "v2" / "jobs"
        is_current = (
            operation == "open" and source.parent == v2_root
        ) or (
            operation == "import" and self.detector(source) is not None
        )
        if is_current:
            path = self.current.import_archive(source) if operation == "import" else self.current.open_workspace(source)
            self.mode = MODE_CURRENT
            return ApplicationOpenResult(mode=self.mode, path=path)

        result = self.compat.import_archive(source) if operation == "import" else self.compat.open_workspace(source)
        self.mode = MODE_LEGACY
        return ApplicationOpenResult(
            mode=self.mode,
            path=result.path,
            package_conflict=bool(result.package_conflict),
        )

    def resolve_package_conflict(self, action: str) -> ApplicationOpenResult:
        if self.mode != MODE_LEGACY:
            raise RuntimeError("package conflict resolution is legacy-only")
        result = self.compat.resolve_package_conflict(action)
        return ApplicationOpenResult(mode=MODE_LEGACY, path=result.path)

    def pipeline_rows(self) -> list[dict]:
        active = self.active
        return active.pipeline_rows() if active is not None else []

    def cancel(self) -> None:
        active = self.active
        if active is not None:
            active.cancel()

    def _current_config(self, request: ApplicationRunRequest) -> ExecutorConfig:
        return ExecutorConfig(
            voice_profile=request.voice,
            tts_settings={
                "mode": "v3turbo",
                "vieneu_url": self.vieneu_url,
                "tts_root": self.tts_root,
                "scene_gap_ms": float(request.scene_gap_ms),
            },
            tts_engine_version="vieneu-v3turbo@local-v1",
            aligner_settings={
                "model": request.align_model,
                "device": "cpu",
                "compute_type": "int8",
                "scene_gap_ms": float(request.scene_gap_ms),
                "sentence_pause_ms": 0.0,
            },
            aligner_version="faster-whisper@local-v1",
            renderer_version="2.0.0",
            renderer_hash="zodiac-renderer@2.0.0",
            music_path=request.music,
            mix_settings={"volume": float(request.volume)},
        )

    def run(self, request: ApplicationRunRequest, observers: ApplicationObservers | None = None) -> bool:
        if self.mode == MODE_LEGACY:
            return bool(self.compat.run(request, observers))
        if self.mode != MODE_CURRENT:
            raise RuntimeError("open a package before running the application service")

        if hasattr(self.current, "cancel_event"):
            self.current.cancel_event.clear()
        config = self._current_config(request)
        rerun_from = request.rerun if request.rerun else (None if request.resume else "VOICE")
        if observers is None or not any((observers.subprocess, observers.native, observers.unit, observers.frame)):
            self.current.run(config, rerun_from=rerun_from)
            return True

        from tools.runner.observers import current_runner_observers

        with current_runner_observers(observers):
            self.current.run(config, rerun_from=rerun_from)
        return True

    def preflight_checker(self):
        if self.mode == MODE_CURRENT:
            from tools.studio.preflight import Job5PreflightChecker

            if self.job is None:
                raise RuntimeError("no current job")
            return Job5PreflightChecker(self.job, tts_root=self.tts_root, vieneu_url=self.vieneu_url)
        if self.mode == MODE_LEGACY:
            return self.compat.preflight_checker()
        raise RuntimeError("open a package before preflight")

    def dependency_install_plan(self) -> tuple[list[list[str]], list[str]]:
        checker = self.preflight_checker()
        checks = checker.run()
        missing_checks = [check for check in checks if check.error_code == "DEPENDENCY_MISSING"]
        missing = [f"{check.label}: {check.message}" for check in missing_checks]
        if not missing:
            return [], []
        if hasattr(checker, "install_commands"):
            return checker.install_commands(missing_checks), missing
        command = checker.install_command()
        return ([command] if command else []), missing

    def execute_install(self, commands: list[list[str]], *, log_callback=None) -> tuple[int, str | None]:
        if self.mode == MODE_LEGACY:
            return self.compat.install_dependencies(log_callback=log_callback)
        if self.mode != MODE_CURRENT:
            raise RuntimeError("open a package before installing dependencies")
        try:
            code = 0
            for command in commands:
                if log_callback is not None:
                    log_callback("$ " + " ".join(command))
                process = subprocess.Popen(
                    command, cwd=self.workspace_root.parent if self.workspace_root.name == ".zodiac-work" else Path.cwd(),
                    stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
                    encoding="utf-8", errors="replace", shell=False,
                )
                if process.stdout is not None:
                    for line in process.stdout:
                        if log_callback is not None:
                            log_callback(line.rstrip())
                code = process.wait()
                if code:
                    break
            return code, None
        except Exception as exc:
            return 1, str(exc)

    def remotion_launch_spec(self, project_root: Path) -> ApplicationLaunchSpec:
        project_root = Path(project_root).resolve()
        if self.job is None:
            raise RuntimeError("open a package before launching Remotion Studio")
        if self.mode == MODE_LEGACY:
            return ApplicationLaunchSpec(
                command=(sys.executable, "tools/zodiac_local.py", "preview", self.job.name, "--workspace", str(self.workspace_root)),
                cwd=project_root,
                message="Đang mở Remotion Studio cho job compatibility.",
            )
        if self.mode != MODE_CURRENT:
            raise RuntimeError("open a package before launching Remotion Studio")
        if not (self.job / ".runtime" / "render-plan.json").is_file():
            raise RuntimeError("Chạy bước PLAN trước khi mở Remotion Studio.")
        from tools.studio_v2.controller import workspace_renderer_version
        renderer = project_root / "runtime" / "zodiac-renderer" / workspace_renderer_version(self.job) / "renderer"
        script = renderer / "scripts" / "open-studio.mjs"
        node = shutil.which("node")
        if not node or not script.is_file():
            raise RuntimeError("Thiếu Node hoặc trình khởi chạy Remotion Studio Job@5.")
        return ApplicationLaunchSpec(
            command=(node, str(script), str(self.job)),
            cwd=renderer,
            message="Đang mở Remotion Studio với render plan và asset thật của Job@5.",
        )
