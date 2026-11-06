from tools.zodiac_local import _reconcile_asr_variant


def _measured(words):
    return [
        {
            "heard": word,
            "startMs": index * 100.0,
            "endMs": (index + 1) * 100.0,
            "confidence": 0.9,
        }
        for index, word in enumerate(words)
    ]


def test_reconcile_allows_spoken_arrow_alias_from_approved_text():
    expected = ["BÌNH", "THƯỜNG→", "GẮT"]
    result = _reconcile_asr_variant(
        expected,
        _measured(["bình", "thường", "đến", "gắt"]),
    )
    assert result is not None
    assert [row["text"] for row in result] == expected
    assert result[1]["alignment_source"] == "asr_exact"
    assert result[2]["startMs"] == 300.0


def test_reconcile_still_rejects_ungrounded_asr_insertion():
    assert (
        _reconcile_asr_variant(
            ["BÌNH", "THƯỜNG", "GẮT"],
            _measured(["bình", "thường", "đến", "gắt"]),
        )
        is None
    )
