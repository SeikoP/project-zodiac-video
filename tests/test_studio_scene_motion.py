import unittest

from tools.studio_project import scene_motion


def character(ident, x, states):
    return {"id": ident, "kind": "character", "states": {s: {"visible": True, "transform": {"x": x, "y": 560, "width": 420, "height": 840}} for s in states}}


def scene():
    return {"entities": [character("a", 20, ["neutral", "commit"]), character("b", 640, ["judge", "exposed"]),
                         {"id": "graphic_s1", "kind": "object", "states": {"hidden": {"visible": False}, "step1": {"visible": True}}}],
            "events": [{"id": "e1", "target": "a", "state_before": "neutral", "state_after": "commit", "trigger": {"type": "voice_anchor", "text": "x"}, "motion": {"preset": "state_swap", "duration_frames": 12}},
                       {"id": "e2", "target": "graphic_s1", "state_before": "hidden", "state_after": "step1", "trigger": {"type": "voice_anchor", "text": "g"}, "motion": {"preset": "state_swap", "duration_frames": 12}}]}


ANCHORS = [{"text": f"w{i}", "t": i * 0.5} for i in range(20)]


class SceneMotionTests(unittest.TestCase):
    def test_pose_change_gets_a_reaction_after_it_lands_and_a_camera_push(self):
        s = scene()
        scene_motion.animate(s, ANCHORS, {"e1": 1.0, "e2": 2.0}, 24, 9.0)
        reaction = next(e for e in s["events"] if e["id"] == "m1")
        self.assertEqual((reaction["target"], reaction["motion"]["preset"], reaction["state_before"]), ("a", "lean", "commit"))
        self.assertEqual(s["events"].index(reaction), 1)
        self.assertGreater(next(a["t"] for a in ANCHORS if a["text"] == reaction["trigger"]["text"]), 1.5)
        self.assertEqual(len(s["camera"]), 1)

    def test_no_motion_in_the_last_second_and_none_without_a_gap(self):
        s = scene()
        scene_motion.animate(s, ANCHORS, {"e1": 1.0, "e2": 2.0}, 24, 1.4)
        self.assertFalse([e for e in s["events"] if e["id"].startswith("m")])

    def test_existing_camera_is_kept(self):
        s = scene(); s["camera"] = [{"id": "x"}]
        scene_motion.animate(s, ANCHORS, {"e1": 1.0, "e2": 2.0}, 24, 9.0)
        self.assertEqual(s["camera"], [{"id": "x"}])


if __name__ == "__main__":
    unittest.main()
