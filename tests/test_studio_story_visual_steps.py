"""Story visual art that is revealed one piece at a time (tally, chat thread, staged chat compare)."""
import re
import unittest

from tools.studio_project import story_visual_art as art

TALLY = {"type": "tally", "title": "Mở đoạn chat", "count": 4, "caption": "4 lần trong 5 phút"}
THREAD = {"type": "chat_thread", "title": "Hội bạn", "messages": [
    {"from": "them", "text": "Quán này hợp để mày dẫn người ấy"}, {"from": "me", "text": "Chốt, bảy giờ tao qua đón"},
    {"from": "them", "text": "Nếu tụi tao chỉ muốn đi với mày?"}, {"from": "me", "text": "Để xem"}]}
COMPARE = {"type": "chat_compare", "left": {"sender": "Hội bạn", "question": "Thứ Bảy đi chơi không?", "reply": "Để xem"},
           "right": {"sender": "Người ấy", "question": "Thứ Bảy đi chơi không?", "reply": "Bảy giờ, tớ qua đón"}}


class StepTests(unittest.TestCase):
    def test_the_number_of_steps_follows_the_content(self):
        self.assertEqual((art.steps(TALLY), art.steps(THREAD), art.steps(COMPARE)), (4, 4, 2))
        self.assertEqual(art.steps({"type": "story_text", "text": "x", "purpose": "payoff"}), 1)

    def test_every_step_is_a_different_picture_and_the_last_is_the_whole_one(self):
        for spec in (TALLY, THREAD, COMPARE):
            pictures = [art.visual_svg(spec, k) for k in range(1, art.steps(spec) + 1)]
            self.assertEqual(len(set(pictures)), len(pictures), spec["type"])
            self.assertEqual(pictures[-1], art.visual_svg(spec), spec["type"])

    def test_a_tally_fills_one_more_cell_each_step_and_shows_its_caption_only_at_the_end(self):
        def filled(svg):
            return len(re.findall(r'fill="#E97A66" stroke="#2F3C44" stroke-width="7"', svg.decode("utf8")))
        self.assertEqual([filled(art.visual_svg(TALLY, k)) for k in range(1, 5)], [1, 2, 3, 4])
        self.assertLess(len(art.visual_svg(TALLY, 3)), len(art.visual_svg(TALLY, 4)))

    def test_the_art_is_plain_vector_without_text_elements_or_scripts(self):
        for spec in (TALLY, THREAD, COMPARE):
            svg = art.visual_svg(spec).decode("utf8")
            self.assertNotRegex(svg, r"<text|<script|href=|data:|filter")

    def test_bad_specs_are_rejected(self):
        bad = [{**TALLY, "count": 1}, {**TALLY, "count": 9}, {**TALLY, "title": "x" * 60}, {**TALLY, "extra": 1},
               {**THREAD, "messages": THREAD["messages"][:1]}, {**THREAD, "messages": [{"from": "x", "text": "a"}, {"from": "me", "text": "b"}]},
               {**THREAD, "messages": [{"from": "me", "text": "y" * 80}, {"from": "them", "text": "b"}]}]
        for spec in bad:
            with self.assertRaises(ValueError, msg=spec):
                art.visual_svg(spec)


if __name__ == "__main__":
    unittest.main()
