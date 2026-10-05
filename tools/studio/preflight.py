#!/usr/bin/env python3
"""Preflight: check every dependency before any expensive or failing work starts."""

from __future__ import annotations

import os
import shutil
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
REQUIREMENTS = ROOT / "requirements-local.txt"


@dataclass
class Check:
    code: str
    label: str
    ok: bool
    message: str = ""
    details: str = ""
    error_code: str | None = None
    missing: list[str] = field(default_factory=list)


class PreflightChecker:
    """Runs in the interpreter that started Zodiac Studio, never a PATH python."""

    def __init__(
        self,
        package_root: Path | None = None,
        *,
        tts_root: Path | None = None,
        tts_python: Path | None = None,
        vieneu_url: str | None = "http://127.0.0.1:7860",
        require_music: bool = False,
    ) -> None:
        self.package_root = Path(package_root) if package_root else None
        self.tts_root = Path(tts_root) if tts_root else None
        self.tts_python = tts_python
        self.vieneu_url = vieneu_url
        self.require_music = require_music

    # ---- commands ----------------------------------------------------
    def install_command(self) -> list[str]:
        return [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)]

    def install_command_text(self) -> str:
        return " ".join(f'"{part}"' if " " in part else part for part in self.install_command())

    # ---- checks ------------------------------------------------------
    def run(self) -> list[Check]:
        from tools.zodiac_local import validate_package

        checks = [self._python(), self._faster_whisper()]
        for name, code in (("node", "NODE"), ("npm", "NPM"), ("ffmpeg", "FFMPEG")):
            checks.append(self._executable(name, code))
        checks.append(self._package(validate_package))
        checks.append(self._vieneu())
        if self.require_music:
            checks.append(self._music())
        return checks

    @staticmethod
    def ready(checks: list[Check]) -> bool:
        return all(check.ok for check in checks)

    @staticmethod
    def failures(checks: list[Check]) -> list[Check]:
        return [check for check in checks if not check.ok]

    def dependency_checks(self, checks: list[Check]) -> list[Check]:
        return [check for check in self.failures(checks) if check.error_code == "DEPENDENCY_MISSING"]

    # ---- individual checks -------------------------------------------
    def _python(self) -> Check:
        return Check(
            code="PYTHON",
            label="Python đang chạy Zodiac Studio",
            ok=sys.version_info >= (3, 9),
            message=sys.executable,
            details=f"Python {sys.version.split()[0]}",
            error_code=None if sys.version_info >= (3, 9) else "DEPENDENCY_MISSING",
        )

    def _module_available(self, name: str) -> bool:
        """Importable in *this* interpreter, never in another python on PATH."""
        import importlib.util

        try:
            return importlib.util.find_spec(name) is not None
        except (ImportError, ValueError):
            return False

    def _faster_whisper(self) -> Check:
        found = self._module_available("faster_whisper")
        message = (
            "Đã có faster-whisper trong Python đang chạy."
            if found
            else "Thiếu faster-whisper trong Python đang chạy Zodiac Studio."
        )
        return Check(
            code="FASTER_WHISPER",
            label="faster-whisper (đo thời gian từng từ)",
            ok=found,
            message=message,
            details=sys.executable,
            error_code=None if found else "DEPENDENCY_MISSING",
            missing=[] if found else ["faster-whisper"],
        )

    def _executable(self, name: str, code: str) -> Check:
        found = shutil.which(name) or shutil.which(f"{name}.cmd")
        labels = {
            "NODE": "Node.js",
            "NPM": "npm",
            "FFMPEG": "FFmpeg",
        }
        return Check(
            code=code,
            label=labels[code],
            ok=bool(found),
            message=f"Đã tìm thấy {labels[code]}." if found else f"Thiếu {labels[code]} trên PATH.",
            details=str(found or ""),
            error_code=None if found else f"{code}_MISSING",
            missing=[] if found else [labels[code]],
        )

    def _package(self, validate_package) -> Check:
        if self.package_root is None:
            return Check(code="PACKAGE", label="Gói video", ok=False, message="Chưa chọn gói video.",
                         error_code="PACKAGE_INVALID")
        try:
            validate_package(self.package_root)
        except Exception as exc:
            return Check(
                code="PACKAGE",
                label="Gói video",
                ok=False,
                message="Gói video không hợp lệ với contract v2.0.",
                details=str(exc),
                error_code="PACKAGE_INVALID",
            )
        return Check(code="PACKAGE", label="Gói video", ok=True, message="Gói video hợp lệ.",
                     details=str(self.package_root))

    def _vieneu(self) -> Check:
        if self.tts_root is not None and not Path(self.tts_root).is_dir():
            return Check(
                code="VIENEU",
                label="VieNeu",
                ok=False,
                message=f"Không tìm thấy VieNeu tại {self.tts_root}.",
                details="Cài VieNeu-TTS hoặc trỏ sang bản đã có.",
                error_code="VIENEU_UNAVAILABLE",
            )
        if not self.vieneu_url:
            return Check(code="VIENEU", label="VieNeu", ok=True, message="Dùng VieNeu cục bộ.")
        try:
            request = urllib.request.Request(
                self.vieneu_url + "/config", headers={"Accept": "application/json"}
            )
            with urllib.request.urlopen(request, timeout=1.5) as response:
                ok = response.status == 200
        except (OSError, urllib.error.URLError):
            ok = False
        return Check(
            code="VIENEU",
            label="VieNeu",
            ok=ok,
            message="Đã kết nối VieNeu." if ok else "Chưa kết nối được VieNeu.",
            details=self.vieneu_url,
            error_code=None if ok else "VIENEU_UNAVAILABLE",
        )

    def _music(self) -> Check:
        music = getattr(self, "music_path", None)
        ok = bool(music and Path(music).is_file())
        return Check(
            code="MUSIC",
            label="Nhạc nền",
            ok=ok,
            message="Đã chọn nhạc nền." if ok else "Chưa chọn nhạc nền.",
            error_code=None if ok else "PACKAGE_INVALID",
        )


def environment_status(checks: list[Check]) -> str:
    """Single Vietnamese label for the header status dot."""
    from tools.studio.messages_vi import ENV_FAILED, ENV_READY

    return ENV_READY if PreflightChecker.ready(checks) else ENV_FAILED


def describe_missing(checks: list[Check]) -> str:
    """'Thiếu: • faster-whisper • Node.js' style summary for the popup."""
    missing = [name for check in checks for name in (check.missing or [])]
    return "\n".join(f"• {name}" for name in dict.fromkeys(missing))


def platform_python() -> str:
    return "python" if os.name != "nt" else "python"
