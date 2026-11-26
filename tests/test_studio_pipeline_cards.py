"""Owner cards: the chain's open questions, answered by the owner; an answer is a recorded choice, never a gate approval."""
import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.authoring_chain import Card
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import cards
from tools.studio_project.pipeline.receipts import read_receipt
from tools.studio_project.rpc_stdio import _ALLOWED, dispatch

ROOT = Path(__file__).resolve().parents[1]


class CardTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-cards-")
        self.addCleanup(context.cleanup)
        self.workspace = Path(context.name)

    def test_saved_cards_are_listed_as_cards(self):
        cards.save_cards(self.workspace, [Card("s02", "thiếu art: quầy"), Card("s05", "đã chọn lại 2 lần")])
        listed = cards.list_cards(self.workspace)
        self.assertEqual([c.scene_id for c in listed], ["s02", "s05"])
        self.assertEqual((listed[0].default, listed[0].options), ("accept", ("accept", "restage", "redo")))
        self.assertEqual(cards.list_cards(Path(tempfile.gettempdir()) / "zodiac-no-such-workspace"), [])

    def test_resolving_records_the_choice_and_closes_the_card(self):
        cards.save_cards(self.workspace, [Card("s02", "x"), Card("s05", "y")])
        cards.resolve(self.workspace, "s02", "restage")
        self.assertEqual([c.scene_id for c in cards.list_cards(self.workspace)], ["s05"])
        self.assertEqual(cards.resolution(self.workspace, "s02"), "restage")
        self.assertIsNone(cards.resolution(self.workspace, "s05"))

    def test_an_unknown_choice_or_card_is_rejected(self):
        cards.save_cards(self.workspace, [Card("s02", "x")])
        for scene, choice in (("s02", "approve"), ("s02", ""), ("s09", "accept")):
            with self.assertRaises(StudioError, msg=(scene, choice)):
                cards.resolve(self.workspace, scene, choice)
        self.assertEqual([c.scene_id for c in cards.list_cards(self.workspace)], ["s02"])

    def test_a_new_chain_run_replaces_open_cards_but_keeps_answers_to_the_same_question(self):
        cards.save_cards(self.workspace, [Card("s02", "x")])
        cards.resolve(self.workspace, "s02", "accept")
        cards.save_cards(self.workspace, [Card("s02", "x"), Card("s03", "z")])
        self.assertEqual([c.scene_id for c in cards.list_cards(self.workspace)], ["s03"])  # s02 already answered
        cards.save_cards(self.workspace, [Card("s02", "a different problem")])
        self.assertEqual([c.scene_id for c in cards.list_cards(self.workspace)], ["s02"])

    def test_answering_a_card_never_creates_a_gate_receipt(self):
        cards.save_cards(self.workspace, [Card("s02", "x")])
        cards.resolve(self.workspace, "s02", "accept")
        for gate in ("visual_review", "voice_review", "content"):
            self.assertIsNone(read_receipt(self.workspace, gate))


class RpcTests(unittest.TestCase):
    def setUp(self):
        context = tempfile.TemporaryDirectory(prefix="zodiac-cards-rpc-")
        self.addCleanup(context.cleanup)
        self.workspace = Path(context.name)
        self.service = FakeService(self.workspace, visual=visual_state(), voice=voice_state())

    def test_the_method_is_allowed_exactly_in_python_and_in_the_rust_host(self):
        self.assertIn("pipeline.card.resolve", _ALLOWED)
        rust = (ROOT / "apps/zodiac-studio/src-tauri/src/lib.rs").read_text("utf8")
        self.assertIn('"pipeline.card.resolve"', rust)
        retry_safe = rust.split("fn retry_safe")[1].split("}")[0]
        self.assertNotIn("pipeline.card", retry_safe)  # an answer is a write: never replayed

    def test_dispatch_records_the_answer(self):
        cards.save_cards(self.workspace, [Card("s02", "x")])
        out = dispatch(self.service, "pipeline.card.resolve", {"project_id": "p", "scene_id": "s02", "choice": "redo"})
        self.assertEqual(out, {"scene_id": "s02", "choice": "redo"})
        self.assertEqual(cards.resolution(self.workspace, "s02"), "redo")
        with self.assertRaises(StudioError):
            dispatch(self.service, "pipeline.card.resolve", {"project_id": "p", "scene_id": "s02", "choice": "redo", "extra": 1})


if __name__ == "__main__":
    unittest.main()
