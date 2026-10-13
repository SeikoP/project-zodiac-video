from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path


FORMAT = "zodiac-studio-checklist@1"
SIGN_LABELS = {
    "aries": "Bạch Dương",
    "taurus": "Kim Ngưu",
    "gemini": "Song Tử",
    "cancer": "Cự Giải",
    "leo": "Sư Tử",
    "virgo": "Xử Nữ",
    "libra": "Thiên Bình",
    "scorpio": "Bọ Cạp",
    "sagittarius": "Nhân Mã",
    "capricorn": "Ma Kết",
    "aquarius": "Bảo Bình",
    "pisces": "Song Ngư",
}
PHASE_STATUSES = {"LOCKED", "READY", "IN_PROGRESS", "IN_REVIEW", "PASS", "BLOCKED", "SKIPPED_REUSED"}
STEP_STATUSES = {"LOCKED", "READY", "IN_PROGRESS", "PASS", "BLOCKED", "SKIPPED_REUSED"}


def new_checklist_config() -> dict:
    return {"format": FORMAT, "workspaces": [], "series_tracker_path": None, "cover_visible": True}


def _validate_config(config: object) -> dict:
    if not isinstance(config, dict) or config.get("format") != FORMAT:
        raise ValueError("Unsupported Studio checklist preferences format")
    workspaces = config.get("workspaces")
    if not isinstance(workspaces, list):
        raise ValueError("Checklist workspaces must be a list")
    paths = set()
    for item in workspaces:
        if not isinstance(item, dict) or not isinstance(item.get("path"), str) or not item["path"].strip():
            raise ValueError("Each checklist workspace must have a path")
        job_id = item.get("job_id")
        if job_id is not None and (not isinstance(job_id, str) or not job_id.strip()):
            raise ValueError("A linked Job@5 ID must be a non-empty string")
        key = os.path.normcase(os.path.abspath(os.path.expanduser(item["path"])))
        if key in paths:
            raise ValueError("Checklist workspace paths must be unique")
        paths.add(key)
    tracker = config.get("series_tracker_path")
    if tracker is not None and (not isinstance(tracker, str) or not tracker.strip()):
        raise ValueError("Series tracker path must be a non-empty string or null")
    if type(config.get("cover_visible")) is not bool:
        raise ValueError("Cover visibility must be boolean")
    return config


def load_checklist_config(path: Path) -> tuple[dict, str | None]:
    if not path.exists():
        return new_checklist_config(), None
    try:
        return _validate_config(json.loads(path.read_text(encoding="utf-8"))), None
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        return new_checklist_config(), f"Studio checklist preferences are invalid: {exc}"


def save_checklist_config(path: Path, config: dict) -> None:
    _validate_config(config)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="\n", dir=path.parent, prefix=f".{path.name}.", suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(config, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def _read_json(path: Path, description: str) -> tuple[dict | None, str | None]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(value, dict):
            raise ValueError("expected an object")
        return value, None
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError) as exc:
        return None, f"{description}: {exc}"


