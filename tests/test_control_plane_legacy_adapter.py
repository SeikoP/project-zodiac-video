import copy
import json
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.authoring import validate_authoring_ir
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.legacy_adapter import adapt_job4_package, adapt_job4_production


def legacy_production():
    return {
        "version": "2.0",
        "video": {"width": 1080, "height": 1920, "fps": 30},
        "assets": {
            "lead.neutral": {"kind": "svg", "path": "assets/lead-neutral.svg"},
            "lead.active": {"kind": "svg", "path": "assets/lead-active.svg"},
        },
        "visual_system": {
            "motion_presets": {
                "state_swap": {"duration_frames": 6}
            }
        },
        "scenes": [
            {
                "id": "S01",
                "voice": "Xin chào mọi người.",
                "entities": [
                    {
                        "id": "character.lead",
                        "kind": "character",
                        "initial_state": "neutral",
                        "states": {
                            "neutral": {
                                "asset": "lead.neutral",
                                "transform": {"x": 100, "y": 100, "width": 300, "height": 500},
                            },
                            "active": {
                                "asset": "lead.active",
                                "transform": {"x": 100, "y": 100, "width": 300, "height": 500},
                            },
                        },
                    }
                ],
                "events": [
                    {
                        "id": "S01-E01",
                        "target": "character.lead",
                        "action": "reacts",
                        "state_before": "neutral",
                        "state_after": "active",
                        "trigger": {"source": "scene_start"},
                        "motion": {"preset": "state_swap", "duration_frames": 6},
                        "performance": {
                            "anticipation_frames": 4,
                            "hold_frames": 8,
                            "settle_frames": 6,
                        },
                    }
                ],
            }
        ],
    }


class LegacyAdapterTests(unittest.TestCase):
    def test_adapts_supported_job4_production_to_canonical_ir(self):
        ir = adapt_job4_production(legacy_production())
        self.assertEqual(ir["format"], "zodiac-authoring-ir@1")
        self.assertEqual(ir["fps"], 30)
        self.assertEqual(ir["video"], {"width": 1080, "height": 1920})
        event = ir["scenes"][0]["events"][0]
        self.assertEqual(event["intent"], "reacts")
        self.assertEqual(event["trigger"], {"type": "scene_start"})
        self.assertEqual(event["desired_motion"], "state_swap")
        self.assertEqual(
            event["scheduling"],
            {"max_drift_frames": 0, "merge_policy": "never"},
        )
        self.assertNotIn("performance", event)
        self.assertNotIn("duration_frames", event)
        validate_authoring_ir(ir)

    def test_adapter_does_not_copy_legacy_runtime_fields(self):
        production = legacy_production()
        production["scenes"][0]["events"][0]["runtime_motion"] = {
            "start_frame": 9,
            "end_frame": 20,
        }
        ir = adapt_job4_production(production)
        serialized = json.dumps(ir)
        self.assertNotIn("runtime_motion", serialized)
        self.assertNotIn("anticipation_frames", serialized)
        self.assertNotIn("hold_frames", serialized)
        self.assertNotIn("settle_frames", serialized)
        self.assertNotIn("start_frame", serialized)
        self.assertNotIn("end_frame", serialized)

    def test_unsupported_trigger_fails_closed(self):
        production = legacy_production()
        production["scenes"][0]["events"][0]["trigger"] = {
            "source": "absolute_frame",
            "frame": 12,
        }
        with self.assertRaises(ControlPlaneError) as caught:
            adapt_job4_production(production)
        self.assertEqual(caught.exception.code, "LEGACY_ADAPTER_UNSUPPORTED")
        self.assertEqual(caught.exception.stage, "PACKAGE")

    def test_missing_motion_preset_fails_closed(self):
        production = legacy_production()
        production["scenes"][0]["events"][0].pop("motion")
        with self.assertRaises(ControlPlaneError) as caught:
            adapt_job4_production(production)
        self.assertEqual(caught.exception.code, "LEGACY_ADAPTER_UNSUPPORTED")

    def test_adapt_job4_package_requires_job4_manifest(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            (root / "package-manifest.json").write_text(
                json.dumps({
                    "format": "zodiac-job@4",
                    "production_contract": "2.0",
                    "runtime": {"id": "zodiac-remotion", "version": "1.21.0"},
                    "producer": {"plugin": "zodiac-video-pipeline", "version": "1.58.0"},
                }),
                encoding="utf-8",
            )
            (root / "production.json").write_text(
                json.dumps(legacy_production()),
                encoding="utf-8",
            )
            ir = adapt_job4_package(root)
            validate_authoring_ir(ir)

            manifest = json.loads((root / "package-manifest.json").read_text(encoding="utf-8"))
            manifest["format"] = "zodiac-job@3"
            (root / "package-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
            with self.assertRaises(ControlPlaneError) as caught:
                adapt_job4_package(root)
            self.assertEqual(caught.exception.code, "LEGACY_ADAPTER_UNSUPPORTED")


if __name__ == "__main__":
    unittest.main()
