#!/usr/bin/env python3
"""StudioController: view models and commands. No Tk widgets live here."""

from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
import zipfile
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
    PREPARE_RENDERER,
    STEP_ORDER,
    VALIDATE_RUNTIME,
    PipelinePlan,
)
from tools.studio.preflight import PreflightChecker, describe_missing, environment_status
from tools.zodiac_local import (
    DEFAULT_MUSIC_VOLUME,
    PipelineError,
    artifact_fingerprints,
    file_sha256,
    validate_package,
)


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
        self.archive_content_identity: str | None = None
        self.job: Path | None = None
        self.job_content_identity: str | None = None
        self.plan = PipelinePlan(job="")
        self.store: JobStateStore | None = None
        self.worker = None
        self.preflight_checks: list = []
        self.status_text = NO_RESUME_MESSAGE

    # ---- paths -------------------------------------------------------
    @property
    def jobs_dir(self) -> Path:
        return self.workspace / "jobs"

    @staticmethod
    def _package_owned_relative(relative: str) -> bool:
        relative = relative.replace("\\", "/").lstrip("/")
        exact = {
            "package-manifest.json",
            "production.json",
            "narration.txt",
            "design.md",
            "README.md",
        }
        if relative in exact:
            return True
        return relative.startswith(("assets/", "publish/", "renderer/"))

    @staticmethod
    def _identity_rows(rows: list[dict[str, str]]) -> str:
        payload = json.dumps(
            sorted(rows, key=lambda item: item["path"]),
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        ).encode("utf-8")
        return hashlib.sha256(payload).hexdigest()

    def _workspace_content_identity(self, root: Path | None) -> str | None:
        if root is None or not Path(root).is_dir():
            return None
        root = Path(root).resolve()
        rows: list[dict[str, str]] = []
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(root).as_posix()
            if not self._package_owned_relative(relative):
                continue
            rows.append(
                {
                    "path": relative,
                    "sha256": file_sha256(path),
                }
            )
        return self._identity_rows(rows) if rows else None

    def _archive_content_identity(self, archive: Path | None) -> str | None:
        if archive is None or not Path(archive).is_file():
            return None
        try:
            with zipfile.ZipFile(archive) as handle:
                files = [
                    info.filename.replace("\\", "/").lstrip("/")
                    for info in handle.infolist()
                    if not info.is_dir()
                ]
                if "production.json" in files:
                    prefix = ""
                else:
                    production_candidates = [
                        name
                        for name in files
                        if name.endswith("/production.json")
                    ]
                    if len(production_candidates) != 1:
                        return None
                    prefix = production_candidates[0][: -len("production.json")]
                rows: list[dict[str, str]] = []
                for info in handle.infolist():
                    if info.is_dir():
                        continue
                    name = info.filename.replace("\\", "/").lstrip("/")
                    if prefix:
                        if not name.startswith(prefix):
                            continue
                        relative = name[len(prefix):]
                    else:
                        relative = name
                    if not self._package_owned_relative(relative):
                        continue
                    rows.append(
                        {
                            "path": relative,
                            "sha256": hashlib.sha256(handle.read(info)).hexdigest(),
                        }
                    )
                return self._identity_rows(rows) if rows else None
        except (OSError, zipfile.BadZipFile):
            return None

    def job_name_for(self, archive: Path) -> str:
        import re

        stem = Path(archive).stem.replace("-render-ready", "")
        stem = re.sub(r"-v\d+(?:\.\d+)*$", "", stem, flags=re.IGNORECASE)
        return re.sub(r"[^a-zA-Z0-9._-]+", "-", stem).strip("-.").lower()

    def is_versioned_patch_archive(self, archive: Path) -> bool:
        import re

        return bool(
            re.search(
                r"-v\d+(?:\.\d+)*$",
                Path(archive).stem,
                flags=re.IGNORECASE,
            )
        )

    def archive_destination(self, archive: Path) -> Path:
        """Public archive-to-workspace resolver used by every UI/import path."""
        return self._destination_for_archive(archive)

    def _destination_for_archive(self, archive: Path) -> Path:
        """Resolve one stable workspace for every patch of the same sign/concept."""
        logical = self.job_name_for(archive)
        exact = self.jobs_dir / logical
        if exact.exists():
            return exact
        if (
            self.job is not None
            and self.job.exists()
            and self.job.parent == self.jobs_dir.resolve()
            and self.job_name_for(Path(self.job.name + ".zip")) == logical
        ):
            return self.job
        if self.jobs_dir.is_dir():
            candidates = [
                item
                for item in self.jobs_dir.iterdir()
                if item.is_dir()
                and self.job_name_for(Path(item.name + ".zip")) == logical
            ]
            if candidates:
                return max(candidates, key=lambda item: item.stat().st_mtime)
        return exact

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
        self.archive_content_identity = self._archive_content_identity(self.archive)
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
        """True when selected ZIP content differs from the package-owned workspace payload."""
        if self.archive is None or self.job is None:
            return False
        if not (self.job / "production.json").is_file():
            return True
        if self.archive_content_identity is not None:
            current = self.job_content_identity or self._workspace_content_identity(self.job)
            return self.archive_content_identity != current
        # Fallback only for unreadable/legacy archives; content identity owns
        # normal patch detection and repairs poisoned historical fingerprints.
        return self.archive_fingerprint != self.stored_fingerprint

    def sync_package(self) -> bool:
        """Import the selected ZIP when the workspace does not already hold it."""
        if self.archive is None:
            return False
        name = self.job_name_for(self.archive)
        destination = self._destination_for_archive(self.archive)
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
        self.job_content_identity = self._workspace_content_identity(self.job)
        # Health checks belong to one concrete job/runtime snapshot. Reusing
        # checks from the previously selected job makes the TUI show stale green
        # lights while a new package is still being validated.
        self.preflight_checks = []

    def accept_package_conflict(self, choice: str) -> bool:
        """Resolve a changed ZIP without throwing away expensive job artifacts.

        The selected archive is validated in a scratch job first. Only creative
        package files are then replaced in-place; .runtime/, approved voice
        takes, timing, and prior render outputs stay available for deterministic
        invalidation/reuse.
        """
        if choice == "keep":
            self.select_archive(None)
            if self.job is not None and (self.job / "production.json").is_file():
                self.plan.mark(IMPORT_PACKAGE, DONE)
                if self.store is not None:
                    self.store.save(self.plan)
            return False
        if choice != "import" or self.archive is None:
            return False

        name = self.job_name_for(self.archive)
        destination = self._destination_for_archive(self.archive)
        before = artifact_fingerprints(destination) if destination.exists() else {}
        old_voice = self._voice_signature(destination)

        self.workspace.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix=".zodiac-import-", dir=str(self.workspace)) as scratch:
            imported = import_package(self.archive, Path(scratch) / "jobs", name)
            after = artifact_fingerprints(imported)
            new_voice = self._voice_signature(imported)

            if destination.exists():
                self._replace_creative_payload(imported, destination)
            else:
                self.jobs_dir.mkdir(parents=True, exist_ok=True)
                shutil.move(str(imported), str(destination))

        self.use_job(destination)
        self._reconcile_package_refresh(before, after, old_voice, new_voice)
        self._remember_fingerprint()
        producer, sha = self._package_identity()
        self.status_text = f"Đã nhập patch: {producer}; production {sha}."
        return True

    @staticmethod
    def _voice_signature(root: Path) -> list[tuple[str, str]]:
        import json

        path = Path(root) / "production.json"
        try:
            production = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError):
            return []
        rows: list[tuple[str, str]] = []
        for scene in production.get("scenes") or []:
            if isinstance(scene, dict):
                rows.append((str(scene.get("id") or ""), str(scene.get("voice") or "")))
        return rows

    @staticmethod
    def _replace_creative_payload(source: Path, destination: Path) -> None:
        """Replace package-owned files while preserving local runtime artifacts."""
        source = Path(source)
        destination = Path(destination)
        destination.mkdir(parents=True, exist_ok=True)
        package_roots = (
            "package-manifest.json",
            "production.json",
            "narration.txt",
            "design.md",
            "assets",
            "publish",
            "README.md",
        )
        for name in package_roots:
            src = source / name
            dst = destination / name
            if dst.is_dir():
                shutil.rmtree(dst)
            elif dst.exists():
                dst.unlink()
            if src.is_dir():
                shutil.copytree(src, dst)
            elif src.is_file():
                shutil.copy2(src, dst)

    def _reconcile_package_refresh(
        self,
        before: dict,
        after: dict,
        old_voice: list[tuple[str, str]],
        new_voice: list[tuple[str, str]],
    ) -> None:
        """Invalidate the cheapest safe suffix after an in-place package refresh."""
        if self.store is None:
            return

        if old_voice != new_voice:
            old_by_id = dict(old_voice)
            new_ids = {scene_id for scene_id, _ in new_voice}
            checkpoints = self.plan.steps[VOICE_SCENES].scenes
            self.plan.steps[VOICE_SCENES].scenes = {
                scene_id: entry
                for scene_id, entry in checkpoints.items()
                if scene_id in new_ids
            }
            for scene_id, voice in new_voice:
                if old_by_id.get(scene_id) != voice:
                    self.plan.set_scene_state(VOICE_SCENES, scene_id, PENDING)
            # Reordered scenes still need concat/timing rebuilt even when every
            # individual WAV can be reused.
            self.plan.mark(
                VOICE_SCENES,
                PENDING,
                message="Package mới thay đổi lời thoại hoặc thứ tự scene.",
            )
            self.plan.invalidate_from(CONCAT_VOICE)
        elif before.get("creative") != after.get("creative"):
            # Layout/assets/design/runtime reference changed; voice and measured
            # timing remain valid, but runtime validation/render no longer are.
            self.plan.invalidate_from(VALIDATE_RUNTIME)
        elif before.get("publish") != after.get("publish"):
            if before.get("cover_spec") != after.get("cover_spec"):
                # Cover composition is renderer input.
                self.plan.invalidate_from(PREPARE_RENDERER)
            else:
                # Caption/hashtags/copy do not justify a video re-render. The
                # final mix step also refreshes publish outputs.
                self.plan.invalidate_from(MIX_MUSIC)

        self.plan.mark(IMPORT_PACKAGE, DONE)
        self.store.save(self.plan)

    def apply_change(self, change: str, *, changed_scenes: list[str] | None = None) -> None:
        """Apply a UI edit and persist the invalidation immediately."""
        self.plan.apply_change(change, changed_scenes=changed_scenes)
        if self.store is not None:
            self.store.save(self.plan)

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

    def install_dependencies(self, *, log_callback=None) -> None:
        """Explicit, user-triggered install using the running interpreter.

        Output is never inherited by the terminal. Textual owns the screen, so
        pip stdout/stderr must be forwarded through the log callback instead.
        """
        checker = self.preflight()
        command = checker.install_command()
        self.status_text = "Đang cài dependency…"
        if log_callback is not None:
            log_callback("$ " + " ".join(command))
        try:
            result = subprocess_run(command, on_line=log_callback)
        except OSError as exc:
            self.status_text = f"Không cài được dependency: {exc}"
            if log_callback is not None:
                log_callback(self.status_text)
            return
        if result.returncode == 0:
            self.run_preflight()
            self.status_text = "Đã cài dependency và kiểm tra lại môi trường."
        else:
            self.status_text = (
                f"Không cài được dependency (exit {result.returncode}). "
                "Xem nhật ký để biết lý do."
            )
        if log_callback is not None:
            log_callback(self.status_text)

    def _package_identity(self) -> tuple[str, str]:
        import json

        producer = "unknown"
        manifest = self.job / "package-manifest.json" if self.job else None
        if manifest is not None and manifest.is_file():
            try:
                payload = json.loads(manifest.read_text(encoding="utf-8"))
                producer_data = payload.get("producer") or {}
                producer = (
                    f"{producer_data.get('plugin', 'unknown')}@"
                    f"{producer_data.get('version', 'unknown')}"
                )
            except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                producer = "unknown"
        production = self.job / "production.json" if self.job else None
        sha = file_sha256(production)[:12] if production is not None and production.is_file() else "missing"
        return producer, sha

    def _validate_current_package_before_run(self) -> bool:
        if self.job is None:
            return False
        try:
            validate_package(self.job)
        except PipelineError as exc:
            self.plan.mark(
                IMPORT_PACKAGE,
                FAILED,
                error_code="PACKAGE_INVALID",
                message="Gói video không hợp lệ; hãy nạp bản vá hợp lệ trước khi chạy.",
                details=str(exc),
            )
            if self.store is not None:
                self.store.save(self.plan)
            producer, sha = self._package_identity()
            self.status_text = (
                f"Gói video không hợp lệ ({producer}, production {sha}): "
                f"{str(exc).splitlines()[0][:180]}"
            )
            return False
        return True

    # ---- pipeline -----------------------------------------------------
    def pipeline_rows(self) -> list[dict]:
        rows = []
        package_changed = self.package_changed
        for step in STEP_ORDER:
            state = self.plan.steps[step]
            stale_downstream = package_changed and step != IMPORT_PACKAGE
            rows.append(
                {
                    "step": step,
                    "name": STEP_NAMES_VI[step],
                    "status": PENDING if stale_downstream else state.status,
                    "error_code": "" if stale_downstream else state.error_code,
                    "message": (
                        "Chờ nhập ZIP mới; kết quả job trước chỉ được giữ làm cache."
                        if stale_downstream
                        else state.message
                    ),
                    "progress": 0.0 if stale_downstream else state.progress,
                    "scenes": {} if stale_downstream else dict(state.scenes),
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
        if self.package_changed:
            self.status_text = "Gói ZIP đã thay đổi. Hãy chọn nhập lại hoặc giữ job cũ."
            return False
        if self.worker is not None and self.worker.is_alive():
            self.status_text = "Pipeline đang chạy."
            return False
        if not self._validate_current_package_before_run():
            return False
        if rerun:
            # Guard conflict/running state before mutating the persisted plan.
            self.plan.invalidate_from(rerun, drop_scene_checkpoints=True)
            if self.store is not None:
                self.store.save(self.plan)
        start = self.plan.continue_from() if resume else self.plan.next_step()
        if start is None:
            self.status_text = NO_RESUME_MESSAGE
            return False
        return self._start_worker(
            start,
            voice=voice,
            music=music,
            volume=volume,
            align_model=align_model,
            stop_after=stop_after,
        )

    def _start_worker(
        self,
        start_step: str,
        *,
        voice: str | None = None,
        music: Path | None = None,
        volume: float | None = None,
        align_model: str | None = None,
        stop_after: str | None = None,
    ) -> bool:
        from tools.studio.worker import PipelineWorker

        if self.package_changed:
            self.status_text = "Gói ZIP đã thay đổi. Hãy chọn nhập lại hoặc giữ job cũ."
            return False
        from tools.studio.worker import DEFAULT_TTS_MODE, DEFAULT_VOICE

        self.worker = PipelineWorker(
            self.job,
            plan=self.plan,
            on_event=self.handle_event,
            voice=voice or DEFAULT_VOICE,
            tts_mode=DEFAULT_TTS_MODE,
            align_model=align_model or ALIGN_MODEL_DEFAULT,
            music=music,
            music_volume=DEFAULT_MUSIC_VOLUME if volume is None else volume,
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
        return True

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


def subprocess_run(command: list[str], *, on_line=None):
    import subprocess

    process = subprocess.Popen(
        command,
        shell=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    lines: list[str] = []
    assert process.stdout is not None
    for raw in process.stdout:
        line = raw.rstrip("\r\n")
        lines.append(raw)
        if on_line is not None and line:
            on_line(line)
    returncode = process.wait()
    return subprocess.CompletedProcess(
        command,
        returncode,
        "".join(lines),
        None,
    )


def import_package(archive: Path, jobs_dir: Path, name: str) -> Path:
    from tools.zodiac_local import import_package as _import

    return _import(archive, jobs_dir, name)