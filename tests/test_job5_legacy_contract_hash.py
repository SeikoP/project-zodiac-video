"""Regression tests for compatibility with the audited Job@5 authoring schema."""
from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_validation import validate_job5_package_root


LEGACY = "06233fa281c8a10479038209af3ef98e6dc01e14ba99a912b3f0269aa0581544"


def _minimal_package(tmp_path: Path, digest: str) -> Path:
    manifest = {
        "format": "zodiac-job@5",
        "contract": {"id": "zodiac-authoring-ir", "version": "1.0.0", "sha256": digest},
        "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
    }
    (tmp_path / "package-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
    (tmp_path / "production.ir.json").write_text("{}", encoding="utf-8")
    (tmp_path / "design-token.json").write_text("{}", encoding="utf-8")
    (tmp_path / "narration.txt").write_text("", encoding="utf-8")
    publish = tmp_path / "publish"
    publish.mkdir()
    (publish / "publish.json").write_text(
        json.dumps({"source": {"narration": "narration.txt", "production": "production.ir.json"}}),
        encoding="utf-8",
    )
    (publish / "publish-copy.txt").write_text("", encoding="utf-8")
    return tmp_path


def _validate_mocked_downstream(root: Path):
    # Only the contract-fingerprint gate is isolated. Production IR validation
    # stays enabled in the actual importer; it is mocked here for this unit test.
    with (
        patch("tools.control_plane.package_validation._validate_schema"),
        patch("tools.control_plane.package_validation.load_authoring_ir", return_value={"scenes": [], "assets": {}}),
        patch("tools.control_plane.package_validation._validate_narration"),
        patch("tools.control_plane.package_validation._validate_asset_files"),
    ):
        return validate_job5_package_root(root)


def test_legacy_fingerprint_is_recognized(tmp_path):
    package = _minimal_package(tmp_path, LEGACY)
    assert _validate_mocked_downstream(package)["manifest"]["contract"]["sha256"] == LEGACY


def test_unknown_fingerprint_is_rejected(tmp_path):
    package = _minimal_package(tmp_path, "0" * 64)
    with pytest.raises(ControlPlaneError) as exc:
        _validate_mocked_downstream(package)
    assert exc.value.code == "PACKAGE_CONTRACT_MISMATCH"
