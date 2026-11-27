"""The constructive chain: cast first, then each scene (stage, act, assemble, look) with bounded re-choices and owner cards."""
import json
import threading
import time
import unittest

from tools.studio_project import authoring_chain
from tools.studio_project.authoring_chain import Card, ChainResult, SceneOutcome, run_chain
from tools.studio_project.pipeline import failure_policy

ORDER = ["s01", "s02", "s03", "s04"]


class FakeIO:
    """What the chain needs from the project, in memory. `issues` maps scene id -> list of finding lists, one per look."""

    def __init__(self, issues=None, requests=None, fingerprint="fp1"):
        self.calls, self.lock, self.active, self.peak = [], threading.Lock(), 0, 0
        self.issues, self.requests, self._fingerprint = dict(issues or {}), dict(requests or {}), fingerprint
        self.stored, self.looks, self.fixed = {}, {}, []

    def fingerprint(self):
        return self._fingerprint

    def scene_ids(self):
        return list(ORDER)

    def load(self):
        return json.loads(json.dumps(self.stored))

    def save(self, state):
        self.stored = json.loads(json.dumps(state))

    def skeleton(self):
        self.calls.append("skeleton")
        return '{"kind":"authoring.skeleton"}'

    def stage_request(self, skeleton, sid, feedback):
        return {"kind": "stage"}, {"scene": sid, "feedback": feedback}

    def act_request(self, skeleton, sid, stage, feedback):
        return {"kind": "act"}, {"scene": sid, "feedback": feedback}

    def choose(self, kind, schema, data):
        with self.lock:
            self.calls.append((kind, data["scene"]))
            self.active += 1
            self.peak = max(self.peak, self.active)
        time.sleep(0.02)
        with self.lock:
            self.active -= 1
        return {"kind": kind, "scene": data["scene"]}

    def assemble(self, skeleton, sid, stage, act):
        part = {"text": json.dumps({"scene": sid, "n": sum(1 for c in self.calls if c == ("stage", sid))})}
        if sid in self.requests:
            part["asset_requests"] = [{"wanted": self.requests[sid], "code": "NEW_VARIANT_MASTER_REQUIRED"}]
        return part

    def check_scene(self, skeleton, sid, text):
        rows = self.issues.get(sid) or []
        self.looks[sid] = self.looks.get(sid, 0) + 1
        return list(rows.pop(0)) if rows else []

    def core_fix(self, sid, text, issues):
        self.fixed.append((sid, [i["code"] for i in issues]))
        return text

    def merge(self, skeleton, texts, order):
        return json.dumps({"order": order, "scenes": texts})


class PolicyTests(unittest.TestCase):
    def test_core_fixable_issues_route_to_core_and_never_to_the_model(self):
        for code in ("OUTSIDE_CANVAS", "CAPTION_OCCLUSION", "SCENE_FIELD_MISSING"):
            self.assertEqual(failure_policy.route({"code": code}), "core", code)
        self.assertEqual(failure_policy.route({"code": "NEW_VARIANT_MASTER_REQUIRED"}), "owner")
        self.assertEqual(failure_policy.route({"code": "ENVIRONMENT_VISUAL_UNDERDEVELOPED"}), "model")
        self.assertEqual(failure_policy.route({}), "model")


