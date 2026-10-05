"""Prompt 2 tests: voice-anchor timeline over .runtime/timing.json."""

import json
import tempfile
import unittest
from pathlib import Path

from test_zodiac_local import package_files, write_pcm
from test_editor import editor_package
from tools.editor.document import EditorDocument, EditorError
from tools.editor.runtime import invalidate_runtime_for
from tools.editor.timing import (
    ANCHOR_AMBIGUOUS,
    ANCHOR_NOT_FOUND,
    ANCHOR_OCCURRENCE_INVALID,
    NO_TIMING,
    TIMING_STALE_OR_INVALID,
    TIMING_VALID,
    AnchorProblem,
    RuntimeTimingDocument,
    frame_to_ms,
    frame_to_x,
    ms_to_frame,
    scene_frame_to_x,
    x_to_frame,
)
from tools.editor.timeline import selection_for_event

FPS = 30
VOICE_S01 = "Xử Nữ hỏi, Xử Nữ trả lời."
VOICE_S02 = "Thứ Nữ dựng bảng X."
WORD_MS = 500


def timeline_package() -> dict:
    """Two scenes with scene_start, ambiguous, occurrence=2, unique and missing anchors."""
    files = editor_package()
    production = json.loads(files["production.json"])
    box = {"x": 100, "y": 100, "width": 300, "height": 500}

    def state(source, name):
        return {
            source: name,
            "transform": dict(box),
            "layer": 2,
            "visible": True,
        }

    def event(event_id, target, before, after, trigger):
        return {
            "id": event_id,
            "target": target,
            "action": "reacts",
            "state_before": before,
            "state_after": after,
            "trigger": trigger,
            "motion": {"preset": "state_swap", "duration_frames": 6},
        }

    def scene(scene_id, voice, events):
        return {
            "id": scene_id,
            "voice": voice,
            "timing": {"mode": "from_voice"},
            "entities": [
                {
                    "id": "character.narrator",
                    "kind": "character",
                    "initial_state": "neutral",
                    "states": {
                        "neutral": state("asset", "lead.neutral"),
                        "react": state("asset", "lead.active"),
                        "nod": state("asset", "lead.active"),
                    },
                },
                {
                    "id": "object.card",
                    "kind": "object",
                    "initial_state": "hidden",
                    "states": {
                        "hidden": state("primitive", "paper.bg"),
                        "shown": state("primitive", "paper.bg"),
                    },
                },
            ],
            "events": events,
            "transition": {"type": "hard_cut", "duration_frames": 0},
            "captions": {"source": "voice", "page_target_words": 4, "max_words": 7, "max_lines": 2},
        }

    production["scenes"] = [
        scene(
            "S01",
            VOICE_S01,
            [
                event("S01-E01", "character.narrator", "neutral", "react", {"source": "scene_start"}),
                event("S01-E02", "character.narrator", "react", "nod", {"source": "voice_anchor", "text": "Xử Nữ"}),
                event(
                    "S01-E03",
                    "object.card",
                    "hidden",
                    "shown",
                    {"source": "voice_anchor", "text": "Xử Nữ", "occurrence": 2},
                ),
                event("S01-E04", "camera", None, None, {"source": "voice_anchor", "text": "trả lời"}),
                event("S01-E05", "camera", None, None, {"source": "voice_anchor", "text": "bảng X"}),
            ],
        ),
        scene(
            "S02",
            VOICE_S02,
            [
                event("S02-E01", "character.narrator", "neutral", "react", {"source": "scene_start"}),
                event(
                    "S02-E02",
                    "object.card",
                    "hidden",
                    "shown",
                    {"source": "voice_anchor", "text": "bảng X"},
                ),
            ],
        ),
    ]
    files["production.json"] = json.dumps(production, ensure_ascii=False)
    files["narration.txt"] = f"{VOICE_S01}\n{VOICE_S02}\n"
    return files


def measured_timing(job: Path) -> dict:
    """Synthetic measured word timing. Test-only, never exported as production timing."""
    rows = []
    cursor = 0
    for scene_id, voice in (("S01", VOICE_S01), ("S02", VOICE_S02)):
        captions = []
        offset = cursor * 1000 // FPS
        for index, word in enumerate(voice.split()):
            start = offset + index * WORD_MS
            captions.append(
                {
                    "text": word,
                    "startMs": float(start),
                    "endMs": float(start + WORD_MS - 60),
                    "timestampMs": float(start),
                    "confidence": 0.97,
                }
            )
        duration = len(captions) * WORD_MS * FPS // 1000
        rows.append(
            {"scene_id": scene_id, "start_frame": cursor, "duration_frames": duration, "captions": captions}
        )
        cursor += duration
    return {"fps": FPS, "total_duration_frames": cursor, "scenes": rows}


