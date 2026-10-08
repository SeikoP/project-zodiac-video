from __future__ import annotations

import ctypes
import json
import os
from pathlib import Path
from typing import Any


def _total_memory_mb() -> int | None:
    if os.name != "nt":
        return None

    class MemoryStatusEx(ctypes.Structure):
        _fields_ = [
            ("dwLength", ctypes.c_ulong),
            ("dwMemoryLoad", ctypes.c_ulong),
            ("ullTotalPhys", ctypes.c_ulonglong),
            ("ullAvailPhys", ctypes.c_ulonglong),
            ("ullTotalPageFile", ctypes.c_ulonglong),
            ("ullAvailPageFile", ctypes.c_ulonglong),
            ("ullTotalVirtual", ctypes.c_ulonglong),
            ("ullAvailVirtual", ctypes.c_ulonglong),
            ("ullAvailExtendedVirtual", ctypes.c_ulonglong),
        ]

    status = MemoryStatusEx()
    status.dwLength = ctypes.sizeof(status)
    if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
        return None
    return int(status.ullTotalPhys // (1024 * 1024))


def load_resource_profile(workspace: Path) -> dict[str, Any]:
    path = Path(workspace) / ".runtime" / "resource-profile.json"
    logical_cpu = max(1, os.cpu_count() or 1)
    memory_mb = _total_memory_mb()
    try:
        profile = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        profile = None
    if profile is None:
        profile = {
            "version": 1,
            "profile_source": "safe-fallback",
            "logical_cpu": logical_cpu,
            "memory_budget_mb": int(memory_mb * 0.6) if memory_mb else 0,
            "heavy_cpu_slots": 1,
            "tts_slots": 1,
            "whisper_workers": 1,
            "whisper_cpu_threads": min(4, logical_cpu),
            "remotion_concurrency": min(4, logical_cpu),
        }
        path.parent.mkdir(parents=True, exist_ok=True)
        temp = path.with_suffix(".json.tmp")
        temp.write_text(json.dumps(profile, indent=2) + "\n", encoding="utf-8")
        os.replace(temp, path)
    if not isinstance(profile, dict) or profile.get("version") != 1:
        raise ValueError("resource profile must be a version 1 object")
    for key in (
        "logical_cpu", "memory_budget_mb", "heavy_cpu_slots", "tts_slots",
        "whisper_workers", "whisper_cpu_threads", "remotion_concurrency",
    ):
        if not isinstance(profile.get(key), int) or profile[key] < 0:
            raise ValueError(f"resource profile field {key} must be a non-negative integer")
    for key in (
        "logical_cpu", "heavy_cpu_slots", "tts_slots", "whisper_workers",
        "whisper_cpu_threads", "remotion_concurrency",
    ):
        if profile[key] < 1:
            raise ValueError(f"resource profile field {key} must be at least one")
    if profile["logical_cpu"] > logical_cpu:
        raise ValueError("resource profile logical_cpu exceeds this host")
    if memory_mb and profile["memory_budget_mb"] > memory_mb:
        raise ValueError("resource profile memory budget exceeds this host")
    if profile["heavy_cpu_slots"] < 1:
        raise ValueError("resource profile must reserve at least one heavy CPU slot")
    if profile["tts_slots"] > profile["heavy_cpu_slots"]:
        raise ValueError("TTS slots exceed the shared heavy CPU budget")
    if profile["whisper_workers"] * profile["whisper_cpu_threads"] > profile["logical_cpu"]:
        raise ValueError("Whisper workers and CPU threads oversubscribe the host")
    if profile["remotion_concurrency"] > profile["logical_cpu"]:
        raise ValueError("Remotion concurrency exceeds the host logical CPU count")
    return profile