class ChainTests(unittest.TestCase):
    def run_chain(self, io, stopped=lambda: False):
        return run_chain(io, stopped=stopped)

    def test_the_cast_is_authored_first_then_every_scene_in_order_two_at_a_time(self):
        io = FakeIO()
        result = self.run_chain(io)
        self.assertEqual(io.calls[0], "skeleton")
        self.assertEqual([c[1] for c in io.calls[1:] if c[0] == "stage"], ORDER)  # scenes start in order
        self.assertLessEqual(io.peak, 2)
        self.assertGreaterEqual(io.peak, 2)
        self.assertEqual(json.loads(result.proposal["text"])["order"], ORDER)
        self.assertTrue(all(o.status == "ok" for o in result.scenes.values()))
        self.assertEqual(result.cards, [])

    def test_a_core_fixable_issue_never_calls_the_model_again(self):
        io = FakeIO(issues={"s02": [[{"code": "OUTSIDE_CANVAS"}], []]})
        result = self.run_chain(io)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s02")), 1)
        self.assertEqual(io.fixed, [("s02", ["OUTSIDE_CANVAS"])])
        self.assertEqual(result.scenes["s02"].status, "ok")
        self.assertEqual(result.scenes["s02"].rechoices, 0)

    def test_a_scene_is_chosen_again_until_clean_up_to_the_cap_then_a_card_defaulting_to_accept(self):
        bad = [{"code": "ENVIRONMENT_VISUAL_UNDERDEVELOPED"}]
        io = FakeIO(issues={"s03": [bad] * 12})
        result = self.run_chain(io)
        cap = authoring_chain.MAX_RECHOICES
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s03")), 1 + cap)
        outcome = result.scenes["s03"]
        self.assertEqual((outcome.status, outcome.rechoices), ("card", cap))
        card = next(c for c in result.cards if c.scene_id == "s03")
        self.assertEqual((card.default, card.options), ("accept", ("accept", "restage", "redo")))
        self.assertIn("ENVIRONMENT_VISUAL_UNDERDEVELOPED", card.reason)
        self.assertIsNotNone(result.proposal)  # a card never blocks the episode: the default keeps the scene as it is

    def test_a_scene_that_gets_clean_after_three_tries_needs_no_card(self):
        bad = [{"code": "ENVIRONMENT_VISUAL_UNDERDEVELOPED"}]
        io = FakeIO(issues={"s03": [bad, bad, bad, []]})
        result = self.run_chain(io)
        self.assertEqual((result.scenes["s03"].status, result.scenes["s03"].rechoices), ("ok", 3))
        self.assertEqual(result.cards, [])

    def test_a_finding_goes_back_to_the_choice_that_caused_it(self):
        io = FakeIO(issues={"s01": [[{"code": "PASSIVE_STORYTELLING"}], []], "s02": [[{"code": "ENVIRONMENT_VISUAL_UNDERDEVELOPED"}], []]})
        self.run_chain(io)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s01")), 1)   # an events problem keeps the stage
        self.assertEqual(sum(1 for c in io.calls if c == ("act", "s01")), 2)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s02")), 2)   # a composition problem chooses the stage again
        self.assertEqual(sum(1 for c in io.calls if c == ("act", "s02")), 2)

    def test_findings_on_the_merged_episode_send_the_named_scene_back_until_the_episode_is_clean(self):
        io = FakeIO()
        rounds = [[{"code": "STORY_VISUAL_COVERAGE", "scene_id": "s03"}], []]
        io.check_episode = lambda skeleton, texts, order: rounds.pop(0)
        result = self.run_chain(io)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s03")), 2)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s01")), 1)  # only the scene that was named
        self.assertEqual(result.cards, [])
        self.assertIsNotNone(result.proposal)

    def test_a_clean_episode_clears_a_stale_quality_card_but_keeps_a_missing_art_card(self):
        io = FakeIO()
        io.stored = {"fingerprint": "fp1", "skeleton": "{}", "scenes": {
            "s01": {"text": "t1", "status": "card", "rechoices": 5, "reason": "đã chọn lại 5 lần, còn: VISUAL_DEPTH_UNDERDEVELOPED"},
            "s02": {"text": "t2", "status": "card", "rechoices": 0, "reason": "thiếu art: một quầy"},
            "s03": {"text": "t3", "status": "ok", "rechoices": 0, "reason": ""}, "s04": {"text": "t4", "status": "ok", "rechoices": 0, "reason": ""}}}
        io.check_episode = lambda skeleton, texts, order: []
        result = self.run_chain(io)
        self.assertEqual([c.scene_id for c in result.cards], ["s02"])
        self.assertEqual(result.scenes["s01"].status, "ok")

    def test_an_episode_finding_that_never_clears_becomes_a_card_after_the_rounds_run_out(self):
        io = FakeIO()
        io.check_episode = lambda skeleton, texts, order: [{"code": "STORY_VISUAL_COVERAGE", "scene_id": "s02"}]
        result = self.run_chain(io)
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s02")), 1 + authoring_chain.EPISODE_ROUNDS)
        card = next(c for c in result.cards if c.scene_id == "s02")
        self.assertIn("STORY_VISUAL_COVERAGE", card.reason)
        self.assertEqual(result.scenes["s02"].status, "card")
        self.assertIsNotNone(result.proposal)

    def test_a_rechoice_carries_the_findings_to_the_model(self):
        seen = []
        io = FakeIO(issues={"s01": [[{"code": "VISUAL_DEPTH_UNDERDEVELOPED"}], []]})
        original = io.stage_request
        io.stage_request = lambda sk, sid, fb: (seen.append((sid, fb)) or original(sk, sid, fb))
        self.run_chain(io)
        first, second = [fb for sid, fb in seen if sid == "s01"]
        self.assertIsNone(first)
        self.assertIn("VISUAL_DEPTH_UNDERDEVELOPED", json.dumps(second))

    def test_missing_art_is_a_card_not_a_substitute(self):
        io = FakeIO(requests={"s02": "một cửa hàng bánh tráng nướng"})
        result = self.run_chain(io)
        card = next(c for c in result.cards if c.scene_id == "s02")
        self.assertIn("bánh tráng", card.reason)
        self.assertEqual(result.scenes["s02"].status, "card")
        self.assertEqual(sum(1 for c in io.calls if c == ("stage", "s02")), 1)  # asking again would not conjure art

    def test_a_changed_voice_or_catalog_discards_stored_parts(self):
        first = FakeIO()
        self.run_chain(first)
        second = FakeIO(fingerprint="changed")
        second.stored = first.stored
        self.run_chain(second)
        self.assertEqual(second.calls.count("skeleton"), 1)
        self.assertEqual(sorted(c[1] for c in second.calls if isinstance(c, tuple) and c[0] == "stage"), ORDER)

    def test_parts_saved_under_the_old_fingerprint_are_resumed_not_discarded(self):
        first = FakeIO(fingerprint="old-with-instruction")
        self.run_chain(first)
        second = FakeIO(fingerprint="new")
        second.legacy_fingerprints = lambda: ("old-with-instruction",)
        second.stored = first.stored
        self.run_chain(second)
        self.assertEqual(second.calls.count("skeleton"), 0)  # nothing is authored again
        self.assertEqual([c for c in second.calls if isinstance(c, tuple) and c[0] == "stage"], [])
        self.assertEqual(second.stored["fingerprint"], "new")

    def test_after_an_app_reset_only_unfinished_scenes_call_the_model(self):
        first = FakeIO()
        stop = {"flag": False}

        def stopped():
            return stop["flag"]
        original = first.choose

        def choose(kind, schema, data):
            out = original(kind, schema, data)
            if kind == "act" and data["scene"] in ("s01", "s02"):
                stop["flag"] = True  # the app goes away while s01 and s02 are in flight (s03, s04 never start)
            return out
        first.choose = choose
        partial = self.run_chain(first, stopped)
        self.assertIsNone(partial.proposal)
        self.assertEqual(sorted(first.stored["scenes"]), ["s01", "s02"])
        second = FakeIO()
        second.stored = first.stored
        result = self.run_chain(second)
        self.assertNotIn("skeleton", second.calls)
        self.assertEqual(sorted(c[1] for c in second.calls if isinstance(c, tuple) and c[0] == "stage"), ["s03", "s04"])
        self.assertEqual(json.loads(result.proposal["text"])["order"], ORDER)

    def test_a_choice_that_cannot_be_drawn_is_chosen_again_with_the_reason_not_failed(self):
        io = FakeIO()
        seen = []
        original = io.assemble

        def assemble(skeleton, sid, stage, act):
            if sid == "s02" and not seen:
                seen.append(1)
                raise authoring_chain.ChoiceError("assemble: STORY_VISUAL_ART_INVALID versus_side")
            return original(skeleton, sid, stage, act)
        io.assemble = assemble
        fed = []
        stage_request = io.stage_request
        io.stage_request = lambda sk, sid, fb: (fed.append((sid, fb)) or stage_request(sk, sid, fb))
        result = self.run_chain(io)
        self.assertEqual(result.scenes["s02"].status, "ok")
        again = [fb for sid, fb in fed if sid == "s02"][-1]
        self.assertIn("versus_side", json.dumps(again))

    def test_a_model_failure_marks_the_scene_failed_and_withholds_the_proposal(self):
        io = FakeIO()

        def choose(kind, schema, data):
            if data["scene"] == "s03":
                raise authoring_chain.ChoiceError("schema")
            return {"kind": kind, "scene": data["scene"]}
        io.choose = choose
        result = self.run_chain(io)
        self.assertEqual(result.scenes["s03"].status, "failed")
        self.assertIsNone(result.proposal)
        self.assertEqual(result.scenes["s04"].status, "ok")