def write_timeline_job(root: Path, *, timing: bool = True) -> Path:
    job = root / "zodiac-timeline"
    for name, content in timeline_package().items():
        target = job / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
    if timing:
        path = job / ".runtime" / "timing.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(measured_timing(job), ensure_ascii=False), encoding="utf-8")
    return job


class JobCase(unittest.TestCase):
    timing = True

    def setUp(self):
        self._temp = tempfile.TemporaryDirectory()
        self.root = Path(self._temp.name)
        self.job = write_timeline_job(self.root, timing=self.timing)
        self.document = EditorDocument(self.job)

    def tearDown(self):
        self._temp.cleanup()

    def _timing(self):
        return RuntimeTimingDocument.load(self.job)


class RuntimeTimingTests(JobCase):
    def test_missing_timing_is_no_timing(self):
        timing = RuntimeTimingDocument.load(write_timeline_job(Path(tempfile.mkdtemp()), timing=False))
        self.assertEqual(timing.state, NO_TIMING)
        self.assertIsNone(timing.error)
        self.assertEqual(timing.scene_ids, [])

    def test_missing_timing_keeps_the_editor_usable(self):
        job = write_timeline_job(Path(tempfile.mkdtemp()), timing=False)
        document = EditorDocument(job)
        self.assertEqual(document.events("S01")[1]["trigger"]["text"], "Xử Nữ")
        document.set_anchor("S01", "S01-E02", text="Xử Nữ")
        self.assertTrue(document.save())
        self.assertFalse(document.is_dirty)

    def test_valid_timing_loads_scene_words(self):
        timing = self._timing()
        self.assertEqual(timing.state, TIMING_VALID)
        self.assertEqual(timing.scene_ids, ["S01", "S02"])
        scene = timing.scene("S01")
        self.assertEqual([word.text for word in scene.words][:4], ["Xử", "Nữ", "hỏi,", "Xử"])
        self.assertEqual(scene.start_frame, 0)

    def test_malformed_timing_is_stale_not_a_crash(self):
        path = self.job / ".runtime" / "timing.json"
        path.write_text("{not json", encoding="utf-8")
        timing = self._timing()
        self.assertEqual(timing.state, TIMING_STALE_OR_INVALID)
        self.assertIn("timing.json", timing.error)

    def test_timing_that_contradicts_voice_is_stale(self):
        payload = measured_timing(self.job)
        payload["scenes"][0]["captions"].pop()
        (self.job / ".runtime" / "timing.json").write_text(json.dumps(payload), encoding="utf-8")
        timing = self._timing()
        self.assertEqual(timing.state, TIMING_STALE_OR_INVALID)
        self.assertTrue(timing.error)


class TimeMappingTests(unittest.TestCase):
    def test_frame_and_x_round_trip(self):
        for frame in (0, 1, 47, 300, 899):
            x = frame_to_x(frame, 900, 640)
            self.assertAlmostEqual(x_to_frame(x, 900, 640), frame, places=6)

    def test_scene_local_frame_mapping(self):
        self.assertAlmostEqual(scene_frame_to_x(0, 900, 300), 0.0)
        self.assertAlmostEqual(scene_frame_to_x(900, 900, 300), 300.0)
        self.assertAlmostEqual(scene_frame_to_x(450, 900, 300), 150.0)

    def test_ms_and_frame_round_trip(self):
        for ms in (0, 1000, 1500, 27333):
            frame = ms_to_frame(ms, FPS)
            self.assertLessEqual(abs(frame_to_ms(frame, FPS) - ms), 1000 / FPS)

    def test_mapping_follows_panel_width(self):
        narrow = frame_to_x(300, 900, 100)
        wide = frame_to_x(300, 900, 400)
        self.assertAlmostEqual(x_to_frame(narrow, 900, 100), 300, places=6)
        self.assertAlmostEqual(x_to_frame(wide, 900, 400), 300, places=6)
        self.assertNotAlmostEqual(narrow, wide)


