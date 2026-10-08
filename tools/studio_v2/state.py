from __future__ import annotations

import json
import os
from pathlib import Path

from .pipeline import PipelineStateV2


def state_path(workspace: Path) -> Path:
    return Path(workspace) / ".runtime" / "studio-v2-state.json"


def save_state(workspace: Path, state: PipelineStateV2) -> None:
    path = state_path(workspace)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "version": 2,
        "workspace_id": state.workspace_id,
        "package": state.package.__dict__,
        "steps": {
            name: {
                "status": step.status,
                "input_hash": step.input_hash,
                "output_hash": step.output_hash,
                "reused": step.reused,
                "cache_reason": step.cache_reason,
                "error": step.error,
            }
            for name, step in state.steps.items()
        },
    }
    temp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)


def load_state(workspace: Path) -> PipelineStateV2 | None:
    path = state_path(workspace)
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return None
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("version") != 2:
        return None

    workspace_id = str(payload.get("workspace_id") or Path(workspace).name)
    state = PipelineStateV2(workspace_id=workspace_id)

    package = payload.get("package")
    if isinstance(package, dict):
        display_name = package.get("display_name")
        package_hash = package.get("package_hash")
        package_version = package.get("package_version")
        if all(isinstance(value, str) for value in (display_name, package_hash, package_version)):
            state.set_package_revision(
                display_name=display_name,
                package_hash=package_hash,
                package_version=package_version,
            )

    raw_steps = payload.get("steps")
    if isinstance(raw_steps, dict):
        for name, raw in raw_steps.items():
            if name not in state.steps or not isinstance(raw, dict):
                continue
            step = state.steps[name]
            step.status = str(raw.get("status") or step.status)
            step.input_hash = raw.get("input_hash")
            step.output_hash = raw.get("output_hash")
            step.reused = bool(raw.get("reused", False))
            reason = raw.get("cache_reason")
            step.cache_reason = str(reason) if reason is not None else None
            error = raw.get("error")
            step.error = dict(error) if isinstance(error, dict) else None
    return state
