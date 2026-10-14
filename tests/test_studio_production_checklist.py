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


def workspace_fixture(root: Path, *, state_version: str | None = None, concept: str | None = "idea-1", member: str = "gemini") -> Path:
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
        "run_mode": "fresh",
        "flags": {},
        "current_phase": "02-visual-production",
        "phases": phases,
    })
    member_label = {"gemini": "Song Tử", "libra": "Thiên Bình"}[member]
    write_json(authoring / "episode-scope.json", {
        "format": "zodiac-episode-scope@1",
        "episode_id": f"{member}-trust",
        "episode_format": "single_sign",
        "member_ids": [member],
        "title_working": f"{member_label} giữ lời hứa nào?",
        "topic_question": f"Khi nào {member_label} thật sự đáng tin?",
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

            path.write_text('{"format":"zodiac-studio-checklist@1","workspaces":[],"cover_visible":true}\n', encoding="utf-8")
            original = path.read_bytes()
            _config, diagnostic = production_checklist.load_checklist_config(path)
            self.assertIsNone(diagnostic)
            self.assertIsNone(_config["series_tracker_path"])
            self.assertEqual(path.read_bytes(), original)
            production_checklist.save_checklist_config(path, _config)
            self.assertIsNone(json.loads(path.read_text(encoding="utf-8"))["series_tracker_path"])

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
            self.assertEqual(row["episode_format"], "single_sign")
            self.assertEqual(row["members"], [{"id": "gemini", "label": "Song Tử"}])
            self.assertEqual(row["title"], "Song Tử giữ lời hứa nào?")
            self.assertEqual(row["topic"], "Khi nào Song Tử thật sự đáng tin?")
            self.assertEqual(row["concept"], "Lời hứa trong hai phiên bản.")
            self.assertEqual(row["phase"], {"id": "02-visual-production", "title": "Visual Production", "status": "IN_PROGRESS"})
            self.assertEqual(row["step"], {"id": "visual_compile", "title": "Visual Compile", "status": "IN_PROGRESS"})
            self.assertTrue(row["step_contract"]["required_capabilities"])
            self.assertTrue(row["step_contract"]["required_outputs"])
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
            valid_state = json.loads(state_path.read_text(encoding="utf-8"))
            state_path.write_text('{broken json', encoding="utf-8")
            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(row["diagnostics"])

            state_path.write_text("[]", encoding="utf-8")
            row = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(row["phase"])
            self.assertTrue(row["diagnostics"])

            for field in ("current_phase", "current_step"):
                state = json.loads(json.dumps(valid_state))
                if field == "current_phase":
                    state[field] = []
                else:
                    state["phases"]["02-visual-production"][field] = []
                write_json(state_path, state)
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

            narrative_path = workspace / ".authoring" / "narrative-plan.json"
            narrative = json.loads(narrative_path.read_text(encoding="utf-8"))
            narrative["selected_concept_id"] = None
            write_json(narrative_path, narrative)
            candidates = json.loads(candidates_path.read_text(encoding="utf-8"))
            candidates["selected_candidate_id"] = None
            candidates["candidates"][0].pop("id")
            write_json(candidates_path, candidates)
            unselected = production_checklist.load_episode_row(workspace, PLUGIN_ROOT)
            self.assertIsNone(unselected["concept"])

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


class ProductionChecklistScreenTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from PySide6.QtWidgets import QApplication
        except ImportError:
            raise unittest.SkipTest("PySide6 Essentials is not installed")
        cls.qt_app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.config_path = self.root / "studio" / "production-checklist.json"

    def tearDown(self):
        from PySide6.QtCore import QCoreApplication, QEvent

        for widget in self.qt_app.topLevelWidgets():
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.qt_app.processEvents()
        self.temp.cleanup()

    def write_config(self, workspaces: list[dict], **overrides):
        config = {**production_checklist.new_checklist_config(), "workspaces": workspaces, **overrides}
        production_checklist.save_checklist_config(self.config_path, config)

    def make_screen(self, jobs: list[dict] | None = None):
        from tools.studio_qt.screens.production_checklist import ProductionChecklistScreen

        screen = ProductionChecklistScreen(self.config_path, PLUGIN_ROOT, jobs or [])
        screen.show()
        self.qt_app.processEvents()
        return screen

    def test_registered_rows_show_episode_scope_and_optional_concept(self):
        from PySide6.QtWidgets import QFileDialog

        gemini = workspace_fixture(self.root / "gemini")
        libra = workspace_fixture(self.root / "libra", member="libra", concept=None)
        original = (gemini / ".authoring" / "episode-scope.json").read_bytes()
        self.write_config([])
        screen = self.make_screen()

        with patch.object(QFileDialog, "getExistingDirectory", return_value=str(gemini)):
            screen.add_workspace_button.click()
        with patch.object(QFileDialog, "getExistingDirectory", return_value=str(libra)):
            screen.add_workspace_button.click()

        self.assertEqual(len(screen.episode_cards), 2)
        self.assertIn("Song Tử", screen.episode_cards[0]["summary"].text())
        self.assertIn("Visual Production", screen.episode_cards[0]["phase"].text())
        self.assertIn("Visual Compile", screen.episode_cards[0]["step"].text())
        self.assertIn("Lời hứa trong hai phiên bản", screen.episode_cards[0]["concept"].text())
        self.assertIn("Thiên Bình", screen.episode_cards[1]["summary"].text())
        self.assertEqual(screen.episode_cards[1]["concept"].text(), "Concept: Chưa chốt")
        screen.episode_cards[0]["remove_button"].click()
        self.assertEqual(len(screen.episode_cards), 1)
        self.assertEqual((gemini / ".authoring" / "episode-scope.json").read_bytes(), original)
        self.assertTrue(gemini.is_dir())

    def test_missing_job_and_cover_keep_explicit_link(self):
        from PySide6.QtCore import Qt
        from PySide6.QtGui import QImage

        workspace = workspace_fixture(self.root / "episode")
        legacy = self.root / "legacy" / "local-job"
        job5 = self.root / "runner" / "gemini-job"
        (job5 / "out").mkdir(parents=True)
        image = QImage(54, 96, QImage.Format.Format_RGB32)
        image.fill(Qt.GlobalColor.red)
        cover_path = job5 / "out" / "cover.png"
        self.assertTrue(image.save(str(cover_path)))
        self.write_config([{"path": str(workspace), "job_id": "deleted-job"}])
        jobs = [
            {"group": "Job local", "name": "local-job", "path": str(legacy), "out_path": str(legacy / "out")},
            {"group": "Job@5", "name": "gemini-job", "path": str(job5), "out_path": str(job5 / "out")},
        ]
        screen = self.make_screen(jobs)
        card = screen.episode_cards[0]
        picker = card["job_combo"]

        self.assertEqual(picker.currentData(), "deleted-job")
        self.assertIn("không có trong Runner", picker.currentText())
        self.assertIn("không có trong Runner", card["cover_placeholder"].text())
        self.assertNotIn("local-job", [picker.itemText(index) for index in range(picker.count())])
        picker.setCurrentIndex(picker.findData("gemini-job"))
        self.qt_app.processEvents()
        self.assertEqual(screen.episode_cards[0]["job_combo"].currentData(), "gemini-job")
        self.assertFalse(screen.episode_cards[0]["cover_placeholder"].isVisible())
        pixmap = screen.episode_cards[0]["cover_preview"].pixmap()
        self.assertFalse(pixmap.isNull())
        self.assertGreaterEqual(pixmap.width(), 290)
        self.assertGreaterEqual(pixmap.height(), 500)
        self.assertEqual(pixmap.toImage().pixelColor(0, 0), image.pixelColor(0, 0))

        cover_path.unlink()
        screen.refresh()
        card = screen.episode_cards[0]
        self.assertEqual(card["job_combo"].currentData(), "gemini-job")
        self.assertIn("cover.png", card["cover_placeholder"].text())

        screen.set_runner_jobs([jobs[0]])
        self.assertEqual(screen.episode_cards[0]["job_combo"].currentData(), "gemini-job")
        self.assertIn("không có trong Runner", screen.episode_cards[0]["job_combo"].currentText())
        self.assertIn("không có trong Runner", screen.episode_cards[0]["cover_placeholder"].text())

    def test_cover_visibility_and_series_tracker_preferences_persist(self):
        from PySide6.QtWidgets import QFileDialog

        workspace = workspace_fixture(self.root / "episode")
        tracker = self.root / "zodiac-series-checklist.json"
        signs = [{"id": sign, "status": "done" if sign == "gemini" else "todo"} for sign in sorted(SIGN_IDS)]
        write_json(tracker, {"format": "zodiac-series-checklist@1", "signs": signs})
        tracker_bytes = tracker.read_bytes()
        self.write_config([{"path": str(workspace), "job_id": None}])
        screen = self.make_screen()

        self.assertEqual(screen.series_status_label.text(), "Chưa liên kết series checklist.")
        with patch.object(QFileDialog, "getOpenFileName", return_value=(str(tracker), "JSON (*.json)")):
            screen.series_link_button.click()
        self.assertIn("1/12", screen.series_status_label.text())
        self.assertIn("Song Tử: done", screen.series_signs_label.text())
        self.assertNotIn("phase", screen.series_signs_label.text().lower())
        linked, error = production_checklist.load_checklist_config(self.config_path)
        self.assertIsNone(error)
        self.assertEqual(linked["series_tracker_path"], str(tracker.resolve()))
        screen.cover_visible_check.click()
        config, error = production_checklist.load_checklist_config(self.config_path)
        self.assertIsNone(error)
        self.assertFalse(config["cover_visible"])

        restarted = self.make_screen()
        self.assertFalse(restarted.cover_visible_check.isChecked())
        self.assertTrue(restarted.episode_cards[0]["cover_card"].isHidden())
        self.assertEqual(restarted.series_status_label.text(), screen.series_status_label.text())
        restarted.series_unlink_button.click()
        self.assertEqual(restarted.series_status_label.text(), "Chưa liên kết series checklist.")
        unlinked, error = production_checklist.load_checklist_config(self.config_path)
        self.assertIsNone(error)
        self.assertIsNone(unlinked["series_tracker_path"])
        self.assertEqual(tracker.read_bytes(), tracker_bytes)

    def test_copy_handoff_uses_current_plugin_default_prompt_routes(self):
        from PySide6.QtWidgets import QApplication

        workspace = workspace_fixture(self.root / "episode")
        scope_path = workspace / ".authoring" / "episode-scope.json"
        scope = json.loads(scope_path.read_text(encoding="utf-8"))
        scope.update({
            "episode_format": "comparison",
            "member_ids": ["gemini", "libra"],
            "title_working": "Top 6 cung xử lý bất đồng thế nào?",
            "topic_question": "Hai cung phản ứng ra sao khi bị hiểu lầm?",
        })
        write_json(scope_path, scope)
        tracker = self.root / "zodiac-series-checklist.json"
        signs = [{"id": sign, "status": "done" if sign == "gemini" else "todo"} for sign in sorted(SIGN_IDS)]
        write_json(tracker, {"format": "zodiac-series-checklist@1", "signs": signs})
        self.write_config([{"path": str(workspace), "job_id": "job-gemini"}], series_tracker_path=str(tracker))
        screen = self.make_screen()
        screen.episode_cards[0]["handoff_button"].click()
        self.qt_app.processEvents()
        copied = QApplication.clipboard().text()
        plugin = json.loads((PLUGIN_ROOT / "plugin.json").read_text(encoding="utf-8"))
        default_prompt = plugin["extensions"]["com.openai"]["interface"]["defaultPrompt"]

        self.assertIn(str(workspace.resolve()), copied)
        self.assertIn("gemini-trust", copied)
        self.assertIn("Topic: Hai cung phản ứng ra sao khi bị hiểu lầm?", copied)
        self.assertIn("Concept: Lời hứa trong hai phiên bản.", copied)
        self.assertIn("Song Tử (gemini): done", copied)
        self.assertIn("Thiên Bình (libra): todo", copied)
        self.assertIn("Tiến độ cung của tập theo tracker: 1/2", copied)
        self.assertIn("Tiến độ series: 1/12", copied)
        self.assertIn("Job@5 đã liên kết tường minh: job-gemini", copied)
        self.assertIn("02-visual-production", copied)
        self.assertIn("visual_compile", copied)
        for contract in ("Required capabilities:", "Required outputs:", "Gate checks:", "Allowed context:", "Forbidden context:", "References to load:"):
            self.assertIn(contract, copied)
        self.assertIn("first incomplete step", copied)
        self.assertIn(default_prompt, copied)
        self.assertIn("defaultPrompt", copied)
        for route in ("skills/zodiac-video-pipeline/SKILL.md", "orchestration/router.md"):
            self.assertIn(route, default_prompt)
            self.assertIn(route, copied)

    def test_malformed_preferences_show_diagnostic_and_disable_mutations(self):
        path = self.config_path
        path.parent.mkdir(parents=True)
        original = b'{"format":"zodiac-studio-checklist@99"}\n'
        path.write_bytes(original)

        screen = self.make_screen()

        self.assertTrue(screen.preferences_error_label.text())
        self.assertFalse(screen.add_workspace_button.isEnabled())
        self.assertFalse(screen.series_link_button.isEnabled())
        self.assertFalse(screen.cover_visible_check.isEnabled())
        self.assertEqual(path.read_bytes(), original)


class ProductionChecklistAppTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            from PySide6.QtWidgets import QApplication
        except ImportError:
            raise unittest.SkipTest("PySide6 Essentials is not installed")
        cls.qt_app = QApplication.instance() or QApplication([])

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)

    def tearDown(self):
        from PySide6.QtCore import QCoreApplication, QEvent

        for widget in self.qt_app.topLevelWidgets():
            widget.close()
            widget.deleteLater()
        QCoreApplication.sendPostedEvents(None, QEvent.Type.DeferredDelete)
        self.qt_app.processEvents()
        self.temp.cleanup()

    def test_studio_tab_uses_workspace_preferences_and_only_job5_links(self):
        from tools.studio_qt.app import ZodiacQtApp

        studio_workspace = self.root / "studio"
        job5 = studio_workspace / "v2" / "jobs" / "gemini-job"
        local = studio_workspace / "jobs" / "legacy-job"
        (job5 / "out").mkdir(parents=True)
        (job5 / "package-manifest.json").write_text("{}\n", encoding="utf-8")
        (local / "out").mkdir(parents=True)
        episode = workspace_fixture(self.root / "authoring" / "gemini")
        app = ZodiacQtApp(workspace=studio_workspace)

        index = app.main_tabs.indexOf(app.checklist)
        self.assertGreaterEqual(index, 0)
        self.assertEqual(app.main_tabs.tabText(index), "Checklist sản xuất")
        self.assertEqual(app.checklist.config_path, studio_workspace.resolve() / "studio-production-checklist.json")
        self.assertNotEqual(app.checklist.config_path, job5 / ".runtime" / "gui-settings.json")
        config = {
            **production_checklist.new_checklist_config(),
            "workspaces": [{"path": str(episode), "job_id": "gemini-job"}],
        }
        production_checklist.save_checklist_config(app.checklist.config_path, config)

        app._refresh_media_jobs()

        self.assertEqual([job["name"] for job in app.checklist.runner_jobs], ["gemini-job"])
        picker = app.checklist.episode_cards[0]["job_combo"]
        self.assertEqual(picker.currentData(), "gemini-job")
        self.assertNotIn("legacy-job", [picker.itemText(row) for row in range(picker.count())])

        (job5 / "package-manifest.json").unlink()
        app.main_tabs.setCurrentWidget(app.checklist)
        self.qt_app.processEvents()
        self.assertEqual(app.checklist.runner_jobs, [])
        self.assertEqual(app.checklist.episode_cards[0]["job_combo"].currentData(), "gemini-job")
        self.assertIn("không có trong Runner", app.checklist.episode_cards[0]["job_combo"].currentText())


if __name__ == "__main__":
    unittest.main()
