import unittest

from tools.studio_project.pipeline import proposals, publish_copy
from tools.studio_project.pipeline.evidence import PipelineEvidence


class PublishCopyTests(unittest.TestCase):
    def test_tags_are_clean_distinct_branded_and_start_with_the_sign(self):
        tags = publish_copy.clean_tags(["#fyp", "viral tag", "#12CungHoangDao", "#12cunghoangdao", "#bad-tag!", "#TinhYeu"], "Thiên Bình")
        self.assertEqual(tags[0], "#ThiênBình")
        self.assertEqual(tags[-1], "#bungmoto")
        self.assertNotIn("#fyp", tags)
        self.assertEqual(len([t for t in tags if t.lower() == "#12cunghoangdao"]), 1)
        self.assertTrue(all(t.startswith("#") and " " not in t for t in tags))
        self.assertLessEqual(len(tags), 9)

    def test_too_many_tags_keep_the_sign_first_and_the_brand_last(self):
        tags = publish_copy.clean_tags([f"#tag{i}" for i in range(20)], "Kim Ngưu")
        self.assertEqual((len(tags), tags[0], tags[-1]), (9, "#KimNgưu", "#bungmoto"))

    def test_the_answer_becomes_a_valid_publish_payload(self):
        raw = {"title": "Bênh trước cả đám, về riêng vẫn góp ý", "cover_hook": "Bênh hết mình, vẫn muốn nghe cãi lại", "caption": "Bạn bênh người yêu rồi có góp ý riêng không?",
               "hashtags": ["#tinhyeu", "#tamly", "#cunghoangdao", "#TínhCáchThiênBình"], "alt_hooks": ["a", "b", "c", "d"], "search_keyword": "thiên bình yêu"}
        payload = publish_copy.normalise(raw, "Thiên Bình")
        self.assertTrue(payload["title"].startswith("Thiên Bình"))  # the sign is always in the title
        self.assertEqual(payload["alt_hooks"], ["a", "b", "c"])
        evidence = PipelineEvidence(content_approved=True, scene_ids=("s01",), visual_revision=1, visual_source_hash="h")
        self.assertEqual(proposals.validate_proposal("publish.copy", payload, evidence), ())

    def test_an_empty_or_thin_answer_is_unusable(self):
        with self.assertRaises(ValueError):
            publish_copy.normalise({"title": "", "caption": "x", "hashtags": []}, "Kim Ngưu")
        with self.assertRaises(ValueError):
            publish_copy.normalise({"title": "t", "caption": "c", "hashtags": ["#a"]}, "")


if __name__ == "__main__":
    unittest.main()
