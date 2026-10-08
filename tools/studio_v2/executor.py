from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
from datetime import datetime, timezone
import time
from threading import Event
import uuid
from typing import Any, Callable

from tools.control_plane.cache import audio_key, plan_key, render_key
from tools.control_plane.artifact_graph import ArtifactGraph
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.resource_budget import load_resource_profile
from tools.control_plane.segments import plan_segments, props_for_segment

from .controller import StudioV2Controller
from .pipeline import (
    AUDIO,
    DONE,
    OUTPUT,
    PACKAGE,
    PLAN,
    RENDER,
    RUNNING,
    STEP_ORDER,
    TIMING,
    VOICE,
)
from .runner import run_structured_command
from .state import save_state
from .timing import TimingArtifact, ensure_timing_artifact
from .voice import VoiceArtifact, ensure_voice_artifact


_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True)
class ExecutorConfig:
    voice_profile: str
    tts_settings: dict[str, Any]
    tts_engine_version: str
    aligner_settings: dict[str, Any]
    aligner_version: str
    compiler_version: str = "1.0.0"
    renderer_version: str = "2.0.0"
    renderer_hash: str = "renderer-v2"
    segment_target_seconds: float = 30.0
    run_label: str = "interactive"
    music_path: Path | None = None
    mix_settings: dict[str, Any] = field(default_factory=dict)


