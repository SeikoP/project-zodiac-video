"""Collect observed Zodiac Phase 02 metrics. Never estimate missing measurements."""
from __future__ import annotations
import argparse
import json
from pathlib import Path


def collect(workspace: Path, job_zip: Path | None = None) -> dict:
    receipt = workspace / ".authoring" / "phase02-execution-receipt.json"
    if not receipt.is_file():
        raise FileNotFoundError(f"Missing actual execution receipt: {receipt}")
    data = json.loads(receipt.read_text(encoding="utf-8"))
    if data.get("format") != "zodiac-phase02-execution@1":
        raise ValueError("Unexpected receipt format")
    steps = data.get("steps", [])
    elapsed = [s.get("elapsed_ms") for s in steps if s.get("status") == "PASS"]
    complete_timing = bool(elapsed) and all(isinstance(x, (int, float)) and x >= 0 for x in elapsed)
    zip_bytes = job_zip.stat().st_size if job_zip and job_zip.is_file() else None
    return {
        "format": "zodiac-observed-performance@1",
        "source_fingerprint": data.get("source", {}).get("fingerprint"),
        "run_id": data.get("run_id"),
        "workflow_status": data.get("status"),
        "source_receipt": str(receipt),
        "measurement_status": "PARTIAL_OBSERVED",
        "measurements": {
            "step_wall_ms": {s["id"]: s.get("elapsed_ms") for s in steps},
            "total_compiler_wall_ms": sum(elapsed) if complete_timing else None,
            "executed_steps": sum(s.get("status") == "PASS" for s in steps),
            "cache_hits": sum(s.get("status") == "SKIPPED_REUSED" for s in steps),
            "failed_steps": sum(s.get("status") in {"FAIL", "BLOCKED"} for s in steps),
            "zip_bytes": zip_bytes,
            "context_bytes": None,
            "final_render_ms": None,
            "voice_tail_ms": None,
            "end_to_end_media_acceptance": None,
        },
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--workspace", type=Path, required=True)
    p.add_argument("--zip", type=Path)
    p.add_argument("--output", type=Path, required=True)
    args = p.parse_args()
    output = collect(args.workspace, args.zip)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": "MEASURED_PARTIAL", "output": str(args.output)}))


if __name__ == "__main__":
    main()
