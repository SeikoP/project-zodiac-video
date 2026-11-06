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