VoiceService = Callable[..., VoiceArtifact]
TimingService = Callable[..., TimingArtifact]
RenderHandler = Callable[[Path, Path, Path], Path]
AudioHandler = Callable[[Path, Path, Path | None, dict[str, Any], Path], Path]
OutputHandler = Callable[[Path, Path, Path], Path]


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _record_stage_performance(
    workspace: Path,
    *,
    stage: str,
    run_id: str,
    run_label: str,
    started: float,
    input_fingerprint: str,
    output_hash: str,
    cache_hit: bool,
    cache_reason: str,
    profile: dict[str, Any],
) -> None:
    path = workspace / ".runtime" / "performance.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    row = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "run_id": run_id,
        "run_label": run_label,
        "stage": stage,
        "substage": stage,
        "elapsed_ms": round((time.perf_counter() - started) * 1000, 3),
        "cache_hit": cache_hit,
        "cache_reason": cache_reason,
        "input_fingerprint": input_fingerprint,
        "output_hash": output_hash,
        "execution_profile": profile,
    }
    with path.open("a", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


def _tree_hash(root: Path) -> str:
    root = Path(root)
    digest = hashlib.sha256()
    if not root.is_dir():
        digest.update(b"<missing>")
        return digest.hexdigest()
    for path in sorted(
        (item for item in root.rglob("*") if item.is_file()),
        key=lambda item: item.relative_to(root).as_posix(),
    ):
        relative = path.relative_to(root).as_posix()
        digest.update(relative.encode("utf-8"))
        digest.update(b"\0")
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def _read_json(path: Path, *, code: str, stage: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ControlPlaneError(
            code=code,
            stage=stage,
            message=f"cannot read {path.name}: {exc}",
            detail={"path": str(path)},
        ) from exc
    if not isinstance(value, dict):
        raise ControlPlaneError(
            code=code,
            stage=stage,
            message=f"{path.name} root must be an object",
        )
    return value


def _reset_from(controller: StudioV2Controller, step: str) -> None:
    start = STEP_ORDER.index(step)
    for name in STEP_ORDER[start:]:
        controller.state.steps[name].reset()


def _reuse_file(
    controller: StudioV2Controller,
    graph: ArtifactGraph,
    step: str,
    *,
    input_hash: str,
    path: Path,
    force: bool = False,
) -> bool:
    state = controller.state.steps[step]
    decision = graph.decide(step.casefold(), input_hash)
    if not graph.records.get(step.casefold()) and (
        state.status == DONE
        and state.input_hash == input_hash
        and isinstance(state.output_hash, str)
        and path.is_file()
        and _sha256_file(path) == state.output_hash
    ):
        graph.record(
            step.casefold(),
            step.casefold(),
            input_hash,
            path,
            producer="studio-v2",
            producer_version="2.0.0",
            provenance={"cache_reason": "MIGRATED_STATE"},
        )
        decision = graph.decide(step.casefold(), input_hash)
    if not force and decision.reusable and (
        path.resolve()
        == (controller.workspace / graph.records[step.casefold()]["path"]).resolve()
    ):
        controller.state.mark_done(
            step,
            input_hash=input_hash,
            output_hash=str(decision.content_hash),
            reused=True,
            cache_reason=decision.reason,
        )
        save_state(controller.workspace, controller.state)
        return True
    _reset_from(controller, step)
    controller.state.steps[step].status = RUNNING
    save_state(controller.workspace, controller.state)
    return False


def _require_output(path: Path, *, stage: str, code: str) -> Path:
    path = Path(path)
    if not path.is_file() or path.stat().st_size < 1:
        raise ControlPlaneError(
            code=code,
            stage=stage,
            message=f"stage did not create expected artifact: {path.name}",
            detail={"path": str(path)},
        )
    return path


def _default_render_handler(workspace: Path, props_path: Path, output_path: Path) -> Path:
    renderer = _ROOT / "runtime" / "zodiac-renderer" / "2.0.0" / "renderer"
    npx = shutil.which("npx.cmd") or shutil.which("npx")
    if not npx:
        raise ControlPlaneError(
            code="RENDERER_EXECUTABLE_MISSING",
            stage="RENDER",
            message="npx is required for zodiac-renderer@2.0.0",
        )
    resource_profile = load_resource_profile(workspace)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    run_structured_command(
        [
            npx,
            "remotion",
            "render",
            "src/index.ts",
            "ZodiacRenderPlan",
            str(output_path),
            f"--props={props_path}",
            f"--concurrency={resource_profile['remotion_concurrency']}",
        ],
        cwd=renderer,
        stage="RENDER",
        fallback_code="RENDER_FAILED",
    )
    return _require_output(output_path, stage="RENDER", code="RENDER_FAILED")


def _probe_frames(path: Path) -> int:
    ffprobe = shutil.which("ffprobe") or shutil.which("ffprobe.exe")
    if not ffprobe:
        raise RuntimeError("ffprobe is required to validate segment frame continuity")
    result = run_structured_command(
        [
            ffprobe,
            "-v", "error",
            "-select_streams", "v:0",
            "-count_frames",
            "-show_entries", "stream=nb_read_frames",
            "-of", "json",
            str(path),
        ],
        stage="RENDER",
        fallback_code="SEGMENT_PROBE_FAILED",
    )
    payload = json.loads(result.stdout)
    streams = payload.get("streams") or []
    if not streams or not str(streams[0].get("nb_read_frames", "")).isdigit():
        raise RuntimeError(f"cannot determine frame count for {path.name}")
    return int(streams[0]["nb_read_frames"])


def _assemble_segments(
    segment_paths: list[tuple[Path, int]],
    expected_frames: int,
    output_path: Path,
) -> Path:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg is required to assemble render segments")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="zodiac-segments-") as temp:
        list_path = Path(temp) / "concat.txt"
        rows = [
            "file '" + path.resolve().as_posix().replace("'", "'\\''") + "'"
            for path, _ in segment_paths
        ]
        list_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
        run_structured_command(
            [
                ffmpeg, "-y", "-f", "concat", "-safe", "0",
                "-i", str(list_path), "-map", "0:v:0", "-an", "-c", "copy",
                str(output_path),
            ],
            stage="RENDER",
            fallback_code="SEGMENT_ASSEMBLY_FAILED",
        )
    if _probe_frames(output_path) != expected_frames:
        raise RuntimeError("assembled video frame count does not match the segment plan")
    return _require_output(output_path, stage="RENDER", code="SEGMENT_ASSEMBLY_FAILED")


def _render_segmented(
    workspace: Path,
    props_path: Path,
    output_path: Path,
    *,
    graph: ArtifactGraph,
    render_handler: RenderHandler,
    renderer_version: str,
    renderer_hash: str,
    target_seconds: float,
    render_fingerprint: str,
    force: bool = False,
) -> tuple[Path, dict[str, str], str]:
    props = _read_json(props_path, code="RENDERER_PROPS_INVALID", stage="RENDER")
    dependencies: dict[str, str] = {}

    def full_render_fallback() -> tuple[Path, dict[str, str], str]:
        produced = Path(render_handler(workspace, props_path, output_path))
        if produced.resolve() != output_path.resolve():
            shutil.copy2(produced, output_path)
        return (
            _require_output(output_path, stage="RENDER", code="RENDER_FAILED"),
            dependencies,
            "full-render-fallback",
        )

    if not shutil.which("ffmpeg") or not (shutil.which("ffprobe") or shutil.which("ffprobe.exe")):
        return full_render_fallback()
    segments = plan_segments(
        props,
        renderer_version=renderer_version,
        renderer_hash=renderer_hash,
        target_seconds=target_seconds,
    )
    runtime = workspace / ".runtime"
    plan_path = runtime / "segment-plan.json"
    plan_temp = plan_path.with_suffix(".json.tmp")
    plan_temp.write_text(
        json.dumps({"version": 1, "segments": segments}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    os.replace(plan_temp, plan_path)

    outputs: list[tuple[Path, int]] = []
    dependencies: dict[str, str] = {}
    for segment in segments:
        artifact_id = f"render.segment.{segment['segment_id']}"
        fingerprint = segment["input_fingerprint"]
        artifact_path = (
            runtime / "artifacts" / "render" / "segments"
            / segment["segment_id"] / f"{fingerprint}.mp4"
        )
        frames = int(segment["end_frame"]) - int(segment["start_frame"])
        graph.refresh()
        decision = graph.decide(artifact_id, fingerprint)
        if force or not decision.reusable:
            asset_dependencies = {
                f"asset:{asset_id}": hashlib.sha256(
                    json.dumps(
                        props.get("assets", {}).get(asset_id),
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                ).hexdigest()
                for asset_id in segment["asset_ids"]
                if asset_id in props.get("assets", {})
            }
            dependencies_for_segment = {"render-plan": render_fingerprint, **asset_dependencies}
            segment_dir = runtime / "segments" / segment["segment_id"]
            segment_dir.mkdir(parents=True, exist_ok=True)
            segment_props_path = segment_dir / "props.json"
            segment_props_path.write_text(
                json.dumps(props_for_segment(props, segment), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
                newline="\n",
            )
            temp_output = segment_dir / "rendered.tmp.mp4"
            try:
                produced = Path(render_handler(workspace, segment_props_path, temp_output))
                _require_output(produced, stage="RENDER", code="SEGMENT_RENDER_FAILED")
                if _probe_frames(produced) != frames:
                    raise RuntimeError(f"frame count mismatch in {produced.name}")
            except Exception:
                return full_render_fallback()
            artifact_path.parent.mkdir(parents=True, exist_ok=True)
            if produced.resolve() == temp_output.resolve():
                os.replace(produced, artifact_path)
            else:
                shutil.copy2(produced, artifact_path)
            output_hash = graph.record(
                artifact_id,
                "render.segment",
                fingerprint,
                artifact_path,
                producer="zodiac-renderer",
                producer_version=renderer_version,
                dependencies=dependencies_for_segment,
                provenance={"cache_reason": "RENDERED_NEW", "scene_ids": segment["scene_ids"]},
            )
        else:
            output_hash = str(decision.content_hash)
        outputs.append((artifact_path, frames))
        dependencies[artifact_id] = output_hash

    expected_frames = sum(frames for _, frames in outputs)
    temp_assembled = runtime / "rendered-v2.segments.mp4"
    try:
        _assemble_segments(outputs, expected_frames, temp_assembled)
        temp_final = output_path.with_suffix(output_path.suffix + ".tmp")
        shutil.copy2(temp_assembled, temp_final)
        os.replace(temp_final, output_path)
        return _require_output(output_path, stage="RENDER", code="RENDER_FAILED"), dependencies, "segments"
    except Exception:
        return full_render_fallback()


def _default_audio_handler(
    workspace: Path,
    rendered_path: Path,
    music_path: Path | None,
    mix_settings: dict[str, Any],
    output_path: Path,
) -> Path:
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise ControlPlaneError(
            code="AUDIO_EXECUTABLE_MISSING",
            stage="AUDIO",
            message="ffmpeg is required for Studio v2 audio assembly",
        )
    voice = Path(workspace) / "voice.wav"
    _require_output(voice, stage="AUDIO", code="AUDIO_VOICE_MISSING")
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if music_path is None:
        command = [
            ffmpeg, "-y",
            "-i", str(rendered_path),
            "-i", str(voice),
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            str(output_path),
        ]
    else:
        music_volume = float(mix_settings.get("volume", 0.2))
        voice_volume = float(mix_settings.get("voice_volume", 1.0))
        command = [
            ffmpeg, "-y",
            "-i", str(rendered_path),
            "-i", str(voice),
            "-stream_loop", "-1",
            "-i", str(music_path),
            "-filter_complex",
            (
                f"[1:a]volume={voice_volume}[voice];"
                f"[2:a]volume={music_volume}[music];"
                "[voice][music]amix=inputs=2:duration=first:dropout_transition=2[aout]"
            ),
            "-map", "0:v:0",
            "-map", "[aout]",
            "-c:v", "copy",
            "-c:a", "aac",
            str(output_path),
        ]
    run_structured_command(
        command,
        stage="AUDIO",
        fallback_code="AUDIO_MIX_FAILED",
    )
    return _require_output(output_path, stage="AUDIO", code="AUDIO_MIX_FAILED")


def _default_output_handler(workspace: Path, final_path: Path, output_path: Path) -> Path:
    """Publish the video and the Job@5 cover/copy with one renderer source."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(final_path, output_path)
    publish_dir = workspace / "publish"
    metadata_path = publish_dir / "publish.json"
    if metadata_path.is_file():
        metadata = _read_json(metadata_path, code="PUBLISH_METADATA_INVALID", stage="OUTPUT")
        shutil.copy2(metadata_path, output_path.parent / "publish.json")
        copy_path = publish_dir / "publish-copy.txt"
        if copy_path.is_file():
            shutil.copy2(copy_path, output_path.parent / "publish-copy.txt")
        if metadata.get("cover"):
            run_structured_command(
                [
                    "node",
                    str(_ROOT / "runtime" / "zodiac-renderer" / "2.0.0"
                        / "renderer" / "scripts" / "render-cover.mjs"),
                    str(workspace),
                    str(output_path.parent / "cover.png"),
                ],
                stage="OUTPUT",
                fallback_code="COVER_RENDER_FAILED",
            )
            _require_output(output_path.parent / "cover.png", stage="OUTPUT",
                            code="COVER_RENDER_FAILED")
    return _require_output(output_path, stage="OUTPUT", code="OUTPUT_WRITE_FAILED")


class StudioV2Executor:
    def __init__(
        self,
        controller: StudioV2Controller,
        *,
        voice_service: VoiceService = ensure_voice_artifact,
        timing_service: TimingService = ensure_timing_artifact,
        render_handler: RenderHandler = _default_render_handler,
        audio_handler: AudioHandler = _default_audio_handler,
        output_handler: OutputHandler = _default_output_handler,
    ) -> None:
        self.controller = controller
        self.voice_service = voice_service
        self.timing_service = timing_service
        self.render_handler = render_handler
        self.audio_handler = audio_handler
        self.output_handler = output_handler

    def render_scene_preview(self, scene_id: str) -> Path:
        props = self.controller.prepare_scene_preview(scene_id)
        preview_id = hashlib.sha256(scene_id.encode("utf-8")).hexdigest()[:16]
        output = self.controller.workspace / ".runtime" / "previews" / f"scene-{preview_id}.mp4"
        return _require_output(
            Path(self.render_handler(self.controller.workspace, props, output)),
            stage="RENDER",
            code="SCENE_PREVIEW_FAILED",
        )

    def render_segment_preview(self, segment_id: str) -> Path:
        props = self.controller.prepare_segment_preview(segment_id)
        output = (
            self.controller.workspace
            / ".runtime"
            / "previews"
            / f"segment-{segment_id}.mp4"
        )
        return _require_output(
            Path(self.render_handler(self.controller.workspace, props, output)),
            stage="RENDER",
            code="SEGMENT_PREVIEW_FAILED",
        )

    def _mark_failed(self, step: str, error: ControlPlaneError) -> None:
        self.controller.state.mark_failed(step, error=error.to_dict())
        save_state(self.controller.workspace, self.controller.state)

    def _begin_step(self, step: str, cancel_event: Event | None) -> None:
        if cancel_event is not None and cancel_event.is_set():
            raise ControlPlaneError(
                code="PIPELINE_CANCELLED", stage=step,
                message="Đã dừng an toàn sau bước trước. Có thể tiếp tục.",
            )
        if step in (VOICE, TIMING):
            state = self.controller.state.steps[step]
            state.status = RUNNING
            state.error = None
            state.reused = False
            state.cache_reason = None
            save_state(self.controller.workspace, self.controller.state)

    def run(self, config: ExecutorConfig, *, rerun_from: str | None = None,
            cancel_event: Event | None = None):
        controller = self.controller
        workspace = controller.workspace
        request_path = workspace / ".runtime" / "rerun-request.json"
        if rerun_from is None and request_path.exists():
            try:
                rerun_from = json.loads(request_path.read_text(encoding="utf-8"))["from"]
            except (OSError, ValueError, KeyError, TypeError) as exc:
                raise ControlPlaneError(code="RERUN_REQUEST_INVALID", stage="PACKAGE",
                                        message="Không đọc được yêu cầu chạy lại đã lưu.") from exc
        if rerun_from is not None and rerun_from not in STEP_ORDER[1:]:
            raise ValueError(f"Cannot rerun stage: {rerun_from}")
        forced = set(STEP_ORDER[STEP_ORDER.index(rerun_from):]) if rerun_from else set()
        def complete_forced_stage(step: str | None = None) -> None:
            if step is not None:
                forced.discard(step)
            remaining = [name for name in STEP_ORDER if name in forced]
            if remaining:
                request_path.parent.mkdir(parents=True, exist_ok=True)
                temp = request_path.with_suffix(".json.tmp")
                temp.write_text(json.dumps({"from": remaining[0]}), encoding="utf-8")
                os.replace(temp, request_path)
            else:
                request_path.unlink(missing_ok=True)

        if forced:
            complete_forced_stage()
            _reset_from(controller, rerun_from)
            save_state(workspace, controller.state)
        graph = ArtifactGraph(workspace)
        run_id = uuid.uuid4().hex
        if controller.state.steps[PACKAGE].status != DONE:
            raise ControlPlaneError(
                code="PACKAGE_NOT_READY",
                stage="PACKAGE",
                message="import a valid zodiac-job@5 package before running Studio v2",
            )

        try:
            resource_profile = load_resource_profile(workspace)
        except ValueError as exc:
            raise ControlPlaneError(
                code="RESOURCE_PROFILE_INVALID",
                stage="PACKAGE",
                message=str(exc),
            ) from exc

        ir = _read_json(
            workspace / "production.ir.json",
            code="AUTHORING_IR_INVALID",
            stage="PACKAGE",
        )

        self._begin_step(VOICE, cancel_event)
        try:
            stage_started = time.perf_counter()
            voice = self.voice_service(
                workspace,
                ir,
                voice_profile=config.voice_profile,
                tts_settings=config.tts_settings,
                engine_version=config.tts_engine_version,
                **({"force": True} if VOICE in forced else {}),
            )
            controller.state.mark_done(
                VOICE,
                input_hash=voice.input_key,
                output_hash=voice.output_hash,
                reused=voice.reused,
                cache_reason=voice.cache_reason,
            )
            graph.record(
                "voice.assembled",
                "voice.assembled",
                voice.input_key,
                voice.path,
                producer="studio-v2-voice",
                producer_version=config.tts_engine_version,
                dependencies={
                    f"voice.scene.{scene_id}": scene_hash
                    for scene_id, scene_hash in voice.scene_hashes.items()
                },
                provenance={"cache_reason": voice.cache_reason},
            )
            _record_stage_performance(
                workspace,
                stage=VOICE,
                run_id=run_id,
                run_label=config.run_label,
                started=stage_started,
                input_fingerprint=voice.input_key,
                output_hash=voice.output_hash,
                cache_hit=voice.reused,
                cache_reason=voice.cache_reason,
                profile={
                    "voice_profile": config.voice_profile,
                    "engine_version": config.tts_engine_version,
                    "resource": resource_profile,
                },
            )
            save_state(workspace, controller.state)
        except ControlPlaneError as exc:
            self._mark_failed(VOICE, exc)
            raise

        complete_forced_stage(VOICE)
        self._begin_step(TIMING, cancel_event)
        try:
            stage_started = time.perf_counter()
            timing = self.timing_service(
                workspace,
                ir,
                voice,
                # Timing must use the exact pause used when assembling voice.wav.
                # A different default/override shifts captions after every scene.
                aligner_settings={
                    **config.aligner_settings,
                    "scene_gap_ms": float(config.tts_settings.get("scene_gap_ms", 180.0)),
                },
                aligner_version=config.aligner_version,
                **({"force": True} if TIMING in forced else {}),
            )
            controller.state.mark_done(
                TIMING,
                input_hash=timing.input_key,
                output_hash=timing.output_hash,
                reused=timing.reused,
                cache_reason=timing.cache_reason,
            )
            graph.record(
                "timing.assembled",
                "timing.assembled",
                timing.input_key,
                timing.path,
                producer="studio-v2-timing",
                producer_version=config.aligner_version,
                dependencies={"voice.assembled": voice.output_hash},
                provenance={"cache_reason": timing.cache_reason},
            )
            _record_stage_performance(
                workspace,
                stage=TIMING,
                run_id=run_id,
                run_label=config.run_label,
                started=stage_started,
                input_fingerprint=timing.input_key,
                output_hash=timing.output_hash,
                cache_hit=timing.reused,
                cache_reason=timing.cache_reason,
                profile={
                    "aligner_version": config.aligner_version,
                    "model": config.aligner_settings.get("model"),
                    "device": config.aligner_settings.get("device"),
                    "compute_type": config.aligner_settings.get("compute_type"),
                    "resource": resource_profile,
                },
            )
            save_state(workspace, controller.state)
        except ControlPlaneError as exc:
            self._mark_failed(TIMING, exc)
            raise

        complete_forced_stage(TIMING)
        self._begin_step(PLAN, cancel_event)
        plan_path = workspace / ".runtime" / "render-plan.json"
        plan_input = plan_key(
            _sha256_file(workspace / "production.ir.json"),
            timing.output_hash,
            _sha256_file(workspace / "design-token.json"),
            config.compiler_version,
        )
        stage_started = time.perf_counter()
        if not _reuse_file(
            controller,
            graph,
            PLAN,
            input_hash=plan_input,
            path=plan_path,
            force=PLAN in forced,
        ):
            try:
                plan_path = controller.build_plan()
                plan_hash = _sha256_file(plan_path)
                graph.record(
                    PLAN.casefold(), PLAN.casefold(), plan_input, plan_path,
                    producer="studio-v2-compiler",
                    producer_version=config.compiler_version,
                    dependencies={
                        "timing.assembled": timing.output_hash,
                        "authoring-ir": _sha256_file(workspace / "production.ir.json"),
                        "design-token": _sha256_file(workspace / "design-token.json"),
                    },
                )
                controller.state.mark_done(
                    PLAN,
                    input_hash=plan_input,
                    output_hash=plan_hash,
                    reused=False,
                    cache_reason="REBUILT",
                )
                save_state(workspace, controller.state)
            except ControlPlaneError as exc:
                self._mark_failed(PLAN, exc)
                raise
        plan_hash = _sha256_file(plan_path)
        _record_stage_performance(
            workspace,
            stage=PLAN,
            run_id=run_id,
            run_label=config.run_label,
            started=stage_started,
            input_fingerprint=plan_input,
            output_hash=plan_hash,
            cache_hit=controller.state.steps[PLAN].reused,
            cache_reason=controller.state.steps[PLAN].cache_reason or "REBUILT",
            profile={"compiler_version": config.compiler_version, "resource": resource_profile},
        )

        # Production gate: never treat ZIP validity as evidence of rendered visual
        # parity. Evaluate the exact Authoring IR and executable render plan, even
        # when the cached PLAN step is reused. Fail before expensive video render.
        run_structured_command(
            [
                "node",
                str(_ROOT / "runtime" / "zodiac-renderer" / "2.0.0"
                    / "renderer" / "scripts" / "audit-payload.mjs"),
                str(workspace),
            ],
            stage="PLAN",
            fallback_code="RENDER_PLAN_PAYLOAD_MISMATCH",
        )

        complete_forced_stage(PLAN)
        self._begin_step(RENDER, cancel_event)
        rendered_path = workspace / ".runtime" / "rendered-v2.mp4"
        render_input = render_key(
            plan_hash,
            _tree_hash(workspace / "assets"),
            config.renderer_version,
            config.renderer_hash,
        )
        stage_started = time.perf_counter()
        if not _reuse_file(
            controller,
            graph,
            RENDER,
            input_hash=render_input,
            path=rendered_path,
            force=RENDER in forced,
        ):
            try:
                props = controller.prepare_renderer()
                produced, segment_dependencies, render_mode = _render_segmented(
                    workspace,
                    props,
                    rendered_path,
                    graph=graph,
                    render_handler=self.render_handler,
                    renderer_version=config.renderer_version,
                    renderer_hash=config.renderer_hash,
                    target_seconds=config.segment_target_seconds,
                    render_fingerprint=render_input,
                    force=RENDER in forced,
                )
                _require_output(produced, stage="RENDER", code="RENDER_FAILED")
                if produced.resolve() != rendered_path.resolve():
                    shutil.copy2(produced, rendered_path)
                render_hash = _sha256_file(rendered_path)
                graph.record(
                    RENDER.casefold(), RENDER.casefold(), render_input, rendered_path,
                    producer="zodiac-renderer",
                    producer_version=config.renderer_version,
                    dependencies={"plan": plan_hash, **segment_dependencies},
                    provenance={"render_mode": render_mode},
                )
                controller.state.mark_done(
                    RENDER,
                    input_hash=render_input,
                    output_hash=render_hash,
                    reused=False,
                    cache_reason=(
                        "SEGMENTS"
                        if render_mode == "segments"
                        else "FULL_RENDER_FALLBACK"
                    ),
                )
                save_state(workspace, controller.state)
            except ControlPlaneError as exc:
                self._mark_failed(RENDER, exc)
                raise
            except Exception as exc:
                wrapped = ControlPlaneError(
                    code="RENDER_FAILED",
                    stage="RENDER",
                    message=f"renderer failed: {exc}",
                )
                self._mark_failed(RENDER, wrapped)
                raise wrapped from exc
        render_hash = _sha256_file(rendered_path)
        _record_stage_performance(
            workspace,
            stage=RENDER,
            run_id=run_id,
            run_label=config.run_label,
            started=stage_started,
            input_fingerprint=render_input,
            output_hash=render_hash,
            cache_hit=controller.state.steps[RENDER].reused,
            cache_reason=controller.state.steps[RENDER].cache_reason or "REBUILT",
            profile={
                "renderer_version": config.renderer_version,
                "renderer_hash": config.renderer_hash,
                "resource": resource_profile,
            },
        )

        complete_forced_stage(RENDER)
        self._begin_step(AUDIO, cancel_event)
        music_path = Path(config.music_path).resolve() if config.music_path is not None else None
        if music_path is not None and not music_path.is_file():
            error = ControlPlaneError(
                code="AUDIO_MUSIC_MISSING",
                stage="AUDIO",
                message="configured background music does not exist",
                detail={"path": str(music_path)},
            )
            self._mark_failed(AUDIO, error)
            raise error
        music_hash = _sha256_file(music_path) if music_path is not None else "none"
        audio_input = audio_key(
            render_hash,
            voice.output_hash,
            music_hash,
            config.mix_settings,
        )
        audio_path = workspace / ".runtime" / "final-v2.mp4"
        stage_started = time.perf_counter()
        if not _reuse_file(
            controller,
            graph,
            AUDIO,
            input_hash=audio_input,
            path=audio_path,
            force=AUDIO in forced,
        ):
            try:
                produced = Path(
                    self.audio_handler(
                        workspace,
                        rendered_path,
                        music_path,
                        config.mix_settings,
                        audio_path,
                    )
                )
                _require_output(produced, stage="AUDIO", code="AUDIO_MIX_FAILED")
                if produced.resolve() != audio_path.resolve():
                    shutil.copy2(produced, audio_path)
                audio_hash = _sha256_file(audio_path)
                graph.record(
                    AUDIO.casefold(), AUDIO.casefold(), audio_input, audio_path,
                    producer="ffmpeg-audio-assembler",
                    producer_version="1",
                    dependencies={"render": render_hash, "voice": voice.output_hash, "music": music_hash},
                )
                controller.state.mark_done(
                    AUDIO,
                    input_hash=audio_input,
                    output_hash=audio_hash,
                    reused=False,
                    cache_reason="REBUILT",
                )
                save_state(workspace, controller.state)
            except ControlPlaneError as exc:
                self._mark_failed(AUDIO, exc)
                raise
            except Exception as exc:
                wrapped = ControlPlaneError(
                    code="AUDIO_MIX_FAILED",
                    stage="AUDIO",
                    message=f"audio assembly failed: {exc}",
                )
                self._mark_failed(AUDIO, wrapped)
                raise wrapped from exc
        audio_hash = _sha256_file(audio_path)
        _record_stage_performance(
            workspace,
            stage=AUDIO,
            run_id=run_id,
            run_label=config.run_label,
            started=stage_started,
            input_fingerprint=audio_input,
            output_hash=audio_hash,
            cache_hit=controller.state.steps[AUDIO].reused,
            cache_reason=controller.state.steps[AUDIO].cache_reason or "REBUILT",
            profile={
                "music": str(music_path) if music_path else None,
                "resource": resource_profile,
                **config.mix_settings,
            },
        )

        complete_forced_stage(AUDIO)
        self._begin_step(OUTPUT, cancel_event)
        output_path = workspace / "out" / "zodiac-story.mp4"
        publish_metadata = workspace / "publish" / "publish.json"
        publish_copy = workspace / "publish" / "publish-copy.txt"
        publish_hash = _sha256_file(publish_metadata) if publish_metadata.is_file() else "none"
        copy_hash = _sha256_file(publish_copy) if publish_copy.is_file() else "none"
        output_input = hashlib.sha256(f"{audio_hash}:{publish_hash}:{copy_hash}".encode("utf-8")).hexdigest()
        stage_started = time.perf_counter()
        if not _reuse_file(
            controller,
            graph,
            OUTPUT,
            input_hash=output_input,
            path=output_path,
            force=OUTPUT in forced or (publish_metadata.is_file() and
                _read_json(publish_metadata, code="PUBLISH_METADATA_INVALID", stage="OUTPUT").get("cover") is not None and
                not (output_path.parent / "cover.png").is_file()),
        ):
            try:
                produced = Path(
                    self.output_handler(
                        workspace,
                        audio_path,
                        output_path,
                    )
                )
                _require_output(produced, stage="OUTPUT", code="OUTPUT_WRITE_FAILED")
                if produced.resolve() != output_path.resolve():
                    shutil.copy2(produced, output_path)
                output_hash = _sha256_file(output_path)
                graph.record(
                    OUTPUT.casefold(), OUTPUT.casefold(), output_input, output_path,
                    producer="studio-v2-output",
                    producer_version="1",
                    dependencies={"audio": audio_hash},
                )
                controller.state.mark_done(
                    OUTPUT,
                    input_hash=output_input,
                    output_hash=output_hash,
                    reused=False,
                    cache_reason="REBUILT",
                )
                save_state(workspace, controller.state)
            except ControlPlaneError as exc:
                self._mark_failed(OUTPUT, exc)
                raise
            except Exception as exc:
                wrapped = ControlPlaneError(
                    code="OUTPUT_WRITE_FAILED",
                    stage="OUTPUT",
                    message=f"output publish failed: {exc}",
                )
                self._mark_failed(OUTPUT, wrapped)
                raise wrapped from exc

        _record_stage_performance(
            workspace,
            stage=OUTPUT,
            run_id=run_id,
            run_label=config.run_label,
            started=stage_started,
            input_fingerprint=output_input,
            output_hash=_sha256_file(output_path),
            cache_hit=controller.state.steps[OUTPUT].reused,
            cache_reason=controller.state.steps[OUTPUT].cache_reason or "REBUILT",
            profile={},
        )

        complete_forced_stage(OUTPUT)
        return controller.state