class LiveIOTests(unittest.TestCase):
    """The parts of the real ports that need no model: the store and the fingerprint."""

    def make(self, tmp, catalog="c1"):
        from pathlib import Path
        from types import SimpleNamespace
        from unittest import mock
        capsule = {"dependencies": {"voice": "v1"}, "source_hash": "s1", "catalog": {"x": catalog}, "scene_ranges": [{"id": "s01"}]}
        service = SimpleNamespace(visual=SimpleNamespace(_handle=lambda pid: SimpleNamespace(workspace=Path(tmp))),
                                  voice=SimpleNamespace(snapshot=lambda pid: {"timing": {"words": []}}))
        with mock.patch("tools.studio_project.agent_authoring.capsule", return_value=capsule):
            return authoring_chain.LiveIO(service, "p", "làm đi")

    def test_state_survives_a_restart_and_the_fingerprint_follows_the_inputs(self):
        import tempfile
        with tempfile.TemporaryDirectory() as tmp:
            io = self.make(tmp)
            self.assertEqual(io.load(), {})
            io.save({"fingerprint": io.fingerprint(), "scenes": {"s01": {"text": "t"}}})
            again = self.make(tmp)
            self.assertEqual(again.load()["scenes"]["s01"]["text"], "t")
            self.assertEqual(again.fingerprint(), io.fingerprint())
            self.assertNotEqual(self.make(tmp, catalog="c2").fingerprint(), io.fingerprint())
            self.assertEqual(io.scene_ids(), ["s01"])

    def test_another_instruction_keeps_the_stored_scenes_and_only_discard_clears_them(self):
        import tempfile
        from types import SimpleNamespace
        from pathlib import Path
        from unittest import mock
        with tempfile.TemporaryDirectory() as tmp:
            first = self.make(tmp)
            first.save({"fingerprint": first.fingerprint(), "scenes": {"s01": {"text": "t"}}})
            capsule = {"dependencies": {"voice": "v1"}, "source_hash": "s1", "catalog": {"x": "c1"}, "scene_ranges": [{"id": "s01"}]}
            service = SimpleNamespace(visual=SimpleNamespace(_handle=lambda pid: SimpleNamespace(workspace=Path(tmp))),
                                      voice=SimpleNamespace(snapshot=lambda pid: {"timing": {"words": []}}))
            with mock.patch("tools.studio_project.agent_authoring.capsule", return_value=capsule):
                retry = authoring_chain.LiveIO(service, "p", "làm đi\nSửa các lỗi sau:\n- X")  # the autopilot's retry wording
            self.assertEqual(retry.fingerprint(), first.fingerprint())
            self.assertEqual(retry.load()["scenes"]["s01"]["text"], "t")
            self.assertTrue(retry.discard())
            self.assertEqual(retry.load(), {})
            self.assertFalse(retry.discard())


