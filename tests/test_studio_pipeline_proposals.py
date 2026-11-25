import json
import tempfile
import unittest
from pathlib import Path

from tests.pipeline_fakes import FakeService, visual_state, voice_state
from tools.studio_project.models import StudioError
from tools.studio_project.pipeline import context, proposals
from tools.studio_project.pipeline.derive import PipelineEvidence
from tools.studio_project.pipeline.proposals import apply_proposal, submit_proposal, validate_proposal
from tools.studio_project.pipeline.receipts import read_receipt
from tools.studio_project.pipeline.registry import load_registry
from tools.studio_project.pipeline.validators import Issue

INTENT = {"format": "zodiac-visual-intent@1", "assets": {"a1": {"path": "library:props/x.svg", "category": "prop"}},
          "scenes": [{"id": "s01", "entities": [{"id": "e1", "kind": "object", "states": {"n": {"asset": "a1"}}}]}]}
REPLACE = {"command": "source.replace", "payload": {"intent": INTENT}}


def evidence(**over):
    base = dict(visual_revision=3, scene_ids=("s01", "s02"), has_intent=True, visual_source_hash="h1")
    base.update(over)
    return PipelineEvidence(**base)


class FakeVisual:
    """Mimics VisualWorkspace.command semantics: revision bump, idempotent command ids, undo history."""

    def __init__(self, base):
        self.base = base
        self.revision, self.source, self.history, self.commands, self.calls = base["revision"], {"v": 0}, [], {}, []

    def snapshot(self, project_id):
        return {**self.base, "revision": self.revision}

    def command(self, project_id, command_id, base_revision, kind, payload, **kw):
        self.calls.append((command_id, base_revision, kind, payload))
        if command_id in self.commands:
            return self.commands[command_id]
        if base_revision != self.revision:
            raise StudioError("REVISION_CONFLICT", "stale", "visual")
        self.history.append(dict(self.source))
        self.source = payload.get("intent", self.source)
        self.revision += 1
        self.commands[command_id] = {"revision": self.revision}
        return self.commands[command_id]


