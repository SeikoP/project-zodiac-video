"""Pin the Job@5 authoring schema fingerprint shared with the producer plugin."""
import unittest

from tools.control_plane.contracts import canonical_contract_hash

from pathlib import Path
import json, hashlib

PRODUCER_SCHEMA = Path(__file__).resolve().parents[1] / 'plugins/zodiac-video-pipeline/skills/zodiac-video-pipeline/references/contracts/authoring-ir-v1.schema.json'


class SpatialSchemaSyncTests(unittest.TestCase):
    def test_schema_matches_plugin_spatial_contract(self):
        schema = json.loads(PRODUCER_SCHEMA.read_text(encoding="utf-8"))
        producer_hash = hashlib.sha256(json.dumps(schema, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()
        self.assertEqual(canonical_contract_hash("authoring-ir-v1"), producer_hash)


if __name__ == "__main__":
    unittest.main()
