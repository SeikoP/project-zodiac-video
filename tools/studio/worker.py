#!/usr/bin/env python3
"""PipelineWorker: runs the resumable pipeline on a background thread.

All business logic lives in tools/zodiac_local; this module only sequences the
granular operations, checkpoints per-scene state and streams structured events.
"""

from __future__ import annotations

import os
import queue
import signal
import subprocess
import threading
from pathlib import Path

from tools.studio.preflight import PreflightChecker
from tools.studio.job_state import JobStateStore
from tools.studio.pipeline import (
    ALIGN_TIMING,
    STEP_ORDER,
    CANCELLED,
    CONCAT_VOICE,
    DONE,
    FAILED,
    IMPORT_PACKAGE,
    MIX_MUSIC,
    PENDING,
    PipelinePlan,
    PREFLIGHT,
    PREPARE_RENDERER,
    RENDER_VIDEO,
    RUNNING,
    SKIPPED,
    VALIDATE_RUNTIME,
    VOICE_SCENES,
)
from tools.zodiac_local import (
    DEFAULT_SPEECH_RATE_WARNING_WPS,
    DEFAULT_TTS_BACKEND,
    DEFAULT_TTS_FRAME_CAP,
    DEFAULT_TTS_MAX_CHARS,
    DEFAULT_TTS_PRECISION,
    DEFAULT_TTS_ROOT,
    PipelineError,
    aligner_install_command,
    align_scene_timings,
    build_and_write_timing,
    concatenate_scene_voices,
    effective_tts_generation_config,
    file_sha256,
    generate_scene_voices,
    import_package,
    load_word_aligner,
    mix_background_music_into_render,
    prepare_renderer,
    recover_scene_alignment_with_adaptive_frame_cap,
    render_video,
    require_word_aligner_installed,
    scene_voice_files,
    scene_wav_path,
    tts_scene_frame_cap_retry_eligible,
    validate_package,
    validate_runtime,
    validate_voice,
)

STEP_STARTED = "STEP_STARTED"
STEP_PROGRESS = "STEP_PROGRESS"
STEP_DONE = "STEP_DONE"
STEP_FAILED = "STEP_FAILED"
PIPELINE_DONE = "PIPELINE_DONE"
PIPELINE_CANCELLED = "PIPELINE_CANCELLED"
LOG_LINE = "LOG_LINE"

from tools.studio.messages_vi import ALIGN_MODEL_DEFAULT

DEFAULT_VOICE = "Hải Đăng"
DEFAULT_TTS_MODE = "v3turbo"

# Which failure code a step reports, so the UI never degrades to "exit code 2".
STEP_ERROR_CODES = {
    IMPORT_PACKAGE: "PACKAGE_INVALID",
    PREFLIGHT: "DEPENDENCY_MISSING",
    VOICE_SCENES: "VOICE_SCENE_FAILED",
    CONCAT_VOICE: "VOICE_INVALID",
    ALIGN_TIMING: "ALIGNMENT_MISMATCH",
    VALIDATE_RUNTIME: "TIMING_INVALID",
    PREPARE_RENDERER: "RENDERER_INVALID",
    RENDER_VIDEO: "RENDER_FAILED",
    MIX_MUSIC: "MIX_FAILED",
}


class CancelledError(Exception):
    """Raised inside the worker when the user pressed Dừng."""


def terminate_process_tree(process: subprocess.Popen) -> None:
    """Windows: taskkill /T. POSIX: signal the whole process group."""
    if process.poll() is not None:
        return
    if os.name == "nt":
        subprocess.run(
            ["taskkill", "/T", "/F", "/PID", str(process.pid)],
            capture_output=True,
            check=False,
            shell=False,
        )
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        return


