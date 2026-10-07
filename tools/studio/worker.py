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
import time
from pathlib import Path

from tools.studio.artifacts import CacheReason, VoiceArtifactStore, VoiceIdentity, canonical_hash
from tools.studio.preflight import PreflightChecker
from tools.studio.job_state import JobStateStore
from tools.studio.voice_catalog import voice_profile_hash
from tools.studio.observability import (
    PerformanceStore,
    artifact_fingerprints,
    snapshot_fingerprint,
    step_input_fingerprint,
)
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
    DEFAULT_MUSIC_VOLUME,
    DEFAULT_PLAYBACK_RATE,
    DEFAULT_SCENE_GAP_MS,
    DEFAULT_SENTENCE_PAUSE_MS,
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
    configure_background_music,
    effective_tts_generation_config,
    file_sha256,
    generate_scene_voices,
    import_package,
    load_word_aligner,
    mix_background_music_into_render,
    observe_subprocess_output,
    observe_subprocesses,
    finalize_publish_outputs,
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
    """Terminate a managed child tree without ever signaling Studio's own group."""
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
        pgid = os.getpgid(process.pid)
    except ProcessLookupError:
        return

    own_group = pgid == os.getpgrp()
    try:
        if own_group:
            process.terminate()
        else:
            os.killpg(pgid, signal.SIGTERM)
        try:
            process.wait(timeout=3)
            return
        except subprocess.TimeoutExpired:
            if own_group:
                process.kill()
            else:
                os.killpg(pgid, signal.SIGKILL)
            process.wait(timeout=3)
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
        music_volume: float = DEFAULT_MUSIC_VOLUME,
        scene_gap_ms: float = DEFAULT_SCENE_GAP_MS,
        sentence_pause_ms: float = DEFAULT_SENTENCE_PAUSE_MS,
        playback_rate: float = DEFAULT_PLAYBACK_RATE,
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
        self.scene_gap_ms = float(scene_gap_ms)
        self.sentence_pause_ms = float(sentence_pause_ms)
        self.playback_rate = float(playback_rate)
        self.workspace = Path(workspace) if workspace else None
        self.archive = Path(archive) if archive else None
        self.job_name = job_name

        self._durations: dict[str, float] = {}
        self._cancel = threading.Event()
        self._process: subprocess.Popen | None = None
        self._thread: threading.Thread | None = None
        self._scenes_lock = threading.Lock()
        self.performance = PerformanceStore(self.root)
        self.voice_artifacts = VoiceArtifactStore(self.root)
        self.voice_profile_hash = voice_profile_hash(self.voice)
        self._step_cache_hit: dict[str, bool | None] = {}
        self._step_cache_reason: dict[str, str | None] = {}

        self._migrate_voice_artifacts()
        self._invalidate_incompatible_voice_cache()
        self._sync_pacing_profile()

    def _generation_profile_payload(self) -> dict:
        config = effective_tts_generation_config(
            mode=self.tts_mode,
            vieneu_url=self.vieneu_url,
            backend=self.tts_backend,
            precision=self.tts_precision,
            frame_cap=self.tts_frame_cap,
            max_chars=self.tts_max_chars,
        )
        return {
            "tts_mode": self.tts_mode,
            "tts_transport": config["transport"],
            "tts_backend": config["backend"],
            "tts_precision": config["precision"],
            "tts_frame_cap": config["frame_cap"],
            "tts_max_chars": config["max_chars"],
            "tts_fp32_fallback": self.tts_fp32_fallback,
            "speech_rate_warning_wps": self.speech_rate_warning_wps,
        }

    def _voice_cache_fields(self) -> dict:
        profile = self._generation_profile_payload()
        return {
            **{key: value for key, value in profile.items() if key != "tts_mode"},
            "voice_profile_hash": self.voice_profile_hash,
            "generation_profile_hash": canonical_hash(profile),
        }

    def _legacy_generation_profile_hash(self, entry: dict) -> str:
        return canonical_hash(
            {
                "tts_mode": entry.get("tts_mode") or self.tts_mode,
                "tts_transport": entry.get("tts_transport"),
                "tts_backend": entry.get("tts_backend"),
                "tts_precision": entry.get("tts_precision"),
                "tts_frame_cap": entry.get("tts_frame_cap"),
                "tts_max_chars": entry.get("tts_max_chars"),
                "tts_fp32_fallback": entry.get("tts_fp32_fallback"),
                "speech_rate_warning_wps": entry.get("speech_rate_warning_wps"),
            }
        )

    def _migrate_voice_artifacts(self) -> None:
        """Mirror existing valid checkpoints into immutable job-local take storage."""
        changed = False
        for scene_id, entry in list(self.plan.steps[VOICE_SCENES].scenes.items()):
            if entry.get("status") != DONE:
                continue
            if entry.get("voice_id") != self.voice or entry.get("tts_mode") != self.tts_mode:
                continue
            path = scene_wav_path(self.root, scene_id)
            if not path.is_file():
                continue
            try:
                validate_voice(path)
            except Exception:
                continue
            file_hash = file_sha256(path)
            if entry.get("file_hash") and entry.get("file_hash") != file_hash:
                continue

            text_hash = entry.get("text_hash")
            if not text_hash:
                continue
            profile_hash = entry.get("voice_profile_hash") or self.voice_profile_hash
            generation_hash = (
                entry.get("generation_profile_hash")
                or self._legacy_generation_profile_hash(entry)
            )
            take = self.voice_artifacts.register_approved(
                scene_id,
                path,
                identity=VoiceIdentity(
                    text_hash=text_hash,
                    voice_profile_hash=profile_hash,
                    generation_profile_hash=generation_hash,
                    performance_context_hash=None,
                ),
                approval_source="legacy-checkpoint",
                migrated_from_checkpoint=True,
            )
            fields = {}
            if not entry.get("voice_profile_hash"):
                fields["voice_profile_hash"] = profile_hash
            if not entry.get("generation_profile_hash"):
                fields["generation_profile_hash"] = generation_hash
            if entry.get("artifact_take_id") != take["take_id"]:
                fields["artifact_take_id"] = take["take_id"]
            if fields:
                self.plan.set_scene_state(VOICE_SCENES, scene_id, DONE, **fields)
                changed = True
        if changed:
            self._checkpoint()

    def _invalidate_incompatible_voice_cache(self) -> None:
        expected = self._voice_cache_fields()
        incompatible = []
        preserved_drift = []
        for scene_id, entry in self.plan.steps[VOICE_SCENES].scenes.items():
            if entry.get("status") != DONE:
                continue
            # Voice/mode changes have their own explicit invalidation path.
            if (
                entry.get("voice_id") != self.voice
                or entry.get("tts_mode") != self.tts_mode
            ):
                continue

            text_hash = entry.get("text_hash")
            path = scene_wav_path(self.root, scene_id)
            if text_hash:
                approved = self.voice_artifacts.restore_approved(
                    scene_id,
                    path,
                    text_hash=text_hash,
                    voice_profile_hash=self.voice_profile_hash,
                    performance_context_hash=None,
                )
                if approved is not None:
                    # An approved take is a production artifact. Generation
                    # backend/precision/version drift is provenance, not a reason
                    # to destroy a take that was already accepted.
                    if entry.get("generation_profile_hash") != expected["generation_profile_hash"]:
                        preserved_drift.append(scene_id)
                    continue

            if any(entry.get(key) != value for key, value in expected.items()):
                incompatible.append(scene_id)

        if preserved_drift:
            self.log(
                "VOICE_PROFILE_DRIFT: giữ approved take dù cấu hình sinh giọng hiện tại "
                "đã thay đổi: " + ", ".join(preserved_drift)
            )

        if not incompatible:
            return
        for scene_id in incompatible:
            self.plan.set_scene_state(VOICE_SCENES, scene_id, PENDING)
        self.plan.invalidate_from(VOICE_SCENES)
        self.log(
            "Đã vô hiệu cache giọng không còn tương thích: "
            + ", ".join(incompatible)
        )

    def _sync_pacing_profile(self) -> None:
        """Persist pacing defaults and invalidate only the work they actually affect."""
        import json
        import math

        if (
            not math.isfinite(self.scene_gap_ms)
            or self.scene_gap_ms < 0
            or self.scene_gap_ms > 5000
        ):
            raise PipelineError("scene gap must be between 0 and 5000 ms.")
        if (
            not math.isfinite(self.sentence_pause_ms)
            or self.sentence_pause_ms < 0
            or self.sentence_pause_ms > 3000
        ):
            raise PipelineError("sentence pause must be between 0 and 3000 ms.")
        if (
            not math.isfinite(self.playback_rate)
            or self.playback_rate < 0.5
            or self.playback_rate > 1.5
        ):
            raise PipelineError("playback rate must be between 0.5 and 1.5.")

        path = self.root / ".runtime" / "pacing.json"
        previous = {}
        if path.is_file():
            try:
                previous = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError):
                previous = {}

        expected = {
            "version": 2,
            "scene_gap_ms": self.scene_gap_ms,
            "sentence_pause_ms": self.sentence_pause_ms,
            "playback_rate": self.playback_rate,
        }
        old_gap = previous.get("scene_gap_ms")
        old_sentence_pause = previous.get("sentence_pause_ms")
        old_rate = previous.get("playback_rate")
        had_completed_audio_chain = self.plan.status(CONCAT_VOICE) == DONE

        if (
            old_gap != self.scene_gap_ms
            or old_sentence_pause != self.sentence_pause_ms
        ) and had_completed_audio_chain:
            self.plan.invalidate_from(CONCAT_VOICE)
            self.log(
                "Pacing mới: dùng lại scene WAV đã cache, "
                f"nghỉ {self.sentence_pause_ms:.0f} ms giữa câu và "
                f"{self.scene_gap_ms:.0f} ms giữa scene; không tạo lại TTS."
            )
        elif old_rate != self.playback_rate and self.plan.status(MIX_MUSIC) in (DONE, SKIPPED):
            self.plan.invalidate_from(MIX_MUSIC)
            self.log(
                f"Pacing mới: chỉ cần áp lại tốc độ video {self.playback_rate:.2f}x."
            )

        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(expected, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        self.store.save(self.plan)

    # ---- lifecycle ---------------------------------------------------
    def start(
        self,
        start_step: str | None = None,
        *,
        stop_after: str | None = None,
    ) -> None:
        if self._thread is not None:
            raise RuntimeError("worker already started")
        self._thread = threading.Thread(
            target=self.run_to_completion,
            args=(start_step, stop_after),
            daemon=True,
        )
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

    def attach_process(self, process: subprocess.Popen | None) -> None:
        """Register the active managed subprocess so cancel can kill its tree."""
        self._process = process
        if process is not None and self._cancel.is_set():
            terminate_process_tree(process)

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
    def run_to_completion(
        self,
        start_step: str | None = None,
        stop_after: str | None = None,
    ) -> PipelinePlan:
        steps = list(self._steps_from(start_step, stop_after=stop_after))
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
                if self._cancel.is_set():
                    self.plan.mark(
                        step,
                        CANCELLED,
                        error_code="CANCELLED_BY_USER",
                        message="Đã dừng theo yêu cầu.",
                        details=str(exc),
                    )
                    self._checkpoint()
                    self.emit(PIPELINE_CANCELLED, step=step)
                    return self.plan
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
        self.emit(
            PIPELINE_DONE,
            plan=self.plan.to_dict(),
            stop_after=stop_after,
            partial=bool(stop_after and stop_after != STEP_ORDER[-1]),
        )
        return self.plan

    def run_from(
        self,
        start_step: str | None,
        *,
        stop_after: str | None = None,
    ) -> PipelinePlan:
        """Run from a step, optionally stopping at an explicit workflow boundary."""
        return self.run_to_completion(start_step, stop_after=stop_after)

    def _steps_from(self, start_step: str | None, *, stop_after: str | None = None):
        if start_step is None:
            start_step = self.plan.continue_from()
            if start_step is None:
                start_step = self.plan.next_step()
        if start_step is None:
            return []
        index = STEP_ORDER.index(start_step)
        if stop_after is None:
            return STEP_ORDER[index:]
        if stop_after not in STEP_ORDER:
            raise ValueError(f"unknown stop_after step: {stop_after}")
        stop_index = STEP_ORDER.index(stop_after)
        if stop_index < index:
            return ()
        return STEP_ORDER[index : stop_index + 1]

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

        if "visual_progression_density" in lowered:
            code = "PACKAGE_INVALID"
            message = (
                "Gói video không hợp lệ với contract visual hiện tại. "
                "Nạp bản vá mới trước khi chạy voice/timing."
            )
        elif "faster-whisper" in lowered or "faster_whisper" in lowered:
            code = "DEPENDENCY_MISSING" if step == PREFLIGHT else "ALIGNER_LOAD_FAILED"
            message = (
                "Thiếu thư viện faster-whisper trong Python đang chạy Zodiac Studio. "
                "Cài dependency rồi chạy lại."
            )
        elif "visual_progression_timing" in lowered:
            code = "VISUAL_PROGRESSION_TIMING"
            message = (
                "Nhịp hình ảnh có khoảng trống dài hơn giới hạn 5 giây. "
                "Timing/voice đã được giữ lại; sửa visual rồi chạy tiếp."
            )
        elif "does not match approved narration" in lowered:
            code = "ALIGNMENT_MISMATCH"
            message = "Căn thời gian từ không khớp lời thoại đã duyệt. Sửa TTS hoặc lời thoại rồi thử lại."
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

    def _capture_fingerprints(self) -> dict:
        try:
            return artifact_fingerprints(self.root)
        except Exception as exc:
            self.log(f"PERFORMANCE_TELEMETRY_WARNING: fingerprint failed: {exc}")
            return {}

    def _record_step_performance(
        self,
        *,
        step: str,
        started_at: float,
        result: str,
        before: dict,
    ) -> None:
        try:
            after = self._capture_fingerprints()
            self.performance.write_artifacts(after)
            self.performance.append(
                step=step,
                elapsed_ms=(time.perf_counter() - started_at) * 1000,
                result=result,
                input_fingerprint=step_input_fingerprint(step, before),
                output_fingerprint=snapshot_fingerprint(after),
                cache_hit=self._step_cache_hit.get(step),
                cache_reason=self._step_cache_reason.get(step),
            )
        except Exception as exc:
            self.log(f"PERFORMANCE_TELEMETRY_WARNING: record failed: {exc}")

    def _run_step(self, step: str) -> None:
        self._raise_if_cancelled()
        before = self._capture_fingerprints()
        started_at = time.perf_counter()
        result = "failed"

        self._step_cache_hit[step] = None
        self._step_cache_reason[step] = None
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

        try:
            with observe_subprocesses(self.attach_process), observe_subprocess_output(
                lambda line, channel=None: self.log(line)
            ):
                handler()
            self._raise_if_cancelled()

            if self.plan.status(step) != SKIPPED:
                self.plan.complete_step(step)
            result = self.plan.status(step).lower()
            self._checkpoint()
            self.emit(STEP_DONE, step=step, status=self.plan.status(step))
        except CancelledError:
            result = "cancelled"
            raise
        except Exception:
            result = "failed"
            raise
        finally:
            self._record_step_performance(
                step=step,
                started_at=started_at,
                result=result,
                before=before,
            )

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
        reused = 0
        for scene in production["scenes"]:
            scene_id = scene["id"]
            path = scene_wav_path(self.root, scene_id)
            if self._scene_reusable(scene, path):
                take = self.voice_artifacts.active_take(scene_id)
                self.plan.set_scene_state(
                    VOICE_SCENES,
                    scene_id,
                    DONE,
                    text_hash=self._text_hash(scene),
                    voice_id=self.voice,
                    tts_mode=self.tts_mode,
                    file_hash=file_sha256(path),
                    artifact_take_id=take.get("take_id") if take else None,
                    cache_reason=CacheReason.REUSED_APPROVED,
                    **self._voice_cache_fields(),
                )
                reused += 1
                self.log(f"{scene_id}: dùng lại approved voice artifact.")
                continue
            self.plan.set_scene_state(VOICE_SCENES, scene_id, RUNNING)
            self._checkpoint()
            self.emit(STEP_PROGRESS, step=VOICE_SCENES, scene_id=scene_id)
            pending.append(scene_id)

        if not pending:
            self._step_cache_hit[VOICE_SCENES] = True
            self._step_cache_reason[VOICE_SCENES] = CacheReason.REUSED_APPROVED
            self.log("Tất cả giọng scene đã có, bỏ qua bước tạo giọng.")
            return

        self._step_cache_hit[VOICE_SCENES] = False
        self._step_cache_reason[VOICE_SCENES] = (
            CacheReason.PARTIAL_REUSE if reused else CacheReason.NO_ARTIFACT
        )
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
            text_hash = self._text_hash(scene)
            fields = self._voice_cache_fields()
            take = self.voice_artifacts.register_approved(
                scene_id,
                path,
                identity=VoiceIdentity(
                    text_hash=text_hash,
                    voice_profile_hash=fields["voice_profile_hash"],
                    generation_profile_hash=fields["generation_profile_hash"],
                    performance_context_hash=None,
                ),
                approval_source="pipeline-compatibility",
            )
            self.plan.set_scene_state(
                VOICE_SCENES,
                scene_id,
                DONE,
                text_hash=text_hash,
                voice_id=self.voice,
                tts_mode=self.tts_mode,
                file_hash=file_sha256(path),
                artifact_take_id=take["take_id"],
                cache_reason=CacheReason.GENERATED_NEW,
                **fields,
            )
            self.log(f"{scene_id}: xong; đã lưu approved voice artifact.")

    def _scene_reusable(self, scene: dict, path: Path) -> bool:

        entry = self.plan.steps[VOICE_SCENES].scenes.get(scene["id"]) or {}
        if entry.get("status") != DONE:
            return False
        if entry.get("text_hash") != self._text_hash(scene):
            return False
        if entry.get("voice_id") != self.voice or entry.get("tts_mode") != self.tts_mode:
            return False
        approved = self.voice_artifacts.restore_approved(
            scene["id"],
            path,
            text_hash=self._text_hash(scene),
            voice_profile_hash=self.voice_profile_hash,
            performance_context_hash=None,
        )
        if approved is not None:
            try:
                validate_voice(path)
            except Exception:
                return False
            if entry.get("file_hash") == file_sha256(path):
                if entry.get("generation_profile_hash") != self._voice_cache_fields()["generation_profile_hash"]:
                    self.log(
                        f"{scene['id']}: approved take được giữ dù generation profile đã đổi."
                    )
                return True

        # Compatibility fallback for legacy checkpoints that have not yet been
        # mirrored into the artifact store.
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
        output = concatenate_scene_voices(
            self.root,
            production,
            scene_gap_ms=self.scene_gap_ms,
        )
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
            if not tts_scene_frame_cap_retry_eligible(
                self.root,
                scene_id,
                selected_mode=self.tts_mode,
                allow_fp32_fallback=self.tts_fp32_fallback,
            ):
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
                selected_mode=self.tts_mode,
                allow_fp32_fallback=self.tts_fp32_fallback,
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
            scene_gap_ms=self.scene_gap_ms,
            sentence_pause_ms=self.sentence_pause_ms,
        )
        self._durations = dict(durations)
        output = concatenate_scene_voices(
            self.root,
            production,
            scene_gap_ms=self.scene_gap_ms,
            sentence_pause_ms=self.sentence_pause_ms,
            timing=timing,
        )
        self.plan.steps[CONCAT_VOICE].fingerprint = output.stat().st_size
        if recovered_ids:
            self.log(
                "Đã ghép lại voice.wav sau adaptive frame-cap recovery: "
                + ", ".join(recovered_ids)
            )
        build_and_write_timing(
            self.root,
            timing,
            check_visual_progression=False,
        )
        self.log(
            f"Đã căn {len(timing['scenes'])} scene bằng faster-whisper/{self.align_model}; "
            f"nghỉ {self.sentence_pause_ms:.0f} ms giữa câu và "
            f"{self.scene_gap_ms:.0f} ms giữa scene."
        )

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
        # Music-only edits intentionally reopen only MIX_MUSIC. Materialize the
        # currently selected track here so an audio change never depends on the
        # much more expensive PREPARE_RENDERER/RENDER_VIDEO suffix.
        configure_background_music(
            self.root,
            self.music,
            self.music_volume,
        )
        final_video = mix_background_music_into_render(
            self.root,
            playback_rate=self.playback_rate,
        )
        finalize_publish_outputs(
            self.root,
            final_video=final_video,
        )
        if self.music is None:
            self.log(
                f"Không có nhạc nền: hoàn tất video ở tốc độ {self.playback_rate:.2f}x."
            )
        else:
            self.log("Đã trộn nhạc nền và hoàn tất một video cuối.")