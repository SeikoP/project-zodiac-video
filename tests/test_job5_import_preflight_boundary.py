"""Exercise the actual package import boundary (not only helper functions)."""
from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from tools.control_plane.contracts import canonical_contract_hash
from tools.control_plane.errors import ControlPlaneError
from tools.control_plane.package_validation import validate_job5_package_root

FIXTURE=Path(__file__).resolve().parents[1]/"tests"/"fixtures"/"control-plane-v2"/"minimal"


class PreflightPackageIntegration(unittest.TestCase):
    def test_modern_package_reports_two_ambiguous_events_before_import(self):
        with tempfile.TemporaryDirectory() as temp:
            pkg=Path(temp)/"job"
            shutil.copytree(FIXTURE,pkg)
            shutil.rmtree(pkg/".runtime",ignore_errors=True)
            publish=pkg/"publish"
            publish.mkdir(exist_ok=True)
            (publish/"publish.json").write_text(json.dumps({
                "format":"zodiac-publish@1",
                "source":{"narration":"narration.txt","production":"production.ir.json"}
            }),encoding="utf-8")
            (publish/"publish-copy.txt").write_text("test",encoding="utf-8")
            ir=json.loads((pkg/"production.ir.json").read_text(encoding="utf-8"))
            ir["scenes"][0]["voice"]="Song Tử nói. Song Tử lắng nghe."
            a=ir["scenes"][0]["events"][0]
            a["trigger"]={"type":"voice_anchor","text":"Song"}
            b={**a,"id":"E02","state_before":"open","state_after":"guarded","trigger":{
                "type":"voice_anchor","text":"Song"
            }}
            ir["scenes"][0]["events"]=[a,b]
            (pkg/"production.ir.json").write_text(json.dumps(ir,ensure_ascii=False),encoding="utf-8")
            (pkg/"narration.txt").write_text(ir["scenes"][0]["voice"]+"\n",encoding="utf-8")
            (pkg/"package-manifest.json").write_text(json.dumps({
                "format":"zodiac-job@5",
                "job":{"id":"anchor-ambiguity","revision":"1.0"},
                "contract":{"id":"zodiac-authoring-ir","version":"1.0.0",
                            "sha256":canonical_contract_hash("authoring-ir-v1")},
                "renderer":{"id":"zodiac-renderer","version":"2.0.1"},
                "producer":{"plugin":"zodiac-video-pipeline","version":"2.2.14"}
            }),encoding="utf-8")
            with self.assertRaises(ControlPlaneError) as caught:
                validate_job5_package_root(pkg)
            self.assertEqual(caught.exception.code,"PACKAGE_AUTHORING_PREFLIGHT_FAILED")
            self.assertEqual(caught.exception.detail["issue_count"],2)
            self.assertEqual({x["event_id"] for x in caught.exception.detail["issues"]},{"E01","E02"})


if __name__=="__main__":
    unittest.main()
