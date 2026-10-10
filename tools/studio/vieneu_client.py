"""VieNeu streaming used by production speech and the Qt voice audition."""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import time
import urllib.request
from pathlib import Path

EVENT_PREFIX = "VIENEU_EVENT "
PREVIEW_TEXT = "Xin chào, đây là giọng đọc bạn đã chọn cho video Zodiac."


def chunk_progress(message: str) -> tuple[int, int] | None:
    match = re.search(r"(Đang xử lý đoạn|Đã xong)\s+(\d+)/(\d+)", message, re.I)
    if not match:
        return None
    current, total = int(match[2]), int(match[3])
    if not 0 < current <= total:
        return None
    return (current - 1 if match[1].lower().startswith("đang") else current, total)


def stream_prediction(client, args, api_name: str, on_status):
    job = client.submit(*args, api_name="/" + api_name.lstrip("/"))
    seen, previous_state, last_message = 0, None, None
    while True:
        status = job.status()
        state = status.code.name
        if state != previous_state:
            if state == "IN_QUEUE":
                rank = getattr(status, "rank", None)
                on_status("VieNeu: đang chờ hàng đợi" + (f" · vị trí {rank}" if rank is not None else ""))
            elif state in ("STARTING", "PROCESSING"):
                on_status("VieNeu: đang xử lý yêu cầu")
            previous_state = state
        outputs = job.outputs()
        for update in outputs[seen:]:
            if isinstance(update, (list, tuple)) and len(update) > 1 and isinstance(update[1], str):
                last_message = update[1]
                on_status(last_message)
        seen = len(outputs)
        if job.done():
            break
        time.sleep(0.2)
    result = job.result()  # Propagate server errors, even after partial outputs.
    if isinstance(result, (tuple, list)) and len(result) > 1 and result[1] != last_message:
        on_status(str(result[1]))
    return result


def stream_speech(client, args, api_name: str, on_status):
    result = stream_prediction(client, args, api_name, on_status)
    if isinstance(result, (tuple, list)) and result[0] is None and "Vui lòng tải model trước" in str(result[1]):
        on_status("VieNeu: đang nạp model vào server…")
        loaded = stream_prediction(client, ["VieNeu-TTS-v3-Turbo", "VieNeu-Codec", "Auto", True,
                                            "", "VieNeu-TTS-v3-Nano (preview)", ""], "load_model", on_status)
        if not str(loaded[0]).startswith("✅ Model đã tải thành công"):
            raise RuntimeError("VieNeu không nạp được model: " + str(loaded[0]))
        result = stream_prediction(client, args, api_name, on_status)
    return result


def emit_progress(message: str, **scene) -> None:
    event = dict(scene, message=message)
    chunks = chunk_progress(message)
    if chunks:
        event.update(chunk_done=chunks[0], chunk_total=chunks[1])
    print(EVENT_PREFIX + json.dumps(event, ensure_ascii=False), flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("voices", "preview"))
    parser.add_argument("--url", required=True)
    parser.add_argument("--voice")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    from gradio_client import Client
    client = Client(args.url, verbose=False)
    if args.operation == "voices":
        update = client.predict(api_name="/_srt_voices")
        if not isinstance(update, dict) or not isinstance(update.get("choices"), list):
            raise RuntimeError("VieNeu trả danh sách giọng không hợp lệ")
        print("VIENEU_VOICES " + json.dumps(update, ensure_ascii=False), flush=True)
        return
    if not args.voice or not args.output:
        parser.error("preview requires --voice and --output")
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
    from tools.zodiac_local import _select_vieneu_gradio_dependency, validate_voice
    with urllib.request.urlopen(args.url.rstrip("/") + "/config", timeout=10) as response:
        config = json.load(response)
    dependency = _select_vieneu_gradio_dependency(config)
    components = {item["id"]: item for item in config["components"]}
    inputs = [i for i in dependency["inputs"] if components.get(i, {}).get("type") != "state"]
    values = [components[i].get("props", {}).get("value") for i in inputs]
    values[dependency["_text_position"]] = PREVIEW_TEXT
    values[dependency["_voice_position"]] = args.voice
    result = stream_speech(client, values, dependency["api_name"], emit_progress)
    audio = result[0] if isinstance(result, (tuple, list)) else result
    if isinstance(audio, dict):
        audio = audio.get("path") or audio.get("name")
    if not audio or not Path(audio).is_file():
        raise RuntimeError("VieNeu không tạo được audio mẫu: " + str(result))
    validate_voice(Path(audio))
    shutil.copy2(audio, args.output)
    print("VIENEU_PREVIEW_READY " + json.dumps(str(args.output), ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
