from __future__ import annotations

import io
import tempfile
import wave
import zipfile
from pathlib import Path

import pytest


def _write_wav(path: Path, frames: bytes, *, rate: int = 8000, channels: int = 1, width: int = 2) -> None:
    with wave.open(str(path), 'wb') as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(width)
        wav.setframerate(rate)
        wav.writeframes(frames)


def test_package_safety_has_runner_owner_and_legacy_reexport(tmp_path: Path) -> None:
    from tools.runner.package import safe_extract_zip as owned
    from tools.zodiac_local import safe_extract_zip as legacy

    assert legacy is owned
    archive = tmp_path / 'bad.zip'
    with zipfile.ZipFile(archive, 'w') as zf:
        zf.writestr('../escape.txt', 'nope')
    with pytest.raises(Exception, match='unsafe ZIP path'):
        owned(archive, tmp_path / 'out')


def test_audio_primitives_have_runner_owner_and_preserve_gap_behavior(tmp_path: Path) -> None:
    from tools.runner.audio import concatenate_wavs as owned
    from tools.zodiac_local import concatenate_wavs as legacy

    assert legacy is owned
    a = tmp_path / 'a.wav'
    b = tmp_path / 'b.wav'
    out = tmp_path / 'out.wav'
    _write_wav(a, b'\x01\x00' * 80)
    _write_wav(b, b'\x02\x00' * 80)

    owned([a, b], out, gap_ms=10)

    with wave.open(str(out), 'rb') as wav:
        assert wav.getframerate() == 8000
        assert wav.getnframes() == 80 + 80 + 80


def test_audio_rejects_mismatched_pcm_format(tmp_path: Path) -> None:
    from tools.runner.audio import concatenate_wavs

    a = tmp_path / 'a.wav'
    b = tmp_path / 'b.wav'
    _write_wav(a, b'\x00\x00' * 20, rate=8000)
    _write_wav(b, b'\x00\x00' * 20, rate=16000)
    with pytest.raises(Exception, match='do not share one PCM format'):
        concatenate_wavs([a, b], tmp_path / 'out.wav')
