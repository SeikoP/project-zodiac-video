"""Pin the Job@5 authoring schema fingerprint shared with the producer plugin."""
import unittest

from tools.control_plane.contracts import canonical_contract_hash

PINNED_SPATIAL_SHA256 = "787bd1c4addd6cf3ec187b4019b5c988555df870563f75989d0ef6b5dfd52f21"


class SpatialSchemaSyncTests(unittest.TestCase):
    def test_schema_matches_plugin_spatial_contract(self):
        self.assertEqual(canonical_contract_hash("authoring-ir-v1"), PINNED_SPATIAL_SHA256)


if __name__ == "__main__":
    unittest.main()
