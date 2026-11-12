"""Shared local helpers: voice synthesis, word alignment and background-music defaults.

The v1 package/render pipeline that used to live here was removed; Job@5 runs
through tools.runner and tools.studio_v2."""

import difflib

import json

import math

import re

import subprocess

import sys

import unicodedata

import wave

from pathlib import Path

from tools.runner.errors import (
    AlignmentMismatchError,
    InvalidAlignmentTimestampError,
    PipelineError,
)

from tools.runner.process import emit_process_log, run_managed_subprocess

from tools.runner.audio import concatenate_wavs, validate_voice

DEFAULT_TTS_ROOT = Path(r"E:\projects\VieNeu-TTS")

DEFAULT_TTS_VOICE = "Hải Đăng"

DEFAULT_TTS_BACKEND = "onnx"

DEFAULT_TTS_PRECISION = "fp32"

DEFAULT_TTS_FRAME_CAP = "on"

DEFAULT_TTS_MAX_CHARS = 256

DEFAULT_SPEECH_RATE_WARNING_WPS = 3.8

ASR_SCENE_BOUNDARY_TOLERANCE_MS = 250.0

DEFAULT_MUSIC_VOLUME = 1.0

SUPPORTED_MUSIC_EXTENSIONS = {".mp3", ".wav", ".m4a", ".aac", ".ogg"}

_SCENE_DIRECTION_MARKER_RE = re.compile(
    r"\[S\d{2}[^\]\r\n]*\](?:[ \t]*\[(?:GẮT|BÌNH THƯỜNG)[^\]\r\n]*\])?",
    flags=re.IGNORECASE,
)


def caption_scene_text(value: str) -> str:
    """Remove authored scene/tone labels, including when merged into captions."""
    text = str(value).replace("\r\n", "\n").replace("\r", "\n")
    text = _SCENE_DIRECTION_MARKER_RE.sub("", text)
    return "\n".join(line.strip() for line in text.split("\n")).strip()


def spoken_scene_text(value: str) -> str:
    """TTS-safe text while preserving approved narration semantics."""
    # Layout line breaks otherwise become separate VieNeu normalization/generation chunks.
    text = " ".join(caption_scene_text(value).split())
    # VieNeu can spell all-caps Latin product labels letter-by-letter.
    # Case-normalize the established product phrase without changing captions.
    return re.sub(r"\bPRO\s+MAX\b", "Pro Max", text, flags=re.IGNORECASE)

BUNDLED_MUSIC = Path(__file__).resolve().parents[1] / "assets" / "music" / "background.mp3"


def default_music_path() -> Path | None:
    """Bundled background track when it exists, otherwise None (no music)."""
    return BUNDLED_MUSIC if BUNDLED_MUSIC.is_file() else None


def _normalize_token(value: str) -> str:
    value = unicodedata.normalize("NFC", str(value)).lower()
    return "".join(
        char
        for char in value
        if not unicodedata.category(char).startswith(("P", "S")) and not char.isspace()
    )


def _expected_caption_tokens(text: str) -> list[str]:
    tokens: list[str] = []
    for raw in text.split():
        if _normalize_token(raw):
            tokens.append(raw)
        elif tokens:
            tokens[-1] += raw
    return tokens


def _sentence_pause_after_indices(text: str) -> set[int]:
    """Token indices after which Studio inserts an explicit sentence pause."""
    tokens = _expected_caption_tokens(text)
    pauses: set[int] = set()
    for index, token in enumerate(tokens[:-1]):
        visible = token.rstrip('”"’\'»)]}')
        if re.search(r"(?:[.!?…]+)$", visible):
            pauses.add(index)
    return pauses

_VI_DIGIT_WORDS = {
    "0": "không",
    "1": "một",
    "2": "hai",
    "3": "ba",
    "4": "bốn",
    "5": "năm",
    "6": "sáu",
    "7": "bảy",
    "8": "tám",
    "9": "chín",
}


def _vi_under_thousand_words(value: int, *, force_hundreds: bool = False) -> list[str]:
    if value < 0 or value >= 1000:
        raise ValueError("value must be between 0 and 999")
    if value == 0:
        return ["không"] if not force_hundreds else []

    words: list[str] = []
    hundreds, remainder = divmod(value, 100)
    tens, ones = divmod(remainder, 10)

    if hundreds:
        words.extend([_VI_DIGIT_WORDS[str(hundreds)], "trăm"])
    elif force_hundreds and remainder:
        words.extend(["không", "trăm"])

    if tens == 0:
        if ones:
            if hundreds or force_hundreds:
                words.append("linh")
            words.append(_VI_DIGIT_WORDS[str(ones)])
        return words

    if tens == 1:
        words.append("mười")
    else:
        words.extend([_VI_DIGIT_WORDS[str(tens)], "mươi"])

    if ones:
        if tens >= 2 and ones == 1:
            words.append("mốt")
        elif tens >= 2 and ones == 4:
            words.append("tư")
        elif tens >= 1 and ones == 5:
            words.append("lăm")
        else:
            words.append(_VI_DIGIT_WORDS[str(ones)])
    return words


def _vi_integer_words(raw_digits: str) -> list[str]:
    """Canonical Vietnamese reading for an unsigned integer token."""
    digits = str(raw_digits).lstrip("0") or "0"
    if digits == "0":
        return ["không"]

    groups: list[int] = []
    while digits:
        groups.append(int(digits[-3:]))
        digits = digits[:-3]

    scale_names = {
        0: [],
        1: ["nghìn"],
        2: ["triệu"],
        3: ["tỷ"],
        4: ["nghìn", "tỷ"],
        5: ["triệu", "tỷ"],
        6: ["tỷ", "tỷ"],
    }
    if len(groups) - 1 > max(scale_names):
        # Very large identifiers are safer as individual digits than guessed
        # Vietnamese large-number grammar.
        return [_VI_DIGIT_WORDS[ch] for ch in raw_digits]

    words: list[str] = []
    highest = len(groups) - 1
    for index in range(highest, -1, -1):
        group = groups[index]
        if group == 0:
            continue
        force_hundreds = bool(words) and group < 100
        words.extend(
            _vi_under_thousand_words(
                group,
                force_hundreds=force_hundreds,
            )
        )
        words.extend(scale_names[index])
    return words


