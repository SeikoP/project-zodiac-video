import json
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from tools.audit.collect_pipeline_metrics import collect


def test_missing_receipt_fails_closed():
    with TemporaryDirectory() as tmp:
        with pytest.raises(FileNotFoundError):
            collect(Path(tmp))


def test_metrics_only_use_observed_receipts():
    with TemporaryDirectory() as tmp:
        root = Path(tmp)
        receipts = root / ".authoring"
        receipts.mkdir()
        (receipts / "phase02-execution-receipt.json").write_text(json.dumps({
            "format": "zodiac-phase02-execution@1",
            "run_id": "r1",
            "status": "NATIVE_CORE_PASS_MANIFEST_REVIEW_REQUIRED",
            "source": {"fingerprint": "abc"},
            "steps": [
                {"id": "character_write", "status": "PASS", "elapsed_ms": 12},
                {"id": "visual_quality", "status": "SKIPPED_REUSED"}
            ]
        }))
        metrics = collect(root)
        m = metrics["measurements"]
        assert m["cache_hits"] == 1
        assert m["total_compiler_wall_ms"] == 12
        assert m["zip_bytes"] is None
        assert m["final_render_ms"] is None
        assert m["context_bytes"] is None
