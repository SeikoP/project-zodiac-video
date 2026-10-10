"""Measured final media/cover acceptance; never claim video PASS from a ZIP.

Usage:
  python -m tools.media_acceptance <workspace> --video <mp4> --cover <png>
Outputs .runtime/media-acceptance.json with evidence or concrete blockers.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct
import subprocess
import wave


def file_sha(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def png_size(path: Path) -> tuple[int, int]:
    with path.open("rb") as handle:
        head = handle.read(24)
    if len(head) != 24 or head[:8] != b"\x89PNG\r\n\x1a\n" or head[12:16] != b"IHDR":
        raise ValueError("COVER_PNG_INVALID")
    return struct.unpack(">II", head[16:24])


def media_tracks(path: Path) -> dict:
    ffprobe = shutil.which("ffprobe")
    if ffprobe is None:
        raise RuntimeError("FFPROBE_MISSING")
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries",
         "format=duration:stream=codec_type,duration,width,height",
         "-of", "json", str(path)],
        capture_output=True, text=True, check=False, timeout=60,
    )
    if result.returncode != 0:
        raise RuntimeError("FFPROBE_FAILED: " + result.stderr[-300:])
    return json.loads(result.stdout)


def assess_durations(video_seconds: float, audio_seconds: float,
                     voice_seconds: float, expected_fps: int) -> list[str]:
    """A nonzero tail may be video-only; require at least preserved speech."""
    errors = []
    if not 1 <= expected_fps <= 120:
        errors.append("FPS_INVALID")
    if voice_seconds <= 0:
        errors.append("VOICE_EMPTY")
    if video_seconds + 1 / max(1, expected_fps) < voice_seconds:
        errors.append("FINAL_VIDEO_CUTS_VOICE")
    if audio_seconds + 0.12 < voice_seconds:
        errors.append("FINAL_AUDIO_CUTS_VOICE")
    if video_seconds <= 0:
        errors.append("VIDEO_EMPTY")
    return errors


def inspect(workspace: Path, video: Path, cover: Path) -> dict:
    errors, evidence = [], {}
    for label, path in (("voice", workspace / "voice.wav"),
                        ("video", video), ("cover", cover),
                        ("publish_json", workspace / "publish/publish.json"),
                        ("publish_copy", workspace / "publish/publish-copy.txt")):
        if not path.is_file() or path.stat().st_size <= 0:
            errors.append("ARTIFACT_MISSING:" + label)
        else:
            evidence[label] = {"path": str(path), "sha256": file_sha(path),
                               "bytes": path.stat().st_size}
    if "cover" in evidence:
        try:
            width, height = png_size(cover)
            evidence["cover"]["dimensions"] = [width, height]
            if (width, height) != (1080, 1920):
                errors.append("COVER_DIMENSIONS_INVALID")
        except (ValueError, OSError) as exc:
            errors.append(str(exc))
    if "voice" in evidence and "video" in evidence:
        try:
            with wave.open(str(workspace / "voice.wav"), "rb") as wav:
                voice_seconds = wav.getnframes() / wav.getframerate()
            media = media_tracks(video)
            video_seconds = float(media.get("format", {}).get("duration", 0))
            streams = media.get("streams", [])
            audio = [stream for stream in streams if stream.get("codec_type") == "audio"]
            visual = [stream for stream in streams if stream.get("codec_type") == "video"]
            if not visual: errors.append("FINAL_VIDEO_TRACK_MISSING")
            if not audio: errors.append("FINAL_AUDIO_TRACK_MISSING")
            if audio and audio[0].get("duration") is None:
                errors.append("FINAL_AUDIO_DURATION_UNAVAILABLE")
            audio_seconds = float(audio[0].get("duration") or 0) if audio else 0.0
            timing_path = workspace / ".runtime/timing.json"
            fps = 24
            if timing_path.is_file():
                timing = json.loads(timing_path.read_text(encoding="utf-8"))
                fps = int(timing.get("fps", 24))
                evidence["timing_sha256"] = file_sha(timing_path)
            errors.extend(assess_durations(video_seconds, audio_seconds,
                                           voice_seconds, fps))
            evidence["durations_s"] = {"voice": voice_seconds,
                                       "final_audio": audio_seconds,
                                       "final_video": video_seconds}
        except (RuntimeError, OSError, ValueError, KeyError, wave.Error,
                subprocess.TimeoutExpired, ZeroDivisionError) as exc:
            errors.append("MEDIA_PROBE_FAILED:" + str(exc))
    return {
        "format": "zodiac-media-acceptance@1",
        "status": "PASS_TECHNICAL_ONLY" if not errors else "BLOCKED",
        "issues": errors, "evidence": evidence,
        "visual_human_review": "NOT_VERIFIED",
        "spoken_last_syllable_review": "NOT_VERIFIED",
        "warning": "Technical metadata cannot certify creative semantics, audio fidelity, frame contacts or human review.",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("workspace", type=Path)
    parser.add_argument("--video", required=True, type=Path)
    parser.add_argument("--cover", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = inspect(args.workspace.resolve(), args.video.resolve(), args.cover.resolve())
    output = args.output or args.workspace / ".runtime/media-acceptance.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "issues": report["issues"],
                      "receipt": str(output)}, ensure_ascii=False))
    return 0 if report["status"] == "PASS_TECHNICAL_ONLY" else 2


if __name__ == "__main__":
    raise SystemExit(main())