class ProposalTests(unittest.TestCase):
    def setUp(self):
        context_dir = tempfile.TemporaryDirectory(prefix="zodiac-proposals-")
        self.addCleanup(context_dir.cleanup)
        self.workspace = Path(context_dir.name)
        self.service = FakeService(self.workspace, visual=visual_state(), voice=voice_state())
        self.visual = FakeVisual(self.service.visual.snapshot("p"))
        self.service.visual = self.visual

    def test_invalid_proposal_never_applied(self):
        stale = validate_proposal("visual.intent", REPLACE, evidence(), base_revision=2)
        self.assertEqual([i.code for i in stale], ["PROPOSAL_REVISION_STALE"])
        dangling = json.loads(json.dumps(REPLACE))
        dangling["payload"]["intent"]["scenes"][0]["entities"][0]["states"]["n"]["asset"] = "missing"
        self.assertIn("PROPOSAL_ASSET_DANGLING", [i.code for i in validate_proposal("visual.intent", dangling, evidence())])

        story = json.loads(json.dumps(REPLACE))
        story["payload"]["intent"]["assets"]["sv"] = {"category": "story_visual", "visual": {}}
        story["payload"]["intent"]["scenes"][0]["entities"][0].update(kind="story_visual")
        story["payload"]["intent"]["scenes"][0]["entities"][0]["states"]["n"]["asset"] = "sv"
        self.assertIn("PROPOSAL_STORY_VISUAL_REFERENCE_MISSING",
                      [i.code for i in validate_proposal("visual.intent", story, evidence())])
        with self.assertRaises(StudioError) as ctx:
            apply_proposal(self.service, "p", "visual.intent", dangling, self.visual.revision, "cmd-1")
        self.assertEqual(ctx.exception.code, "PROPOSAL_INVALID")
        self.assertEqual(self.visual.calls, [])

    def test_character_state_names_are_cast_states_not_dangling_assets(self):
        intent = {"scenes": [{"id": "s01", "entities": [
            {"id": "hero", "kind": "character", "states": {"neutral": {"asset": "neutral"}, "gone": {"asset": "nowhere"}}}]}],
            "assets": {}, "cast": [{"entity_id": "hero", "states": {"neutral": {}}}]}
        codes = [(i.code, i.message) for i in validate_proposal("visual.intent", {"command": "source.replace", "payload": {"intent": intent}}, evidence())]
        self.assertEqual([c for c, _ in codes], ["PROPOSAL_ASSET_DANGLING"])
        self.assertIn("nowhere", codes[0][1])

    def test_authoring_voice_fingerprint_reaches_canonical_guard(self):
        from unittest.mock import patch
        proposals.set_mode(self.workspace, "autopilot")
        with patch.object(self.visual, "command", wraps=self.visual.command) as command:
            out = submit_proposal(self.service, "p", "visual.intent", REPLACE, self.visual.revision,
                                  "voice-bound", voice_dependencies="original-voice")
        self.assertTrue(out["applied"])
        self.assertEqual(command.call_args.kwargs["voice_dependencies"], "original-voice")

    def test_valid_visual_intent_applied_via_canonical_command(self):
        before = self.visual.revision
        apply_proposal(self.service, "p", "visual.intent", REPLACE, before, "cmd-1")
        self.assertEqual(self.visual.revision, before + 1)
        self.assertEqual(self.visual.calls, [("cmd-1", before, "source.replace", {"intent": INTENT})])
        self.assertEqual(self.visual.history, [{"v": 0}])  # prior source retained for undo

    def test_apply_is_idempotent_on_command_id(self):
        before = self.visual.revision
        first = apply_proposal(self.service, "p", "visual.intent", REPLACE, before, "cmd-1")
        second = apply_proposal(self.service, "p", "visual.intent", REPLACE, before, "cmd-1")
        self.assertEqual(first, second)
        self.assertEqual(self.visual.revision, before + 1)

    def test_assets_select_maps_to_asset_select_command(self):
        payload = {"scene_id": "s01", "candidate_id": "c1", "requirement": {}}
        apply_proposal(self.service, "p", "assets.select", payload, self.visual.revision, "cmd-2")
        self.assertEqual(self.visual.calls[0][2:], ("asset.select", payload))

    def test_inspect_report_changes_no_source(self):
        report = {"build_id": "b1", "method": "structural", "findings": [{"scene_id": "s01", "severity": "ok", "note": "caption lane clear"}]}
        before = self.visual.revision
        apply_proposal(self.service, "p", "inspect.report", report, before, "cmd-3")
        self.assertEqual(self.visual.calls, [])
        self.assertEqual(self.visual.revision, before)
        self.assertEqual(read_receipt(self.workspace, "inspect")["build_id"], "b1")

    def test_cover_and_publish_are_staged_as_source_bound_receipts(self):
        apply_proposal(self.service, "p", "cover.design", {"headline": "Cách Nhân Mã yêu", "scene_id": "s01"}, self.visual.revision, "c4")
        apply_proposal(self.service, "p", "publish.copy", {"title": "t", "description": "d", "hashtags": ["#cunghoangdao"]}, self.visual.revision, "c5")
        self.assertEqual(read_receipt(self.workspace, "cover")["source_hash"], "h1")
        self.assertEqual(read_receipt(self.workspace, "publish")["payload"]["title"], "t")
        self.assertEqual(self.visual.calls, [])

    def test_confirm_mode_waits_for_click(self):
        self.assertEqual(proposals.get_mode(self.workspace), "confirm")
        waiting = submit_proposal(self.service, "p", "visual.intent", REPLACE, self.visual.revision, "cmd-1")
        self.assertEqual((waiting["applied"], waiting["waiting"]), (False, True))
        self.assertEqual(self.visual.calls, [])
        clicked = submit_proposal(self.service, "p", "visual.intent", REPLACE, self.visual.revision, "cmd-1", confirmed=True)
        self.assertTrue(clicked["applied"])

    def test_autopilot_mode_applies_after_validation(self):
        proposals.set_mode(self.workspace, "autopilot")
        self.assertTrue(submit_proposal(self.service, "p", "visual.intent", REPLACE, self.visual.revision, "cmd-1")["applied"])
        bad = submit_proposal(self.service, "p", "assets.select", {"scene_id": "nope", "candidate_id": "c", "requirement": {}},
                              self.visual.revision, "cmd-9")
        self.assertFalse(bad["applied"])
        self.assertEqual(bad["issues"][0]["code"], "PROPOSAL_SCENE_UNKNOWN")

    def test_mode_rejects_unknown_value_and_persists(self):
        with self.assertRaises(StudioError):
            proposals.set_mode(self.workspace, "yolo")
        proposals.set_mode(self.workspace, "autopilot")
        self.assertEqual(proposals.get_mode(self.workspace), "autopilot")

    def test_proposal_cannot_set_any_approval_field(self):
        for key in ("receipt", "approved", "listened", "approval"):
            poisoned = {"title": "t", "description": "d", "hashtags": [], key: True}
            codes = [i.code for i in validate_proposal("publish.copy", poisoned, evidence())]
            self.assertIn("PROPOSAL_APPROVAL_FORBIDDEN", codes, key)
        nested = {"command": "scene.patch", "payload": {"scene_id": "s01", "entity_id": "e", "state_id": "n", "changes": {"x": 1}, "meta": {"approved": True}}}
        self.assertIn("PROPOSAL_APPROVAL_FORBIDDEN", [i.code for i in validate_proposal("visual.intent", nested, evidence())])

    def test_unknown_kind_and_non_object_payload(self):
        self.assertEqual(validate_proposal("export.now", {}, evidence())[0].code, "PROPOSAL_KIND_UNKNOWN")
        self.assertEqual(validate_proposal("publish.copy", [], evidence())[0].code, "PROPOSAL_PAYLOAD_INVALID")

    def test_issues_are_returned_as_validator_issue_objects(self):
        issue = validate_proposal("assets.select", {"scene_id": "zz", "candidate_id": "c", "requirement": {}}, evidence())[0]
        self.assertIsInstance(issue, Issue)


