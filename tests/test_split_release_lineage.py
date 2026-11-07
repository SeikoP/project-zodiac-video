"""Phase-scoped execution source must bind to the owning split plugin release."""
import json
import unittest
from tools.build_source_bundle import release_identity_for_phase

class SplitReleaseLineageTests(unittest.TestCase):
    def test_phase_one_uses_web_release_and_phase_two_three_use_local_release(self):
        record={
            "format":"zodiac-plugin-release@2",
            "plugin_version":"2.8.0",
            "source_commit":"a"*40,
            "web_plugin":{"plugin_id":"plugins_web","release_id":"pluginrel_web"},
            "local_plugin":{"plugin_id":"plugins_local","release_id":"pluginrel_local"},
        }
        self.assertEqual(release_identity_for_phase(record,"01-content"),("web","pluginrel_web"))
        self.assertEqual(release_identity_for_phase(record,"02-visual-production"),("local","pluginrel_local"))
        self.assertEqual(release_identity_for_phase(record,"03-handoff"),("local","pluginrel_local"))

    def test_legacy_release_record_remains_supported_for_rollback(self):
        record={"format":"zodiac-plugin-release@1","plugin_release_id":"pluginrel_legacy"}
        self.assertEqual(release_identity_for_phase(record,"01-content"),("monolithic","pluginrel_legacy"))
        self.assertEqual(release_identity_for_phase(record,"03-handoff"),("monolithic","pluginrel_legacy"))

    def test_split_record_fails_closed_when_owning_release_is_missing(self):
        record={"format":"zodiac-plugin-release@2","web_plugin":{"release_id":"pluginrel_web"}}
        with self.assertRaisesRegex(ValueError,"release ID"):
            release_identity_for_phase(record,"02-visual-production")

if __name__=="__main__":
    unittest.main()
