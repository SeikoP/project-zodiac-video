"""Pin the Job@5 authoring schema fingerprint shared with the producer plugin."""
import unittest

from tools.control_plane.contracts import canonical_contract_hash

PINNED_SPATIAL_SHA256 = "d67c4e806f00d23b8298089fb76326627f277f75f4ca86546e3ea1e72fb1fd2e"


class SpatialSchemaSyncTests(unittest.TestCase):
    def test_schema_matches_plugin_spatial_contract(self):
        self.assertEqual(canonical_contract_hash("authoring-ir-v1"), PINNED_SPATIAL_SHA256)


if __name__ == "__main__":
    unittest.main()
