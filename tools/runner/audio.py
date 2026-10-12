"""PCM WAV primitives owned by the local runner."""

from __future__ import annotations

import math
import wave
from pathlib import Path

from tools.runner.errors import PipelineError


def validate_voice(path: Path) -> None:
    path = Path(path)
    if not path.is_file():
        raise PipelineError(f"voice WAV is missing: {path}")
    try:
        with wave.open(str(path), "rb") as wav:
            if wav.getcomptype() != "NONE" or wav.getnframes() < 1 or wav.getframerate() < 1 or wav.getnchannels() < 1:
                raise PipelineError("voice.wav must contain non-empty uncompressed PCM audio.")
    except (wave.Error, EOFError, OSError) as exc:
        raise PipelineError(f"voice.wav is not a readable PCM WAV file: {exc}") from exc


def concatenate_wavs(
    inputs: list[Path],
    output: Path,
    *,
    gap_ms: float = 0.0,
) -> None:
    """Concatenate PCM WAV files and optionally insert silence between items."""
    if not inputs:
        raise PipelineError("no scene WAV files were generated.")
    try:
        gap_ms = float(gap_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("scene gap must be a finite non-negative number.") from None
    if not math.isfinite(gap_ms) or gap_ms < 0 or gap_ms > 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")

    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    params = None
    with wave.open(str(output), "wb") as destination:
        for index, source_path in enumerate(inputs):
            try:
                with wave.open(str(source_path), "rb") as source:
                    if source.getcomptype() != "NONE":
                        raise PipelineError(f"scene WAV is compressed: {source_path}")
                    current = source.getparams()
                    if params is None:
                        params = current
                        destination.setnchannels(current.nchannels)
                        destination.setsampwidth(current.sampwidth)
                        destination.setframerate(current.framerate)
                        destination.setcomptype("NONE", "not compressed")
                    elif current[:3] != params[:3]:
                        raise PipelineError("scene WAV files do not share one PCM format.")
                    destination.writeframes(source.readframes(source.getnframes()))
                    if index < len(inputs) - 1 and gap_ms > 0:
                        silent_frames = round(current.framerate * gap_ms / 1000.0)
                        if current.sampwidth == 1:
                            silent_sample = b"\x80"
                        else:
                            silent_sample = b"\x00" * current.sampwidth
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
            except (wave.Error, EOFError, OSError) as exc:
                raise PipelineError(f"cannot read scene WAV {source_path}: {exc}") from exc