def _load_phase_manifests(plugin_root: Path) -> tuple[dict, dict, str | None]:
    plugin_root = Path(plugin_root)
    skill_root = plugin_root / "skills" / "zodiac-video-pipeline"
    orchestration = skill_root / "orchestration"
    plugin, error = _read_json(plugin_root / "plugin.json", "Plugin manifest is unavailable or invalid")
    if error:
        return {}, {}, error
    index, error = _read_json(orchestration / "phase-index.json", "Plugin phase index is unavailable or invalid")
    if error:
        return {}, {}, error
    if index.get("format") != "zodiac-phase-index@2" or not isinstance(index.get("phases"), list):
        return {}, {}, "Unsupported plugin phase index"
    manifests = {}
    try:
        base = orchestration.resolve()
        for item in index["phases"]:
            if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not isinstance(item.get("manifest"), str):
                raise ValueError("Invalid phase index entry")
            manifest_path = (orchestration / item["manifest"]).resolve()
            if not manifest_path.is_relative_to(base):
                raise ValueError("Phase manifest escapes the plugin orchestration directory")
            manifest, error = _read_json(manifest_path, f"Phase manifest {item['id']} is unavailable or invalid")
            if error:
                raise ValueError(error)
            if manifest.get("format") != "zodiac-phase-manifest@2" or manifest.get("id") != item["id"] or not isinstance(manifest.get("title"), str):
                raise ValueError(f"Unsupported or mismatched phase manifest {item['id']}")
            steps = manifest.get("steps")
            if not isinstance(steps, list) or any(not isinstance(step, dict) or not isinstance(step.get("id"), str) or not isinstance(step.get("title"), str) for step in steps):
                raise ValueError(f"Invalid steps in phase manifest {item['id']}")
            if item["id"] in manifests:
                raise ValueError(f"Duplicate phase ID {item['id']}")
            manifests[item["id"]] = manifest
    except (OSError, ValueError) as exc:
        return plugin, {}, str(exc)
    if not isinstance(plugin.get("version"), str) or not plugin["version"].strip():
        return plugin, {}, "Plugin manifest has no version"
    return plugin, manifests, None


def load_episode_row(workspace: Path, plugin_root: Path, linked_job: Path | None = None) -> dict:
    workspace = Path(workspace).expanduser().resolve()
    result = {
        "workspace": str(workspace),
        "episode_id": None,
        "members": [],
        "title": None,
        "topic": None,
        "concept": None,
        "phase": None,
        "step": None,
        "job_id": None,
        "cover_path": None,
        "diagnostics": [],
    }
    plugin, manifests, error = _load_phase_manifests(Path(plugin_root))
    if error:
        result["diagnostics"].append(error)
    state_path = workspace / ".authoring" / "pipeline-state.json"
    state, error = _read_json(state_path, "Pipeline state is missing or invalid")
    if error:
        result["diagnostics"].append(error)
    elif not error and manifests:
        if state.get("format") != "zodiac-pipeline-state@2":
            result["diagnostics"].append("Unsupported pipeline state format")
        elif state.get("plugin_version") != plugin.get("version"):
            result["diagnostics"].append(f"Plugin version mismatch: state {state.get('plugin_version')!r}, installed {plugin.get('version')!r}")
        else:
            phase_id = state.get("current_phase")
            manifest = manifests.get(phase_id) if isinstance(phase_id, str) else None
            phase_state = state.get("phases", {}).get(phase_id) if isinstance(state.get("phases"), dict) else None
            phase_status = phase_state.get("status") if isinstance(phase_state, dict) else None
            step_id = phase_state.get("current_step") if isinstance(phase_state, dict) else None
            step = next((item for item in manifest.get("steps", []) if item.get("id") == step_id), None) if manifest and isinstance(step_id, str) else None
            step_state = phase_state.get("steps", {}).get(step_id) if isinstance(phase_state, dict) and isinstance(phase_state.get("steps"), dict) else None
            step_status = step_state.get("status") if isinstance(step_state, dict) else None
            if not manifest or not isinstance(phase_status, str) or phase_status not in PHASE_STATUSES or not step or not isinstance(step_status, str) or step_status not in STEP_STATUSES:
                result["diagnostics"].append("Pipeline state has an unsupported phase, step, or status")
            else:
                result["phase"] = {"id": phase_id, "title": manifest["title"], "status": phase_status}
                result["step"] = {"id": step_id, "title": step["title"], "status": step_status}

    scope, error = _read_json(workspace / ".authoring" / "episode-scope.json", "Episode scope is missing or invalid")
    if error:
        result["diagnostics"].append(error)
    elif scope.get("format") != "zodiac-episode-scope@1":
        result["diagnostics"].append("Unsupported episode scope format")
    else:
        members = scope.get("member_ids")
        limits = {"single_sign": (1, 1), "element_group": (3, 3), "ranked_shortlist": (2, 5), "comparison": (2, 4)}
        valid_members = isinstance(members, list) and bool(members) and all(isinstance(member, str) and member in SIGN_LABELS for member in members)
        valid_scope = (
            isinstance(scope.get("episode_id"), str)
            and re.fullmatch(r"[a-z0-9][a-z0-9-]{0,39}", scope["episode_id"]) is not None
            and isinstance(scope.get("episode_format"), str)
            and scope["episode_format"] in limits
            and valid_members
            and len(set(members)) == len(members)
            and limits[scope["episode_format"]][0] <= len(members) <= limits[scope["episode_format"]][1]
            and all(isinstance(scope.get(key), str) and scope[key].strip() for key in ("title_working", "topic_question", "selection_reason"))
        )
        if not valid_scope:
            result["diagnostics"].append("Episode scope is incomplete or unsupported")
        else:
            result["episode_id"] = scope["episode_id"]
            result["members"] = [{"id": member, "label": SIGN_LABELS[member]} for member in members]
            result["title"] = scope["title_working"]
            result["topic"] = scope["topic_question"]
            narrative, narrative_error = _read_json(workspace / ".authoring" / "narrative-plan.json", "Narrative plan is invalid")
            candidates, candidates_error = _read_json(workspace / ".authoring" / "concept-candidates.json", "Concept candidates are invalid")
            if narrative_error and (workspace / ".authoring" / "narrative-plan.json").exists():
                result["diagnostics"].append(narrative_error)
            if candidates_error and (workspace / ".authoring" / "concept-candidates.json").exists():
                result["diagnostics"].append(candidates_error)
            if narrative and candidates:
                selected_id = narrative.get("selected_concept_id")
                selected_candidate_id = candidates.get("selected_candidate_id")
                candidate = next((item for item in candidates.get("candidates", []) if isinstance(item, dict) and item.get("id") == selected_id), None) if isinstance(candidates.get("candidates"), list) else None
                if candidates.get("format") == "zodiac-concept-competition@1" and selected_id == selected_candidate_id and candidate and isinstance(candidate.get("premise"), str) and candidate["premise"].strip():
                    result["concept"] = candidate["premise"]
                elif selected_id or selected_candidate_id:
                    result["diagnostics"].append("Concept selection is incomplete or inconsistent; shown as Chưa chốt")

    if linked_job is not None:
        job = Path(linked_job).expanduser().resolve()
        result["job_id"] = job.name
        if not job.is_dir():
            result["diagnostics"].append(f"Linked Job@5 is missing: {job}")
        else:
            cover = job / "out" / "cover.png"
            if cover.is_file():
                result["cover_path"] = str(cover)
            else:
                result["diagnostics"].append("Linked Job@5 has no rendered out/cover.png")
    if not workspace.is_dir():
        result["diagnostics"].insert(0, f"Workspace is missing: {workspace}")
    return result


