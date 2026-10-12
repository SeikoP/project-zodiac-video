from __future__ import annotations

from pathlib import Path
import subprocess
import sys
from types import SimpleNamespace

import pytest


class FakeCurrent:
    def __init__(self, workspace_root: Path, **_: object) -> None:
        self.workspace_root = Path(workspace_root)
        self.job = None
        self.video_path = None
        self.package_revision = None
        self.running = False
        self.cancelled = False
        self.run_calls = []

    def import_archive(self, source: Path) -> Path:
        self.job = self.workspace_root / "v2" / "jobs" / "job5"
        self.video_path = self.job / "out" / "zodiac-story.mp4"
        self.package_revision = "r5"
        return self.job

    def open_workspace(self, source: Path) -> Path:
        self.job = Path(source)
        self.video_path = self.job / "out" / "zodiac-story.mp4"
        self.package_revision = "r5"
        return self.job

    def pipeline_rows(self):
        return [{"step": "PACKAGE", "status": "DONE", "detail": "job5"}]

    def cancel(self) -> None:
        self.cancelled = True

    def run(self, config, *, rerun_from=None):
        self.run_calls.append((config, rerun_from))
        return SimpleNamespace(ok=True)


class FakeCompat:
    def __init__(self, workspace_root: Path, **_: object) -> None:
        self.workspace_root = Path(workspace_root)
        self.job = None
        self.video_path = None
        self.package_revision = None
        self.running = False
        self.cancelled = False
        self.run_calls = []
        self.conflict = False

    def import_archive(self, source: Path):
        self.job = self.workspace_root / "jobs" / "legacy"
        return SimpleNamespace(path=self.job, package_conflict=self.conflict)

    def open_workspace(self, source: Path):
        self.job = Path(source)
        return SimpleNamespace(path=self.job, package_conflict=False)

    def pipeline_rows(self):
        return [{"step": "PACKAGE", "status": "DONE", "detail": "legacy"}]

    def cancel(self) -> None:
        self.cancelled = True

    def run(self, request, observers=None):
        self.run_calls.append((request, observers))
        return True


def make_service(tmp_path: Path, *, current_manifest=True):
    from tools.application.service import ApplicationService

    detector = lambda source: ({"format": "zodiac-job@5"} if current_manifest else None)
    return ApplicationService(
        tmp_path,
        current_factory=FakeCurrent,
        compat_factory=FakeCompat,
        detector=detector,
    )



def test_importing_current_application_service_does_not_load_legacy_controller() -> None:
    probe = (
        "import sys; import tools.application.service; "
        "raise SystemExit(1 if 'tools.studio.controller' in sys.modules else 0)"
    )
    result = subprocess.run([sys.executable, '-c', probe], check=False)
    assert result.returncode == 0

def test_job5_import_is_primary_and_common_state_routes_to_current(tmp_path: Path) -> None:
    from tools.application.service import MODE_CURRENT

    source = tmp_path / "job.zip"
    source.write_bytes(b"placeholder")
    service = make_service(tmp_path, current_manifest=True)

    opened = service.open("import", source)

    assert opened.mode == MODE_CURRENT
    assert opened.path == tmp_path / "v2" / "jobs" / "job5"
    assert service.mode == MODE_CURRENT
    assert service.job == opened.path
    assert service.video_path == opened.path / "out" / "zodiac-story.mp4"
    assert service.package_revision == "r5"
    assert service.pipeline_rows()[0]["detail"] == "job5"
    service.cancel()
    assert service.current.cancelled is True
    assert service.compat.cancelled is False


def test_legacy_import_is_explicit_compatibility_adapter(tmp_path: Path) -> None:
    from tools.application.service import MODE_LEGACY

    source = tmp_path / "old.zip"
    source.write_bytes(b"placeholder")
    service = make_service(tmp_path, current_manifest=False)

    opened = service.open("import", source)

    assert opened.mode == MODE_LEGACY
    assert opened.path == tmp_path / "jobs" / "legacy"
    assert service.pipeline_rows()[0]["detail"] == "legacy"
    service.cancel()
    assert service.compat.cancelled is True
    assert service.current.cancelled is False


def test_open_existing_v2_workspace_routes_without_manifest_probe(tmp_path: Path) -> None:
    from tools.application.service import MODE_CURRENT

    service = make_service(tmp_path, current_manifest=False)
    job = tmp_path / "v2" / "jobs" / "abc"
    job.mkdir(parents=True)

    opened = service.open("open", job)

    assert opened.mode == MODE_CURRENT
    assert opened.path == job


def test_run_request_uses_one_service_interface_for_current_and_legacy(tmp_path: Path) -> None:
    from tools.application.service import ApplicationRunRequest

    request = ApplicationRunRequest(
        resume=True,
        rerun="RENDER",
        voice="voice-a",
        music=None,
        volume=0.4,
        align_model="tiny",
        scene_gap_ms=180.0,
    )

    current = make_service(tmp_path / "current", current_manifest=True)
    (tmp_path / "current").mkdir()
    source = tmp_path / "current" / "job.zip"
    source.write_bytes(b"x")
    current.open("import", source)
    assert current.run(request) is True
    config, rerun_from = current.current.run_calls[-1]
    assert config.voice_profile == "voice-a"
    assert config.tts_settings["scene_gap_ms"] == 180.0
    assert config.aligner_settings["scene_gap_ms"] == 180.0
    assert rerun_from == "RENDER"

    legacy = make_service(tmp_path / "legacy", current_manifest=False)
    (tmp_path / "legacy").mkdir()
    old = tmp_path / "legacy" / "old.zip"
    old.write_bytes(b"x")
    legacy.open("import", old)
    assert legacy.run(request) is True
    legacy_request, _ = legacy.compat.run_calls[-1]
    assert legacy_request.rerun == "RENDER"


def test_qt_shell_depends_on_application_service_not_two_pipeline_controllers() -> None:
    source = Path("tools/studio_qt/app.py").read_text(encoding="utf-8")
    assert "from tools.application.service import" in source
    assert "from tools.studio.controller import StudioController" not in source
    assert "StudioV2Session" not in source
    assert "self.controller" not in source
    assert "self.v2_session" not in source
    assert "LEGACY_STAGES" not in source
    assert "LEGACY_RERUN" not in source


def test_managed_process_helpers_have_runner_owner_and_legacy_reexports() -> None:
    from tools.runner.process import observe_subprocess_output as owned_observer
    from tools.runner.process import run_managed_subprocess as owned_runner
    from tools.zodiac_local import observe_subprocess_output as legacy_observer
    from tools.zodiac_local import run_managed_subprocess as legacy_runner

    assert legacy_observer is owned_observer
    assert legacy_runner is owned_runner