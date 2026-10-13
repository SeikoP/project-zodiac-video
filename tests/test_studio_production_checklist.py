from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from tools.studio_qt import production_checklist


ROOT = Path(__file__).resolve().parents[1]
PLUGIN_ROOT = ROOT / "plugins" / "zodiac-video-pipeline"
SKILL_ROOT = PLUGIN_ROOT / "skills" / "zodiac-video-pipeline"
SIGN_IDS = {
    "aries", "taurus", "gemini", "cancer", "leo", "virgo",
    "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces",
}


def write_json(path: Path, value: object) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def workspace_fixture(root: Path, *, state_version: str | None = None, concept: str | None = "idea-1") -> Path:
    authoring = root / ".authoring"
    plugin = json.loads((PLUGIN_ROOT / "plugin.json").read_text(encoding="utf-8"))
    index = json.loads((SKILL_ROOT / "orchestration" / "phase-index.json").read_text(encoding="utf-8"))
    phases = {}
    for item in index["phases"]:
        manifest = json.loads((SKILL_ROOT / "orchestration" / item["manifest"]).read_text(encoding="utf-8"))
        current = item["id"] == "02-visual-production"
        steps = {step["id"]: {"status": "LOCKED"} for step in manifest["steps"]}
        current_step = manifest["steps"][0]["id"]
        steps[current_step]["status"] = "IN_PROGRESS" if current else "LOCKED"
        phases[item["id"]] = {
            "status": "IN_PROGRESS" if current else "LOCKED",
            "current_step": current_step,
            "steps": steps,
        }
    write_json(authoring / "pipeline-state.json", {
        "format": "zodiac-pipeline-state@2",
        "plugin_version": state_version or plugin["version"],
        "current_phase": "02-visual-production",
        "phases": phases,
    })
    write_json(authoring / "episode-scope.json", {
        "format": "zodiac-episode-scope@1",
        "episode_id": "gemini-trust",
        "episode_format": "single_sign",
        "member_ids": ["gemini"],
        "title_working": "Song Tử giữ lời hứa nào?",
        "topic_question": "Khi nào Song Tử thật sự đáng tin?",
        "selection_reason": "Một câu hỏi cụ thể cho tập.",
    })
    if concept is not None:
        write_json(authoring / "narrative-plan.json", {"selected_concept_id": concept})
        write_json(authoring / "concept-candidates.json", {
            "format": "zodiac-concept-competition@1",
            "selected_candidate_id": concept,
            "candidates": [
                {"id": "idea-1", "premise": "Lời hứa trong hai phiên bản."},
                {"id": "idea-2", "premise": "Cánh cửa đổi lời."},
            ],
        })
    return root


