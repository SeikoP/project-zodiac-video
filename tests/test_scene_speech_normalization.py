from tools.zodiac_local import caption_scene_text, spoken_scene_text


def test_scene_direction_metadata_is_removed_from_caption_and_speech():
    raw = "[S01 — HOOK | GẮT]\nBạch Dương bỏ đi.\n"
    assert caption_scene_text(raw) == "Bạch Dương bỏ đi."
    assert spoken_scene_text(raw) == "Bạch Dương bỏ đi."


def test_separate_scene_and_tone_brackets_are_removed():
    raw = "[S02][GẮT]\nChuyện là thế này."
    assert caption_scene_text(raw) == "Chuyện là thế này."


def test_pro_max_keeps_caption_case_but_tts_gets_natural_product_case():
    raw = "[S03 — GIẢ QUẢNG CÁO | GẮT]\nXin giới thiệu: LÒNG TỰ TRỌNG PRO MAX!"
    assert caption_scene_text(raw).endswith("LÒNG TỰ TRỌNG PRO MAX!")
    assert spoken_scene_text(raw).endswith("LÒNG TỰ TRỌNG Pro Max!")


def test_inline_scene_direction_is_removed_after_caption_segment_compaction():
    assert caption_scene_text("SAO CÒN CHỜ? [S01 — HOOK | GẮT]") == "SAO CÒN CHỜ?"
    assert caption_scene_text("[S02][GẮT] Chuyện là thế này.") == "Chuyện là thế này."


def test_semantic_caption_alignment_uses_cleaned_phrase_text():
    from tools.control_plane.timeline import _semantic_caption_rows

    scene = {
        "id": "S01",
        "caption_segments": [
            {"text": "SAO CÒN CHỜ? [S01 — HOOK | GẮT]"},
            {"text": "Bạch Dương bỏ đi."},
        ],
    }
    words = ["SAO", "CÒN", "CHỜ?", "Bạch", "Dương", "bỏ", "đi."]
    timing = {
        "captions": [
            {"text": word, "startMs": i * 100.0, "endMs": (i+1) * 100.0}
            for i, word in enumerate(words)
        ]
    }
    rows = _semantic_caption_rows(scene, timing, fps=24)
    assert [row["text"] for row in rows] == ["SAO CÒN CHỜ?", "Bạch Dương bỏ đi."]


def test_semantic_caption_alignment_handles_label_split_across_phrases():
    from tools.control_plane.timeline import _semantic_caption_rows

    scene = {
        "id": "S02",
        "caption_segments": [
            {"text": "[S02 — XUNG ĐỘT | BÌNH THƯỜNG →"},
            {"text": "GẮT] Chuyện là thế này."},
            {"text": "Hai người đang giận nhau."},
        ],
    }
    words = ["Chuyện", "là", "thế", "này.", "Hai", "người", "đang", "giận", "nhau."]
    timing = {
        "captions": [
            {"text": word, "startMs": i * 100.0, "endMs": (i+1) * 100.0}
            for i, word in enumerate(words)
        ]
    }
    rows = _semantic_caption_rows(scene, timing, fps=24)
    assert [row["text"] for row in rows] == [
        "Chuyện là thế này.", "Hai người đang giận nhau."
    ]
