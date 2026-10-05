#!/usr/bin/env python3
"""EditorDocument: the only layer that mutates production.json."""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

from tools.zodiac_local import validate_production_document

SAFE_EDIT_TYPES = ("transform", "layer", "visible")


class EditorError(Exception):
    """A blocked edit, a blocked save, or a conflicting production.json."""


@dataclass(frozen=True)
class Placement:
    """One entity state as the canvas sees it."""

    scene_id: str
    entity_id: str
    state_id: str
    kind: str
    asset: str | None
    primitive: str | None
    x: float
    y: float
    width: float
    height: float
    layer: float
    visible: bool

    @property
    def source_id(self) -> str:
        return self.asset if self.asset else str(self.primitive)


def _canonical(production: dict) -> str:
    return json.dumps(production, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


class EditorDocument:
    """Loads a v2 package, edits a working copy, saves atomically."""

    def __init__(self, package_root: Path) -> None:
        self.root = Path(package_root).resolve()
        self.path = self.root / "production.json"
        if not self.path.is_file():
            raise EditorError(f"Không tìm thấy production.json: {self.path}")
        self.load()

    def load(self) -> None:
        """(Re)read production.json into a fresh working copy."""
        try:
            working = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise EditorError(f"Không đọc được production.json: {exc}") from exc
        if not isinstance(working, dict):
            raise EditorError("production.json phải chứa một JSON object.")
        self.working = working
        self._original = json.loads(_canonical(working))
        self._disk = self._disk_signature()

    # ---- state -------------------------------------------------------
    @property
    def is_dirty(self) -> bool:
        return _canonical(self.working) != _canonical(self._original)

    @property
    def status_text(self) -> str:
        return "Unsaved changes" if self.is_dirty else "Saved"

    @property
    def video(self) -> dict:
        video = self.working.get("video")
        return video if isinstance(video, dict) else {}

    @property
    def safe_area(self) -> dict | None:
        style = self.working.get("caption_style")
        area = style.get("safe_area") if isinstance(style, dict) else None
        if isinstance(area, dict) and all(
            isinstance(area.get(key), (int, float)) for key in ("x", "y", "width", "height")
        ):
            return area
        token = (self.working.get("visual_system") or {}).get("style_token") or {}
        area = token.get("safe_zone")
        return area if isinstance(area, dict) else None

    @property
    def scene_ids(self) -> list[str]:
        scenes = self.working.get("scenes")
        return [scene["id"] for scene in scenes if isinstance(scene, dict) and isinstance(scene.get("id"), str)]

    def scene(self, scene_id: str) -> dict:
        for scene in self.working.get("scenes", []):
            if isinstance(scene, dict) and scene.get("id") == scene_id:
                return scene
        raise EditorError(f"Không tìm thấy scene: {scene_id}")

    def entity(self, scene_id: str, entity_id: str) -> dict:
        for entity in self.scene(scene_id).get("entities", []):
            if isinstance(entity, dict) and entity.get("id") == entity_id:
                return entity
        raise EditorError(f"Không tìm thấy entity {entity_id} trong scene {scene_id}")

    def state(self, scene_id: str, entity_id: str, state_id: str | None = None) -> dict:
        entity = self.entity(scene_id, entity_id)
        states = entity.get("states")
        if not isinstance(states, dict):
            raise EditorError(f"Entity {entity_id} không có states.")
        key = state_id or entity.get("initial_state")
        state = states.get(key)
        if not isinstance(state, dict):
            raise EditorError(f"Không tìm thấy state {key} của {entity_id}.")
        return state

    def placements(self, scene_id: str) -> list[Placement]:
        """Every entity state of one scene, back layer first."""
        result = []
        for entity in self.scene(scene_id).get("entities", []):
            if not isinstance(entity, dict):
                continue
            entity_id = entity.get("id")
            state_id = entity.get("initial_state")
            states = entity.get("states") if isinstance(entity.get("states"), dict) else {}
            state = states.get(state_id) if isinstance(states, dict) else None
            if not isinstance(state, dict):
                continue
            transform = state.get("transform") if isinstance(state.get("transform"), dict) else {}
            result.append(
                Placement(
                    scene_id=scene_id,
                    entity_id=entity_id,
                    state_id=state_id,
                    kind=str(entity.get("kind") or ""),
                    asset=state.get("asset"),
                    primitive=state.get("primitive"),
                    x=float(transform.get("x", 0)),
                    y=float(transform.get("y", 0)),
                    width=float(transform.get("width", 0)),
                    height=float(transform.get("height", 0)),
                    layer=float(state.get("layer", 0)),
                    visible=bool(state.get("visible", True)),
                )
            )
        return sorted(result, key=lambda placement: placement.layer)

    # ---- edits -------------------------------------------------------
    def set_transform(self, scene_id: str, entity_id: str, state_id: str | None = None, **values) -> dict:
        state = self.state(scene_id, entity_id, state_id)
        transform = state.setdefault("transform", {})
        for key in ("x", "y", "width", "height"):
            if key in values:
                transform[key] = values[key]
        return transform

    def set_layer(self, scene_id: str, entity_id: str, layer: float, state_id: str | None = None) -> None:
        self.state(scene_id, entity_id, state_id)["layer"] = layer

    def set_visible(self, scene_id: str, entity_id: str, visible: bool, state_id: str | None = None) -> None:
        self.state(scene_id, entity_id, state_id)["visible"] = bool(visible)

    # ---- persistence --------------------------------------------------
    def _disk_signature(self) -> tuple[int, str]:
        try:
            payload = self.path.read_bytes()
        except OSError as exc:
            raise EditorError(f"Không đọc được production.json: {exc}") from exc
        return (
            self.path.stat().st_mtime_ns,
            hashlib.sha256(payload).hexdigest(),
        )

    def revert(self) -> None:
        self.load()

    def acknowledge_disk_change(self) -> None:
        """Accept the current on-disk file after an explicit overwrite choice."""
        self._disk = self._disk_signature()

    def validate(self) -> None:
        """Validate the working copy with the canonical v2 validator."""
        try:
            validate_production_document(self.root, self.working)
        except Exception as exc:  # PipelineError and friends
            raise EditorError(f"Save blocked:\n{exc}") from exc

    def save(self) -> None:
        """Validate, then replace production.json atomically."""
        if self._disk_signature() != self._disk:
            raise EditorError(
                "production.json changed on disk outside the Editor.\n"
                "Reload or overwrite explicitly before saving."
            )
        self.validate()

        handle, temporary = tempfile.mkstemp(
            dir=str(self.root),
            prefix="production.json.",
            suffix=".tmp",
        )
        os.close(handle)
        temporary_path = Path(temporary)
        try:
            temporary_path.write_text(
                json.dumps(self.working, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            os.replace(temporary_path, self.path)
        except OSError as exc:
            raise EditorError(f"Không ghi được production.json: {exc}") from exc
        finally:
            temporary_path.unlink(missing_ok=True)

        self._original = json.loads(_canonical(self.working))
        self._disk = self._disk_signature()