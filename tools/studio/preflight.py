#!/usr/bin/env python3
"""Preflight: check every dependency before any expensive or failing work starts."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

from tools.zodiac_local import PipelineError

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
    @property
    def requirements_path(self) -> Path:
        return REQUIREMENTS

    def install_command(self) -> list[str]:
        if not REQUIREMENTS.is_file():
            # A missing requirements file must not produce a command pip cannot run.
            raise PipelineError(
                f"Không tìm thấy {REQUIREMENTS}. Không thể cài dependency tự động."
            )
        return [sys.executable, "-m", "pip", "install", "-r", str(REQUIREMENTS)]

    def install_command_text(self) -> str:
        return " ".join(f'"{part}"' if " " in part else part for part in self.install_command())

    # ---- checks ------------------------------------------------------
    def run(self, *, on_check: Callable[[Check], None] | None = None,
            on_start: Callable[[str], None] | None = None) -> list[Check]:
        """Run in order and publish each *observed* check result, even on fail."""
        from tools.zodiac_local import validate_package

        checks: list[Check] = []

        def take(label: str, callback) -> None:
            if on_start is not None:
                on_start(label)
            result = callback()
            checks.append(result)
            if on_check is not None:
                on_check(result)

        take("Python", self._python)
        take("faster-whisper", self._faster_whisper)
        for name, code in (("node", "NODE"), ("npm", "NPM"), ("ffmpeg", "FFMPEG")):
            take(code, lambda n=name, c=code: self._executable(n, c))
        take("PACKAGE", lambda: self._package(validate_package))
        take("VieNeu", self._vieneu)
        if self.require_music:
            take("Nhạc nền", self._music)
        return checks

    @staticmethod
    def ready(checks: list[Check]) -> bool:
        return all(check.ok for check in checks)

    @staticmethod
    def failures(checks: list[Check]) -> list[Check]:
        """Every check that is not green."""
        return [check for check in checks if not check.ok]

    @staticmethod
    def dependency_checks(checks: list[Check]) -> list[Check]:
        """Missing installable dependencies, ignoring VieNeu/package state."""
        return [check for check in checks if check.error_code == "DEPENDENCY_MISSING"]

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
            "FFPROBE": "ffprobe",
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


class Job5PreflightChecker(PreflightChecker):
    """Use the imported Job@5 contract and Renderer 2 for GUI checks."""

    def _package(self, _validate_package) -> Check:
        from tools.control_plane.package_validation import validate_job5_package_root

        if self.package_root is None:
            return Check("PACKAGE", "Gói Job@5", False, "Chưa chọn job.")
        try:
            validate_job5_package_root(self.package_root, local_workspace=True)
        except Exception as exc:
            return Check("PACKAGE", "Gói Job@5", False, str(exc),
                         "Kiểm tra nội dung gói hoặc nhập lại ZIP nguồn.")
        return Check("PACKAGE", "Gói Job@5", True, "Contract và tài nguyên hợp lệ.")

    def renderer_directory(self) -> Path:
        import json
        version = "2.0.1"
        manifest = (self.package_root / "package-manifest.json") if self.package_root else None
        if manifest and manifest.is_file():
            try:
                payload = json.loads(manifest.read_text(encoding="utf-8"))
                candidate = payload["renderer"]["version"]
                if candidate in {"2.0.0", "2.0.1"}:
                    version = candidate
            except (KeyError, ValueError, OSError, TypeError):
                pass  # PACKAGE validator handles invalid manifest contents.
        return ROOT / "runtime" / "zodiac-renderer" / version / "renderer"

    def renderer_check(self) -> Check:
        import json
        renderer = self.renderer_directory()
        source = ("package.json", "scripts/prepare.mjs", "src/index.ts",
                  "scripts/local-remotion-cli.mjs")
        # v2.0.0 predates the pinned launcher and remains backward compatible.
        if renderer.parent.name == "2.0.0":
            source = source[:-1]
        missing = [name for name in source if not (renderer / name).is_file()]
        install_command = f'npm install --prefix "{renderer}"'
        if missing:
            return Check("RENDERER", "Renderer " + renderer.parent.name, False,
                         "Thiếu mã nguồn renderer: " + ", ".join(missing),
                         "Cập nhật repository rồi kiểm tra lại.", error_code="RENDERER_SOURCE_MISSING")
        try:
            configured = json.loads((renderer / "package.json").read_text(encoding="utf-8"))
            expected = configured["dependencies"]["@remotion/cli"]
            cli_dir = renderer / "node_modules" / "@remotion" / "cli"
            installed = json.loads((cli_dir / "package.json").read_text(encoding="utf-8"))
            bin_value = installed.get("bin")
            bin_relative = bin_value if isinstance(bin_value,str) else bin_value.get("remotion") if isinstance(bin_value,dict) else None
            entry = (cli_dir / str(bin_relative)).resolve() if bin_relative else None
            if installed.get("version") != expected:
                raise ValueError("Installed @remotion/cli version differs from pinned " + expected)
            if entry is None or not entry.is_relative_to(cli_dir.resolve()) or not entry.is_file():
                raise ValueError("Pinned local Remotion CLI executable is missing")
            # Probe actual CLI boot, not just package.json and bin presence.
            # Broken nested node_modules/which/isexe installs pass the old check.
            if renderer.parent.name == "2.0.1":
                node = shutil.which("node")
                if not node:
                    raise ValueError("Node.js is missing")
                result = subprocess.run(
                    [node, str(renderer / "scripts" / "local-remotion-cli.mjs"), "--check"],
                    cwd=str(renderer), capture_output=True, text=True,
                    # Allow the launcher's 60s help probe to report its own failure.
                    encoding="utf-8", errors="replace", timeout=75, check=False,
                )
                if result.returncode:
                    message = result.stderr.strip() or result.stdout.strip()
                    try:
                        import json as _json
                        detail = _json.loads(result.stderr.strip().splitlines()[-1])
                        message = detail.get("message", message)
                        if detail.get("code") == "RENDERER_CLI_TIMEOUT":
                            raise subprocess.TimeoutExpired(node, 60, stderr=message)
                    except (ValueError, IndexError, TypeError, AttributeError):
                        pass
                    raise ValueError("Remotion CLI không khởi chạy được: " + message[:1300])
        except subprocess.TimeoutExpired as exc:
            return Check("RENDERER", "Renderer " + renderer.parent.name, False,
                         f"Remotion CLI khởi động quá thời gian chờ {exc.timeout} giây.",
                         "Thử kiểm tra môi trường lại. Timeout chưa chứng minh dependency bị thiếu hoặc hỏng.",
                         error_code="RENDERER_CLI_TIMEOUT")
        except (OSError, KeyError, TypeError, ValueError) as exc:
            return Check("RENDERER", "Renderer " + renderer.parent.name, False,
                         "Thiếu hoặc sai Remotion CLI cục bộ: " + str(exc),
                         "Cài đúng renderer: " + install_command, error_code="DEPENDENCY_MISSING")
        return Check("RENDERER", "Renderer " + renderer.parent.name, True,
                     "Remotion CLI " + expected + " đã sẵn sàng.")

    def install_commands(self, checks: list[Check]) -> list[list[str]]:
        commands = []
        missing = {check.code for check in checks if check.error_code == "DEPENDENCY_MISSING"}
        if "FASTER_WHISPER" in missing:
            commands.append(self.install_command())
        if "RENDERER" in missing:
            if self.renderer_directory().parent.name == "2.0.1":
                # Broken transitive installs (e.g. missing isexe) cannot be
                # reliably repaired by npm install over the old node_modules.
                # Use atomic backup/rebuild/CLI smoke verification instead.
                commands.append([sys.executable,"-m","tools.studio.renderer_repair",
                                 "--version","2.0.1"])
            else:
                npm = shutil.which("npm.cmd") or shutil.which("npm")
                if npm is None:
                    raise PipelineError("Không tìm thấy npm; cài Node.js và mở lại Studio.")
                commands.append([npm, "install", "--prefix", str(self.renderer_directory()),
                                 "--no-audit", "--no-fund"])
        return commands

    def run(self, *, on_check: Callable[[Check], None] | None = None,
            on_start: Callable[[str], None] | None = None) -> list[Check]:
        def report(check: Check) -> None:
            if not check.ok:
                if check.code == "FASTER_WHISPER":
                    check.details = self.install_command_text()
                elif check.code in {"NODE", "NPM"}:
                    check.details = "Cài Node.js kèm npm, sau đó mở lại GUI."
                elif check.code in {"FFMPEG", "FFPROBE"}:
                    check.details = "Cài FFmpeg gồm ffprobe và thêm thư mục bin vào PATH."
                elif check.code == "VIENEU":
                    check.details = f"Khởi động VieNeu tại {self.vieneu_url}; kiểm tra thư mục {self.tts_root}."
                elif check.code == "MUSIC":
                    check.details = "Chọn lại file nhạc nền còn tồn tại hoặc bỏ chọn nhạc."
            if on_check is not None:
                on_check(check)

        checks = super().run(on_check=report, on_start=on_start)
        if on_start is not None:
            on_start("FFPROBE")
        check = self._executable("ffprobe", "FFPROBE")
        checks.append(check)
        report(check)
        if on_start is not None:
            on_start("RENDERER")
        check = self.renderer_check()
        checks.append(check)
        report(check)
        return checks


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
