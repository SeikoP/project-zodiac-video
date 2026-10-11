"""Pin the Job@5 authoring schema fingerprint shared with the producer plugin."""
import unittest

from tools.control_plane.contracts import canonical_contract_hash

PINNED_SPATIAL_SHA256 = "2ca8394b51a9b95174ee407731f309ec3cfd44b03f5f98f25655f46cbb625b85"


class SpatialSchemaSyncTests(unittest.TestCase):
    def test_schema_matches_plugin_spatial_contract(self):
        self.assertEqual(canonical_contract_hash("authoring-ir-v1"), PINNED_SPATIAL_SHA256)


if __name__ == "__main__":
    unittest.main()
