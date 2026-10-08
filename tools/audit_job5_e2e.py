#!/usr/bin/env python3
"""Independent Job@5 E2E acceptance gate. No renderer implementation assumptions."""
import argparse
import json
import sys
from pathlib import Path

CHECKS = (
    "asset_visible", "state_correct", "event_timing_correct",
    "spatial_semantics_correct", "effect_visible", "caption_safe",
    "font_correct", "transition_correct",
)
ARTIFACTS = ("video", "cover", "publish_json", "publish_copy")

def verify(receipt_path: Path):
    errors = []
    try:
        doc = json.loads(receipt_path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        return [f"RECEIPT_INVALID: {exc}"]
    if not isinstance(doc, dict):
        return ["RECEIPT_INVALID: expected object"]
    if doc.get("contract") != "zodiac-job@5":
        errors.append("CONTRACT_MISMATCH")
    scene_rows = doc.get("scenes")
    if not isinstance(scene_rows, list) or not scene_rows:
        errors.append("SCENES_MISSING")
    else:
        seen = set()
        for index, row in enumerate(scene_rows):
            if not isinstance(row, dict):
                errors.append(f"SCENE_{index}: invalid scene record")
                continue
            sid = row.get("id")
            if not isinstance(sid, str) or not sid or sid in seen:
                errors.append(f"SCENE_{index}: missing or duplicate id")
            seen.add(sid)
            frames = row.get("reviewed_frames")
            if not isinstance(frames, list) or len(frames) < 3 or any(
                not isinstance(f, (int, float)) or isinstance(f, bool) or f < 0 for f in frames
            ) or len(set(frames)) < 3:
                errors.append(f"{sid}: require at least 3 distinct reviewed frame timestamps")
            for check in CHECKS:
                if row.get(check) is not True:
                    errors.append(f"{sid}: {check} not verified")
    outputs = doc.get("artifacts")
    if not isinstance(outputs, dict):
        errors.append("ARTIFACTS_MISSING")
    else:
        for name in ARTIFACTS:
            raw = outputs.get(name)
            if not isinstance(raw, str) or not raw.strip():
                errors.append(f"{name}: path missing")
                continue
            path = Path(raw)
            if not path.is_absolute():
                path = receipt_path.parent / path
            if not path.is_file() or path.stat().st_size == 0:
                errors.append(f"{name}: missing or empty artifact")
    if doc.get("voice_caption_synced") is not True:
        errors.append("VOICE_CAPTION_NOT_VERIFIED")
    if doc.get("ending_not_cut") is not True:
        errors.append("ENDING_NOT_VERIFIED")
    if doc.get("gui_responsive") is not True:
        errors.append("GUI_NOT_VERIFIED")
    if doc.get("logs_unobstructed") is not True:
        errors.append("LOGS_NOT_VERIFIED")
    return errors

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("receipt", type=Path, help="JSON human/E2E evidence receipt")
    args = parser.parse_args()
    failures = verify(args.receipt)
    if failures:
        print("UNVERIFIED: acceptance gate failed")
        for item in failures:
            print(" -", item)
        return 1
    print("ACCEPTANCE_PASS: receipt assertions and output files verified")
    print("Note: visual review values are attested evidence, not automated image analysis.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