def _alignment_units(raw_token: str) -> list[str]:
    """Canonical comparison units; preserves Whisper numeric compaction."""
    raw = unicodedata.normalize("NFC", str(raw_token)).strip().lower()
    numeric = re.fullmatch(r"([0-9]+)\s*(%)?", raw)
    if numeric:
        units = _vi_integer_words(numeric.group(1))
        if numeric.group(2):
            units.extend(["phần", "trăm"])
        return units
    normalized = _normalize_token(raw)
    return [normalized] if normalized else []


def _alignment_coverage_gap(
    expected_tokens: list[str],
    measured_words: list[dict],
) -> bool:
    """True only when ASR evidence suggests approved words have no counterpart.

    Substitutions of the same/greater heard span are treated as transcription
    variants, not as proof that TTS omitted audio. This prevents expensive TTS
    regeneration for cases such as Xử/Sử, 8%/tám phần trăm, or word splitting.
    """
    expected_units = [
        unit
        for token in expected_tokens
        for unit in _alignment_units(token)
    ]
    heard_units = [
        unit
        for item in measured_words
        for unit in _alignment_units(item.get("heard", ""))
    ]
    matcher = difflib.SequenceMatcher(
        a=expected_units,
        b=heard_units,
        autojunk=False,
    )
    for tag, _i1, _i2, _j1, _j2 in matcher.get_opcodes():
        # A replacement is ambiguous ASR evidence: Whisper may substitute,
        # merge, or split spoken words. Only an actual delete proves that an
        # approved unit has no measured counterpart at all.
        if tag == "delete":
            return True
    return False


def _expanded_measured_alignment_words(measured_words: list[dict]) -> list[dict]:
    """Expand compact ASR forms while retaining a measured time span."""
    expanded: list[dict] = []
    for item in measured_words:
        units = _alignment_units(item.get("heard", ""))
        if not units:
            continue
        start_ms = float(item["startMs"])
        end_ms = float(item["endMs"])
        width = (end_ms - start_ms) / len(units)
        for index, unit in enumerate(units):
            begin = start_ms + width * index
            end = end_ms if index == len(units) - 1 else start_ms + width * (index + 1)
            expanded.append(
                {
                    "heard": unit,
                    "startMs": begin,
                    "endMs": end,
                    "confidence": item.get("confidence"),
                }
            )
    return expanded


def _reconcile_asr_variant(
    expected_tokens: list[str],
    measured_words: list[dict],
) -> list[dict] | None:
    """Map transcription variants back to approved tokens without hiding omissions.

    Reconciliation is allowed only when every approved token has measured audio
    coverage. Equal-length substitutions reuse measured word spans; one-to-many
    ASR splits share the measured replacement span. Missing approved words and
    standalone ASR insertions are rejected.
    """
    expected_units: list[str] = []
    for token in expected_tokens:
        units = _alignment_units(token)
        if len(units) != 1:
            return None
        expected_units.append(units[0])

    measured = _expanded_measured_alignment_words(measured_words)
    heard_units = [str(item["heard"]) for item in measured]
    matcher = difflib.SequenceMatcher(
        a=expected_units,
        b=heard_units,
        autojunk=False,
    )
    output: list[dict | None] = [None] * len(expected_tokens)

    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        expected_count = i2 - i1
        heard_count = j2 - j1
        if tag == "equal":
            for offset in range(expected_count):
                source = measured[j1 + offset]
                output[i1 + offset] = {
                    "text": expected_tokens[i1 + offset],
                    "startMs": source["startMs"],
                    "endMs": source["endMs"],
                    "timestampMs": source["startMs"],
                    "confidence": source.get("confidence"),
                    "alignment_source": "asr_exact",
                }
            continue

        if tag == "insert":
            # Some TTS frontends speak the approved transition glyph "→" as
            # "đến". This is not an ungrounded ASR insertion: the spoken word
            # is licensed by the immediately preceding approved token.
            previous = expected_tokens[i1 - 1] if i1 > 0 else ""
            if (
                heard_count == 1
                and "→" in previous
                and str(measured[j1]["heard"]) == "đến"
            ):
                continue
            return None

        if tag != "replace" or expected_count < 1 or heard_count < 1:
            return None

        if expected_count == heard_count:
            for offset in range(expected_count):
                source = measured[j1 + offset]
                output[i1 + offset] = {
                    "text": expected_tokens[i1 + offset],
                    "startMs": source["startMs"],
                    "endMs": source["endMs"],
                    "timestampMs": source["startMs"],
                    "confidence": source.get("confidence"),
                    "alignment_source": "asr_variant",
                }
            continue

        span_start = float(measured[j1]["startMs"])
        span_end = float(measured[j2 - 1]["endMs"])
        weights = [
            max(1, len(_normalize_token(expected_tokens[index])))
            for index in range(i1, i2)
        ]
        total_weight = sum(weights)
        cursor = span_start
        confidences = [
            item.get("confidence")
            for item in measured[j1:j2]
            if item.get("confidence") is not None
        ]
        confidence = min(confidences) if confidences else None
        for relative, weight in enumerate(weights):
            fraction = weight / total_weight
            end = span_end if relative == len(weights) - 1 else cursor + (
                (span_end - span_start) * fraction
            )
            index = i1 + relative
            output[index] = {
                "text": expected_tokens[index],
                "startMs": cursor,
                "endMs": end,
                "timestampMs": cursor,
                "confidence": confidence,
                "alignment_source": "asr_variant_split",
            }
            cursor = end

    if any(item is None for item in output):
        return None
    return [item for item in output if item is not None]


def load_word_aligner(
    model_name: str,
    device: str,
    compute_type: str,
    *,
    cpu_threads: int | None = None,
    num_workers: int = 1,
):
    require_word_aligner_installed()
    try:
        from faster_whisper import WhisperModel
    except ImportError as exc:
        raise PipelineError(
            "Automatic word-level timing requires faster-whisper. "
            f"Install it with:\n{aligner_install_command()}"
        ) from exc

    try:
        options = {"cpu_threads": cpu_threads} if cpu_threads is not None else {}
        return WhisperModel(
            model_name,
            device=device,
            compute_type=compute_type,
            num_workers=num_workers,
            **options,
        )
    except Exception as exc:
        raise PipelineError(
            f"cannot load faster-whisper model {model_name!r}: {exc}"
        ) from exc


