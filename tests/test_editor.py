import json
import tempfile
import unittest
from pathlib import Path

from test_zodiac_local import package_files, write_pcm
from tools.editor.canvas import build_items, describe_source, hit_test
from tools.editor.commands import History, StateCommand
from tools.editor.document import EditorDocument, EditorError
from tools.editor.geometry import CanvasTransform
from tools.editor.runtime import invalidate_runtime_for


def editor_package() -> dict:
    """A v2 package with two scenes and three entities per scene."""
    files = package_files()
    production = json.loads(files["production.json"])
    lead_box = {"x": 100, "y": 100, "width": 300, "height": 500}
    desk_box = {"x": 600, "y": 900, "width": 400, "height": 300}
    wall_box = {"x": 0, "y": 0, "width": 1080, "height": 1920}

    def entity(entity_id: str, kind: str, state_id: str, layer: int, box: dict):
        def state(source: str):
            return {
                source: "lead.neutral" if source == "asset" else "paper.bg",
                "transform": dict(box),
                "layer": layer,
                "visible": True,
            }

        states = {state_id: state("asset" if kind == "character" else "primitive")}
        if kind == "character":
            states["active"] = state("asset")
        return {
            "id": entity_id,
            "kind": kind,
            "initial_state": state_id,
            "states": states,
        }

    def scene(scene_id: str, voice: str, event_id: str):
        return {
            "id": scene_id,
            "voice": voice,
            "timing": {"mode": "from_voice"},
            "entities": [
                entity("character.lead", "character", "neutral", 2, lead_box),
                entity("prop.desk", "prop", "idle", 5, desk_box),
                entity("bg.wall", "background", "idle", 0, wall_box),
            ],
            "events": [
                {
                    "id": event_id,
                    "target": "character.lead",
                    "action": "reacts",
                    "state_before": "neutral",
                    "state_after": "active",
                    "trigger": {"source": "scene_start"},
                    "motion": {"preset": "state_swap", "duration_frames": 6},
                },
            ],
            "transition": {"type": "hard_cut", "duration_frames": 0},
            "captions": {
                "source": "voice",
                "page_target_words": 4,
                "max_words": 7,
                "max_lines": 2,
            },
        }

    production["scenes"] = [
        scene("S01", "Xin chào mọi người.", "S01-E01"),
        scene("S02", "Hôm nay trời đẹp.", "S02-E01"),
    ]
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    files["narration.txt"] = "Xin chào mọi người.\nHôm nay trời đẹp.\n"
    return files


def write_editor_package(root: Path) -> Path:
    job = root / "zodiac-editor"
    for name, content in editor_package().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    return job


class DocumentTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_editor_package(self.root)
        self.document = EditorDocument(self.job)

    def tearDown(self):
        self._temp.cleanup()

    def _read_disk(self) -> dict:
        return json.loads((self.job / "production.json").read_text(encoding="utf-8"))

    def test_loads_v2_document_clean(self):
        self.assertEqual(self.document.scene_ids, ["S01", "S02"])
        self.assertFalse(self.document.is_dirty)

    def test_placements_are_layer_ordered_and_keep_state_kind(self):
        placements = self.document.placements("S01")
        self.assertEqual(
            [placement.layer for placement in placements],
            [0, 2, 5],
        )
        lead = placements[1]
        self.assertEqual(lead.entity_id, "character.lead")
        self.assertEqual(lead.state_id, "neutral")
        self.assertEqual(lead.asset, "lead.neutral")
        self.assertIsNone(lead.primitive)
        self.assertEqual(lead.x, 100)

    def test_transform_edit_marks_dirty_without_touching_disk(self):
        self.document.set_transform("S01", "character.lead", x=180, y=420)
        self.assertTrue(self.document.is_dirty)
        self.assertEqual(
            self.document.state("S01", "character.lead")["transform"],
            {"x": 180, "y": 420, "width": 300, "height": 500},
        )
        self.assertEqual(
            self._read_disk()["scenes"][0]["entities"][0]["states"]["neutral"]["transform"]["x"],
            100,
        )

    def test_layer_and_visible_updates(self):
        self.document.set_layer("S01", "prop.desk", 1)
        self.document.set_visible("S01", "prop.desk", False)
        self.assertEqual(self.document.state("S01", "prop.desk")["layer"], 1)
        self.assertFalse(self.document.state("S01", "prop.desk")["visible"])

    def test_revert_restores_disk_state(self):
        self.document.set_transform("S01", "character.lead", x=999)
        self.document.set_layer("S01", "prop.desk", 7)
        self.document.revert()
        self.assertFalse(self.document.is_dirty)
        self.assertEqual(self.document.state("S01", "character.lead")["transform"]["x"], 100)
        self.assertEqual(self.document.state("S01", "prop.desk")["layer"], 5)

    def test_save_writes_valid_json_with_only_intended_change(self):
        self.document.set_transform("S01", "character.lead", x=180, y=420, width=320, height=540)
        self.document.save()
        self.assertFalse(self.document.is_dirty)
        self.assertEqual(
            self.document.state("S01", "character.lead")["transform"],
            {"x": 180, "y": 420, "width": 320, "height": 540},
        )
        self.assertEqual(self._read_disk()["scenes"][0]["entities"][0]["states"]["neutral"]["transform"]["x"], 180)
        self.assertEqual(self._read_disk()["scenes"][1], json.loads(json.dumps(self._read_disk()["scenes"][1])))
        self.assertEqual(
            self._read_disk()["scenes"][1]["entities"][0]["states"]["neutral"]["transform"]["x"],
            100,
        )
        self.assertEqual(self._read_disk()["version"], "2.0")

    def test_save_leaves_design_token_untouched(self):
        design_before = (self.job / "design.md").read_bytes()
        visual_before = self._read_disk()["visual_system"]
        self.document.set_transform("S01", "character.lead", x=180)
        self.document.save()
        self.assertEqual((self.job / "design.md").read_bytes(), design_before)
        self.assertEqual(self._read_disk()["visual_system"], visual_before)

    def test_save_blocks_negative_width(self):
        self.document.set_transform("S01", "character.lead", width=-10)
        with self.assertRaisesRegex(EditorError, "character.lead"):
            self.document.save()
        self.assertFalse((self.job / "production.json.tmp").exists())
        self.assertEqual(
            self._read_disk()["scenes"][0]["entities"][0]["states"]["neutral"]["transform"]["width"],
            300,
        )

    def test_save_blocks_non_numeric_layer(self):
        self.document.set_layer("S01", "character.lead", "front")
        with self.assertRaisesRegex(EditorError, "character.lead"):
            self.document.save()
        self.assertEqual(
            self._read_disk()["scenes"][0]["entities"][0]["states"]["neutral"]["layer"],
            2,
        )

    def test_save_blocks_missing_asset_reference(self):
        self.document.set_transform("S01", "character.lead", x=10)
        self.document.state("S01", "character.lead")["asset"] = "lead.ghost"
        with self.assertRaisesRegex(EditorError, "lead.ghost"):
            self.document.save()

    def test_save_detects_external_disk_change(self):
        external = self._read_disk()
        external["scenes"][1]["voice"] = "Hôm nay trời mưa."
        (self.job / "narration.txt").write_text(
            "Xin chào mọi người.\nHôm nay trời mưa.\n",
            encoding="utf-8",
        )
        (self.job / "production.json").write_text(
            json.dumps(external, ensure_ascii=False),
            encoding="utf-8",
        )
        self.document.set_transform("S01", "character.lead", x=180)
        with self.assertRaisesRegex(EditorError, "changed on disk"):
            self.document.save()
        self.assertEqual(
            self._read_disk()["scenes"][1]["voice"],
            "Hôm nay trời mưa.",
        )

    def test_safe_zone_comes_from_caption_style(self):
        self.assertEqual(
            self.document.safe_area,
            {"x": 90, "y": 1430, "width": 900, "height": 150},
        )


class CoordinateTests(unittest.TestCase):
    def test_round_trip_between_production_and_display(self):
        view = CanvasTransform(1080, 1920, 405, 720)
        self.assertAlmostEqual(view.scale, 405 / 1080)
        for x, y in ((0, 0), (80, 720), (1079.5, 1919.5), (540, 960)):
            display = view.to_display(x, y)
            back = view.from_display(*display)
            self.assertAlmostEqual(back[0], x, places=6)
            self.assertAlmostEqual(back[1], y, places=6)

    def test_viewport_keeps_nine_by_sixteen_aspect(self):
        view = CanvasTransform(1080, 1920, 800, 600)
        self.assertAlmostEqual(view.display_width / view.display_height, 1080 / 1920)
        self.assertLessEqual(view.display_height, 600)
        self.assertAlmostEqual(view.scale, 600 / 1920)

    def test_dragged_display_offset_returns_production_offset(self):
        view = CanvasTransform(1080, 1920, 405, 720)
        self.assertAlmostEqual(view.to_production_length(30), 30 / view.scale)
        self.assertAlmostEqual(view.to_production_length(view.display_width), 1080)