class PipelineWorker:
    def __init__(
        self,
        package_root: Path,
        *,
        plan: PipelinePlan | None = None,
        on_event=None,
        voice: str = DEFAULT_VOICE,
        tts_mode: str = DEFAULT_TTS_MODE,
        align_model: str = ALIGN_MODEL_DEFAULT,
        tts_root: Path | None = None,
        vieneu_url: str | None = None,
        tts_backend: str = DEFAULT_TTS_BACKEND,
        tts_precision: str = DEFAULT_TTS_PRECISION,
        tts_frame_cap: str = DEFAULT_TTS_FRAME_CAP,
        tts_max_chars: int = DEFAULT_TTS_MAX_CHARS,
        speech_rate_warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
        tts_fp32_fallback: bool = True,
        music: Path | None = None,
        music_volume: float = 1.0,
        workspace: Path | None = None,
        archive: Path | None = None,
        job_name: str | None = None,
    ) -> None:
        self.root = Path(package_root).resolve()
        self.store = JobStateStore(self.root)
        self.plan = plan or self.store.open()
        self.on_event = on_event or (lambda kind, payload: None)
        self.voice = voice
        self.tts_mode = tts_mode
        self.align_model = align_model or ALIGN_MODEL_DEFAULT
        self.tts_root = tts_root
        self.vieneu_url = vieneu_url
        self.tts_backend = tts_backend
        self.tts_precision = tts_precision
        self.tts_frame_cap = tts_frame_cap
        self.tts_max_chars = int(tts_max_chars)
        self.speech_rate_warning_wps = float(speech_rate_warning_wps)
        self.tts_fp32_fallback = bool(tts_fp32_fallback)
        self.music = Path(music) if music else None
        self.music_volume = music_volume
        self.workspace = Path(workspace) if workspace else None
        self.archive = Path(archive) if archive else None
        self.job_name = job_name

        self._durations: dict[str, float] = {}
        self._cancel = threading.Event()
        self._process: subprocess.Popen | None = None
        self._thread: threading.Thread | None = None
        self._scenes_lock = threading.Lock()

        self._invalidate_incompatible_voice_cache()

    def _voice_cache_fields(self) -> dict:
        config = effective_tts_generation_config(
            mode=self.tts_mode,
            vieneu_url=self.vieneu_url,
            backend=self.tts_backend,
            precision=self.tts_precision,
            frame_cap=self.tts_frame_cap,
            max_chars=self.tts_max_chars,
        )
        return {
            "tts_transport": config["transport"],
            "tts_backend": config["backend"],
            "tts_precision": config["precision"],
            "tts_frame_cap": config["frame_cap"],
            "tts_max_chars": config["max_chars"],
            "tts_fp32_fallback": self.tts_fp32_fallback,
            "speech_rate_warning_wps": self.speech_rate_warning_wps,
        }

    def _invalidate_incompatible_voice_cache(self) -> None:
        expected = self._voice_cache_fields()
        incompatible = []
        for scene_id, entry in self.plan.steps[VOICE_SCENES].scenes.items():
            if entry.get("status") != DONE:
                continue
            # Voice/mode changes have their own explicit invalidation path. This
            # automatic migration only invalidates otherwise-compatible cached
            # scenes whose generation settings changed across app versions.
            if (
                entry.get("voice_id") != self.voice
                or entry.get("tts_mode") != self.tts_mode
            ):
                continue
            if any(entry.get(key) != value for key, value in expected.items()):
                incompatible.append(scene_id)

        if not incompatible:
            return
        for scene_id in incompatible:
            self.plan.set_scene_state(VOICE_SCENES, scene_id, PENDING)
        self.plan.invalidate_from(VOICE_SCENES)
        self.log(
            "Đã vô hiệu cache giọng cũ do cấu hình TTS thay đổi: "
            + ", ".join(incompatible)
        )

    # ---- lifecycle ---------------------------------------------------
    def start(self, start_step: str | None = None) -> None:
        if self._thread is not None:
            raise RuntimeError("worker already started")
        self._thread = threading.Thread(target=self.run_to_completion, args=(start_step,), daemon=True)
        self._thread.start()

    def join(self, timeout: float | None = None) -> None:
        if self._thread is not None:
            self._thread.join(timeout)

    def is_alive(self) -> bool:
        return bool(self._thread and self._thread.is_alive())

    def request_cancel(self) -> None:
        self._cancel.set()
        if self._process is not None:
            terminate_process_tree(self._process)

    def attach_process(self, process: subprocess.Popen) -> None:
        """Register an external subprocess so cancel can kill its tree."""
        self._process = process

    @property
    def cancelled(self) -> bool:
        return self._cancel.is_set()

    # ---- events ------------------------------------------------------
    def emit(self, kind: str, **payload) -> None:
        self.on_event(kind, payload)

    def log(self, text: str) -> None:
        self.emit(LOG_LINE, text=str(text))

    def _checkpoint(self) -> None:
        self.store.save(self.plan)

    # ---- main loop ---------------------------------------------------
    def run_to_completion(self, start_step: str | None = None) -> PipelinePlan:
        steps = list(self._steps_from(start_step))
        for step in steps:
            if self._cancel.is_set():
                self.plan.mark(step, CANCELLED, error_code="CANCELLED_BY_USER", message="Đã dừng theo yêu cầu.")
                self._checkpoint()
                break
            try:
                self._run_step(step)
            except CancelledError:
                self.plan.mark(
                    step,
                    CANCELLED,
                    error_code="CANCELLED_BY_USER",
                    message="Đã dừng theo yêu cầu.",
                )
                self._checkpoint()
                self.emit(PIPELINE_CANCELLED, step=step)
                return self.plan
            except Exception as exc:
                self._fail(step, exc)
                state = self.plan.steps[step]
                self.emit(
                    STEP_FAILED,
                    step=step,
                    error_code=state.error_code,
                    message=state.message,
                    details=state.details,
                )
                return self.plan
        self._checkpoint()
        self.emit(PIPELINE_DONE, plan=self.plan.to_dict())
        return self.plan

    def run_from(self, start_step: str | None) -> PipelinePlan:
        """Public alias used by the controller when the user presses Tiếp tục."""
        return self.run_to_completion(start_step)

    def _steps_from(self, start_step: str | None):
        if start_step is None:
            start_step = self.plan.continue_from()
            if start_step is None:
                start_step = self.plan.next_step()
        if start_step is None:
            return []
        index = STEP_ORDER.index(start_step)
        return STEP_ORDER[index:]

    def _fail(self, step: str, exc: Exception) -> None:
        message, code = self._classify(step, exc)
        self.plan.mark(
            step,
            FAILED,
            error_code=code,
            message=message,
            details=str(exc),
        )
        if step == VOICE_SCENES:
            for scene_id, entry in self.plan.steps[VOICE_SCENES].scenes.items():
                if entry.get("status") == RUNNING:
                    self.plan.set_scene_state(VOICE_SCENES, scene_id, FAILED)
        self._checkpoint()

    def _classify(self, step: str, exc: Exception) -> tuple[str, str]:
        """Stable error code per step; the UI must never show a bare exit code."""
        text = str(exc)
        lowered = text.lower()
        code = STEP_ERROR_CODES.get(step, "SUBPROCESS_FAILED")
        message = f"Không hoàn tất được bước này: {text.splitlines()[0][:200]}"

        if "faster-whisper" in lowered or "faster_whisper" in lowered:
            code = "DEPENDENCY_MISSING" if step == PREFLIGHT else "ALIGNER_LOAD_FAILED"
            message = (
                "Thiếu thư viện faster-whisper trong Python đang chạy Zodiac Studio. "
                "Cài dependency rồi chạy lại."
            )
        elif "does not match approved narration" in lowered:
            code = "ALIGNMENT_MISMATCH"
            message = "Căn thời gian từ không khớp lời thoại đã duyệt. Sửa TTS hoặc lời thoại rồi thạ lại."
        elif "node.js" in lowered or "npm" in lowered:
            code = "NODE_MISSING"
            message = "Thiếu Node.js/npm để chạy renderer."
        elif "ffmpeg" in lowered:
            code = "FFMPEG_MISSING"
            message = "Thiếu FFmpeg trên PATH."
        elif "vieneu" in lowered:
            code = "VIENEU_UNAVAILABLE"
            message = "Không tạo được giọng đọc từ VieNeu."
        return (message, code)

    # ---- steps -------------------------------------------------------
    def _raise_if_cancelled(self) -> None:
        if self._cancel.is_set():
            raise CancelledError("dừng theo yêu cầu")

    def _run_step(self, step: str) -> None:
        self._raise_if_cancelled()
        self.plan.mark(step, RUNNING)
        self._checkpoint()
        self.emit(STEP_STARTED, step=step, name=self.plan.steps[step].name)

        handler = {
            IMPORT_PACKAGE: self._step_import,
            PREFLIGHT: self._step_preflight,
            VOICE_SCENES: self._step_voice_scenes,
            CONCAT_VOICE: self._step_concat,
            ALIGN_TIMING: self._step_align,
            VALIDATE_RUNTIME: self._step_validate_runtime,
            PREPARE_RENDERER: self._step_prepare_renderer,
            RENDER_VIDEO: self._step_render,
            MIX_MUSIC: self._step_mix,
        }[step]
        handler()

        if self.plan.status(step) != SKIPPED:
            self.plan.complete_step(step)
        self._checkpoint()
        self.emit(STEP_DONE, step=step, status=self.plan.status(step))

    # ---- individual steps --------------------------------------------
    def _production(self) -> dict:
        return validate_package(self.root)

    def _step_import(self) -> None:
        if self.archive is None or self.workspace is None:
            self.log("Gói video đã có sẵn trong workspace.")
            return
        jobs_dir = Path(self.workspace) / "jobs"
        destination = jobs_dir / (self.job_name or self.root.name)
        if destination.resolve() != self.root:
            raise RuntimeError("Thư mục job không khớp gói được chọn.")
        import_package(self.archive, jobs_dir, self.job_name)

    def _step_preflight(self) -> None:

        require_word_aligner_installed()
        checks = PreflightChecker(
            self.root,
            tts_root=self.tts_root,
            vieneu_url=self.vieneu_url,
        ).run()
        blocking = [check for check in checks if not check.ok]
        if blocking:
            lines = "\n".join(f"• {check.message}" for check in blocking)
            raise RuntimeError(f"Môi trường chưa sẵn sàng:\n{lines}\n{aligner_install_command()}")

    def _step_voice_scenes(self) -> None:

        require_word_aligner_installed()
        production = self._production()
        pending: list[str] = []
        for scene in production["scenes"]:
            scene_id = scene["id"]
            path = scene_wav_path(self.root, scene_id)
            if self._scene_reusable(scene, path):
                self.plan.set_scene_state(
                    VOICE_SCENES,
                    scene_id,
                    DONE,
                    text_hash=self._text_hash(scene),
                    voice_id=self.voice,
                    tts_mode=self.tts_mode,
                    file_hash=file_sha256(path),
                    **self._voice_cache_fields(),
                )
                self.log(f"{scene_id}: dùng lại giọng đã tạo.")
                continue
            self.plan.set_scene_state(VOICE_SCENES, scene_id, RUNNING)
            self._checkpoint()
            self.emit(STEP_PROGRESS, step=VOICE_SCENES, scene_id=scene_id)
            pending.append(scene_id)

        if not pending:
            self.log("Tất cả giọng scene đã có, bỏ qua bước tạo giọng.")
            return

        self.log(f"Đang tạo giọng cho: {', '.join(pending)}")
        try:
            durations = generate_scene_voices(
                self.root,
                production,
                pending,
                tts_root=self.tts_root or DEFAULT_TTS_ROOT,
                voice=self.voice,
                mode=self.tts_mode,
                vieneu_url=self.vieneu_url,
                backend=self.tts_backend,
                precision=self.tts_precision,
                frame_cap=self.tts_frame_cap,
                max_chars=self.tts_max_chars,
                speech_rate_warning_wps=self.speech_rate_warning_wps,
                fp32_fallback_on_rate_warning=self.tts_fp32_fallback,
                log_callback=self.log,
            )
        except Exception:
            # Whatever did land on disk stays reusable; only the missing scenes are retried.
            self._checkpoint_scene_artifacts(production, pending)
            raise
        self._raise_if_cancelled()

        self._raise_if_cancelled()
        self._durations = dict(durations)
        self._checkpoint_scene_artifacts(production, pending)
        self._checkpoint()

    def _checkpoint_scene_artifacts(self, production: dict, scene_ids: list[str]) -> None:
        """A scene WAV that exists and validates is checkpointed as done."""
        for scene in production["scenes"]:
            scene_id = scene["id"]
            if scene_id not in scene_ids:
                continue
            path = scene_wav_path(self.root, scene_id)
            try:
                validate_voice(path)
            except PipelineError:
                self.plan.set_scene_state(VOICE_SCENES, scene_id, FAILED)
                self.log(f"{scene_id}: không tạo được file giọng.")
                continue
            self.plan.set_scene_state(
                VOICE_SCENES,
                scene_id,
                DONE,
                text_hash=self._text_hash(scene),
                voice_id=self.voice,
                tts_mode=self.tts_mode,
                file_hash=file_sha256(path),
                **self._voice_cache_fields(),
            )
            self.log(f"{scene_id}: xong.")

    def _scene_reusable(self, scene: dict, path: Path) -> bool:

        entry = self.plan.steps[VOICE_SCENES].scenes.get(scene["id"]) or {}
        if entry.get("status") != DONE:
            return False
        if entry.get("text_hash") != self._text_hash(scene):
            return False
        if entry.get("voice_id") != self.voice or entry.get("tts_mode") != self.tts_mode:
            return False
        expected = self._voice_cache_fields()
        if any(entry.get(key) != value for key, value in expected.items()):
            return False
        if not path.is_file():
            return False
        try:
            validate_voice(path)
        except Exception:
            return False
        return entry.get("file_hash") == file_sha256(path)

    @staticmethod
    def _text_hash(scene: dict) -> str:
        import hashlib

        return hashlib.sha256(str(scene.get("voice", "")).encode("utf-8")).hexdigest()

    def _step_concat(self) -> None:

        production = self._production()
        output = concatenate_scene_voices(self.root, production)
        self.log(f"Đã ghép {output.name}.")
        self.plan.steps[CONCAT_VOICE].fingerprint = output.stat().st_size

    def _step_align(self) -> None:

        production = self._production()
        durations = self._durations or {}
        if not durations:
            import wave as wavemod

            durations = {}
            for scene in production["scenes"]:
                path = scene_wav_path(self.root, scene["id"])
                validate_voice(path)
                with wavemod.open(str(path), "rb") as handle:
                    durations[scene["id"]] = handle.getnframes() / handle.getframerate()

        require_word_aligner_installed()
        aligner = load_word_aligner(self.align_model, "cpu", "int8")
        self._raise_if_cancelled()
        recovered_ids: list[str] = []

        def recover_mismatch(scene, _path, active_aligner, _error):
            scene_id = scene["id"]
            if not bool(getattr(_error, "coverage_gap", False)):
                self.log(
                    f"{scene_id}: alignment khác cách Whisper chép nhưng không có "
                    "bằng chứng thiếu coverage; không sinh lại TTS."
                )
                return None
            if not tts_scene_frame_cap_retry_eligible(self.root, scene_id):
                return None
            self._raise_if_cancelled()
            recovered = recover_scene_alignment_with_adaptive_frame_cap(
                self.root,
                production,
                scene_id,
                active_aligner,
                tts_root=self.tts_root or DEFAULT_TTS_ROOT,
                voice=self.voice,
                max_chars=self.tts_max_chars,
                log_callback=self.log,
            )
            recovered_ids.append(scene_id)
            self.plan.set_scene_state(
                VOICE_SCENES,
                scene_id,
                DONE,
                file_hash=file_sha256(scene_wav_path(self.root, scene_id)),
                tts_recovery="adaptive_frame_cap_after_alignment_mismatch",
                tts_actual_backend="onnx",
                tts_actual_precision="fp32",
                tts_actual_frame_cap=True,
            )
            self._checkpoint()
            return recovered

        timing = align_scene_timings(
            production,
            durations,
            aligner,
            scene_voice_files(self.root, production),
            mismatch_recovery=recover_mismatch,
        )
        self._durations = dict(durations)
        if recovered_ids:
            output = concatenate_scene_voices(self.root, production)
            self.plan.steps[CONCAT_VOICE].fingerprint = output.stat().st_size
            self.log(
                "Đã ghép lại voice.wav sau adaptive frame-cap recovery: "
                + ", ".join(recovered_ids)
            )
        build_and_write_timing(self.root, timing)
        self.log(f"Đã căn {len(timing['scenes'])} scene bằng faster-whisper/{self.align_model}.")

    def _step_validate_runtime(self) -> None:

        validate_runtime(self.root)
        self.log("Gói video, voice và thời gian từ đều hợp lệ.")

    def _step_prepare_renderer(self) -> None:

        prepare_renderer(
            self.root,
            music=self.music,
            music_volume=self.music_volume,
            update_music=bool(self.music),
        )
        self.log("Renderer đã sẵn sàng.")

    def _step_render(self) -> None:

        render_video(self.root)
        self._raise_if_cancelled()
        self.log("Đã kết xuất video.")

    def _step_mix(self) -> None:

        if self.music is None:
            self.plan.mark(MIX_MUSIC, SKIPPED, message="Không chọn nhạc nền.")
            self.log("Không có nhạc nền: bỏ qua bước trộn nhạc.")
            return
        mix_background_music_into_render(self.root)
        self.log("Đã trộn nhạc nền.")