def load_series_tracker(path: Path) -> dict:
    result = {"signs": [], "done": 0, "todo": 0, "diagnostic": None}
    tracker, error = _read_json(Path(path), "Series tracker is missing or invalid")
    if error:
        result["diagnostic"] = error
        return result
    signs = tracker.get("signs") if isinstance(tracker, dict) else None
    if tracker.get("format") != "zodiac-series-checklist@1" or not isinstance(signs, list):
        result["diagnostic"] = "Unsupported series tracker format"
        return result
    ids = [item.get("id") for item in signs if isinstance(item, dict)]
    if (
        len(signs) != len(SIGN_LABELS)
        or len(ids) != len(signs)
        or not all(isinstance(sign_id, str) for sign_id in ids)
        or set(ids) != set(SIGN_LABELS)
        or len(set(ids)) != len(ids)
        or any(not isinstance(item.get("status"), str) or item["status"] not in {"done", "todo"} for item in signs)
    ):
        result["diagnostic"] = "Series tracker must contain 12 unique Zodiac IDs with done or todo status"
        return result
    result["signs"] = [{"id": item["id"], "label": SIGN_LABELS[item["id"]], "status": item["status"]} for item in signs]
    result["done"] = sum(item["status"] == "done" for item in signs)
    result["todo"] = sum(item["status"] == "todo" for item in signs)
    return result