class ProductionChecklistDataTests(unittest.TestCase):
    def test_config_defaults_and_atomic_round_trip(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "studio" / "production-checklist.json"
            expected = {
                "format": "zodiac-studio-checklist@1",
                "workspaces": [],
                "series_tracker_path": None,
                "cover_visible": True,
            }

            self.assertEqual(production_checklist.new_checklist_config(), expected)
            self.assertEqual(production_checklist.load_checklist_config(path), (expected, None))
            config = {**expected, "workspaces": [{"path": str(Path(temp) / "episode"), "job_id": "job-123"}]}
            production_checklist.save_checklist_config(path, config)
            self.assertEqual(production_checklist.load_checklist_config(path), (config, None))

    def test_invalid_preferences_are_not_overwritten(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "production-checklist.json"
            path.write_text('{"format":"zodiac-studio-checklist@99","private":"keep"}\n', encoding="utf-8")
            original = path.read_bytes()

            _config, diagnostic = production_checklist.load_checklist_config(path)

            self.assertTrue(diagnostic)
            self.assertEqual(path.read_bytes(), original)
            with self.assertRaises(ValueError):
                production_checklist.save_checklist_config(path, {"format": "wrong"})
            self.assertEqual(path.read_bytes(), original)

    def test_failed_atomic_replace_preserves_previous_bytes(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "production-checklist.json"
            original = b'{"format":"zodiac-studio-checklist@1","workspaces":[],"series_tracker_path":null,"cover_visible":true}\n'
            path.write_bytes(original)
            with patch.object(production_checklist.os, "replace", side_effect=OSError("replace failed")):
                with self.assertRaises(OSError):
                    production_checklist.save_checklist_config(path, production_checklist.new_checklist_config())
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(list(path.parent.iterdir()), [path])

    def test_episode_row_uses_live_phase_and_step_labels(self):
        with tempfile.TemporaryDirectory() as temp:
            workspace = workspace_fixture(Path(temp) / "episode")
            before = {path: path.read_bytes() for path in (workspace / ".authoring").iterdir()}

            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)

            self.assertEqual(row["episode_id"], "gemini-trust")
            self.assertEqual(row["members"], [{"id": "gemini", "label": "Song Tử"}])
            self.assertEqual(row["title"], "Song Tử giữ lời hứa nào?")
            self.assertEqual(row["topic"], "Khi nào Song Tử thật sự đáng tin?")
            self.assertEqual(row["concept"], "Lời hứa trong hai phiên bản.")
            self.assertEqual(row["phase"], {"id": "02-visual-production", "title": "Visual Production", "status": "IN_PROGRESS"})
            self.assertEqual(row["step"], {"id": "visual_compile", "title": "Visual Compile", "status": "IN_PROGRESS"})
            self.assertEqual(row["diagnostics"], [])
            self.assertEqual(before, {path: path.read_bytes() for path in before})

    def test_workspace_state_errors_are_diagnostic(self):
        with tempfile.TemporaryDirectory() as temp:
            missing = Path(temp) / "missing"
            row = production_checklist.load_episode_row(missing, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(row["diagnostics"])

            workspace = workspace_fixture(Path(temp) / "mismatch", state_version="0.0.0")
            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(any("version" in issue.lower() for issue in row["diagnostics"]))

            state_path = workspace / ".authoring" / "pipeline-state.json"
            state_path.write_text('{broken json', encoding="utf-8")
            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(row["diagnostics"])

            state_path.write_text("[]", encoding="utf-8")
            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(row["diagnostics"])

    def test_episode_scope_and_concept_are_not_guessed(self):
        with tempfile.TemporaryDirectory() as temp:
            workspace = workspace_fixture(Path(temp) / "episode", concept="not-selected")
            candidates_path = workspace / ".authoring" / "concept-candidates.json"
            candidates = json.loads(candidates_path.read_text(encoding="utf-8"))
            candidates["selected_candidate_id"] = "idea-2"
            write_json(candidates_path, candidates)

            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)

            self.assertIsNone(row["concept"])
            self.assertEqual(row["title"], "Song Tử giữ lời hứa nào?")

            absent = Path(temp) / "no-scope"
            (absent / ".authoring").mkdir(parents=True)
            write_json(absent / ".authoring" / "pipeline-state.json", json.loads((workspace / ".authoring" / "pipeline-state.json").read_text(encoding="utf-8")))
            missing_scope = production_checklist.load_episode_row(absent, PLUGIN_ROOT)
            self.assertIsNone(missing_scope["episode_id"])
            self.assertIsNone(missing_scope["title"])
            self.assertTrue(missing_scope["diagnostics"])

            scope_path = workspace / ".authoring" / "episode-scope.json"
            scope = json.loads(scope_path.read_text(encoding="utf-8"))
            scope["episode_format"] = []
            write_json(scope_path, scope)
            malformed_scope = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(malformed_scope["episode_id"])
            self.assertTrue(malformed_scope["diagnostics"])

    def test_series_tracker_requires_valid_twelve_sign_contract(self):
        with tempfile.TemporaryDirectory() as temp:
            tracker = Path(temp) / "zodiac-series-checklist.json"
            signs = [{"id": sign, "status": "done" if sign == "gemini" else "todo"} for sign in sorted(SIGN_IDS)]
            write_json(tracker, {"format": "zodiac-series-checklist@1", "signs": signs})

            result = production_checklist.load_series_tracker(tracker)

            self.assertIsNone(result["diagnostic"])
            self.assertEqual(len(result["signs"]), 12)
            self.assertEqual({item["id"] for item in result["signs"]}, SIGN_IDS)
            self.assertEqual(result["done"], 1)
            self.assertEqual(result["todo"], 11)

            for invalid in (
                {"format": "unsupported", "signs": signs},
                {"format": "zodiac-series-checklist@1", "signs": signs[:-1]},
                {"format": "zodiac-series-checklist@1", "signs": signs[:-1] + [{"id": "gemini", "status": "todo"}]},
                {"format": "zodiac-series-checklist@1", "signs": signs[:-1] + [{"id": "pisces", "status": "complete"}]},
                {"format": "zodiac-series-checklist@1", "signs": signs[:-1] + [{"id": [], "status": []}]},
            ):
                write_json(tracker, invalid)
                rejected = production_checklist.load_series_tracker(tracker)
                self.assertIsNotNone(rejected["diagnostic"])
                self.assertEqual(rejected["signs"], [])


if __name__ == "__main__":
    unittest.main()