class EpisodeCheckTests(unittest.TestCase):
    def test_a_proposal_error_naming_a_scene_and_validator_findings_come_back_tied_to_scenes(self):
        import tempfile
        from unittest import mock
        from tools.studio_project.models import StudioError
        with tempfile.TemporaryDirectory() as tmp:
            io = LiveIOTests().make(tmp)
            (io.workspace / ".authoring").mkdir()
            skeleton = json.dumps({"payload": {"intent": {"scenes": [], "assets": {}}}})
            with mock.patch("tools.studio_project.agent_parts.merge", return_value="{}"),                     mock.patch("tools.studio_project.agent_authoring.bind_proposal", return_value=("{}", [])),                     mock.patch("tools.studio_project.agent_authoring.proposal", side_effect=StudioError("VISUAL_GRAMMAR", "s02 mechanic cannot bind", "visual")):
                issues = io.check_episode(skeleton, {"s01": "{}"}, ["s01", "s02"])
            self.assertEqual([(i["code"], i["scene_id"]) for i in issues], [("PROPOSAL_INVALID", "s02")])  # the scene the validator names is the one sent back
            ok = {"scenes": [], "assets": {}}
            found = [{"name": "story-visual-presence", "issues": [{"code": "STORY_VISUAL_COVERAGE", "scene_id": "s02"}, {"code": "NARRATIVE_BRIEF_REQUIRED", "scene_id": "s02"}]}]
            with mock.patch("tools.studio_project.agent_parts.merge", return_value="{}"),                     mock.patch("tools.studio_project.agent_authoring.bind_proposal", return_value=("{}", [])),                     mock.patch("tools.studio_project.agent_authoring.proposal", return_value=ok),                     mock.patch("tools.studio_project.pipeline.validators.node_runner", return_value=found):
                issues = io.check_episode(skeleton, {"s01": "{}"}, ["s01", "s02"])
            self.assertEqual([(i["code"], i["scene_id"]) for i in issues], [("STORY_VISUAL_COVERAGE", "s02")])  # briefs the proposal completes are not held against it


