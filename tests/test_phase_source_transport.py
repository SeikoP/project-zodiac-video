"""Transport tests: no network calls, no CI quota."""
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
import zipfile
import sys

TOOLS = pathlib.Path(__file__).resolve().parents[1] / "tools"
sys.path.insert(0, str(TOOLS))
import fetch_phase_source as transport

SHA = "a" * 40


def outer_bundle(release="rel-good", commit=SHA):
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as inner:
        inner.writestr("SOURCE-PROVENANCE.json", json.dumps({
            "format": "zodiac-execution-source@2", "scope": "01-content",
            "plugin_version": "2.4.62", "plugin_release_id": release,
            "commit": commit, "files": []}))
    wrapper = io.BytesIO()
    with zipfile.ZipFile(wrapper, "w") as z:
        z.writestr("zodiac-execution-source.zip", payload.getvalue())
    return wrapper.getvalue()


class PhaseSourceTransportTest(unittest.TestCase):
    def test_no_artifact_fails_closed(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(transport, "request", return_value=b'{"artifacts":[]}'):
                with self.assertRaisesRegex(RuntimeError, "SOURCE_TRANSPORT_UNAVAILABLE"):
                    transport.fetch("01-content", "2.4.62", "rel-good", SHA, directory, "token")

    def test_exact_commit_required(self):
        with self.assertRaisesRegex(ValueError, "exact SHA"):
            transport.fetch("01-content", "2.4.62", "rel-good", "main", "/tmp/test", "token")

    def test_matching_artifact_stages(self):
        listing = json.dumps({"artifacts": [{
            "name": "zodiac-execution-source-01-content-" + SHA,
            "expired": False, "id": 1, "workflow_run": {"head_sha": SHA},
            "archive_download_url": "https://api.github.com/artifact"
        }]}).encode()
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(transport, "request", side_effect=[listing, outer_bundle()]):
                result = transport.fetch("01-content", "2.4.62", "rel-good", SHA,
                                         pathlib.Path(directory) / "stage", "token")
                self.assertEqual(result["status"], "SOURCE_STAGED")

    def test_wrong_release_does_not_stage(self):
        listing = json.dumps({"artifacts": [{
            "name": "zodiac-execution-source-01-content-" + SHA,
            "expired": False, "id": 1, "workflow_run": {"head_sha": SHA},
            "archive_download_url": "https://api.github.com/artifact"
        }]}).encode()
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(transport, "request", side_effect=[listing, outer_bundle(release="old")]):
                with self.assertRaisesRegex(ValueError, "release/scope mismatch"):
                    transport.fetch("01-content", "2.4.62", "rel-good", SHA,
                                    pathlib.Path(directory) / "stage", "token")


if __name__ == "__main__":
    unittest.main()
