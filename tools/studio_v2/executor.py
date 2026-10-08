from __future__ import annotations

from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import shutil
from typing import Any, Callable

from tools.control_plane.cache import audio_key, plan_key, render_key
from tools.control_plane.errors import ControlPlaneError

from .controller import StudioV2Controller
from .pipeline import (
    AUDIO,
    DONE,
    OUTPUT,
    PACKAGE,
    PLAN,
    RENDER,
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
    step: str,
    *,
    input_hash: str,
    path: Path,
) -> bool:
    state = controller.state.steps[step]
    if (
        state.status == DONE
        and state.input_hash == input_hash
        and isinstance(state.output_hash, str)
        and path.is_file()
        and _sha256_file(path) == state.output_hash
    ):
        state.reused = True
        state.error = None
        save_state(controller.workspace, controller.state)
        return True
    _reset_from(controller, step)
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
        ],
        cwd=renderer,
        stage="RENDER",
        fallback_code="RENDER_FAILED",
    )
    return _require_output(output_path, stage="RENDER", code="RENDER_FAILED")


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
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(final_path, output_path)
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

    def _mark_failed(self, step: str, error: ControlPlaneError) -> None:
        self.controller.state.mark_failed(step, error=error.to_dict())
        save_state(self.controller.workspace, self.controller.state)

    def run(self, config: ExecutorConfig):
        controller = self.controller
        workspace = controller.workspace
        if controller.state.steps[PACKAGE].status != DONE:
            raise ControlPlaneError(
                code="PACKAGE_NOT_READY",
                stage="PACKAGE",
                message="import a valid zodiac-job@5 package before running Studio v2",
            )

        ir = _read_json(
            workspace / "production.ir.json",
            code="AUTHORING_IR_INVALID",
            stage="PACKAGE",
        )

        try:
            voice = self.voice_service(
                workspace,
                ir,
                voice_profile=config.voice_profile,
                tts_settings=config.tts_settings,
                engine_version=config.tts_engine_version,
            )
            controller.state.mark_done(
                VOICE,
                input_hash=voice.input_key,
                output_hash=voice.output_hash,
                reused=voice.reused,
            )
            save_state(workspace, controller.state)
        except ControlPlaneError as exc:
            self._mark_failed(VOICE, exc)
            raise

        try:
            timing = self.timing_service(
                workspace,
                ir,
                voice,
                aligner_settings=config.aligner_settings,
                aligner_version=config.aligner_version,
            )
            controller.state.mark_done(
                TIMING,
                input_hash=timing.input_key,
                output_hash=timing.output_hash,
                reused=timing.reused,
            )
            save_state(workspace, controller.state)
        except ControlPlaneError as exc:
            self._mark_failed(TIMING, exc)
            raise

        plan_path = workspace / ".runtime" / "render-plan.json"
        plan_input = plan_key(
            _sha256_file(workspace / "production.ir.json"),
            timing.output_hash,
            _sha256_file(workspace / "design-token.json"),
            config.compiler_version,
        )
        if not _reuse_file(
            controller,
            PLAN,
            input_hash=plan_input,
            path=plan_path,
        ):
            try:
                plan_path = controller.build_plan()
                plan_hash = _sha256_file(plan_path)
                controller.state.mark_done(
                    PLAN,
                    input_hash=plan_input,
                    output_hash=plan_hash,
                    reused=False,
                )
                save_state(workspace, controller.state)
            except ControlPlaneError as exc:
                self._mark_failed(PLAN, exc)
                raise
        plan_hash = _sha256_file(plan_path)

        rendered_path = workspace / ".runtime" / "rendered-v2.mp4"
        render_input = render_key(
            plan_hash,
            _tree_hash(workspace / "assets"),
            config.renderer_version,
            config.renderer_hash,
        )
        if not _reuse_file(
            controller,
            RENDER,
            input_hash=render_input,
            path=rendered_path,
        ):
            try:
                props = controller.prepare_renderer()
                produced = Path(
                    self.render_handler(
                        workspace,
                        props,
                        rendered_path,
                    )
                )
                _require_output(produced, stage="RENDER", code="RENDER_FAILED")
                if produced.resolve() != rendered_path.resolve():
                    shutil.copy2(produced, rendered_path)
                render_hash = _sha256_file(rendered_path)
                controller.state.mark_done(
                    RENDER,
                    input_hash=render_input,
                    output_hash=render_hash,
                    reused=False,
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
        if not _reuse_file(
            controller,
            AUDIO,
            input_hash=audio_input,
            path=audio_path,
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
                controller.state.mark_done(
                    AUDIO,
                    input_hash=audio_input,
                    output_hash=audio_hash,
                    reused=False,
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

        output_path = workspace / "out" / "zodiac-story.mp4"
        output_input = audio_hash
        if not _reuse_file(
            controller,
            OUTPUT,
            input_hash=output_input,
            path=output_path,
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
                controller.state.mark_done(
                    OUTPUT,
                    input_hash=output_input,
                    output_hash=output_hash,
                    reused=False,
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

        return controller.state
