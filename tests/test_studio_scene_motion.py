import unittest

from tools.studio_project import scene_motion


def character(ident):
    return {"id": ident, "kind": "character", "states": {}}


def event(ident, target, before, after, preset="state_swap", frames=12):
    return {"id": ident, "target": target, "state_before": before, "state_after": after,
            "trigger": {"type": "voice_anchor", "text": ident}, "motion": {"preset": preset, "duration_frames": frames}}


class SceneMotionTests(unittest.TestCase):
    def test_pose_changes_use_registered_presets_after_a_calm_first_one(self):
        scene = {"entities": [character("a"), character("b")],
                 "events": [event("e1", "a", "neutral", "deny"), event("e2", "a", "deny", "commit"), event("e3", "a", "commit", "exposed"),
                            event("e4", "b", "judge", "judge")]}
        scene_motion.animate(scene)
        presets = [e["motion"]["preset"] for e in scene["events"]]
        self.assertEqual(presets, ["state_swap", "small-bounce", "small-bounce", "state_swap"])
        self.assertTrue(all(e["motion"]["duration_frames"] == 12 for e in scene["events"][1:3]))
        self.assertNotIn("camera", scene)

    def test_first_piece_of_a_picture_pops_in_later_pieces_do_not(self):
        scene = {"entities": [], "events": [event("g1", "graphic_s1", "hidden", "step1"), event("g2", "graphic_s1", "step1", "step2")]}
        scene_motion.animate(scene)
        self.assertEqual([e["motion"]["preset"] for e in scene["events"]], ["pop-in", "state_swap"])


if __name__ == "__main__":
    unittest.main()