def _repair_aligner_word_timestamps(
    raw_words: list[dict],
    audio_path: Path,
    *,
    tolerance_ms: float = ASR_SCENE_BOUNDARY_TOLERANCE_MS,
) -> list[dict]:
    """Repair only zero-duration ASR tokens from adjacent measured boundaries."""
    repaired: list[dict] = []
    tolerance_seconds = float(tolerance_ms) / 1000.0
    adjusted_next_start = None

    for index, raw in enumerate(raw_words):
        start = adjusted_next_start if adjusted_next_start is not None else raw.get("start")
        adjusted_next_start = None
        end = raw.get("end")

        def invalid(reason: str) -> InvalidAlignmentTimestampError:
            return InvalidAlignmentTimestampError(
                f"aligner returned an invalid word timestamp for {audio_path.name} "
                f"at word {index + 1} ({raw.get('heard')!r}): {reason}; "
                f"start={start!r}, end={end!r}."
            )

        if start is None or end is None:
            raise invalid("timestamp is missing")
        try:
            start = float(start)
            end = float(end)
        except (TypeError, ValueError) as exc:
            raise invalid("timestamp is not numeric") from exc
        if not math.isfinite(start) or not math.isfinite(end) or end < start:
            raise invalid("timestamp is non-finite or end precedes start")

        if math.isclose(end, start, rel_tol=0.0, abs_tol=1e-9):
            next_start = None
            next_end = None
            if index + 1 < len(raw_words):
                next_raw = raw_words[index + 1]
                try:
                    next_start = (
                        float(next_raw["start"])
                        if next_raw.get("start") is not None
                        else None
                    )
                    next_end = (
                        float(next_raw["end"])
                        if next_raw.get("end") is not None
                        else None
                    )
                except (TypeError, ValueError):
                    next_start = next_end = None

            previous_end = float(repaired[-1]["end"]) if repaired else None

            if (
                next_start is not None
                and next_start > start
                and next_start - start <= tolerance_seconds
            ):
                end = next_start
            elif (
                next_start == start
                and next_end is not None
                and math.isfinite(next_end)
                and next_end > start
                and (previous_end is None or math.isclose(previous_end, start, abs_tol=1e-9))
                and len(_alignment_units(raw.get("heard", ""))) == 1
                and len(_alignment_units(raw_words[index + 1].get("heard", ""))) == 1
            ):
                # shortcut: split the neighbor span by token length; phoneme timing could improve this estimate.
                current_weight = len(_normalize_token(raw["heard"]))
                next_weight = len(_normalize_token(raw_words[index + 1]["heard"]))
                end = start + (next_end - start) * current_weight / (current_weight + next_weight)
                adjusted_next_start = end
            else:
                if (
                    previous_end is None
                    or previous_end >= start
                    or start - previous_end > tolerance_seconds
                ):
                    raise invalid("zero-duration word cannot be repaired from adjacent boundaries")
                start = previous_end

        item = dict(raw)
        item["start"] = start
        item["end"] = end
        repaired.append(item)

    return repaired


def _align_scene_words(model, audio_path: Path, approved_text: str) -> list[dict]:
    expected = _expected_caption_tokens(approved_text)
    try:
        segments, _info = model.transcribe(
            str(audio_path),
            language="vi",
            word_timestamps=True,
            vad_filter=False,
            condition_on_previous_text=False,
        )
        raw_words = []
        for segment in segments:
            for word in segment.words or []:
                heard = str(word.word).strip()
                if not _normalize_token(heard):
                    continue
                raw_words.append(
                    {
                        "heard": heard,
                        "start": word.start,
                        "end": word.end,
                        "confidence": (
                            float(word.probability)
                            if word.probability is not None
                            else None
                        ),
                    }
                )

        measured = []
        for word in _repair_aligner_word_timestamps(
            raw_words,
            audio_path,
        ):
            measured.append(
                {
                    "heard": word["heard"],
                    "startMs": float(word["start"]) * 1000,
                    "endMs": float(word["end"]) * 1000,
                    "confidence": word["confidence"],
                }
            )
    except PipelineError:
        raise
    except Exception as exc:
        raise PipelineError(
            f"word alignment failed for {audio_path.name}: {exc}"
        ) from exc

    expected_norm = [_normalize_token(token) for token in expected]
    heard_norm = [_normalize_token(item["heard"]) for item in measured]
    if expected_norm != heard_norm:
        coverage_gap = _alignment_coverage_gap(expected, measured)
        if not coverage_gap:
            reconciled = _reconcile_asr_variant(expected, measured)
            if reconciled is not None:
                return reconciled
        mismatch_kind = (
            "coverage_gap"
            if coverage_gap
            else "unreconciled_asr_variant"
        )
        matcher = difflib.SequenceMatcher(a=expected_norm, b=heard_norm, autojunk=False)
        differences = [
            {
                "expected": " ".join(expected_norm[i1:i2]),
                "heard": " ".join(heard_norm[j1:j2]),
            }
            for tag, i1, i2, j1, j2 in matcher.get_opcodes()
            if tag != "equal"
        ]
        preview = "; ".join(
            f"expected [{row['expected']}] / heard [{row['heard']}]"
            for row in differences[:4]
        )
        raise AlignmentMismatchError(
            "ALIGNMENT_MISMATCH: "
            f"{audio_path.name}: {mismatch_kind}. {preview}. "
            "Audio/ASR needs verification; no inferred timestamps were written.",
            expected=expected_norm,
            heard=heard_norm,
            coverage_gap=coverage_gap,
        )

    return [
        {
            "text": display,
            "startMs": item["startMs"],
            "endMs": item["endMs"],
            "timestampMs": item["startMs"],
            "confidence": item["confidence"],
            "alignment_source": "asr_exact",
        }
        for display, item in zip(expected, measured)
    ]


