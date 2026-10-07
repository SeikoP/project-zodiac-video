#!/usr/bin/env python3
"""StudioController: view models and commands. No Tk widgets live here."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path

from tools.studio.job_state import JobStateStore
from tools.studio.messages_vi import (
    ALIGN_MODEL_DEFAULT,
    ERROR_TITLES_BY_STEP,
    NO_RESUME_MESSAGE,
    PIPELINE_CANCELLED_MESSAGE,
    PIPELINE_DONE_MESSAGE,
    STEP_NAMES_VI,
)
from tools.studio.pipeline import (
    CANCELLED,
    PENDING,
    DONE,
    FAILED,
    IMPORT_PACKAGE,
    MIX_MUSIC,
    STEP_ORDER,
    PipelinePlan,
)
from tools.studio.preflight import PreflightChecker, describe_missing, environment_status


class StudioController:
    """Owns job paths, the plan, the worker and every user command."""

    def __init__(
        self,
        workspace: Path,
        *,
        tts_root: Path | None = None,
        vieneu_url: str | None = "http://127.0.0.1:7860",
    ) -> None:
        self.workspace = Path(workspace).resolve()
        self.tts_root = tts_root
        self.vieneu_url = vieneu_url

        self.archive: Path | None = None
        self.archive_fingerprint: str | None = None
        self.job: Path | None = None
        self.plan = PipelinePlan(job="")
        self.store: JobStateStore | None = None
        self.worker = None
        self.preflight_checks: list = []
        self.status_text = NO_RESUME_MESSAGE

    # ---- paths -------------------------------------------------------
    @property
    def jobs_dir(self) -> Path:
        return self.workspace / "jobs"

    def job_name_for(self, archive: Path) -> str:
        import re

        stem = Path(archive).stem.replace("-render-ready", "")
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-.").lower()

    @property
    def job_name(self) -> str:
        return self.job.name if self.job else ""

    def available_jobs(self) -> list[str]:
        if not self.jobs_dir.is_dir():
            return []
        return sorted(item.name for item in self.jobs_dir.iterdir() if item.is_dir())

    def job_path(self, name: str) -> Path:
        return self.jobs_dir / name

    @property
    def video_path(self) -> Path | None:
        if not self.job:
            return None
        return self.job / "out" / "zodiac-story.mp4"

    @property
    def cover_path(self) -> Path | None:
        if not self.job:
            return None
        return self.job / "out" / "cover.png"

    @property
    def stored_fingerprint(self) -> str | None:
        if self.plan.fingerprint:
            return self.plan.fingerprint
        payload = self.store.load() if self.store else None
        return (payload or {}).get("package_fingerprint")

    # ---- project selection -------------------------------------------
    def select_archive(self, archive: Path | None) -> None:
        self.archive = Path(archive) if archive else None
        self.archive_fingerprint = self._fingerprint(self.archive) if self.archive else None
        if self.package_changed:
            # The workspace no longer matches the selected package, so the import
            # step is no longer valid and the pipeline must not reuse the cache.
            self.plan.mark(IMPORT_PACKAGE, PENDING, message="Gói đã chọn khác với job trong workspace.")

    def _fingerprint(self, archive: Path) -> str:
        from tools.zodiac_local import file_sha256

        try:
            return file_sha256(archive)
        except OSError:
            return ""

    @property
    def package_changed(self) -> bool:
        """True when the selected ZIP is not the package currently in the workspace."""
        if self.archive is None or self.job is None:
            return False
        if not (self.job / "production.json").is_file():
            return True
        return self.archive_fingerprint != self.stored_fingerprint

    def sync_package(self) -> bool:
        """Import the selected ZIP when the workspace does not already hold it."""
        if self.archive is None:
            return False
        name = self.job_name_for(self.archive)
        destination = self.jobs_dir / name
        if destination.exists() and self.package_changed:
            return False
        if not destination.exists():
            import_package(self.archive, self.jobs_dir, name)
        self.use_job(destination)
        self._remember_fingerprint()
        return True

    def _remember_fingerprint(self) -> None:
        """The selected archive is now the imported package, not a stale cache."""
        if self.archive_fingerprint is None or self.store is None:
            return
        self.plan.fingerprint = self.archive_fingerprint
        self.store.save(self.plan)

    def use_job(self, job: Path) -> None:
        self.job = Path(job).resolve()
        self.store = JobStateStore(self.job)
        self.plan = self.store.open()
        self.plan.fingerprint = self.stored_fingerprint or self.plan.fingerprint

    def accept_package_conflict(self, choice: str) -> bool:
        """Explicit user decision for a stale package: import again or keep the old job."""
        if choice == "keep":
            # Working with the already imported job: drop the stale selection and
            # keep the import checkpoint that produced this job.
            self.select_archive(None)
            if self.job is not None and (self.job / "production.json").is_file():
                self.plan.mark(IMPORT_PACKAGE, DONE)
            return False
        if choice != "import" or self.archive is None:
            return False
        name = self.job_name_for(self.archive)
        destination = self.jobs_dir / name

        # Validate the new archive in a scratch workspace first, so a broken ZIP
        # never destroys the job the user still has.
        with tempfile.TemporaryDirectory(prefix=".zodiac-import-", dir=str(self.workspace)) as scratch:
            imported = import_package(self.archive, Path(scratch) / "jobs", name)
            if self.job is not None and self.job.exists():
                shutil.rmtree(self.job)
            self.jobs_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(imported), str(destination))

        self.use_job(destination)
        self._remember_fingerprint()
        return True

    # ---- preflight ----------------------------------------------------
    def preflight(self, *, require_music: bool = False) -> PreflightChecker:
        return PreflightChecker(
            self.job,
            tts_root=self.tts_root,
            vieneu_url=self.vieneu_url,
            require_music=require_music,
        )

    def run_preflight(self) -> list:
        self.preflight_checks = self.preflight().run()
        return self.preflight_checks

    def environment_label(self) -> str:
        if not self.preflight_checks:
            return environment_status(self.preflight().run())
        return environment_status(self.preflight_checks)

    def dependencies_missing(self) -> str:
        """Vietnamese bullet list of missing dependencies, empty when ready."""
        checker = self.preflight()
        return describe_missing(PreflightChecker.dependency_checks(checker.run()))

    def install_command_text(self) -> str:
        return self.preflight().install_command_text()

    def install_dependencies(self) -> None:
        """Explicit, user-triggered install using the running interpreter."""
        from tools.studio.worker import PipelineWorker

        checker = self.preflight()
        command = checker.install_command()
        self.status_text = "Đang cài dependency…"
        process = PipelineWorker(self.job or self.workspace) if self.job else None
        try:
            result = subprocess_run(command)
        except OSError as exc:
            self.status_text = f"Không cài được dependency: {exc}"
            return
        if result.returncode == 0:
            self.run_preflight()
            self.status_text = "Đã cài dependency và kiểm tra lại môi trường."
        else:
            self.status_text = "Không cài được dependency. Xem nhật ký để biết lý do."

    # ---- pipeline -----------------------------------------------------
    def pipeline_rows(self) -> list[dict]:
        rows = []
        for step in STEP_ORDER:
            state = self.plan.steps[step]
            rows.append(
                {
                    "step": step,
                    "name": STEP_NAMES_VI[step],
                    "status": state.status,
                    "error_code": state.error_code,
                    "message": state.message,
                    "progress": state.progress,
                    "scenes": dict(state.scenes),
                }
            )
        return rows

    def can_continue(self) -> bool:
        return bool(self.plan.can_resume)

    def continue_from_label(self) -> str:
        step = self.plan.continue_from()
        return STEP_NAMES_VI.get(step, NO_RESUME_MESSAGE) if step else NO_RESUME_MESSAGE

    def start_pipeline(
        self,
        *,
        resume: bool = True,
        rerun: str | None = None,
        voice: str | None = None,
        music: Path | None = None,
        volume: float | None = None,
        align_model: str | None = None,
        stop_after: str | None = None,
    ) -> bool:
        if self.job is None:
            self.status_text = "Chưa có job. Hãy chọn gói video trước."
            return False
        if rerun:
            # An explicit rerun really redoes the step, scene reuse included.
            self.plan.invalidate_from(rerun, drop_scene_checkpoints=True)
        start = self.plan.continue_from() if resume else self.plan.next_step()
        if start is None:
            self.status_text = NO_RESUME_MESSAGE
            return False
        self._start_worker(
            start,
            voice=voice,
            music=music,
            volume=volume,
            align_model=align_model,
            stop_after=stop_after,
        )
        return True

    def _start_worker(
        self,
        start_step: str,
        *,
        voice: str | None = None,
        music: Path | None = None,
        volume: float | None = None,
        align_model: str | None = None,
        stop_after: str | None = None,
    ) -> None:
        from tools.studio.worker import PipelineWorker

        if self.package_changed:
            self.status_text = "Gói ZIP đã thay đổi. Hãy chọn nhập lại hoặc giữ job cũ."
            return
        from tools.studio.worker import DEFAULT_TTS_MODE, DEFAULT_VOICE

        self.worker = PipelineWorker(
            self.job,
            plan=self.plan,
            on_event=self.handle_event,
            voice=voice or DEFAULT_VOICE,
            tts_mode=DEFAULT_TTS_MODE,
            align_model=align_model or ALIGN_MODEL_DEFAULT,
            music=music,
            music_volume=1.0 if volume is None else volume,
            tts_root=self.tts_root,
            vieneu_url=self.vieneu_url,
            workspace=self.workspace,
            archive=self.archive,
            job_name=self.job.name,
        )
        effective_start = self.worker.plan.continue_from() or start_step
        self.status_text = f"Đang chạy: {STEP_NAMES_VI[effective_start]}"
        self.worker.start(
            effective_start,
            stop_after=stop_after,
        )  # background thread; UI stays responsive

    def handle_event(self, kind: str, payload: dict) -> None:
        """Called by the worker thread; the app forwards these to the Tk queue."""
        if kind == "LOG_LINE":
            return
        if kind == "STEP_FAILED":
            self.status_text = payload.get("message") or "Bước này thất bại."
        elif kind == "STEP_DONE":
            self.status_text = f"Xong: {STEP_NAMES_VI.get(payload.get('step'), '')}"
        elif kind == "PIPELINE_DONE":
            stop_after = payload.get("stop_after")
            if payload.get("partial") and stop_after:
                self.status_text = f"Đã hoàn tất đến: {STEP_NAMES_VI.get(stop_after, stop_after)}"
            else:
                self.status_text = PIPELINE_DONE_MESSAGE
        elif kind == "PIPELINE_CANCELLED":
            self.status_text = PIPELINE_CANCELLED_MESSAGE

    def error_title(self, step: str) -> str:
        return ERROR_TITLES_BY_STEP.get(step, "Đã xảy ra lỗi")

    def cancel(self) -> None:
        if self.worker is not None:
            self.worker.request_cancel()
            self.status_text = "Đang dừng…"

    def check_only(self) -> list:
        checks = self.run_preflight()
        failures = [check for check in checks if not check.ok]
        self.status_text = "Đã kiểm tra xong." if not failures else "Kiểm tra không đạt."
        return checks

    # ---- editor -------------------------------------------------------
    def editor_available(self) -> bool:
        if self.job is None:
            return False
        import json

        production = self.job / "production.json"
        if not production.is_file():
            return False
        try:
            return json.loads(production.read_text(encoding="utf-8")).get("version") == "2.0"
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return False


def subprocess_run(command: list[str]):
    import subprocess

    return subprocess.run(command, shell=False)


def import_package(archive: Path, jobs_dir: Path, name: str) -> Path:
    from tools.zodiac_local import import_package as _import

    return _import(archive, jobs_dir, name)