class MotifRepeatTests(unittest.TestCase):
    def part(self, *motifs):
        return json.dumps({"payload": {"scene": {}, "assets": {f"k{i}": {"category": "studio_graphic", "creative_origin": {"template": m}} for i, m in enumerate(motifs)}}})

    def test_the_motifs_of_a_stored_part_are_read_from_its_assets(self):
        self.assertEqual(authoring_chain.graphic_motifs_of(self.part("tally", "tally")), ["tally"])
        self.assertEqual(authoring_chain.graphic_motifs_of("not json"), [])

    def test_the_second_scene_with_the_same_motif_is_sent_back(self):
        import tempfile
        from unittest import mock
        with tempfile.TemporaryDirectory() as tmp:
            io = LiveIOTests().make(tmp)
            (io.workspace / ".authoring").mkdir()
            with mock.patch("tools.studio_project.agent_parts.merge", return_value="{}"), \
                    mock.patch("tools.studio_project.agent_authoring.bind_proposal", return_value=("{}", [])), \
                    mock.patch("tools.studio_project.agent_authoring.proposal", return_value=None):
                issues = io.check_episode("{}", {"s01": self.part("route"), "s02": self.part("route"), "s03": self.part("stamp")}, ["s01", "s02", "s03"])
        self.assertEqual([(i["code"], i["scene_id"]) for i in issues], [("GRAPHIC_MOTIF_REPEATED", "s02")])


class CheckFilterTests(unittest.TestCase):
    def test_findings_the_episode_proposal_completes_are_not_held_against_a_single_scene(self):
        import tempfile
        from unittest import mock
        found = [{"name": "story-visual-presence", "issues": [
            {"code": "NARRATIVE_BRIEF_REQUIRED", "scene_id": "s02"}, {"code": "STORY_VISUAL_COVERAGE_MISSING", "scene_id": "s02"},
            {"code": "VISUAL_DEPTH_UNDERDEVELOPED", "scene_id": "s02"}, {"code": "PASSIVE_STORYTELLING", "scene_id": "s09"}]}]
        with tempfile.TemporaryDirectory() as tmp:
            io = LiveIOTests().make(tmp)
            (io.workspace / ".authoring").mkdir()
            text = json.dumps({"payload": {"scene": {"id": "s02"}, "assets": {}}})
            skeleton = json.dumps({"payload": {"intent": {"scenes": [], "assets": {}}}})
            with mock.patch("tools.studio_project.pipeline.validators.node_runner", return_value=found):
                issues = io.check_scene(skeleton, "s02", text)
        self.assertEqual([i["code"] for i in issues], ["VISUAL_DEPTH_UNDERDEVELOPED"])


