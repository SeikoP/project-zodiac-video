import unittest
from dataclasses import replace

from tools.studio_project.pipeline.derive import NodeStatus, PipelineEvidence, derive
from tools.studio_project.pipeline.registry import load_registry

SCENES = ("s01", "s02")


def done_evidence(**changes) -> PipelineEvidence:
    base = PipelineEvidence(
        content_approved=True, voice_units_total=2, voice_units_selected=2, voice_assembled=True,
        voice_listened=True, timing_ready=True, has_intent=True, visual_revision=5, visual_source_hash="h1",
        scene_ids=SCENES, built_scene_ids=frozenset(SCENES), build_revision=5,
        build_voice_fingerprint="v1", current_voice_fingerprint="v1",
        checks_state="OK", assets_state="OK", cover_state="OK", publish_state="OK", inspect_state="OK",
        review_state="OK", export_state="EXPORTED")
    return replace(base, **changes)


def statuses(evidence: PipelineEvidence) -> dict[str, NodeStatus]:
    graph = derive(load_registry(), evidence, project_id="p", revision=7)
    return {n.node_id: n.status for n in graph.nodes}


class DeriveTests(unittest.TestCase):
    def test_everything_done(self):
        result = statuses(done_evidence())
        self.assertTrue(all(v == "DONE" for v in result.values()), result)
        self.assertIn("scene:s02", result)

    def test_fresh_project_only_voice_ready(self):
        result = statuses(PipelineEvidence(content_approved=True))
        self.assertEqual(result["content"], "DONE")
        self.assertEqual(result["voice"], "READY")
        self.assertEqual(result["voice_review"], "PENDING")
        self.assertTrue(all(v == "PENDING" for k, v in result.items() if k not in ("content", "voice")), result)

    def test_unapproved_content_blocks_everything(self):
        result = statuses(PipelineEvidence())
        self.assertEqual(result["content"], "BLOCKED")
        self.assertTrue(all(v == "PENDING" for k, v in result.items() if k != "content"), result)

    def test_gate_awaiting_user_not_ready(self):
        result = statuses(done_evidence(voice_listened=False, timing_ready=False, has_intent=False,
                                        checks_state="NONE", assets_state="NONE", cover_state="NONE",
                                        publish_state="NONE", inspect_state="NONE", review_state="NONE",
                                        export_state="NONE", build_revision=None, built_scene_ids=frozenset()))
        self.assertEqual(result["voice_review"], "AWAITING_USER")
        self.assertEqual(result["timing"], "STALE" if False else "PENDING")

    def test_voice_listened_makes_review_done_and_timing_ready(self):
        result = statuses(PipelineEvidence(content_approved=True, voice_units_total=1, voice_units_selected=1,
                                           voice_assembled=True, voice_listened=True))
        self.assertEqual(result["voice_review"], "DONE")
        self.assertEqual(result["timing"], "READY")

    def test_voice_reselect_stales_downstream_only(self):
        result = statuses(done_evidence(current_voice_fingerprint="v2"))
        for node in ("scene:s01", "scene:s02", "build", "inspect", "visual_review", "export"):
            self.assertEqual(result[node], "STALE", node)
        for node in ("content", "voice", "voice_review", "timing", "visual", "checks", "assets", "cover", "publish"):
            self.assertEqual(result[node], "DONE", node)

    def test_checks_stale_when_source_hash_changes(self):
        result = statuses(done_evidence(checks_state="STALE", assets_state="STALE", cover_state="STALE",
                                        publish_state="STALE", inspect_state="STALE"))
        for node in ("checks", "assets", "cover", "publish", "inspect"):
            self.assertEqual(result[node], "STALE", node)
        self.assertEqual(result["visual"], "DONE")
        self.assertEqual(result["export"], "STALE")

    def test_visual_review_not_ready_until_inspect_cover_publish_done(self):
        result = statuses(done_evidence(review_state="NONE", export_state="NONE", cover_state="NONE"))
        self.assertEqual(result["cover"], "READY")
        self.assertEqual(result["visual_review"], "PENDING")
        result = statuses(done_evidence(review_state="NONE", export_state="NONE"))
        self.assertEqual(result["visual_review"], "AWAITING_USER")
        self.assertEqual(result["export"], "PENDING")

    def test_unconfirmed_gate_does_not_invalidate_existing_technical_output(self):
        result = statuses(done_evidence(voice_listened=False, review_state="NONE"))
        self.assertEqual(result["voice_review"], "AWAITING_USER")
        self.assertEqual(result["timing"], "DONE")
        self.assertEqual(result["export"], "DONE")
        self.assertEqual(result["visual_review"], "AWAITING_USER")

    def test_review_receipt_stale_after_edit(self):
        self.assertEqual(statuses(done_evidence(review_state="STALE"))["visual_review"], "STALE")

    def test_running_and_failed_overlay(self):
        result = statuses(done_evidence(build_revision=None, built_scene_ids=frozenset({"s01"}),
                                        inspect_state="NONE", review_state="NONE", export_state="NONE",
                                        running_node="scene:s02", failed={"build": "Lỗi dựng"}))
        self.assertEqual(result["scene:s02"], "RUNNING")
        self.assertEqual(result["scene:s01"], "DONE")
        self.assertEqual(result["build"], "PENDING")
        result = statuses(done_evidence(build_revision=None, built_scene_ids=frozenset(SCENES),
                                        inspect_state="NONE", review_state="NONE", export_state="NONE",
                                        failed={"build": "Lỗi dựng"}))
        self.assertEqual(result["build"], "FAILED")

    def graph(self, evidence):
        return {n.node_id: n for n in derive(load_registry(), evidence, project_id="p", revision=7).nodes}

    def test_built_output_with_failed_checks_blames_checks_not_voice(self):
        nodes = self.graph(done_evidence(checks_state="NONE", failed={"checks": "10 vấn đề"}))
        self.assertEqual(nodes["checks"].status, "FAILED")
        self.assertEqual(nodes["build"].status, "STALE")
        self.assertIn("Kiểm tra bản soạn", nodes["build"].detail)
        self.assertNotIn("giọng", nodes["build"].detail)

    def test_checks_done_with_notes_stays_done_and_says_how_many(self):
        nodes = self.graph(done_evidence(check_notes=3))
        self.assertEqual(nodes["checks"].status, "DONE")
        self.assertIn("3", nodes["checks"].detail)
        self.assertEqual(self.graph(done_evidence())["checks"].detail, "")

    def test_real_voice_change_still_says_source_or_voice_changed(self):
        self.assertIn("giọng", self.graph(done_evidence(current_voice_fingerprint="v2"))["build"].detail)

    def test_scene_instances_are_named_by_scene(self):
        nodes = self.graph(done_evidence())
        self.assertEqual([nodes[f"scene:{s}"].title for s in SCENES], ["Cảnh s01", "Cảnh s02"])

    def test_voice_with_all_takes_but_no_assembly_tells_the_second_click(self):
        node = self.graph(PipelineEvidence(content_approved=True, voice_units_total=3, voice_units_selected=3))["voice"]
        self.assertEqual(node.status, "READY")
        self.assertIn("ghép audio", node.detail)
        partial = self.graph(PipelineEvidence(content_approved=True, voice_units_total=3, voice_units_selected=1))["voice"]
        self.assertNotIn("ghép", partial.detail)

    def test_running_voice_job_reports_progress_in_the_step_detail(self):
        node = self.graph(PipelineEvidence(content_approved=True, voice_units_total=32, running_node="voice",
                                           voice_job_done=9, voice_job_total=32))["voice"]
        self.assertEqual((node.status, node.detail), ("RUNNING", "Xong 9/32"))

    def test_no_voice_no_visual_does_not_raise(self):
        result = statuses(PipelineEvidence(content_approved=True, scene_ids=()))
        self.assertNotIn("scene:s01", result)
        self.assertEqual(result["build"], "PENDING")

    def test_scene_fan_status_per_scene(self):
        result = statuses(done_evidence(built_scene_ids=frozenset({"s01"}), build_revision=None,
                                        inspect_state="NONE", review_state="NONE", export_state="NONE"))
        self.assertEqual(result["scene:s01"], "DONE")
        self.assertEqual(result["scene:s02"], "READY")
        self.assertEqual(result["build"], "PENDING")

    def test_graph_dict_shape(self):
        graph = derive(load_registry(), done_evidence(), project_id="p", revision=7).to_dict()
        self.assertEqual(graph["format"], "zodiac-pipeline@1")
        self.assertEqual((graph["project_id"], graph["revision"]), ("p", 7))
        node = next(n for n in graph["nodes"] if n["id"] == "scene:s01")
        self.assertEqual(set(node), {"id", "title", "kind", "status", "inputs", "detail", "scene_id"})
        self.assertEqual(node["scene_id"], "s01")


if __name__ == "__main__":
    unittest.main()