class AnchorResolutionTests(JobCase):
    def test_scene_start_sits_on_the_first_frame(self):
        scene = self._timing().scene("S01")
        match = resolve_scene_start(scene)
        self.assertEqual(match.local_frame, 0)
        self.assertEqual(match.global_frame, scene.start_frame)

    def test_unique_voice_anchor(self):
        scene = self._timing().scene("S01")
        match = resolve(scene, "trả lời")
        self.assertEqual(match.occurrence_count, 1)
        self.assertEqual(match.word_start, 5)

    def test_ambiguous_anchor_is_rejected_without_occurrence(self):
        with self.assertRaises(AnchorProblem) as caught:
            resolve(self._timing().scene("S01"), "Xử Nữ")
        self.assertEqual(caught.exception.code, ANCHOR_AMBIGUOUS)
        self.assertIn("2", caught.exception.message)

    def test_occurrence_two_picks_the_second_phrase(self):
        match = resolve(self._timing().scene("S01"), "Xử Nữ", 2)
        self.assertEqual(match.occurrence_count, 2)
        self.assertEqual(match.word_start, 3)
        self.assertGreater(match.local_frame, resolve(self._timing().scene("S01"), "Xử Nữ", 1).local_frame)

    def test_occurrence_out_of_range_is_rejected(self):
        for occurrence in (0, 3, -1):
            with self.assertRaises(AnchorProblem) as caught:
                resolve(self._timing().scene("S01"), "Xử Nữ", occurrence)
            self.assertEqual(caught.exception.code, ANCHOR_OCCURRENCE_INVALID)

    def test_missing_anchor_is_reported(self):
        with self.assertRaises(AnchorProblem) as caught:
            resolve(self._timing().scene("S01"), "bảng X")
        self.assertEqual(caught.exception.code, ANCHOR_NOT_FOUND)
        self.assertEqual(resolve(self._timing().scene("S02"), "bảng X").occurrence_count, 1)

    def test_anchor_normalization_matches_measured_words(self):
        scene = self._timing().scene("S01")
        self.assertEqual(resolve(scene, "  xử   nữ  ", 1).word_start, 0)
        self.assertEqual(resolve(scene, "hỏi, Xử", 1).word_start, 2)


def resolve(scene, text, occurrence=None):
    from tools.editor.timing import resolve_anchor

    return resolve_anchor(scene, text, occurrence)


def resolve_scene_start(scene):
    from tools.editor.timing import resolve_scene_start as _resolve

    return _resolve(scene)