if __name__ == "__main__":
    unittest.main()


class ProductionBriefTests(unittest.TestCase):
    def make_io(self):
        from tools.studio_project.authoring_chain import LiveIO
        io = LiveIO.__new__(LiveIO)
        io.capsule = {"scene_ranges": [{"id": "s01", "text": "x"}, {"id": "s02", "text": "y"}], "catalog": {"frames": [{"id": "f"}], "mechanics": [{"id": "m"}], "props": [{"id": "phone"}]}}
        io.workspace = __import__("pathlib").Path(__import__("tempfile").mkdtemp())
        return io

    def test_the_brief_reaches_the_stage_and_a_dropped_picture_is_sent_back(self):
        from tools.studio_project import authoring_menus
        io = self.make_io()
        io.use_brief({"story_read": "r", "tone": "t", "rhythm": "z", "characters": [],
                      "scenes": [{"scene_id": "s02", "beat": "b", "picture": {"motif": "versus", "fact": "hai phía", "why": "w"}},
                                 {"scene_id": "s01", "beat": "b", "picture": {"motif": "none", "fact": "", "why": "carried"}}]})
        self.assertEqual(io.planned("s02")["picture"]["motif"], "versus")
        self.assertEqual(io.planned("s02")["story_read"], "r")
        self.assertIsNone(io.planned("s09"))
        data = authoring_menus.stage_data({"frames": [], "mechanics": [], "cast": {}, "props": [], "dressing": [], "accent_parts": {}, "anchors": []},
                                          "s02", "y", "g", planned=io.planned("s02"))
        self.assertEqual(data["production_brief_for_this_scene"]["picture"]["fact"], "hai phía")

    def test_the_brief_has_one_entry_per_scene_and_a_reading_receipt(self):
        from tools.studio_project import authoring_menus
        schema = authoring_menus.brief_schema(["s01", "s02"])
        self.assertEqual((schema["properties"]["scenes"]["minItems"], schema["properties"]["scenes"]["maxItems"]), (2, 2))
        self.assertIn("rules_applied", schema["required"])

    def test_the_dossier_carries_every_document_whole(self):
        io = self.make_io()
        (io.workspace / ".authoring").mkdir()
        (io.workspace / ".authoring/phase3-writer-brief.json").write_text('{"premise": "p"}', "utf8")
        io.capsule.update(narrative_plan={"beats": [1]}, episode_scope={"sign": "libra"}, duration_seconds=82)
        dossier = io._dossier()
        self.assertEqual(dossier["writer_brief"], {"premise": "p"})
        self.assertEqual(dossier["narrative_plan"], {"beats": [1]})
        self.assertTrue(dossier["vocabulary"]["props"])  # the library the stage menus offer, not the compact catalog
        self.assertEqual(len(dossier["narration_by_scene"]), 2)

    def test_a_brief_of_only_none_is_put_back_to_the_agent_once(self):
        io = self.make_io()
        calls = []
        none = {"scenes": [{"scene_id": s, "picture": {"motif": "none"}} for s in ("s01", "s02")]}
        some = {"scenes": [{"scene_id": "s01", "picture": {"motif": "tally"}}, {"scene_id": "s02", "picture": {"motif": "none"}}]}
        answers = [none, some]
        io.choose = lambda kind, schema, data: (calls.append(data), answers.pop(0))[1]
        io._dossier = lambda: {}
        io.scene_ids = lambda: ["s01", "s02"]
        brief = io.read_brief()
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1]["previous_findings"][0]["code"], "BRIEF_PICTURES_MISSING")
        self.assertEqual(brief, some)