class StaleAndRpcTests(ProposalTests):
    def test_stale_command_returns_issue_not_exception_in_submit(self):
        proposals.set_mode(self.workspace, "autopilot")
        out = submit_proposal(self.service, "p", "visual.intent", REPLACE, self.visual.revision - 1, "cmd-s")
        self.assertFalse(out["applied"])
        self.assertEqual(out["issues"][0]["code"], "PROPOSAL_REVISION_STALE")

    def test_mode_rpc_and_pipeline_get_expose_mode(self):
        from tools.studio_project.pipeline.api import pipeline_get
        from tools.studio_project.rpc_stdio import dispatch
        self.assertEqual(dispatch(self.service, "pipeline.mode.set", {"project_id": "p", "mode": "autopilot"}), {"mode": "autopilot"})
        self.assertEqual(pipeline_get(self.service, "p")["mode"], "autopilot")
        with self.assertRaises(StudioError):
            dispatch(self.service, "pipeline.mode.set", {"project_id": "p", "mode": "yolo"})


class ContextTests(unittest.TestCase):
    def test_context_contains_phase02_loop_and_previous_issues_and_bounds_size(self):
        issues = [Issue("PASSIVE_STORYTELLING", "visual-intent", "s02", "scene is passive", "visual-intent:s02")]
        text = context.build_context("p", "checks", issues, budget=6000)
        self.assertIn("Phase", text)  # phase02 composition contract text
        self.assertIn("PASSIVE_STORYTELLING", text)
        self.assertIn("s02", text)
        self.assertLessEqual(len(text.encode("utf-8")), 6000)

    def test_every_context_ref_in_the_manifest_resolves_to_a_real_plugin_file(self):
        for spec in load_registry().nodes:
            if spec.agent:
                for ref in spec.agent.context_refs:
                    self.assertIn(ref, context.REFS, ref)
                    self.assertTrue((context.PLUGIN / context.REFS[ref]).is_file(), ref)

    def test_unknown_node_is_rejected(self):
        with self.assertRaises(StudioError):
            context.build_context("p", "content", [])


if __name__ == "__main__":
    unittest.main()