class CommandTests(unittest.TestCase):
    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.job = write_editor_package(Path(self._temp.name))
        self.document = EditorDocument(self.job)
        self.history = History()

    def tearDown(self):
        self._temp.cleanup()

    def test_move_undo_redo(self):
        command = StateCommand(
            self.document,
            "S01",
            "character.lead",
            label="Move character.lead",
        )
        self.history.push(command.begin({"x": 400, "y": 640}))
        command.apply({"x": 400, "y": 640})
        self.assertEqual(self.document.state("S01", "character.lead")["transform"]["x"], 400)

        self.history.undo()
        self.assertEqual(self.document.state("S01", "character.lead")["transform"]["x"], 100)
        self.assertFalse(self.document.is_dirty)

        self.history.redo()
        self.assertEqual(self.document.state("S01", "character.lead")["transform"]["y"], 640)
        self.assertTrue(self.document.is_dirty)

    def test_new_edit_clears_redo_stack(self):
        first = StateCommand(self.document, "S01", "character.lead", label="Move")
        self.history.push(first.begin({"x": 400}))
        first.apply({"x": 400})
        self.history.undo()
        second = StateCommand(self.document, "S01", "prop.desk", label="Layer")
        self.history.push(second.begin({"layer": 1}))
        second.apply({"layer": 1})
        self.assertFalse(self.history.can_redo)
        self.assertEqual(self.document.state("S01", "prop.desk")["layer"], 1)


class CanvasHitTestTests(unittest.TestCase):
    def test_topmost_layer_wins_and_invisible_is_skipped(self):
        view = CanvasTransform(1080, 1920, 540, 960)
        with tempfile.TemporaryDirectory() as temp:
            job = write_editor_package(Path(temp))
            document = EditorDocument(job)
            document.set_visible("S01", "character.lead", False)
            items = build_items(document, "S01", view)
            hit = hit_test(items, 100 * view.scale + 1, 100 * view.scale + 1)
            self.assertEqual(hit.entity_id, "bg.wall")
            self.assertIsNone(hit_test(items, -50, -50))

    def test_hidden_entity_is_not_hit_tested_on_canvas(self):
        view = CanvasTransform(1080, 1920, 540, 960)
        with tempfile.TemporaryDirectory() as temp:
            job = write_editor_package(Path(temp))
            document = EditorDocument(job)
            document.set_visible("S01", "character.lead", False)
            self.assertNotIn(
                "character.lead",
                [item.entity_id for item in build_items(document, "S01", view)],
            )
            self.assertNotEqual(
                hit_test(build_items(document, "S01", view), 200 * view.scale, 200 * view.scale).entity_id,
                "character.lead",
            )
            # the inspector entity list is the only way back to a hidden entity
            hidden = [p for p in document.placements("S01") if p.entity_id == "character.lead"]
            self.assertEqual(len(hidden), 1)
            self.assertFalse(hidden[0].visible)

    def test_layer_order_matches_contract_layer(self):
        view = CanvasTransform(1080, 1920, 540, 960)
        with tempfile.TemporaryDirectory() as temp:
            job = write_editor_package(Path(temp))
            items = build_items(EditorDocument(job), "S01", view)
            self.assertEqual(
                [item.layer for item in items],
                sorted(item.layer for item in items),
            )
            rect = items[-1].display_rect
            self.assertAlmostEqual(rect[0], 600 * view.scale)
            self.assertAlmostEqual(rect[2], 400 * view.scale)


class RuntimeInvalidationTests(unittest.TestCase):
    def test_safe_transform_edit_keeps_voice_and_timing(self):
        with tempfile.TemporaryDirectory() as temp:
            job = write_editor_package(Path(temp))
            write_pcm(job / "voice.wav", seconds=1.0)
            timing = job / ".runtime" / "timing.json"
            timing.parent.mkdir(parents=True, exist_ok=True)
            timing.write_text("{}\n", encoding="utf-8")
            props = job / ".runtime" / "render-props.json"
            props.write_text("{}\n", encoding="utf-8")

            document = EditorDocument(job)
            document.set_transform("S01", "character.lead", x=400)
            document.set_layer("S01", "character.lead", 4)
            document.set_visible("S01", "character.lead", False)
            removed = invalidate_runtime_for(job, "transform")

            self.assertEqual(removed, [props])
            self.assertFalse(props.exists())
            self.assertTrue(timing.exists())
            self.assertTrue((job / "voice.wav").exists())
            self.assertTrue((job / ".runtime" / "timing.json").exists())


def editor_sample_archive() -> Path | None:
    """The reviewer-provided v2 sample package, when the local zip is present."""
    archive = Path(__file__).resolve().parents[1] / "ready" / "zodiac-v2-editor-sample.zip"
    return archive if archive.is_file() else None


def import_sample_package(root: Path) -> Path:
    from tools.zodiac_local import import_package

    return import_package(editor_sample_archive(), root / "jobs")


def sample_shaped_package(job: Path) -> Path:
    """Use the sample's S01 narrator numbers so both fixtures assert the same values."""
    production = json.loads((job / "production.json").read_text(encoding="utf-8"))
    state = production["scenes"][0]["entities"][0]["states"]["neutral"]
    state["transform"] = {"x": 95, "y": 650, "width": 205, "height": 350}
    state["layer"] = 3
    (job / "production.json").write_text(json.dumps(production, ensure_ascii=False), encoding="utf-8")
    return job