class AnchorEditingTests(JobCase):
    def setUp(self):
        super().setUp()
        # the fixture deliberately ships an ambiguous anchor (S01-E02) and one
        # unresolvable anchor (S01-E05) so both error paths stay covered; the
        # save-path tests resolve them first.
        self.document.set_anchor("S01", "S01-E02", occurrence=1)
        self.document.set_anchor("S01", "S01-E05", text="hỏi")
        self.document.save()
        self.document = EditorDocument(self.job)

    def test_valid_anchor_edit_marks_dirty_and_saves(self):
        self.document.set_anchor("S01", "S01-E03", occurrence=1)
        self.assertTrue(self.document.is_dirty)
        self.assertTrue(self.document.save())
        self.assertFalse(self.document.is_dirty)

    def test_selection_only_is_not_dirty(self):
        self.assertEqual(selection_for_event(self.document, "S01-E03")[0]["id"], "S01-E03")
        self.assertFalse(self.document.is_dirty)

    def test_reopen_preserves_edited_anchor(self):
        self.document.set_anchor("S01", "S01-E03", occurrence=1)
        self.document.save()
        reopened = EditorDocument(self.job)
        trigger = self._event(reopened, "S01-E03")["trigger"]
        self.assertEqual(trigger["text"], "Xử Nữ")
        self.assertEqual(trigger["occurrence"], 1)

    def test_missing_anchor_edit_blocks_save_and_keeps_disk(self):
        before = (self.job / "production.json").read_text(encoding="utf-8")
        self.document.set_anchor("S01", "S01-E03", text="không tồn tại")
        with self.assertRaises(EditorError) as caught:
            self.document.save()
        self.assertIn(ANCHOR_NOT_FOUND, str(caught.exception))
        self.assertTrue(self.document.is_dirty)
        self.assertEqual((self.job / "production.json").read_text(encoding="utf-8"), before)
        self.assertEqual(list(self.job.glob("production.json*.tmp")), [])

    def test_ambiguous_anchor_without_occurrence_blocks_save(self):
        self.document.set_anchor("S01", "S01-E04", text="Xử Nữ", occurrence=None)
        with self.assertRaises(EditorError) as caught:
            self.document.save()
        self.assertIn(ANCHOR_AMBIGUOUS, str(caught.exception))

    def test_occurrence_out_of_range_blocks_save(self):
        self.document.set_anchor("S01", "S01-E03", occurrence=7)
        with self.assertRaises(EditorError) as caught:
            self.document.save()
        self.assertIn(ANCHOR_OCCURRENCE_INVALID, str(caught.exception))

    def test_anchor_edit_keeps_voice_and_timing_and_drops_render_props(self):
        write_pcm(self.job / "voice.wav", seconds=1.0)
        timing_path = self.job / ".runtime" / "timing.json"
        timing_before = timing_path.read_bytes()
        props = self.job / ".runtime" / "render-props.json"
        props.write_text("{}\n", encoding="utf-8")

        self.document.set_anchor("S01", "S01-E02", occurrence=1)
        self.document.save()
        removed = invalidate_runtime_for(self.job, "anchor")

        self.assertEqual(removed, [props])
        self.assertFalse(props.exists())
        self.assertEqual(timing_path.read_bytes(), timing_before)
        self.assertTrue((self.job / "voice.wav").is_file())

    def test_scene_start_and_anchors_survive_anchor_edit(self):
        before = json.loads((self.job / "production.json").read_text(encoding="utf-8"))
        self.document.set_anchor("S01", "S01-E02", occurrence=2)
        self.document.save()
        after = json.loads((self.job / "production.json").read_text(encoding="utf-8"))
        self.assertEqual(before["scenes"][0]["events"][0], after["scenes"][0]["events"][0])
        self.assertEqual(before["scenes"][0]["voice"], after["scenes"][0]["voice"])
        self.assertEqual(
            [event["trigger"]["source"] for event in after["scenes"][0]["events"]],
            ["scene_start", "voice_anchor", "voice_anchor", "voice_anchor", "voice_anchor"],
        )

    def test_no_timing_package_saves_anchor_without_guessing(self):
        job = write_timeline_job(Path(tempfile.mkdtemp()), timing=False)
        document = EditorDocument(job)
        document.set_anchor("S01", "S01-E02", text="Xử Nữ", occurrence=1)
        self.assertTrue(document.save())
        trigger = document.events("S01")[1]["trigger"]
        self.assertEqual(trigger, {"source": "voice_anchor", "text": "Xử Nữ", "occurrence": 1})
        self.assertNotIn("startMs", json.dumps(document.working))

    def test_unknown_event_or_scene_is_reported(self):
        with self.assertRaises(EditorError):
            self.document.set_anchor("S01", "S01-E99", text="x")
        with self.assertRaises(EditorError):
            self.document.set_anchor("S99", "S01-E01", text="x")

    def test_scene_start_trigger_is_not_editable(self):
        with self.assertRaises(EditorError):
            self.document.set_anchor("S01", "S01-E01", text="trả lời")

    def _event(self, document, event_id):
        for scene in document.scene_ids:
            for event in document.events(scene):
                if event["id"] == event_id:
                    return event
        raise AssertionError(event_id)


class SelectionSyncTests(JobCase):
    def test_event_selection_reports_target_entity(self):
        event, entity_id = selection_for_event(self.document, "S01-E03")
        self.assertEqual(event["id"], "S01-E03")
        self.assertEqual(entity_id, "object.card")

    def test_camera_event_has_no_target_entity(self):
        event, entity_id = selection_for_event(self.document, "S01-E04")
        self.assertEqual(event["target"], "camera")
        self.assertIsNone(entity_id)

    def test_unknown_event_selects_nothing(self):
        event, entity_id = selection_for_event(self.document, "nope")
        self.assertIsNone(event)
        self.assertIsNone(entity_id)

    def test_selection_does_not_touch_state_or_files(self):
        before = (self.job / "production.json").read_text(encoding="utf-8")
        selection_for_event(self.document, "S01-E03")
        self.assertFalse(self.document.is_dirty)
        self.assertEqual((self.job / "production.json").read_text(encoding="utf-8"), before)


if __name__ == "__main__":
    unittest.main()