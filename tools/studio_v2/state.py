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
                "error": step.error,
            }
            for name, step in state.steps.items()
        },
    }
    temp = path.with_suffix(path.suffix + f".{os.getpid()}.tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.replace(temp, path)
