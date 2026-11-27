import unittest

from tools.studio_project import graphic_need as g

SCENES = [("s01", "Thiên Bình bênh người yêu rất khó hiểu."),
          ("s02", "Hai đứa bạn cãi nhau rồi tìm Thiên Bình kể khổ. Đứa này kể xong, đứa kia nhắn tin lại."),
          ("s03", "Ba lần liên tục bị bạn bè trêu."),
          ("s04", "Nó giận người yêu.")]


class GraphicNeedTests(unittest.TestCase):
    def test_an_episode_of_only_none_is_refused_when_the_words_state_facts(self):
        found = g.missing(SCENES, set())
        self.assertIn("s02", {f["scene_id"] for f in found})
        self.assertTrue(all(f["code"] == g.CODE for f in found))

    def test_a_picture_already_chosen_is_not_asked_for_again(self):
        self.assertNotIn("s02", {f["scene_id"] for f in g.missing(SCENES, {"s02"})})

    def test_quota_is_met_by_the_scene_that_states_the_most(self):
        found = g.missing([("a", "Nó nhắn tin."), ("b", "Chỉ kể chuyện.")], set())
        self.assertEqual([f["scene_id"] for f in found], ["a"])

    def test_a_script_with_no_fact_is_never_forced(self):
        self.assertEqual(g.missing([("a", "Nó buồn."), ("b", "Nó vui.")], set()), [])


if __name__ == "__main__":
    unittest.main()
