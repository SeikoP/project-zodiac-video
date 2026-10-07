import json
import unittest
from pathlib import Path

from tools.zodiac_local import (
    DEFAULT_PLAYBACK_RATE,
    DEFAULT_SCENE_GAP_MS,
    DEFAULT_SENTENCE_PAUSE_MS,
)

ROOT = Path(__file__).resolve().parents[1]


class MemeV31CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.contract = json.loads(
            (ROOT / "tests" / "fixtures" / "meme-v31-compile-contract.json").read_text(
                encoding="utf-8"
            )
        )

    def test_meme_v31_stays_compile_time_on_runtime_116(self):
        runtime = json.loads(
            (
                ROOT
                / "runtime"
                / "zodiac-remotion"
                / "1.16.0"
                / "runtime-manifest.json"
            ).read_text(encoding="utf-8")
        )
        self.assertEqual(self.contract["runtime_recipe_ids"], False)
        self.assertEqual(self.contract["runtime"]["version"], "1.16.0")
        self.assertEqual(runtime["version"], "1.16.0")
        self.assertEqual(
            self.contract["compile_target"],
            "production-v2-entity-state-event-contract",
        )

    def test_recipe_policy_and_hard_attachments_are_recorded(self):
        self.assertEqual(self.contract["recipes_are"], "accelerators_not_whitelist")
        self.assertEqual(len(self.contract["approved_recipes"]), 8)
        self.assertEqual(
            set(self.contract["rejected_recipes"]),
            {"hush_blob", "side_eye_peek", "floor_melt", "pls_pls"},
        )
        banner = self.contract["hard_attachments"]["banner_bonk"]
        self.assertEqual(
            banner["required_anchors"],
            ["left_hand", "right_hand", "top_banner"],
        )
        self.assertTrue(banner["must_visually_contact_hands"])
        self.assertTrue(banner["floating_prop_forbidden"])
        rose = self.contract["hard_attachments"]["rose_peek"]
        self.assertEqual(rose["prop_attachment"], "mouth")
        self.assertTrue(rose["must_touch_anchor"])
        self.assertFalse(rose["floating_near_face_fallback"])
        self.assertEqual(
            self.contract["hard_attachments"]["receipt_shame"]["reuse_master"],
            "props/master/receipt.svg",
        )

    def test_asset_only_change_does_not_regress_pacing_defaults(self):
        self.assertEqual(DEFAULT_PLAYBACK_RATE, 1.0)
        self.assertEqual(DEFAULT_SCENE_GAP_MS, 350.0)
        self.assertEqual(DEFAULT_SENTENCE_PAUSE_MS, 320.0)


if __name__ == "__main__":
    unittest.main()
