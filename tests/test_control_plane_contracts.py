import json
import unittest
from pathlib import Path

from tools.control_plane.contracts import (
    canonical_contract_hash,
    contract_path,
    validate_contract_shape,
)

ROOT = Path(__file__).resolve().parents[1]

REQUIRED_CONTRACTS = (
    "zodiac-job-v5",
    "authoring-ir-v1",
    "timing-v1",
    "render-plan-v1",
    "design-token-v4",
    "publish-v1",
    "error-v1",
)


class ControlPlaneContractTests(unittest.TestCase):
    def test_all_canonical_contract_files_exist(self):
        for name in REQUIRED_CONTRACTS:
            path = contract_path(name)
            self.assertTrue(path.is_file(), name)
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertIn("$schema", payload)
            self.assertIn("$id", payload)

    def test_contract_hash_is_stable(self):
        first = canonical_contract_hash("authoring-ir-v1")
        second = canonical_contract_hash("authoring-ir-v1")
        self.assertEqual(first, second)
        self.assertRegex(first, r"^[0-9a-f]{64}$")

    def test_minimal_job_manifest_is_valid(self):
        document = {
            "format": "zodiac-job@5",
            "contract": {
                "id": "zodiac-authoring-ir",
                "version": "1.0.0",
                "sha256": "a" * 64,
            },
            "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
            "producer": {"plugin": "zodiac-video-pipeline", "version": "2.0.0"},
        }
        self.assertEqual(validate_contract_shape("zodiac-job-v5", document), [])

    def test_job_manifest_missing_contract_is_rejected(self):
        document = {
            "format": "zodiac-job@5",
            "renderer": {"id": "zodiac-renderer", "version": "2.0.0"},
            "producer": {"plugin": "zodiac-video-pipeline", "version": "2.0.0"},
        }
        issues = validate_contract_shape("zodiac-job-v5", document)
        self.assertTrue(any(issue.path == "$.contract" for issue in issues))

    def test_minimal_authoring_ir_is_valid(self):
        document = {
            "format": "zodiac-authoring-ir@1",
            "fps": 24,
            "video": {"width": 1080, "height": 1920},
            "assets": {},
            "scenes": [
                {
                    "id": "S01",
                    "voice": "xin chao",
                    "duration_hint_frames": 120,
                    "entities": [],
                    "events": [],
                }
            ],
        }
        self.assertEqual(validate_contract_shape("authoring-ir-v1", document), [])

    def test_minimal_timing_is_valid(self):
        document = {
            "format": "zodiac-timing@1",
            "fps": 24,
            "total_duration_frames": 48,
            "scenes": [
                {
                    "id": "S01",
                    "start_frame": 0,
                    "duration_frames": 48,
                    "captions": [
                        {
                            "text": "xin",
                            "startMs": 0,
                            "endMs": 500,
                            "timestampMs": 0,
                        }
                    ],
                }
            ],
        }
        self.assertEqual(validate_contract_shape("timing-v1", document), [])

    def test_minimal_render_plan_is_valid(self):
        document = {
            "format": "zodiac-render-plan@1",
            "fps": 24,
            "video": {"width": 1080, "height": 1920},
            "assets": {},
            "scenes": [
                {
                    "id": "S01",
                    "start_frame": 0,
                    "duration_frames": 48,
                    "events": [],
                }
            ],
        }
        self.assertEqual(validate_contract_shape("render-plan-v1", document), [])


if __name__ == "__main__":
    unittest.main()