class PersistenceRegressionTests(unittest.TestCase):
    """load -> valid resize -> save -> reload -> invalid resize -> rejected save."""

    RESIZED = {"x": 95, "y": 650, "width": 152, "height": 259}

    def _run_sequence(self, job: Path, entity_id: str) -> None:
        document = EditorDocument(job)
        document.set_transform("S01", entity_id, width=152, height=259)
        document.save()

        reopened = EditorDocument(job)
        self.assertFalse(reopened.is_dirty)
        self.assertEqual(reopened.state("S01", entity_id)["transform"], self.RESIZED)

        reopened.set_transform("S01", entity_id, width=0, height=259)
        with self.assertRaises(EditorError):
            reopened.save()

        disk = json.loads((job / "production.json").read_text(encoding="utf-8"))
        entity = next(
            item
            for scene in disk["scenes"]
            if scene["id"] == "S01"
            for item in scene["entities"]
            if item["id"] == entity_id
        )
        self.assertEqual(entity["states"][entity["initial_state"]]["transform"], self.RESIZED)
        self.assertEqual(list(job.glob("production.json*.tmp")), [])

    def test_generated_package_keeps_last_valid_resize(self):
        with tempfile.TemporaryDirectory() as temp:
            job = sample_shaped_package(write_editor_package(Path(temp)))
            self._run_sequence(job, "character.lead")

    def test_editor_sample_zip_keeps_last_valid_resize(self):
        if editor_sample_archive() is None:
            self.skipTest("ready/zodiac-v2-editor-sample.zip is not available")
        with tempfile.TemporaryDirectory() as temp:
            self._run_sequence(import_sample_package(Path(temp)), "character.narrator")


class SamplePackageTests(unittest.TestCase):
    def setUp(self):
        if editor_sample_archive() is None:
            self.skipTest("ready/zodiac-v2-editor-sample.zip is not available")
        self._temp = tempfile.TemporaryDirectory()
        self.job = import_sample_package(Path(self._temp.name))

    def tearDown(self):
        self._temp.cleanup()

    def test_fixture_matches_the_v2_contract(self):
        document = EditorDocument(self.job)
        self.assertEqual(document.working["version"], "2.0")
        self.assertEqual(document.video, {"width": 1080, "height": 1920, "fps": 30})
        self.assertEqual(len(document.scene_ids), 2)
        for scene_id in document.scene_ids:
            self.assertEqual(len(document.placements(scene_id)), 3)

    def test_fixture_svg_and_primitive_sources_resolve(self):
        document = EditorDocument(self.job)
        for scene_id in document.scene_ids:
            for placement in document.placements(scene_id):
                detail, missing = describe_source(document, placement)
                self.assertFalse(missing, f"{placement.entity_id} -> {detail}")
                if placement.asset:
                    self.assertTrue((self.job / detail).is_file())

    def test_scene_start_and_voice_anchor_survive_a_save(self):
        before = json.loads((self.job / "production.json").read_text(encoding="utf-8"))
        document = EditorDocument(self.job)
        document.set_transform("S01", "character.narrator", x=95, y=650)
        document.save()
        after = json.loads((self.job / "production.json").read_text(encoding="utf-8"))
        self.assertEqual(before["scenes"][0]["events"], after["scenes"][0]["events"])
        self.assertEqual(
            [event["trigger"] for event in after["scenes"][0]["events"]],
            [{"source": "scene_start"}, {"source": "voice_anchor", "text": "bảng giả thuyết"}],
        )
        self.assertEqual(before["scenes"][0]["voice"], after["scenes"][0]["voice"])

    def test_design_and_style_token_are_untouched(self):
        design = (self.job / "design.md").read_bytes()
        token = EditorDocument(self.job).working["visual_system"]["style_token"]
        document = EditorDocument(self.job)
        document.set_layer("S01", "character.narrator", 4)
        document.save()
        self.assertEqual((self.job / "design.md").read_bytes(), design)
        saved = json.loads((self.job / "production.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["visual_system"]["style_token"], token)

    def test_hidden_initial_state_is_not_hit_tested(self):
        document = EditorDocument(self.job)
        view = CanvasTransform(1080, 1920, 405, 720)
        items = build_items(document, "S01", view)
        self.assertEqual([item.entity_id for item in items], ["character.friend", "character.narrator"])
        card = [p for p in document.placements("S01") if p.entity_id == "object.card"][0]
        self.assertFalse(card.visible)
        self.assertIsNone(
            hit_test(items, view.to_display(card.x + 10, card.y + 10)[0], view.to_display(card.x + 10, card.y + 10)[1])
        )


if __name__ == "__main__":
    unittest.main()