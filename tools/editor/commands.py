#!/usr/bin/env python3
"""Command abstraction so undo/redo can grow with the editor."""

from __future__ import annotations

from tools.editor.document import EditorDocument

TRANSFORM_FIELDS = ("x", "y", "width", "height")
STATE_FIELDS = TRANSFORM_FIELDS + ("layer", "visible")


class StateCommand:
    """One reversible write of production transform/layer/visible fields."""

    def __init__(
        self,
        document: EditorDocument,
        scene_id: str,
        entity_id: str,
        label: str,
        state_id: str | None = None,
    ) -> None:
        self.document = document
        self.scene_id = scene_id
        self.entity_id = entity_id
        self.state_id = state_id
        self.label = label
        self.before: dict = {}
        self.after: dict = {}

    def begin(self, after: dict, before: dict | None = None) -> "StateCommand":
        """Declare the intended new values; snapshot before values when not given."""
        self.before = self._read() if before is None else dict(before)
        self.after = dict(after)
        return self

    def _read(self) -> dict:
        state = self.document.state(self.scene_id, self.entity_id, self.state_id)
        transform = state.get("transform") if isinstance(state.get("transform"), dict) else {}
        values = {key: transform.get(key) for key in TRANSFORM_FIELDS}
        values["layer"] = state.get("layer")
        values["visible"] = state.get("visible")
        return values

    def _write(self, values: dict) -> None:
        state = self.document.state(self.scene_id, self.entity_id, self.state_id)
        transform = state.setdefault("transform", {})
        for key in TRANSFORM_FIELDS:
            if values.get(key) is not None:
                transform[key] = values[key]
        if values.get("layer") is not None:
            state["layer"] = values["layer"]
        if values.get("visible") is not None:
            state["visible"] = bool(values["visible"])

    def apply(self, values: dict | None = None) -> None:
        self._write(self.after if values is None else values)

    def revert(self) -> None:
        self._write(self.before)


class History:
    """In-memory undo/redo stack; never persisted across editor sessions."""

    def __init__(self) -> None:
        self._undo: list[StateCommand] = []
        self._redo: list[StateCommand] = []

    @property
    def can_undo(self) -> bool:
        return bool(self._undo)

    @property
    def can_redo(self) -> bool:
        return bool(self._redo)

    def push(self, command: StateCommand) -> None:
        self._undo.append(command)
        del self._redo[:]

    def undo(self) -> str | None:
        if not self._undo:
            return None
        command = self._undo.pop()
        command.revert()
        self._redo.append(command)
        return command.label

    def redo(self) -> str | None:
        if not self._redo:
            return None
        command = self._redo.pop()
        command.apply()
        self._undo.append(command)
        return command.label

    def clear(self) -> None:
        del self._undo[:]
        del self._redo[:]