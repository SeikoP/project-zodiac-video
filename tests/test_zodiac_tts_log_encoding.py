import io
import os
import unittest
from unittest.mock import patch

from tools.zodiac_local import _emit_tts_log


class TtsLogEncodingTests(unittest.TestCase):
    def test_utf8_tts_log_survives_cp1252_stdout(self):
        text = "Đang tạo giọng đọc qua VieNeu Gradio…"
        raw = io.BytesIO()
        stdout = io.TextIOWrapper(raw, encoding="cp1252", errors="strict")

        with patch("tools.zodiac_local.emit_process_log", return_value=False), patch(
            "tools.zodiac_local.sys.stdout", stdout
        ):
            _emit_tts_log(text)
            stdout.flush()

        self.assertEqual(raw.getvalue(), (text + os.linesep).encode("utf-8"))


if __name__ == "__main__":
    unittest.main()
