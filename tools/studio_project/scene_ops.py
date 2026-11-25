"""Id-addressed edit operations on one authored scene.

The visual agent used to rewrite a whole scene, which changed ids, states and props the user had already seen. A revision
is a short list of operations instead; Core applies it to a copy of the scene, checks that the scene still hangs together,
and can describe exactly what changed.

Paths address entities, states and events by id, never by index:
  entities/<entity>/states/<state>/transform/x     set a nested value
  entities/<entity>, events/<event>                remove, or set to replace the whole item
  entities, events                                 add an item that carries a new id
  grammar, semantic_goal, layout_contract, ...     set a top-level field
"""
from __future__ import annotations

import copy

LISTS = ("entities", "events")
TOP_LEVEL = ("grammar", "semantic_goal", "layout_contract", "experience_profile", "transition")


def _item(container: list, ident: str, what: str) -> dict:
    found = next((row for row in container if isinstance(row, dict) and row.get("id") == ident), None)
    if found is None:
        raise ValueError(f"Không có {what} {ident!r}")
    return found


def _walk(scene: dict, segments: list[str]):
    """The parent container and the final key for a path; every segment before it must already exist."""
    node, index = scene, 0
    while index < len(segments) - 1:
        key = segments[index]
        if isinstance(node, dict) and key in LISTS and isinstance(node.get(key), list):
            node = _item(node[key], segments[index + 1], "entity" if key == "entities" else "event")
            index += 2
            if index >= len(segments):
                raise ValueError("Đường dẫn dừng ở một phần tử; dùng remove hoặc set trên đường dẫn đó")
            continue
        if not isinstance(node, dict) or key not in node:
            raise ValueError(f"Không có trường {key!r} trong đường dẫn {'/'.join(segments)}")
        node = node[key]
        index += 1
    return node, segments[-1]


def _apply(scene: dict, op: dict) -> None:
    kind, path = op.get("op"), str(op.get("path") or "")
    segments = [s for s in path.split("/") if s]
    if kind not in ("set", "add", "remove") or not segments:
        raise ValueError(f"Thao tác không hợp lệ: {op!r}")
    if kind == "add":
        if segments[0] not in LISTS or len(segments) != 1:
            raise ValueError(f"add chỉ dùng cho entities hoặc events, không phải {path!r}")
        value = op.get("value")
        if not isinstance(value, dict) or not value.get("id"):
            raise ValueError("add cần một phần tử có id")
        if any(row.get("id") == value["id"] for row in scene[segments[0]]):
            raise ValueError(f"{segments[0]} đã có id {value['id']!r}")
        scene[segments[0]].append(copy.deepcopy(value))
        return
    if segments[0] in LISTS and len(segments) == 2:  # a whole entity or event
        container = scene[segments[0]]
        item = _item(container, segments[1], "entity" if segments[0] == "entities" else "event")
        if kind == "remove":
            container.remove(item)
        else:
            value = op.get("value")
            if not isinstance(value, dict) or value.get("id") != segments[1]:
                raise ValueError("set trên cả phần tử phải giữ nguyên id")
            container[container.index(item)] = copy.deepcopy(value)
        return
    if len(segments) == 1:
        if kind == "remove" or segments[0] not in TOP_LEVEL:
            raise ValueError(f"Không sửa được trường {segments[0]!r}; chỉ {', '.join(TOP_LEVEL)}")
        scene[segments[0]] = copy.deepcopy(op.get("value"))
        return
    parent, key = _walk(scene, segments)
    if kind == "set":
        if not isinstance(parent, dict) or (key not in parent and not (isinstance(parent, dict) and segments[-2] in ("transform", "states"))):
            raise ValueError(f"Không có trường {key!r} để sửa trong {path!r}")
        parent[key] = copy.deepcopy(op.get("value"))
    else:
        if not isinstance(parent, dict) or key not in parent:
            raise ValueError(f"Không có trường {key!r} để xóa trong {path!r}")
        del parent[key]


def _integrity(scene: dict) -> None:
    entities = {e["id"]: e for e in scene.get("entities", [])}
    for event in scene.get("events", []):
        entity = entities.get(event.get("target"))
        if entity is None:
            raise ValueError(f"Sự kiện {event.get('id')} nhắm tới entity {event.get('target')!r} không còn trong cảnh; xóa sự kiện đó cùng lúc")
        for field in ("state_before", "state_after"):
            if event.get(field) not in (entity.get("states") or {}):
                raise ValueError(f"Sự kiện {event.get('id')}: {field} {event.get(field)!r} không có trong entity {entity['id']}")
    for entity in entities.values():
        if entity.get("initial_state") not in (entity.get("states") or {}):
            raise ValueError(f"Entity {entity['id']} mất trạng thái khởi đầu {entity.get('initial_state')!r}")


def apply_scene_ops(scene: dict, ops: list[dict]) -> dict:
    """A new scene with `ops` applied in order; the input is never modified. Raises ValueError with the id at fault."""
    if not isinstance(ops, list):
        raise ValueError("ops phải là danh sách")
    result = copy.deepcopy(scene)
    for op in ops:
        if not isinstance(op, dict):
            raise ValueError(f"Thao tác không hợp lệ: {op!r}")
        _apply(result, op)
    _integrity(result)
    return result


def _flat(value, prefix=""):
    if isinstance(value, dict):
        for key, inner in value.items():
            yield from _flat(inner, f"{prefix}{key}.")
    else:
        yield prefix.rstrip("."), value


def scene_changes(old: dict, new: dict) -> list[str]:
    """One Vietnamese line per visible change, for the review before the user applies a revision."""
    lines: list[str] = []
    old_entities = {e["id"]: e for e in old.get("entities", [])}
    new_entities = {e["id"]: e for e in new.get("entities", [])}
    lines += [f"Thêm {new_entities[i].get('kind', 'đối tượng')} {i}" for i in new_entities if i not in old_entities]
    lines += [f"Bỏ {old_entities[i].get('kind', 'đối tượng')} {i}" for i in old_entities if i not in new_entities]
    for ident in old_entities.keys() & new_entities.keys():
        before, after = old_entities[ident], new_entities[ident]
        for state in sorted(set(before.get("states", {})) | set(after.get("states", {}))):
            a, b = dict(_flat(before.get("states", {}).get(state, {}))), dict(_flat(after.get("states", {}).get(state, {})))
            for key in sorted(set(a) | set(b)):
                if a.get(key) != b.get(key):
                    label = key.replace("transform.", "")
                    lines.append(f"{before.get('kind', 'Đối tượng').capitalize()} {ident} ({state}): {label} {a.get(key)} → {b.get(key)}")
    old_events = {e["id"]: e for e in old.get("events", [])}
    new_events = {e["id"]: e for e in new.get("events", [])}
    lines += [f"Thêm sự kiện {i}: {new_events[i].get('action', '')}".rstrip(": ") for i in new_events if i not in old_events]
    lines += [f"Bỏ sự kiện {i}" for i in old_events if i not in new_events]
    lines += [f"Sửa sự kiện {i}" for i in old_events.keys() & new_events.keys() if old_events[i] != new_events[i]]
    for key, label in (("grammar", "Cấu trúc khung (grammar)"), ("semantic_goal", "Mục tiêu cảnh"), ("layout_contract", "Bố cục"),
                       ("experience_profile", "Hồ sơ trải nghiệm"), ("transition", "Chuyển cảnh")):
        if old.get(key) != new.get(key):
            lines.append(f"{label} đã đổi")
    return lines
