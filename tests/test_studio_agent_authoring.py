"""Initial authoring is a proposal; only validated confirmed commands write source."""
import copy
import json
import unittest
from unittest.mock import patch

from tests import test_studio_p34_visual as fixtures
from tools.studio_project.models import StudioError


class AgentAuthoringTests(unittest.TestCase):
    def setUp(self):
        fixtures.VisualWorkspaceTests.setUp(self)
        self.manager = self.service.agent
        raw_voice = patch.object(self.service.voice, "_read", side_effect=lambda _: copy.deepcopy(self.voice))
        raw_voice.start(); self.addCleanup(raw_voice.stop)

    def start(self):
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            return self.manager.start_authoring(self.project, "Diễn rõ hành động và phản ứng.")

    def completed(self):
        task = self.start()
        self.manager._update(task["task_id"], status="COMPLETED", suggestion=json.dumps({"kind": "source.replace", "payload": {"intent": self.intent}}, ensure_ascii=False))
        return task

    def test_initial_proposal_confirm_apply_reopen_and_idempotency(self):
        task = self.completed()
        self.assertEqual(task["kind"], "episode.propose")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])
        for confirm in (False, None):
            with self.assertRaises(StudioError):
                self.manager.apply_suggestion(task["task_id"], confirm=confirm, base_revision=0, command_id="author")
        state = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="author")
        self.assertEqual(state["intent"], self.intent)
        repeated = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="author")
        self.assertEqual(repeated["revision"], state["revision"])
        self.assertEqual(self.manager.task(task["task_id"])["applied_command_id"], "author")
        self.assertNotEqual(self.service.project(self.project)["status"]["visual"], "APPROVED")

    def test_missing_required_story_visual_names_the_reference_to_repair(self):
        from tools.studio_project.agent_authoring import proposal
        plan = {"story_visual_decision": {"mode": "required"}, "story_visuals": [{"id": "SV01"}]}
        (self.handle.workspace / '.authoring/narrative-plan.json').write_text(json.dumps(plan), encoding='utf-8')
        with patch.object(self.service, 'project', return_value={'status': {'content': 'APPROVED'}}):
            with self.assertRaises(StudioError) as caught:
                proposal(json.dumps({'kind': 'source.replace', 'payload': {'intent': self.intent}}),
                         self.service, self.project)
        self.assertEqual(caught.exception.code, 'AGENT_PROPOSAL_INVALID')
        self.assertIn('SV01', str(caught.exception))
        self.assertIn('phase1_visual_id', str(caught.exception))
        self.assertFalse((self.handle.workspace / '.authoring/visual-intent.json').exists())

    def test_retry_context_reuses_only_a_candidate_with_matching_source_voice_and_catalog(self):
        old = self.start()
        self.manager._update(old["task_id"], status="FAILED", preview=json.dumps({"kind": "source.replace", "payload": {"intent": self.intent}}))
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run") as run:
            task = self.manager.start_authoring(self.project, "Sửa lỗi kiểm tra, giữ cảnh hợp lệ.")
            self.manager._threads[task["task_id"]].join(timeout=2)
            context = run.call_args.args[1]["author_task"]
        self.assertEqual(context["previous_candidate"]["task_id"], old["task_id"])
        self.manager._update(task["task_id"], status="FAILED", preview="")
        self.manager._update(old["task_id"], dependencies="changed")
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run") as run:
            fresh = self.manager.start_authoring(self.project, "Soạn lại.")
            self.manager._threads[fresh["task_id"]].join(timeout=2)
            self.assertNotIn("previous_candidate", run.call_args.args[1]["author_task"])

    def test_existing_intent_and_missing_timing_are_rejected(self):
        self.voice["timing"] = None
        with self.assertRaises(StudioError): self.start()
        self.voice["timing"] = {"wav_sha256": "f" * 64}
        self.visual.command(self.project, "existing", 0, "source.replace", {"intent": self.intent})
        with self.assertRaises(StudioError): self.start()

    def test_voice_and_timing_drift_reject_before_write(self):
        for field in ("assembly", "timing"):
            with self.subTest(field=field):
                original = copy.deepcopy(self.voice)
                task = self.completed()
                self.voice[field]["wav_sha256"] = "e" * 64
                with self.assertRaises(StudioError) as caught:
                    self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="stale-" + field)
                self.assertEqual(caught.exception.code, "AGENT_DEPENDENCIES_CHANGED")
                self.assertIsNone(self.visual.snapshot(self.project)["intent"])
                self.voice = original

    def test_unknown_asset_paths_and_malformed_output_cannot_write(self):
        task = self.completed()
        for path in ("../../outside.svg", "https://example.com/a.svg", "library:props/missing.svg"):
            intent = copy.deepcopy(self.intent)
            intent["assets"]["phone"]["path"] = path
            self.manager._update(task["task_id"], suggestion=json.dumps({"kind": "source.replace", "payload": {"intent": intent}}))
            with self.assertRaises(StudioError):
                self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="bad")
        self.manager._update(task["task_id"], suggestion='{"kind":')
        with self.assertRaises(StudioError):
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="bad")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])

    def test_initial_cannot_replace_intent_added_while_agent_runs(self):
        task = self.completed()
        self.visual.command(self.project, "manual", 0, "source.replace", {"intent": self.intent})
        with self.assertRaises(StudioError):
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=1, command_id="late")

    def test_voice_change_during_proposal_validation_cannot_commit(self):
        task = self.completed()
        original = self.visual._node
        def changed(*args, **kwargs):
            result = original(*args, **kwargs)
            self.voice["timing"]["duration_seconds"] += 1
            return result
        with patch.object(self.visual, "_node", side_effect=changed), self.assertRaises(StudioError) as caught:
            self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="racing")
        self.assertEqual(caught.exception.code, "AGENT_DEPENDENCIES_CHANGED")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])

    def test_rpc_authoring_contract(self):
        from tools.studio_project.rpc_stdio import dispatch
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            task = dispatch(self.service, "agent.author.start", {"project_id": self.project, "instruction": "Soạn hình ảnh."})
        self.assertEqual(task["kind"], "episode.propose")

    def test_authoring_uses_the_same_visual_contract_as_the_renderer(self):
        from tools.studio_project.agent_authoring import capsule
        from tools.studio_project.service import ROOT
        data = capsule(self.service, self.project, "Giữ thiết kế gốc.")
        contract = json.loads((ROOT / "tools/studio_project/visual_contract.json").read_text("utf8"))
        self.assertEqual(data["visual_contract"], contract)
        self.assertEqual(contract["caption"]["font_size_px"], 84)
        self.assertNotIn("y:740", data["schema"]["scenes"])

    def test_agent_is_told_to_author_experience_profile_on_every_scene(self):
        from tools.studio_project.agent_authoring import capsule
        data = capsule(self.service, self.project, "Soạn hình ảnh.")
        self.assertIn("story_mode", data["schema"]["experience_profile"])
        self.assertIn("story_focus", data["schema"]["experience_profile"])
        self.assertIn("experience_profile", data["schema"]["scenes"])

    def test_authored_experience_profile_survives_confirmed_apply(self):
        for scene in self.intent["scenes"]:
            scene["experience_profile"] = {"story_mode": "exposition"}
        task = self.completed()
        state = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=0, command_id="author")
        self.assertEqual([s["experience_profile"] for s in state["intent"]["scenes"]],
                         [{"story_mode": "exposition"}] * len(self.intent["scenes"]))

    def test_core_binds_phase1_story_visual_decision_and_taxonomy(self):
        from tools.studio_project.agent_authoring import bind_proposal
        decision = {"mode": "required", "reason": "Đối chiếu hai lời rủ."}
        context = {"narration_sha256": "h", "schema": {"video": {}}, "scene_ranges": [], "narrative_plan": {"story_visual_decision": decision}}
        text, changed = bind_proposal(json.dumps({"kind": "source.replace", "payload": {"intent": {"narration_sha256": "h", "scenes": []}}}), context)
        intent = json.loads(text)["payload"]["intent"]
        self.assertEqual(intent["story_visual_decision"], decision)
        self.assertEqual(intent["taxonomy_version"], "story_visual@1")
        self.assertIn("story_visual_decision", changed)

    def test_unknown_expression_names_the_valid_choices(self):
        from tools.studio_project.agent_authoring import catalog
        bad = copy.deepcopy(self.intent)
        bad["cast"][0]["states"]["neutral"]["expression_id"] = "focused"
        self.manager._update(self.completed()["task_id"], status="COMPLETED")
        with self.assertRaises(StudioError) as caught:
            from tools.studio_project import agent_authoring
            agent_authoring.proposal(json.dumps({"kind": "source.replace", "payload": {"intent": bad}}), self.service, self.project)
        self.assertIn("expression_id 'focused'", str(caught.exception))
        self.assertIn(catalog()["components"]["expressions"][0], str(caught.exception))

    def test_repair_capsule_carries_the_current_intent_and_dressing_rule(self):
        from tools.studio_project.agent_authoring import capsule
        self.manager.apply_suggestion(self.completed()["task_id"], confirm=True, base_revision=0, command_id="author")
        with self.assertRaises(StudioError):  # a plain authoring request still refuses to replace existing visuals
            capsule(self.service, self.project, "x")
        data = capsule(self.service, self.project, "ENVIRONMENT_VISUAL_UNDERDEVELOPED s01", repair=True)
        self.assertEqual(json.loads(data["previous_candidate"]["json"])["payload"]["intent"]["scenes"], self.intent["scenes"])
        self.assertIn("ENVIRONMENT_VISUAL_UNDERDEVELOPED", data["previous_candidate"]["validator_error"])
        self.assertIn("depth__", data["schema"]["scenes"])
        self.assertIn("scene_set_id is retired", data["schema"]["scenes"])

    def applied_intent(self):
        self.manager.apply_suggestion(self.completed()["task_id"], confirm=True, base_revision=0, command_id="author")
        return self.visual.snapshot(self.project)

    def test_scene_revision_is_a_visible_task_with_voice_dependencies(self):
        state = self.applied_intent()
        scene_id = state["intent"]["scenes"][0]["id"]
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            task = self.manager.start_scene_revision(self.project, scene_id, "cho nhân vật lớn hơn")
        self.assertEqual((task["kind"], task["scene_id"]), ("scene.revise", scene_id))
        self.assertTrue(task["dependencies"])
        self.assertIn(task["task_id"], [t["task_id"] for t in self.manager.tasks(self.project)])  # shown, unlike group parts
        with self.assertRaises(StudioError):
            self.manager.start_scene_revision(self.project, "nope", "x")

    def test_two_scene_revisions_may_run_together_but_not_three_or_beside_authoring(self):
        state = self.applied_intent()
        ids = [s["id"] for s in state["intent"]["scenes"]]
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            self.manager.start_scene_revision(self.project, ids[0], "a")
            self.manager.start_scene_revision(self.project, ids[0], "b")
            with self.assertRaises(StudioError) as caught:
                self.manager.start_scene_revision(self.project, ids[0], "c")
            self.assertEqual(caught.exception.code, "AGENT_BUSY")
            with self.assertRaises(StudioError):
                self.manager.start_visual(self.project, ids[0], "other kind of task while revisions run")

    def test_applying_a_revision_changes_only_that_scene(self):
        state = self.applied_intent()
        first = state["intent"]["scenes"][0]["id"]
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            task = self.manager.start_scene_revision(self.project, first, "đổi mục tiêu")
        revised = copy.deepcopy(state["intent"])
        revised["scenes"][0]["semantic_goal"] = "Mục tiêu đã sửa"
        self.manager._update(task["task_id"], status="COMPLETED", changes=["Mục tiêu cảnh đã đổi"],
                             suggestion=json.dumps({"kind": "source.replace", "payload": {"intent": revised}}, ensure_ascii=False))
        applied = self.manager.apply_suggestion(task["task_id"], confirm=True, base_revision=state["revision"], command_id="revise-1")
        after = applied["intent"]["scenes"]
        self.assertEqual(after[0]["semantic_goal"], "Mục tiêu đã sửa")
        self.assertEqual(after[1:], state["intent"]["scenes"][1:])

    def test_rpc_routes_author_start_with_a_scene_to_a_revision(self):
        from tools.studio_project.rpc_stdio import dispatch
        state = self.applied_intent()
        with patch.object(self.manager, "_bin", return_value="unused"), patch.object(self.manager, "_run"):
            task = dispatch(self.service, "agent.author.start", {"project_id": self.project, "scene_id": state["intent"]["scenes"][0]["id"], "instruction": "x"})
        self.assertEqual(task["kind"], "scene.revise")

    def test_story_text_and_split_chat_are_native_story_visual_templates(self):
        from tools.studio_project.agent_authoring import capsule, proposal
        from tools.studio_project.story_visual_art import visual_svg
        from tools.studio_project.service import ROOT
        import hashlib

        plan_path = self.handle.workspace / ".authoring/narrative-plan.json"
        plan_path.write_text(json.dumps({"story_visual_decision": {"mode": "required", "reason": "Two senders and opposite replies"},
                                          "story_visuals": [{"id": "SV01"}]}), encoding="utf8")
        # The synthetic test modifies a sealed Phase 1 fixture in-place; bypass only
        # its unrelated content signature guard, never the Story Visual validator.
        approved = patch.object(self.service, 'project', return_value={'status': {'content': 'APPROVED'}})
        approved.start(); self.addCleanup(approved.stop)
        intent = copy.deepcopy(self.intent)
        intent["taxonomy_version"] = "story_visual@1"
        intent["story_visual_decision"] = {"mode": "required", "reason": "Two senders and opposite replies"}
        spec = {"type": "chat_compare",
                "left": {"sender": "Hội bạn", "question": "Thứ Bảy đi chơi không?", "reply": "Để xem"},
                "right": {"sender": "Người ấy", "question": "Thứ Bảy đi chơi không?", "reply": "Bảy giờ, tớ qua đón"}}
        intent["assets"]["contrast"] = {"category": "story_visual", "phase1_visual_id": "SV01", "visual": spec}
        intent["scenes"][0]["entities"].append({
            "id": "compare", "kind": "story_visual", "visual_role": "story_visual",
            "initial_state": "hidden", "states": {
                "hidden": {"asset": "contrast", "visible": False, "layer": 25,
                           "transform": {"x": 60, "y": 100, "width": 950, "height": 550}},
                "shown": {"asset": "contrast", "visible": True, "layer": 25,
                          "transform": {"x": 60, "y": 100, "width": 950, "height": 550}}},
            "lettering": {"purpose": "contrast", "reason": "Compare named senders; no generic chat board",
                          "states": {"shown": "ĐỂ XEM / CHỐT LUÔN"}},
        })
        intent["scenes"][0]["events"].append({
            "id": "compare-reveal", "target": "compare", "state_before": "hidden", "state_after": "shown",
            "trigger": {"type": "voice_anchor", "text": "Song Tử"},
            "motion": {"preset": "state_swap", "duration_frames": 12}})
        data = capsule(self.service, self.project, "Keep Story Text within Story Visual.")
        self.assertIn("chat_compare", data["schema"]["assets"])
        self.assertIn("Story Text", data["schema"]["scenes"])
        text = json.dumps({"kind": "source.replace", "payload": {"intent": intent}}, ensure_ascii=False)
        dry = proposal(text, self.service, self.project)
        asset = dry["assets"]["contrast"]
        path = self.handle.workspace / asset["path"]
        self.assertFalse(path.exists(), "review should not write generated images before confirmation")
        committed = proposal(text, self.service, self.project, write_visuals=True)
        self.assertEqual(committed, dry)
        self.assertTrue(path.exists())
        raw = path.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), asset["source_sha256"])
        self.assertNotIn(b"<text", raw, "Vietnamese glyphs are outlines; no browser fallback")
        self.assertIn(b"<path", raw)
        self.assertEqual(raw, visual_svg(spec))

        story = visual_svg({"type": "story_text", "text": "ĐỂ XEM / CHỐT LUÔN", "purpose": "contrast"})
        self.assertIn(b"<svg", story)
        with self.assertRaises(ValueError):
            visual_svg({"type": "chat_compare", "left": {"sender": "<script>", "question": "x", "reply": "y"},
                        "right": spec["right"]})

    def test_text_board_proposals_are_rejected_without_creating_art(self):
        from tools.studio_project.agent_authoring import capsule, proposal
        data = capsule(self.service, self.project, "Diễn bằng cử chỉ và điện thoại.")
        self.assertNotIn("board_characters", data)
        self.assertNotIn("board:{", data["schema"]["assets"])
        intent = copy.deepcopy(self.intent)
        intent["assets"]["board"] = {"board": {"title": "Chat", "lines": ["Tin nhắn"]}, "category": "story_visual"}
        with self.assertRaises(StudioError) as caught:
            proposal(json.dumps({"kind": "source.replace", "payload": {"intent": intent}}), self.service, self.project)
        self.assertEqual(caught.exception.code, "AGENT_PROPOSAL_INVALID")
        self.assertIsNone(self.visual.snapshot(self.project)["intent"])


if __name__ == "__main__": unittest.main()