def _clamp_aligned_words_to_wav_boundary(
    scene_id: str,
    words: list[dict],
    seconds: float,
    *,
    tolerance_ms: float = ASR_SCENE_BOUNDARY_TOLERANCE_MS,
) -> list[dict]:
    """Clamp only small ASR boundary drift; reject timestamps outside real audio."""
    duration_ms = float(seconds) * 1000.0
    normalized: list[dict] = []
    prior_end = 0.0

    for index, word in enumerate(words):
        item = dict(word)
        try:
            start_ms = float(item["startMs"])
            end_ms = float(item["endMs"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PipelineError(
                f"invalid measured word timing in {scene_id}."
            ) from exc

        if not math.isfinite(start_ms) or not math.isfinite(end_ms) or end_ms <= start_ms:
            raise PipelineError(f"invalid measured word timing in {scene_id}.")

        if start_ms < 0:
            if start_ms < -tolerance_ms:
                raise PipelineError(
                    f"caption word falls outside measured WAV boundary in {scene_id}."
                )
            start_ms = 0.0
            if item.get("timestampMs") is not None:
                item["timestampMs"] = 0.0

        if start_ms + 1e-6 < prior_end:
            raise PipelineError(
                f"measured caption timings overlap or are out of order in {scene_id}."
            )

        if end_ms > duration_ms:
            overrun = end_ms - duration_ms
            is_last = index == len(words) - 1
            if not is_last or overrun > tolerance_ms or start_ms >= duration_ms:
                raise PipelineError(
                    f"caption word falls outside measured WAV boundary in {scene_id}."
                )
            end_ms = duration_ms

        item["startMs"] = start_ms
        item["endMs"] = end_ms
        if item.get("timestampMs") is not None:
            timestamp = float(item["timestampMs"])
            if timestamp < 0 and timestamp >= -tolerance_ms:
                timestamp = 0.0
            item["timestampMs"] = min(max(timestamp, start_ms), end_ms)

        prior_end = end_ms
        normalized.append(item)

    return normalized


def build_timing_from_word_alignment(
    production: dict,
    durations: dict[str, float],
    aligned_words: dict[str, list[dict]],
    *,
    scene_gap_ms: float = 0.0,
    sentence_pause_ms: float = 0.0,
) -> dict:
    """Build scene frames from measured WAV duration plus explicit breathing pauses."""
    try:
        scene_gap_ms = float(scene_gap_ms)
        sentence_pause_ms = float(sentence_pause_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("pacing pauses must be finite non-negative numbers.") from None
    if not math.isfinite(scene_gap_ms) or scene_gap_ms < 0 or scene_gap_ms > 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")
    if (
        not math.isfinite(sentence_pause_ms)
        or sentence_pause_ms < 0
        or sentence_pause_ms > 3000
    ):
        raise PipelineError("sentence pause must be between 0 and 3000 ms.")

    fps = production["video"]["fps"]
    rows = []
    elapsed_seconds = 0.0
    scenes = production["scenes"]

    for scene_index, scene in enumerate(scenes):
        scene_id = scene["id"]
        seconds = durations.get(scene_id)
        words = aligned_words.get(scene_id)
        if not isinstance(seconds, (int, float)) or seconds <= 0:
            raise PipelineError(
                f"missing measured duration for scene {scene_id}."
            )
        if not isinstance(words, list) or not words:
            raise PipelineError(
                f"missing measured word timing for scene {scene_id}."
            )

        words = _clamp_aligned_words_to_wav_boundary(
            scene_id,
            words,
            float(seconds),
        )

        pause_after = _sentence_pause_after_indices(scene["voice"])
        start_frame = round(elapsed_seconds * fps)
        offset_ms = elapsed_seconds * 1000
        elapsed_seconds += float(seconds) + (
            len(pause_after) * sentence_pause_ms / 1000.0
        )
        if scene_index < len(scenes) - 1:
            elapsed_seconds += scene_gap_ms / 1000.0
        end_frame = max(start_frame + 1, round(elapsed_seconds * fps))

        global_words = []
        pauses_before = 0
        for word_index, word in enumerate(words):
            shift_ms = pauses_before * sentence_pause_ms
            global_words.append(
                {
                    **word,
                    "startMs": offset_ms + shift_ms + float(word["startMs"]),
                    "endMs": offset_ms + shift_ms + float(word["endMs"]),
                    "timestampMs": (
                        None
                        if word.get("timestampMs") is None
                        else offset_ms + shift_ms + float(word["timestampMs"])
                    ),
                }
            )
            if word_index in pause_after:
                pauses_before += 1

        rows.append(
            {
                "scene_id": scene_id,
                "start_frame": start_frame,
                "duration_frames": end_frame - start_frame,
                "captions": global_words,
            }
        )

    return {
        "fps": fps,
        "total_duration_frames": (
            rows[-1]["start_frame"] + rows[-1]["duration_frames"]
        ),
        "scenes": rows,
    }


def _tts_python(tts_root: Path, requested: Path | None) -> Path:
    candidate = Path(requested).expanduser() if requested else Path(tts_root) / ".venv" / "Scripts" / "python.exe"
    if not candidate.is_file():
        raise PipelineError(f"VieNeu Python environment not found: {candidate}")
    return candidate.resolve()


def file_sha256(path: Path) -> str:
    """Content fingerprint used for package and per-scene voice reuse."""
    import hashlib

    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def aligner_install_command() -> str:
    """The only supported install command: the interpreter running this runner."""
    return f'"{sys.executable}" -m pip install -r requirements-local.txt'


def require_word_aligner_installed() -> None:
    """Fail before any expensive TTS work when measured timing cannot be produced."""
    try:
        import faster_whisper  # noqa: F401
    except ImportError as exc:
        raise PipelineError(
            "Automatic word-level timing requires faster-whisper, which is missing from the "
            f"Python running Zodiac Studio ({sys.executable}).\n"
            f"Install it with:\n{aligner_install_command()}"
        ) from exc


def scene_wav_path(root: Path, scene_id: str) -> Path:
    return Path(root) / ".runtime" / "tts-scenes" / f"{scene_id}.wav"


def tts_manifest_rows(production: dict, scene_ids: list[str] | None = None) -> list[dict]:
    from tools.studio_v2.voice_performance import speech_context
    wanted = set(scene_ids) if scene_ids is not None else None
    return [
        {
            "scene_id": scene["id"],
            "text": scene["voice"],
            "output": str(scene_wav_path(".", scene["id"])),
            **({"performance_context": speech_context(scene)} if speech_context(scene) else {}),
        }
        for scene in production["scenes"]
        if wanted is None or scene["id"] in wanted
    ]


def _validate_speech_rate_warning_wps(value: float) -> float:
    try:
        threshold = float(value)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("speech-rate warning threshold must be a finite number greater than zero.") from None
    if not math.isfinite(threshold) or threshold <= 0:
        raise PipelineError("speech-rate warning threshold must be a finite number greater than zero.")
    return threshold


def effective_tts_generation_config(
    *,
    mode: str,
    vieneu_url: str | None,
    backend: str,
    precision: str,
    frame_cap: str,
    max_chars: int,
) -> dict:
    """Describe settings that actually affect the generated audio."""
    if vieneu_url:
        return {
            "transport": "gradio",
            "backend": "server-managed",
            "precision": "server-managed",
            "frame_cap": None,
            "max_chars": max_chars,
        }
    if mode == "v3turbo":
        return {
            "transport": "local",
            "backend": backend,
            "precision": precision,
            "frame_cap": frame_cap == "on",
            "max_chars": max_chars,
        }
    return {
        "transport": "local",
        "backend": None,
        "precision": None,
        "frame_cap": None,
        "max_chars": max_chars,
    }


def _component_label(component: dict) -> str:
    return str((component.get("props") or {}).get("label") or "").strip().casefold()


def _select_vieneu_gradio_dependency(config: dict) -> dict:
    """Return the verified single-speaker synthesis dependency or fail closed."""
    components = {
        item.get("id"): item
        for item in config.get("components", [])
        if isinstance(item, dict) and "id" in item
    }
    trusted_name = re.compile(
        r"^(?:wrapper(?:_\d+)?|synthesize_speech(?:_with_estimate)?(?:_\d+)?)$"
    )
    matches = []
    seen_api_names = []
    for dependency in config.get("dependencies", []):
        if not isinstance(dependency, dict):
            continue
        api_name = str(dependency.get("api_name") or "").strip().lstrip("/")
        if not api_name:
            continue
        seen_api_names.append(api_name)
        if not trusted_name.fullmatch(api_name):
            continue

        input_ids = [
            component_id
            for component_id in dependency.get("inputs", [])
            if (components.get(component_id) or {}).get("type") != "state"
        ]
        labels = [_component_label(components.get(component_id) or {}) for component_id in input_ids]
        text_positions = [
            index for index, label in enumerate(labels)
            if label == "văn bản" or label == "text"
        ]
        voice_positions = [
            index for index, label in enumerate(labels)
            if label == "giọng mẫu" or label in {"voice", "preset voice"}
        ]
        output_types = {
            str((components.get(component_id) or {}).get("type") or "").casefold()
            for component_id in dependency.get("outputs", [])
        }
        if len(text_positions) != 1 or len(voice_positions) != 1 or "audio" not in output_types:
            continue

        max_chars_positions = [
            index for index, label in enumerate(labels)
            if "max chars" in label
            or ("ký tự" in label and ("chunk" in label or "đoạn" in label))
        ]
        verified = dict(dependency)
        verified["_input_ids"] = input_ids
        verified["_text_position"] = text_positions[0]
        verified["_voice_position"] = voice_positions[0]
        verified["_max_chars_position"] = (
            max_chars_positions[0] if len(max_chars_positions) == 1 else None
        )
        matches.append(verified)

    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        names = ", ".join(str(item.get("api_name")) for item in matches)
        raise PipelineError(
            "Không thể xác định duy nhất endpoint tạo giọng VieNeu Gradio; "
            f"các endpoint phù hợp: {names}."
        )
    discovered = ", ".join(sorted(set(seen_api_names))) or "không có"
    raise PipelineError(
        "Không xác định được endpoint tạo giọng VieNeu Gradio từ metadata đáng tin cậy. "
        f"Endpoint phát hiện được: {discovered}."
    )


def build_tts_diagnostics(
    production: dict,
    durations: dict[str, float],
    *,
    warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
    transport: str = "local",
    backend: str | None = None,
    precision: str | None = None,
    frame_cap: bool | None = None,
    max_chars: int | None = None,
    scene_configs: dict[str, dict] | None = None,
) -> dict:
    """Measure narration density immediately after TTS, before ASR alignment."""
    warning_wps = _validate_speech_rate_warning_wps(warning_wps)
    base_config = {
        "transport": transport,
        "backend": backend,
        "precision": precision,
        "frame_cap": frame_cap,
        "max_chars": max_chars,
    }
    scene_configs = scene_configs or {}

    scenes = []
    total_words = 0
    total_seconds = 0.0
    for scene in production.get("scenes", []):
        scene_id = str(scene.get("id", ""))
        seconds = durations.get(scene_id)
        if (
            not isinstance(seconds, (int, float))
            or not math.isfinite(float(seconds))
            or float(seconds) <= 0
        ):
            raise PipelineError(f"missing measured duration for scene {scene_id}.")
        words = len(_expected_caption_tokens(str(scene.get("voice", ""))))
        wps = words / float(seconds)
        warning = wps > warning_wps
        scenes.append(
            {
                "scene_id": scene_id,
                "word_count": words,
                "duration_seconds": round(float(seconds), 6),
                "words_per_second": round(wps, 6),
                "speech_rate_warning": warning,
                "generation": dict(scene_configs.get(scene_id) or base_config),
            }
        )
        total_words += words
        total_seconds += float(seconds)

    total_wps = total_words / total_seconds if total_seconds > 0 else 0.0
    return {
        "version": 1,
        "config": {
            **base_config,
            "warning_wps": warning_wps,
        },
        "summary": {
            "word_count": total_words,
            "duration_seconds": round(total_seconds, 6),
            "words_per_second": round(total_wps, 6),
            "speech_rate_warning": total_wps > warning_wps
            or any(item["speech_rate_warning"] for item in scenes),
        },
        "scenes": scenes,
    }


def write_tts_diagnostics(
    runtime: Path,
    diagnostics: dict,
    filename: str = "tts-diagnostics.json",
) -> Path:
    path = Path(runtime) / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(diagnostics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return path


def _emit_tts_log(text: str, log_callback=None) -> None:
    if log_callback is not None:
        log_callback(str(text))
    elif not emit_process_log(str(text), channel="stdout"):
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")
        print(str(text), flush=True)


def _print_tts_diagnostics(diagnostics: dict, log_callback=None) -> None:
    threshold = diagnostics["config"]["warning_wps"]
    for scene in diagnostics["scenes"]:
        status = "TTS_RATE_WARNING" if scene["speech_rate_warning"] else "TTS_RATE"
        _emit_tts_log(
            f"{status}: {scene['scene_id']} "
            f"{scene['duration_seconds']:.1f}s / {scene['word_count']} từ = "
            f"{scene['words_per_second']:.2f} từ/giây"
            + (
                f" > ngưỡng {threshold:.2f}"
                if scene["speech_rate_warning"]
                else ""
            ),
            log_callback,
        )
    summary = diagnostics["summary"]
    _emit_tts_log(
        f"TTS_RATE_TOTAL: {summary['duration_seconds']:.1f}s / "
        f"{summary['word_count']} từ = {summary['words_per_second']:.2f} từ/giây",
        log_callback,
    )


def run_tts_batch(
    runtime: Path,
    rows: list[dict],
    *,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
    backend: str = DEFAULT_TTS_BACKEND,
    precision: str = DEFAULT_TTS_PRECISION,
    frame_cap: str = DEFAULT_TTS_FRAME_CAP,
    frame_cap_scale: float = 1.0,
    max_chars: int = DEFAULT_TTS_MAX_CHARS,
) -> None:
    """Generate the given scene WAVs with VieNeu, in one subprocess call."""
    if not rows:
        return
    if max_chars < 32:
        raise PipelineError("--tts-max-chars must be at least 32.")
    if backend not in {"auto", "onnx", "pytorch"}:
        raise PipelineError("--tts-backend must be auto, onnx, or pytorch.")
    if precision not in {"fp32", "int8"}:
        raise PipelineError("--tts-precision must be fp32 or int8.")
    if frame_cap not in {"on", "off"}:
        raise PipelineError("--tts-frame-cap must be 'on' or 'off'.")
    try:
        frame_cap_scale = float(frame_cap_scale)
    except (TypeError, ValueError) as exc:
        raise PipelineError("frame_cap_scale must be a positive finite number.") from exc
    if not math.isfinite(frame_cap_scale) or frame_cap_scale <= 0:
        raise PipelineError("frame_cap_scale must be a positive finite number.")
    if frame_cap == "off" and not math.isclose(frame_cap_scale, 1.0):
        raise PipelineError("frame_cap_scale cannot be combined with frame-cap off.")
    if mode != "v3turbo" and (
        backend != DEFAULT_TTS_BACKEND
        or precision != DEFAULT_TTS_PRECISION
        or frame_cap != DEFAULT_TTS_FRAME_CAP
    ):
        raise PipelineError(
            "--tts-backend/--tts-precision/--tts-frame-cap chỉ áp dụng cho v3turbo."
        )
    if vieneu_url and (frame_cap == "off" or not math.isclose(frame_cap_scale, 1.0)):
        raise PipelineError(
            "frame-cap overrides cannot control an already-running Gradio server. "
            "Run VieNeu directly (omit --vieneu-url) for frame-cap diagnostics."
        )
    if mode != "v3turbo" and not math.isclose(frame_cap_scale, 1.0):
        raise PipelineError("frame_cap_scale only applies to v3turbo.")
    runtime = Path(runtime)
    scene_dir = runtime / "tts-scenes"
    scene_dir.mkdir(parents=True, exist_ok=True)
    for row in rows:
        row["output"] = str(scene_dir / f"{row['scene_id']}.wav")
    manifest = runtime / "tts-manifest.json"
    manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    python = _tts_python(Path(tts_root).expanduser().resolve(), tts_python)

    gradio_endpoint = None
    if vieneu_url:
        import urllib.request

        try:
            with urllib.request.urlopen(vieneu_url.rstrip("/") + "/config", timeout=10) as response:
                gradio_config = json.load(response)
        except Exception as exc:
            raise PipelineError(f"Không đọc được metadata VieNeu Gradio: {exc}") from exc
        gradio_endpoint = _select_vieneu_gradio_dependency(gradio_config)

    script = (
        "import json, shutil, sys, urllib.request\n"
        "from pathlib import Path\n"
        "from gradio_client import Client\n"
        "from runpy import run_path\n"
        "sys.path.insert(0, " + repr(str(Path(__file__).resolve().parents[1])) + ")\n"
        "from tools.zodiac_local import validate_voice\n"
        "feedback = run_path(" + repr(str(Path(__file__).resolve().parent / "studio" / "vieneu_client.py")) + ")\n"
        "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
        "url, voice, max_chars = sys.argv[2].rstrip('/'), sys.argv[3], int(sys.argv[4])\n"
        "api_name, text_pos, voice_pos, max_chars_pos = sys.argv[5], int(sys.argv[6]), int(sys.argv[7]), int(sys.argv[8])\n"
        "config = json.load(urllib.request.urlopen(url + '/config', timeout=10))\n"
        "components = {item['id']: item for item in config.get('components', [])}\n"
        "dep = next((d for d in config.get('dependencies', []) if str(d.get('api_name') or '').lstrip('/') == api_name), None)\n"
        "if dep is None: raise RuntimeError('Endpoint VieNeu đã thay đổi sau khi xác thực metadata: ' + api_name)\n"
        "client = Client(url, verbose=False)\n"
        "for scene_index, row in enumerate(rows, 1):\n"
        "    print('VieNeu API:', row['scene_id'], flush=True)\n"
        "    scene = dict(scene_id=row['scene_id'], scene_index=scene_index, scene_total=len(rows), completed_scenes=scene_index-1, voice=voice)\n"
        "    report = lambda message: feedback['emit_progress'](message, **scene)\n"
        "    report('Đang tạo giọng cảnh ' + row['scene_id'])\n"
        "    input_ids = [i for i in dep['inputs'] if components.get(i, {}).get('type') != 'state']\n"
        "    args = [components.get(i, {}).get('props', {}).get('value') for i in input_ids]\n"
        "    if max(text_pos, voice_pos, max_chars_pos) >= len(args): raise RuntimeError('Schema endpoint VieNeu đã thay đổi sau khi xác thực.')\n"
        "    args[text_pos], args[voice_pos] = row['text'], voice\n"
        "    if max_chars_pos >= 0: args[max_chars_pos] = max_chars\n"
        "    result = feedback['stream_speech'](client, args, api_name, report)\n"
        "    audio = result[0] if isinstance(result, (tuple, list)) else result\n"
        "    if isinstance(result, (tuple, list)) and result[0] is None: raise RuntimeError(str(result[1]))\n"
        "    if isinstance(audio, dict): audio = audio.get('path') or audio.get('name')\n"
        "    if not audio or not Path(str(audio)).is_file(): raise RuntimeError('VieNeu API không trả về file WAV: ' + str(audio))\n"
        "    validate_voice(Path(str(audio)))\n"
        "    shutil.copy2(audio, row['output'])\n"
        "    scene['completed_scenes'] = scene_index\n"
        "    report('Đã lưu WAV cảnh ' + row['scene_id'])\n"
        "    print('VieNeu DONE:', row['scene_id'], flush=True)\n"
    )
    if vieneu_url:
        _emit_tts_log("Đang tạo giọng đọc qua VieNeu Gradio…")
        _emit_tts_log("VieNeu Gradio đang quản lý backend/precision/frame-cap; "
            "các cờ đó chỉ áp dụng khi chạy direct local SDK.")
        run_args = [
            str(python), "-X", "utf8", "-c", script, str(manifest),
            vieneu_url, voice, str(max_chars),
            str(gradio_endpoint["api_name"]).lstrip("/"),
            str(gradio_endpoint["_text_position"]),
            str(gradio_endpoint["_voice_position"]),
            str(
                gradio_endpoint["_max_chars_position"]
                if gradio_endpoint["_max_chars_position"] is not None
                else -1
            ),
        ]
    else:
        script = (
            "import json, sys\n"
            "from pathlib import Path\n"
            "from vieneu import Vieneu\n"
            "from apps.user_voices import load_user_voices\n"
            "rows = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))\n"
            "mode, voice, backend, precision, frame_cap, frame_cap_scale, max_chars = sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6], float(sys.argv[7]), int(sys.argv[8])\n"
            "kwargs = {}\n"
            "if mode == 'v3turbo': kwargs.update(backend=backend, precision=precision)\n"
            "tts = Vieneu(mode=mode, **kwargs)\n"
            "load_user_voices(tts)\n"
            "if voice not in tts._preset_voices: raise ValueError('VieNeu voice not found: ' + voice)\n"
            "if mode == 'v3turbo' and frame_cap == 'off':\n"
            "    if getattr(tts, 'backend', None) != 'onnx': raise RuntimeError('frame-cap off diagnostic is supported only on v3turbo ONNX/CPU')\n"
            "    import vieneu.v3turbo as turbo_module\n"
            "    turbo_module._cap_frames = lambda sampling, cap: dict(sampling)\n"
            "    original_engine_infer = tts.engine.infer\n"
            "    def uncapped_engine_infer(*args, **kwargs):\n"
            "        kwargs['frame_cap'] = False\n"
            "        return original_engine_infer(*args, **kwargs)\n"
            "    tts.engine.infer = uncapped_engine_infer\n"
            "elif mode == 'v3turbo' and frame_cap_scale != 1.0:\n"
            "    if getattr(tts, 'backend', None) != 'onnx': raise RuntimeError('scaled frame-cap diagnostic is supported only on v3turbo ONNX/CPU')\n"
            "    import math as _math\n"
            "    import vieneu.v3turbo as turbo_module\n"
            "    import vieneu_utils.core_utils as core_utils\n"
            "    _base_max_expected_frames = core_utils.max_expected_frames\n"
            "    def _scaled_max_expected_frames(phonemes):\n"
            "        base = _base_max_expected_frames(phonemes)\n"
            "        return min(300, max(1, int(_math.ceil(base * frame_cap_scale))))\n"
            "    core_utils.max_expected_frames = _scaled_max_expected_frames\n"
            "    turbo_module.max_expected_frames = _scaled_max_expected_frames\n"
            "for row in rows:\n"
            "    print('VieNeu:', row['scene_id'], flush=True)\n"
            "    tts.save(tts.infer(row['text'], voice=voice, max_chars=max_chars), row['output'])\n"
        )
        actual = effective_tts_generation_config(
            mode=mode,
            vieneu_url=None,
            backend=backend,
            precision=precision,
            frame_cap=frame_cap,
            max_chars=max_chars,
        )
        _emit_tts_log(f"Đang tạo giọng bằng VieNeu direct: mode={mode}, "
            f"backend={actual['backend'] or 'n/a'}, "
            f"precision={actual['precision'] or 'n/a'}, "
            f"frame_cap={actual['frame_cap'] if actual['frame_cap'] is not None else 'n/a'}, "
            f"frame_cap_scale={frame_cap_scale:.2f}, "
            f"max_chars={max_chars}…")
        run_args = [
            str(python), "-X", "utf8", "-c", script, str(manifest),
            mode, voice, backend, precision, frame_cap, str(frame_cap_scale), str(max_chars),
        ]
    try:
        run_managed_subprocess(run_args, cwd=tts_root, check=True)
    except FileNotFoundError as exc:
        raise PipelineError(f"cannot start VieNeu Python: {exc}") from exc
    except subprocess.CalledProcessError as exc:
        raise PipelineError(f"VieNeu synthesis failed with exit code {exc.returncode}.")


def generate_scene_voices(
    package_root: Path,
    production: dict,
    scene_ids: list[str] | None = None,
    *,
    tts_root: Path = DEFAULT_TTS_ROOT,
    tts_python: Path | None = None,
    voice: str = DEFAULT_TTS_VOICE,
    mode: str = "v3turbo",
    vieneu_url: str | None = None,
    backend: str = DEFAULT_TTS_BACKEND,
    precision: str = DEFAULT_TTS_PRECISION,
    frame_cap: str = DEFAULT_TTS_FRAME_CAP,
    max_chars: int = DEFAULT_TTS_MAX_CHARS,
    speech_rate_warning_wps: float = DEFAULT_SPEECH_RATE_WARNING_WPS,
    fp32_fallback_on_rate_warning: bool = True,
    log_callback=None,
) -> dict[str, float]:
    """Generate selected WAVs once; WPS is diagnostic, never a batch retry trigger."""
    speech_rate_warning_wps = _validate_speech_rate_warning_wps(
        speech_rate_warning_wps
    )
    root = Path(package_root).resolve()
    rows = tts_manifest_rows(production, scene_ids)
    if any(row.get("performance_context") for row in rows):
        from tools.studio_v2.voice_performance import performance_report
        runtime = root / ".runtime"
        runtime.mkdir(parents=True, exist_ok=True)
        (runtime / "voice-performance.json").write_text(
            json.dumps(performance_report(production), ensure_ascii=False, indent=2)+"\n",
            encoding="utf-8",
        )
        _emit_tts_log("VOICE_DIRECTION_REVIEW_REQUIRED: VieNeu hiện chỉ nhận text/voice; "
                      "chỉ dẫn nhịp chưa được kiểm chứng bằng âm thanh. Nghe các take thực tế.", log_callback)
    run_tts_batch(
        root / ".runtime",
        rows,
        tts_root=tts_root,
        tts_python=tts_python,
        voice=voice,
        mode=mode,
        vieneu_url=vieneu_url,
        backend=backend,
        precision=precision,
        frame_cap=frame_cap,
        max_chars=max_chars,
    )

    durations: dict[str, float] = {}
    for scene in production["scenes"]:
        scene_id = scene["id"]
        path = scene_wav_path(root, scene_id)
        try:
            validate_voice(path)
        except PipelineError as exc:
            raise PipelineError(f"Scene {scene_id}: {exc}") from exc
        durations[scene_id] = _wav_duration_seconds(path)

    applied_config = effective_tts_generation_config(
        mode=mode,
        vieneu_url=vieneu_url,
        backend=backend,
        precision=precision,
        frame_cap=frame_cap,
        max_chars=max_chars,
    )
    diagnostics = build_tts_diagnostics(
        production,
        durations,
        warning_wps=speech_rate_warning_wps,
        **applied_config,
    )
    warning_ids = [
        item["scene_id"]
        for item in diagnostics["scenes"]
        if item["speech_rate_warning"]
        and item["scene_id"] in {row["scene_id"] for row in rows}
    ]
    if warning_ids:
        diagnostics["rate_policy"] = {
            "action": "warning_only",
            "reason": (
                "speech rate alone is not evidence of missing narration; "
                "alignment decides whether a scene-level retry is justified"
            ),
            "scene_ids": warning_ids,
        }
    write_tts_diagnostics(root / ".runtime", diagnostics)
    _print_tts_diagnostics(diagnostics, log_callback)
    if warning_ids and fp32_fallback_on_rate_warning:
        _emit_tts_log(
            "TTS_RATE_NOTICE: tốc độ cao chỉ được ghi cảnh báo; "
            "không sinh lại cả batch. Alignment sẽ quyết định retry theo từng scene.",
            log_callback,
        )
    return durations


def scene_voice_files(package_root: Path, production: dict) -> list[Path]:
    return [scene_wav_path(package_root, scene["id"]) for scene in production["scenes"]]


def concatenate_scene_voices(
    package_root: Path,
    production: dict,
    *,
    scene_gap_ms: float = 0.0,
    sentence_pause_ms: float = 0.0,
    timing: dict | None = None,
) -> Path:
    """Compose final voice.wav from cached scene WAVs with explicit breathing pauses."""
    root = Path(package_root).resolve()
    inputs = scene_voice_files(root, production)
    output = root / "voice.wav"

    if sentence_pause_ms <= 0 or timing is None:
        concatenate_wavs(inputs, output, gap_ms=scene_gap_ms)
        return output

    try:
        sentence_pause_ms = float(sentence_pause_ms)
        scene_gap_ms = float(scene_gap_ms)
    except (TypeError, ValueError, OverflowError):
        raise PipelineError("pacing pauses must be finite non-negative numbers.") from None
    if not math.isfinite(sentence_pause_ms) or not 0 <= sentence_pause_ms <= 3000:
        raise PipelineError("sentence pause must be between 0 and 3000 ms.")
    if not math.isfinite(scene_gap_ms) or not 0 <= scene_gap_ms <= 5000:
        raise PipelineError("scene gap must be between 0 and 5000 ms.")

    rows = timing.get("scenes") if isinstance(timing, dict) else None
    if not isinstance(rows, list) or len(rows) != len(production.get("scenes", [])):
        raise PipelineError("timing rows are required to compose sentence pauses.")
    fps = timing.get("fps")
    if not isinstance(fps, (int, float)) or fps <= 0:
        raise PipelineError("timing fps is invalid for sentence pause composition.")

    output.parent.mkdir(parents=True, exist_ok=True)
    params = None
    with wave.open(str(output), "wb") as destination:
        for scene_index, (scene, source_path, row) in enumerate(
            zip(production["scenes"], inputs, rows)
        ):
            try:
                with wave.open(str(source_path), "rb") as source:
                    if source.getcomptype() != "NONE":
                        raise PipelineError(f"scene WAV is compressed: {source_path}")
                    current = source.getparams()
                    if params is None:
                        params = current
                        destination.setnchannels(current.nchannels)
                        destination.setsampwidth(current.sampwidth)
                        destination.setframerate(current.framerate)
                        destination.setcomptype("NONE", "not compressed")
                    elif current[:3] != params[:3]:
                        raise PipelineError("scene WAV files do not share one PCM format.")

                    frame_bytes = current.sampwidth * current.nchannels
                    raw = source.readframes(source.getnframes())
                    pause_after = sorted(_sentence_pause_after_indices(scene["voice"]))
                    captions = row.get("captions")
                    if not isinstance(captions, list):
                        raise PipelineError(f"timing captions missing for {scene['id']}.")
                    expected = _expected_caption_tokens(scene["voice"])
                    if len(captions) != len(expected):
                        raise PipelineError(
                            f"timing captions do not cover sentence pauses for {scene['id']}."
                        )

                    scene_start_ms = float(row["start_frame"]) * 1000.0 / float(fps)
                    cursor_frame = 0
                    for pause_number, token_index in enumerate(pause_after):
                        adjusted_end_ms = float(captions[token_index]["endMs"]) - scene_start_ms
                        source_end_ms = adjusted_end_ms - (
                            pause_number * sentence_pause_ms
                        )
                        boundary_frame = round(
                            source_end_ms * current.framerate / 1000.0
                        )
                        boundary_frame = min(
                            max(boundary_frame, cursor_frame),
                            source.getnframes(),
                        )
                        destination.writeframes(
                            raw[cursor_frame * frame_bytes : boundary_frame * frame_bytes]
                        )
                        silent_frames = round(
                            current.framerate * sentence_pause_ms / 1000.0
                        )
                        silent_sample = (
                            b"\x80"
                            if current.sampwidth == 1
                            else b"\x00" * current.sampwidth
                        )
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
                        cursor_frame = boundary_frame

                    destination.writeframes(raw[cursor_frame * frame_bytes :])

                    if scene_index < len(inputs) - 1 and scene_gap_ms > 0:
                        silent_frames = round(
                            current.framerate * scene_gap_ms / 1000.0
                        )
                        silent_sample = (
                            b"\x80"
                            if current.sampwidth == 1
                            else b"\x00" * current.sampwidth
                        )
                        destination.writeframes(
                            silent_sample * current.nchannels * silent_frames
                        )
            except (wave.Error, EOFError, OSError) as exc:
                raise PipelineError(f"cannot read scene WAV {source_path}: {exc}") from exc
    return output


def _wav_duration_seconds(path: Path) -> float:
    with wave.open(str(path), "rb") as wav:
        return wav.getnframes() / wav.getframerate()

